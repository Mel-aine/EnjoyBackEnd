import type { HttpContext } from '@adonisjs/core/http'
import Schedule from '#models/schedules';
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'
import LoggerService from '#services/logger_service'



const scheduleService = new CrudService(Schedule)

export default class SchedulesController extends CrudController<typeof Schedule> {

   constructor() {
    super(scheduleService)
  }
  /**
   * Liste des horaires avec filtres et pagination
   */
  public async index({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const startDate = request.input('start_date')
      const endDate = request.input('end_date')

      const query = Schedule.query().preload('user')

      if (startDate) {
        query.where('schedule_date', '>=', startDate)
      }

      if (endDate) {
        query.where('schedule_date', '<=', endDate)
      }

      const schedules = await query.paginate(page, limit)

      return response.ok({
        message: 'Horaires récupérés avec succès',
        data: schedules
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Erreur lors de la récupération des horaires',
        error: error.message
      })
    }
  }

  /**
   * Créer un nouvel horaire
   */


public async create(ctx: HttpContext) {
  const { request, response } = ctx
  try {
    const scheduleValidator = vine.compile(
      vine.object({
        user_id: vine.number().exists(async (db, value) => {
          const user = await db.from('users').where('id', value).first()
          return !!user
        }).nullable(),

        service_id: vine.number().optional(),
        service_product_id: vine.number().nullable().optional(),
        travel_route_id: vine.number().nullable().optional(),
        travel_vehicle_id: vine.number().nullable().optional(),
        driver_user_id: vine.number().nullable().optional(),
        departure_datetime: vine.date().nullable().optional(),
        arrival_datetime: vine.date().nullable().optional(),
        available_seats: vine.number().nullable().optional(),
        price_per_seat: vine.number().nullable().optional(),
        status: vine.string().optional(),
        notes: vine.string().nullable().optional(),
        schedule_date: vine.date().optional(),
        created_by: vine.number().nullable().optional(),
        last_modified_by: vine.number().nullable().optional(),
      })
    )

    const payload = await request.validateUsing(scheduleValidator)

    const created = await Schedule.create({
      ...payload,
      departure_datetime: payload.departure_datetime ? DateTime.fromJSDate(payload.departure_datetime) : null,
      arrival_datetime: payload.arrival_datetime ? DateTime.fromJSDate(payload.arrival_datetime) : null,
      schedule_date: payload.schedule_date ? DateTime.fromJSDate(payload.schedule_date) : null,
      start_time: request.input('start_time'),
      end_time: request.input('end_time')
    })

    await LoggerService.log({
      actorId: payload.created_by || 0,
      action: 'CREATE',
      entityType: 'Schedule',
      entityId: created.id.toString(),
      description: `Horaire créé pour le service_id=${payload.service_id ?? 'N/A'}`,
      ctx: ctx,
    })

    const schedule = await Schedule.query()
      .where('id', created.id)
      .preload('user')
      .firstOrFail()

    return response.created({
      message: 'Horaire créé avec succès',
      data: schedule,
    })
  } catch (error) {
    if (error.messages) {
      return response.badRequest({
        message: 'Erreur de validation',
        errors: error.messages,
      })
    }

    return response.badRequest({
      message: 'Erreur lors de la création de l\'horaire',
      error: error.message,
    })
  }
}


  /**
   * Afficher un horaire spécifique
   */
 public async show({ params, response }: HttpContext) {
  try {
    const schedule = await Schedule.query()
      .where('id', params.id)
      .preload('user')
      .firstOrFail()

    return response.ok({
      message: 'Horaire récupéré avec succès',
      data: schedule
    })
  } catch (error) {
    return response.notFound({
      message: 'Horaire non trouvé'
    })
  }
}




  /**
   * Supprimer un horaire
   */
  public async destroy({ params, response }: HttpContext) {
    try {
      const schedule = await Schedule.findOrFail(params.id)
      await schedule.delete()

      return response.ok({
        message: 'Horaire supprimé avec succès'
      })
    } catch (error) {
      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({
          message: 'Horaire non trouvé'
        })
      }

      return response.internalServerError({
        message: 'Erreur lors de la suppression de l\'horaire',
        error: error.message
      })
    }
  }

  /**
   * Obtenir les horaires d'un utilisateur spécifique
   */
  public async getByUser({ params, request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const startDate = request.input('start_date')
      const endDate = request.input('end_date')

      const query = Schedule.query()
        .where('user_id', params.userId)
        .preload('user')

      if (startDate) {
        query.where('schedule_date', '>=', startDate)
      }

      if (endDate) {
        query.where('schedule_date', '<=', endDate)
      }

      const schedules = await query.paginate(page, limit)

      return response.ok({
        message: 'Horaires de l\'utilisateur récupérés avec succès',
        data: schedules
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Erreur lors de la récupération des horaires',
        error: error.message
      })
    }
  }

  /**
   * Obtenir les horaires par type de status
   */
  public async getByShiftType({ params, request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const startDate = request.input('start_date')
      const endDate = request.input('end_date')

      const query = Schedule.query()
        .where('status', params.status)
        .preload('user')

      if (startDate) {
        query.where('schedule_date', '>=', startDate)
      }

      if (endDate) {
        query.where('schedule_date', '<=', endDate)
      }

      const schedules = await query.paginate(page, limit)

      return response.ok({
        message: `Horaires ${params.status} récupérés avec succès`,
        data: schedules
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Erreur lors de la récupération des horaires',
        error: error.message
      })
    }
  }



  /**
   * Obtenir les statistiques des horaires
   */
  public async stats({ request, response }: HttpContext) {
    try {
      const startDate = request.input('start_date')
      const endDate = request.input('end_date')

      const query = Schedule.query()

      if (startDate) {
        query.where('schedule_date', '>=', startDate)
      }

      if (endDate) {
        query.where('schedule_date', '<=', endDate)
      }

      const [
        totalSchedules,
        schedulesByShiftType,
        schedulesByUser
      ] = await Promise.all([
        query.clone().count('* as total'),
        query.clone().groupBy('shift_type').select('shift_type').count('* as total'),
        query.clone().groupBy('user_id').select('user_id').count('* as total').preload('user')
      ])

      return response.ok({
        message: 'Statistiques récupérées avec succès',
        data: {
          total_schedules: totalSchedules[0].id,
          by_status: schedulesByShiftType,
          by_user: schedulesByUser
        }
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Erreur lors de la récupération des statistiques',
        error: error.message
      })
    }
  }


  public async lister({ request }: HttpContext) {
  const serviceId = request.input('service_id')

  const query = Schedule.query().preload('user')

  if (serviceId) {
    query.where('service_id', serviceId)
  }

  const results = await query
  return {
    data: results,
  }
}



}

