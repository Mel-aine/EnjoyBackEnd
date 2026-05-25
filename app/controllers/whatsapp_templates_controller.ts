import type { HttpContext } from '@adonisjs/core/http'
import WhatsappTemplateSyncService from '../services/whatsapp_template_sync_service.js'
import HotelWhatsappTemplate from '#models/hotel_whatsapp_template'

export default class WhatsappTemplateController {
  private syncService = new WhatsappTemplateSyncService()

  // ---------------------------------------------------------------------------
  // GET /whatsapp/templates
  // Liste paginée avec filtres status & category
  // ---------------------------------------------------------------------------
  public async index({  request, response }: HttpContext) {
    const { page = 1, limit = 20, status, category } = request.qs()

    const query = HotelWhatsappTemplate.query()
      .orderBy('template_name', 'asc')

    if (status) {
      query.where('status', status.toUpperCase())
    }

    if (category) {
      query.where('category', category.toUpperCase())
    }

    const templates = await query.paginate(Number(page), Number(limit))

    return response.ok(templates.toJSON())
  }

  // ---------------------------------------------------------------------------
  // POST /hotels/:hotelId/whatsapp/templates/sync
  // Force une re-synchronisation des templates depuis Meta
  // ---------------------------------------------------------------------------
 public async sync({ params, response }: HttpContext) {
  const hotelId = params.hotelId ? Number(params.hotelId) : undefined
  const result = await this.syncService.syncHotelTemplates(hotelId)
  return response.ok({ message: 'Synchronisation terminée', result })
}

  // ---------------------------------------------------------------------------
  // POST /webhooks/meta/template-status
  // Reçoit les mises à jour de statut depuis Meta
  // ---------------------------------------------------------------------------
  public async handleMetaWebhook({ request, response }: HttpContext) {
    const body = request.body()

    const verifyToken = request.header('x-hub-signature-256')
    if (!verifyToken) {
      return response.unauthorized({ message: 'Signature manquante' })
    }

    const entries = body?.entry ?? []

    for (const entry of entries) {
      const changes = entry?.changes ?? []
      for (const change of changes) {
        if (change.field !== 'message_template_status_update') continue

        const { message_template_name, message_template_id, event, reason } = change.value

        const hotelId = await this.resolveHotelIdFromWabaId(entry.id)
        if (!hotelId) continue

        const statusMap: Record<string, string> = {
          APPROVED: 'APPROVED',
          REJECTED: 'REJECTED',
          DISABLED: 'DISABLED',
          PAUSED: 'PAUSED',
        }

        const status = statusMap[event]
        if (!status) continue

        await this.syncService.handleStatusWebhook({
          hotelId,
          templateName: message_template_name,
          status: status as any,
          rejectionReason: reason,
        })
      }
    }

    return response.ok({ received: true })
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  private async resolveHotelIdFromWabaId(wabaId: string): Promise<number | null> {
    // TODO: adapter selon votre modèle HotelWhatsappConfig
    // const config = await HotelWhatsappConfig.query().where('waba_id', wabaId).first()
    // return config?.hotelId ?? null
    return null
  }
}