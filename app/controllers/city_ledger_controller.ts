import type { HttpContext } from '@adonisjs/core/http'
import CityLedgerService, { type CityLedgerFilters } from '#services/city_ledger_service'
import vine from '@vinejs/vine'

// Validator for city ledger request
const cityLedgerValidator = vine.compile(
  vine.object({
    companyAccountId: vine.number().positive(),
    hotelId: vine.number().positive().optional(),
    dateFrom: vine.date().optional(),
    dateTo: vine.date().optional(),
    usePostingDate: vine.boolean().optional(),
    searchText: vine.string().trim().maxLength(255).optional(),
    showVoided: vine.boolean().optional(),
    page: vine.number().positive().optional(),
    limit: vine.number().positive().max(100).optional()
  })
)

export default class CityLedgerController {
  /**
   * Get city ledger transactions for a company account
   */
  async index({ request, response }: HttpContext) {
    try {
      const payload = await request.validateUsing(cityLedgerValidator)
      
      const filters: CityLedgerFilters = {
        companyAccountId: payload.companyAccountId,
        hotelId: payload.hotelId,
        dateFrom: payload.dateFrom,
        dateTo: payload.dateTo,
        usePostingDate: payload.usePostingDate ?? true, // Default to posting date
        searchText: payload.searchText,
        showVoided: payload.showVoided ?? false, // Default to hide voided transactions
        page: payload.page ?? 1,
        limit: payload.limit ?? 50
      }
      
      const result = await CityLedgerService.getCityLedgerTransactions(filters)
      
      return response.ok({
        success: true,
        message: 'City ledger transactions retrieved successfully',
        data: result.data,
        totals: result.totals,
        meta: result.meta,
        companyAccount: result.companyAccount
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to retrieve city ledger transactions',
        error: error.message
      })
    }
  }
  
  /**
   * Get city ledger totals only (without transaction details)
   */
  async totals({ request, response }: HttpContext) {
    try {
      const { companyAccountId, hotelId } = request.only(['companyAccountId', 'hotelId'])
      
      if (!companyAccountId) {
        return response.badRequest({
          success: false,
          message: 'Company account ID is required'
        })
      }
      
      // Get the city ledger payment method
      const paymentMethod = await CityLedgerService.getCityLedgerPaymentMethod(companyAccountId, hotelId)
      
      if (!paymentMethod) {
        return response.notFound({
          success: false,
          message: 'No city ledger payment method found for this company account'
        })
      }
      
      const totals = await CityLedgerService.calculateCityLedgerTotals(
        companyAccountId,
        paymentMethod.id,
        hotelId || paymentMethod.hotelId
      )
      
      return response.ok({
        success: true,
        message: 'City ledger totals retrieved successfully',
        data: totals
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to retrieve city ledger totals',
        error: error.message
      })
    }
  }
}