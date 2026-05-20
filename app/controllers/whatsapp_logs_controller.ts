
import type { HttpContext } from '@adonisjs/core/http'
import WhatsappLog from '#models/whatsapp_log'

export default class WhatsappLogsController {
  async index({ params, request, response }: HttpContext) {
    const { hotelId } = params
    const { reservationId } = request.qs()

    const query = WhatsappLog.query()
      .where('hotel_id', hotelId)
      .orderBy('created_at', 'desc')

    if (reservationId) {
      query.where('reservation_id', reservationId)
    }

    const logs = await query.limit(50)
    return response.ok({ data: logs })
  }
}