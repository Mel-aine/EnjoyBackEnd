import type { HttpContext } from '@adonisjs/core/http'
import Invoice from '#models/invoice'
import Hotel from '#models/hotel'
import ActivityLog from '#models/activity_log'

export default class InvoicesController {
  public async index({ params, response }: HttpContext) {
    const hotel = await Hotel.findOrFail(params.hotel_id)
    await hotel.load('invoices')
    return response.ok(hotel.invoices)
  }

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
}