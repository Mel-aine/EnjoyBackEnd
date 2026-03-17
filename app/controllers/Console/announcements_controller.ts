import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import Announcement from '#models/announcement'

const createSchema = vine.compile(
  vine.object({
    title: vine.string().trim(),
    content: vine.string().trim(),
    type: vine.enum(['maintenance', 'update', 'info']).optional(),
    isActive: vine.boolean().optional(),
    startsAt: vine.string().trim().optional(),
    endsAt: vine.string().trim().optional(),
  })
)

const updateSchema = vine.compile(
  vine.object({
    title: vine.string().trim().optional(),
    content: vine.string().trim().optional(),
    type: vine.enum(['maintenance', 'update', 'info']).nullable().optional(),
    isActive: vine.boolean().optional(),
    startsAt: vine.string().trim().nullable().optional(),
    endsAt: vine.string().trim().nullable().optional(),
  })
)

export default class AnnouncementsController {
  public async index({ request, response }: HttpContext) {
    const page = request.input('page', 1)
    const limit = request.input('limit', 20)
    const search = request.input('search', '')
    const type = request.input('type')
    const isActive = request.input('isActive')

    const query = Announcement.query()

    if (search) {
      query.where((q) => {
        q.whereILike('title', `%${search}%`).orWhereILike('content', `%${search}%`)
      })
    }

    if (type) {
      query.where('type', type)
    }

    if (isActive !== undefined && isActive !== null && isActive !== '') {
      query.where('is_active', String(isActive) === 'true')
    }

    const result = await query.orderBy('created_at', 'desc').paginate(page, limit)
    return response.ok(result)
  }

  public async show({ params, response }: HttpContext) {
    const announcement = await Announcement.findOrFail(params.id)
    return response.ok(announcement)
  }

  public async store({ request, response }: HttpContext) {
    const payload = await request.validateUsing(createSchema)

    const announcement = await Announcement.create({
      title: payload.title,
      content: payload.content,
      type: payload.type ?? null,
      isActive: payload.isActive ?? true,
      startsAt: payload.startsAt ? DateTime.fromISO(payload.startsAt) : null,
      endsAt: payload.endsAt ? DateTime.fromISO(payload.endsAt) : null,
    })

    return response.created(announcement)
  }

  public async update({ params, request, response }: HttpContext) {
    const payload = await request.validateUsing(updateSchema)
    const announcement = await Announcement.findOrFail(params.id)

    announcement.merge({
      title: payload.title,
      content: payload.content,
      type: payload.type,
      isActive: payload.isActive,
    })

    if (payload.startsAt !== undefined) {
      announcement.startsAt = payload.startsAt ? DateTime.fromISO(payload.startsAt) : null
    }
    if (payload.endsAt !== undefined) {
      announcement.endsAt = payload.endsAt ? DateTime.fromISO(payload.endsAt) : null
    }

    await announcement.save()
    return response.ok(announcement)
  }

  public async destroy({ params, response }: HttpContext) {
    const announcement = await Announcement.findOrFail(params.id)
    await announcement.delete()
    return response.noContent()
  }
}
