import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import RequestDemoService from '#services/request_demo_service'

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

    const leads = await this.service.list({
      page,
      limit,
      search: search || undefined,
      status: status || undefined,
      ownerId: ownerId !== undefined && ownerId !== null ? Number(ownerId) : undefined,
    })

    return response.ok(leads)
  }

  public async show({ params, response }: HttpContext) {
    const lead = await this.service.get(Number(params.id))
    return response.ok(lead)
  }

  public async store({ request, response }: HttpContext) {
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

      return response.created(lead)
    } catch (error) {
      const statusCode = (error as any)?.statusCode || 500
      return response.status(statusCode).send({ message: (error as any)?.message || 'Failed to create demo request' })
    }
  }

  public async update({ params, request, response }: HttpContext) {
    const payload = await request.validateUsing(updateSchema)

    const lead = await this.service.update(Number(params.id), payload)
    return response.ok(lead)
  }

  public async destroy({ params, response }: HttpContext) {
    await this.service.delete(Number(params.id))
    return response.noContent()
  }

  public async assign({ params, request, response }: HttpContext) {
    const schema = vine.compile(
      vine.object({
        ownerId: vine.number(),
      })
    )

    const payload = await request.validateUsing(schema)
    const lead = await this.service.assign(Number(params.id), payload.ownerId)
    return response.ok(lead)
  }

  public async resendEmail({ params, response }: HttpContext) {
    const lead = await this.service.resendConfirmationEmail(Number(params.id))
    return response.ok(lead)
  }

  public async webhookDemoConverted({ request, response }: HttpContext) {
    const schema = vine.compile(
      vine.object({
        id: vine.number(),
      })
    )
    const payload = await request.validateUsing(schema)
    const lead = await this.service.update(payload.id, { status: 'Converted' })
    return response.ok({ success: true, data: lead })
  }
}
