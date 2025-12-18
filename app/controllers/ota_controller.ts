import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Hotel from '#models/hotel'
import RoomType from '#models/room_type'
import RateType from '#models/rate_type'
import Reservation from '#models/reservation'
import ReservationRoomService from '#services/reservation_room_service'
import { PricingService } from '#services/pricingService'

export default class OtaController {
  /**
   * Public: Get basic hotel info for OTA display
   */
  async hotelInfo({ params, response }: HttpContext) {
    try {
      const hotelId = Number(params.hotelId)
      if (isNaN(hotelId)) {
        return response.badRequest({ message: 'Invalid hotelId parameter' })
      }

       const hotel = await Hotel.query()
        .where('id', hotelId)
        .preload('amenity',(amentyQuery) =>{
          amentyQuery
            .select('id', 'amenity_name', 'amenity_type', 'is_deleted')
            .where('amenity_type', 'Hotel')
            .andWhere('is_deleted', false)
          })
        .preload('rooms', (roomQuery) => {
          roomQuery
            .select('id', 'room_number', 'images', 'room_type_id')
            .whereNull('deleted_at')
        })
        .first()
      if (!hotel) {
        return response.notFound({ message: `Hotel ${hotelId} not found` })
      }
        const allRoomImages: string[] = []
          hotel.rooms?.forEach((room) => {
            if (room.images && Array.isArray(room.images)) {
              allRoomImages.push(...room.images)
            }
          })
      return response.ok({
        message: 'Hotel info retrieved successfully',
        data: {
          id: hotel.id,
          name: hotel.hotelName,
          description: hotel.description,
          amenities: hotel.amenity,
          images: allRoomImages,
          address: {
            address: hotel.address,
            city: hotel.city,
            stateProvince: hotel.stateProvince,
            country: hotel.country,
            postalCode: hotel.postalCode,
            longitude: hotel.longitude,
            latitude: hotel.latitude,
          },
          contacts: {
            email: hotel.email,
            website: hotel.website,
            phoneNumber: hotel.phoneNumber,
          },
          policy: {
            checkInTime: hotel.checkInTime,
            checkOutTime: hotel.checkOutTime,
            cancellationPolicy: hotel.cancellationPolicy,
            hotelPolicy: hotel.hotelPolicy,
          },
          finance: {
            currencyCode: hotel.currencyCode,
            taxRate: hotel.taxRate,
          },
          timezone: hotel.timezone,
        },
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Error retrieving hotel info',
        error: error.message,
      })
    }
  }

  /**
   * Public: List room types for a hotel including attached rate types
   */
  async getRoomTypes({ params, response }: HttpContext) {
    try {
      const hotelId = Number(params.hotelId)
      if (isNaN(hotelId)) {
        return response.badRequest({ message: 'Invalid hotelId parameter' })
      }

      const roomTypes = await RoomType.query()
        .where('hotel_id', hotelId)
        .andWhere('is_deleted', false)
        .preload('rateTypes')
        .orderBy('sort_order', 'asc')

      return response.ok({
        message: 'Room types retrieved successfully',
        data: roomTypes.map((rt) => ({
          id: rt.id,
          name: rt.roomTypeName,
          shortCode: rt.shortCode,
          color: rt.color,
          defaultWebInventory: rt.defaultWebInventory,
          baseCapacity: rt.baseAdult + rt.baseChild,
          maxCapacity: rt.maxAdult + rt.maxChild,
          rateTypes: (rt.rateTypes || []).map((r: RateType) => ({
            id: r.id,
            name: r.rateTypeName,
            shortCode: r.shortCode,
          })),
        })),
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Error retrieving room types',
        error: error.message,
      })
    }
  }

  /**
   * Public: Get availability by room type for date range.
   * Includes attached rate type IDs/names for OTA mapping.
   * Query params: startDate (YYYY-MM-DD), endDate (YYYY-MM-DD), adults?, children?
   */

