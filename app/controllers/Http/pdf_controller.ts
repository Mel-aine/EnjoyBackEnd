import type { HttpContext } from '@adonisjs/core/http'
import { PdfService, InvoiceData, InvoiceItem } from '#services/pdf_service'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'

/**
 * Controller for PDF generation
 */
export default class PdfController {
  /**
   * Generate invoice PDF
   */
  async generateInvoice({ request, response }: HttpContext) {
    try {
      const validator = vine.compile(
        vine.object({
          invoiceNumber: vine.string(),
          guestName: vine.string(),
          guestAddress: vine.string().optional(),
          hotelName: vine.string(),
          hotelAddress: vine.string().optional(),
          issueDate: vine.string(),
          dueDate: vine.string(),
          items: vine.array(
            vine.object({
              description: vine.string(),
              quantity: vine.number(),
              unitPrice: vine.number(),
              total: vine.number(),
              date: vine.string().optional()
            })
          ),
          subtotal: vine.number(),
          tax: vine.number().optional(),
          taxRate: vine.number().optional(),
          total: vine.number(),
          currency: vine.string().optional(),
          notes: vine.string().optional(),
          format: vine.enum(['A4', 'Letter']).optional(),
          orientation: vine.enum(['portrait', 'landscape']).optional()
        })
      )

      const data = await request.validateUsing(validator)
      
      const invoiceData: InvoiceData = {
        invoiceNumber: data.invoiceNumber,
        guestName: data.guestName,
        guestAddress: data.guestAddress,
        hotelName: data.hotelName,
        hotelAddress: data.hotelAddress,
        issueDate: data.issueDate,
        dueDate: data.dueDate,
        items: data.items,
        subtotal: data.subtotal,
        tax: data.tax,
        taxRate: data.taxRate,
        total: data.total,
        currency: data.currency || '$',
        notes: data.notes
      }

      const pdfOptions = {
        format: data.format || 'A4',
        orientation: data.orientation || 'portrait'
      }

      const pdfBuffer = await PdfService.generateInvoicePdf(invoiceData, pdfOptions)

      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', `attachment; filename="invoice-${data.invoiceNumber}.pdf"`)
      
      return response.send(pdfBuffer)
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to generate invoice PDF',
        error: error.message
      })
    }
  }

  /**
   * Generate receipt PDF
   */
  async generateReceipt({ request, response }: HttpContext) {
    try {
      const validator = vine.compile(
        vine.object({
          receiptNumber: vine.string(),
          guestName: vine.string(),
          hotelName: vine.string(),
          date: vine.string(),
          items: vine.array(
            vine.object({
              description: vine.string(),
              quantity: vine.number(),
              unitPrice: vine.number(),
              total: vine.number()
            })
          ),
          total: vine.number(),
          paymentMethod: vine.string().optional(),
          currency: vine.string().optional(),
          format: vine.enum(['A4', 'Letter']).optional(),
          orientation: vine.enum(['portrait', 'landscape']).optional()
        })
      )

      const data = await request.validateUsing(validator)
      
      const receiptData = {
        receiptNumber: data.receiptNumber,
        guestName: data.guestName,
        hotelName: data.hotelName,
        date: data.date,
        items: data.items,
        total: data.total,
        paymentMethod: data.paymentMethod,
        currency: data.currency || '$'
      }

      const pdfOptions = {
        format: data.format || 'A4',
        orientation: data.orientation || 'portrait'
      }

      const pdfBuffer = await PdfService.generateReceiptPdf(receiptData, pdfOptions)

      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', `attachment; filename="receipt-${data.receiptNumber}.pdf"`)
      
      return response.send(pdfBuffer)
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to generate receipt PDF',
        error: error.message
      })
    }
  }

  /**
   * Generate PDF from custom HTML
   */
  async generateCustomPdf({ request, response }: HttpContext) {
    try {
      const validator = vine.compile(
        vine.object({
          html: vine.string(),
          filename: vine.string().optional(),
          format: vine.enum(['A4', 'Letter']).optional(),
          orientation: vine.enum(['portrait', 'landscape']).optional(),
          margin: vine.object({
            top: vine.string().optional(),
            right: vine.string().optional(),
            bottom: vine.string().optional(),
            left: vine.string().optional()
          }).optional()
        })
      )

      const data = await request.validateUsing(validator)
      
      const pdfOptions = {
        format: data.format || 'A4',
        orientation: data.orientation || 'portrait',
        margin: data.margin
      }

      const pdfBuffer = await PdfService.generatePdfFromHtml(data.html, pdfOptions)
      
      const filename = data.filename || `document-${DateTime.now().toFormat('yyyyMMdd-HHmmss')}.pdf`

      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', `attachment; filename="${filename}"`)
      
      return response.send(pdfBuffer)
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to generate custom PDF',
        error: error.message
      })
    }
  }

  /**
   * Generate sample invoice for testing
   */
  async generateSampleInvoice({ response }: HttpContext) {
    try {
      const sampleData: InvoiceData = {
        invoiceNumber: 'INV-2024-001',
        guestName: 'John Doe',
        guestAddress: '123 Main Street\nNew York, NY 10001\nUSA',
        hotelName: 'Grand Hotel & Resort',
        hotelAddress: '456 Luxury Avenue\nMiami, FL 33101\nUSA',
        issueDate: DateTime.now().toFormat('yyyy-MM-dd'),
        dueDate: DateTime.now().plus({ days: 30 }).toFormat('yyyy-MM-dd'),
        items: [
          {
            description: 'Deluxe Room - 3 nights',
            quantity: 3,
            unitPrice: 150.00,
            total: 450.00,
            date: DateTime.now().toFormat('yyyy-MM-dd')
          },
          {
            description: 'Room Service',
            quantity: 2,
            unitPrice: 25.00,
            total: 50.00,
            date: DateTime.now().toFormat('yyyy-MM-dd')
          },
          {
            description: 'Spa Services',
            quantity: 1,
            unitPrice: 80.00,
            total: 80.00,
            date: DateTime.now().toFormat('yyyy-MM-dd')
          }
        ],
        subtotal: 580.00,
        taxRate: 10,
        tax: 58.00,
        total: 638.00,
        currency: '$',
        notes: 'Thank you for staying with us. Payment is due within 30 days of invoice date.'
      }

      const pdfBuffer = await PdfService.generateInvoicePdf(sampleData)

      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', `attachment; filename="sample-invoice.pdf"`)
      
      return response.send(pdfBuffer)
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to generate sample invoice',
        error: error.message
      })
    }
  }

  /**
   * Generate sample receipt for testing
   */
  async generateSampleReceipt({ response }: HttpContext) {
    try {
      const sampleData = {
        receiptNumber: 'REC-2024-001',
        guestName: 'Jane Smith',
        hotelName: 'Grand Hotel & Resort',
        date: DateTime.now().toFormat('yyyy-MM-dd HH:mm:ss'),
        items: [
          {
            description: 'Standard Room - 2 nights',
            quantity: 2,
            unitPrice: 120.00,
            total: 240.00
          },
          {
            description: 'Breakfast',
            quantity: 2,
            unitPrice: 15.00,
            total: 30.00
          }
        ],
        total: 270.00,
        paymentMethod: 'Credit Card',
        currency: '$'
      }

      const pdfBuffer = await PdfService.generateReceiptPdf(sampleData)

      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', `attachment; filename="sample-receipt.pdf"`)
      
      return response.send(pdfBuffer)
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to generate sample receipt',
        error: error.message
      })
    }
  }
}