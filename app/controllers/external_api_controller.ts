import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import Hotel from '#models/hotel'
import RoomType from '#models/room_type'
import Room from '#models/room'
import BedType from '#models/bed_type'
import RoomRate from '#models/room_rate'
import Season from '#models/season'
import RateType from '#models/rate_type'
import ExtraCharge from '#models/extra_charge'
import Guest from '#models/guest'
import Reservation from '#models/reservation'
import ReservationsController from '#controllers/reservations_controller'
import { DateTime } from 'luxon'

export default class ExternalApiController {
  private getApiKeyHotelId(ctx: HttpContext): number | null {
    const hotelId = (ctx as any)?.hotel?.id
    return typeof hotelId === 'number' ? hotelId : null
  }

  private ensureHotelMatch(ctx: HttpContext): number | null {
    const apiKeyHotelId = this.getApiKeyHotelId(ctx)
    const paramHotelId = Number(ctx.params.hotelId)

    if (!apiKeyHotelId || Number.isNaN(paramHotelId)) {
      return null
    }

    if (apiKeyHotelId !== paramHotelId) {
      return null
    }

    return apiKeyHotelId
  }

  private async attachActorUser(ctx: HttpContext): Promise<User | null> {
    const headerUserId = ctx.request.header('x-user-id')
    const bodyUserId = ctx.request.input('created_by') ?? ctx.request.input('user_id') ?? ctx.request.input('createdBy')
    const rawUserId = headerUserId ?? bodyUserId

    const userId = Number(rawUserId)
    if (!rawUserId || Number.isNaN(userId) || userId <= 0) {
      return null
    }

    const user = await User.find(userId)
    if (!user) {
      return null
    }

    return user
  }

  private withActorUser(ctx: HttpContext, actor: User): HttpContext {
    return {
      ...ctx,
      auth: {
        ...(ctx.auth as any),
        user: actor,
      },
    } as HttpContext
  }

  private async ensureReservationHotel(ctx: HttpContext, reservationId: number): Promise<boolean> {
    const apiKeyHotelId = this.getApiKeyHotelId(ctx)
    if (!apiKeyHotelId) {
      return false
    }

    const exists = await Reservation.query()
      .where('id', reservationId)
      .where('hotel_id', apiKeyHotelId)
      .select('id')
      .first()

    return Boolean(exists)
  }

  public async getHotel(ctx: HttpContext) {
    const { response } = ctx
    const hotelId = this.ensureHotelMatch(ctx)

    if (!hotelId) {
      return response.unauthorized({ success: false, message: 'Invalid hotel for provided x-pos-api-key' })
    }

    const hotel = await Hotel.findOrFail(hotelId)
    const payload: any = hotel.toJSON()
    delete payload.posApiKey
    return response.ok(payload)
  }

  public async roomTypes(ctx: HttpContext) {
    const { response } = ctx
    const hotelId = this.ensureHotelMatch(ctx)

    if (!hotelId) {
      return response.unauthorized({ success: false, message: 'Invalid hotel for provided x-pos-api-key' })
    }

    const items = await RoomType.query()
      .where('hotel_id', hotelId)
      .where('is_deleted', false)
      .orderBy('sort_order', 'asc')

    return response.ok(items)
  }

  public async rooms(ctx: HttpContext) {
    const { response } = ctx
    const hotelId = this.ensureHotelMatch(ctx)

    if (!hotelId) {
      return response.unauthorized({ success: false, message: 'Invalid hotel for provided x-pos-api-key' })
    }

    const items = await Room.query().where('hotel_id', hotelId).where('isDeleted', false).orderBy('sortKey', 'asc')
    return response.ok(items)
  }

  public async bedTypes(ctx: HttpContext) {
    const { response } = ctx
    const hotelId = this.ensureHotelMatch(ctx)

    if (!hotelId) {
      return response.unauthorized({ success: false, message: 'Invalid hotel for provided x-pos-api-key' })
    }

    const items = await BedType.query().where('hotel_id', hotelId).where('is_deleted', false).orderBy('id', 'asc')
    return response.ok(items)
  }

