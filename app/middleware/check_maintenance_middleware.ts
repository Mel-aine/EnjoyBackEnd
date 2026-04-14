import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { DateTime } from 'luxon'
import Announcement from '#models/announcement'

let cacheCheckedAt: DateTime | null = null
let cacheIsMaintenance: boolean = false
let cacheAnnouncement: any = null

export default class CheckMaintenanceMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const url = (ctx.request as any).url?.() as string | undefined
    const path = url ? url.split('?')[0] : ''

    if (path.startsWith('/api/console') || path === '/api/announcements/active') {
      return next()
    }

    const now = DateTime.now()

    if (cacheCheckedAt && now.diff(cacheCheckedAt, 'seconds').seconds < 10) {
      if (cacheIsMaintenance) {
        return ctx.response.status(503).send({
          message: 'Service Unavailable',
          code: 'MAINTENANCE',
          data: cacheAnnouncement,
        })
      }
      return next()
    }

    cacheCheckedAt = now

    const maintenance = await Announcement.query()
      .where('is_active', true)
      .where('type', 'maintenance')
      .where((q) => q.whereNull('starts_at').orWhere('starts_at', '<=', now.toSQL()!))
      .where((q) => q.whereNull('ends_at').orWhere('ends_at', '>=', now.toSQL()!))
      .orderBy('created_at', 'desc')
      .first()

    cacheIsMaintenance = Boolean(maintenance)
    cacheAnnouncement = maintenance
      ? {
          id: maintenance.id,
          title: maintenance.title,
          content: maintenance.content,
          type: maintenance.type,
          startsAt: maintenance.startsAt?.toISO(),
          endsAt: maintenance.endsAt?.toISO(),
        }
      : null

    if (maintenance) {
      return ctx.response.status(503).send({
        message: 'Service Unavailable',
        code: 'MAINTENANCE',
        data: cacheAnnouncement,
      })
    }

    return next()
  }
}
