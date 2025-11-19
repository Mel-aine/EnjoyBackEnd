import type { HttpContext } from '@adonisjs/core/http'
import EmailTemplateService from '#services/email_template_service'
import {
  createEmailTemplateValidator,
  updateEmailTemplateValidator,
  getEmailTemplatesByHotelValidator,
  emailTemplateParamsValidator,
} from '#validators/email_template'
import { DateTime } from 'luxon'

export default class EmailTemplateController {
  private emailTemplateService = new EmailTemplateService()

  /**
   * Get all email templates for a hotel
   */
  async list({ params, request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const hotelId = params.hotelId

      if (!hotelId) {
        return response.badRequest({
          success: false,
          message: 'hotelId is required in route params',
        })
      }

      const includeDeleted = params.includeDeleted


      const result = await this.emailTemplateService.list(
        Number(hotelId),
        includeDeleted,
        Number(page),
        Number(limit)
      )


      return response.ok({
        success: true,
        message: 'Email templates retrieved successfully',
        data: result.data,
        meta: result.meta,
      })
    } catch (error) {
      console.error('Error in controller list:', error)
      return response.status(error.status || 500).json({
        success: false,
        message: error.message || 'Failed to retrieve email templates',
        error: error.code || 'INTERNAL_SERVER_ERROR',
      })
    }
  }

  /**
   * Get a specific email template by ID
   */
  async fetch({ params, request, response }: HttpContext) {
    try {
      const { id } = await request.validateUsing(emailTemplateParamsValidator, {
        data: params,
      })
      const hotelId = request.input('hotelId')

      const emailTemplate = await this.emailTemplateService.getById(id, hotelId)

      return response.ok({
        success: true,
        message: 'Email template retrieved successfully',
        data: emailTemplate,
      })
    } catch (error) {
      return response.status(error.status || 500).json({
        success: false,
        message: error.message || 'Failed to retrieve email template',
        error: error.code || 'INTERNAL_SERVER_ERROR',
      })
    }
  }

