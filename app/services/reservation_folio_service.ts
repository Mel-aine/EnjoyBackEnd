import Folio from '#models/folio'
import Reservation from '#models/reservation'
import Guest from '#models/guest'
import FolioService, { CreateFolioData } from '#services/folio_service'
import { FolioType, TransactionCategory, TransactionStatus, TransactionType } from '#app/enums'
import db from '@adonisjs/lucid/services/db'
import FolioTransaction from '#models/folio_transaction'
import { DateTime } from 'luxon'
import { generateTransactionCode } from '../utils/generate_guest_code.js'

export interface ReservationFolioData {
  reservationId: number
  reservationRoomId?: number
  folioType?: FolioType
  creditLimit?: number
  notes?: string
  createdBy: number
}

export interface WalkInFolioData {
  hotelId: number
  guestId: number
  folioType?: FolioType
  creditLimit?: number
  notes?: string
  createdBy: number
}

export interface AddGuestToReservationData {
  reservationId: number
  guestId: number
  isPrimary?: boolean
  guestType?: 'adult' | 'child' | 'infant'
  roomAssignment?: number
  specialRequests?: string
  dietaryRestrictions?: string
  accessibility?: string
  emergencyContact?: string
  emergencyPhone?: string
  notes?: string
  createdBy: number
}

export default class ReservationFolioService {
  /**
   * Create folio automatically when reservation is confirmed
   */
  static async createFolioForReservation(data: ReservationFolioData): Promise<Folio> {
    return await db.transaction(async (trx) => {
      // Get reservation details
      const reservation = await Reservation.query({ client: trx })
        .where('id', data.reservationId)
        //.preload('hotel')
        .preload('guests', (query) => {
          query.pivotColumns(['is_primary'])
        })
        .firstOrFail()

      // Get the primary guest for the reservation
      let primaryGuest = reservation.guests.find((guest) => guest.$extras.pivot_is_primary)

      // If no primary guest is found, get the first guest or fall back to the original guest_id
      if (!primaryGuest && reservation.guests.length > 0) {
        primaryGuest = reservation.guests[0]
      }

      // If still no guest, try to get the guest from the guest_id column
      if (!primaryGuest && reservation.guestId) {
        primaryGuest = await Guest.findOrFail(reservation.guestId)
      }

      if (!primaryGuest) {
        throw new Error('No guest found for this reservation')
      }

      // Determine folio type based on reservation
      let folioType = data.folioType || FolioType.GUEST
      if (reservation.groupId) {
        folioType = FolioType.GROUP
      }
      /*
      TODO Manage Company Id
      else if (reservation.companyId) {
        folioType = 'company'
      }*/

      // Create folio using the main service
      const folioData: CreateFolioData = {
        hotelId: reservation.hotelId,
        guestId: primaryGuest.id,
        reservationId: data.reservationId,
        reservationRoomId: data.reservationRoomId,
        groupId: reservation.groupId ?? undefined,
        // companyId: reservation.companyId,
        folioType,
        creditLimit: data.creditLimit || 0,
        notes: data.notes || `Auto-created for reservation ${reservation.confirmationNumber}`,
        createdBy: data.createdBy,
      }

      const folio = await FolioService.createFolio(folioData)

      // Update reservation with folio reference
      /* await reservation.useTransaction(trx).merge({
         folioId: folio.id,
         lastModifiedBy: data.createdBy
       }).save()
       */
      return folio
    })
  }

  /**
   * Create folio for walk-in guests
   */
  static async createFolioForWalkIn(data: WalkInFolioData): Promise<Folio> {
    const folioData: CreateFolioData = {
      hotelId: data.hotelId,
      guestId: data.guestId,
      folioType: data.folioType!,
      creditLimit: data.creditLimit || 0,
      notes: data.notes || 'Walk-in guest folio',
      createdBy: data.createdBy,
    }

    return await FolioService.createFolio(folioData)
  }

