import { HttpContext } from '@adonisjs/core/http'
import CompanyAccount from '#models/company_account'
import BusinessSource from '#models/business_source'
import PaymentMethod from '#models/payment_method'
import { PaymentMethodType } from '#app/enums'
import LoggerService from '#services/logger_service'
import CompanyAccountService from '#services/company_account_service'
import { createCompanyAccountValidator } from '../validators/company_account.js'

export default class CompanyAccountsController {
  private service: CompanyAccountService

  constructor() {
    this.service = new CompanyAccountService()
  }

  /**
   * List all company accounts with optional filtering
   */
  async index({ request, response }: HttpContext) {
    try {
      const filters = request.input('filters', {})
      const page = request.input('page', 1)
      const perPage = request.input('perPage', 20)
      const sortBy = request.input('sortBy', 'id')
      const order = request.input('order', 'asc')

      const companyAccounts = await this.service.list(filters, sortBy, order, page, perPage)

      return response.ok({
        success: true,
        data: companyAccounts,
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error fetching company accounts',
        error: error.message,
      })
    }
  }

  /**
   * Create a new company account
   */
  async store( ctx: HttpContext) {
   const  { request, response, auth } = ctx
    try {
        const payload = await request.validateUsing(createCompanyAccountValidator)
      const data = payload
      const user = auth.user

      // Create the company account
      const companyAccount = await CompanyAccount.create({
        company_name: data.company_name,
        company_code: data.company_code,
        account_type: data.account_type,
        contact_person_name: data.contact_person_name,
        contact_person_title: data.contact_person_title,
        primary_email: data.primary_email,
        secondary_email: data.secondary_email,
        primary_phone: data.primary_phone,
        billing_address_line: data.billing_address_line,
        //billing_address_line2: data.billing_address_line2,
        billing_city: data.billing_city,
        billing_state_province: data.billing_state_province,
        billing_postal_code: data.billing_postal_code,
        notes: data.notes,
        registration_number: data.registration_number,
        add_to_business_source: data.add_to_business_source,
        do_not_count_as_city_ledger: data.do_not_count_as_city_ledger,
        last_modified_by: user?.id,
        created_by:user?.id,
        credit_limit:data.credit_limit,
        current_balance:data.current_balance,
        preferred_currency:data.preferred_currency,
        hotel_id:data.hotel_id
      })

      // Log the activity
      if (user) {
        await LoggerService.log({
          actorId: user.id,
          action: 'CREATE',
          entityType: 'CompanyAccount',
          entityId: companyAccount.id,
          description: `Company Account #${companyAccount.id} (${companyAccount.company_name}) created by ${user.firstName}.`,
          changes: LoggerService.extractChanges({}, companyAccount.serialize()),
          ctx:ctx,
        })
      }

      return response.created({
        success: true,
        data: companyAccount,
        message: 'Company account created successfully',
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Error creating company account',
        error: error.message,
      })
    }
  }

  /**
   * Show a specific company account
   */
  async show({ params, response }: HttpContext) {
    try {
      const companyAccount = await this.service.getById(params.id)

      if (!companyAccount) {
        return response.notFound({
          success: false,
          message: 'Company account not found',
        })
      }

      return response.ok({
        success: true,
        data: companyAccount,
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error fetching company account',
        error: error.message,
      })
    }
  }

  /**
   * Update a company account
   */
  async update( ctx: HttpContext) {
    const  { request, response, auth,params } = ctx
    try {
      const data = request.all()
      const user = auth.user

      // Add audit fields
      data.last_modified_by = user?.id

      const companyAccount = await this.service.update(params.id, data)

      if (!companyAccount) {
        return response.notFound({
          success: false,
          message: 'Company account not found',
        })
      }

      // Log the activity
      if (user) {
        await LoggerService.log({
          actorId: user.id,
          action: 'UPDATE',
          entityType: 'CompanyAccount',
          entityId: companyAccount.id,
          description: `Company Account #${companyAccount.id} (${companyAccount.company_name}) updated by ${user.firstName}.`,
          changes: LoggerService.extractChanges({}, companyAccount.serialize()),
          ctx: ctx,
        })
      }

      return response.ok({
        success: true,
        data: companyAccount,
        message: 'Company account updated successfully',
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Error updating company account',
        error: error.message,
      })
    }
  }

  /**
   * Delete a company account (soft delete)
   */
  async destroy(ctx: HttpContext) {
    const  { params, response, auth } =ctx;
    try {
      const user = auth.user
      const result = await this.service.delete(params.id)

      if (!result) {
        return response.notFound({
          success: false,
          message: 'Company account not found',
        })
      }

      // Log the activity
      if (user) {
        await LoggerService.log({
          actorId: user.id,
          action: 'DELETE',
          entityType: 'CompanyAccount',
          entityId: parseInt(params.id),
          description: `Company Account #${params.id} deleted by ${user.firstName}.`,
          changes: {},
          ctx: ctx
        })
      }

      return response.ok({
        success: true,
        message: 'Company account deleted successfully',
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error deleting company account',
        error: error.message,
      })
    }
  }

  /**
   * Get company accounts by hotel ID
   */
  async getByHotel({ params, response }: HttpContext) {
    try {
      const hotelId = params.hotelId
      const companyAccounts = await this.service.getByHotelId(hotelId)

      return response.ok({
        success: true,
        data: companyAccounts,
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error fetching company accounts for hotel',
        error: error.message,
      })
    }
  }

  /**
   * Get active company accounts
   */
  async getActive({ request, response }: HttpContext) {
    try {
      const hotelId = request.input('hotelId')
      const companyAccounts = await this.service.getActiveAccounts(hotelId)

      return response.ok({
        success: true,
        data: companyAccounts,
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error fetching active company accounts',
        error: error.message,
      })
    }
  }
}