  public async roomRates(ctx: HttpContext) {
    const { response, request } = ctx
    const hotelId = this.ensureHotelMatch(ctx)

    if (!hotelId) {
      return response.unauthorized({ success: false, message: 'Invalid hotel for provided x-pos-api-key' })
    }

    const dateFrom = request.input('date_from')
    const dateTo = request.input('date_to')

    const query = RoomRate.query().where('hotel_id', hotelId)
    if (dateFrom && dateTo) {
      query.whereBetween('rate_date', [dateFrom, dateTo])
    }

    const items = await query.orderBy('room_type_id', 'asc').orderBy('rate_type_id', 'asc')
    return response.ok(items)
  }

  public async seasons(ctx: HttpContext) {
    const { response } = ctx
    const hotelId = this.ensureHotelMatch(ctx)

    if (!hotelId) {
      return response.unauthorized({ success: false, message: 'Invalid hotel for provided x-pos-api-key' })
    }

    const items = await Season.query().where('hotel_id', hotelId).where('is_deleted', false).orderBy('id', 'asc')
    return response.ok(items)
  }

  public async rateTypes(ctx: HttpContext) {
    const { response } = ctx
    const hotelId = this.ensureHotelMatch(ctx)

    if (!hotelId) {
      return response.unauthorized({ success: false, message: 'Invalid hotel for provided x-pos-api-key' })
    }

    const items = await RateType.query().where('hotel_id', hotelId).where('is_deleted', false).orderBy('id', 'asc')
    return response.ok(items)
  }

  public async extraCharges(ctx: HttpContext) {
    const { response } = ctx
    const hotelId = this.ensureHotelMatch(ctx)

    if (!hotelId) {
      return response.unauthorized({ success: false, message: 'Invalid hotel for provided x-pos-api-key' })
    }

    const items = await ExtraCharge.query().where('hotel_id', hotelId).where('is_deleted', false).orderBy('id', 'asc')
    return response.ok(items)
  }

  public async guests(ctx: HttpContext) {
    const { request, response } = ctx
    const apiKeyHotelId = this.getApiKeyHotelId(ctx)
    if (!apiKeyHotelId) {
      return response.unauthorized({ success: false, message: 'Invalid x-pos-api-key' })
    }

    const search = String(request.input('search') || '').trim()
    const limit = Number(request.input('limit') || 50)

    const query = Guest.query().where('hotel_id', apiKeyHotelId)

    if (search) {
      query.where((q) => {
        q.whereILike('first_name', `%${search}%`)
          .orWhereILike('last_name', `%${search}%`)
          .orWhereILike('email', `%${search}%`)
          .orWhereILike('phone_primary', `%${search}%`)
      })
    }

    const items = await query.orderBy('created_at', 'desc').limit(Math.min(Math.max(limit, 1), 200))
    return response.ok({ message: 'Guests retrieved successfully', data: items })
  }

  public async guestDetails(ctx: HttpContext) {
    const { params, response } = ctx
    const apiKeyHotelId = this.getApiKeyHotelId(ctx)
    if (!apiKeyHotelId) {
      return response.unauthorized({ success: false, message: 'Invalid x-pos-api-key' })
    }

    const guestId = Number(params.id)
    if (Number.isNaN(guestId)) {
      return response.badRequest({ success: false, message: 'Invalid guest id' })
    }

    const guest = await Guest.query()
      .where('id', guestId)
      .where('hotel_id', apiKeyHotelId)
      .preload('reservations')
      .preload('folios')
      .preload('companyAccount')
      .first()

    if (!guest) {
      return response.notFound({ success: false, message: 'Guest not found' })
    }

    return response.ok({
      message: 'Guest retrieved successfully',
      data: guest,
    })
  }

  public async createGuest(ctx: HttpContext) {
    const { request, response } = ctx
    const apiKeyHotelId = this.getApiKeyHotelId(ctx)
    if (!apiKeyHotelId) {
      return response.unauthorized({ success: false, message: 'Invalid x-pos-api-key' })
    }

    const actor = await this.attachActorUser(ctx)
    if (!actor) {
      return response.badRequest({
        success: false,
        message: 'x-user-id (or created_by/user_id) is required for this endpoint',
      })
    }

    const rawBody = request.body() as any
    request.updateBody({
      ...rawBody,
      hotelId: apiKeyHotelId,
    })

    const GuestsController = (await import('#controllers/guests_controller')).default
    const controller = new GuestsController()
    return controller.store(this.withActorUser(ctx, actor))
  }

