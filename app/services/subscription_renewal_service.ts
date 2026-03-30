import InvoiceSubscription from '#models/invoice_subscription'
import Subscription from '#models/subscription'
import Hotel from '#models/hotel'
import PdfService from '#services/pdf_service'
import MailService from '#services/mail_service'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import { formatCurrency } from '#app/utils/utilities'
import env from '#start/env'

export default class SubscriptionRenewalService {
  private async getLogoDataUri() {
    const path = await import('node:path')
    const { readFile } = await import('node:fs/promises')

    try {
      const logoBuffer = await readFile(path.join(process.cwd(), 'app', 'data', 'LogoEnjoy.png'))
      return `data:image/png;base64,${logoBuffer.toString('base64')}`
    } catch {
      return ''
    }
  }

  private async buildInvoicePdfBuffer(invoice: InvoiceSubscription, printedBy: string) {
    await invoice.load('hotel')

    const subs = await invoice
      .related('subscriptions')
      .query()
      .pivotColumns(['line_amount', 'description', 'period_start', 'period_end'])
      .preload('module')
      .preload('addOn')

    const lines = subs.map((sub: any) => {
      const periodStart = sub.$extras?.pivot_period_start
      const periodEnd = sub.$extras?.pivot_period_end
      const addOnName = sub?.addOn?.name ? ` - ${sub.addOn.name}` : ''
      const extra = sub.$extras?.pivot_description ? ` / ${sub.$extras.pivot_description}` : ''
      const unitPrice = Number(sub.$extras?.pivot_line_amount || 0)
      return {
        description: `${sub?.module?.name ?? 'Subscription'}${addOnName}${extra}`,
        qty: '1',
        unitPrice: formatCurrency(unitPrice),
        amount: formatCurrency(unitPrice),
        periodStart,
        periodEnd,
      }
    })

    const subtotalAmount = subs.reduce((sum: number, s: any) => sum + Number(s.$extras?.pivot_line_amount || 0), 0)
    const totalAmount = Number(invoice.totalAmount || 0)
    const amountDue = invoice.status === 'paid' ? 0 : totalAmount

    const periodStartLabel = invoice.periodStart ? invoice.periodStart.toFormat('LLL d, yyyy') : ''
    const periodEndLabel = invoice.periodEnd ? invoice.periodEnd.minus({ days: 1 }).toFormat('LLL d, yyyy') : ''

    const invoiceData = {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      billingDate: invoice.billingDate?.toISODate() ?? '',
      periodStart: periodStartLabel,
      periodEnd: periodEndLabel,
      status: invoice.status,
      totalAmount: formatCurrency(totalAmount),
      subtotalAmount: formatCurrency(subtotalAmount),
      amountDue: formatCurrency(amountDue),
      currency: invoice.currency,
      paidAt: invoice.paidAt?.toISODate() ?? '',
      billingFrom: invoice.billingFrom ?? null,
    }

    const { default: edge } = await import('edge.js')
    const path = await import('node:path')
    edge.mount(path.join(process.cwd(), 'resources/views'))

    const html = await edge.render('reports/subscription_invoice', {
      invoice: invoiceData,
      hotel: invoice.hotel,
      lines,
      printedAt: DateTime.now().toFormat('yyyy-LL-dd HH:mm:ss'),
      printedBy,
      logoDataUri: await this.getLogoDataUri(),
    })

    return PdfService.generatePdfFromHtml(html, {
      format: 'A4',
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
    })
  }

  private async sendInvoiceEmail(invoice: InvoiceSubscription) {
    await invoice.load('hotel')

    const to = invoice.hotel?.email
    if (!to) return

    const invoicePdfBuffer = await this.buildInvoicePdfBuffer(invoice, 'System')
    const subject = `Your subscription invoice is ready (${invoice.invoiceNumber})`
    const html = `
      <div style="font-family: Arial, sans-serif; color: #111;">
        <p>Hello,</p>
        <p>Your subscription has been renewed and a new invoice has been generated.</p>
        <p>Please find the invoice attached.</p>
        <p>Invoice: <strong>${invoice.invoiceNumber}</strong></p>
        <p>Thank you,<br />Enjoy</p>
      </div>
    `

    await MailService.sendWithAttachments({
      to,
      subject,
      html,
      attachments: [
        { filename: `invoice-${invoice.invoiceNumber}.pdf`, content: invoicePdfBuffer, contentType: 'application/pdf' },
      ],
    })
  }

