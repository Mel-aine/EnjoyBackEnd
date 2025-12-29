import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'
import Hotel from '#models/hotel'
import MealPlan from '#models/meal_plan'
import ReservationRoom from '#models/reservation_room'

export default class FixHotelMealplanRoomcharges extends BaseCommand {
  public static commandName = 'hotel:fix-mealplan-roomcharges'
  public static description =
    'For a hotel, link missing mealPlan on reservation_rooms and recompute room_final_* fields'
  public static options: CommandOptions = { startApp: true }

  @flags.number({ description: 'Hotel ID', alias: 'h' })
  declare hotelId: number | undefined

  @flags.boolean({ description: 'Do not write changes', alias: 'd' })
  declare dryRun: boolean

  private normalizeGuestTarget(value: unknown) {
    return `${value ?? ''}`.trim().toLowerCase()
  }

  private getGuestCountForTarget(
    targetGuestType: unknown,
    counts: { adults: number; children: number; infants: number }
  ) {
    const target = this.normalizeGuestTarget(targetGuestType)
    if (target === 'adult' || target === 'adults') return counts.adults
    if (target === 'child' || target === 'children') return counts.children
    if (target === 'infant' || target === 'infants') return counts.infants
    return counts.adults + counts.children + counts.infants
  }

  public async run() {
    const hotelId = Number(this.hotelId ?? 3)
    const dryRun = Boolean(this.dryRun)

    if (!Number.isFinite(hotelId) || hotelId <= 0) {
      this.logger.error('Invalid --hotel-id')
      return
    }

    const candidates = await db
      .from('reservation_rooms as rr')
      .join('room_rates as rate', 'rate.id', 'rr.room_rate_id')
      .where('rr.hotel_id', hotelId)
      .where('rate.meal_plan_rate_include', true)
      .whereNotNull('rate.meal_plan_id')
      .select(
        'rr.id',
        'rr.room_rate_id as rr_room_rate_id',
        'rr.meal_plan_id as rr_meal_plan_id',
        'rr.meal_plan_rate_include as rr_meal_plan_rate_include',
        'rate.meal_plan_rate_include as rate_meal_plan_rate_include',
        'rate.meal_plan_id as rate_meal_plan_id',
        'rate.tax_include as rate_tax_include',
        'rate.base_rate as rate_base_rate'
      )

    const reservationRoomIds = candidates
      .map((c: any) => Number(c.id))
      .filter((id) => Number.isFinite(id))
    const effectiveMealPlanIdByReservationRoomId = new Map<number, number>()
    const roomRateInfoByReservationRoomId = new Map<
      number,
      {
        roomRateId: number | null
        rrMealPlanId: number | null
        rrMealPlanRateInclude: boolean
        rateMealPlanId: number | null
        rateMealPlanRateInclude: boolean
        rateTaxInclude: boolean
        rateBaseRate: number | null
      }
    >()
    let missingMealPlanLinks = 0
    for (const c of candidates as any[]) {
      const rrId = Number(c.id)
      if (!Number.isFinite(rrId)) continue
      const rrRoomRateId =
        c.rr_room_rate_id !== null && c.rr_room_rate_id !== undefined
          ? Number(c.rr_room_rate_id)
          : null
      const rrMealPlanId =
        c.rr_meal_plan_id !== null && c.rr_meal_plan_id !== undefined
          ? Number(c.rr_meal_plan_id)
          : null
      const rrMealPlanRateInclude = Boolean(c.rr_meal_plan_rate_include)
      const rateMealPlanRateInclude = Boolean(c.rate_meal_plan_rate_include)
      const rateMealPlanId =
        c.rate_meal_plan_id !== null && c.rate_meal_plan_id !== undefined
          ? Number(c.rate_meal_plan_id)
          : null
      const rateTaxInclude = Boolean(c.rate_tax_include)
      const rateBaseRate =
        c.rate_base_rate !== null && c.rate_base_rate !== undefined
          ? Number(c.rate_base_rate)
          : null
      const effectiveMealPlanId = Number.isFinite(rrMealPlanId as any)
        ? (rrMealPlanId as number)
        : rateMealPlanId
      if (effectiveMealPlanId && Number.isFinite(effectiveMealPlanId)) {
        effectiveMealPlanIdByReservationRoomId.set(rrId, effectiveMealPlanId)
      }
      if (!rrMealPlanId && rateMealPlanId) missingMealPlanLinks += 1

      roomRateInfoByReservationRoomId.set(rrId, {
        roomRateId: Number.isFinite(rrRoomRateId as any) ? (rrRoomRateId as number) : null,
        rrMealPlanId: Number.isFinite(rrMealPlanId as any) ? (rrMealPlanId as number) : null,
        rrMealPlanRateInclude,
        rateMealPlanId: Number.isFinite(rateMealPlanId as any) ? (rateMealPlanId as number) : null,
        rateMealPlanRateInclude,
        rateTaxInclude,
        rateBaseRate: Number.isFinite(rateBaseRate as any) ? (rateBaseRate as number) : null,
      })
    }

    if (reservationRoomIds.length === 0) {
      this.logger.success(`Hotel ${hotelId}: no reservation_rooms to fix`)
      return
    }

    this.logger.info(
      `Hotel ${hotelId}: ${reservationRoomIds.length} reservation_rooms to fix (${missingMealPlanLinks} missing meal_plan_id)`
    )

    const hotel = await Hotel.query()
      .where('id', hotelId)
      .preload('roomChargesTaxRates')
      .firstOrFail()
    const taxes: any[] = (hotel as any).roomChargesTaxRates ?? []

    let percentageSum = 0
    let flatSum = 0
    for (const tax of taxes) {
      if ((tax as any)?.postingType === 'flat_percentage' && (tax as any)?.percentage) {
        percentageSum += Number((tax as any).percentage) || 0
      } else if ((tax as any)?.postingType === 'flat_amount' && (tax as any)?.amount) {
        flatSum += Number((tax as any).amount) || 0
      }
    }
    const percRate = percentageSum > 0 ? percentageSum / 100 : 0

    if (!dryRun) {
      await db.rawQuery(
        `
        UPDATE reservation_rooms AS rr
        SET meal_plan_id = COALESCE(rr.meal_plan_id, rate.meal_plan_id),
            meal_plan_rate_include = TRUE
        FROM room_rates AS rate
        WHERE rr.room_rate_id = rate.id
          AND rr.hotel_id = ?
          AND rate.meal_plan_rate_include = TRUE
          AND rate.meal_plan_id IS NOT NULL
        `,
        [hotelId]
      )
      this.logger.success(`Hotel ${hotelId}: reservation_rooms updated (meal plan linked)`)
    } else {
      this.logger.info(`Hotel ${hotelId}: dry-run, skipping reservation_rooms update`)
    }

    const uniqueMealPlanIds = Array.from(
      new Set(
        Array.from(effectiveMealPlanIdByReservationRoomId.values()).filter(
          (id) => Number.isFinite(id) && id > 0
        )
      )
    )

    const mealPlans = uniqueMealPlanIds.length
      ? await MealPlan.query()
          .whereIn('id', uniqueMealPlanIds)
          .preload('extraCharges', (ecQ: any) => {
            ecQ.preload('taxRates')
          })
      : []
    const mealPlanById = new Map<number, any>()
    for (const mp of mealPlans as any[]) {
      mealPlanById.set(Number(mp.id), mp)
    }

    const rooms = await ReservationRoom.query()
      .whereIn('id', reservationRoomIds)
      .preload('roomRates')

    let updatedTransactions = 0

    for (const rr of rooms as any[]) {
      const roomRateInfo = roomRateInfoByReservationRoomId.get(Number(rr.id)) ?? null
      const effectiveMealPlanId = effectiveMealPlanIdByReservationRoomId.get(Number(rr.id)) ?? null
      const mealPlanId = Number((rr as any).mealPlanId ?? effectiveMealPlanId ?? 0)
      const mealPlanIncluded = dryRun
        ? Boolean(mealPlanId)
        : Boolean((rr as any).mealPlanRateInclude)
      const mealPlan = mealPlanId ? mealPlanById.get(mealPlanId) : null
      const packageGrossDailyRate = Number(rr.roomRate ?? 0)
      const guestCounts = {
        adults: Number(rr.adults ?? 0),
        children: Number(rr.children ?? 0),
        infants: Number(rr.infants ?? 0),
      }

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
          const guestCount = Math.max(0, this.getGuestCountForTarget(targetGuestType, guestCounts))
          const quantity = extra.fixedPrice ? baseQty : baseQty * guestCount
          const unitPriceGross = Number(extra.rate || 0)
          const totalGross = unitPriceGross * quantity
          if (quantity <= 0 || totalGross <= 0) continue
          mealPlanGrossPerDay += totalGross
        }
      }