  public async reservationCreate(ctx: HttpContext) {
    const { request, response } = ctx
    const apiKeyHotelId = this.getApiKeyHotelId(ctx)
    if (!apiKeyHotelId) {
      return response.unauthorized({ success: false, message: 'Invalid x-pos-api-key' })
    }

    const actor = await this.attachActorUser(ctx)
    if (!actor) {
      return response.badRequest({
        success: false,
        message: 'x-user-id (or created_by) is required for this endpoint',
      })
    }

    const rawBody = request.body() as any
    request.updateBody({
      ...rawBody,
      hotel_id: apiKeyHotelId,
      created_by: rawBody.created_by ?? actor.id,
    })

    const controller = new ReservationsController()
    return controller.saveReservation(this.withActorUser(ctx, actor))
  }

  public async reservationDetails(ctx: HttpContext) {
    const { params, response } = ctx
    const apiKeyHotelId = this.getApiKeyHotelId(ctx)
    if (!apiKeyHotelId) {
      return response.unauthorized({ success: false, message: 'Invalid x-pos-api-key' })
    }

    const reservationId = Number(params.reservationId)
    if (Number.isNaN(reservationId)) {
      return response.badRequest({ success: false, message: 'Invalid reservationId' })
    }

    const reservation = await Reservation.query()
      .where('id', reservationId)
      .where('hotel_id', apiKeyHotelId)
      .preload('guest')
      .preload('guests', (query) => {
        query.pivotColumns([
          'is_primary',
          'guest_type',
          'room_assignment',
          'special_requests',
          'dietary_restrictions',
          'accessibility',
          'emergency_contact',
          'emergency_phone',
          'notes',
        ])
      })
      .preload('folios', (query) => {
        query.preload('transactions', (tq) => {
          tq.where('isVoided', false).whereNot('status', 'voided').whereNull('mealPlanId')
        })
      })
      .preload('bookingSource')
      .preload('businessSource')
      .preload('reservationRooms', (query) => {
        query.preload('roomType')
        query.preload('guest')
        query.preload('guests')
        query.preload('room')
        query.preload('paymentMethod')
        query.preload('roomRates', (queryRoom: any) => {
          queryRoom.preload('rateType')
        })
      })
      .first()

    if (!reservation) {
      return response.notFound({ success: false, message: 'Reservation not found' })
    }

    const balanceSummary = ReservationsController.calculateBalanceSummary((reservation as any).folios || [])
    return response.ok({
      ...reservation.toJSON(),
      balanceSummary,
      displayName: (reservation as any).displayName,
    })
  }

  public async reservationAssignRoom(ctx: HttpContext) {
    const { params, response } = ctx
    const apiKeyHotelId = this.getApiKeyHotelId(ctx)
    if (!apiKeyHotelId) {
      return response.unauthorized({ success: false, message: 'Invalid x-pos-api-key' })
    }

    const actor = await this.attachActorUser(ctx)
    if (!actor) {
      return response.badRequest({
        success: false,
        message: 'x-user-id is required for this endpoint',
      })
    }

    const reservationId = Number(params.reservationId)
    if (Number.isNaN(reservationId)) {
      return response.badRequest({ success: false, message: 'Invalid reservationId' })
    }

    const belongs = await this.ensureReservationHotel(ctx, reservationId)
    if (!belongs) {
      return response.unauthorized({ success: false, message: 'Reservation not found for this hotel' })
    }

    const controller = new ReservationsController()
    return controller.assignRoom(this.withActorUser(ctx, actor))
  }

