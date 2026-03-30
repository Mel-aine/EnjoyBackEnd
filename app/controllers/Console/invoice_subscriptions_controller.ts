import type { HttpContext } from '@adonisjs/core/http'
import ActivityLog from '#models/activity_log'
import Hotel from '#models/hotel'
import InvoiceSubscription from '#models/invoice_subscription'
import InvoiceSubscriptionReceipt from '#models/invoice_subscription_receipt'
import InvoiceSubscriptionPayment from '#models/invoice_subscription_payment'
import Subscription from '#models/subscription'
import Module from '#models/module'
import AddOn from '#models/add_on'
import PdfService from '#services/pdf_service'
import { formatCurrency } from '#app/utils/utilities'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

export default class InvoiceSubscriptionsController {
  public async index({ params, request, response }: HttpContext) {
    const page = request.input('page', 1)
    const limit = request.input('limit', 10)
    const status = request.input('status')
    const search = request.input('search')

    const query = InvoiceSubscription.query().where('hotel_id', params.hotel_id).preload('hotel')

    if (status) query.where('status', status)
    if (search) {
      query.where((q) => {
        q.whereILike('invoice_number', `%${search}%`)
      })
    }

    const invoices = await query.orderBy('created_at', 'desc').paginate(page, limit)
    return response.ok(invoices)
  }

