// app/controllers/webhooks/whatsapp_webhook_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import WhatsAppWebhookService from '#services/whatsapp_webhook_service'
import env from '#start/env'

const STATUS_MAP: Record<string, 'sent' | 'delivered' | 'read' | 'failed'> = {
  sent: 'sent',
  delivered: 'delivered',
  read: 'read',
  failed: 'failed',
}


export default class WhatsAppWebhookController {
  // Vérification Meta (obligatoire à la création du webhook)
 async verify({ request, response }: HttpContext) {
  const mode = request.qs()['hub.mode']
  const token = request.qs()['hub.verify_token']
  const challenge = request.qs()['hub.challenge']


  const verifyToken = env.get('WHATSAPP_WEBHOOK_VERIFY_TOKEN')

  if (mode === 'subscribe' && token === verifyToken) {
    return response.ok(challenge)  // doit retourner JUSTE le challenge en texte brut
  }

  console.log('Vérification échouée')
  return response.forbidden({ error: 'invalid_verify_token' })
}

  async handle({ request, response }: HttpContext) {
    const payload = request.body()

    response.ok({ status: 'received' })
    const service = new WhatsAppWebhookService()
    service.process(payload).catch((err) =>
      console.error('[Webhook] Erreur traitement asynchrone:', err)
    )
   
  }
}