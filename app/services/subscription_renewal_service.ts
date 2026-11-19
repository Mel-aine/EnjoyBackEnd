import InvoiceSubscription from '#models/invoice_subscription'
import Subscription from '#models/subscription'
import Hotel from '#models/hotel'
import EmailAccount from '#models/email_account'
import PdfGenerationService from '#services/pdf_generation_service'
import MailService from '#services/mail_service'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import { formatCurrency } from '#app/utils/utilities'
import env from '#start/env'

type Renewal = {
  id: number
  sub?: Subscription
  oldEnd: DateTime
  newEnd: DateTime
  price: number
  billingCycle: 'monthly' | 'yearly'
}

export default class SubscriptionRenewalService {
  private async resolveSubscriptionEmailRecipient(hotelId: number, fallbackEmail?: string | null) {
    const defaultAccount = await EmailAccount.query()
      .where('hotel_id', hotelId)
      .orderBy('is_default', 'desc')
      .orderBy('is_active', 'desc')
      .first()

    if (defaultAccount?.emailAddress) {
      return { address: defaultAccount.emailAddress, name: defaultAccount.displayName || undefined }
    }

    if (fallbackEmail) return fallbackEmail
    return null
  }

  private async getLogoDataUri() {
    const path = await import('node:path')
    const { readFile } = await import('node:fs/promises')

    try {
      const logoBuffer = await readFile(path.join(process.cwd(), 'app', 'data', 'aron_logo.png'))
      return `data:image/png;base64,${logoBuffer.toString('base64')}`
    } catch {
      return ''
    }
  }

