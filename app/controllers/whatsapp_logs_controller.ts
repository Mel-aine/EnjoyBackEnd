
import type { HttpContext } from '@adonisjs/core/http'
import WhatsappLog from '#models/whatsapp_log'

export default class WhatsappLogsController {
  async index({ params, request, response }: HttpContext) {
    const { hotelId } = params
      const { reservationId, page, perPage } = request.qs()

    const query = WhatsappLog.query()
      .where('hotel_id', hotelId)
      .orderBy('created_at', 'desc')

    if (reservationId) {
      query.where('reservation_id', reservationId)
    }

    const logs = await query.paginate(Number(page) || 1, Number(perPage) || 20)

    return response.ok(logs)
  }
}