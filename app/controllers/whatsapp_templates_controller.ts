import type { HttpContext } from '@adonisjs/core/http'
import WhatsappTemplateSyncService from '../services/whatsapp_template_sync_service.js'
import HotelWhatsappTemplate from '#models/hotel_whatsapp_template'




export default class WhatsappTemplateController {
  private syncService = new WhatsappTemplateSyncService()

  // ---------------------------------------------------------------------------
  // GET /hotels/:hotelId/whatsapp/templates
  // ---------------------------------------------------------------------------
  public async index({ params, response }: HttpContext) {
    const templates = await HotelWhatsappTemplate.query()
      .where('hotel_id', params.hotelId)
      .orderBy('template_name', 'asc')

    return response.ok(templates)
  }

  // ---------------------------------------------------------------------------
  // POST /hotels/:hotelId/whatsapp/templates/sync
  // Force une re-synchronisation des templates
  // ---------------------------------------------------------------------------
  public async sync({ params, response }: HttpContext) {
    const result = await this.syncService.syncHotelTemplates(Number(params.hotelId))
    return response.ok({ message: 'Synchronisation terminée', result })
  }

  // ---------------------------------------------------------------------------
  // POST /webhooks/meta/template-status
  // Reçoit les mises à jour de statut depuis Meta
  // ---------------------------------------------------------------------------
  public async handleMetaWebhook({ request, response }: HttpContext) {
    const body = request.body()

    // Vérification basique du token Meta
    const verifyToken = request.header('x-hub-signature-256')
    if (!verifyToken) {
      return response.unauthorized({ message: 'Signature manquante' })
    }

    // Parcourir les entrées du webhook
    const entries = body?.entry ?? []

    for (const entry of entries) {
      const changes = entry?.changes ?? []
      for (const change of changes) {
        if (change.field !== 'message_template_status_update') continue

        const { message_template_name, message_template_id, event, reason } = change.value

        // Retrouver l'hôtel lié à ce WABA ID
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

  /**
   * Résout l'hotelId depuis un WABA ID.
   * À adapter selon votre modèle de stockage des credentials.
   */
  private async resolveHotelIdFromWabaId(wabaId: string): Promise<number | null> {
    // TODO: implémenter selon votre modèle HotelWhatsappConfig
    // Exemple : const config = await HotelWhatsappConfig.query().where('waba_id', wabaId).first()
    // return config?.hotelId ?? null
    return null
  }
}