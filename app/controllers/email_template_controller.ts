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
  async list({ request, response, auth }: HttpContext) {
    try {
      const { hotelId } = await request.validateUsing(getEmailTemplatesByHotelValidator)
      const includeDeleted = request.input('includeDeleted', false)

      const emailTemplates = await this.emailTemplateService.list(hotelId, includeDeleted)

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
      const payload = await request.validateUsing(createEmailTemplateValidator)
      
      // Parse schedule date if provided
      let scheduleDate: DateTime | undefined
      if (payload.scheduleDate) {
        scheduleDate = DateTime.fromJSDate(payload.scheduleDate)
      }

      const emailTemplate = await this.emailTemplateService.create({
        ...payload,
        scheduleDate,
        createdBy: auth.user?.id || null,
      })

      return response.created({
        success: true,
        message: 'Email template created successfully',
        data: emailTemplate,
      })
    } catch (error) {
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
          lastModifiedBy: auth.user?.id || null,
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
        auth.user?.id || null,
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
        auth.user?.id || null,
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