  public async reservationUnassignRoom(ctx: HttpContext) {
    const { params, response } = ctx
    const apiKeyHotelId = this.getApiKeyHotelId(ctx)
    if (!apiKeyHotelId) {
      return response.unauthorized({ success: false, message: 'Invalid x-pos-api-key' })
    }

    const actor = await this.attachActorUser(ctx)
    if (!actor) {
      return response.badRequest({
        success: false,
        message: 'x-user-id is required for this endpoint',
      })
    }

    const reservationId = Number(params.reservationId)
    if (Number.isNaN(reservationId)) {
      return response.badRequest({ success: false, message: 'Invalid reservationId' })
    }

    const belongs = await this.ensureReservationHotel(ctx, reservationId)
    if (!belongs) {
      return response.unauthorized({ success: false, message: 'Reservation not found for this hotel' })
    }

    const controller = new ReservationsController()
    return controller.unassignRoom(this.withActorUser(ctx, actor))
  }

  public async roomBlocksByHotel(ctx: HttpContext) {
    const { params, response } = ctx
    const apiKeyHotelId = this.getApiKeyHotelId(ctx)
    if (!apiKeyHotelId) {
      return response.unauthorized({ success: false, message: 'Invalid x-pos-api-key' })
    }

    const hotelId = Number(params.hotelId)
    if (Number.isNaN(hotelId) || hotelId !== apiKeyHotelId) {
      return response.unauthorized({ success: false, message: 'Invalid hotel for provided x-pos-api-key' })
    }

    const RoomBlocksController = (await import('#controllers/room_blocks_controller')).default
    const controller = new RoomBlocksController()
    return controller.getByHotelId(ctx)
  }

  public async roomBlockCreate(ctx: HttpContext) {
    const { request, response } = ctx
    const apiKeyHotelId = this.getApiKeyHotelId(ctx)
    if (!apiKeyHotelId) {
      return response.unauthorized({ success: false, message: 'Invalid x-pos-api-key' })
    }

    const actor = await this.attachActorUser(ctx)
    if (!actor) {
      return response.badRequest({
        success: false,
        message: 'x-user-id is required for this endpoint',
      })
    }

    const roomId = Number(request.input('room_id'))
    if (!Number.isNaN(roomId)) {
      const room = await Room.query().where('id', roomId).where('hotel_id', apiKeyHotelId).select('id').first()
      if (!room) {
        return response.unauthorized({ success: false, message: 'Room not found for this hotel' })
      }
    }

    const RoomBlocksController = (await import('#controllers/room_blocks_controller')).default
    const controller = new RoomBlocksController()
    return controller.store(this.withActorUser(ctx, actor))
  }

  public async roomBlockDelete(ctx: HttpContext) {
    const { params, response } = ctx
    const apiKeyHotelId = this.getApiKeyHotelId(ctx)
    if (!apiKeyHotelId) {
      return response.unauthorized({ success: false, message: 'Invalid x-pos-api-key' })
    }

    const actor = await this.attachActorUser(ctx)
    if (!actor) {
      return response.badRequest({
        success: false,
        message: 'x-user-id is required for this endpoint',
      })
    }

    const blockId = Number(params.id)
    if (Number.isNaN(blockId)) {
      return response.badRequest({ success: false, message: 'Invalid block id' })
    }

    const RoomBlock = (await import('#models/room_block')).default
    const block = await RoomBlock.query().where('id', blockId).where('hotel_id', apiKeyHotelId).select('id').first()
    if (!block) {
      return response.notFound({ success: false, message: 'Room block not found' })
    }

    const RoomBlocksController = (await import('#controllers/room_blocks_controller')).default
    const controller = new RoomBlocksController()
    return controller.destroy(this.withActorUser(ctx, actor))
  }

  public async roomsWithDetails(ctx: HttpContext) {
    const { response } = ctx
    const hotelId = this.ensureHotelMatch(ctx)
    if (!hotelId) {
      return response.unauthorized({ success: false, message: 'Invalid hotel for provided x-pos-api-key' })
    }

    const RoomsController = (await import('#controllers/rooms_controller')).default
    const controller = new RoomsController()
    return controller.getRoomsWithDetails(ctx)
  }