  /**
   * Create multiple folios for group reservations
   */
  static async createFoliosForGroup(
    reservationId: number,
    guestIds: number[],
    createdBy: number
  ): Promise<Folio[]> {
    return await db.transaction(async (trx) => {
      const reservation = await Reservation.query({ client: trx })
        .where('id', reservationId)
        .preload('guests')
        .firstOrFail()

      const folios: Folio[] = []

      // Create master folio for the group
      const masterFolio = await this.createFolioForReservation({
        reservationId,
        folioType: FolioType.MASTER,
        notes: `Master folio for group reservation ${reservation.confirmationNumber}`,
        createdBy,
      })
      folios.push(masterFolio)

      // Create individual guest folios for each guest in the reservation
      const reservationGuestIds =
        guestIds.length > 0 ? guestIds : reservation.guests.map((g) => g.id)

      for (const guestId of reservationGuestIds) {
        const guestFolioData: CreateFolioData = {
          hotelId: reservation.hotelId,
          guestId,
          reservationId,
          groupId: reservation.groupId ?? undefined,
          folioType: FolioType.GUEST,
          notes: `Guest folio for group reservation ${reservation.confirmationNumber}`,
          createdBy,
        }

        const guestFolio = await FolioService.createFolio(guestFolioData)
        folios.push(guestFolio)
      }

      return folios
    })
  }