  async getAvailability({ params, request, response }: HttpContext) {
    try {
      console.log('--- getAvailability called ---')

      const hotelId = Number(params.hotelId)
      console.log('Hotel ID:', hotelId)

      if (isNaN(hotelId)) {
        console.warn('Invalid hotelId parameter')
        return response.badRequest({ message: 'Invalid hotelId parameter' })
      }

      const startDateStr = request.input('startDate')
      const endDateStr = request.input('endDate')
      const adults = request.input('adults') ? Number(request.input('adults')) : 1
      const children = request.input('children') ? Number(request.input('children')) : 0

      console.log('Request params:', { startDateStr, endDateStr, adults, children })

      if (!startDateStr || !endDateStr) {
        console.warn('startDate or endDate missing')
        return response.badRequest({ message: 'startDate and endDate are required' })
      }

      const startDate = DateTime.fromISO(startDateStr)
      const endDate = DateTime.fromISO(endDateStr)

      if (!startDate.isValid || !endDate.isValid) {
        console.warn('Invalid date format', { startDateStr, endDateStr })
        return response.badRequest({ message: 'Invalid date format. Use YYYY-MM-DD' })
      }
      if (endDate <= startDate) {
        console.warn('endDate is before or equal to startDate')
        return response.badRequest({ message: 'endDate must be after startDate' })
      }

      const nights = Math.ceil(endDate.diff(startDate, 'days').days)
      console.log('Number of nights:', nights)

      // Fetch hotel info
      const hotel = await Hotel.query()
        .where('id', hotelId)
        .preload('roomChargesTaxRates')
        .firstOrFail()

      // Fetch room types avec amenities
      const roomTypes = await RoomType.query()
        .where('hotel_id', hotelId)
        .andWhere('is_deleted', false)
        .preload('roomRates', (roomRateQuery) => {
          roomRateQuery.preload('rateType').preload('mealPlan')
        })

        .orderBy('sort_order', 'asc')

      console.log(`Found ${roomTypes.length} room types`)

      const service = new ReservationRoomService()
      const pricingService = new PricingService()
      const data = []

      for (const rt of roomTypes) {
        console.log('Processing RoomType:', rt.id, rt.roomTypeName)

        const availableRooms = await service.findAvailableRooms(
          hotelId,
          startDate.toJSDate(),
          endDate.toJSDate(),
          rt.id,
          adults,
          children
        )

        console.log(`Available rooms for RoomType ${rt.id}:`, availableRooms.length)
        if (availableRooms.length === 0) continue

        const totalCapacity = rt.maxAdult + rt.maxChild
        const guestsCount = adults + children
        if (guestsCount > totalCapacity) {
          console.log(`Guests exceed capacity for RoomType ${rt.id}`)
          continue
        }

        const ratePlans = []

        for (const roomRate of rt.roomRates || []) {
          const rateType = roomRate.rateType
          const mealPlan = roomRate.mealPlan

          let pricing = null
          try {
            pricing = await pricingService.calculateStayPrice(
              hotelId,
              rt.id,
              rateType.id,
              startDate.toJSDate(),
              endDate.toJSDate(),
              adults,
              children
            )
          } catch (err) {
            console.error(`Pricing error for RateType ${rateType.id}:`, err)
          }

          const features = []
          if (mealPlan) features.push(mealPlan.name)
          // if (roomRate.taxInclude) features.push('Tax Included')
          if (roomRate.mealPlanRateInclude) features.push('Meal Plan Included')

          ratePlans.push({
            id: rateType.id,
            name: rateType.rateTypeName,
            roomRateId: roomRate.id,
            shortCode: rateType.shortCode,
            features,
            basePrice: pricing?.basePrice ?? null,
            price: pricing?.totalAmount ?? null,
            pricePerNight: pricing?.averageNightlyRate ?? null,
            breakdown: pricing
              ? {
                  basePrice: pricing.baseAmount,
                  taxes: pricing.taxAmount,
                  fees: pricing.feesAmount,
                  discounts: pricing.discountAmount,
                  extraAdultRate:roomRate.extraAdultRate,
                  extraChildRate : roomRate.extraChildRate

                }
              : null,
            currency: pricing?.currency ?? 'XAF',
            minNights: roomRate.minimumNights || 1,
            maxNights: roomRate.maximumNights || null,
          })
        }

        if (ratePlans.length === 0) continue

        data.push({
          id: rt.id,
          name: rt.roomTypeName,
          shortCode: rt.shortCode,
          // description: rt.description || '',
          // images: rt.images || [],
          roomsLeft: availableRooms.length,
          rooms: availableRooms.map((room) => ({
            id: room.id,
            roomNumber: room.roomNumber,
            images:room.images,
            status: room.status,
          })),
          capacity: {
            adults: rt.maxAdult,
            children: rt.maxChild,
            total: totalCapacity,
            baseAdult:rt.baseAdult,
            baseChild:rt.baseChild,
            base: rt.baseAdult + rt.baseChild,
          },
          amenities: rt.roomAmenities || [],
          ratePlans: ratePlans.sort((a, b) => (a.price ?? 0) - (b.price ?? 0)),
        })
      }

      return response.ok({
        message: 'Availability retrieved successfully',
        meta: {
          hotelId,
          hotelName: hotel.hotelName,
          phoneNumber: hotel.phoneNumber,
          address: hotel.address,
          email: hotel.email,
           taxes: hotel.roomChargesTaxRates?.map(tax => ({
              id: tax.taxRateId,
              name: tax.taxName,
              rate: tax.amount,
              percent: tax.percentage,
              type: tax.postingType,
            })) ?? [],
          policies: hotel.hotelPolicy,
          cancellation: hotel.cancellationPolicy,
          startDate: startDateStr,
          endDate: endDateStr,
          nights,
          adults,
          children,
        },
        data: data,
      })
    } catch (error) {
      console.error('Error in getAvailability:', error)
      return response.internalServerError({
        message: 'Error retrieving availability',
        error: error.message,
      })
    }
  }

