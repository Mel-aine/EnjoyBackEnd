import { DateTime } from 'luxon'
import RequestDemo from '#models/request_demo'
import MailService from '#services/mail_service'

type CreateRequestDemoInput = {
  email: string
  contactName: string
  country: string
  companyName: string
  phoneNumber: string
  numberOfRooms: number
  acceptCondition: boolean
  propertyType?: string
  preferredLanguage?: string
  leadSource?: string
  notesMessage?: string
  competition?: string
  createdBy?: number | null
  city?: string
}

type UpdateRequestDemoInput = Partial<{
  email: string
  contactName: string
  country: string | null
  companyName: string
  phoneNumber: string | null
  numberOfRooms: number | null
  acceptCondition: boolean
  emailSend: boolean
  status:
    | 'New'
    | 'Qualified'
    | 'Demo Scheduled'
    | 'Demo Completed'
    | 'Trial'
    | 'Negotiation'
    | 'Converted'
    | 'Lost'
    | 'Junk'
  ownerId: number | null
  followUpDate: string | null
  propertyType: string | null
  preferredLanguage: string | null
  leadSource: string | null
  notesMessage: string | null
  competition: string | null
}>

export default class RequestDemoService {
  private isValidEmailDomain(email: string) {
    const domain = email.split('@')[1]?.toLowerCase()
    if (!domain) return false
    if (!domain.includes('.')) return false
    if (domain.startsWith('.') || domain.endsWith('.')) return false
    if (domain.includes(' ')) return false
    return true
  }

  private async ensureNoDuplicateActiveRequest(email: string) {
    const existing = await RequestDemo.query()
      .where('email', email)
      .whereIn('status', ['New', 'Qualified'])
      .first()

    if (existing) {
      const err: any = new Error('A demo request already exists for this email')
      err.statusCode = 409
      throw err
    }
  }

  public async create(input: CreateRequestDemoInput) {
    if (!this.isValidEmailDomain(input.email)) {
      const err: any = new Error('Invalid email domain')
      err.statusCode = 422
      throw err
    }

    await this.ensureNoDuplicateActiveRequest(input.email)

    const lead = await RequestDemo.create({
      contactName: input.contactName,
      companyName: input.companyName,
      propertyType: input.propertyType ?? null,
      numberOfRooms: input.numberOfRooms,
      phoneNumber: input.phoneNumber,
      country: input.country,
      email: input.email,
      preferredLanguage: input.preferredLanguage ?? null,
      leadSource: input.leadSource ?? null,
      notesMessage: input.notesMessage ?? null,
      competition: input.competition ?? null,
      acceptCondition: input.acceptCondition,
      emailSend: false,
      status: 'New',
      ownerId: null,
      followUpDate: null,
      createdBy: input.createdBy ?? null,
    })

    await this.sendConfirmationEmail(lead)
    await lead.load('owner')
    return lead
  }

  public async get(id: number) {
    return RequestDemo.query()
      .where('id', id)
      .preload('owner', (q) => q.preload('role'))
      .firstOrFail()
  }

  public async list(filters: {
    page: number
    limit: number
    search?: string
    status?: string
    ownerId?: number
    all?: boolean
    currentUserId?: number
    isCommercial?: boolean
  }) {
    const query = RequestDemo.query().preload('owner')

    if (filters.isCommercial && filters.currentUserId) {
      query.where((q) => {
        q.where('owner_id', filters.currentUserId!)
        .orWhere('created_by', filters.currentUserId!)
      })
    }

    if (filters.search) {
      query.where((q) => {
        q.whereILike('contact_name', `%${filters.search}%`)
          .orWhereILike('company_name', `%${filters.search}%`)
          .orWhereILike('email', `%${filters.search}%`)
          .orWhereILike('phone_number', `%${filters.search}%`)
      })
    }

    if (filters.status) {
      query.where('status', filters.status)
    }

    if (filters.all === true) {
      const data = await query.orderBy('created_at', 'desc')
      return {
        data,
        meta: { total: data.length, all: true },
      }
    }

    return query.orderBy('created_at', 'desc').paginate(filters.page, filters.limit)
  }

  public async update(id: number, input: UpdateRequestDemoInput) {
    const lead = await RequestDemo.findOrFail(id)

    if (input.followUpDate !== undefined) {
      lead.followUpDate = input.followUpDate ? DateTime.fromISO(input.followUpDate) : null
    }

    const updatableFields: (keyof UpdateRequestDemoInput)[] = [
      'contactName', 'companyName', 'propertyType', 'numberOfRooms',
      'phoneNumber', 'country', 'email', 'preferredLanguage',
      'leadSource', 'notesMessage', 'competition', 'acceptCondition',
      'emailSend', 'status', 'ownerId',
    ]

    for (const field of updatableFields) {
      if (input[field] !== undefined) {
        (lead as any)[field] = input[field]
      }
    }

    await lead.save()

    if (lead.ownerId !== undefined && lead.ownerId !== null) {
      await lead.load('owner')
    }

    return lead
  }

  public async delete(id: number) {
    const lead = await RequestDemo.findOrFail(id)
    await lead.delete()
  }

  public async assign(id: number, ownerId: number) {
    const lead = await RequestDemo.findOrFail(id)
    lead.ownerId = ownerId
    await lead.save()
    await lead.load('owner')
    return lead
  }

  public async resendConfirmationEmail(id: number) {
    const lead = await RequestDemo.findOrFail(id)
    await this.sendConfirmationEmail(lead)
    await lead.load('owner')
    return lead
  }

  private async sendConfirmationEmail(lead: RequestDemo) {
    try {
      await MailService.send({
        to: lead.email,
        subject: 'Request Demo received',
        text: `Hello ${lead.contactName},\n\nWe received your request for a PMS demo. Our team will contact you soon.\n\nEnjoy PMS`,
        html: `<p>Hello ${lead.contactName},</p><p>We received your request for a PMS demo. Our team will contact you soon.</p><p>Enjoy PMS</p>`,
      })
      lead.emailSend = true
      await lead.save()
    } catch {}
  }
}
