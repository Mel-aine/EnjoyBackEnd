import Notification from '#models/notification'
import NotificationTemplate from '#models/notification_template'
import User from '#models/user'
import Guest from '#models/guest'
import MailService from '#services/mail_service'
import LoggerService from '#services/logger_service'
import { DateTime } from 'luxon'
import RealtimeNotifier from '#services/realtime_notifier'

type RecipientType = 'GUEST' | 'STAFF' | 'HOUSEKEEPING' | 'MAINTENANCE'
type Channel = 'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP'

export default class NotificationService {
  /**
   * Render template subject/content with provided variables.
   * Supports {{var}} and [Var] tokens.
   */
  private static render(template: string, vars: Record<string, string | number>) {
    let out = template
    Object.entries(vars).forEach(([key, val]) => {
      const value = String(val)
      const patterns = [new RegExp(`\\{\\{${key}\\}\\}`, 'gi'), new RegExp(`\\[${key}\\]`, 'gi')]
      patterns.forEach((p) => {
        out = out.replace(p, value)
      })
    })
    return out
  }

  /**
   * Send a notification using a saved template code.
   */
  static async sendWithTemplate(options: {
    templateCode: string
    recipientType: RecipientType
    recipientId: number
    variables: Record<string, string | number>
    channelOverride?: Channel
    relatedEntityType?: string
    relatedEntityId?: number
    actorId?: number
    hotelId?: number
  }) {
    const { templateCode, recipientType, recipientId, variables, channelOverride, relatedEntityType, relatedEntityId, actorId, hotelId } = options

    const template = await NotificationTemplate.query().where('code', templateCode).andWhere('is_active', true).first()
    if (!template) {
      throw new Error(`Notification template not found or inactive: ${templateCode}`)
    }

    // Determine recipient address/locale for EMAIL
    let recipientEmail: string | null = null
    let locale: string | null = null
    if (recipientType === 'STAFF') {
      const user = await User.find(recipientId)
      recipientEmail = user?.email || null
      locale = user?.preferredLanguage || user?.language || null
    } else if (recipientType === 'GUEST') {
      const guest = await Guest.find(recipientId)
      recipientEmail = guest?.email || guest?.emailSecondary || null
      locale = guest?.language || null
    }

    const subject = this.render(template.subjectTemplate, variables)
    const content = this.render(template.contentTemplate, variables)

    const channel: Channel = channelOverride || template.channel

    const notification = await Notification.create({
      templateId: template.id,
      recipientType,
      recipientId,
      relatedEntityType: relatedEntityType || null,
      relatedEntityId: relatedEntityId || null,
      channel,
      subject,
      content,
      status: 'PENDING',
      isRead: false,
      hotelId: hotelId || null,
      createdBy: actorId || null,
    })

    try {
      if (channel === 'EMAIL' && recipientEmail) {
        await MailService.send({ to: recipientEmail, subject, html: `<p>${content.replace(/\n/g, '<br/>')}</p>`, text: content })
      }
      // TODO: Integrate SMS/PUSH providers when available

      await notification.merge({ status: 'SENT', sentAt: DateTime.now() }).save()
      // Broadcast realtime to connected clients
      RealtimeNotifier.notify(notification)
      if (actorId) {
        await LoggerService.log({
          actorId,
          action: 'NOTIFICATION_SENT',
          entityType: 'Notification',
          entityId: notification.id.toString(),
          description: `Notification sent via ${channel} to ${recipientType}#${recipientId}`,
        })
      }
    } catch (e) {
      await notification.merge({ status: 'FAILED' }).save()
      if (actorId) {
        await LoggerService.log({
          actorId,
          action: 'NOTIFICATION_FAILED',
          entityType: 'Notification',
          entityId: notification.id.toString(),
          description: `Notification failed via ${channel}: ${(e as Error).message}`,
        })
      }
      throw e
    }

    return notification
  }

  /**
   * Send to multiple recipients with same template and variable set.
   */
  static async sendToManyWithTemplate(options: {
    templateCode: string
    recipients: Array<{ recipientType: RecipientType; recipientId: number }>
    variables: Record<string, string | number>
    channelOverride?: Channel
    relatedEntityType?: string
    relatedEntityId?: number
    actorId?: number
    hotelId?: number
  }) {
    const results: Notification[] = []
    for (const r of options.recipients) {
      const n = await this.sendWithTemplate({
        templateCode: options.templateCode,
        recipientType: r.recipientType,
        recipientId: r.recipientId,
        variables: options.variables,
        channelOverride: options.channelOverride,
        relatedEntityType: options.relatedEntityType,
        relatedEntityId: options.relatedEntityId,
        actorId: options.actorId,
        hotelId: options.hotelId,
      })
      results.push(n)
    }
    return results
  }

  /**
   * Construit automatiquement les variables de fusion pour un déclencheur connu.
   * Cette méthode peut être enrichie selon les scénarios du document Notification.md.
   */
  static async buildVariables(trigger: string, context: {
    hotelId?: number
    reservationId?: number
    roomId?: number
    guestId?: number
    userId?: number
    extra?: Record<string, string | number>
  }) {
    const vars: Record<string, string | number> = {}
    // Valeurs générales
    if (context.extra) Object.assign(vars, context.extra)
    try {
      if (context.hotelId) {
        const Hotel = (await import('#models/hotel')).default
        const h = await Hotel.find(context.hotelId)
        if (h) {
          vars['HotelName'] = h.name || ''
          vars['HotelCity'] = h.city || ''
        }
      }
    } catch {}
    try {
      if (context.roomId) {
        const Room = (await import('#models/room')).default
        const room = await Room.find(context.roomId)
        if (room) {
          vars['RoomNumber'] = room.roomNumber || ''
          vars['RoomFloor'] = room.floor || ''
        }
      }
    } catch {}
    try {
      if (context.guestId) {
        const Guest = (await import('#models/guest')).default
        const g = await Guest.find(context.guestId)
        if (g) {
          vars['GuestName'] = `${g.firstName || ''} ${g.lastName || ''}`.trim()
          vars['GuestEmail'] = g.email || ''
        }
      }
    } catch {}
    try {
      if (context.userId) {
        const User = (await import('#models/user')).default
        const u = await User.find(context.userId)
        if (u) {
          vars['UserName'] = `${u.firstName || ''} ${u.lastName || ''}`.trim()
          vars['UserEmail'] = u.email || ''
        }
      }
    } catch {}
    try {
      if (context.reservationId) {
        const Reservation = (await import('#models/reservation')).default
        const r = await Reservation.find(context.reservationId)
        if (r) {
          vars['ReservationNumber'] = r.reservationNumber || ''
          vars['ArrivalDate'] = (r.arrivedDate as any)?.toISO?.() || ''
          vars['DepartureDate'] = (r.departDate as any)?.toISO?.() || ''
          vars['Status'] = r.status || ''
        }
      }
    } catch {}
    // Normalisation clé → permet l’usage {{Var}} et [Var]
    return vars
  }
}
