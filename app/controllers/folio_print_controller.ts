import type { HttpContext } from '@adonisjs/core/http'
import FolioPrintService from '#services/folio_print_service'
import BookingPrintService from '#services/booking_print_service'
import vine from '@vinejs/vine'

export default class FolioPrintController {
  /**
   * Generate folio print data with tax invoices
   * Returns hotel, reservation, folio details with all transactions,
   * grand total, total tax, total paid, balance, billing address,
   * and check-in/out/reserved by information
   */
  public async printFolio({ request, response }: HttpContext) {
    try {
      const validationSchema = vine.object({
        folioId: vine.number(),
        reservationId: vine.number(),
        currencyId: vine.number().optional()
      })

      const { folioId, reservationId, currencyId } = await vine.validate({
        schema: validationSchema,
        data: request.all()
      })

      const folioPrintData = await FolioPrintService.generateFolioPrintData(
        folioId,
        reservationId,
        currencyId
      )

      return response.ok({
        success: true,
        data: folioPrintData,
        message: 'Folio print data generated successfully'
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to generate folio print data',
        error: error.message
      })
    }
  }

  /**
   * Generate folio PDF for printing
   */
  async printFolioPdf({ request, response }: HttpContext) {
    try {
      // Validate input
      const folioId = request.input('folioId')
      const reservationId = request.input('reservationId')
      const currencyId = request.input('currencyId') // Optional

      if (!folioId || !reservationId) {
        return response.status(400).json({
          success: false,
          message: 'folioId and reservationId are required'
        })
      }

      // Generate folio print data
      const folioPrintData = await FolioPrintService.generateFolioPrintData(
        folioId,
        reservationId,
        currencyId
      )
      console.log('data.receive:', folioId, reservationId, currencyId)
      console.log('folioPrintData@@@@@', folioPrintData)
      // Generate PDF from folio print data
      const PdfGenerationService = (await import('#services/pdf_generation_service')).default
      const pdfBuffer = await PdfGenerationService.generateFolioPdf(folioPrintData)

      console.log('pdfBuffer@@@@@@', pdfBuffer)
      // Set response headers for PDF download
      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', `attachment; filename="folio-${folioPrintData.folio.folioNumber}.pdf"`)
      response.header('Content-Length', pdfBuffer.length.toString())

      return response.send(pdfBuffer)
    } catch (error) { 
      return response.status(500).json({
        success: false,
        message: 'Failed to generate folio PDF',
        error: error.message
      })
    }
  }
  async printBookingPdf({ request, response }: HttpContext) {
    try {
      const reservationId = request.input('reservationId')
      const currencyId = request.input('currencyId')

      if (!reservationId) {
        return response.status(400).json({
          success: false,
          message: 'reservationId is required'
        })
      }

      //  CORRECTION: Utilisez un folioId factice (0) puisque non utilisé
      const folioPrintData = await FolioPrintService.generateBookingPrintData(reservationId)

      const PdfGenerationService = (await import('#services/pdf_generation_service')).default
      const bookingPdf = await PdfGenerationService.generateBookingPdf(folioPrintData)

      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', `attachment; filename="booking-${folioPrintData.reservation.reservationNumber}.pdf"`)
      response.header('Content-Length', bookingPdf.length.toString())

      return response.send(bookingPdf)
    } catch (error) {
      console.error('Error generating booking PDF:', error)
      return response.status(500).json({
        success: false,
        message: 'Failed to generate booking PDF',
        error: error.message
      })
    }
  }
  async printHotelPdf({ request, response }: HttpContext) {
    try {
      const reservationId = request.input('reservationId')
      const currencyId = request.input('currencyId')

      if (!reservationId) {
        return response.status(400).json({
          success: false,
          message: 'reservationId is required'
        })
      }

      // CORRECTION: Utilisez un folioId factice (0) puisque non utilisé
      const folioPrintData = await FolioPrintService.generateHotelFolioPrintData(reservationId)
      const PdfGenerationService = (await import('#services/pdf_generation_service')).default
      const bookingPdf = await PdfGenerationService.generateSuitaHotelPdf(folioPrintData)

      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', `attachment; filename="booking-${folioPrintData}.pdf"`)
      response.header('Content-Length', bookingPdf.length.toString())

      return response.send(bookingPdf)
    } catch (error) {
      console.error('Error generating booking PDF:', error)
      return response.status(500).json({
        success: false,
        message: 'Failed to generate booking PDF',
        error: error.message
      })
    }
  }
}