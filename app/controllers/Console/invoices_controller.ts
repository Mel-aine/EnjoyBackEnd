import type { HttpContext } from '@adonisjs/core/http'
import Invoice from '#models/invoice'
import Hotel from '#models/hotel'
import ActivityLog from '#models/activity_log'
import Subscription from '#models/subscription'
import { DateTime } from 'luxon'

export default class InvoicesController {

  public async index({ request, response }: HttpContext) {
    const page = request.input('page', 1)
    const limit = request.input('limit', 10)
    const status = request.input('status')
    const search = request.input('search')

    const query = Invoice.query().preload('hotel')

    if (status) query.where('status', status)
    if (search) {
      query.where((q) => {
        q.whereHas('hotel', (h) => h.whereILike('hotel_name', `%${search}%`))
        .orWhereILike('invoice_number', `%${search}%`)
      })
    }

    const invoices = await query.orderBy('created_at', 'desc').paginate(page, limit)
    return response.ok(invoices)
  }

   public async billing({ request, response }: HttpContext) {
    const page   = request.input('page', 1)
    const search = request.input('search', '')
    const status = request.input('status', '')
    const query = Invoice.query().preload('hotel')

    if (search) {
      query.where((q) => {
        q.whereHas('hotel', (h) => h.whereILike('hotel_name', `%${search}%`))
        .orWhereILike('invoice_number', `%${search}%`)
      })
    }

    if (status) query.where('status', status)

    const [invoices, totalRevenueRow, pendingRow, overdueRow] = await Promise.all([
      query.orderBy('created_at', 'desc').paginate(page, 10),
      Invoice.query().where('status', 'paid').sum('amount as total').first(),
      Invoice.query().where('status', 'pending').sum('amount as total').count('* as count').first(),
      Invoice.query().where('status', 'failed').sum('amount as total').first(),
    ])

    return response.ok({
      stats: {
        totalRevenue:  Number(totalRevenueRow?.$extras?.total ?? 0),
        pendingAmount: Number(pendingRow?.$extras?.total ?? 0),
        pendingCount:  Number(pendingRow?.$extras?.count ?? 0),
        overdueAmount: Number(overdueRow?.$extras?.total ?? 0),
      },
      invoices: {
        data: invoices.all().map((inv) => ({
          id:            inv.id,
          invoiceNumber: inv.invoiceNumber,
          hotelId:       inv.hotelId,
          hotel:         inv.hotel?.hotelName ?? 'Inconnu',
          amount:        inv.amount,
          currency:      inv.currency,
          status:        inv.status,
          description:   inv.description,
          billingDate:   inv.billingDate?.toISODate() ?? null,
          createdAt:     inv.createdAt.toISO(),
        })),
        meta: invoices.getMeta(),
      },
    })
  }

// public async markAsPaid({ params, response, auth }: HttpContext) {
//   const invoice = await Invoice.findOrFail(params.id)
//   const user = auth.user!
//   const oldState = invoice.serialize()

//   invoice.status = 'paid'
//   await invoice.save()

//   if (invoice.subscriptionId) {
//     const sub = await Subscription.find(invoice.subscriptionId)
//     if (sub) {
//       sub.paymentStatus = 'paid'
//       await sub.save()
//     }
//   }

//   await ActivityLog.create({
//     userId: user.id,
//     username: user.username || user.email,
//     action: 'invoice.paid',
//     entityType: 'invoice',
//     entityId: invoice.id,
//     hotelId: invoice.hotelId,
//     description: `Invoice ${invoice.invoiceNumber} marked as paid`,
//     changes: { before: oldState, after: invoice.serialize() },
//     ipAddress: '',
//     userAgent: '',
//     createdBy: user.id,
//   })

//   return response.ok(invoice)
// }

  public async show({ params, response }: HttpContext) {
    const invoice = await Invoice.findOrFail(params.id)
    return response.ok(invoice)
  }

  public async store({ params, request, response, auth }: HttpContext) {
    const hotel = await Hotel.findOrFail(params.hotel_id)
    const data = request.only([
      'amount',
      'currency',
      'status',
      'invoiceNumber',
      'description',
      'billingDate'
    ])

    if (!data.invoiceNumber) {
      const lastInvoice = await Invoice.query()
        .whereHas('hotel', q => q.where('id', hotel.id))
        .orderBy('id', 'desc')
        .first()

      const nextId = (lastInvoice?.id ?? 0) + 1
      data.invoiceNumber = `INV-${DateTime.now().toFormat('yyyy')}-${String(nextId).padStart(4, '0')}`
    }

    if(!data.billingDate){
      data.billingDate = DateTime.now()
    }

    const invoice = await hotel.related('invoices').create(data)

    // Log the activity
    const user = auth.user!
    await ActivityLog.create({
      userId: user.id,
      username: user.username || user.email,
      action: 'invoice.create',
      entityType: 'invoice',
      entityId: invoice.id,
      hotelId: hotel.id,
      description: `Created invoice: ${invoice.invoiceNumber}`,
      changes: invoice.serialize(),
      ipAddress: request.ip(),
      userAgent: request.header('user-agent'),
      createdBy: user.id
    })

    return response.created(invoice)
  }

  public async update({ params, request, response, auth }: HttpContext) {
    const invoice = await Invoice.findOrFail(params.id)

    // Capture old state for logging
    const oldState = invoice.serialize()

    const data = request.only(['status', 'description'])
    invoice.merge(data)
    await invoice.save()

    // Log the activity
    const user = auth.user!
    await ActivityLog.create({
      userId: user.id,
      username: user.username || user.email,
      action: 'invoice.update',
      entityType: 'invoice',
      entityId: invoice.id,
      hotelId: invoice.hotelId,
      description: `Updated invoice: ${invoice.invoiceNumber}`,
      changes: {
        before: oldState,
        after: invoice.serialize()
      },
      ipAddress: request.ip(),
      userAgent: request.header('user-agent'),
      createdBy: user.id
    })

    return response.ok(invoice)
  }

  public async quotas({ response }: HttpContext) {
    const subscriptions = await Subscription.query()
      .whereNotNull('limit_count')
      .where('status', 'active')
      .preload('hotel')
      .preload('module')

    const data = subscriptions.map((sub) => ({
      id: sub.id,
      hotelId: sub.hotelId,
      hotel: sub.hotel?.hotelName ?? 'Inconnu',
      module: sub.module?.name ?? 'Inconnu',
      moduleSlug: sub.module?.slug ?? '',
      limitCount: sub.limitCount,
      price: sub.price,
    }))

    return response.ok(data)
  }
}