  /**
   * Auto-post room charges to folio based on reservation
   */
  static async postRoomCharges(
    reservationId: number,
    postedBy: number,
    externalTrx?: any
  ): Promise<void> {
    const localTrx = externalTrx || (await db.transaction())

    try {
      const reservation = await Reservation.query({ client: localTrx })
        .where('id', reservationId)
        .preload('folios')
        .preload('guests')
        .preload('hotel', (query) => {
          query.preload('roomChargesTaxRates')
        })
        .preload('reservationRooms', (query) => {
          query.preload('room', (roomQuery: any) => {
            roomQuery.preload('roomType')
          })
          query.preload('roomRates')
          query.preload('mealPlan', (mpQuery: any) => {
            mpQuery.preload('extraCharges', (ecQ: any) => {
              ecQ.preload('taxRates')
            })
          })
        })
        .firstOrFail()

      if (!reservation.folios || reservation.folios.length === 0) {
        throw new Error('No folio found for this reservation')
      }

      const lastTx = await FolioTransaction.query({ client: localTrx })
        .where('hotel_id', reservation.hotelId)
        .orderBy('transaction_number', 'desc')
        .first()

      let nextNumber = lastTx?.transactionNumber ? Number(lastTx.transactionNumber) + 1 : 1
      const nowIsoTime = DateTime.now().toISOTime()

      const batch: Partial<FolioTransaction>[] = []

      const normalizeGuestTarget = (value: unknown) => `${value ?? ''}`.trim().toLowerCase()
      const normalizeAssignOnToken = (value: unknown): string | null => {
        const raw = `${value ?? ''}`.trim()
        if (!raw) return null
        const key = raw.replaceAll('_', ' ').toLowerCase()
        if (key === 'check in' || key === 'checkin') return 'CheckIn'
        if (key === 'stay over' || key === 'stayover') return 'StayOver'
        if (key === 'check out' || key === 'checkout') return 'CheckOut'
        return raw
      }
      const parseAssignMealPlanOn = (value: unknown): Set<string> => {
        if (Array.isArray(value)) {
          const tokens = value.map((t) => normalizeAssignOnToken(t)).filter(Boolean) as string[]
          return new Set(tokens)
        }
        const trimmed = `${value ?? ''}`.trim()
        if (!trimmed) return new Set()
        const tokens = trimmed
          .split(',')
          .map((t) => normalizeAssignOnToken(t))
          .filter(Boolean) as string[]
        return new Set(tokens)
      }
      const getGuestCountForTarget = (
        targetGuestType: unknown,
        counts: { adults: number; children: number; infants: number }
      ) => {
        const target = normalizeGuestTarget(targetGuestType)
        if (target === 'adult' || target === 'adults') return counts.adults
        if (target === 'child' || target === 'children') return counts.children
        if (target === 'infant' || target === 'infants') return counts.infants
        return counts.adults + counts.children + counts.infants
      }

      for (const reservationRoom of reservation.reservationRooms) {
        const targetFolio = reservation.folios.find(
          (folio) => folio.reservationRoomId === reservationRoom.id
        )

        if (!targetFolio) {
          console.warn(
            ` No folio found for reservationRoom ${reservationRoom.id}. Skipping charges.`
          )
          continue
        }

        const targetFolioId = targetFolio.id

        const rawNights = reservationRoom.nights
        const effectiveNights = rawNights === 0 ? 1 : rawNights
        const packageGrossDailyRate = Number.parseFloat(`${reservationRoom.roomRate}`) || 0
        const mealPlanIncluded = Boolean((reservationRoom as any).mealPlanRateInclude)
        const mealPlan: any = (reservationRoom as any).mealPlan
        const guestCounts = {
          adults: Number((reservationRoom as any).adults ?? 0),
          children: Number((reservationRoom as any).children ?? 0),
          infants: Number((reservationRoom as any).infants ?? 0),
        }

        const mealPlanComponents: Array<{
          extra: any
          quantity: number
          netAmount: number
          taxAmount: number
          unitPrice: number
          totalGross: number
        }> = []

        let mealPlanGrossPerDay = 0
        if (
          mealPlanIncluded &&
          mealPlan &&
          Array.isArray(mealPlan.extraCharges) &&
          mealPlan.extraCharges.length > 0
        ) {
          for (const extra of mealPlan.extraCharges as any[]) {
            const qtyPerDay = Number(extra.$extras?.pivot_quantity_per_day ?? 0)
            const targetGuestType = extra.$extras?.pivot_target_guest_type
            const baseQty = Math.max(0, qtyPerDay)
            const guestCount = Math.max(0, getGuestCountForTarget(targetGuestType, guestCounts))
            const quantity = extra.fixedPrice ? baseQty : baseQty * guestCount
            const unitPriceGross = Number(extra.rate || 0)
            const totalGross = unitPriceGross * quantity

            if (quantity <= 0 || totalGross <= 0) continue

            mealPlanGrossPerDay += totalGross

            let percentageSum = 0
            let flatSum = 0
            const extraTaxes =
              Array.isArray((extra as any).taxRates) && (extra as any).taxRates.length
                ? (extra as any).taxRates
                : (extra as any).taxRate
                  ? [(extra as any).taxRate]
                  : []

            for (const t of extraTaxes as any[]) {
              const postingType = (t as any)?.postingType
              if (postingType === 'flat_percentage' && (t as any)?.percentage) {
                percentageSum += Number((t as any).percentage) || 0
              } else if (postingType === 'flat_amount' && (t as any)?.amount) {
                flatSum += Number((t as any).amount) || 0
              }
            }

            const adjustedGross = Math.max(0, totalGross - flatSum * quantity)
            const percRate = percentageSum > 0 ? percentageSum / 100 : 0
            const netWithoutTax = percRate > 0 ? adjustedGross / (1 + percRate) : adjustedGross
            const includedTaxAmount = Math.max(0, totalGross - netWithoutTax)
            const unitPriceNet = quantity > 0 ? netWithoutTax / quantity : netWithoutTax

            mealPlanComponents.push({
              extra,
              quantity,
              netAmount: netWithoutTax,
              taxAmount: includedTaxAmount,
              unitPrice: unitPriceNet,
              totalGross,
            })
          }
        }

        const mealPlanAssignOnValue =
          (mealPlan as any)?.assignMealPlanOn ?? (mealPlan as any)?.assign_meal_plan_on
        const mealPlanAssignOn = parseAssignMealPlanOn(mealPlanAssignOnValue)
        const allowMealPlanDays =
          mealPlanIncluded && mealPlanComponents.length > 0 && mealPlanAssignOn.size > 0
        const mealPlanId = allowMealPlanDays ? Number((mealPlan as any)?.id ?? 0) || null : null

        const totalRoomAmount = mealPlanIncluded
          ? Math.max(0, packageGrossDailyRate - mealPlanGrossPerDay)
          : packageGrossDailyRate
        const grossDailyRate = Number.parseFloat(`${reservationRoom.roomRate}`) || 0
        let baseAmount = grossDailyRate
        let totalDailyAmount = grossDailyRate

        // Extract tax from grossDailyRate if hotel has tax rates configured
        const hotel: any = reservation.hotel
        const taxes = hotel?.roomChargesTaxRates ?? []
        let percentageSum = 0
        let flatSum = 0
        for (const tax of taxes) {
          if ((tax as any)?.postingType === 'flat_percentage' && (tax as any)?.percentage) {
            percentageSum += Number((tax as any).percentage) || 0
          } else if ((tax as any)?.postingType === 'flat_amount' && (tax as any)?.amount) {
            flatSum += Number((tax as any).amount) || 0
          }
        }
        const adjustedGross = Math.max(0, grossDailyRate - flatSum)
        const roomAdjustedGross = Math.max(0, totalRoomAmount - flatSum)
        const percRate = percentageSum > 0 ? percentageSum / 100 : 0
        const netWithoutTax = percRate > 0 ? adjustedGross / (1 + percRate) : adjustedGross
        const roomNetWithoutTax =
          percRate > 0 ? roomAdjustedGross / (1 + percRate) : roomAdjustedGross
        const rateBaseRateGross = Number.parseFloat(`${reservationRoom.roomRates?.baseRate}`) || 0
        const baseRateAdjustedGross = Math.max(0, rateBaseRateGross - flatSum)
        const baseRateNetWithoutTax =
          percRate > 0 ? baseRateAdjustedGross / (1 + percRate) : baseRateAdjustedGross
        const roomFinalBaseRate = Math.max(0, baseRateNetWithoutTax)
        baseAmount = netWithoutTax
        totalDailyAmount = grossDailyRate

        for (let night = 1; night <= effectiveNights; night++) {
          const dailyTaxAmount = Math.max(0, totalDailyAmount - baseAmount)
          const transactionDate =
            rawNights === 0
              ? reservation.arrivedDate
              : reservation.arrivedDate?.plus({ days: night - 1 })

          const description =
            rawNights === 0
              ? `Room ${reservationRoom.room?.roomNumber ?? ''} - Day use`
              : `Room ${reservationRoom.room?.roomNumber ?? ''} - Night ${night}`

          const amount = baseAmount
          const totalAmount = baseAmount + dailyTaxAmount

          batch.push({
            hotelId: reservation.hotelId,
            folioId: targetFolioId,
            reservationId: reservation.id,
            reservationRoomId: reservationRoom.id,
            transactionNumber: nextNumber++,
            transactionType: TransactionType.CHARGE,
            category: TransactionCategory.ROOM,
            particular: 'Room Charge',
            description,
            amount,
            quantity: 1,
            unitPrice: amount,
            taxAmount: dailyTaxAmount,
            roomFinalRate: totalRoomAmount,
            roomFinalRateTaxe: totalRoomAmount - roomNetWithoutTax,
            roomFinalNetAmount: roomNetWithoutTax,
            roomFinalBaseRate: roomFinalBaseRate,
            serviceChargeAmount: 0,
            discountAmount: 0,
            netAmount: amount,
            grossAmount: amount,
            totalAmount,
            //reference: `RES-${reservation.confirmationNumber}`,
            notes: `${rawNights === 0 ? ' - Day use' : ` - Night ${night}`}`,
            transactionCode: generateTransactionCode(),
            transactionTime: nowIsoTime,
            // Ensure both dates reflect the exact charge date: arrivedDate + (night - 1)
            postingDate: transactionDate ?? DateTime.now(),
            currentWorkingDate: transactionDate,
            transactionDate,
            status: TransactionStatus.PENDING,
            createdBy: postedBy,
            lastModifiedBy: postedBy,
          } as any)

          if (allowMealPlanDays) {
            const arrivedDate = reservation.arrivedDate
            const checkInDate = arrivedDate ?? transactionDate
            const stayOverDate = arrivedDate
              ? arrivedDate.plus({ days: night })
              : (transactionDate?.plus({ days: 1 }) ?? transactionDate)
            const checkOutDate =
              reservation.departDate ??
              arrivedDate?.plus({ days: effectiveNights }) ??
              transactionDate?.plus({ days: 1 }) ??
              transactionDate

            const shouldCreateCheckIn =
              night === 1 && mealPlanAssignOn.has('CheckIn') && Boolean(checkInDate)
            const shouldCreateStayOver =
              night < effectiveNights && mealPlanAssignOn.has('StayOver') && Boolean(stayOverDate)
            const shouldCreateCheckOut =
              night === effectiveNights && mealPlanAssignOn.has('CheckOut') && Boolean(checkOutDate)

            const pushComponents = (
              dayType: string,
              mealPlanTransactionDate: DateTime | undefined
            ) => {
              for (const comp of mealPlanComponents) {
                batch.push({
                  hotelId: reservation.hotelId,
                  folioId: targetFolioId,
                  reservationId: reservation.id,
                  reservationRoomId: reservationRoom.id,
                  mealPlanId,
                  extraChargeId: Number((comp.extra as any)?.id ?? 0) || null,
                  transactionNumber: nextNumber++,
                  transactionType: TransactionType.CHARGE,
                  category: TransactionCategory.EXTRACT_CHARGE,
                  particular: `${(comp.extra as any)?.name ?? ''} Qt(${comp.quantity})`,
                  description: `${(comp.extra as any)?.name || 'Meal Component'} - ${mealPlan.name || 'Meal Plan'}`,
                  amount: comp.netAmount,
                  quantity: comp.quantity,
                  unitPrice: comp.unitPrice,
                  taxAmount: comp.taxAmount,
                  serviceChargeAmount: 0,
                  discountAmount: 0,
                  netAmount: comp.netAmount,
                  grossAmount: comp.netAmount,
                  totalAmount: comp.netAmount + comp.taxAmount,
                  notes: `meal plan extra charge - ${dayType}`,
                  transactionCode: generateTransactionCode(),
                  transactionTime: nowIsoTime,
                  postingDate: mealPlanTransactionDate ?? DateTime.now(),
                  currentWorkingDate: mealPlanTransactionDate,
                  transactionDate: mealPlanTransactionDate,
                  status: TransactionStatus.PENDING,
                  createdBy: postedBy,
                  lastModifiedBy: postedBy,
                } as any)
              }
            }

            if (shouldCreateCheckIn) pushComponents('CheckIn', checkInDate)
            if (shouldCreateStayOver) pushComponents('StayOver', stayOverDate)
            if (shouldCreateCheckOut) pushComponents('CheckOut', checkOutDate)
          }
        }
      }

      if (batch.length > 0) {
        await FolioTransaction.createMany(batch as any[], { client: localTrx })

        const folioIds = [...new Set(batch.map((tx) => tx.folioId))]
        console.log(`✅ Updating totals for ${folioIds.length} folios:`, folioIds)

        for (const folioId of folioIds) {
          if (folioId) {
            await FolioService.updateFolioTotals(folioId, localTrx)
          }
        }
      }

      // On ne commit que si on a créé la transaction nous-mêmes
      if (!externalTrx) await localTrx.commit()
    } catch (error) {
      if (!externalTrx) await localTrx.rollback()
      throw error
    }
  }