  public async folioCreateForReservation(ctx: HttpContext) {
    const { request, response } = ctx
    const apiKeyHotelId = this.getApiKeyHotelId(ctx)
    if (!apiKeyHotelId) {
      return response.unauthorized({ success: false, message: 'Invalid x-pos-api-key' })
    }

    const actor = await this.attachActorUser(ctx)
    if (!actor) {
      return response.badRequest({
        success: false,
        message: 'x-user-id is required for this endpoint',
      })
    }

    const reservationId = Number(request.input('reservationId'))
    if (Number.isNaN(reservationId)) {
      return response.badRequest({ success: false, message: 'reservationId is required' })
    }

    const belongs = await this.ensureReservationHotel(ctx, reservationId)
    if (!belongs) {
      return response.unauthorized({ success: false, message: 'Reservation not found for this hotel' })
    }

    const FoliosController = (await import('#controllers/folios_controller')).default
    const controller = new FoliosController()
    return controller.createForReservation(this.withActorUser(ctx, actor))
  }

  public async folioPostTransaction(ctx: HttpContext) {
    const { request, response } = ctx
    const apiKeyHotelId = this.getApiKeyHotelId(ctx)
    if (!apiKeyHotelId) {
      return response.unauthorized({ success: false, message: 'Invalid x-pos-api-key' })
    }

    const actor = await this.attachActorUser(ctx)
    if (!actor) {
      return response.badRequest({
        success: false,
        message: 'x-user-id is required for this endpoint',
      })
    }

    const folioId = Number(request.input('folioId'))
    if (Number.isNaN(folioId)) {
      return response.badRequest({ success: false, message: 'folioId is required' })
    }

    const Folio = (await import('#models/folio')).default
    const folio = await Folio.query().where('id', folioId).where('hotel_id', apiKeyHotelId).select('id').first()
    if (!folio) {
      return response.unauthorized({ success: false, message: 'Folio not found for this hotel' })
    }

    const FoliosController = (await import('#controllers/folios_controller')).default
    const controller = new FoliosController()
    return controller.postTransaction(this.withActorUser(ctx, actor))
  }

  public async folioStatement(ctx: HttpContext) {
    const { params, response } = ctx
    const apiKeyHotelId = this.getApiKeyHotelId(ctx)
    if (!apiKeyHotelId) {
      return response.unauthorized({ success: false, message: 'Invalid x-pos-api-key' })
    }

    const folioId = Number(params.folioId)
    if (Number.isNaN(folioId)) {
      return response.badRequest({ success: false, message: 'Invalid folioId' })
    }

    const Folio = (await import('#models/folio')).default
    const folio = await Folio.query().where('id', folioId).where('hotel_id', apiKeyHotelId).select('id').first()
    if (!folio) {
      return response.unauthorized({ success: false, message: 'Folio not found for this hotel' })
    }

    const FoliosController = (await import('#controllers/folios_controller')).default
    const controller = new FoliosController()
    return controller.statement({
      ...ctx,
      params: { ...ctx.params, id: folioId },
    } as any)
  }

  public async folioPrintConfirmBookingPdf(ctx: HttpContext) {
    const { request, response } = ctx
    const apiKeyHotelId = this.getApiKeyHotelId(ctx)
    if (!apiKeyHotelId) {
      return response.unauthorized({ success: false, message: 'Invalid x-pos-api-key' })
    }

    const reservationId = Number(request.input('reservationId'))
    if (Number.isNaN(reservationId)) {
      return response.badRequest({ success: false, message: 'reservationId is required' })
    }

    const belongs = await this.ensureReservationHotel(ctx, reservationId)
    if (!belongs) {
      return response.unauthorized({ success: false, message: 'Reservation not found for this hotel' })
    }

    const FolioPrintController = (await import('#controllers/folio_print_controller')).default
    const controller = new FolioPrintController()
    return controller.printBookingPdf(ctx)
  }

  public async folioPrintPdf(ctx: HttpContext) {
    const { request, response } = ctx
    const apiKeyHotelId = this.getApiKeyHotelId(ctx)
    if (!apiKeyHotelId) {
      return response.unauthorized({ success: false, message: 'Invalid x-pos-api-key' })
    }

    const reservationId = Number(request.input('reservationId'))
    if (!Number.isNaN(reservationId)) {
      const belongs = await this.ensureReservationHotel(ctx, reservationId)
      if (!belongs) {
        return response.unauthorized({ success: false, message: 'Reservation not found for this hotel' })
      }
    }

    const FolioPrintController = (await import('#controllers/folio_print_controller')).default
    const controller = new FolioPrintController()
    return controller.printFolioPdf(ctx)
  }