  /**
   * Create a new email template
   */
  async create({ request, response, auth }: HttpContext) {
  try {
    // Validation du payload
    const payload = await request.validateUsing(createEmailTemplateValidator)

    // Parse schedule date if provided
    const cc = Array.isArray(payload.cc) ? payload.cc : []
    const bcc = Array.isArray(payload.bcc) ? payload.bcc : []

    let scheduleDate: DateTime | undefined
    if (payload.scheduleDate) {
      scheduleDate = DateTime.fromJSDate(payload.scheduleDate)
    } else {
      console.log('No scheduleDate provided');
    }

    // Création du template email
    const emailTemplate = await this.emailTemplateService.create({
      ...payload,
      scheduleDate,
      cc,
      bcc,
      createdBy: auth.user?.id,
    })


    return response.created({
      success: true,
      message: 'Email template created successfully',
      data: emailTemplate,
    })
  } catch (error) {
    console.error('Error creating email template:', error)

    return response.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to create email template',
      error: error.code || 'INTERNAL_SERVER_ERROR',
    })
  }
}


  /**
   * Update an existing email template
   */
  async update({ params, request, response, auth }: HttpContext) {
    try {
      const { id } = await request.validateUsing(emailTemplateParamsValidator, {
        data: params,
      })
      const payload = await request.validateUsing(updateEmailTemplateValidator)
      const hotelId = request.input('hotelId')

      // Parse schedule date if provided
      let scheduleDate: DateTime | undefined
      if (payload.scheduleDate) {
        scheduleDate = DateTime.fromJSDate(payload.scheduleDate)
      }

      const emailTemplate = await this.emailTemplateService.update(
        id,
        {
          ...payload,
          scheduleDate,
          lastModifiedBy: auth.user?.id ,
        },
        hotelId
      )

      return response.ok({
        success: true,
        message: 'Email template updated successfully',
        data: emailTemplate,
      })
    } catch (error) {
      return response.status(error.status || 500).json({
        success: false,
        message: error.message || 'Failed to update email template',
        error: error.code || 'INTERNAL_SERVER_ERROR',
      })
    }
  }

  /**
   * Soft delete an email template
   */
  async delete({ params, request, response, auth }: HttpContext) {
    try {
      const { id } = await request.validateUsing(emailTemplateParamsValidator, {
        data: params,
      })
      const hotelId = request.input('hotelId')

      const emailTemplate = await this.emailTemplateService.delete(
        id,
        auth.user?.id!,
        hotelId
      )

      return response.ok({
        success: true,
        message: 'Email template deleted successfully',
        data: emailTemplate,
      })
    } catch (error) {
      return response.status(error.status || 500).json({
        success: false,
        message: error.message || 'Failed to delete email template',
        error: error.code || 'INTERNAL_SERVER_ERROR',
      })
    }
  }

  /**
   * Restore a soft deleted email template
   */
  async restore({ params, request, response, auth }: HttpContext) {
    try {
      const { id } = await request.validateUsing(emailTemplateParamsValidator, {
        data: params,
      })
      const hotelId = request.input('hotelId')

      const emailTemplate = await this.emailTemplateService.restore(
        id,
        auth.user?.id!,
        hotelId
      )

      return response.ok({
        success: true,
        message: 'Email template restored successfully',
        data: emailTemplate,
      })
    } catch (error) {
      return response.status(error.status || 500).json({
        success: false,
        message: error.message || 'Failed to restore email template',
        error: error.code || 'INTERNAL_SERVER_ERROR',
      })
    }
  }

  /**
   * Get email templates by auto send type
   */
  async getByAutoSendType({ request, response }: HttpContext) {
    try {
      const { hotelId } = await request.validateUsing(getEmailTemplatesByHotelValidator)
      const autoSendType = request.input('autoSendType')

      if (!autoSendType) {
        return response.badRequest({
          success: false,
          message: 'Auto send type is required',
          error: 'MISSING_AUTO_SEND_TYPE',
        })
      }

      const emailTemplates = await this.emailTemplateService.getByAutoSendType(
        hotelId,
        autoSendType
      )

      return response.ok({
        success: true,
        message: 'Email templates retrieved successfully',
        data: emailTemplates,
      })
    } catch (error) {
      return response.status(error.status || 500).json({
        success: false,
        message: error.message || 'Failed to retrieve email templates',
        error: error.code || 'INTERNAL_SERVER_ERROR',
      })
    }
  }

  /**
   * Get email templates by template category
   */
  async getByTemplateCategory({ request, response }: HttpContext) {
    try {
      const { hotelId } = await request.validateUsing(getEmailTemplatesByHotelValidator)
      const templateCategoryId = request.input('templateCategoryId')

      if (!templateCategoryId) {
        return response.badRequest({
          success: false,
          message: 'Template category ID is required',
          error: 'MISSING_TEMPLATE_CATEGORY_ID',
        })
      }

      const emailTemplates = await this.emailTemplateService.getByTemplateCategory(
        hotelId,
        templateCategoryId
      )

      return response.ok({
        success: true,
        message: 'Email templates retrieved successfully',
        data: emailTemplates,
      })
    } catch (error) {
      return response.status(error.status || 500).json({
        success: false,
        message: error.message || 'Failed to retrieve email templates',
        error: error.code || 'INTERNAL_SERVER_ERROR',
      })
    }
  }

  /**
   * Get email templates by email account
   */
  async getByEmailAccount({ request, response }: HttpContext) {
    try {
      const { hotelId } = await request.validateUsing(getEmailTemplatesByHotelValidator)
      const emailAccountId = request.input('emailAccountId')

      if (!emailAccountId) {
        return response.badRequest({
          success: false,
          message: 'Email account ID is required',
          error: 'MISSING_EMAIL_ACCOUNT_ID',
        })
      }

      const emailTemplates = await this.emailTemplateService.getByEmailAccount(
        hotelId,
        emailAccountId
      )

      return response.ok({
        success: true,
        message: 'Email templates retrieved successfully',
        data: emailTemplates,
      })
    } catch (error) {
      return response.status(error.status || 500).json({
        success: false,
        message: error.message || 'Failed to retrieve email templates',
        error: error.code || 'INTERNAL_SERVER_ERROR',
      })
    }
  }
}