  /**
   * Auto-post taxes and fees to folio
   */
  static async postTaxesAndFees(reservationId: number, postedBy: number): Promise<void> {
    const reservation = await Reservation.query()
      .where('id', reservationId)
      .preload('folios')
      .preload('guests')
      .preload('hotel')
      .preload('reservationRooms', (query) => {
        query.preload('room', (roomQuery) => {
          roomQuery.preload('roomType')
          roomQuery.preload('taxRates')
        })
      })
      .firstOrFail()

    if (!reservation.folios || reservation.folios.length === 0) {
      throw new Error('No folio found for this reservation' + postedBy)
    }

    // Check if reservation or folio is tax exempt
    const primaryFolio =
      reservation.folios.find((f) => f.folioType === 'master') || reservation.folios[0]
    if (primaryFolio.taxExempt) {
      console.log(
        `Skipping tax calculation for reservation ${reservation.confirmationNumber} - folio is tax exempt: ${primaryFolio.taxExemptReason}`
      )
      return
    }

    // Calculate stay duration
    const nights = reservation.nights ?? reservation.numberOfNights

    // Apply taxes to each room based on related tax rates
    for (const reservationRoom of reservation.reservationRooms) {
      const room = reservationRoom.room

      if (room.taxRates && room.taxRates.length > 0) {
        // Calculate room charge amount for tax calculation
        const roomRate = reservationRoom.roomRates
        const baseAmount = Number.parseFloat(`${roomRate.baseRate}`) * nights

        // Calculate extra charges (already implemented above)
        const roomType = room.roomType
        const extraAdults = Math.max(0, reservationRoom.adults - (roomType?.baseAdult ?? 0))
        const extraChildren = Math.max(0, reservationRoom.children - (roomType?.baseChild ?? 0))
        const extraChildAmount =
          extraChildren * Number.parseFloat(`${roomRate.extraChildRate ?? 0}`)
        const extraAdultAmount = extraAdults * Number.parseFloat(`${roomRate.extraAdultRate ?? 0}`)

        const totalRoomAmount = baseAmount + extraChildAmount + extraAdultAmount

        // Apply each tax rate
        for (const taxRate of room.taxRates) {
          const taxAmount = totalRoomAmount * (taxRate.amount ?? 0 / 100)

          await FolioService.postTransaction({
            folioId: primaryFolio.id,
            transactionType: TransactionType.CHARGE,
            category: TransactionCategory.TAX,
            description: `${taxRate.taxName} - Room ${room.roomNumber}`,
            amount: taxAmount,
            quantity: 1,
            unitPrice: taxAmount,
            departmentId: 1,
            revenueCenterId: 1,
            glAccountCode: '2200', // Tax payable account
            reference: `TAX-${reservation.confirmationNumber}`,
            notes: `Auto-posted ${taxRate.taxName} for reservation ${reservation.confirmationNumber}`,
            postedBy,
          })
        }
      }
    }
  }

