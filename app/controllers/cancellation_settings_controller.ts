import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import CancellationService from '#services/cancellation_service'
import CancellationSetting, {
  CancellationChargeType,
} from '#models/cancellation_setting'
import LoggerService from '#services/logger_service'

const settingsValidator = vine.compile(
  vine.object({
    cancellationFreeHours: vine.number().min(0).max(8760),
    cancellationChargeType: vine.enum([
      CancellationChargeType.FIRST_NIGHT,
      CancellationChargeType.PERCENTAGE,
      CancellationChargeType.FIXED_AMOUNT,
      CancellationChargeType.FULL_STAY,
      CancellationChargeType.FREE,
    ]),
    cancellationChargeValue: vine.number().min(0).nullable().optional(),
  })
)

export default class CancellationSettingsController {
  /**
   * GET /api/cancellation-settings/:hotelId
   * Récupère la politique d'annulation globale de l'établissement.
   */
  public async show({ params, response }: HttpContext) {
    try {
      const hotelId = Number(params.hotelId)
      if (!Number.isFinite(hotelId)) {
        return response.badRequest({ message: 'hotelId is required' })
      }
      const setting = await CancellationService.getSettings(hotelId)
      return response.ok(setting)
    } catch (error) {
      console.error('Error fetching cancellation settings:', error)
      return response.internalServerError({
        message: 'Failed to fetch cancellation settings',
        error: error.message,
      })
    }
  }

  /**
   * PUT /api/cancellation-settings/:hotelId
   * Crée ou met à jour la politique d'annulation globale (formulaire unique).
   */
  public async update({ params, request, response, auth }: HttpContext) {
    try {
      const hotelId = Number(params.hotelId)
      if (!Number.isFinite(hotelId)) {
        return response.badRequest({ message: 'hotelId is required' })
      }

      const payload = await request.validateUsing(settingsValidator, {
        data: request.body(),
      })

      // Valeur de pénalité requise pour PERCENTAGE / FIXED_AMOUNT
      if (
        (payload.cancellationChargeType === CancellationChargeType.PERCENTAGE ||
          payload.cancellationChargeType === CancellationChargeType.FIXED_AMOUNT) &&
        (payload.cancellationChargeValue === undefined ||
          payload.cancellationChargeValue === null)
      ) {
        return response.badRequest({
          message:
            'cancellationChargeValue is required for PERCENTAGE and FIXED_AMOUNT charge types',
        })
      }

      let setting = await CancellationSetting.query().where('hotelId', hotelId).first()
      if (setting) {
        setting.merge({
          cancellationFreeHours: payload.cancellationFreeHours,
          cancellationChargeType: payload.cancellationChargeType,
          cancellationChargeValue: payload.cancellationChargeValue ?? 0,
          lastModifiedByUserId: auth.user?.id ?? null,
        })
        await setting.save()
      } else {
        setting = await CancellationSetting.create({
          hotelId,
          cancellationFreeHours: payload.cancellationFreeHours,
          cancellationChargeType: payload.cancellationChargeType,
          cancellationChargeValue: payload.cancellationChargeValue ?? 0,
          lastModifiedByUserId: auth.user?.id ?? null,
        })
      }

      await LoggerService.log({
        actorId: auth.user?.id ?? 0,
        action: 'CANCELLATION_SETTINGS_UPDATED',
        entityType: 'CancellationSetting',
        entityId: setting.id,
        hotelId,
        description: `Cancellation policy updated: free until ${payload.cancellationFreeHours}h before check-in, charge type ${payload.cancellationChargeType}${payload.cancellationChargeValue != null ? ` (${payload.cancellationChargeValue})` : ''}.`,
        meta: { ...payload },
      })

      return response.ok(setting)
    } catch (error) {
      console.error('Error updating cancellation settings:', error)
      return response.badRequest({
        message: 'Failed to update cancellation settings',
        error: error.message,
      })
    }
  }
}
