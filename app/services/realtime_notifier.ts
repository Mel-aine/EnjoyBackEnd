import type { ServerResponse } from 'http'
import Notification from '#models/notification'

type Client = {
  res: ServerResponse
  heartbeat?: NodeJS.Timeout
}

/**
 * RealtimeNotifier
 * In-memory SSE broadcaster per user. When a new notification is created,
 * we push an event to connected clients for that user.
 */
class RealtimeNotifier {
  private clients = new Map<number, Set<Client>>()

  subscribe(userId: number, res: ServerResponse) {
    const set = this.clients.get(userId) || new Set<Client>()
    const client: Client = { res }
    // Initial headers and handshake
    res.write(`event: ping\n`)
    res.write(`data: connected\n\n`)
    // Heartbeat to keep the connection alive
    client.heartbeat = setInterval(() => {
      try {
        res.write(`:keepalive ${Date.now()}\n\n`)
      } catch {
        this.unsubscribe(userId, client)
      }
    }, 25000)

    set.add(client)
    this.clients.set(userId, set)
    return client
  }

  unsubscribe(userId: number, client: Client) {
    const set = this.clients.get(userId)
    if (!set) return
    if (client.heartbeat) clearInterval(client.heartbeat)
    try { client.res.end() } catch {}
    set.delete(client)
    if (set.size === 0) this.clients.delete(userId)
  }

  notify(notification: Notification) {
    // Target only STAFF user recipients for SSE (browser clients).
    if (notification.recipientType !== 'STAFF') return
    const set = this.clients.get(notification.recipientId)
    if (!set || set.size === 0) return

    // Reload with relations for richer payload
    const loadFull = async () => {
      try {
        const full = await Notification.query()
          .where('id', notification.id)
          .preload('template')
          .preload('hotel')
          .preload('recipientUser')
          .first()
        return full || notification
      } catch {
        return notification
      }
    }

    loadFull().then((full) => {
      const payload = JSON.stringify({
        id: full.id,
        subject: full.subject,
        content: full.content,
        status: full.status,
        isRead: full.isRead,
        channel: full.channel,
        hotelId: full.hotelId,
        hotel: full.$preloaded?.hotel
          ? { id: full.$preloaded.hotel.id, name: (full.$preloaded.hotel as any).hotelName }
          : null,
        template: full.$preloaded?.template
          ? {
              id: full.$preloaded.template.id,
              code: (full.$preloaded.template as any).code,
              locale: (full.$preloaded.template as any).locale,
              channel: (full.$preloaded.template as any).channel,
            }
          : null,
        recipientUser: full.$preloaded?.recipientUser
          ? {
              id: full.$preloaded.recipientUser.id,
              name: `${(full.$preloaded.recipientUser as any).firstName || ''} ${(full.$preloaded.recipientUser as any).lastName || ''}`.trim(),
              email: (full.$preloaded.recipientUser as any).email,
            }
          : null,
        createdAt: full.createdAt?.toISO?.() || null,
        sentAt: full.sentAt?.toISO?.() || null,
      })
      for (const client of set) {
        try {
          client.res.write(`event: notification\n`)
          client.res.write(`data: ${payload}\n\n`)
        } catch {
          this.unsubscribe(notification.recipientId, client)
        }
      }
    })
  }
}

const notifier = new RealtimeNotifier()
export default notifier