  /**
   * Get all folios for a reservation (useful for group bookings)
   */
  static async getFoliosForReservation(reservationId: number): Promise<Folio[]> {
    return await Folio.query()
      .where('reservationId', reservationId)
      .preload('guest')
      .preload('transactions', (query) =>
        query
          .whereNull('mealPlanId')
          .orderBy('postingDate', 'asc')
          .preload('paymentMethod')
          .preload('modifier')
          .preload('creator')
      )
      .orderBy('folioType', 'asc')
      .orderBy('createdAt', 'asc')
  }

  /**
   * Check if reservation has folio created
   */
  static async hasReservationFolio(reservationId: number): Promise<boolean> {
    const folio = await Folio.query().where('reservationId', reservationId).first()

    return !!folio
  }

  /**
   * Add a guest to an existing reservation
   */
  static async addGuestToReservation(data: AddGuestToReservationData): Promise<void> {
    return await db.transaction(async (trx) => {
      const reservation = await Reservation.query({ client: trx })
        .where('id', data.reservationId)
        .firstOrFail()

      // If this is set as primary guest, unset other primary guests
      if (data.isPrimary) {
        await db
          .from('reservation_guests')
          .where('reservation_id', data.reservationId)
          .update({ is_primary: false })
      }

      // Add the guest to the reservation
      await db.table('reservation_guests').insert({
        reservation_id: reservation.id,
        guest_id: data.guestId,
        is_primary: data.isPrimary || false,
        guest_type: data.guestType || 'adult',
        room_assignment: data.roomAssignment,
        special_requests: data.specialRequests,
        dietary_restrictions: data.dietaryRestrictions,
        accessibility: data.accessibility,
        emergency_contact: data.emergencyContact,
        emergency_phone: data.emergencyPhone,
        notes: data.notes,
        created_by: data.createdBy,
        created_at: new Date(),
        updated_at: new Date(),
      })
    })
  }