  public async folioSendInvoiceEmail(ctx: HttpContext) {
    const { request, response } = ctx
    const apiKeyHotelId = this.getApiKeyHotelId(ctx)
    if (!apiKeyHotelId) {
      return response.unauthorized({ success: false, message: 'Invalid x-pos-api-key' })
    }

    const actor = await this.attachActorUser(ctx)

    const reservationId = Number(request.input('reservationId'))
    if (Number.isNaN(reservationId)) {
      return response.badRequest({ success: false, message: 'reservationId is required' })
    }

    const belongs = await this.ensureReservationHotel(ctx, reservationId)
    if (!belongs) {
      return response.unauthorized({ success: false, message: 'Reservation not found for this hotel' })
    }

    const FolioPrintController = (await import('#controllers/folio_print_controller')).default
    const controller = new FolioPrintController()
    return controller.sendInvoiceByEmail(actor ? this.withActorUser(ctx, actor) : ctx)
  }

  public async dashboardAvailability(ctx: HttpContext) {
    const { params, response } = ctx
    const apiKeyHotelId = this.getApiKeyHotelId(ctx)
    if (!apiKeyHotelId) {
      return response.unauthorized({ success: false, message: 'Invalid x-pos-api-key' })
    }

    const serviceId = Number(params.serviceId)
    if (Number.isNaN(serviceId) || serviceId !== apiKeyHotelId) {
      return response.unauthorized({ success: false, message: 'Invalid hotel for provided x-pos-api-key' })
    }

    const DashboardController = (await import('#controllers/dasboard_controller')).default
    const controller = new DashboardController()
    return controller.getAvailability(ctx)
  }

  public async managementReportPdf(ctx: HttpContext) {
    const { request, response } = ctx
    const apiKeyHotelId = this.getApiKeyHotelId(ctx)
    if (!apiKeyHotelId) {
      return response.unauthorized({ success: false, message: 'Invalid x-pos-api-key' })
    }

    const actor = await this.attachActorUser(ctx)

    const rawBody = request.body() as any
    request.updateBody({
      ...rawBody,
      hotelId: apiKeyHotelId,
    })

    const ReportsController = (await import('#controllers/reports_controller')).default
    const controller = new ReportsController()
    return controller.generateManagementReportPdf(actor ? this.withActorUser(ctx, actor) : ctx)
  }

  public async nightAuditReportPdf(ctx: HttpContext) {
    const { request, response } = ctx
    const apiKeyHotelId = this.getApiKeyHotelId(ctx)
    if (!apiKeyHotelId) {
      return response.unauthorized({ success: false, message: 'Invalid x-pos-api-key' })
    }

    const actor = await this.attachActorUser(ctx)

    const rawBody = request.body() as any
    request.updateBody({
      ...rawBody,
      hotelId: apiKeyHotelId,
    })

    const ReportsController = (await import('#controllers/reports_controller')).default
    const controller = new ReportsController()
    return controller.generateNightAuditReportPdf(actor ? this.withActorUser(ctx, actor) : ctx)
  }

  public async roomsAvailabilityByRoomType(ctx: HttpContext) {
    const { response } = ctx
    const hotelId = this.ensureHotelMatch(ctx)
    if (!hotelId) {
      return response.unauthorized({ success: false, message: 'Invalid hotel for provided x-pos-api-key' })
    }

    const RoomsController = (await import('#controllers/rooms_controller')).default
    const controller = new RoomsController()
    return controller.getAvailableRoomsByRoomTypeId(ctx)
  }