  public async runMonthlyRenewal(runAt: DateTime = DateTime.now()) {
    const now = runAt
    const todayEnd = now.endOf('day')

    const dueSubscriptions = await Subscription.query()
      .where('status', 'active')
      .whereNotNull('ends_at')
      .where('ends_at', '<=', todayEnd.toSQL()!)
      .preload('module')
      .preload('addOn')
      .preload('hotel')

    const subsByHotelId = new Map<number, Subscription[]>()
    for (const sub of dueSubscriptions) {
      const hotelId = Number(sub.hotelId)
      if (!subsByHotelId.has(hotelId)) subsByHotelId.set(hotelId, [])
      subsByHotelId.get(hotelId)!.push(sub)
    }

    const autopUserId = env.get('AUTOPROCESS_USER_ID') ?? 1

    const createdInvoices: InvoiceSubscription[] = []

    for (const [hotelId, subs] of subsByHotelId.entries()) {
      const hotel = subs[0]?.hotel ?? (await Hotel.find(hotelId))
      const currency = (hotel as any)?.currencyCode ?? 'EUR'

      const created = await db.transaction(async (trx) => {
        const preloadedById = new Map<number, Subscription>(subs.map((s) => [s.id, s]))

        const lockedRows = await trx
          .from('subscriptions')
          .select(['id', 'ends_at', 'billing_cycle', 'price'])
          .where('hotel_id', hotelId)
          .whereIn(
            'id',
            subs.map((s) => s.id)
          )
          .where('status', 'active')
          .whereNotNull('ends_at')
          .where('ends_at', '<=', todayEnd.toSQL()!)
          .forUpdate()

        const renewals = lockedRows
          .map((row: any) => {
            const endsAt = row.ends_at instanceof Date ? DateTime.fromJSDate(row.ends_at) : DateTime.fromISO(String(row.ends_at))
            if (!endsAt.isValid) return null

            const billingCycle = row.billing_cycle === 'yearly' ? 'yearly' : 'monthly'
            const oldEnd = endsAt
            const newEnd = billingCycle === 'yearly' ? oldEnd.plus({ years: 1 }) : oldEnd.plus({ months: 1 })
            const sub = preloadedById.get(Number(row.id))
            return {
              id: Number(row.id),
              sub,
              oldEnd,
              newEnd,
              price: Number(row.price || 0),
              billingCycle,
            }
          })
          .filter(
            (v): v is { id: number; sub?: Subscription; oldEnd: DateTime; newEnd: DateTime; price: number; billingCycle: 'monthly' | 'yearly' } =>
              Boolean(v)
          )

        if (renewals.length === 0) return null

        const totalAmount = renewals.reduce((sum, r) => sum + Number(r.price || 0), 0)
        if (totalAmount <= 0) return null

        const periodStart = renewals.reduce((min, r) => (r.oldEnd < min ? r.oldEnd : min), renewals[0].oldEnd)
        const periodEnd = renewals.reduce((max, r) => (r.newEnd > max ? r.newEnd : max), renewals[0].newEnd)

        const invoiceNumber = `SUBINV-${now.toFormat('yyyy')}-${now.toFormat('MMddHHmmss')}-${hotelId}-${Math.floor(
          Math.random() * 1000
        )
          .toString()
          .padStart(3, '0')}`

        const invoice = await InvoiceSubscription.create(
          {
            hotelId,
            invoiceNumber,
            totalAmount,
            currency,
            status: 'pending',
            billingDate: now,
            periodStart,
            periodEnd,
            paidAt: null,
            billingFrom: null,
            createdBy: autopUserId,
          },
          { client: trx }
        )

        await trx.table('invoice_subscription_items').insert(
          renewals.map(({ sub, oldEnd, newEnd, price, billingCycle, id }) => {
            const moduleName = (sub as any)?.module?.name ?? 'Subscription'
            const cycleLabel = billingCycle === 'yearly' ? 'Yearly' : 'Monthly'
            return {
              invoice_subscription_id: invoice.id,
              subscription_id: id,
              line_amount: Number(price || 0),
              description: `${moduleName} (${cycleLabel})`,
              period_start: oldEnd.toJSDate(),
              period_end: newEnd.toJSDate(),
              created_at: now.toJSDate(),
              updated_at: now.toJSDate(),
            }
          })
        )

        for (const { id, newEnd } of renewals) {
          await Subscription.query({ client: trx })
            .where('id', id)
            .update({
              ends_at: newEnd.toJSDate(),
              payment_status: 'pending',
              status: 'past_due',
              updated_at: now.toJSDate(),
            } as any)
        }

        return invoice
      })

      if (created) {
        await created.load('hotel')
        createdInvoices.push(created)
        await this.sendInvoiceEmail(created)
      }
    }

    return { processedHotels: subsByHotelId.size, createdInvoices }
  }
}