      const totalRoomAmount = mealPlanIncluded
        ? Math.max(0, packageGrossDailyRate - mealPlanGrossPerDay)
        : packageGrossDailyRate

      const roomAdjustedGross = Math.max(0, totalRoomAmount - flatSum)
      const roomNetWithoutTax =
        percRate > 0 ? roomAdjustedGross / (1 + percRate) : roomAdjustedGross

      const rateBaseRateGross = Number.parseFloat(`${rr.roomRates?.baseRate}`) || 0
      console.log('base rate', rateBaseRateGross)
      const baseRateAdjustedGross = Math.max(0, rateBaseRateGross - flatSum)
      const baseRateNetWithoutTax =
        percRate > 0 ? baseRateAdjustedGross / (1 + percRate) : baseRateAdjustedGross
      const roomFinalBaseRate = Math.max(0, baseRateNetWithoutTax)
      const roomFinalRate = totalRoomAmount
      const roomFinalNetAmount = roomNetWithoutTax
      const roomFinalRateTaxe = totalRoomAmount - roomNetWithoutTax

      if (!dryRun) {
        const res = await db
          .from('folio_transactions')
          .where('hotel_id', hotelId)
          .where('reservation_room_id', rr.id)
          .where('transaction_type', 'charge')
          .where('category', 'room')
          .update({
            room_final_rate: roomFinalRate,
            room_final_rate_taxe: roomFinalRateTaxe,
            room_final_net_amount: roomFinalNetAmount,
            room_final_base_rate: roomFinalBaseRate,
          })

        updatedTransactions += Number(res || 0)
      }

      if (dryRun) {
        this.logger.info(
          `reservation_room ${rr.id}: room_rate_id=${roomRateInfo?.roomRateId ?? ''} rate_base_rate=${roomRateInfo?.rateBaseRate ?? ''} rate_tax_include=${roomRateInfo?.rateTaxInclude ?? ''} rr_meal_plan_rate_include=${roomRateInfo?.rrMealPlanRateInclude ?? ''} rate_meal_plan_rate_include=${roomRateInfo?.rateMealPlanRateInclude ?? ''} rr_meal_plan_id=${roomRateInfo?.rrMealPlanId ?? ''} rate_meal_plan_id=${roomRateInfo?.rateMealPlanId ?? ''} room_final_rate=${roomFinalRate} room_final_rate_taxe=${roomFinalRateTaxe} room_final_net_amount=${roomFinalNetAmount} room_final_base_rate=${roomFinalBaseRate}`
        )
      }
    }

    if (!dryRun) {
      this.logger.success(
        `Hotel ${hotelId}: updated ${updatedTransactions} folio_transactions rows`
      )
    }
  }
}