  public async availabilityByRoomType(ctx: HttpContext) {
    const { request, response } = ctx
    const hotelId = this.ensureHotelMatch(ctx)
    if (!hotelId) {
      return response.unauthorized({ success: false, message: 'Invalid hotel for provided x-pos-api-key' })
    }

    const dateFrom = String(request.input('date_from') || '').trim()
    const dateTo = String(request.input('date_to') || '').trim()

    if (!dateFrom || !dateTo) {
      return response.badRequest({ success: false, message: 'date_from and date_to are required (YYYY-MM-DD)' })
    }

    const from = DateTime.fromISO(dateFrom)
    const to = DateTime.fromISO(dateTo)

    if (!from.isValid || !to.isValid) {
      return response.badRequest({ success: false, message: 'Invalid date format. Use YYYY-MM-DD' })
    }

    if (to < from) {
      return response.badRequest({ success: false, message: 'date_to must be >= date_from' })
    }

    const roomTypes = await RoomType.query().where('hotel_id', hotelId).where('is_deleted', false).select('id', 'roomTypeName', 'room_type_name')
    const rooms = await Room.query().where('hotel_id', hotelId).where('isDeleted', false).select('id', 'roomTypeId')

    const totalByRoomType = new Map<number, number>()
    for (const room of rooms as any[]) {
      const rtId = Number((room as any).roomTypeId)
      if (Number.isNaN(rtId)) continue
      totalByRoomType.set(rtId, (totalByRoomType.get(rtId) ?? 0) + 1)
    }

    const reservationRows = await db
      .from('reservation_rooms')
      .join('rooms', 'reservation_rooms.room_id', 'rooms.id')
      .where('rooms.hotel_id', hotelId)
      .whereNotIn('reservation_rooms.status', ['cancelled', 'no_show', 'voided'])
      .where('reservation_rooms.check_in_date', '<=', to.toJSDate())
      .where('reservation_rooms.check_out_date', '>=', from.toJSDate())
      .select('rooms.room_type_id as roomTypeId', 'reservation_rooms.room_id as roomId')

    const blockRows = await db
      .from('room_blocks')
      .join('rooms', 'room_blocks.room_id', 'rooms.id')
      .where('rooms.hotel_id', hotelId)
      .where('room_blocks.block_from_date', '<', to.toJSDate())
      .where('room_blocks.block_to_date', '>', from.toJSDate())
      .select('rooms.room_type_id as roomTypeId', 'room_blocks.room_id as roomId')

    const unavailableByRoomType = new Map<number, Set<number>>()
    const addUnavailable = (rtIdRaw: any, roomIdRaw: any) => {
      const rtId = Number(rtIdRaw)
      const roomId = Number(roomIdRaw)
      if (Number.isNaN(rtId) || Number.isNaN(roomId)) return
      if (!unavailableByRoomType.has(rtId)) {
        unavailableByRoomType.set(rtId, new Set<number>())
      }
      unavailableByRoomType.get(rtId)!.add(roomId)
    }

    for (const row of reservationRows as any[]) {
      addUnavailable(row.roomTypeId, row.roomId)
    }
    for (const row of blockRows as any[]) {
      addUnavailable(row.roomTypeId, row.roomId)
    }

    const result = (roomTypes as any[]).map((rt) => {
      const rtId = Number(rt.id)
      const total = totalByRoomType.get(rtId) ?? 0
      const unavailable = unavailableByRoomType.get(rtId)?.size ?? 0
      const available = Math.max(total - unavailable, 0)
      return {
        roomTypeId: rtId,
        roomTypeName: rt.roomTypeName ?? rt.room_type_name ?? null,
        totalRooms: total,
        unavailableRooms: unavailable,
        availableRooms: available,
      }
    })

    return response.ok({
      success: true,
      hotelId,
      date_from: from.toISODate(),
      date_to: to.toISODate(),
      data: result,
    })
  }

  public async roomAvailability(ctx: HttpContext) {
    const { response } = ctx
    const hotelId = this.ensureHotelMatch(ctx)
    if (!hotelId) {
      return response.unauthorized({ success: false, message: 'Invalid hotel for provided x-pos-api-key' })
    }

    const RoomsController = (await import('#controllers/rooms_controller')).default
    const controller = new RoomsController()
    return controller.availability(ctx)
  }

  public async houseStatus(ctx: HttpContext) {
    const { response } = ctx
    const hotelId = this.ensureHotelMatch(ctx)
    if (!hotelId) {
      return response.unauthorized({ success: false, message: 'Invalid hotel for provided x-pos-api-key' })
    }

    const RoomsController = (await import('#controllers/rooms_controller')).default
    const controller = new RoomsController()
    return controller.getHouseStatus(ctx)
  }

