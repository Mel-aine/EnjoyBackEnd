import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import vine from '@vinejs/vine'
import SupportTicket from '#models/support_ticket'
import LoggerService from '#services/logger_service'


import SupabaseService from '#services/supabase_service'


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
    assignedAt: vine
    .string()
    .optional()
    .transform((value) => {
      if (!value) return undefined
      return DateTime.fromISO(value)
    }),
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
    // attachments: vine.array(vine.string().trim()).optional(),
  })
)

const updateTicketValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(3).optional(),
    category: vine.enum(['bug', 'suggestion', 'question'] as const).optional(),
    module: vine.enum([
      'Réservations',
      'Check-in/out',
      'Facturation',
      'Housekeeping',
      'Moteur de réservation',
      'Rapports',
      'Autre',
    ] as const).optional(),
    impact: vine.enum(['tous', 'plusieurs', 'un', 'rapport'] as const).optional(),
    severity: vine.enum(['critical', 'high', 'low'] as const).optional(),
    status: vine.enum(['open', 'in_progress', 'resolved', 'closed'] as const).optional(),
    assignedAt: vine
    .string()
    .optional()
    .transform((value) => {
      if (!value) return undefined
      return DateTime.fromISO(value)
    }),
    description: vine.object({
      full: vine.string().trim().minLength(3),
      steps: vine.array(vine.string().trim()).minLength(1),
      expected: vine.string().trim().minLength(1),
      actual: vine.string().trim().minLength(1),
    }).optional(),
    callbackPhone: vine.string().optional(),
    attachments: vine.array(vine.string().trim()).optional(),
  })
)

export default class SupportTicketsController {
 private supabaseService: SupabaseService

  constructor() {
    this.supabaseService = new SupabaseService()
  }

  
  /**
   * Génère un code de ticket unique
   * Format: TICKET-YYYYMMDD-XXX-TITLEINITIALS
   * Exemple: TICKET-20231215-001-RES
   */
  private generateTicketCode(title: string): string {
    const now = new Date()
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '') // YYYYMMDD
    