  public async billing({ request, response }: HttpContext) {
    const page = request.input('page', 1)
    const search = request.input('search', '')
    const status = request.input('status', '')
    const limit = request.input('limit', 10)

    const query = InvoiceSubscription.query().preload('hotel')

    if (search) {
      query.where((q) => {
        q.whereHas('hotel', (h) => h.whereILike('hotel_name', `%${search}%`)).orWhereILike(
          'invoice_number',
          `%${search}%`
        )
      })
    }

    if (status) query.where('status', status)

    const [invoices, totalRevenueRow, pendingRow, failedRow] = await Promise.all([
      query.orderBy('created_at', 'desc').paginate(page, limit),
      InvoiceSubscription.query().where('status', 'paid').sum('total_amount as total').first(),
      InvoiceSubscription.query()
        .where('status', 'pending')
        .sum('total_amount as total')
        .count('* as count')
        .first(),
      InvoiceSubscription.query().where('status', 'failed').sum('total_amount as total').first(),
    ])

    return response.ok({
      stats: {
        totalRevenue: Number(totalRevenueRow?.$extras?.total ?? 0),
        pendingAmount: Number(pendingRow?.$extras?.total ?? 0),
        pendingCount: Number(pendingRow?.$extras?.count ?? 0),
        overdueAmount: Number(failedRow?.$extras?.total ?? 0),
      },
      invoices: {
        data: invoices.all().map((inv) => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          hotelId: inv.hotelId,
          hotel: inv.hotel?.hotelName ?? 'Inconnu',
          amount: inv.totalAmount,
          currency: inv.currency,
          status: inv.status,
          billingDate: inv.billingDate?.toISODate() ?? null,
          periodStart: inv.periodStart?.toISODate() ?? null,
          periodEnd: inv.periodEnd?.toISODate() ?? null,
          paidAt: inv.paidAt?.toISO() ?? null,
          createdAt: inv.createdAt.toISO(),
        })),
        meta: invoices.getMeta(),
      },
    })
  }

  public async show({ params, response }: HttpContext) {
    const invoice = await InvoiceSubscription.query()
      .where('id', params.id)
      .preload('hotel')
      .preload('subscriptions')
      .first()

    if (!invoice) {
      return response.notFound({ success: false, message: 'Invoice subscription not found' })
    }

    return response.ok(invoice)
  }

  public async update({ params, request, response, auth }: HttpContext) {
    const invoice = await InvoiceSubscription.findOrFail(params.id)
    const oldState = invoice.serialize()

    const previousStatus = invoice.status
    const data = request.only(['status'])
    invoice.merge(data)

    if (data.status === 'paid' && !invoice.paidAt) {
      invoice.paidAt = DateTime.now()
    }
    await invoice.save()

    const user = auth.user!

    if (previousStatus !== 'paid' && invoice.status === 'paid') {
      const paymentDateRaw = request.input('paymentDate') ?? request.input('payment_date')
      const paymentDate = paymentDateRaw
        ? DateTime.fromISO(String(paymentDateRaw))
        : invoice.paidAt
          ? invoice.paidAt
          : DateTime.now()

      const amountRaw = request.input('amount')
      const amount = Number.isFinite(Number(amountRaw)) ? Number(amountRaw) : Number(invoice.totalAmount || 0)

      const paymentMethod = request.input('paymentMethod') ?? request.input('payment_method') ?? null
      const transactionReference =
        request.input('transactionReference') ?? request.input('transaction_reference') ?? null
      const notes = request.input('notes') ?? null

      const payment = await InvoiceSubscriptionPayment.create({
        invoiceSubscriptionId: invoice.id,
        hotelId: invoice.hotelId,
        amount,
        currency: invoice.currency,
        paymentDate: paymentDate.isValid ? paymentDate : DateTime.now(),
        paymentMethod,
        transactionReference,
        notes,
        createdBy: user.id,
      })

      const existingReceiptForPayment = await InvoiceSubscriptionReceipt.query()
        .where('invoice_subscription_payment_id', payment.id)
        .first()

      if (!existingReceiptForPayment) {
        const receiptNumber = `RCP-SUB-${DateTime.now().toFormat('yyyyMMdd')}-${DateTime.now().toFormat('HHmmss')}-${payment.id}`

        await InvoiceSubscriptionReceipt.create({
          receiptNumber,
          invoiceSubscriptionId: invoice.id,
          invoiceSubscriptionPaymentId: payment.id,
          hotelId: invoice.hotelId,
          amount: payment.amount,
          currency: payment.currency,
          paymentDate: payment.paymentDate,
          paymentMethod: payment.paymentMethod,
          transactionReference: payment.transactionReference,
          notes: payment.notes,
          createdBy: user.id,
        })
      }
    }

    await ActivityLog.create({
      userId: user.id,
      username: user.username || user.email,
      action: 'invoice_subscription.update',
      entityType: 'invoice_subscription',
      entityId: invoice.id,
      hotelId: invoice.hotelId,
      description: `Updated invoice subscription: ${invoice.invoiceNumber}`,
      changes: { before: oldState, after: invoice.serialize() },
      ipAddress: request.ip(),
      userAgent: request.header('user-agent'),
      createdBy: user.id,
    })

    return response.ok(invoice)
  }

  public async createPayment({ params, request, response, auth }: HttpContext) {
    const invoice = await InvoiceSubscription.query().where('id', params.id).first()
    if (!invoice) {
      return response.notFound({ success: false, message: 'Invoice subscription not found' })
    }

    const user = auth.user!
    const paymentDateRaw = request.input('paymentDate') ?? request.input('payment_date')
    const paymentDate = paymentDateRaw ? DateTime.fromISO(String(paymentDateRaw)) : DateTime.now()

    const amountRaw = request.input('amount')
    const amount = Number.isFinite(Number(amountRaw)) ? Number(amountRaw) : Number(invoice.totalAmount || 0)
    const currency = request.input('currency') ?? invoice.currency
    const paymentMethod = request.input('paymentMethod') ?? request.input('payment_method') ?? null
    const transactionReference = request.input('transactionReference') ?? request.input('transaction_reference') ?? null
    const notes = request.input('notes') ?? null

    const payment = await InvoiceSubscriptionPayment.create({
      invoiceSubscriptionId: invoice.id,
      hotelId: invoice.hotelId,
      amount,
      currency,
      paymentDate: paymentDate.isValid ? paymentDate : DateTime.now(),
      paymentMethod,
      transactionReference,
      notes,
      createdBy: user.id,
    })

    if (invoice.status !== 'paid') {
      invoice.status = 'paid'
      invoice.paidAt = payment.paymentDate
      await invoice.save()
    }

    const receiptNumber = `RCP-SUB-${DateTime.now().toFormat('yyyyMMdd')}-${DateTime.now().toFormat('HHmmss')}-${payment.id}`

    const receipt = await InvoiceSubscriptionReceipt.create({
      receiptNumber,
      invoiceSubscriptionId: invoice.id,
      invoiceSubscriptionPaymentId: payment.id,
      hotelId: invoice.hotelId,
      amount: payment.amount,
      currency: payment.currency,
      paymentDate: payment.paymentDate,
      paymentMethod: payment.paymentMethod,
      transactionReference: payment.transactionReference,
      notes: payment.notes,
      createdBy: user.id,
    })

    return response.created({ success: true, payment, receipt })
  }

  public async store({ params, request, response, auth }: HttpContext) {
    const hotel = await Hotel.findOrFail(params.hotel_id)
    const user = auth.user!

    const periodStartRaw = request.input('periodStart') ?? request.input('period_start')
    const periodEndRaw = request.input('periodEnd') ?? request.input('period_end')
    const subscriptionsToCreateRaw = request.input('subscriptions') ?? []
    const currency = request.input('currency') ?? hotel.currencyCode ?? 'EUR'
    const billingFromRaw = request.input('billing_from') ?? request.input('billingFrom')

    const periodStart = DateTime.fromISO(String(periodStartRaw || '')).startOf('day')
    const periodEnd = DateTime.fromISO(String(periodEndRaw || '')).startOf('day')
    const subscriptionsToCreate = Array.isArray(subscriptionsToCreateRaw) ? subscriptionsToCreateRaw : []

    if (!periodStart.isValid || !periodEnd.isValid) {
      return response.badRequest({ success: false, message: 'periodStart and periodEnd are required (YYYY-MM-DD)' })
    }
    if (periodStart >= periodEnd) {
      return response.badRequest({ success: false, message: 'periodStart must be before periodEnd' })
    }
    if (subscriptionsToCreate.length === 0) {
      return response.badRequest({ success: false, message: 'subscriptions is required' })
    }

    const now = DateTime.now()

    let subscriptions: Subscription[] = []
    let createdSubscriptionIds: number[] = []

    const batchModuleIds = subscriptionsToCreate
      .map((s: any) => Number(s.module_id ?? s.moduleId))
      .filter((v: any) => Number.isFinite(v))

    const pmsModule = await Module.findBy('slug', 'pms')
    const pmsInBatch = pmsModule ? batchModuleIds.includes(pmsModule.id) : false

    try {
      subscriptions = await db.transaction(async (trx) => {
        const created: Subscription[] = []

        for (const item of subscriptionsToCreate) {
          const moduleId = Number(item.module_id ?? item.moduleId)
          const addOnId = item.add_on_id ?? item.addOnId
          const billingCycle = String(item.billing_cycle ?? item.billingCycle ?? 'monthly')
          const price = Number(item.price ?? item.priceMonthly ?? item.amount ?? 0)
          const limitCount = item.limit_count ?? item.limitCount

          if (!Number.isFinite(moduleId)) {
            throw new Error('module_id is required for each subscription')
          }

          const module = await Module.findOrFail(moduleId)

          const existingSameSub = await Subscription.query({ client: trx })
            .where('hotel_id', hotel.id)
            .where('module_id', moduleId)
            .where('status', 'active')
            .where('ends_at', '>', now.toSQL()!)
            .first()

          if (existingSameSub) {
            throw new Error(`Duplicate active subscription for module_id=${moduleId}`)
          }

          if (module.slug === 'channel-manager') {
            const hasPms = await hotel.hasAccessTo('pms')
            if (!hasPms && !pmsInBatch) {
              throw new Error('DEPENDENCY_MISSING: PMS is required to purchase Channel Manager')
            }
          }

          if (module.isBundle && module.includedModulesJson) {
            const includedSlugs = module.includedModulesJson
            const existingSubs = await Subscription.query({ client: trx })
              .where('hotel_id', hotel.id)
              .where('status', 'active')
              .where('ends_at', '>', now.toSQL()!)
              .preload('module')

            for (const sub of existingSubs) {
              if (includedSlugs.includes(sub.module.slug)) {
                sub.status = 'canceled'
                sub.endsAt = now
                await sub.useTransaction(trx).save()
              }
            }
          } else {
            const hasAccess = await hotel.hasAccessTo(module.slug)
            if (hasAccess) {
              throw new Error(`DUPLICATE_SUBSCRIPTION: Hotel already has access to ${module.slug}`)
            }
          }

          let endsAt = now
          if (billingCycle === 'monthly') {
            endsAt = endsAt.plus({ months: 1 })
          } else {
            endsAt = endsAt.plus({ years: 1 })
          }

          let resolvedAddOnId: number | null = null
          if (addOnId !== undefined && addOnId !== null && addOnId !== '') {
            const addOn = await AddOn.findOrFail(Number(addOnId))
            if (addOn.moduleId !== Number(moduleId)) {
              throw new Error('INVALID_ADD_ON: Add-on does not belong to the selected module')
            }
            resolvedAddOnId = addOn.id
          }

          const createdSub = await Subscription.create(
            {
              hotelId: hotel.id,
              moduleId,
              addOnId: resolvedAddOnId,
              startsAt: now,
              endsAt,
              status: 'active',
              billingCycle: billingCycle === 'yearly' ? 'yearly' : 'monthly',
              price,
              paymentStatus: 'pending',
              limitCount: limitCount ?? null,
            },
            { client: trx }
          )

          created.push(createdSub)
        }

        return created
      })

      createdSubscriptionIds = subscriptions.map((s) => s.id)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return response.badRequest({ success: false, message })
    }

    const totalAmount = subscriptions.reduce((sum, s) => sum + Number(s.price || 0), 0)
    const isPaid = totalAmount <= 0

    const lastInvoice = await InvoiceSubscription.query().where('hotel_id', hotel.id).orderBy('id', 'desc').first()
    const nextId = (lastInvoice?.id ?? 0) + 1
    const invoiceNumber = `SUBINV-${DateTime.now().toFormat('yyyy')}-${String(nextId).padStart(4, '0')}`

    const invoice = await db.transaction(async (trx) => {
      let billingFrom: any | null = null
      if (billingFromRaw && typeof billingFromRaw === 'object') {
        billingFrom = billingFromRaw
      } else if (typeof billingFromRaw === 'string' && billingFromRaw.trim().length > 0) {
        try {
          billingFrom = JSON.parse(billingFromRaw)
        } catch {}
      }

      const created = await InvoiceSubscription.create(
        {
          hotelId: hotel.id,
          invoiceNumber,
          totalAmount,
          currency,
          status: isPaid ? 'paid' : 'pending',
          billingDate: now,
          periodStart,
          periodEnd,
          paidAt: isPaid ? now : null,
          billingFrom,
          createdBy: user.id,
        },
        { client: trx }
      )

      await trx.table('invoice_subscription_items').insert(
        subscriptions.map((s) => ({
          invoice_subscription_id: created.id,
          subscription_id: s.id,
          line_amount: Number(s.price || 0),
          description: `${s.module?.name ?? 'Subscription'} (${s.billingCycle === 'yearly' ? 'Yearly' : 'Monthly'})`,
          period_start: periodStart.toJSDate(),
          period_end: periodEnd.toJSDate(),
          created_at: now.toJSDate(),
          updated_at: now.toJSDate(),
        }))
      )

      return created
    })

    if (isPaid && createdSubscriptionIds.length > 0) {
      await Subscription.query().whereIn('id', createdSubscriptionIds).update({ paymentStatus: 'paid' })
    }

    await ActivityLog.create({
      userId: user.id,
      username: user.username || user.email,
      action: 'invoice_subscription.create',
      entityType: 'invoice_subscription',
      entityId: invoice.id,
      hotelId: hotel.id,
      description: `Created invoice subscription: ${invoice.invoiceNumber}`,
      changes: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        periodStart: periodStart.toISODate(),
        periodEnd: periodEnd.toISODate(),
        subscriptionIds: subscriptions.map((s) => s.id),
        createdSubscriptionIds,
      },
      ipAddress: request.ip(),
      userAgent: request.header('user-agent'),
      createdBy: user.id,
    })

    return response.created({ success: true, invoice })
  }

  public async printPdf({ params, response, auth }: HttpContext) {
    const invoice = await InvoiceSubscription.query().where('id', params.id).preload('hotel').first()
    if (!invoice) {
      return response.notFound({ success: false, message: 'Invoice subscription not found' })
    }

    const subs = await invoice
      .related('subscriptions')
      .query()
      .pivotColumns(['line_amount', 'description', 'period_start', 'period_end'])
      .preload('module')
      .preload('addOn')

    let lines: any[] = subs.map((sub: any) => {
      const periodStart = sub.$extras?.pivot_period_start
      const periodEnd = sub.$extras?.pivot_period_end
      return {
        moduleName: sub?.module?.name ?? 'Subscription',
        addOnName: sub?.addOn?.name ?? null,
        billingCycle: sub?.billingCycle ?? null,
        lineAmount: Number(sub.$extras?.pivot_line_amount || 0),
        description: sub.$extras?.pivot_description ?? null,
        periodStart: periodStart ? DateTime.fromJSDate(periodStart).toISODate() : null,
        periodEnd: periodEnd ? DateTime.fromJSDate(periodEnd).toISODate() : null,
      }
    })

    if (lines.length === 0) {
      const items = await db
        .from('invoice_subscription_items')
        .select(['subscription_id', 'line_amount', 'description', 'period_start', 'period_end'])
        .where('invoice_subscription_id', invoice.id)

      const subscriptionIds = items.map((r: any) => Number(r.subscription_id)).filter((v) => Number.isFinite(v))
      const subscriptions = subscriptionIds.length
        ? await Subscription.query().whereIn('id', subscriptionIds).preload('module').preload('addOn')
        : []

      const subscriptionById = new Map<number, any>(subscriptions.map((s) => [s.id, s]))
      lines = items.map((r: any) => {
        const sub = subscriptionById.get(Number(r.subscription_id))
        return {
          moduleName: sub?.module?.name ?? 'Subscription',
          addOnName: sub?.addOn?.name ?? null,
          billingCycle: sub?.billingCycle ?? null,
          lineAmount: Number(r.line_amount || 0),
          description: r.description ?? null,
          periodStart: null,
          periodEnd: null,
        }
      })
    }

    const { default: edge } = await import('edge.js')
    const path = await import('node:path')
    const { readFile } = await import('node:fs/promises')

    edge.mount(path.join(process.cwd(), 'resources/views'))

    let logoDataUri = ''
    try {
      const logoBuffer = await readFile(
        path.join(process.cwd(), 'app', 'data', 'LogoEnjoy.png')
      )
      logoDataUri = `data:image/png;base64,${logoBuffer.toString('base64')}`
    } catch {}

    const periodStartLabel = invoice.periodStart ? invoice.periodStart.toFormat('LLL d, yyyy') : ''
    const periodEndLabel = invoice.periodEnd ? invoice.periodEnd.minus({ days: 1 }).toFormat('LLL d, yyyy') : ''
    const subtotalAmount = lines.reduce((sum, l: any) => sum + Number(l.lineAmount || 0), 0)
    const totalAmount = Number(invoice.totalAmount || 0)
    const amountDue = invoice.status === 'paid' ? 0 : totalAmount

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

    let templateLines = lines.map((l: any) => {
      const addOnName = l.addOnName ? ` - ${l.addOnName}` : ''
      const extra = l.description ? ` / ${l.description}` : ''
      const unitPrice = Number(l.lineAmount || 0)
      return {
        description: `${l.moduleName}${addOnName}${extra}`,
        qty: '1',
        unitPrice: formatCurrency(unitPrice),
        amount: formatCurrency(unitPrice),
      }
    })
    if (templateLines.length === 0) {
      const unitPrice = Number(invoice.totalAmount || 0)
      templateLines = [
        { description: 'Subscription', qty: '1', unitPrice: formatCurrency(unitPrice), amount: formatCurrency(unitPrice) },
      ]
    }

    const printedAt = DateTime.now().toFormat('yyyy-LL-dd HH:mm:ss')
    const printedBy = auth.user?.username || auth.user?.email || 'System'

    const html = await edge.render('reports/subscription_invoice', {
      invoice: invoiceData,
      hotel: invoice.hotel,
      lines: templateLines,
      printedAt,
      printedBy,
      logoDataUri,
    })

    const pdfBuffer = await PdfService.generatePdfFromHtml(html, {
      format: 'A4',
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
    })

    response.header('Content-Type', 'application/pdf')
    response.header('Content-Disposition', `inline; filename="invoice-${invoice.invoiceNumber}.pdf"`)
    return response.send(pdfBuffer)
  }

  public async printReceiptPdf({ params, response, auth }: HttpContext) {
    const invoice = await InvoiceSubscription.query().where('id', params.id).preload('hotel').first()
    if (!invoice) {
      return response.notFound({ success: false, message: 'Invoice subscription not found' })
    }

    if (invoice.status !== 'paid') {
      return response.badRequest({ success: false, message: 'Receipt can only be generated for paid invoices' })
    }

    const user = auth.user!
    let receipt = await InvoiceSubscriptionReceipt.query()
      .where('invoice_subscription_id', invoice.id)
      .orderBy('created_at', 'desc')
      .first()

    if (!receipt) {
      let payment = await InvoiceSubscriptionPayment.query()
        .where('invoice_subscription_id', invoice.id)
        .orderBy('payment_date', 'desc')
        .first()

      if (!payment) {
        const paymentDate = invoice.paidAt ?? DateTime.now()
        payment = await InvoiceSubscriptionPayment.create({
          invoiceSubscriptionId: invoice.id,
          hotelId: invoice.hotelId,
          amount: Number(invoice.totalAmount || 0),
          currency: invoice.currency,
          paymentDate,
          paymentMethod: null,
          transactionReference: null,
          notes: null,
          createdBy: user.id,
        })
      }

      const receiptNumber = `RCP-SUB-${DateTime.now().toFormat('yyyyMMdd')}-${DateTime.now().toFormat('HHmmss')}-${payment.id}`

      receipt = await InvoiceSubscriptionReceipt.create({
        receiptNumber,
        invoiceSubscriptionId: invoice.id,
        invoiceSubscriptionPaymentId: payment.id,
        hotelId: invoice.hotelId,
        amount: payment.amount,
        currency: payment.currency,
        paymentDate: payment.paymentDate,
        paymentMethod: payment.paymentMethod,
        transactionReference: payment.transactionReference,
        notes: payment.notes,
        createdBy: user.id,
      })
    }

    const subs = await invoice
      .related('subscriptions')
      .query()
      .pivotColumns(['line_amount', 'description', 'period_start', 'period_end'])
      .preload('module')
      .preload('addOn')

    let lines: any[] = subs.map((sub: any) => {
      const periodStart = sub.$extras?.pivot_period_start
      const periodEnd = sub.$extras?.pivot_period_end
      return {
        moduleName: sub?.module?.name ?? 'Subscription',
        addOnName: sub?.addOn?.name ?? null,
        billingCycle: sub?.billingCycle ?? null,
        lineAmount: Number(sub.$extras?.pivot_line_amount || 0),
        description: sub.$extras?.pivot_description ?? null,
        periodStart: periodStart ? DateTime.fromJSDate(periodStart).toISODate() : null,
        periodEnd: periodEnd ? DateTime.fromJSDate(periodEnd).toISODate() : null,
      }
    })

    if (lines.length === 0) {
      const items = await db
        .from('invoice_subscription_items')
        .select(['subscription_id', 'line_amount', 'description', 'period_start', 'period_end'])
        .where('invoice_subscription_id', invoice.id)

      const subscriptionIds = items.map((r: any) => Number(r.subscription_id)).filter((v) => Number.isFinite(v))
      const subscriptions = subscriptionIds.length
        ? await Subscription.query().whereIn('id', subscriptionIds).preload('module').preload('addOn')
        : []

      const subscriptionById = new Map<number, any>(subscriptions.map((s) => [s.id, s]))
      lines = items.map((r: any) => {
        const sub = subscriptionById.get(Number(r.subscription_id))
        return {
          moduleName: sub?.module?.name ?? 'Subscription',
          addOnName: sub?.addOn?.name ?? null,
          billingCycle: sub?.billingCycle ?? null,
          lineAmount: Number(r.line_amount || 0),
          description: r.description ?? null,
          periodStart: null,
          periodEnd: null,
        }
      })
    }

    const { default: edge } = await import('edge.js')
    const path = await import('node:path')
    const { readFile } = await import('node:fs/promises')

    edge.mount(path.join(process.cwd(), 'resources/views'))

    let logoDataUri = ''
    try {
      const logoBuffer = await readFile(
        path.join(process.cwd(), 'app', 'data', 'LogoEnjoy.png')
      )
      logoDataUri = `data:image/png;base64,${logoBuffer.toString('base64')}`
    } catch {}

    const periodStartLabel = invoice.periodStart ? invoice.periodStart.toFormat('LLL d, yyyy') : ''
    const periodEndLabel = invoice.periodEnd ? invoice.periodEnd.minus({ days: 1 }).toFormat('LLL d, yyyy') : ''
    const subtotalAmount = lines.reduce((sum, l: any) => sum + Number(l.lineAmount || 0), 0)
    const totalAmount = Number(invoice.totalAmount || 0)
    const amountDue = invoice.status === 'paid' ? 0 : totalAmount

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

    const receiptData = {
      id: receipt.id,
      receiptNumber: receipt.receiptNumber,
      amount: formatCurrency(Number(receipt.amount || 0)),
      currency: receipt.currency,
      paymentDate: receipt.paymentDate?.toISODate() ?? '',
      paymentMethod: receipt.paymentMethod ?? '',
      transactionReference: receipt.transactionReference ?? '',
      notes: receipt.notes ?? '',
    }

    const [payments, receipts] = await Promise.all([
      InvoiceSubscriptionPayment.query()
        .where('invoice_subscription_id', invoice.id)
        .orderBy('payment_date', 'asc'),
      InvoiceSubscriptionReceipt.query()
        .where('invoice_subscription_id', invoice.id)
        .select(['receipt_number', 'invoice_subscription_payment_id']),
    ])

    const receiptNumberByPaymentId = new Map<number, string>()
    for (const r of receipts as any[]) {
      const paymentId = Number(r.invoiceSubscriptionPaymentId ?? r.invoice_subscription_payment_id)
      if (Number.isFinite(paymentId)) {
        receiptNumberByPaymentId.set(paymentId, String(r.receiptNumber ?? r.receipt_number ?? ''))
      }
    }

    const paymentHistory = (payments as any[])
      .filter((p) => Number(p.amount || 0) > 0)
      .map((p) => ({
        paymentMethod: p.paymentMethod ?? '',
        paymentDate: p.paymentDate ? p.paymentDate.toFormat('LLLL d, yyyy') : '',
        amountPaid: formatCurrency(Number(p.amount || 0)),
        currency: p.currency ?? invoice.currency,
        receiptNumber: receiptNumberByPaymentId.get(p.id) ?? '',
      }))

    const showPaymentHistory = Number(receipt.amount || 0) > 0 && paymentHistory.length > 0

    let templateLines = lines.map((l: any) => {
      const addOnName = l.addOnName ? ` - ${l.addOnName}` : ''
      const extra = l.description ? ` / ${l.description}` : ''
      const unitPrice = Number(l.lineAmount || 0)
      return {
        description: `${l.moduleName}${addOnName}${extra}`,
        qty: '1',
        unitPrice: formatCurrency(unitPrice),
        amount: formatCurrency(unitPrice),
      }
    })
    if (templateLines.length === 0) {
      const unitPrice = Number(invoice.totalAmount || 0)
      templateLines = [
        { description: 'Subscription', qty: '1', unitPrice: formatCurrency(unitPrice), amount: formatCurrency(unitPrice) },
      ]
    }

    const html = await edge.render('reports/subscription_receipt', {
      receipt: receiptData,
      invoice: invoiceData,
      hotel: invoice.hotel,
      lines: templateLines,
      paymentHistory,
      showPaymentHistory,
      logoDataUri,
    })

    const pdfBuffer = await PdfService.generatePdfFromHtml(html, {
      format: 'A4',
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
    })

    response.header('Content-Type', 'application/pdf')
    response.header('Content-Disposition', `inline; filename="receipt-${receipt.receiptNumber}.pdf"`)
    return response.send(pdfBuffer)
  }
}
