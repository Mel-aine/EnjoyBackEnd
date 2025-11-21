import Reservation from '#models/reservation'
import Hotel from '#models/hotel'
import EmailTemplateService from '#services/email_template_service'
import MailService from '#services/mail_service'
import LoggerService from '#services/logger_service'
import FolioPrintService from '#services/folio_print_service'
import PdfGenerationService from '#services/pdf_generation_service'

type PrintEmailSettings = {
  emailThanksAtCheckout?: boolean
  checkoutThanksTemplate?: number
  attachFolioWithThanksEmail?: boolean
}

export default class ReservationEmailService {
  /**
   * Send a "thank you" email on checkout if hotel settings allow it.
   * - Uses `hotel.printEmailSettings.emailThanksAtCheckout`
   * - Loads template by `checkoutThanksTemplate`
   * - Optionally attaches folio invoice PDFs (`attachFolioWithThanksEmail`)
   */
  static async sendCheckoutThanks(
    reservationId: number,
    folioIds: number[] = [],
    processedBy?: number
  ): Promise<void> {
    try {
      // Load reservation, hotel, and guest
      const reservation = await Reservation.query()
        .where('id', reservationId)
        .preload('hotel')
        .preload('guest')
        .firstOrFail()

      const hotel: Hotel = reservation.hotel!
      const guest = reservation.guest

      // Resolve print/email settings
      const rawSettings: any = hotel.printEmailSettings || {}
      const settings: PrintEmailSettings = {
        emailThanksAtCheckout: Boolean((rawSettings as any)?.emailThanksAtCheckout),
        checkoutThanksTemplate: (rawSettings as any)?.checkoutThanksTemplate,
        attachFolioWithThanksEmail: Boolean((rawSettings as any)?.attachFolioWithThanksEmail),
      }

      // Eligibility checks
      const recipientEmail = guest?.email || guest?.emailSecondary || null
      if (!settings.emailThanksAtCheckout) {
        await LoggerService.log({
          actorId: processedBy || reservation.checkedOutBy || reservation.createdBy || 0,
          action: 'EMAIL_SKIPPED',
          entityType: 'Reservation',
          entityId: reservation.id,
          hotelId: hotel.id,
          description: 'Checkout thank-you email skipped: disabled by hotel settings',
          meta: { reason: 'disabled_by_settings' },
        })
        return
      }
      if (!recipientEmail) {
        await LoggerService.log({
          actorId: processedBy || reservation.checkedOutBy || reservation.createdBy || 0,
          action: 'EMAIL_SKIPPED',
          entityType: 'Reservation',
          entityId: reservation.id,
          hotelId: hotel.id,
          description: 'Checkout thank-you email skipped: no recipient email on guest',
          meta: { reason: 'no_recipient_email' },
        })
        return
      }
      if (!settings.checkoutThanksTemplate) {
        await LoggerService.log({
          actorId: processedBy || reservation.checkedOutBy || reservation.createdBy || 0,
          action: 'EMAIL_SKIPPED',
          entityType: 'Reservation',
          entityId: reservation.id,
          hotelId: hotel.id,
          description: 'Checkout thank-you email skipped: missing checkoutThanksTemplate in hotel settings',
          meta: { reason: 'missing_template_setting' },
        })
        return
      }

      // Load template
      const templateService = new EmailTemplateService()
      const template = await templateService.getById(settings.checkoutThanksTemplate, hotel.id)

      const subject = template.subject 
      const html = template.messageBody

      // Resolve sender from hotel's email account on template
      const from = (template as any).emailAccount
        ? { address: (template as any).emailAccount.emailAddress, name: (template as any).emailAccount.displayName }
        : (hotel.email ? hotel.email : undefined)

      // Build attachments if requested
      const attachments: { filename: string; content: Buffer; contentType?: string }[] = []
      if (settings.attachFolioWithThanksEmail && folioIds.length > 0) {
        for (const folioId of folioIds) {
          try {
            const folioPrintData = await FolioPrintService.generateFolioPrintData(
              folioId,
              reservationId
            )
            const pdfBuffer = await PdfGenerationService.generateFolioPdf(folioPrintData)
            const filename = `Folio_${folioPrintData.folio.folioNumber || folioId}.pdf`
            attachments.push({ filename, content: pdfBuffer, contentType: 'application/pdf' })
          } catch (err: any) {
            await LoggerService.log({
              actorId: processedBy || reservation.checkedOutBy || reservation.createdBy,
              action: 'EMAIL_ATTACHMENT_ERROR',
              entityType: 'Reservation',
              entityId: reservation.id,
              hotelId: hotel.id,
              description: 'Failed generating folio PDF for checkout thanks email',
              meta: { reservationId, folioId, error: err?.message },
            })
          }
        }
      }

      // Send the email
      await MailService.sendWithAttachments({
        to: recipientEmail,
        from,
        subject,
        html,
        cc: Array.isArray((template as any).cc) ? (template as any).cc : [],
        bcc: Array.isArray((template as any).bcc) ? (template as any).bcc : [],
        attachments,
      })

      await LoggerService.log({
        actorId: processedBy || reservation.checkedOutBy || reservation.createdBy || 0,
        action: 'EMAIL_SENT',
        entityType: 'Reservation',
        entityId: reservation.id,
        hotelId: hotel.id,
        description: 'Checkout thank-you email sent',
        meta: {
          reservationId,
          recipientEmail,
          templateId: template.id,
          attachments: attachments.map((a) => a.filename),
        },
      })
    } catch (error: any) {
      await LoggerService.log({
        actorId: processedBy!,
        action: 'EMAIL_FAILED',
        entityType: 'Reservation',
        entityId: reservationId,
        description: 'Failed to send checkout thank-you email',
        meta: { reservationId, error: error?.message },
      })
    }
  }
}