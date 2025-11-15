import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import SupportTicket from '#models/support_ticket'
 

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
}