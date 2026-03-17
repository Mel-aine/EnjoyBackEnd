import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import RequestDemoService from '#services/request_demo_service'
import LoggerService from '#services/logger_service'

const createSchema = vine.compile(
  vine.object({
    contactName: vine.string().trim(),
    companyName: vine.string().trim(),
    propertyType: vine.string().trim().optional(),
    numberOfRooms: vine.number(),
    phoneNumber: vine.string().trim(),
    country: vine.string().trim(),
    email: vine.string().trim().email(),
    preferredLanguage: vine.string().trim().optional(),
    leadSource: vine.string().trim().optional(),
    notesMessage: vine.string().trim().optional(),
    competition: vine.string().trim().optional(),
    acceptCondition: vine.boolean(),
  })
)

const updateSchema = vine.compile(
  vine.object({
    contactName: vine.string().trim().optional(),
    companyName: vine.string().trim().optional(),
    propertyType: vine.string().trim().nullable().optional(),
    numberOfRooms: vine.number().nullable().optional(),
    phoneNumber: vine.string().trim().nullable().optional(),
    country: vine.string().trim().nullable().optional(),
    email: vine.string().trim().email().optional(),
    preferredLanguage: vine.string().trim().nullable().optional(),
    leadSource: vine.string().trim().nullable().optional(),
    notesMessage: vine.string().trim().nullable().optional(),
    competition: vine.string().trim().nullable().optional(),
    acceptCondition: vine.boolean().optional(),
    emailSend: vine.boolean().optional(),
    status: vine
      .enum([
        'New',
        'Qualified',
        'Demo Scheduled',
        'Demo Completed',
        'Trial',
        'Negotiation',
        'Converted',
        'Lost',
        'Junk',
      ])
      .optional(),
    ownerId: vine.number().nullable().optional(),
    followUpDate: vine.string().trim().nullable().optional(),
  })
)

export default class RequestDemosController {
  private service: RequestDemoService

  constructor() {
    this.service = new RequestDemoService()
  }

  public async index({ request, response }: HttpContext) {
    const page = request.input('page', 1)
    const limit = request.input('limit', 20)
    const search = request.input('search', '')
    const status = request.input('status')
    const ownerId = request.input('ownerId')
    const all     = request.input('all')

    const leads = await this.service.list({
      page,
      limit,
      search: search || undefined,
      status: status || undefined,
      ownerId: ownerId !== undefined && ownerId !== null ? Number(ownerId) : undefined,
      all:     all === 'true' || all === true,
    })

    return response.ok(leads)
  }

  public async show({ params, response }: HttpContext) {
    const lead = await this.service.get(Number(params.id))
    return response.ok(lead)
  }

  public async store(ctx: HttpContext) {
    const { request, response, auth } = ctx
    const payload = await request.validateUsing(createSchema)

    try {
      const lead = await this.service.create({
        contactName: payload.contactName,
        companyName: payload.companyName,
        propertyType: payload.propertyType,
        numberOfRooms: payload.numberOfRooms,
        phoneNumber: payload.phoneNumber,
        country: payload.country,
        email: payload.email,
        preferredLanguage: payload.preferredLanguage,
        leadSource: payload.leadSource,
        notesMessage: payload.notesMessage,
        competition: payload.competition,
        acceptCondition: payload.acceptCondition,
      })

      await LoggerService.logActivity({
        userId: auth.user?.id,
        action: 'request_demo.create',
        resourceType: 'RequestDemo',
        resourceId: lead.id,
        description: 'Request demo created',
        details: { status: lead.status, emailSend: lead.emailSend },
        ctx,
      })

      return response.created(lead)
    } catch (error) {
      const statusCode = (error as any)?.statusCode || 500
      return response.status(statusCode).send({ message: (error as any)?.message || 'Failed to create demo request' })
    }
  }

  public async update(ctx: HttpContext) {
    const { params, request, response, auth } = ctx
    const payload = await request.validateUsing(updateSchema)

    const before = await this.service.get(Number(params.id))
    const lead = await this.service.update(Number(params.id), payload)

    const changes = LoggerService.extractChanges(before.serialize() as any, lead.serialize() as any)
    await LoggerService.logActivity({
      userId: auth.user?.id,
      action: 'request_demo.update',
      resourceType: 'RequestDemo',
      resourceId: lead.id,
      description: 'Request demo updated',
      details: changes,
      ctx,
    })

    return response.ok(lead)
  }

  public async destroy(ctx: HttpContext) {
    const { params, response, auth } = ctx
    const lead = await this.service.get(Number(params.id))
    await this.service.delete(Number(params.id))

    await LoggerService.logActivity({
      userId: auth.user?.id,
      action: 'request_demo.delete',
      resourceType: 'RequestDemo',
      resourceId: lead.id,
      description: 'Request demo deleted',
      details: { status: lead.status, email: lead.email },
      ctx,
    })

    return response.noContent()
  }

  public async assign(ctx: HttpContext) {
    const { params, request, response, auth } = ctx
    const schema = vine.compile(
      vine.object({
        ownerId: vine.number(),
      })
    )

    const payload = await request.validateUsing(schema)
    const before = await this.service.get(Number(params.id))
    const lead = await this.service.assign(Number(params.id), payload.ownerId)

    await LoggerService.logActivity({
      userId: auth.user?.id,
      action: 'request_demo.assign',
      resourceType: 'RequestDemo',
      resourceId: lead.id,
      description: 'Request demo assigned',
      details: { ownerId: { old: before.ownerId, new: lead.ownerId } },
      ctx,
    })

    return response.ok(lead)
  }

  public async resendEmail(ctx: HttpContext) {
    const { params, response, auth } = ctx
    const lead = await this.service.resendConfirmationEmail(Number(params.id))

    await LoggerService.logActivity({
      userId: auth.user?.id,
      action: 'request_demo.resend_email',
      resourceType: 'RequestDemo',
      resourceId: lead.id,
      description: 'Request demo confirmation email resent',
      details: { emailSend: lead.emailSend },
      ctx,
    })

    return response.ok(lead)
  }

  public async webhookDemoConverted(ctx: HttpContext) {
    const { params, request, response, auth } = ctx
    const schema = vine.compile(
      vine.object({
        id: vine.number().optional(),
      })
    )
    const payload = await request.validateUsing(schema)

    const id = Number(params?.id ?? payload.id)
    const before = await this.service.get(id)
    const lead = await this.service.update(id, { status: 'Converted' })

    await LoggerService.logActivity({
      userId: auth.user?.id,
      action: 'request_demo.converted',
      resourceType: 'RequestDemo',
      resourceId: lead.id,
      description: 'Request demo converted',
      details: { status: { old: before.status, new: lead.status } },
      ctx,
    })

    return response.ok({ success: true, data: lead })
  }
}
