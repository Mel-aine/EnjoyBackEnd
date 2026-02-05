import type { HttpContext } from '@adonisjs/core/http'
import StaffAccessCardService from '#services/staff_access_card_service'
import StaffAccessCard from '#models/staff_access_card'
import { DateTime } from 'luxon'


export default class StaffAccessCardsController {
  private staffAccessCardService: StaffAccessCardService

  constructor() {
    this.staffAccessCardService = new StaffAccessCardService()
  }

  /**

   * Gère automatiquement :
   * - Master card (accessType: 'master')
   * - Limited card (accessType: 'limited' + doorIds)
   * - Temporary card (accessType: 'temporary' + validFrom/validUntil)
   */
  async store({ request, response, auth }: HttpContext) {
  try {
    const data = request.only([
      'userId',
      'staffFirstName',
      'staffLastName',
      'staffPosition',
      'staffPhoneNumber',
      'staffEmployeeId',
      'cardUid',
      'accessType',
      'notes',
      'doorIds',
      'validFrom',
      'validUntil',
    ])

    const currentUser = await auth.authenticate()
    const issuedBy = currentUser.id
    console.log('data', data)

    // Validation du type d'accès
    const { accessType } = data
    if (!['master', 'limited', 'temporary'].includes(accessType)) {
      return response.badRequest({
        success: false,
        message: 'Invalid accessType. Must be: master, limited, or temporary'
      })
    }

    // Si userId est fourni, vérifier qu'il existe
    if (data.userId) {
      const { default: User } = await import('#models/user')
      const userExists = await User.find(data.userId)
      if (!userExists) {
        return response.badRequest({
          success: false,
          message: `User with ID ${data.userId} not found`
        })
      }
    }

    // Validation : Si pas de userId, vérifier firstName + lastName
    if (!data.userId && (!data.staffFirstName || !data.staffLastName)) {
      return response.badRequest({
        success: false,
        message: 'Either userId or staff name (firstName + lastName) is required'
      })
    }

    // Préparer les params communs
    const baseParams = {
      userId: data.userId || null,
      staffFirstName: data.staffFirstName || null,
      staffLastName: data.staffLastName || null,
      staffPosition: data.staffPosition || null,
      staffPhoneNumber: data.staffPhoneNumber || null,
      staffEmployeeId: data.staffEmployeeId || null,
      cardUid: data.cardUid,
      issuedBy,
      notes: data.notes || null,
      validFrom: data.validFrom ? DateTime.fromISO(data.validFrom) : undefined,
      validUntil: data.validUntil ? DateTime.fromISO(data.validUntil) : undefined,
    }

    let result

    if (accessType === 'master') {
      result = await this.staffAccessCardService.createMasterCard(baseParams)

    } else if (accessType === 'limited') {
      if (!data.doorIds || !Array.isArray(data.doorIds) || data.doorIds.length === 0) {
        return response.badRequest({
          success: false,
          message: 'doorIds is required for limited access type'
        })
      }

      result = await this.staffAccessCardService.createLimitedCard({
        ...baseParams,
        doorIds: data.doorIds
      })

    } else if (accessType === 'temporary') {
      if (!data.validFrom || !data.validUntil) {
        return response.badRequest({
          success: false,
          message: 'validFrom and validUntil are required for temporary access type'
        })
      }

      result = await this.staffAccessCardService.createMasterCard({
        ...baseParams,
        validFrom: DateTime.fromISO(data.validFrom),
        validUntil: DateTime.fromISO(data.validUntil),
      })
    }

    return response.created({
      success: true,
      message: `${accessType} card created successfully`,
      data: result
    })

  } catch (error) {
    console.error('Error creating staff access card:', error)

    //  Améliorer le message d'erreur
    return response.badRequest({
      success: false,
      message: error.message || 'Error creating staff access card',
      error: error.stack || error.message
    })
  }
}

  /**

   * POST /staff-access-cards/master
   */
  async createMasterCard({ request, response, auth }: HttpContext) {
    try {
      const data = request.only([
        'userId',
        'staffFirstName',
        'staffLastName',
        'staffPosition',
        'staffPhoneNumber',
        'staffEmployeeId',
        'cardUid',
        'validFrom',
        'validUntil',
        'notes',
      ])

      const currentUser = await auth.authenticate()


      const params = {
        ...data,
        issuedBy: currentUser.id,
        validFrom: data.validFrom ? DateTime.fromISO(data.validFrom) : undefined,
        validUntil: data.validUntil ? DateTime.fromISO(data.validUntil) : undefined,
      }

      const result = await this.staffAccessCardService.createMasterCard(params)

      return response.created({
        success: true,
        data: result
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: error.message,
      })
    }
  }

  /**
   * Récupérer tous les badges
   * GET /staff-access-cards
   */
  async index({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const perPage = request.input('perPage', 50)
      const status = request.input('status') // 'active', 'revoked', etc.
      const accessType = request.input('accessType') // 'master', 'limited', 'temporary'

      const query = StaffAccessCard.query()
        .preload('user')
        .preload('doors')
        .orderBy('created_at', 'desc')

      if (status) {
        query.where('status', status)
      }

      if (accessType) {
        query.where('access_type', accessType)
      }

      const cards = await query.paginate(page, perPage)

      return response.ok({
        success: true,
        data: cards
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: error.message,
      })
    }
  }

  /**
   * Récupérer un badge par ID
   * GET /staff-access-cards/:id
   */
  async show({ params, response }: HttpContext) {
    try {
      const card = await StaffAccessCard.query()
        .where('id', params.id)
        .preload('user')
        .preload('doors')
        .firstOrFail()

      return response.ok({
        success: true,
        data: card
      })
    } catch (error) {
      return response.notFound({
        success: false,
        message: 'Badge not found',
      })
    }
  }

  /**
   * Révoquer un badge
   * POST /staff-access-cards/:id/revoke
   */
  async revoke({ params, request, response, auth }: HttpContext) {
    try {
      const currentUser = await auth.authenticate()
      const { reason } = request.only(['reason'])

      const result = await this.staffAccessCardService.revokeCard(
        params.id,
        currentUser.id,
        reason
      )

      return response.ok({
        success: true,
        message: 'Card revoked successfully',
        data: result
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: error.message,
      })
    }
  }

  /**
   * Désactiver un badge (soft delete)
   * PATCH /staff-access-cards/:id/deactivate
   */
  async deactivate({ params, request, response, auth }: HttpContext) {
  try {
    const currentUser = await auth.authenticate()
    const { reason } = request.only(['reason'])

    const result = await this.staffAccessCardService.suspendCard(
      params.id,
      currentUser.id,
      reason
    )

    return response.ok({
      success: true,
      message: 'Card suspended temporarily',
      data: result
    })
  } catch (error) {
    return response.badRequest({
      success: false,
      message: error.message,
    })
  }
}

  // app/controllers/staff_access_cards_controller.ts

/**
 * Re-synchroniser une carte avec tous les terminaux
 */
async sync({ params, response }: HttpContext) {
  try {
    const result = await this.staffAccessCardService.syncCard(params.id)

    return response.ok({
      success: true,
      message: 'Card synchronized successfully',
      data: result
    })
  } catch (error) {
    return response.badRequest({
      success: false,
      message: error.message || 'Error synchronizing card',
    })
  }
}
}
