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
import ReservationCreationService from '#services/reservation_creation_service'
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

  private toNumber(value: any): number | null {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  private normalizeDate(value: any): string | null {
    if (!value) return null
    const parsed = DateTime.fromISO(String(value))
    return parsed.isValid ? parsed.toISODate() : null
  }

  private normalizeTime(value: any, fallback: string): string {
    if (!value) return fallback
    const raw = String(value).trim()
    const match = raw.match(/^(\d{2}:\d{2})/)
    return match ? match[1] : fallback
  }

  private async findRateForRoomType(
    hotelId: number,
    roomTypeId: number,
    preferredRateTypeId?: number | null
  ): Promise<RoomRate | null> {
    const query = RoomRate.query().where('hotel_id', hotelId).where('room_type_id', roomTypeId)

    if (preferredRateTypeId) {
      query.where('rate_type_id', preferredRateTypeId)
    }

    const exactRate = await query.orderBy('id', 'asc').first()
    if (exactRate) {
      return exactRate
    }

    if (preferredRateTypeId) {
      return RoomRate.query()
        .where('hotel_id', hotelId)
        .where('room_type_id', roomTypeId)
        .orderBy('id', 'asc')
        .first()
    }

    return null
  }

  private async buildReservationPayload(rawBody: any, hotelId: number, actorId: number) {
    const arrivedDate = this.normalizeDate(rawBody.arrived_date ?? rawBody.scheduledArrivalDate)
    const departDate = this.normalizeDate(rawBody.depart_date ?? rawBody.scheduledDepartureDate)

    const arrivedTime = this.normalizeTime(
      rawBody.arrived_time ?? rawBody.check_in_time ?? rawBody.arrivedTime,
      '14:00'
    )
    const departTime = this.normalizeTime(
      rawBody.depart_time ?? rawBody.check_out_time ?? rawBody.departTime,
      '12:00'
    )

    const primaryRoomTypeId =
      this.toNumber(rawBody.primary_room_type_id ?? rawBody.primaryRoomTypeId) ??
      this.toNumber(rawBody.rooms?.[0]?.room_type_id ?? rawBody.rooms?.[0]?.roomTypeId)

    const preferredRateTypeId =
      this.toNumber(rawBody.rate_type_id ?? rawBody.rateTypeId ?? rawBody.rate_plan_id ?? rawBody.ratePlanId) ?? null

    const guestId = this.toNumber(rawBody.guest_id ?? rawBody.guestId)
    const existingGuest =
      guestId !== null
        ? await Guest.query().where('id', guestId).where('hotel_id', hotelId).first()
        : null

    const normalizedRooms = Array.isArray(rawBody.rooms)
      ? rawBody.rooms.map((room: any) => ({
          room_type_id: this.toNumber(room.room_type_id ?? room.roomTypeId) ?? 0,
          rate_type_id: this.toNumber(room.rate_type_id ?? room.rateTypeId ?? preferredRateTypeId) ?? undefined,
          meal_plan_id: this.toNumber(room.meal_plan_id ?? room.mealPlanId),
          room_id: this.toNumber(room.room_id ?? room.roomId),
          room_rate: Number(room.room_rate ?? room.roomRate ?? 0),
          adult_count: Number(room.adult_count ?? room.adultCount ?? rawBody.numAdultsTotal ?? 1),
          child_count: Number(room.child_count ?? room.childCount ?? rawBody.numChildrenTotal ?? 0),
          room_rate_id: this.toNumber(room.room_rate_id ?? room.roomRateId) ?? 0,
          tax_includes: Boolean(room.tax_includes ?? room.taxIncludes ?? true),
          meal_plan_rate_include: Boolean(
            room.meal_plan_rate_include ?? room.mealPlanRateInclude ?? false
          ),
          taxes: Number(room.taxes ?? 0),
          arriving_to: String(room.arriving_to ?? room.arrivingTo ?? rawBody.arriving_to ?? ''),
          going_to: String(room.going_to ?? room.goingTo ?? rawBody.going_to ?? ''),
          means_of_transport: String(
            room.means_of_transport ?? room.meansOfTransport ?? rawBody.means_of_transportation ?? ''
          ),
        }))
      : []

    if (normalizedRooms.length === 0 && primaryRoomTypeId && arrivedDate && departDate) {
      const autoRate = await this.findRateForRoomType(hotelId, primaryRoomTypeId, preferredRateTypeId)

      normalizedRooms.push({
        room_type_id: primaryRoomTypeId,
        rate_type_id: preferredRateTypeId ?? autoRate?.rateTypeId ?? undefined,
        meal_plan_id: null,
        room_id: null,
        room_rate: Number(rawBody.room_rate ?? autoRate?.baseRate ?? 0),
        adult_count: Number(rawBody.numAdultsTotal ?? 1),
        child_count: Number(rawBody.numChildrenTotal ?? 0),
        room_rate_id: autoRate?.id ?? 0,
        tax_includes: true,
        meal_plan_rate_include: false,
        taxes: Number(rawBody.tax_amount ?? 0),
        arriving_to: String(rawBody.arriving_to ?? ''),
        going_to: String(rawBody.going_to ?? ''),
        means_of_transport: String(rawBody.means_of_transportation ?? ''),
      })
    } else {
      for (const room of normalizedRooms) {
        if (!room.room_rate_id && room.room_type_id) {
          const autoRate = await this.findRateForRoomType(hotelId, room.room_type_id, room.rate_type_id)
          if (autoRate) {
            room.room_rate_id = autoRate.id
            room.room_rate = room.room_rate || Number(autoRate.baseRate ?? 0)
            room.rate_type_id = room.rate_type_id ?? autoRate.rateTypeId
          }
        }
      }
    }

    const computedTotalAmount =
      normalizedRooms.length > 0
        ? normalizedRooms.reduce((sum, room) => sum + Number(room.room_rate || 0), 0)
        : Number(rawBody.total_amount ?? rawBody.totalEstimatedRevenue ?? 0)

    const paidAmount = Number(rawBody.paid_amount ?? rawBody.payment ?? 0)
    const finalAmount = Number(rawBody.final_amount ?? rawBody.total_amount ?? computedTotalAmount)
    const taxAmount = Number(rawBody.tax_amount ?? 0)

    const reservationNumber = String(
      rawBody.reservation_number ??
        rawBody.reservationNumber ??
        rawBody.ota_reservation_code ??
        rawBody.otaReservationCode ??
        rawBody.reference ??
        ''
    ).trim()

    const guestPayload =
      guestId !== null
        ? undefined
        : {
            firstName: String(rawBody.first_name ?? rawBody.firstName ?? existingGuest?.firstName ?? ''),
            lastName: String(rawBody.last_name ?? rawBody.lastName ?? existingGuest?.lastName ?? ''),
            email: String(rawBody.email ?? existingGuest?.email ?? ''),
            phone: String(rawBody.phone_primary ?? rawBody.phonePrimary ?? existingGuest?.phonePrimary ?? ''),
            address: rawBody.address_line ?? rawBody.addressLine ?? existingGuest?.addressLine ?? null,
            city: rawBody.city ?? existingGuest?.city ?? null,
            country: rawBody.country ?? existingGuest?.country ?? null,
            postalCode: rawBody.zipcode ?? rawBody.postalCode ?? existingGuest?.postalCode ?? null,
            language: rawBody.language ?? existingGuest?.language ?? null,
            idType: rawBody.idType ?? rawBody.id_type ?? null,
            idNumber: rawBody.idNumber ?? rawBody.id_number ?? null,
            passportNumber: rawBody.passportNumber ?? rawBody.passport_number ?? null,
            companyName: rawBody.company_name ?? rawBody.companyName ?? existingGuest?.companyName ?? null,
          }

    return {
      ...rawBody,
      hotel_id: hotelId,
      created_by: this.toNumber(rawBody.created_by ?? rawBody.createdBy ?? actorId) ?? actorId,
      guest_id: guestId,
      guest: guestPayload,
      first_name: String(rawBody.first_name ?? rawBody.firstName ?? existingGuest?.firstName ?? ''),
      last_name: String(rawBody.last_name ?? rawBody.lastName ?? existingGuest?.lastName ?? ''),
      email: String(rawBody.email ?? existingGuest?.email ?? ''),
      phone_primary: String(rawBody.phone_primary ?? rawBody.phonePrimary ?? existingGuest?.phonePrimary ?? ''),
      title: rawBody.title ?? existingGuest?.title ?? null,
      company_name: rawBody.company_name ?? rawBody.companyName ?? existingGuest?.companyName ?? null,
      company_id: this.toNumber(rawBody.company_id ?? rawBody.companyId ?? existingGuest?.companyId),
      profession: rawBody.profession ?? existingGuest?.profession ?? null,
      group_name: rawBody.group_name ?? rawBody.groupName ?? null,
      address_line: rawBody.address_line ?? rawBody.addressLine ?? null,
      country: rawBody.country ?? existingGuest?.country ?? null,
      state: rawBody.state ?? existingGuest?.stateProvince ?? null,
      city: rawBody.city ?? existingGuest?.city ?? null,
      zipcode: rawBody.zipcode ?? rawBody.postalCode ?? existingGuest?.postalCode ?? null,
      hotelId: hotelId,
      reservation_type_id: this.toNumber(rawBody.reservation_type_id ?? rawBody.reservationTypeId),
      booking_source: this.toNumber(rawBody.booking_source ?? rawBody.bookingSourceId),
      business_source: this.toNumber(rawBody.business_source ?? rawBody.businessSourceId),
      reservation_status: rawBody.reservation_status ?? rawBody.reservationStatus ?? rawBody.status ?? 'confirmed',
      status: rawBody.status ?? rawBody.reservationStatus ?? 'confirmed',
      reservation_number: reservationNumber || undefined,
      confirmation_number: rawBody.confirmation_number ?? rawBody.confirmationNumber ?? undefined,
      arrived_date: arrivedDate,
      depart_date: departDate,
      arrived_time: arrivedTime,
      depart_time: departTime,
      check_in_time: arrivedTime,
      check_out_time: departTime,
      rate_type_id: preferredRateTypeId,
      ota_name: rawBody.ota_name ?? rawBody.otaName ?? 'Directus',
      ota_reservation_code: rawBody.ota_reservation_code ?? rawBody.otaReservationCode ?? rawBody.reference ?? null,
      whatsapp_number: rawBody.whatsapp_number ?? rawBody.whatsappNumber ?? null,
      whatsapp_notification_enable:
        rawBody.whatsapp_notification_enable ?? rawBody.whatsappNotificationEnable ?? false,
      special_requests: rawBody.special_requests ?? rawBody.specialNotes ?? rawBody.special_requests ?? '',
      guest_notes: rawBody.guest_notes ?? rawBody.guestNotes ?? '',
      arriving_to: rawBody.arriving_to ?? rawBody.arrivingTo ?? '',
      going_to: rawBody.going_to ?? rawBody.goingTo ?? '',
      means_of_transportation:
        rawBody.means_of_transportation ?? rawBody.meansOfTransportation ?? '',
      rooms: normalizedRooms,
      total_amount: computedTotalAmount,
      tax_amount: taxAmount,
      final_amount: finalAmount,
      paid_amount: paidAmount,
      remaining_amount: Number(rawBody.remaining_amount ?? Math.max(finalAmount - paidAmount, 0)),
      payment_mod: this.toNumber(rawBody.payment_mod ?? rawBody.paymentMethodId),
      payment_type: rawBody.payment_type ?? rawBody.paymentType ?? null,
      bill_to: rawBody.bill_to ?? rawBody.billTo ?? null,
      market_code_id: this.toNumber(rawBody.market_code_id ?? rawBody.marketCodeId),
      payment: Number(rawBody.payment ?? 0),
      isHold: Boolean(rawBody.isHold ?? false),
      holdReleaseDate: rawBody.holdReleaseDate ?? arrivedDate,
      ReleaseTem: Number(rawBody.ReleaseTem ?? 0),
      ReleaseRemindGuestbeforeDays: Number(rawBody.ReleaseRemindGuestbeforeDays ?? 0),
      ReleaseRemindGuestbefore: rawBody.ReleaseRemindGuestbefore ?? null,
      booking_date: rawBody.booking_date ?? rawBody.bookingDate ?? DateTime.now().toISO(),
      numAdultsTotal: Number(rawBody.numAdultsTotal ?? normalizedRooms.reduce((sum: number, room: any) => sum + (room.adult_count || 0), 0)),
      numChildrenTotal: Number(rawBody.numChildrenTotal ?? normalizedRooms.reduce((sum: number, room: any) => sum + (room.child_count || 0), 0)),
    }
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
    const normalizedPayload = await this.buildReservationPayload(rawBody, apiKeyHotelId, actor.id)
    if (normalizedPayload.reservation_number) {
      const existingReservation = await Reservation.query()
        .where('hotel_id', apiKeyHotelId)
        .where('reservation_number', normalizedPayload.reservation_number)
        .select('id', 'reservation_number', 'status')
        .first()

      if (existingReservation) {
        return response.conflict({
          success: false,
          message: `Reservation already exists: ${normalizedPayload.reservation_number}`,
          data: existingReservation,
        })
      }
    }

    const result = await ReservationCreationService.createReservation(normalizedPayload, ctx)

    if (!result.success) {
      return response.badRequest({
        success: false,
        message: result.message || result.error || 'Reservation creation failed',
        validationErrors: result.validationErrors,
      })
    }

    return response.created({
      success: true,
      message: result.message,
      data: result,
    })
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
