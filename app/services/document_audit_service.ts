import { createHash } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import htmlPdf from 'html-pdf-node'
import { getAuditContext, redactAuditValue } from '#services/audit_context'
import { auditEnabled } from '#services/audit_enabled'
import { numberedPdfOptions, printNumber } from '#services/print_layout'
import type { PrintMetadata } from '#services/print_layout'
import { auditInstant, PRINT_TIME_PLACEHOLDER } from '#services/audit_clock'

/** Single generation boundary for every PDF in the application. */
export default class DocumentAuditService {
  static async generate(
    file: { content: string },
    options: Record<string, any>,
    metadata: PrintMetadata = {}
  ) {
    if (!auditEnabled()) return Buffer.from(await htmlPdf.generatePdf(file, options))
    const context = getAuditContext()
    const input: any = redactAuditValue(metadata.data ?? {})
    const allocation = await db.rawQuery(
      "SELECT nextval(pg_get_serial_sequence('public.document_prints','id'))::text AS id, clock_timestamp() AS generated_at"
    )
    const id = allocation.rows[0].id as string
    const number = printNumber(id)
    if (!allocation.rows[0].generated_at) throw new Error('Missing database generation timestamp')
    const generatedAt = auditInstant(
      allocation.rows[0].generated_at,
      metadata.timeZone ?? input.hotel?.timezone ?? 'Africa/Douala'
    )
    const pdfOptions = numberedPdfOptions(options, number, generatedAt)
    const renderedFile = {
      content: file.content.replaceAll(PRINT_TIME_PLACEHOLDER, generatedAt.label),
    }
    const hotelId =
      metadata.hotelId ??
      (Number(
        input.hotel?.id ??
          input.hotelDetails?.id ??
          input.hotelDetails?.hotelId ??
          input.hotelId ??
          input.hotel_id
      ) ||
        null) ??
      context?.hotelId ??
      null
    const reservationId =
      metadata.reservationId ??
      (Number(
        input.reservation?.id ??
          input.folio?.reservationId ??
          input.folio?.reservation_id ??
          input.transaction?.reservationId ??
          input.transaction?.reservation_id
      ) ||
        null)
    const folioId =
      metadata.folioId ??
      (Number(input.folio?.id ?? input.transaction?.folioId ?? input.transaction?.folio_id) || null)
    const reference =
      metadata.reference ??
      (input.folio?.folioNumber
        ? { type: 'folio', id: folioId, number: input.folio.folioNumber }
        : input.invoiceNumber
          ? { type: 'invoice', id: input.id, number: input.invoiceNumber }
          : input.receiptNumber
            ? { type: 'receipt', id: input.id, number: input.receiptNumber }
            : input.reservation
              ? {
                  type: 'reservation',
                  id: reservationId,
                  number: input.reservation.reservationNumber ?? input.reservation.confirmationCode,
                }
              : { type: metadata.documentType ?? 'report', number: context?.path ?? 'system' })
    // Copy before rendering: html-pdf-node mutates its options argument.
    const data = redactAuditValue({
      input,
      html: renderedFile.content,
      options: pdfOptions,
      generatedAt,
      clockSource: 'postgresql',
    })
    let pdf: Buffer
    try {
      pdf = Buffer.from(await htmlPdf.generatePdf(renderedFile, { ...pdfOptions }))
    } catch (error) {
      await db.table('activity_logs').insert({
        user_id: context?.actorId ?? null,
        username: context?.actorName ?? 'System',
        hotel_id: hotelId,
        reservation_id: reservationId,
        action: 'DOCUMENT_GENERATION_FAILED',
        entity_type: 'DocumentPrint',
        entity_id: id,
        description: `PDF generation failed: ${number}`,
        meta: JSON.stringify({ ...context, printNumber: number, reference, error: error.message }),
      })
      throw error
    }
    const sha256 = createHash('sha256').update(pdf).digest('hex')
    await db.transaction(async (trx) => {
      await trx.table('document_prints').insert({
        id,
        print_number: number,
        reference: JSON.stringify(reference),
        hotel_id: hotelId,
        reservation_id: reservationId,
        folio_id: folioId,
        document_type: metadata.documentType ?? reference.type,
        template: metadata.template ?? 'html',
        language: metadata.language ?? 'unspecified',
        sha256,
        pdf_data: pdf,
        data: JSON.stringify(data),
        operation_id: context?.operationId ?? null,
        user_id: context?.actorId ?? null,
        created_at: generatedAt.utc,
      })
      await trx.table('activity_logs').insert({
        user_id: context?.actorId ?? null,
        username: context?.actorName ?? 'System',
        created_by: context?.actorId ?? null,
        hotel_id: hotelId,
        reservation_id: reservationId,
        action: 'DOCUMENT_GENERATED',
        entity_type: 'DocumentPrint',
        entity_id: id,
        description: `PDF ${number} generated and archived`,
        meta: JSON.stringify({
          ...context,
          documentPrintId: id,
          printNumber: number,
          sha256,
          reference,
          folioId,
          totals: input.totals,
          currency: input.currency,
          generatedAt,
        }),
        ip_address: context?.ipAddress ?? null,
        user_agent: context?.userAgent ?? null,
      })
    })
    return pdf
  }

  static async recordDelivery(input: {
    pdf: Buffer
    hotelId: number
    reservationId: number
    folioId?: number | null
    channel: 'email' | 'whatsapp'
    recipient: string
    status: 'attempted' | 'accepted' | 'failed'
    actorId?: number
    error?: string
  }) {
    if (!auditEnabled()) return
    const sha256 = createHash('sha256').update(input.pdf).digest('hex')
    const context = getAuditContext()
    const print = await db
      .from('document_prints')
      .where('sha256', sha256)
      .where('hotel_id', input.hotelId)
      .orderBy('created_at', 'desc')
      .first()
    if (!print) throw new Error('Cannot send an invoice without an archived print record')
    await db.table('activity_logs').insert({
      hotel_id: input.hotelId,
      reservation_id: input.reservationId,
      user_id: context?.actorId ?? input.actorId ?? null,
      created_by: context?.actorId ?? input.actorId ?? null,
      username: context?.actorName ?? 'System',
      action: `DOCUMENT_SEND_${input.status.toUpperCase()}`,
      entity_type: 'Reservation',
      entity_id: input.reservationId,
      description: `Invoice ${input.channel} send ${input.status}`,
      meta: JSON.stringify({
        ...context,
        documentPrintId: print.id,
        printNumber: print.print_number,
        sha256,
        channel: input.channel,
        recipient: input.recipient,
        folioId: input.folioId,
        error: input.error,
      }),
    })
  }
}
