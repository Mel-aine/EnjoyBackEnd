import Reservation from '#models/reservation'
import Hotel from '#models/hotel'
import MailService from '#services/mail_service'
import FolioPrintService from '#services/folio_print_service'
import PdfGenerationService from '#services/pdf_generation_service'
import LoggerService from '#services/logger_service'

export default class ReservationSendEmailService {

  // ── Envoyer la facture (invoice) par email 
  static async sendInvoice(input: {
    reservationId: number
    folioId?: number | null
    recipientEmail: string
    language?: 'fr' | 'en'
    sentBy?: number
  }): Promise<void> {
    const { reservationId, folioId, recipientEmail, language = 'en', sentBy } = input

    const reservation = await Reservation.query()
      .where('id', reservationId)
      .preload('hotel')
      .preload('guest')
      .firstOrFail()

    const hotel: Hotel = reservation.hotel!

    // Générer les données du folio
    const folioPrintData = await FolioPrintService.generateHotelFolioPrintData(
      reservationId,
      folioId ?? null
    )

    // Générer le PDF (modèle standard ou détaillé selon la configuration de l'hôtel)
    let pdfBuffer: Buffer
    const useDetailed = hotel.invoiceTemplate === 'detailed'
    if (useDetailed) {
      pdfBuffer = language === 'fr'
        ? await PdfGenerationService.generateDetailedHotelPdfFrench(folioPrintData)
        : await PdfGenerationService.generateDetailedHotelPdf(folioPrintData)
    } else if (language === 'fr') {
      pdfBuffer = await PdfGenerationService.generateSuitaHotelPdfFrench(folioPrintData)
    } else {
      pdfBuffer = await PdfGenerationService.generateSuitaHotelPdf(folioPrintData)
    }

    const folioNumber = folioPrintData.folio?.folioNumber || folioId || 'invoice'
    const filename = `invoice-${folioNumber}.pdf`

    const fromAddress = process.env.MAIL_FROM_ADDRESS || hotel.email || process.env.SMTP_USERNAME

    const from: any = {
    address: fromAddress,
    name: hotel.hotelName,
    }

    await MailService.sendWithAttachments({
      to: recipientEmail,
      from,
      subject: `Your Invoice – ${reservation.reservationNumber}`,
      html: `
        <p>Dear ${reservation.guest?.displayName ?? 'Guest'},</p>
        <p>Please find attached your invoice for reservation <strong>${reservation.reservationNumber}</strong>.</p>
        <p>Thank you for staying with us at <strong>${hotel.hotelName}</strong>.</p>
        <p>Best regards,<br/>${hotel.hotelName}</p>
      `,
      attachments: [{ filename, content: pdfBuffer, contentType: 'application/pdf' }],
    })

    await LoggerService.log({
      actorId: sentBy || reservation.createdBy || 0,
      action: 'EMAIL_SENT',
      entityType: 'Reservation',
      entityId: reservation.id,
      hotelId: hotel.id,
      description: 'Invoice sent by email',
      meta: { reservationId, folioId, recipientEmail, filename },
    })
  }

  // ── Envoyer le voucher (confirmation) par email 
 static async sendVoucher(input: {
  reservationId: number
  recipientEmail: string
  language?: 'fr' | 'en'
  sentBy?: number
}): Promise<void> {
  const { reservationId, recipientEmail, language = 'en', sentBy } = input

  const reservation = await Reservation.query()
    .where('id', reservationId)
    .preload('hotel')
    .preload('guest')
    .firstOrFail()

  const hotel: Hotel = reservation.hotel!

  const bookingPrintData = await FolioPrintService.generateBookingPrintData(reservationId)

  let pdfBuffer: Buffer
  if (language === 'fr') {
    pdfBuffer = await PdfGenerationService.generateBookingPdfFrench(bookingPrintData as any)
  } else {
    pdfBuffer = await PdfGenerationService.generateBookingPdf(bookingPrintData as any)
  }

  const filename = `voucher-${reservation.reservationNumber}-${language}.pdf`

 const fromAddress = process.env.MAIL_FROM_ADDRESS || hotel.email || process.env.SMTP_USERNAME

    const from: any = {
    address: fromAddress,
    name: hotel.hotelName,
    }

  await MailService.sendWithAttachments({
    to: recipientEmail,
    from,
    subject: `Booking Confirmation – ${reservation.reservationNumber}`,
    html: `
      <p>Dear ${reservation.guest?.displayName ?? 'Guest'},</p>
      <p>Please find attached your booking confirmation for reservation <strong>${reservation.reservationNumber}</strong>.</p>
      <p>We look forward to welcoming you at <strong>${hotel.hotelName}</strong>.</p>
      <p>Best regards,<br/>${hotel.hotelName}</p>
    `,
    attachments: [{ filename, content: pdfBuffer, contentType: 'application/pdf' }],
  })

  await LoggerService.log({
    actorId: sentBy || reservation.createdBy || 0,
    action: 'EMAIL_SENT',
    entityType: 'Reservation',
    entityId: reservation.id,
    hotelId: hotel.id,
    description: 'Voucher sent by email',
    meta: { reservationId, recipientEmail, filename, language },
  })
}
}