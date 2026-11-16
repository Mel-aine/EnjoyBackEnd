import cron from 'node-cron'
import logger from '@adonisjs/core/services/logger'

let isRunning = false

async function runFeedbackSurveyCron() {
  const { default: WhatsappScheduledMessage } = await import('#models/whatsapp_scheduled_message')
  const { default: WhatsAppNotificationService } = await import('#services/whatsapp_notification_service')
  const { DateTime } = await import('luxon')

  const pending = await WhatsappScheduledMessage.query()
    .where('status', 'pending')
    .where('templateName', 'feedback_surveys')
    .where('sendAfter', '<=', DateTime.now().toSQL())
    .limit(50)

  if (pending.length === 0) return

  logger.info(`[FeedbackSurvey] ${pending.length} message(s) à envoyer`)

  const svc = new WhatsAppNotificationService()

  await Promise.allSettled(
    pending.map(async (msg) => {
      try {
        const result = await svc.notifyFeedbackSurvey({
          hotelId: msg.hotelId,
          reservationId: msg.reservationId,
          recipientPhoneNumber: msg.recipientPhone,
          recipientName: msg.recipientName ?? '',
          hotelName: msg.hotelName,
          invoiceUrl: msg.invoiceUrl ?? '',
        })

        msg.status = result.delivered ? 'sent' : 'failed'
        msg.sentAt = result.delivered ? DateTime.now() : null
        msg.failureReason = result.delivered ? null : (result.reason ?? 'unknown')
        await msg.save()

        logger.info('[FeedbackSurvey] Envoyé', {
          id: msg.id,
          phone: msg.recipientPhone,
          delivered: result.delivered,
        })
      } catch (err: any) {
        msg.status = 'failed'
        msg.failureReason = err?.message ?? 'exception'
        await msg.save()
        logger.error('[FeedbackSurvey] Erreur envoi', { id: msg.id, err })
      }
    })
  )
}

cron.schedule('* * * * *', async () => {
  if (isRunning) {
    logger.warn('[FeedbackSurvey] Cron déjà en cours, on skip')
    return
  }

  isRunning = true

  try {
    await runFeedbackSurveyCron()
  } catch (err) {
    logger.error('[FeedbackSurvey] Erreur cron', err)
  } finally {
    isRunning = false  
  }
})

/**
 * Hub OTA and Channex jobs run in the web server only: this file is also
 * preloaded by every `node ace` command (migrations, REPL, hub:* commands...),
 * which must not start background syncs of their own.
 */
async function isWebServer() {
  const { default: app } = await import('@adonisjs/core/services/app')
  return app.getEnvironment() === 'web'
}

/*
|--------------------------------------------------------------------------
| Hub OTA: nightly full availability resync (02:30)
|--------------------------------------------------------------------------
| Catches changes the model hooks did not see (bulk SQL updates, restarts).
| No-op unless HUB_ENABLED=true.
*/
let hubResyncRunning = false

cron.schedule('30 2 * * *', async () => {
  if (hubResyncRunning) return
  hubResyncRunning = true
  try {
    if (!(await isWebServer())) return
    const { isHubEnabled } = await import('#services/hub_service')
    if (!isHubEnabled()) return
    const { default: HubAvailabilitySync } = await import('#services/hub_availability_sync')
    const results = await HubAvailabilitySync.resyncAll()
    logger.info({ results }, '[Hub] nightly availability resync done')
  } catch (err) {
    logger.error({ err }, '[Hub] nightly availability resync failed')
  } finally {
    hubResyncRunning = false
  }
})

/*
|--------------------------------------------------------------------------
| Hub OTA: booking feed fallback (every minute)
|--------------------------------------------------------------------------
| The hub webhook triggers the same read; this catches a missed webhook.
| No-op unless HUB_ENABLED=true.
*/
let hubBookingsRunning = false

cron.schedule('* * * * *', async () => {
  if (hubBookingsRunning) return
  hubBookingsRunning = true
  try {
    if (!(await isWebServer())) return
    const { isHubEnabled } = await import('#services/hub_service')
    if (!isHubEnabled()) return
    const { default: HubBookingSync } = await import('#services/hub_booking_sync')
    await HubBookingSync.syncAll()
    // Cancellations made in enjoy that the hub has not received yet (flux E3).
    const { default: HubCancelSync } = await import('#services/hub_cancel_sync')
    await HubCancelSync.syncAll()
  } catch (err) {
    logger.error({ err }, '[Hub] booking feed fallback failed')
  } finally {
    hubBookingsRunning = false
  }
})

/*
|--------------------------------------------------------------------------
| Channex: booking feed (every minute)
|--------------------------------------------------------------------------
| Same code as POST /api/channex/sync/bookings/:hotelId, for every hotel
| linked to Channex. No-op unless CHANNEX_BOOKING_SYNC_CRON=true.
*/
let channexBookingsRunning = false

cron.schedule('* * * * *', async () => {
  if (channexBookingsRunning) return
  channexBookingsRunning = true
  try {
    if (!(await isWebServer())) return
    const { default: ChannexBookingCron, isChannexBookingCronEnabled } = await import(
      '#services/channex_booking_cron'
    )
    if (!isChannexBookingCronEnabled()) return
    const results = await ChannexBookingCron.runAll()
    const changed = results.filter((r) => r.created || r.updated || r.errors || r.status === 'failed')
    if (changed.length) logger.info({ results: changed }, '[ChannexCron] booking sync')
  } catch (err) {
    logger.error({ err }, '[ChannexCron] booking sync failed')
  } finally {
    channexBookingsRunning = false
  }
})

/*
|--------------------------------------------------------------------------
| Channex: nightly full availability resync (03:15)
|--------------------------------------------------------------------------
| Rewrites Channex availability with enjoy's values, so a push lost to a
| network error does not stay wrong. No-op unless CHANNEX_AVAILABILITY_RESYNC=true.
*/
let channexResyncRunning = false

cron.schedule('15 3 * * *', async () => {
  if (channexResyncRunning) return
  channexResyncRunning = true
  try {
    if (!(await isWebServer())) return
    const { default: ChannexAvailabilityResync, isChannexResyncEnabled } = await import(
      '#services/channex_availability_resync'
    )
    if (!isChannexResyncEnabled()) return
    const results = await ChannexAvailabilityResync.resyncAll()
    logger.info({ results }, '[ChannexResync] nightly availability resync done')
  } catch (err) {
    logger.error({ err }, '[ChannexResync] nightly availability resync failed')
  } finally {
    channexResyncRunning = false
  }
})