  /**
   * Récupérer les détails complets d'une réservation par son ID

   */
  public async getReservationById({ request, response, auth, params }: HttpContext) {
    try {
      const reservationId = params.id

      // Validation de l'ID
      if (!reservationId) {
        return response.badRequest({
          message: 'Reservation ID is required',
        })
      }

      // Requête pour récupérer la réservation avec toutes les relations
      const reservation = await Reservation.query()
        .where('id', reservationId)
        .preload('hotel', (hotelQuery) => {
          hotelQuery.select(
            'id',
            'hotel_name',
            'address',
            'email',
            'phoneNumber',
            'city',
            'country'
          )
        })
        .preload('reservationRooms', (roomQuery) => {
          roomQuery
            .preload('roomType', (rtQuery: any) => {
              rtQuery.select('id', 'roomTypeName', 'shortCode')
            })
            .preload('rateType', (rateQuery: any) => {
              rateQuery.select('id', 'rateTypeName', 'shortCode')
            })
            .preload('room', (rQuery: any) => {
              rQuery.select('id', 'roomNumber', 'status')
            })
            .preload('guest', (guestQuery: any) => {
              guestQuery.select('id', 'firstName', 'lastName', 'email', 'phonePrimary', 'country')
            })
        })

        .preload('bookingSource')
        .preload('discount')
        .preload('folios', (folioQuery) => {
          folioQuery.preload('transactions')
        })
        .firstOrFail()

      const balanceSummary = this.calculateBalanceSummary(reservation)

      // Formatter la réponse pour l'OTA
      const formattedReservation = {
        id: reservation.id,
        confirmationNumber: reservation.confirmationNumber,
        reservation_id: reservation.id,
        hotel_id: reservation.hotelId,
        hotel: reservation.hotel
          ? {
              id: reservation.hotel.id,
              name: reservation.hotel.hotelName,
              address: reservation.hotel.address,
              email: reservation.hotel.email,
              phone: reservation.hotel.phoneNumber,
              city: reservation.hotel.city,
              country: reservation.hotel.country,
            }
          : null,

        first_name: reservation.reservationRooms[0]?.guest?.firstName || null,
        last_name: reservation.reservationRooms[0]?.guest?.lastName || null,
        email: reservation.reservationRooms[0]?.guest?.email || null,
        phone_primary: reservation.reservationRooms[0]?.guest?.phonePrimary || null,
        country: reservation.reservationRooms[0]?.guest?.country || null,
        company_name: reservation.companyName,

        arrived_date: reservation.arrivedDate
          ? reservation.arrivedDate.toFormat('yyyy-MM-dd')
          : null,
        depart_date: reservation.departDate ? reservation.departDate.toFormat('yyyy-MM-dd') : null,
        check_in_time: reservation.checkInTime,
        check_out_time: reservation.checkOutTime,
        number_of_nights: reservation.numberOfNights,

        reservation_status: reservation.reservationStatus,
        status: reservation.status,

        rooms: reservation.reservationRooms.map((resRoom) => ({
          id: resRoom.id,
          room_id: resRoom.roomId,
          room_number: resRoom.room?.roomNumber,
          room_type: {
            id: resRoom.roomType.id,
            roomTypeName: resRoom.roomType.roomTypeName,
          },
          rate_type: {
            id: resRoom.rateType.id,
            rateTypeName: resRoom.rateType.rateTypeName,
          },
          room_rate: resRoom.roomRate,
          quantity: 1,
          adult_count: resRoom.adults,
          child_count: resRoom.children,
          tax_includes: resRoom.taxIncludes,
        })),

        total_amount: reservation.totalAmount,
        tax_amount: reservation.taxAmount,
        final_amount: reservation.finalAmount,
        paid_amount: reservation.paidAmount,
        remaining_amount: reservation.remainingAmount,
        discount_amount: reservation.discountAmount || 0,

        // Code promo
        promo_code: reservation.promoCode,

        // Source de réservation
        booking_source: reservation.bookingSource,

        // Informations calculées
        balance_summary: balanceSummary,
        is_confirmed: reservation.isConfirmed,
        is_checked_in: reservation.isCheckedIn,
        is_checked_out: reservation.isCheckedOut,
        is_cancelled: reservation.isCancelled,
        is_active: reservation.isActive,
        has_balance: reservation.hasBalance,
        is_fully_paid: reservation.isFullyPaid,

        // Métadonnées
        created_at: reservation.createdAt,
        updated_at: reservation.updatedAt,
      }

      return response.ok(formattedReservation)
    } catch (error) {
      console.error('Error fetching reservation: %o', error)

      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({
          message: 'Reservation not found',
        })
      }

      return response.internalServerError({
        message: 'An error occurred while fetching the reservation.',
        error: error.message,
      })
    }
  }

  /**
   * Calculer le résumé du solde financier
   */
  private calculateBalanceSummary(reservation: any) {
    const totalAmount = reservation.finalAmount || 0
    const paidAmount = reservation.paidAmount || 0
    const remainingAmount = reservation.remainingAmount || 0

    return {
      total: totalAmount,
      paid: paidAmount,
      remaining: remainingAmount,
      currency: reservation.currency || 'XAF',
      is_fully_paid: paidAmount >= totalAmount,
      payment_percentage: totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0,
    }
  }

  /**
   * get cance0l summary
   */