  private async buildInvoicePdfBuffer(invoice: InvoiceSubscription, printedBy: string) {
    await invoice.load('hotel')

    const rawLines = await this.getInvoiceLinesForPdf(invoice)

    const lines = rawLines.map((l) => ({
      description: l.description,
      qty: '1',
      unitPrice: formatCurrency(l.unitPrice),
      amount: formatCurrency(l.unitPrice),
      periodStart: l.periodStart,
      periodEnd: l.periodEnd,
    }))

    const subtotalAmount = rawLines.reduce((sum, l) => sum + Number(l.unitPrice || 0), 0)
    const totalAmount = Number(invoice.totalAmount || 0)
    const amountDue = invoice.status === 'paid' ? 0 : totalAmount

    const periodStartLabel = invoice.periodStart ? invoice.periodStart.setLocale('en').toFormat('LLL dd, yyyy') : ''
    const periodEndLabel = invoice.periodEnd ? invoice.periodEnd.setLocale('en').toFormat('LLL dd, yyyy') : ''

    const invoiceData = {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      billingDate: invoice.billingDate ? invoice.billingDate.setLocale('en').toFormat('LLL dd, yyyy') : '',
      periodStart: periodStartLabel,
      periodEnd: periodEndLabel,
      status: invoice.status,
      totalAmount: formatCurrency(totalAmount),
      subtotalAmount: formatCurrency(subtotalAmount),
      amountDue: formatCurrency(amountDue),
      currency: invoice.currency,
      paidAt: invoice.paidAt ? invoice.paidAt.setLocale('en').toFormat('LLL dd, yyyy') : '',
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

    return PdfGenerationService.generatePdfFromHtml(html, {
      format: 'A4',
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
    }, { data: invoiceData, template: 'buildInvoicePdfBuffer', hotelId: invoice.hotelId })
  }

  private async getInvoiceLinesForPdf(invoice: InvoiceSubscription) {
    const fallbackFromDb = async () => {
      const items = await db
        .from('invoice_subscription_items')
        .select(['subscription_id', 'line_amount', 'description', 'period_start', 'period_end'])
        .where('invoice_subscription_id', invoice.id)

      const subscriptionIds = items.map((r: any) => Number(r.subscription_id)).filter((v) => Number.isFinite(v))
      const subscriptions = subscriptionIds.length
        ? await Subscription.query().whereIn('id', subscriptionIds).preload('module').preload('addOn')
        : []

      const subscriptionById = new Map<number, any>(subscriptions.map((s) => [s.id, s]))

      return items.map((r: any) => {
        const sub = subscriptionById.get(Number(r.subscription_id))
        const moduleName = sub?.module?.name ?? 'Subscription'
        const addOnName = sub?.addOn?.name ? ` - ${sub.addOn.name}` : ''
        const extra = r.description ? ` / ${r.description}` : ''
        const unitPrice = Number(r.line_amount || 0)
        return {
          description: `${moduleName}${addOnName}${extra}`,
          unitPrice,
          periodStart: r.period_start,
          periodEnd: r.period_end,
        }
      })
    }

    try {
      const subs = await invoice
        .related('subscriptions')
        .query()
        .pivotColumns(['line_amount', 'description', 'period_start', 'period_end'])
        .preload('module')
        .preload('addOn')

      if (subs.length === 0) {
        return await fallbackFromDb()
      }

      return subs.map((sub: any) => {
        const periodStart = sub.$extras?.pivot_period_start
        const periodEnd = sub.$extras?.pivot_period_end
        const addOnName = sub?.addOn?.name ? ` - ${sub.addOn.name}` : ''
        const extra = sub.$extras?.pivot_description ? ` / ${sub.$extras.pivot_description}` : ''
        const unitPrice = Number(sub.$extras?.pivot_line_amount || 0)
        return {
          description: `${sub?.module?.name ?? 'Subscription'}${addOnName}${extra}`,
          unitPrice,
          periodStart,
          periodEnd,
        }
      })
    } catch {
      return await fallbackFromDb()
    }
  }

  private async sendInvoiceEmail(invoice: InvoiceSubscription) {
    await invoice.load('hotel')

    const to = await this.resolveSubscriptionEmailRecipient(invoice.hotelId, invoice.hotel?.email)
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

    invoice.isSent = true
    await invoice.save()
  }

  public async generateMonthlyInvoiceIfMissing(params: {
    hotelId: number
    month: string
    runAt?: DateTime
    sendEmail?: boolean
  }) {
    const hotelId = Number(params.hotelId)
    const runAt = params.runAt ?? DateTime.now()
    const sendEmail = params.sendEmail !== false
    const monthRaw = String(params.month || '').trim()

    const monthStart =
      DateTime.fromISO(`${monthRaw}-01`, { zone: 'utc' }).startOf('month') ||
      DateTime.invalid('invalid')

    if (!monthStart.isValid) {
      return { created: false, reason: `Invalid month: ${monthRaw}. Expected YYYY-MM.` as string }
    }

    const periodStart = monthStart.startOf('month')
    const periodEnd = monthStart.endOf('month')

    const existing = await db
      .from('invoice_subscriptions')
      .where('hotel_id', hotelId)
      .whereRaw('period_start::date = ?', [periodStart.toISODate()])
      .whereRaw('period_end::date = ?', [periodEnd.toISODate()])
      .first()

    if (existing) {
      return { created: false, reason: 'Invoice already exists for this period' as string }
    }

    const hotel = await Hotel.find(hotelId)
    if (!hotel) {
      return { created: false, reason: `Hotel not found: ${hotelId}` as string }
    }

    const subs = await Subscription.query()
      .where('hotel_id', hotelId)
      .whereIn('status', ['active', 'past_due'])
      .where('starts_at', '<=', periodEnd.toSQL()!)
      .where((q) => q.whereNull('ends_at').orWhere('ends_at', '>=', periodStart.toSQL()!))
      .preload('module')
      .preload('addOn')

    if (subs.length === 0) {
      return { created: false, reason: 'No subscriptions to bill for this period' as string }
    }

    const currency = (hotel as any)?.currencyCode ?? 'EUR'
    const autopUserId = env.get('AUTOPROCESS_USER_ID') ?? 1

    const invoiceNumber = `SUBINV-${periodStart.toFormat('yyyyLL')}-${hotelId}-${Math.floor(Math.random() * 100000)
      .toString()
      .padStart(5, '0')}`

    const totalAmount = subs.reduce((sum, s) => sum + Number(s.price || 0), 0)
    if (totalAmount <= 0) {
      return { created: false, reason: 'Total amount is 0; invoice not created' as string }
    }

    const created = await db.transaction(async (trx) => {
      const invoice = await InvoiceSubscription.create(
        {
          hotelId,
          invoiceNumber,
          totalAmount,
          currency,
          status: 'pending',
          billingDate: runAt,
          periodStart,
          periodEnd,
          paidAt: null,
          billingFrom: null,
          createdBy: autopUserId,
        },
        { client: trx }
      )

      await trx.table('invoice_subscription_items').insert(
        subs.map((s) => {
          const moduleName = (s as any)?.module?.name ?? 'Subscription'
          const cycleLabel = s.billingCycle === 'yearly' ? 'Yearly' : 'Monthly'
          return {
            invoice_subscription_id: invoice.id,
            subscription_id: s.id,
            line_amount: Number(s.price || 0),
            description: `${moduleName} (${cycleLabel})`,
            period_start: periodStart.toJSDate(),
            period_end: periodEnd.toJSDate(),
            created_at: runAt.toJSDate(),
            updated_at: runAt.toJSDate(),
          }
        })
      )

      return invoice
    })

    if (sendEmail) {
      try {
        await this.sendInvoiceEmail(created)
      } catch (error: any) {
        console.error('Backfill subscription invoice email failed:', error?.message ?? error)
      }
    }

    return { created: true, invoiceId: created.id, invoiceNumber: created.invoiceNumber as string }
  }

  public async runMonthlyRenewal(runAt: DateTime = DateTime.now(), hotelId?: number) {
    const now = runAt
    const todayEnd = now.endOf('day')

    const dueQuery = Subscription.query()
      .whereIn('status', ['active', 'past_due'])
      .whereNotNull('ends_at')
      .where('ends_at', '<=', todayEnd.toSQL()!)
      .preload('module')
      .preload('addOn')
      .preload('hotel')

    const hotelIdNumber = Number(hotelId)
    if (Number.isFinite(hotelIdNumber) && hotelIdNumber > 0) {
      dueQuery.where('hotel_id', hotelIdNumber)
    }

    const dueSubscriptions = await dueQuery

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
          .whereIn('status', ['active', 'past_due'])
          .whereNotNull('ends_at')
          .where('ends_at', '<=', todayEnd.toSQL()!)
          .forUpdate()

        const renewals = lockedRows
          .map((row: any): Renewal | null => {
            const endsAt =
              row.ends_at instanceof Date ? DateTime.fromJSDate(row.ends_at) : DateTime.fromISO(String(row.ends_at))
            if (!endsAt.isValid) return null

            const billingCycle: Renewal['billingCycle'] = row.billing_cycle === 'yearly' ? 'yearly' : 'monthly'
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
          .filter((v): v is Renewal => v !== null)

        if (renewals.length === 0) return null

        const totalAmount = renewals.reduce((sum, r) => sum + Number(r.price || 0), 0)
        if (totalAmount <= 0) return null

        const unpaidRow = await trx
          .from('invoice_subscriptions')
          .where('hotel_id', hotelId)
          .whereIn('status', ['pending', 'failed'])
          .count('* as total')
          .first()

        const unpaidCount = Number((unpaidRow as any)?.total ?? 0)
        if (Number.isFinite(unpaidCount) && unpaidCount >= 2) {
          for (const { id } of renewals) {
            await Subscription.query({ client: trx })
              .where('id', id)
              .update({
                payment_status: 'failed',
                status: 'past_due',
                updated_at: now.toJSDate(),
              } as any)
          }
          return null
        }

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
        try {
          await this.sendInvoiceEmail(created)
        } catch (error: any) {
          console.error('Subscription renewal invoice email failed:', error?.message ?? error)
        }
      }
    }

    return { processedHotels: subsByHotelId.size, createdInvoices }
  }
}

