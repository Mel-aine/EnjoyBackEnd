import type { HttpContext } from '@adonisjs/core/http'
import Hotel from '#models/hotel'
import WhatsAppNotificationService from '#services/whatsapp_notification_service'
import { testWhatsAppValidator } from '#validators/whatsapp'

export default class HotelWhatsAppController {
  private normalizePayload(body: Record<string, any>) {
    const configBody =
      body.config && typeof body.config === 'object' && !Array.isArray(body.config)
        ? (body.config as Record<string, any>)
        : {}

    const config = {
      provider: configBody.provider ?? body.providerType ?? body.provider,
      accessToken:
        configBody.accessToken ?? configBody.access_token ?? body.accessToken ?? body.access_token,
      token: configBody.token ?? body.token,
      bearerToken:
        configBody.bearerToken ?? configBody.bearer_token ?? body.bearerToken ?? body.bearer_token,
      phoneNumberId:
        configBody.phoneNumberId ??
        configBody.phone_number_id ??
        body.phoneNumberId ??
        body.phone_number_id,
      businessAccountId:
        configBody.businessAccountId ??
        configBody.business_account_id ??
        body.businessAccountId ??
        body.business_account_id,
      apiBaseUrl:
        configBody.apiBaseUrl ?? configBody.api_base_url ?? body.apiBaseUrl ?? body.api_base_url,
      apiVersion:
        configBody.apiVersion ?? configBody.api_version ?? body.apiVersion ?? body.api_version,
      endpointUrl:
        configBody.endpointUrl ?? configBody.endpoint_url ?? body.endpointUrl ?? body.endpoint_url,
      recipientPhoneNumber:
        configBody.recipientPhoneNumber ??
        configBody.recipient_phone_number ??
        body.recipientPhoneNumber ??
        body.recipient_phone_number ??
        body.phoneNumber ??
        body.phone_number,
      senderName:
        configBody.senderName ?? configBody.sender_name ?? body.senderName ?? body.sender_name,
    }

    return {
      ...body,
      recipientPhoneNumber: config.recipientPhoneNumber,
      config,
    }
  }

  async test({ params, request, response, auth }: HttpContext) {
    try {
      const user = auth.user!
      if (!user) return response.unauthorized({ error: 'Unauthorized' })

      const hotelId = params.hotelId
      if (!hotelId) return response.badRequest({ message: 'hotelId is required in route params' })

      const hotel = await Hotel.query()
        .where('id', hotelId)
        .firstOrFail()

      if (!hotel.whatsappEnabled) {
        return response.forbidden({ message: 'WhatsApp is not enabled for this hotel' })
      }

      const body = (request.body() ?? {}) as Record<string, any>

      // Fusionner la config sauvegardée avec ce qui est envoyé
      const mergedBody = {
        ...body,
        config: {
          ...(hotel.whatsappConfig ?? {}),
          ...(body.config ?? {}),
          provider: body.providerType ?? hotel.whatsappProviderType ?? body.config?.provider,
        },
      }

      const payload = await testWhatsAppValidator.validate(this.normalizePayload(mergedBody))

      const result = await new WhatsAppNotificationService().sendTextMessage({
        hotelId: hotel.id,
        recipientPhoneNumber: payload.recipientPhoneNumber ?? null,
        message:
            payload.message ??
            `Message de test WhatsApp - ${hotel.hotelName}. Si vous recevez ce message, la configuration est valide.`,
        configOverride: payload.config
            ? {
                provider: payload.config.provider,
                access_token: payload.config.accessToken,
                token: payload.config.token,
                bearer_token: payload.config.bearerToken,
                phone_number_id: payload.config.phoneNumberId,
                business_account_id: payload.config.businessAccountId,
                api_base_url: payload.config.apiBaseUrl,
                api_version: payload.config.apiVersion,
                endpoint_url: payload.config.endpointUrl,
                recipient_phone_number: payload.config.recipientPhoneNumber,
                sender_name: payload.config.senderName,
            }
            : null,
        })

      const statusCode = result.delivered ? 200 : 400
      response.status(statusCode)

      return {
        status: result.delivered ? 'success' : 'error',
        data: { notification: result },
      }
    } catch (error) {
      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({ message: 'Hotel not found' })
      }
      return response.internalServerError({
        message: 'Failed to send WhatsApp test message',
        error: error.message,
      })
    }
  }
}