  public async reservationSearch(ctx: HttpContext) {
    const { response } = ctx
    const apiKeyHotelId = this.getApiKeyHotelId(ctx)
    if (!apiKeyHotelId) {
      return response.unauthorized({ success: false, message: 'Invalid x-pos-api-key' })
    }

    ctx.params.id = apiKeyHotelId
    const controller = new ReservationsController()
    return controller.searchReservations(ctx)
  }

  public async reservationArrivals(ctx: HttpContext) {
    const { response } = ctx
    const apiKeyHotelId = this.getApiKeyHotelId(ctx)
    if (!apiKeyHotelId) {
      return response.unauthorized({ success: false, message: 'Invalid x-pos-api-key' })
    }

    ctx.params.id = apiKeyHotelId
    const controller = new ReservationsController()
    return controller.getArrivalsByDateRange(ctx)
  }

  public async reservationDepartures(ctx: HttpContext) {
    const { response } = ctx
    const apiKeyHotelId = this.getApiKeyHotelId(ctx)
    if (!apiKeyHotelId) {
      return response.unauthorized({ success: false, message: 'Invalid x-pos-api-key' })
    }

    ctx.params.id = apiKeyHotelId
    const controller = new ReservationsController()
    return controller.getDeparturesByDateRange(ctx)
  }

  public async reservationCancel(ctx: HttpContext) {
    const { params, response } = ctx
    const apiKeyHotelId = this.getApiKeyHotelId(ctx)
    if (!apiKeyHotelId) {
      return response.unauthorized({ success: false, message: 'Invalid x-pos-api-key' })
    }

    const actor = await this.attachActorUser(ctx)
    if (!actor) {
      return response.badRequest({
        success: false,
        message: 'x-user-id is required for this endpoint',
      })
    }

    const reservationId = Number(params.reservationId)
    if (Number.isNaN(reservationId)) {
      return response.badRequest({ success: false, message: 'Invalid reservationId' })
    }

    const belongs = await this.ensureReservationHotel(ctx, reservationId)
    if (!belongs) {
      return response.unauthorized({ success: false, message: 'Reservation not found for this hotel' })
    }

    const controller = new ReservationsController()
    return controller.cancelReservation(this.withActorUser(ctx, actor))
  }

  public async reservationCheckIn(ctx: HttpContext) {
    const { params, response } = ctx
    const apiKeyHotelId = this.getApiKeyHotelId(ctx)
    if (!apiKeyHotelId) {
      return response.unauthorized({ success: false, message: 'Invalid x-pos-api-key' })
    }

    const actor = await this.attachActorUser(ctx)
    if (!actor) {
      return response.badRequest({
        success: false,
        message: 'x-user-id is required for this endpoint',
      })
    }

    const reservationId = Number(params.reservationId)
    if (Number.isNaN(reservationId)) {
      return response.badRequest({ success: false, message: 'Invalid reservationId' })
    }

    const belongs = await this.ensureReservationHotel(ctx, reservationId)
    if (!belongs) {
      return response.unauthorized({ success: false, message: 'Reservation not found for this hotel' })
    }

    const controller = new ReservationsController()
    return controller.checkIn(this.withActorUser(ctx, actor))
  }

  public async reservationCheckOut(ctx: HttpContext) {
    const { params, response } = ctx
    const apiKeyHotelId = this.getApiKeyHotelId(ctx)
    if (!apiKeyHotelId) {
      return response.unauthorized({ success: false, message: 'Invalid x-pos-api-key' })
    }

    const actor = await this.attachActorUser(ctx)
    if (!actor) {
      return response.badRequest({
        success: false,
        message: 'x-user-id is required for this endpoint',
      })
    }

    const reservationId = Number(params.reservationId)
    if (Number.isNaN(reservationId)) {
      return response.badRequest({ success: false, message: 'Invalid reservationId' })
    }

    const belongs = await this.ensureReservationHotel(ctx, reservationId)
    if (!belongs) {
      return response.unauthorized({ success: false, message: 'Reservation not found for this hotel' })
    }

    const controller = new ReservationsController()
    return controller.checkOut(this.withActorUser(ctx, actor))
  }
}
