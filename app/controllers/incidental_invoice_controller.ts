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
      
        const invoice = await IncidentalInvoiceService.createIncidentalInvoice(payload, auth.user?.id, ctx)
      
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
        guestId,
        folioId,
        page = 1,
        limit = 20,
        invoiceNumber,
        status,
        type,
        dateFrom,
        dateTo,
        guestName,
        folioNumber,
        amountMin,
        amountMax,
        hideVoided,
        createdBy
      } = request.qs()

      // Build filters object matching IncidentalInvoiceSearchFilters interface
      const filters = {
        hotelId: hotelId ? parseInt(hotelId) : undefined,
        guestId: guestId ? parseInt(guestId) : undefined,
        folioId: folioId ? parseInt(folioId) : undefined,
        invoiceNumber,
        status,
        type,
        dateFrom: dateFrom ? DateTime.fromISO(dateFrom) : undefined,
        dateTo: dateTo ? DateTime.fromISO(dateTo) : undefined,
        guestName,
        folioNumber,
        amountMin: amountMin ? parseFloat(amountMin) : undefined,
        amountMax: amountMax ? parseFloat(amountMax) : undefined,
        createdBy: createdBy ? parseInt(createdBy) : undefined,
        page: parseInt(page),
        limit: parseInt(limit),
        hideVoided: hideVoided
      }

      // Call the service method
      const result = await IncidentalInvoiceService.getIncidentalInvoices(filters)

      return response.json({
        success: true,
        data: result.data,
        meta: result.meta
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

  /**
   * Generate and download PDF for an incidental invoice
   */
  public async downloadPdf({ params, response }: HttpContext) {
    try {
      const invoiceId = parseInt(params.id)
      
      // Generate PDF buffer
      const pdfBuffer = await IncidentalInvoiceService.generateInvoicePdf(invoiceId)
      
      // Get invoice details for filename
      const invoice = await IncidentalInvoice.findOrFail(invoiceId)
      const filename = `incidental-invoice-${invoice.invoiceNumber}.pdf`
      
      // Set response headers for PDF download
      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', `attachment; filename="${filename}"`)
      response.header('Content-Length', pdfBuffer.length.toString())
      
      return response.send(pdfBuffer)
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: error.message || 'Failed to generate PDF'
      })
    }
  }

  /**
   * Preview PDF for an incidental invoice (inline display)
   */
  public async previewPdf({ params, response }: HttpContext) {
    try {
      const invoiceId = parseInt(params.id)
      
      // Generate PDF buffer
      const pdfBuffer = await IncidentalInvoiceService.generateInvoicePdf(invoiceId)
      
      // Set response headers for PDF preview
      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', 'inline')
      response.header('Content-Length', pdfBuffer.length.toString())
      
      return response.send(pdfBuffer)
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: error.message || 'Failed to generate PDF preview'
      })
    }
  }
}