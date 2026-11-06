import type { HttpContext } from '@adonisjs/core/http'
import FolioPrintService from '#services/folio_print_service'
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
      const folioId = request.input('folioId')
      const reservationId = request.input('reservationId')
      const currencyId = request.input('currencyId')

      if (!folioId || !reservationId) {
        return response.status(400).json({
          success: false,
          message: 'folioId and reservationId are required',
        })
      }

      const folioPrintData = await FolioPrintService.generateHotelFolioPrintData(
        Number(reservationId),
        Number(folioId),
      )

      const PdfGenerationService = (await import('#services/pdf_generation_service')).default
      const template = String(
        request.input('template') || folioPrintData.hotel.invoiceTemplate || 'standard'
      )
      const pdfBuffer = template === 'detailed'
        ? await PdfGenerationService.generateDetailedHotelPdf(folioPrintData)
        : await PdfGenerationService.generateSuitaHotelPdf(folioPrintData)

      const folioNumber = folioPrintData?.folio?.folioNumber || String(folioId)
      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', `attachment; filename="folio-${folioNumber}.pdf"`)
      response.header('Content-Length', pdfBuffer.length.toString())

      return response.send(pdfBuffer)
    } catch (error) {
      console.error('Error generating folio PDF:', error)
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
      const language = request.input('language', 'en') // Par défaut à 'en'

      if (!reservationId) {
        return response.status(400).json({
          success: false,
          message: 'reservationId is required'
        })
      }

      // Validation de la langue
      const validLanguages = ['en', 'fr']
      if (!validLanguages.includes(language)) {
        return response.status(400).json({
          success: false,
          message: `Invalid language. Supported languages: ${validLanguages.join(', ')}`
        })
      }

      // CORRECTION: Utilisez un folioId factice (0) puisque non utilisé
      const folioPrintData = await FolioPrintService.generateBookingPrintData(reservationId)

      const PdfGenerationService = (await import('#services/pdf_generation_service')).default

      // Choix de la méthode en fonction de la langue
      let bookingPdf: Buffer
      if (language === 'fr') {
        bookingPdf = await PdfGenerationService.generateBookingPdfFrench(folioPrintData as any)
      } else {
        bookingPdf = await PdfGenerationService.generateBookingPdf(folioPrintData as any)
      }

      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', `attachment; filename="booking-${folioPrintData.reservation.reservationNumber}-${language}.pdf"`)
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
      const folioIdInput = request.input('folioId')
      const currencyId = request.input('currencyId')
      const language = request.input('language', 'en') // Par défaut à 'en'

      if (!reservationId) {
        return response.status(400).json({
          success: false,
          message: 'reservationId is required'
        })
      }

      // Validation de la langue
      const validLanguages = ['en', 'fr']
      if (!validLanguages.includes(language)) {
        return response.status(400).json({
          success: false,
          message: `Invalid language. Supported languages: ${validLanguages.join(', ')}`
        })
      }

      // CORRECTION: Utilisez un folioId factice (0) puisque non utilisé
      const folioPrintData = await FolioPrintService.generateHotelFolioPrintData(
        Number(reservationId),
        folioIdInput !== undefined && folioIdInput !== null && folioIdInput !== '' && Number.isFinite(Number(folioIdInput))
          ? Number(folioIdInput)
          : null
      )

      const PdfGenerationService = (await import('#services/pdf_generation_service')).default

      // Choix de la méthode en fonction de la langue et du modèle configuré
      const template = String(
        request.input('template') || folioPrintData.hotel.invoiceTemplate || 'standard'
      )
      let bookingPdf: Buffer
      if (template === 'detailed') {
        bookingPdf = language === 'fr'
          ? await PdfGenerationService.generateDetailedHotelPdfFrench(folioPrintData)
          : await PdfGenerationService.generateDetailedHotelPdf(folioPrintData)
      } else if (language === 'fr') {
        bookingPdf = await PdfGenerationService.generateSuitaHotelPdfFrench(folioPrintData)
      } else {
        bookingPdf = await PdfGenerationService.generateSuitaHotelPdf(folioPrintData)
      }

      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', `attachment; filename="hotel-folio-${folioPrintData.reservation?.reservationNumber || 'unknown'}-${language}.pdf"`)
      response.header('Content-Length', bookingPdf.length.toString())

      return response.send(bookingPdf)
    } catch (error) {
      console.error('Error generating hotel PDF:', error)
      return response.status(500).json({
        success: false,
        message: 'Failed to generate hotel PDF',
        error: error.message
      })
    }
  }



  async sendInvoiceByEmail({ request, response, auth }: HttpContext) {
    try {
      const reservationId = request.input('reservationId')
      const folioId = request.input('folioId', null)
      const language = request.input('language', 'en')
      const recipientEmail = request.input('recipientEmail')

      if (!reservationId || !recipientEmail) {
        return response.status(400).json({
          success: false,
          message: 'reservationId and recipientEmail are required',
        })
      }

      const validLanguages = ['en', 'fr']
      if (!validLanguages.includes(language)) {
        return response.status(400).json({
          success: false,
          message: `Invalid language. Supported: ${validLanguages.join(', ')}`,
        })
      }

      const { default: ReservationSendEmailService } = await import('#services/reservation_send_email_service')

      await ReservationSendEmailService.sendInvoice({
        reservationId: Number(reservationId),
        folioId: folioId ? Number(folioId) : null,
        recipientEmail,
        language,
        sentBy: auth.user?.id,
      })

      return response.ok({ success: true, message: 'Invoice sent by email' })
    } catch (error) {
      console.error('Error sending invoice by email:', error)
      return response.status(500).json({
        success: false,
        message: 'Failed to send invoice by email',
        error: error.message,
      })
    }
  }

  // async sendVoucherByEmail({ request, response, auth }: HttpContext) {
  //   try {
  //     const reservationId  = request.input('reservationId')
  //     const language       = request.input('language', 'en')
  //     const recipientEmail = request.input('recipientEmail')

  //     if (!reservationId || !recipientEmail) {
  //       return response.status(400).json({
  //         success: false,
  //         message: 'reservationId and recipientEmail are required',
  //       })
  //     }

  //     const validLanguages = ['en', 'fr']
  //     if (!validLanguages.includes(language)) {
  //       return response.status(400).json({
  //         success: false,
  //         message: `Invalid language. Supported: ${validLanguages.join(', ')}`,
  //       })
  //     }

  //     const { default: ReservationSendEmailService } = await import('#services/reservation_send_email_service')

  //     await ReservationSendEmailService.sendVoucher({
  //       reservationId: Number(reservationId),
  //       recipientEmail,
  //       language,
  //       sentBy: auth.user?.id,
  //     })

  //     return response.ok({ success: true, message: 'Voucher sent by email' })
  //   } catch (error) {
  //     console.error('Error sending voucher by email:', error)
  //     return response.status(500).json({
  //       success: false,
  //       message: 'Failed to send voucher by email',
  //       error: error.message,
  //     })
  //   }
  // }
  async sendVoucherByEmail({ request, response, auth }: HttpContext) {
    try {
      const reservationId = request.input('reservationId')
      const language = request.input('language', 'en')
      const recipientEmail = request.input('recipientEmail')

      console.log('[sendVoucherByEmail] Inputs:', { reservationId, language, recipientEmail })

      if (!reservationId || !recipientEmail) {
        console.log('[sendVoucherByEmail] Missing required fields')
        return response.status(400).json({
          success: false,
          message: 'reservationId and recipientEmail are required',
        })
      }

      const validLanguages = ['en', 'fr']
      if (!validLanguages.includes(language)) {
        console.log('[sendVoucherByEmail] Invalid language:', language)
        return response.status(400).json({
          success: false,
          message: `Invalid language. Supported: ${validLanguages.join(', ')}`,
        })
      }

      console.log('[sendVoucherByEmail] Loading ReservationSendEmailService...')
      const { default: ReservationSendEmailService } = await import('#services/reservation_send_email_service')

      console.log('[sendVoucherByEmail] Calling sendVoucher...')
      await ReservationSendEmailService.sendVoucher({
        reservationId: Number(reservationId),
        recipientEmail,
        language,
        sentBy: auth.user?.id,
      })

      console.log('[sendVoucherByEmail] Email sent successfully to:', recipientEmail)
      return response.ok({ success: true, message: 'Voucher sent by email' })

    } catch (error) {
      console.error('[sendVoucherByEmail] Error:', error)
      console.error('[sendVoucherByEmail] Stack:', error.stack)
      return response.status(500).json({
        success: false,
        message: 'Failed to send voucher by email',
        error: error.message,
      })
    }
  }

  async sendInvoiceByWhatsapp({ request, response, auth }: HttpContext) {
    try {
      const reservationId = request.input('reservationId')
      const folioId = request.input('folioId', null)
      const language = request.input('language', 'en')
      const recipientPhone = request.input('recipientPhone')

      if (!reservationId) {
        return response.status(400).json({ success: false, message: 'reservationId is required' })
      }

      const { default: ReservationSendWhatsappService } = await import('#services/reservation_send_whatsapp_service')

      await ReservationSendWhatsappService.sendInvoice({
        reservationId: Number(reservationId),
        folioId: folioId ? Number(folioId) : null,
        recipientPhone,
        language,
      })

      return response.ok({ success: true, message: 'Invoice sent by WhatsApp' })
    } catch (error) {
      console.error('[sendInvoiceByWhatsapp] Error:', error)
      return response.status(500).json({ success: false, message: error.message })
    }
  }

  async sendVoucherByWhatsapp({ request, response }: HttpContext) {
    try {
      const reservationId = request.input('reservationId')
      const language = request.input('language', 'en')
      const recipientPhone = request.input('recipientPhone', null)

      if (!reservationId) {
        return response.status(400).json({ success: false, message: 'reservationId is required' })
      }

      const { default: ReservationSendWhatsappService } = await import('#services/reservation_send_whatsapp_service')

      await ReservationSendWhatsappService.sendVoucher({
        reservationId: Number(reservationId),
        recipientPhone,
        language,
      })

      return response.ok({ success: true, message: 'Voucher sent by WhatsApp' })
    } catch (error) {
      console.error('[sendVoucherByWhatsapp] Error:', error)
      return response.status(500).json({ success: false, message: error.message })
    }
  }

}
