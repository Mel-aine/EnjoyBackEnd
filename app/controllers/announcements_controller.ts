import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Announcement from '#models/announcement'

export default class AnnouncementsController {
  public async active({ response }: HttpContext) {
    const now = DateTime.now()

    const announcements = await Announcement.query()
      .where('is_active', true)
      .where((q) => q.whereNull('starts_at').orWhere('starts_at', '<=', now.toSQL()!))
      .where((q) => q.whereNull('ends_at').orWhere('ends_at', '>=', now.toSQL()!))
      .orderBy('created_at', 'desc')

    return response.ok(announcements)
  }
}