    // Prend les 3 premières lettres du titre (nettoyées)
    const titleInitials = title
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 3)
      .padEnd(3, 'X') // Si moins de 3 lettres, complète avec X
    
    // Génère un numéro séquentiel basé sur le timestamp
    const sequential = String(now.getTime()).slice(-3)
    
    return `TICKET-${sequential}-${titleInitials}`
  }

  public async create({ request, response, auth }: HttpContext) {
  try {

    const attachmentFile = request.file('attachment', {
      size: '5mb',
      extnames: ['jpg', 'jpeg', 'png', 'webp', 'pdf']
    })


    // Parser les champs JSON du FormData
    const rawBody = request.all()

    if (typeof rawBody.description === 'string') {
      rawBody.description = JSON.parse(rawBody.description)
    }

    if (typeof rawBody.context === 'string') {
      rawBody.context = JSON.parse(rawBody.context)
    }

    request.updateBody(rawBody)

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
    ticket.hotelId = payload.context?.hotelId ?? null
    ticket.createdBy = auth?.user?.id ?? null
    ticket.assignedAt = payload.assignedAt as DateTime<boolean>


    // Gérer assignedAt avec calcul automatique basé sur la sévérité
    const now = DateTime.now()
    
    if (payload.assignedAt && payload.assignedAt.isValid) {
      // Si une date est fournie manuellement, l'utiliser
      ticket.assignedAt = payload.assignedAt
    } else {
      // Calcul automatique basé sur la sévérité
      switch (payload.severity) {
        case 'critical':
          // Critical: +3 heures
          ticket.assignedAt = now.plus({ hours: 3 })
          break
        case 'high':
          // High: +6 heures
          ticket.assignedAt = now.plus({ hours: 6 })
          break
        case 'low':
        default:
          // Low: +24 heures (le lendemain)
          ticket.assignedAt = now.plus({ hours: 24 })
          break
      }
    }

    let attachmentUrl: string | null = null
    if (attachmentFile) {
      try {
        const result = await this.supabaseService.uploadFile(
          attachmentFile,
          'tickets',
          'attachments'
        )
        attachmentUrl = result.url

      } catch (uploadError: any) {
        console.error('Failed to upload attachment:', uploadError.message)
        console.error('Upload error details:', uploadError)
      }
    }

    ticket.attachments = attachmentUrl ? [attachmentUrl] : null

      
      // Génération du code de ticket
      ticket.ticketCode = this.generateTicketCode(payload.title)



      await ticket.save()



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
      const ticketCode = request.input('ticket_code')

      const query = SupportTicket.query()

      if (category) query.where('category', category)
      if (module) query.where('module', module)
      if (impact) query.where('impact', impact)
      if (severity) query.where('severity', severity)
      if (status) query.where('status', status)
      if (hotelId) query.where('hotel_id', Number(hotelId))
      if (ticketCode) query.where('ticket_code', 'ILIKE', `%${ticketCode}%`)
      if (search) {
        query.where((builder) => {
          builder
            .whereILike('title', `%${search}%`)
            .orWhereILike('ticket_code', `%${search}%`)
            .orWhereRaw(`description->>'full' ILIKE ?`, [`%${search}%`])
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

  /**
   * Statistiques du tableau de bord
   */
  public async dashboardStats({ request, response }: HttpContext) {
    try {
      const hotelId = request.input('hotelId')

      const now = DateTime.now()
      const startToday = now.startOf('day').toJSDate()
      const endToday = now.endOf('day').toJSDate()
      const startYesterday = now.minus({ days: 1 }).startOf('day').toJSDate()
      const endYesterday = now.minus({ days: 1 }).endOf('day').toJSDate()

      const baseOpenQuery = SupportTicket.query().whereIn('status', ['in_progress'])
      if (hotelId) baseOpenQuery.where('hotel_id', Number(hotelId))
      const openCountResult = await baseOpenQuery.count('* as total')
      const openCount = Number((openCountResult[0] as any).$extras.total || 0)

      const openCreatedToday = await SupportTicket.query()
        .whereIn('status', ['open', 'in_progress'])
        .if(hotelId, (q) => q.where('hotel_id', Number(hotelId)))
        .whereBetween('created_at', [startToday, endToday])
        .count('* as total')
      const openCreatedYesterday = await SupportTicket.query()
        .whereIn('status', ['open', 'in_progress'])
        .if(hotelId, (q) => q.where('hotel_id', Number(hotelId)))
        .whereBetween('created_at', [startYesterday, endYesterday])
        .count('* as total')
      const openToday = Number((openCreatedToday[0] as any).$extras.total || 0)
      const openYesterday = Number((openCreatedYesterday[0] as any).$extras.total || 0)
      const openTrendPct = ((openToday - openYesterday) / Math.max(openYesterday, 1)) * 100

      const resolvedTodayTickets = await SupportTicket.query()
        .whereIn('status', ['resolved', 'closed'])
        .if(hotelId, (q) => q.where('hotel_id', Number(hotelId)))
        .whereBetween('updated_at', [startToday, endToday])
      const resolvedYesterdayTickets = await SupportTicket.query()
        .whereIn('status', ['resolved', 'closed'])
        .if(hotelId, (q) => q.where('hotel_id', Number(hotelId)))
        .whereBetween('updated_at', [startYesterday, endYesterday])

      const avgMinutes = (tickets: SupportTicket[]) => {
        if (!tickets.length) return 0
        const totalMs = tickets.reduce((sum, t) => {
          const created = (t as any).createdAt?.toJSDate?.() ?? new Date((t as any).created_at)
          const updated = (t as any).updatedAt?.toJSDate?.() ?? new Date((t as any).updated_at)
          return sum + Math.max(updated.getTime() - created.getTime(), 0)
        }, 0)
        return Math.round(totalMs / tickets.length / 60000)
      }

      const avgResolutionTimeMinutes = avgMinutes(resolvedTodayTickets)
      const avgResolutionYesterdayMinutes = avgMinutes(resolvedYesterdayTickets)
      const avgResolutionTrendPct = ((avgResolutionTimeMinutes - avgResolutionYesterdayMinutes) / Math.max(avgResolutionYesterdayMinutes, 1)) * 100

      const slaHoursBySeverity: Record<'critical' | 'high' | 'low', number> = {
        critical: 12,
        high: 24,
        low: 72,
      }

      const openTicketsAll = await SupportTicket.query()
        .whereIn('status', ['open', 'in_progress'])
        .if(hotelId, (q) => q.where('hotel_id', Number(hotelId)))
      const slaOverdueCount = openTicketsAll.filter((t) => {
        const created = (t as any).createdAt?.toJSDate?.() ?? new Date((t as any).created_at)
        const ageHours = (Date.now() - created.getTime()) / 3600000
        const sev = (t as any).severity as 'critical' | 'high' | 'low'
        const threshold = slaHoursBySeverity[sev] ?? 48
        return ageHours > threshold
      }).length

      const openTodayTickets = openTicketsAll.filter((t) => {
        const created = (t as any).createdAt?.toJSDate?.() ?? new Date((t as any).created_at)
        return created >= startToday && created <= endToday
      })
      const openYesterdayTickets = openTicketsAll.filter((t) => {
        const created = (t as any).createdAt?.toJSDate?.() ?? new Date((t as any).created_at)
        return created >= startYesterday && created <= endYesterday
      })
      const slaOverdueToday = openTodayTickets.filter((t) => {
        const created = (t as any).createdAt?.toJSDate?.() ?? new Date((t as any).created_at)
        const ageHours = (Date.now() - created.getTime()) / 3600000
        const sev = (t as any).severity as 'critical' | 'high' | 'low'
        const threshold = slaHoursBySeverity[sev] ?? 48
        return ageHours > threshold
      }).length
      const slaOverdueYesterday = openYesterdayTickets.filter((t) => {
        const created = (t as any).createdAt?.toJSDate?.() ?? new Date((t as any).created_at)
        const ageHours = (now.minus({ days: 1 }).endOf('day').toJSDate().getTime() - created.getTime()) / 3600000
        const sev = (t as any).severity as 'critical' | 'high' | 'low'
        const threshold = slaHoursBySeverity[sev] ?? 48
        return ageHours > threshold
      }).length
      const slaOverdueTrendPct = ((slaOverdueToday - slaOverdueYesterday) / Math.max(slaOverdueYesterday, 1)) * 100

      return response.ok({
        openCount,
        openTrendPct,
        avgResolutionTimeMinutes,
        avgResolutionTrendPct,
        slaOverdueCount,
        slaOverdueTrendPct,
      })
    } catch (error) {
      return response.badRequest({ message: 'Failed to compute stats', error: (error as any).message })
    }
  }

  /** Mes tickets ouverts */
  public async myOpen({ request, response, auth }: HttpContext) {
    try {
      const page = Number(request.input('page', 1))
      const perPage = Number(request.input('perPage', 10))
      const hotelId = request.input('hotelId')
      const query = SupportTicket.query()
        .whereIn('status', ['open'])
        .where('created_by', auth.user?.id || 0)
        .if(hotelId, (q) => q.where('hotel_id', Number(hotelId)))
        .orderBy('created_at', 'desc')
      const tickets = await query.paginate(page, perPage)
      return response.ok(tickets)
    } catch (error) {
      return response.badRequest({ message: 'Failed to load my open tickets', error: (error as any).message })
    }
  }

  /** En attente de ma réponse (approximation: tickets ouverts créés par moi) */
  public async pendingResponse({ request, response, auth }: HttpContext) {
    try {
      const page = Number(request.input('page', 1))
      const perPage = Number(request.input('perPage', 10))
      const hotelId = request.input('hotelId')
      const tickets = await SupportTicket.query()
        .whereIn('status',['in_progress'])
        .where('created_by', auth.user?.id || 0)
        .if(hotelId, (q) => q.where('hotel_id', Number(hotelId)))
        .orderBy('created_at', 'desc')
        .paginate(page, perPage)
      return response.ok(tickets)
    } catch (error) {
      return response.badRequest({ message: 'Failed to load pending response tickets', error: (error as any).message })
    }
  }

  /** Tickets urgents (severity: critical) */
  public async urgent({ request, response }: HttpContext) {
    try {
      const page = Number(request.input('page', 1))
      const perPage = Number(request.input('perPage', 10))
      const hotelId = request.input('hotelId')
      const tickets = await SupportTicket.query()
        .where('severity', 'critical')
        .whereIn('status', ['open', 'in_progress'])
        .if(hotelId, (q) => q.where('hotel_id', Number(hotelId)))
        .orderBy('created_at', 'desc')
        .paginate(page, perPage)
      return response.ok(tickets)
    } catch (error) {
      return response.badRequest({ message: 'Failed to load urgent tickets', error: (error as any).message })
    }
  }

  /** Répartition par statut */
  public async distribution({ request, response }: HttpContext) {
    try {
      const hotelId = request.input('hotelId')
      const statuses: Array<'open' | 'in_progress' | 'resolved' | 'closed'> = ['open', 'in_progress', 'resolved', 'closed']
      const counts: Record<string, number> = {}
      let total = 0
      for (const s of statuses) {
        const res = await SupportTicket.query()
          .where('status', s)
          .if(hotelId, (q) => q.where('hotel_id', Number(hotelId)))
          .count('* as total')
        const v = Number((res[0] as any).$extras.total || 0)
        counts[s] = v
        total += v
      }
      const breakdown = statuses.map((s) => ({ status: s, count: counts[s] || 0, pct: total ? Math.round(((counts[s] || 0) / total) * 100) : 0 }))
      return response.ok({ total, breakdown })
    } catch (error) {
      return response.badRequest({ message: 'Failed to compute distribution', error: (error as any).message })
    }
  }

  /** Volume hebdomadaire */
  public async weeklyVolume({ request, response }: HttpContext) {
    try {
      const hotelId = request.input('hotelId')
      const from = request.input('from')
      const to = request.input('to')
      const end = to ? DateTime.fromISO(to).endOf('day') : DateTime.now().endOf('day')
      const start = from ? DateTime.fromISO(from).startOf('day') : end.minus({ days: 6 }).startOf('day')

      const tickets = await SupportTicket.query()
        .if(hotelId, (q) => q.where('hotel_id', Number(hotelId)))
        .whereBetween('created_at', [start.toJSDate(), end.toJSDate()])
        .orderBy('created_at', 'asc')

      const days: Record<string, number> = {}
      for (let i = 0; i < 7; i++) {
        const day = start.plus({ days: i }).toISODate()!
        days[day] = 0
      }
      tickets.forEach((t) => {
        const d = ((t as any).createdAt?.toISODate?.() ?? DateTime.fromJSDate(new Date((t as any).created_at)).toISODate()) as string
        if (d in days) days[d]++
      })
      const result = Object.entries(days).map(([day, count]) => ({ day, count }))
      return response.ok(result)
    } catch (error) {
      return response.badRequest({ message: 'Failed to compute weekly volume', error: (error as any).message })
    }
  }

  /** Recherche globale */
  public async search({ request, response }: HttpContext) {
    try {
      const page = Number(request.input('page', 1))
      const perPage = Number(request.input('perPage', 10))
      const q = request.input('q')
      const status = request.input('status')
      const severity = request.input('severity')
      const hotelId = request.input('hotelId')

      const query = SupportTicket.query()
      if (status) query.where('status', status)
      if (severity) query.where('severity', severity)
      if (hotelId) query.where('hotel_id', Number(hotelId))
      if (q) {
        query.where((builder) => {
          builder
            .whereILike('title', `%${q}%`)
            .orWhereILike('ticket_code', `%${q}%`)
        })
      }
      const result = await query.orderBy('created_at', 'desc').paginate(page, perPage)
      return response.ok(result)
    } catch (error) {
      return response.badRequest({ message: 'Failed to search tickets', error: (error as any).message })
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

  public async update({ params, request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(updateTicketValidator)

      const ticket = await SupportTicket.findOrFail(Number(params.id))

      const previousState = {
        title: ticket.title,
        category: ticket.category,
        module: ticket.module,
        impact: ticket.impact,
        severity: ticket.severity,
        status: ticket.status,
        assignedAt: ticket.assignedAt ,
      }

      if (payload.title !== undefined) ticket.title = payload.title
      if (payload.category !== undefined) ticket.category = payload.category
      if (payload.module !== undefined) ticket.module = payload.module
      if (payload.impact !== undefined) ticket.impact = payload.impact
      if (payload.severity !== undefined) ticket.severity = payload.severity
      if (payload.status !== undefined) ticket.status = payload.status
      if (payload.assignedAt !== undefined) ticket.assignedAt = payload.assignedAt
      if (payload.description !== undefined) ticket.description = payload.description
      if (payload.callbackPhone !== undefined) ticket.callbackPhone = payload.callbackPhone
      if (payload.attachments !== undefined) ticket.attachments = payload.attachments

      await ticket.save()


      try {
        await LoggerService.logActivity({
          userId: auth?.user?.id,
          action: 'UPDATE',
          resourceType: 'SupportTicket',
          resourceId: ticket.id,
          hotelId: ticket.hotelId ?? undefined,
          description: 'Ticket updated',
          details: { previousState, newState: payload },
        })
      } catch {}

      return response.ok({
        message: 'Ticket mis à jour',
        data: ticket,
      })
    } catch (error) {
      if ((error as any).code === 'E_VALIDATION_ERROR') {
        return response.badRequest({ message: 'Validation échouée', errors: (error as any).messages })
      }
      return response.badRequest({ message: 'Mise à jour échouée', error: (error as any).message })
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