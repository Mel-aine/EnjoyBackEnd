import EmailTemplate from '#models/email_template'
import { Exception } from '@adonisjs/core/exceptions'
import { DateTime } from 'luxon'

export default class EmailTemplateService {
  /**
   * Get all email templates for a specific hotel
   */

  async list(hotelId: number, includeDeleted: boolean = false, page: number = 1, limit: number = 10) {
  try {
    const query = EmailTemplate.query()
      .where('hotel_id', hotelId)

    if (!includeDeleted) {
      query.where('is_deleted', false)
    }

    // Ajouter l'ordre et les relations, puis paginer
    const paginatedTemplates = await query
      .orderBy('created_at', 'desc')
      .preload('hotel')
      .preload('templateCategory')
      .preload('emailAccount')
      .preload('creator')
      .preload('modifier')
      .paginate(page, limit)

    const templates = paginatedTemplates.all()

    // Transformer les données
    const data = templates.map(template => {
      const serialized = template.serialize()
      return {
        ...serialized,
        cc: Array.isArray(serialized.cc) ? serialized.cc : [],
        bcc: Array.isArray(serialized.bcc) ? serialized.bcc : []
      }
    })

    return {
      data: data,
      meta: {
        total: paginatedTemplates.total,
        perPage: paginatedTemplates.perPage,
        currentPage: paginatedTemplates.currentPage,
        lastPage: paginatedTemplates.lastPage,
        firstPage: 1,
        hasMorePages: paginatedTemplates.hasMorePages,
        isEmpty: paginatedTemplates.isEmpty,
      }
    }
  } catch (error) {
    console.error('Error in EmailTemplateService.list:', error)
    throw error
  }
}


  /**
   * Get a specific email template by ID
   */
  async getById(id: number, hotelId?: number) {
    const query = EmailTemplate.query()
      .where('id', id)
      .preload('hotel')
      .preload('templateCategory')
      .preload('emailAccount')
      .preload('creator')
      .preload('modifier')

    if (hotelId) {
      query.where('hotel_id', hotelId)
    }

    const emailTemplate = await query.first()

    if (!emailTemplate) {
      throw new Exception('Email template not found', {
        status: 404,
        code: 'EMAIL_TEMPLATE_NOT_FOUND',
      })
    }

    return emailTemplate
  }

  /**
   * Create a new email template
   */
  async create(data: {
    name: string
    templateCategoryId: number
    autoSend?: string
    attachment?: string
    emailAccountId: number
    scheduleDate?: DateTime
    subject: string
    messageBody: string
    cc?: string[] | null
    bcc?: string[] | null
    hotelId: number
    createdBy?: number
  }) {
    const emailTemplate = await EmailTemplate.create({
      name: data.name,
      templateCategoryId: data.templateCategoryId,
      autoSend: 'Manual',
      attachment: data.attachment,
      emailAccountId: data.emailAccountId,
      scheduleDate: data.scheduleDate,
      subject: data.subject,
      messageBody: data.messageBody,
      cc: Array.isArray(data.cc) ? data.cc : [],
      bcc: Array.isArray(data.bcc) ? data.bcc : [],
      hotelId: data.hotelId,
      createdBy: data.createdBy,
      isDeleted: false,
    })

    await emailTemplate.load('hotel')
    await emailTemplate.load('templateCategory')
    await emailTemplate.load('emailAccount')
    await emailTemplate.load('creator')

    return emailTemplate
  }

  /**
   * Update an existing email template
   */
   async update(
    id: number,
    data: Partial<{
      name: string
      templateCategoryId: number
      subject: string
      messageBody: string
      autoSend: string
      attachment: string
      emailAccountId: number
      cc: string[]
      bcc: string[]
      scheduleDate: DateTime
      lastModifiedBy: number
      isActive: boolean
    }>,
    hotelId?: number
  ) {
    try {
      const query = EmailTemplate.query().where('id', id)

      if (hotelId) {
        query.where('hotelId', hotelId)
      }

      const template = await query.firstOrFail()

      // Préparer les données avec les tableaux
      const updateData:any = { ...data }
      if (updateData.cc !== undefined) {
        updateData.cc = Array.isArray(updateData.cc) ? updateData.cc : []
      }
      if (updateData.bcc !== undefined) {
        updateData.bcc = Array.isArray(updateData.bcc) ? updateData.bcc : []
      }

      template.merge(updateData)
      await template.save()

      await template.load('templateCategory')
      await template.load('emailAccount')
      await template.load('creator')


      return template
    } catch (error) {
      console.error('Error in EmailTemplateService.update:', error)
      throw error
    }
  }



  /**
   * Soft delete an email template
   */
  async delete(id: number, deletedBy?: number, hotelId?: number) {
    const emailTemplate = await this.getById(id, hotelId)

    if (emailTemplate.isDeleted) {
      throw new Exception('Email template already deleted', {
        status: 400,
        code: 'EMAIL_TEMPLATE_ALREADY_DELETED',
      })
    }

    emailTemplate.merge({
      isDeleted: true,
      deletedBy: deletedBy,
      deletedAt: DateTime.now(),
    })

    await emailTemplate.save()
    return emailTemplate
  }

  /**
   * Restore a soft deleted email template
   */
  async restore(id: number, restoredBy?: number, hotelId?: number) {
    const emailTemplate = await this.getById(id, hotelId)

    if (!emailTemplate.isDeleted) {
      throw new Exception('Email template is not deleted', {
        status: 400,
        code: 'EMAIL_TEMPLATE_NOT_DELETED',
      })
    }

    emailTemplate.merge({
      isDeleted: false,
      deletedBy: null,
      deletedAt: null,
      lastModifiedBy: restoredBy,
    })

    await emailTemplate.save()
    return emailTemplate
  }

  /**
   * Get email templates by auto send type
   */
  async getByAutoSendType(hotelId: number, autoSendType: string) {
    return await EmailTemplate.query()
      .where('hotel_id', hotelId)
      .where('auto_send', autoSendType)
      .where('is_deleted', false)
      .preload('hotel')
      .preload('templateCategory')
      .preload('emailAccount')
      .preload('creator')
      .preload('modifier')
  }

  /**
   * Get email templates by template category
   */
  async getByTemplateCategory(hotelId: number, templateCategoryId: number) {
    return await EmailTemplate.query()
      .where('hotel_id', hotelId)
      .where('template_category_id', templateCategoryId)
      .where('is_deleted', false)
      .preload('hotel')
      .preload('templateCategory')
      .preload('emailAccount')
      .preload('creator')
      .preload('modifier')
  }

  /**
   * Get email templates by email account
   */
  async getByEmailAccount(hotelId: number, emailAccountId: number) {
    return await EmailTemplate.query()
      .where('hotel_id', hotelId)
      .where('email_account_id', emailAccountId)
      .where('is_deleted', false)
      .preload('hotel')
      .preload('templateCategory')
      .preload('emailAccount')
      .preload('creator')
      .preload('modifier')
  }
}
