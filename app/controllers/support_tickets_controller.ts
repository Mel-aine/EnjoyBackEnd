import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import SupportTicket from '#models/support_ticket'
import LoggerService from '#services/logger_service'
 

const createTicketValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(3),
    category: vine.enum(['bug', 'suggestion', 'question'] as const),
    module: vine.enum([
      'Réservations',
      'Check-in/out',
      'Facturation',
      'Housekeeping',
      'Moteur de réservation',
      'Rapports',
      'Autre',
    ] as const),
    impact: vine.enum(['tous', 'plusieurs', 'un', 'rapport'] as const),
    severity: vine.enum(['critical', 'high', 'low'] as const),
    status: vine.enum(['open', 'in_progress', 'resolved', 'closed'] as const).optional(),
    description: vine.object({
      full: vine.string().trim().minLength(3),
      steps: vine.array(vine.string().trim()).minLength(1),
      expected: vine.string().trim().minLength(1),
      actual: vine.string().trim().minLength(1),
    }),
    context: vine.object({
      pageUrl: vine.string().trim(),
      userAgent: vine.string().trim().minLength(1),
      userId: vine.number().optional(),
      hotelId: vine.number().optional(),
      hotelName: vine.string().optional(),
      pmsVersion: vine.string().optional(),
      entityId: vine.string().optional(),
      sessionRecordingUrl: vine.string().optional(),
    }),
    callbackPhone: vine.string().optional(),
    attachments: vine.array(vine.string().trim()).optional(),
  })
)

export default class SupportTicketsController {
  public async create({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createTicketValidator)

      const ticket = new SupportTicket()
      ticket.title = payload.title
      ticket.category = payload.category
      ticket.module = payload.module
      ticket.impact = payload.impact
      ticket.severity = payload.severity
      ticket.description = payload.description
      ticket.context = payload.context
      ticket.callbackPhone = payload.callbackPhone || null
      ticket.status = payload.status || 'open'
      ticket.hotelId = payload.context.hotelId || null
      ticket.createdBy = auth?.user?.id || null

      await ticket.save()

      ticket.attachments = payload.attachments || null

      return response.created({
        message: 'Support ticket créé',
        data: ticket,
      })
    } catch (error) {
      if ((error as any).code === 'E_VALIDATION_ERROR') {
        return response.badRequest({
          message: 'Validation échouée',
          errors: (error as any).messages,
        })
      }
      return response.badRequest({
        message: 'Création du ticket échouée',
        error: (error as any).message,
      })
    }
  }

  public async index({ request, response }: HttpContext) {
    try {
      const page = Number(request.input('page', 1))
      const limit = Number(request.input('limit', 10))
      const category = request.input('category')
      const module = request.input('module')
      const impact = request.input('impact')
      const severity = request.input('severity')
      const status = request.input('status')
      const hotelId = request.input('hotelId')
      const search = request.input('search')
      const createdFrom = request.input('created_from')
      const createdTo = request.input('created_to')

      const query = SupportTicket.query()

      if (category) query.where('category', category)
      if (module) query.where('module', module)
      if (impact) query.where('impact', impact)
      if (severity) query.where('severity', severity)
      if (status) query.where('status', status)
      if (hotelId) query.where('hotel_id', Number(hotelId))
      if (search) {
        query.where((builder) => {
          builder.whereILike('title', `%${search}%`).orWhereRaw(`description->>'full' ILIKE ?`, [`%${search}%`])
        })
      }
      if (createdFrom && createdTo) {
        query.whereBetween('created_at', [createdFrom, createdTo])
      } else if (createdFrom) {
        query.where('created_at', '>=', createdFrom)
      } else if (createdTo) {
        query.where('created_at', '<=', createdTo)
      }

      query.orderBy('created_at', 'desc')

      const tickets = await query.paginate(page, limit)
      return response.ok({
        message: 'Support tickets récupérés',
        data: tickets,
      })
    } catch (error) {
      return response.badRequest({
        message: 'Échec de récupération des tickets',
        error: (error as any).message,
      })
    }
  }

  public async show({ params, response }: HttpContext) {
    try {
      const ticket = await SupportTicket.findOrFail(Number(params.id))
      return response.ok({
        message: 'Support ticket',
        data: ticket,
      })
    } catch (error) {
      return response.notFound({
        message: 'Ticket introuvable',
      })
    }
  }

  public async updateStatus({ params, request, response, auth }: HttpContext) {
    try {
      const validator = vine.compile(
        vine.object({ status: vine.enum(['open', 'in_progress', 'resolved', 'closed'] as const) })
      )
      const payload = await request.validateUsing(validator)

      const ticket = await SupportTicket.findOrFail(Number(params.id))
      const prevStatus = ticket.status
      ticket.status = payload.status
      await ticket.save()

      try {
        await LoggerService.logActivity({
          userId: auth?.user?.id,
          action: 'UPDATE',
          resourceType: 'SupportTicket',
          resourceId: ticket.id,
          hotelId: ticket.hotelId ?? undefined,
          description: 'Status update',
          details: { previousStatus: prevStatus, newStatus: ticket.status },
        })
      } catch {}

      return response.ok({
        message: 'Statut mis à jour',
        data: { id: ticket.id, status: ticket.status },
      })
    } catch (error) {
      if ((error as any).code === 'E_VALIDATION_ERROR') {
        return response.badRequest({ message: 'Validation échouée', errors: (error as any).messages })
      }
      return response.badRequest({ message: 'Mise à jour échouée', error: (error as any).message })
    }
  }
}