  /**
   * Remove a guest from a reservation
   */
  static async removeGuestFromReservation(reservationId: number, guestId: number): Promise<void> {
    await db
      .from('reservation_guests')
      .where('reservation_id', reservationId)
      .where('guest_id', guestId)
      .delete()
  }

  /**
   * Create individual folios for each guest in a reservation
   */
  static async createIndividualFoliosForGuests(
    reservationId: number,
    createdBy: number
  ): Promise<Folio[]> {
    return await db.transaction(async (trx) => {
      const reservation = await Reservation.query({ client: trx })
        .where('id', reservationId)
        .preload('guests')
        .preload('folios', (folioQuery) => {
          folioQuery.preload('transactions', (transactionQuery) => {
            transactionQuery.where('category', 'room_charge')
          })
        })
        .firstOrFail()

      // Find the primary guest's folio
      const primaryFolio =
        reservation.folios.find((folio) => {
          // Check if this folio belongs to the primary guest
          const primaryGuest = reservation.guests.find((guest) => guest.$extras.pivot_is_primary)
          return primaryGuest && folio.guestId === primaryGuest.id
        }) || reservation.folios[0] // Fallback to first folio if no primary found

      if (!primaryFolio) {
        throw new Error('No primary folio found for reservation')
      }

      const folios: Folio[] = []
      const roomChargeTransactions = primaryFolio.transactions || []

      for (const guest of reservation.guests) {
        // Skip if this is the primary guest (they already have the folio)
        if (guest.$extras.pivot_is_primary) {
          folios.push(primaryFolio)
          continue
        }

        const folioData: CreateFolioData = {
          hotelId: reservation.hotelId,
          guestId: guest.id,
          reservationId,
          groupId: reservation.groupId ?? undefined,
          // companyId: reservation.companyId,
          folioType: FolioType.GUEST,
          creditLimit: 0,
          notes: `Individual folio for ${guest.firstName} ${guest.lastName} - Reservation ${reservation.confirmationNumber}`,
          createdBy,
        }

        const folio = await FolioService.createFolio(folioData)
        folios.push(folio)

        // Copy all room charge transactions from primary folio to this guest's folio
        for (const transaction of roomChargeTransactions) {
          await FolioService.postTransaction({
            folioId: folio.id,
            transactionType: transaction.transactionType,
            category: transaction.category,
            description: `${transaction.description} (Copied from primary folio)`,
            amount: transaction.amount,
            quantity: transaction.quantity,
            unitPrice: transaction.unitPrice,
            taxAmount: transaction.taxAmount,
            serviceChargeAmount: transaction.serviceChargeAmount,
            discountAmount: transaction.discountAmount,
            //departmentCode: transaction.department,
            //revenueCenterCode: transaction.revenueCenter,
            //costCenterCode: transaction.costCenter,
            //glAccountCode: transaction.glAccount,
            //reference: transaction.reference,
            notes: `Copied from primary guest folio - ${transaction.notes || ''}`,
            postedBy: createdBy,
          })
        }
      }

      return folios
    })
  }

