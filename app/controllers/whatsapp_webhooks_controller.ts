// app/controllers/webhooks/whatsapp_webhook_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import WhatsAppWebhookService from '#services/whatsapp_webhook_service'
import env from '#start/env'



export default class WhatsAppWebhookController {
  // Vérification Meta (obligatoire à la création du webhook)
 async verify({ request, response }: HttpContext) {
  const mode = request.qs()['hub.mode']
  const token = request.qs()['hub.verify_token']
  const challenge = request.qs()['hub.challenge']

  console.log('🔐 Webhook verify appelé')
  console.log('mode:', mode)
  console.log('token reçu:', token)
  console.log('token attendu:', env.get('WHATSAPP_WEBHOOK_VERIFY_TOKEN'))
  console.log('challenge:', challenge)

  const verifyToken = env.get('WHATSAPP_WEBHOOK_VERIFY_TOKEN')

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('✅ Vérification réussie')
    return response.ok(challenge)  // doit retourner JUSTE le challenge en texte brut
  }

  console.log('❌ Vérification échouée')
  return response.forbidden({ error: 'invalid_verify_token' })
}

  async handle({ request, response }: HttpContext) {
    const payload = request.body()
    console.log(' Webhook reçu:', JSON.stringify(payload, null, 2))

    const service = new WhatsAppWebhookService()
    await service.process(payload)

    // Meta exige toujours un 200 rapide
    return response.ok({ status: 'received' })
  }
}