import Reservation from '#models/reservation'
import FolioPrintService from '#services/folio_print_service'
import PdfGenerationService from '#services/pdf_generation_service'
import WhatsAppNotificationService from '#services/whatsapp_notification_service'
import { DateTime } from 'luxon'
import DocumentAuditService from '#services/document_audit_service'

export default class ReservationSendWhatsappService {

  private static async savePdfToTemp(buffer: Buffer, filename: string): Promise<string> {
    const { default: DocumentTokenService } = await import('#services/document_token_service')
    return DocumentTokenService.store(buffer, filename, 60 * 24)
  }

  // ── Envoyer la facture par WhatsApp 
  static async sendInvoice(input: {
    reservationId: number
    folioId?: number | null
    recipientPhone?: string | null
    language?: 'fr' | 'en'
  }): Promise<void> {
    const { reservationId, folioId, language = 'fr' } = input

    const reservation = await Reservation.query()
      .where('id', reservationId)
      .preload('hotel')
      .preload('guest')
      .firstOrFail()

    const guest = reservation.guest
    const phone = input.recipientPhone
      || guest?.phoneSecondary
      || guest?.phonePrimary
      || null

    if (!phone) throw new Error('No phone number available')

    const document = await this.createInvoiceDocument({
      reservationId,
      reservationNumber: reservation.reservationNumber ?? '',
      folioId: folioId ?? null,
      language,
    })

    const whatsapp = new WhatsAppNotificationService()
    const delivery = { pdf: document.pdf, hotelId: reservation.hotelId, reservationId,
      folioId, channel: 'whatsapp' as const, recipient: phone }
    await DocumentAuditService.recordDelivery({ ...delivery, status: 'attempted' })
    let result
    try {
      result = await whatsapp.notifyInvoiceReady({
        hotelId: reservation.hotelId,
        reservationId: reservation.id,
        recipientPhoneNumber: phone,
        recipientName: guest?.displayName ?? 'Client',
        hotelName: reservation.hotel?.hotelName ?? '',
        reservationNumber: reservation.reservationNumber ?? '',
        invoiceUrl: document.url,
      })
    } catch (error) {
      await DocumentAuditService.recordDelivery({ ...delivery, status: 'failed', error: error.message })
      throw error
    }
    await DocumentAuditService.recordDelivery({ ...delivery,
      status: result.delivered ? 'accepted' : 'failed',
      error: result.delivered ? undefined : String(result.reason ?? 'provider rejected request'),
    })
    if (!result.delivered) throw new Error(String(result.reason ?? 'WhatsApp invoice send failed'))
  }

  // ── Envoyer le voucher par WhatsApp 
  static async sendVoucher(input: {
    reservationId: number
    recipientPhone?: string | null
    language?: 'fr' | 'en'
  }): Promise<void> {
    const { reservationId, language = 'fr' } = input

    const reservation = await Reservation.query()
      .where('id', reservationId)
      .preload('hotel')
      .preload('guest')
      .firstOrFail()

    const guest = reservation.guest
    const phone = input.recipientPhone
      || guest?.phoneSecondary
      || guest?.phonePrimary
      || null

    if (!phone) throw new Error('No phone number available')

    const voucherUrl = await this.generateVoucherUrl({
      reservationId,
      reservationNumber: reservation.reservationNumber ?? '',
      language,
    })

    const checkInDate = reservation.arrivedDate
      ? DateTime.fromJSDate(new Date(reservation.arrivedDate.toJSDate())).toFormat('dd MMM yyyy')
      : '—'
    const checkOutDate = reservation.departDate
      ? DateTime.fromJSDate(new Date(reservation.departDate.toJSDate())).toFormat('dd MMM yyyy')
      : '—'

    const whatsapp = new WhatsAppNotificationService()
    await whatsapp.notifyVoucherReady({
      hotelId: reservation.hotelId,
      reservationId: reservation.id,
      recipientPhoneNumber: phone,
      recipientName: guest?.displayName ?? 'Client',
      hotelName: reservation.hotel?.hotelName ?? '',
      reservationNumber: reservation.reservationNumber ?? '',
      checkInDate,
      checkOutDate,
      voucherUrl,
    })
  }

  // ── Générer URL voucher 
  static async generateVoucherUrl(input: {
    reservationId: number
    reservationNumber: string
    language?: 'fr' | 'en'
  }): Promise<string> {
    const { language = 'fr' } = input
    const bookingPrintData = await FolioPrintService.generateBookingPrintData(input.reservationId)

    let pdfBuffer: Buffer
    if (language === 'fr') {
      pdfBuffer = await PdfGenerationService.generateBookingPdfFrench(bookingPrintData as any)
    } else {
      pdfBuffer = await PdfGenerationService.generateBookingPdf(bookingPrintData as any)
    }

    const filename = `voucher-${input.reservationNumber}-${DateTime.now().toFormat('yyyyMMddHHmmss')}.pdf`
    return this.savePdfToTemp(pdfBuffer, filename)
  }

  // ── Générer URL facture 
  static async generateInvoiceUrl(input: {
    reservationId: number
    reservationNumber: string
    folioId?: number | null
    language?: 'fr' | 'en'
  }): Promise<string> {
    return (await this.createInvoiceDocument(input)).url
  }

  private static async createInvoiceDocument(input: {
    reservationId: number
    reservationNumber: string
    folioId?: number | null
    language?: 'fr' | 'en'
  }): Promise<{ url: string; pdf: Buffer }> {
    const { language = 'fr' } = input
    const folioPrintData = await FolioPrintService.generateHotelFolioPrintData(
      input.reservationId,
      input.folioId ?? null
    )

    let pdfBuffer: Buffer
    const useDetailed =
      String((folioPrintData.hotel as any)?.invoiceTemplate || 'standard').toLowerCase() !== 'standard'
    if (useDetailed) {
      pdfBuffer = language === 'fr'
        ? await PdfGenerationService.generateDetailedHotelPdfFrench(folioPrintData)
        : await PdfGenerationService.generateDetailedHotelPdf(folioPrintData)
    } else if (language === 'fr') {
      pdfBuffer = await PdfGenerationService.generateSuitaHotelPdfFrench(folioPrintData)
    } else {
      pdfBuffer = await PdfGenerationService.generateSuitaHotelPdf(folioPrintData)
    }

    const filename = `invoice-${input.reservationNumber}-${DateTime.now().toFormat('yyyyMMddHHmmss')}.pdf`
    return { url: await this.savePdfToTemp(pdfBuffer, filename), pdf: pdfBuffer }
  }
}