  /**
   * Create folios for all guests when reservation is confirmed
   * This method should be called when a reservation status is updated to 'confirmed'
   */
  static async createFoliosOnConfirmation(
    reservationId: number,
    confirmedBy: number
  ): Promise<Folio[]> {
    return await db.transaction(async (trx) => {
      const reservation = await Reservation.query({ client: trx })
        .where('id', reservationId)
        .preload('guests')
        .preload('reservationRooms')
        .firstOrFail()

      // Check if folios already exist
      const existingFolios = await this.getFoliosForReservation(reservationId)
      if (existingFolios.length > 0) {
        return existingFolios
      }

      // Get primary guest
      const primaryGuest =
        reservation.guests.find((guest) => guest.$extras.pivot_is_primary) || reservation.guests[0]

      if (!primaryGuest) {
        throw new Error('No guest found for this reservation')
      }

      const folios: Folio[] = []

      // Create one folio per room for the primary guest
      for (const reservationRoom of reservation.reservationRooms) {
        const folioData: CreateFolioData = {
          hotelId: reservation.hotelId,
          guestId: primaryGuest.id,
          reservationId: reservationId,
          reservationRoomId: reservationRoom.id,
          groupId: reservation.groupId ?? undefined,
          folioType: FolioType.GUEST,
          creditLimit: 0,
          notes: `Folio for room ${reservationRoom.id} - Reservation ${reservation.confirmationNumber}`,
          createdBy: confirmedBy,
        }

        const folio = await FolioService.createFolio(folioData)
        folios.push(folio)
      }

      // Post room charges to folios
      await this.postRoomCharges(reservationId, confirmedBy)

      return folios
    })
  }

  /**
   * Get all guests for a reservation with their pivot data
   */
  static async getReservationGuests(reservationId: number) {
    const reservation = await Reservation.query()
      .where('id', reservationId)
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
      .firstOrFail()

    return reservation.guests
  }

