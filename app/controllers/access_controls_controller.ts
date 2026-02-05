import type { HttpContext } from '@adonisjs/core/http'
import Door from '#models/door'
import DoorAccessLog from '#models/door_access_log'
import ZkAccessService from '#services/zk_access_service'
import { DateTime } from 'luxon'

/**
 * Contrôleur pour la gestion des terminaux de contrôle d'accès
 */
export default class AccessControlController {
  private zkService: ZkAccessService

  constructor() {
    this.zkService = new ZkAccessService()
  }

  /**
   * Liste tous les terminaux
   */
  public async index({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const perPage = request.input('per_page', 50)
      const isActive = request.input('is_active')
      const all = request.input('all',false)

      const query = Door.query().preload('room' ,(query) => {
        query.preload('roomType')
      }).preload('creator').preload('modifier')

      // Filtrer par statut si spécifié
      if (isActive !== undefined) {
        query.where('is_active', isActive === 'true' || isActive === true)
      }


      if(all === true || all === 'true'){
        const allDoors = await query

         return response.ok({
          success: true,
          data: allDoors,
          meta: {
            total: allDoors.length,
            all: true
          }
        })
      }

       const doors = await query.paginate(page, perPage)

      return response.ok({
        success: true,
        data: doors,
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la récupération des terminaux',
        error: error.message,
      })
    }
  }

  /**
   * Affiche les détails d'un terminal
   */
  public async show({ params, response }: HttpContext) {
    try {
      const door = await Door.query()
        .where('id', params.id)
        .preload('room')
        .firstOrFail()

      return response.ok({
        success: true,
        data: door,
      })
    } catch (error) {
      return response.notFound({
        success: false,
        message: 'Terminal non trouvé',
      })
    }
  }

  /**
   * Crée un nouveau terminal
   */
  public async store(ctx: HttpContext) {
    const { request, response } = ctx

    try {
      const data = request.only(['name', 'ip_address', 'port', 'room_id', 'is_active'])


      const door = await Door.create({
        name: data.name,
        ipAddress: data.ip_address,
        port: data.port || 4370,
        roomId: data.room_id || null,
        isActive: data.is_active !== undefined ? data.is_active : true,
        createdBy: ctx.auth.user?.id || null,

      })

      return response.created({
        success: true,
        message: 'Terminal créé avec succès',
        data: door,
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Erreur lors de la création du terminal',
        error: error.message,
      })
    }
  }

  /**
   * Met à jour un terminal
   */
  public async update(ctx: HttpContext) {
    const { params, request, response } = ctx
    try {
      const door = await Door.findOrFail(params.id)
      const data = request.only(['name', 'ip_address', 'port', 'room_id', 'is_active'])

      door.merge({
        name: data.name,
        ipAddress: data.ip_address,
        port: data.port,
        roomId: data.room_id,
        isActive: data.is_active,
        lastModifiedBy: ctx.auth.user?.id || null
      })

      await door.save()

      return response.ok({
        success: true,
        message: 'Terminal mis à jour avec succès',
        data: door,
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Erreur lors de la mise à jour du terminal',
        error: error.message,
      })
    }
  }

  /**
   * Supprime un terminal
   */
  public async destroy({ params, response }: HttpContext) {
    try {
      const door = await Door.findOrFail(params.id)
      await door.delete()

      return response.ok({
        success: true,
        message: 'Terminal supprimé avec succès',
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Erreur lors de la suppression du terminal',
        error: error.message,
      })
    }
  }

  /**
   * Teste la connexion avec un terminal
   */
  public async testConnection({ params, response }: HttpContext) {
    try {
      const result = await this.zkService.testConnection(params.id)

      return response.ok({
        success: result.success,
        message: result.message,
        data: result.data,
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Erreur lors du test de connexion',
        error: error.message,
      })
    }
  }


  /**
   * Déverrouille une porte à distance
   */
  public async unlock({ params, request, response }: HttpContext) {
    try {
      const duration = request.input('duration', 5)
      const result = await this.zkService.unlockDoor(params.id, duration)

      return response.ok({
        success: result.success,
        message: result.message,
        data: result.data,
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Erreur lors du déverrouillage',
        error: error.message,
      })
    }
  }

  /**
   * Synchronise les logs d'un terminal
   */
  public async syncLogs({ params, request, response }: HttpContext) {
    try {
      const clearAfterSync = request.input('clear_after_sync', false)
      const result = await this.zkService.syncLogs(params.id, clearAfterSync)

      return response.ok({
        success: result.success,
        message: result.message,
        data: result.data,
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Erreur lors de la synchronisation des logs',
        error: error.message,
      })
    }
  }

  /**
   * Synchronise l'heure d'un terminal
   */
  public async syncTime({ params, response }: HttpContext) {
    try {
      const result = await this.zkService.syncTime(params.id)

      return response.ok({
        success: result.success,
        message: result.message,
        data: result.data,
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Erreur lors de la synchronisation de l\'heure',
        error: error.message,
      })
    }
  }

  /**
   * Récupère les informations système d'un terminal
   */
  public async getInfo({ params, response }: HttpContext) {
    try {
      const result = await this.zkService.getDeviceInfo(params.id)

      return response.ok({
        success: result.success,
        data: result.data,
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Erreur lors de la récupération des informations',
        error: error.message,
      })
    }
  }

  /**
   * Récupère l'historique d'accès d'un terminal
   */
  public async getLogs({ params, request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const perPage = request.input('per_page', 50)
      const startDate = request.input('start_date')
      const endDate = request.input('end_date')
      const userId = request.input('user_id')

      const query = DoorAccessLog.query()
        .where('door_id', params.id)
        .orderBy('access_time', 'desc')

      // Filtrer par dates
      if (startDate) {
        query.where('access_time', '>=', DateTime.fromISO(startDate).toJSDate())
      }
      if (endDate) {
        query.where('access_time', '<=', DateTime.fromISO(endDate).toJSDate())
      }

      // Filtrer par utilisateur
      if (userId) {
        query.where('user_id_on_device', userId)
      }

      const logs = await query.paginate(page, perPage)

      return response.ok({
        success: true,
        data: logs,
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Erreur lors de la récupération des logs',
        error: error.message,
      })
    }
  }




}
