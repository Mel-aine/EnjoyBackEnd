import type { HttpContext } from '@adonisjs/core/http'
import Notification from '#models/notification'
import NotificationService from '#services/notification_service'

export default class NotificationsController {
  public async send(ctx: HttpContext) {
    const { request, response, auth } = ctx
    const body = request.only(['templateCode', 'recipientType', 'recipientId', 'recipients', 'variables', 'channelOverride', 'relatedEntityType', 'relatedEntityId'])

    try {
      if (Array.isArray(body.recipients) && body.recipients.length > 0) {
        const notifications = await NotificationService.sendToManyWithTemplate({
          templateCode: body.templateCode,
          recipients: body.recipients.map((r: any) => ({ recipientType: r.recipientType, recipientId: Number(r.recipientId) })),
          variables: body.variables || {},
          channelOverride: body.channelOverride,
          relatedEntityType: body.relatedEntityType,
          relatedEntityId: body.relatedEntityId ? Number(body.relatedEntityId) : undefined,
          actorId: auth?.user?.id,
          hotelId: auth?.user?.hotelId,
        })
        const ids = notifications.map((n) => n.id)
        const withRelations = await Notification.query()
          .whereIn('id', ids)
          .preload('template')
          .preload('hotel')
          .preload('recipientUser')
          .preload('recipientGuest')
        return response.created({ message: 'Notifications sent', notifications: withRelations })
      } else {
        const notification = await NotificationService.sendWithTemplate({
          templateCode: body.templateCode,
          recipientType: body.recipientType,
          recipientId: Number(body.recipientId),
          variables: body.variables || {},
          channelOverride: body.channelOverride,
          relatedEntityType: body.relatedEntityType,
          relatedEntityId: body.relatedEntityId ? Number(body.relatedEntityId) : undefined,
          actorId: auth?.user?.id,
          hotelId: auth?.user?.hotelId,
        })
        const withRelations = await Notification.query()
          .where('id', notification.id)
          .preload('template')
          .preload('hotel')
          .preload('recipientUser')
          .preload('recipientGuest')
          .first()
        return response.created({ message: 'Notification sent', notification: withRelations })
      }
    } catch (e) {
      return response.status(400).json({ message: (e as Error).message })
    }
  }

  public async listForMe(ctx: HttpContext) {
    const { response, auth } = ctx
    const userId = auth.user?.id
    const hotelId = auth.user?.hotelId
    if (!userId) return response.unauthorized({ message: 'Not authenticated' })
    const items = await Notification.query()
      .where('recipient_type', 'STAFF')
      .andWhere('recipient_id', userId)
      .andWhere('hotel_id', hotelId as any)
      .orderBy('created_at', 'desc')
      .limit(100)
      .preload('template')
      .preload('hotel')
      .preload('recipientUser')
    return response.ok({ notifications: items })
  }

  public async markRead(ctx: HttpContext) {
    const { request, response, auth } = ctx
    const id = Number(request.param('id'))
    const notif = await Notification.find(id)
    if (!notif) return response.notFound({ message: 'Notification not found' })
    // Optional: ensure only recipient can mark read
    if (notif.recipientType === 'STAFF' && notif.recipientId !== auth.user?.id) {
      return response.forbidden({ message: 'Forbidden' })
    }
    if (auth.user?.hotelId && notif.hotelId !== auth.user.hotelId) {
      return response.forbidden({ message: 'Forbidden' })
    }
    await notif.merge({ isRead: true }).save()
    return response.ok({ message: 'Marked as read' })
  }
}
