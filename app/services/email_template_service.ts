import EmailTemplate from '#models/email_template'
import { Exception } from '@adonisjs/core/exceptions'
import { DateTime } from 'luxon'

export default class EmailTemplateService {
  /**
   * Get all email templates for a specific hotel
   */
  async list(hotelId: number, includeDeleted: boolean = false) {
    const query = EmailTemplate.query()
      .where('hotel_id', hotelId)
      .preload('hotel')
      .preload('templateCategory')
      .preload('emailAccount')
      .preload('creator')
      .preload('modifier')
      .orderBy('created_at', 'desc')

    if (!includeDeleted) {
      query.where('is_deleted', false)
    }

    return await query
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
      cc: data.cc ?? null,
      bcc: data.bcc ?? null,
      hotelId: data.hotelId,
      createdBy: data.createdBy,
      lastModifiedBy: data.createdBy,
      isDeleted: false,
    })

    await emailTemplate.load('hotel')
    await emailTemplate.load('templateCategory')
    await emailTemplate.load('emailAccount')
    await emailTemplate.load('creator')
    await emailTemplate.load('modifier')

    return emailTemplate
  }

  /**
   * Update an existing email template
   */
  async update(
    id: number,
    data: {
      name?: string
      templateCategoryId?: number
      attachment?: string
      emailAccountId?: number
      scheduleDate?: DateTime
      subject?: string
      messageBody?: string
      cc?: string[] | null
      bcc?: string[] | null
      hotelId?: number
      lastModifiedBy?: number
    },
    hotelId?: number
  ) {
    const emailTemplate = await this.getById(id, hotelId)

    if (emailTemplate.isDeleted) {
      throw new Exception('Cannot update deleted email template', {
        status: 400,
        code: 'EMAIL_TEMPLATE_DELETED',
      })
    }

    emailTemplate.merge({
      ...data,
      lastModifiedBy: data.lastModifiedBy,
    })

    await emailTemplate.save()
    return emailTemplate
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