  /**
   * Update guest information in a reservation
   */
  static async updateGuestInReservation(
    reservationId: number,
    guestId: number,
    updateData: Partial<AddGuestToReservationData>
  ): Promise<void> {
    const updateFields: any = {}

    if (updateData.isPrimary !== undefined) updateFields.is_primary = updateData.isPrimary
    if (updateData.guestType) updateFields.guest_type = updateData.guestType
    if (updateData.roomAssignment !== undefined)
      updateFields.room_assignment = updateData.roomAssignment
    if (updateData.specialRequests !== undefined)
      updateFields.special_requests = updateData.specialRequests
    if (updateData.dietaryRestrictions !== undefined)
      updateFields.dietary_restrictions = updateData.dietaryRestrictions
    if (updateData.accessibility !== undefined)
      updateFields.accessibility = updateData.accessibility
    if (updateData.emergencyContact !== undefined)
      updateFields.emergency_contact = updateData.emergencyContact
    if (updateData.emergencyPhone !== undefined)
      updateFields.emergency_phone = updateData.emergencyPhone
    if (updateData.notes !== undefined) updateFields.notes = updateData.notes

    updateFields.updated_at = new Date()

    // If setting as primary, unset other primary guests first
    if (updateData.isPrimary) {
      await db
        .from('reservation_guests')
        .where('reservation_id', reservationId)
        .where('guest_id', '!=', guestId)
        .update({ is_primary: false })
    }

    await db
      .from('reservation_guests')
      .where('reservation_id', reservationId)
      .where('guest_id', guestId)
      .update(updateFields)
  }

  /**
   * Update folio transaction descriptions when room is assigned to reservation room
   */
  static async updateRoomChargeDescriptions(
    reservationRoomId: number,
    roomNumber: string,
    updatedBy: number
  ): Promise<void> {
    const trx = await db.transaction()

    try {
      // Get the reservation room to find associated folio transactions
      const reservationRoom = await db
        .from('reservation_rooms')
        .where('id', reservationRoomId)
        .first()

      if (!reservationRoom) {
        throw new Error('Reservation room not found')
      }

      // Find all room charge transactions for this reservation room
      const folioTransactions = await db
        .from('folio_transactions')
        .join('folios', 'folio_transactions.folio_id', 'folios.id')
        .where('folios.reservation_id', reservationRoom.reservation_id)
        .where('folio_transactions.transaction_type', TransactionType.CHARGE)
        .where('folio_transactions.category', TransactionCategory.ROOM)
        .where('folio_transactions.description', 'like', 'Room % - Night %')
        .select('folio_transactions.id', 'folio_transactions.description')

      // Update each transaction description to include the room number
      for (const transaction of folioTransactions) {
        // Extract the night number from the existing description
        const nightMatch = transaction.description.match(/Night (\d+)/)
        const nightNumber = nightMatch ? nightMatch[1] : ''

        const newDescription = `Room ${roomNumber} - Night ${nightNumber}`

        await db.from('folio_transactions').where('id', transaction.id).update({
          description: newDescription,
          last_modified_by: updatedBy,
          updated_at: new Date(),
        })
      }

      await trx.commit()
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  /**
   * Remove room numbers from folio transaction descriptions when room is unassigned
   */
  static async removeRoomChargeDescriptions(
    reservationRoomId: number,
    updatedBy: number
  ): Promise<void> {
    const trx = await db.transaction()

    try {
      // Get the reservation room to find associated folio transactions
      const reservationRoom = await db
        .from('reservation_rooms')
        .where('id', reservationRoomId)
        .first()

      if (!reservationRoom) {
        throw new Error('Reservation room not found')
      }

      // Find all room charge transactions for this reservation room that have room numbers
      const folioTransactions = await db
        .from('folio_transactions')
        .join('folios', 'folio_transactions.folio_id', 'folios.id')
        .where('folios.reservation_id', reservationRoom.reservation_id)
        .where('folio_transactions.transaction_type', TransactionType.CHARGE)
        .where('folio_transactions.category', TransactionCategory.ROOM)
        .where('folio_transactions.description', 'like', 'Room % - Night %')
        .select('folio_transactions.id', 'folio_transactions.description')

      // Update each transaction description to remove the room number
      for (const transaction of folioTransactions) {
        // Extract the night number from the existing description
        const nightMatch = transaction.description.match(/Room .+ - Night (\d+)/)
        const nightNumber = nightMatch ? nightMatch[1] : ''

        const newDescription = `Room  - Night ${nightNumber}`

        await db.from('folio_transactions').where('id', transaction.id).update({
          description: newDescription,
          last_modified_by: updatedBy,
          updated_at: new Date(),
        })
      }

      await trx.commit()
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }
}
