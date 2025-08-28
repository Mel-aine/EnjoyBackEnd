import type { HttpContext } from '@adonisjs/core/http'
import IncidentalInvoice from '#models/incidental_invoice'
import IncidentalInvoiceService from '#services/incidental_invoice_service'
import { createIncidentalInvoiceValidator } from '#validators/incidental_invoice'
import { DateTime } from 'luxon'

export default class IncidentalInvoiceController {
  /**
   * Create a new incidental invoice
   */
  public async create(ctx: HttpContext) {
    const { request, response,auth } = ctx
    try {
      const payload = await request.validateUsing(createIncidentalInvoiceValidator)
      
        const invoice = await IncidentalInvoiceService.createIncidentalInvoice(payload, auth.user?.id)
      
      return response.status(200).json({
        success: true,
        message: 'Incidental invoice created successfully',
        data: invoice
      })
    } catch (error) {
      return response.status(400).json({
        success: false,
        message: error.message || 'Failed to create incidental invoice',
        errors: error.messages || null
      })
    }
  }

  /**
   * Get all incidental invoices with search and filtering
   */
  public async index({ request, response }: HttpContext) {
    try {
      const {
        hotelId,
        page = 1,
        limit = 20,
        search,
        folioNumber,
        guestName,
        invoiceNumber,
        status,
        dateFrom,
        dateTo,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = request.qs()

      // Build query
      let query = IncidentalInvoice.query()
        .preload('hotel')
        .preload('folio', (folioQuery) => {
          folioQuery.preload('guest')
        })
        .preload('guest')

      // Filter by hotel ID (required)
      if (hotelId) {
        query = query.where('hotel_id', hotelId)
      }

      // Search functionality
      if (search) {
        query = query.where((searchQuery) => {
          searchQuery
            .where('invoice_number', 'ILIKE', `%${search}%`)
            .orWhere('description', 'ILIKE', `%${search}%`)
            .orWhere('reference_number', 'ILIKE', `%${search}%`)
        })
      }

      // Filter by folio number
      if (folioNumber) {
        query = query.whereHas('folio', (folioQuery) => {
          folioQuery.where('folio_number', 'ILIKE', `%${folioNumber}%`)
        })
      }

      // Filter by guest name
      if (guestName) {
        query = query.whereHas('guest', (guestQuery) => {
          guestQuery
            .where('first_name', 'ILIKE', `%${guestName}%`)
            .orWhere('last_name', 'ILIKE', `%${guestName}%`)
            .orWhere('full_name', 'ILIKE', `%${guestName}%`)
        })
      }

      // Filter by invoice number
      if (invoiceNumber) {
        query = query.where('invoice_number', 'ILIKE', `%${invoiceNumber}%`)
      }

      // Filter by status
      if (status) {
        query = query.where('status', status)
      }

      // Filter by date range
      if (dateFrom) {
        const fromDate = DateTime.fromISO(dateFrom).startOf('day')
        query = query.where('invoice_date', '>=', fromDate.toJSDate())
      }

      if (dateTo) {
        const toDate = DateTime.fromISO(dateTo).endOf('day')
        query = query.where('invoice_date', '<=', toDate.toJSDate())
      }

      // Sorting
      const validSortFields = [
        'created_at', 'updated_at', 'invoice_date', 'invoice_number',
        'total_amount', 'status', 'folio_id'
      ]
      
      if (validSortFields.includes(sortBy)) {
        const order = sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc'
        query = query.orderBy(sortBy, order)
      } else {
        query = query.orderBy('created_at', 'desc')
      }

      // Pagination
      const invoices = await query.paginate(page, limit)

      return response.json({
        success: true,
        data: invoices.serialize(),
        meta: {
          total: invoices.total,
          perPage: invoices.perPage,
          currentPage: invoices.currentPage,
          lastPage: invoices.lastPage,
          hasMorePages: invoices.hasMorePages
        }
      })
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve incidental invoices'
      })
    }
  }

  /**
   * Get a specific incidental invoice by ID
   */
  public async show({ params, response }: HttpContext) {
    try {
      const invoice = await IncidentalInvoice.query()
        .where('id', params.id)
        .preload('hotel')
        .preload('folio', (folioQuery) => {
          folioQuery
            .preload('guest')
            .preload('transactions', (transactionQuery) => {
              transactionQuery.orderBy('created_at', 'desc')
            })
        })
        .preload('guest')
        .firstOrFail()

      return response.json({
        success: true,
        data: invoice
      })
    } catch (error) {
      return response.status(404).json({
        success: false,
        message: 'Incidental invoice not found'
      })
    }
  }

  /**
   * Get incidental invoice by invoice number
   */
  public async getByInvoiceNumber({ params, response }: HttpContext) {
    try {
      const invoice = await IncidentalInvoice.query()
        .where('invoice_number', params.invoiceNumber)
        .preload('hotel')
        .preload('folio', (folioQuery) => {
          folioQuery
            .preload('guest')
            .preload('transactions', (transactionQuery) => {
              transactionQuery.orderBy('created_at', 'desc')
            })
        })
        .preload('guest')
        .firstOrFail()

      return response.json({
        success: true,
        data: invoice
      })
    } catch (error) {
      return response.status(404).json({
        success: false,
        message: 'Incidental invoice not found'
      })
    }
  }

  /**
   * Void an incidental invoice
   */
  public async void({ params, request, response, auth }: HttpContext) {
    try {
      const { reason } = request.only(['reason'])
      
      if (!reason || reason.trim().length === 0) {
        return response.status(400).json({
          success: false,
          message: 'Void reason is required'
        })
      }

      const invoice = await IncidentalInvoiceService.voidIncidentalInvoice(
        params.id,
        reason,
        auth.user!.id
      )

      return response.json({
        success: true,
        message: 'Incidental invoice voided successfully',
        data: invoice
      })
    } catch (error) {
      return response.status(400).json({
        success: false,
        message: error.message || 'Failed to void incidental invoice'
      })
    }
  }

  /**
   * Get invoice statistics for a hotel
   */
  public async getStatistics({ request, response }: HttpContext) {
    try {
      const { hotelId, dateFrom, dateTo } = request.qs()

      if (!hotelId) {
        return response.status(400).json({
          success: false,
          message: 'Hotel ID is required'
        })
      }

      let query = IncidentalInvoice.query().where('hotel_id', hotelId)

      // Filter by date range if provided
      if (dateFrom) {
        const fromDate = DateTime.fromISO(dateFrom).startOf('day')
        query = query.where('invoice_date', '>=', fromDate.toJSDate())
      }

      if (dateTo) {
        const toDate = DateTime.fromISO(dateTo).endOf('day')
        query = query.where('invoice_date', '<=', toDate.toJSDate())
      }

      const [totalInvoices, activeInvoices, voidedInvoices, totalAmount] = await Promise.all([
        query.clone().count('* as total'),
        query.clone().where('status', 'active').count('* as total'),
        query.clone().where('status', 'voided').count('* as total'),
        query.clone().where('status', 'active').sum('total_amount as total')
      ])

      return response.json({
        success: true,
        data: {
          totalInvoices: totalInvoices[0].$extras.total,
          activeInvoices: activeInvoices[0].$extras.total,
          voidedInvoices: voidedInvoices[0].$extras.total,
          totalAmount: totalAmount[0].$extras.total || 0
        }
      })
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve statistics'
      })
    }
  }
}