public async getCancelSummary({ params, response }: HttpContext) {
    try {
        const reservationId = params.id


        if (!reservationId) {
            return response.badRequest({
                message: 'Reservation ID is required',
            })
        }


        const reservation = await Reservation.query()
            .where('id', reservationId)
            .preload('hotel', (hotelQuery) => {
                // Précharge les taxes d'annulation définies sur l'hôtel
                hotelQuery.preload('cancellationRevenueTaxRates')
            })
            .preload('reservationRooms', (roomQuery) => {
                roomQuery
                    .preload('roomType', (rtQuery: any) => {
                        rtQuery.select('id', 'roomTypeName', 'shortCode')
                    })
                    .preload('rateType', (rateQuery: any) => {
                        rateQuery.select('id', 'rateTypeName', 'shortCode')
                    })

                    .preload('guest')
            })
            .firstOrFail()

        // Récupération des données de base
        const firstReservationRoom = reservation.reservationRooms[0]
        // Assure que le guest est pris depuis la première ReservationRoom préchargée
        const guestDisplayName = firstReservationRoom?.guest?.displayName ?? 'N/A'

        const rawCancelFeeHT = Number(reservation.totalAmount ?? 0)

        // Récupère les taxes d'annulation de l'hôtel
        const cancellationTaxes = reservation.hotel?.cancellationRevenueTaxRates || []

        let totalTaxAmount = 0
        const taxDetails: { taxName: string, taxRate: number | null, taxAmount: number }[] = []

        // Application simplifiée des taxes
        for (const taxRate of cancellationTaxes) {

            // On ne considère que les taxes actives
            if (!taxRate.isActive) {
                continue
            }

            let currentTaxAmount = 0;

            if (taxRate.postingType === 'flat_percentage' && taxRate.percentage) {

                const taxPercentage = taxRate.percentage / 100
                currentTaxAmount = rawCancelFeeHT * taxPercentage

                taxDetails.push({
                    taxName: taxRate.taxName,
                    taxRate: taxRate.percentage,
                    taxAmount: parseFloat(currentTaxAmount.toFixed(2)),
                })

            } else if (taxRate.postingType === 'flat_amount' && taxRate.amount) {
                currentTaxAmount = taxRate.amount

                taxDetails.push({
                    taxName: taxRate.taxName,
                    taxRate: taxRate.amount,
                    taxAmount: parseFloat(currentTaxAmount.toFixed(2)),
                })
            }

            totalTaxAmount += currentTaxAmount
        }

        // Frais d'annulation totaux (HT + Taxes)
        const finalCancelFeeTTC = rawCancelFeeHT + totalTaxAmount

        // Montant remboursable (Payé - Frais d'annulation TTC)
        const refundAmount = Number(reservation.paidAmount) - finalCancelFeeTTC

        //  Construction du résumé
        const cancelSummary = {
            reservation_id: reservation.id,
            guest: guestDisplayName,
            roomType: firstReservationRoom?.roomType?.roomTypeName || '',
            rateType: firstReservationRoom?.rateType?.rateTypeName || '',
            check_in_date: reservation.arrivedDate
                ? reservation.arrivedDate.toFormat('yyyy-MM-dd')
                : null,
            check_out_date: reservation.departDate ? reservation.departDate.toFormat('yyyy-MM-dd') : null,

            // Détails financiers de la réservation
            total_amount: reservation.totalAmount,
            paid_amount: reservation.paidAmount,
            currency: 'XAF',

            // Détails des frais d'annulation
            raw_cancel_fee_ht: rawCancelFeeHT,
            total_tax_amount: parseFloat(totalTaxAmount.toFixed(2)),
            final_cancel_fee_ttc: finalCancelFeeTTC,
            tax_details: taxDetails,
            reservationRooms : reservation.reservationRooms.map((resRoom) => ({
                id: resRoom.id
            })),

            // Montant du remboursement
            refund_amount: parseFloat((refundAmount > 0 ? refundAmount : 0).toFixed(2)),
        }

        return response.ok({
            message: 'Cancellation summary retrieved successfully',
            data: cancelSummary,
        })

    } catch (error) {
        console.error('Error fetching cancellation summary: %o', error)

        if (error.code === 'E_ROW_NOT_FOUND') {
            return response.notFound({
                message: 'Reservation not found',
            })
        }

        return response.internalServerError({
            message: 'An error occurred while fetching the cancellation summary.',
            error: error.message,
        })
    }
}
}
