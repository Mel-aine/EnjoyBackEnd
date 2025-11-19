import type { HttpContext } from '@adonisjs/core/http'
import EmailAccountService from '#services/email_account_service'
import MailjetService from '#services/mailjet_service'
import EmailAccount from '#models/email_account'
import { createEmailAccountValidator, updateEmailAccountValidator } from '#validators/email_account'

export default class EmailAccountsController {
  private emailAccountService = new EmailAccountService()

  /**
   * Get all email accounts for a specific hotel
   */
  async index({ params, request, response }: HttpContext) {
    try {
      const { page = 1, limit = 10 } = request.qs()
      const hotelId = params.hotelId

      if (!hotelId) {
        return response.badRequest({
          success: false,
          message: 'hotelId is required in route params'
        })
      }

      const emailAccounts = await this.emailAccountService.getByHotelId(Number(hotelId), page, limit)

      return response.ok({
        success: true,
        data: emailAccounts,
        message: 'Email accounts retrieved successfully'
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * Get active email accounts for a hotel
   */
  async getActive({ request, response }: HttpContext) {
    try {
      const hotelId = request.param('hotelId')

      if (!hotelId) {
        return response.badRequest({
          success: false,
          message: 'Hotel ID is required'
        })
      }

      const emailAccounts = await this.emailAccountService.getActiveByHotelId(Number(hotelId))

      return response.ok({
        success: true,
        data: emailAccounts,
        message: 'Active email accounts retrieved successfully'
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: error.message || 'Failed to retrieve active email accounts'
      })
    }
  }

  /**
   * Get a specific email account by ID
   */
  async show({ params, response }: HttpContext) {
    try {
      const emailAccount = await this.emailAccountService.getById(params.id)

      return response.ok({
        success: true,
        data: emailAccount,
        message: 'Email account retrieved successfully'
      })
    } catch (error) {
      const status = error.status || 500
      return response.status(status).json({
        success: false,
        message: error.message || 'Failed to retrieve email account'
      })
    }
  }

  /**
   * Create a new email account
   */
  async store({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createEmailAccountValidator)

      const emailAccount = await this.emailAccountService.create({
        ...payload,
        createdBy: auth.user?.id
      })

      return response.created({
        success: true,
        data: emailAccount,
        message: 'Email account created successfully'
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: error.message || 'Failed to create email account'
      })
    }
  }

  /**
   * Update an existing email account
   */
  async update({ params, request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(updateEmailAccountValidator)

      const emailAccount = await this.emailAccountService.update(params.id, {
        ...payload,
        lastModifiedBy: auth.user?.id
      })

      return response.ok({
        success: true,
        data: emailAccount,
        message: 'Email account updated successfully'
      })
    } catch (error) {
      const status = error.status || 500
      return response.status(status).json({
        success: false,
        message: error.message || 'Failed to update email account'
      })
    }
  }

  /**
   * Delete an email account
   */
  async destroy({ params, response }: HttpContext) {
    try {
      await this.emailAccountService.delete(params.id)

      return response.ok({
        success: true,
        message: 'Email account deleted successfully'
      })
    } catch (error) {
      const status = error.status || 500
      return response.status(status).json({
        success: false,
        message: error.message || 'Failed to delete email account'
      })
    }
  }

  /**
   * Toggle active status of an email account
   */
  async toggleActive({ params, response, auth }: HttpContext) {
    try {
      const emailAccount = await this.emailAccountService.toggleActive(
        params.id,
        auth.user?.id
      )

      return response.ok({
        success: true,
        data: emailAccount,
        message: `Email account ${emailAccount.isActive ? 'activated' : 'deactivated'} successfully`
      })
    } catch (error) {
      const status = error.status || 500
      return response.status(status).json({
        success: false,
        message: error.message || 'Failed to toggle email account status'
      })
    }
  }

  /**
   * Validate sender status in Mailjet by email and sync isActive.
   * POST /api/hotels/:hotelId/email-accounts/validate
   * Body: { email: string } or { sendEmail: string }
   */
  async validate({ params, request, response, auth }: HttpContext) {
    try {
      const hotelId = Number(params.hotelId)
      const email = request.input('email')
      if (!hotelId || !email) {
        return response.badRequest({
          success: false,
          message: 'hotelId (param) and email (body) are required'
        })
      }

      // Get sender status from Mailjet
      const sender = await MailjetService.getSenderByEmail(email)
      console.log('sender', sender)
      const status: string = sender?.Status;
      const isActive = status === 'Active'

      // Update local EmailAccount isActive
      const account = await EmailAccount.query()
        .where('hotel_id', hotelId)
        .where('email_address', email)
        .first()

      if (account) {
        account.isActive = isActive
        account.status = isActive ? 'verify' : 'pending'
        account.lastModifiedBy = auth.user?.id!
        await account.save()
      }
      return response.ok({
        success: true,
        data: {
          email,
          mailjet: { status: status, id: sender?.ID ?? null },
          isActive,
          account,
        },
        message: 'Sender status validated and isActive synced'
      })
    } catch (error) {
      const status = error.status || 500
      return response.status(status).json({
        success: false,
        message: error.message || 'Failed to validate sender status'
      })
    }
  }
}