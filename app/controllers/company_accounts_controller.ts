import { HttpContext } from '@adonisjs/core/http'
import CompanyAccount from '#models/company_account'
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
  async index({ request, response, params }: HttpContext) {
    try {
      const filters = request.input('filters', {})
      // Always scope by hotel from route params
      if (params?.hotelId) {
        filters.hotel_id = Number(params.hotelId)
      }
      const page = request.input('page', 1)
      const perPage = request.input('perPage', 10)
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
  async store(ctx: HttpContext) {
    const { request, response, auth, params } = ctx
    try {
      const payload = await request.validateUsing(createCompanyAccountValidator)
      const data = payload
      const user = auth.user

      // Create the company account
      const companyAccount = await CompanyAccount.create({
        companyName: data.company_name,
        companyCode: data.company_code,
        accountType: data.account_type,
        contactPersonName: data.contact_person_name,
        contactPersonTitle: data.contact_person_title,
        primaryEmail: data.primary_email,
        secondaryEmail: data.secondary_email,
        primaryPhone: data.primary_phone,
        billingAddressLine: data.billing_address_line,
        //billingAddressLine2: data.billing_address_line2,
        billingCity: data.billing_city,
        billingStateProvince: data.billing_state_province,
        billingPostalCode: data.billing_postal_code,
        notes: data.notes,
        registrationNumber: data.registration_number,
        addToBusinessSource: data.add_to_business_source,
        doNotCountAsCityLedger: data.do_not_count_as_city_ledger,
        lastModifiedBy: user?.id,
        createdBy: user?.id,
        creditLimit: data.credit_limit,
        currentBalance: data.current_balance,
        preferredCurrency: data.preferred_currency,
        // Always take hotelId from route params
        hotelId: Number(params?.hotelId),

      })

      // Log the activity
      if (user) {
        await LoggerService.log({
          actorId: user.id,
          action: 'CREATE',
          entityType: 'CompanyAccount',
          entityId: companyAccount.id,
          description: `Company Account #${companyAccount.companyCode} (${companyAccount.companyName}) created by ${user.firstName}.`,
          changes: LoggerService.extractChanges({}, companyAccount.serialize()),
          ctx: ctx,
        })
      }

      // If addToBusinessSource is true, create a business source
      if (companyAccount.addToBusinessSource === true) {
        await this.service.createBusinessSource(companyAccount, data)
      }

      // If not marked as doNotCountAsCityLedger, create a city ledger payment method
      if (companyAccount.doNotCountAsCityLedger !== true) {
        await this.service.createCityLedgerPaymentMethod(companyAccount)
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
  async update(ctx: HttpContext) {
    const { request, response, auth, params } = ctx
    try {
      const data = request.all()
      const user = auth.user

      // Add audit fields
      data.last_modified_by = user?.id;
      const payload = {
        companyName: data.company_name,
        companyCode: data.company_code,
        accountType: data.account_type,
        contactPersonName: data.contact_person_name,
        contactPersonTitle: data.contact_person_title,
        primaryEmail: data.primary_email,
        secondaryEmail: data.secondary_email,
        primaryPhone: data.primary_phone,
        billingAddressLine: data.billing_address_line,
        //billingAddressLine2: data.billing_address_line2,
        billingCity: data.billing_city,
        billingStateProvince: data.billing_state_province,
        billingPostalCode: data.billing_postal_code,
        notes: data.notes,
        registrationNumber: data.registration_number,
        addToBusinessSource: data.add_to_business_source,
        doNotCountAsCityLedger: data.do_not_count_as_city_ledger,
        lastModifiedBy: user?.id,
        creditLimit: data.credit_limit,
        currentBalance: data.current_balance,
        preferredCurrency: data.preferred_currency,
        // Always take hotelId from route params
        hotelId: Number(params?.hotelId),
      }

      const companyAccount = await this.service.update(params.id, payload)

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
          description: `Company Account #${companyAccount.companyCode} (${companyAccount.companyName}) updated by ${user.firstName}.`,
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
    const { params, response, auth } = ctx;
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
      // Prefer hotelId from params; fallback to request body if not present
      const hotelId = (request.params()?.hotelId ? Number(request.params().hotelId) : request.input('hotelId'))
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

  /**
   * Get city ledger accounts for a hotel (doNotCountAsCityLedger = false)
   */
  async getCityLedger({ params, request, response }: HttpContext) {
    try {
      const hotelId = params.hotelId
      const companyIdRaw = params.companyId ?? request.input('companyId')
      const companyId =
        companyIdRaw !== undefined && companyIdRaw !== null && `${companyIdRaw}`.trim() !== ''
          ? Number(companyIdRaw)
          : undefined

      const page = parseInt(request.input('page', '1'))
      const limit = parseInt(request.input('limit', '10'))
      const searchText = request.input('searchText', '').trim()

      const cityLedgerAccounts = await this.service.getCityLedgerAccounts(
        Number(hotelId),
        companyId,
        page,
        limit,
        searchText
      )

      return response.ok({
        success: true,
        data: cityLedgerAccounts,
        message: 'City ledger accounts retrieved successfully',
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error fetching city ledger accounts',
        error: (error as Error).message,
      })
    }
  }
}
