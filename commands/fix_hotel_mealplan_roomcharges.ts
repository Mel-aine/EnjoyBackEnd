import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'
import Hotel from '#models/hotel'
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

  private round2(value: number) {
    const num = Number(value)
    if (!Number.isFinite(num)) return 0
    return Math.round(num * 100) / 100
  }

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
      .whereNull('rr.meal_plan_id')
      .where('rate.meal_plan_rate_include', true)
      .whereNotNull('rate.meal_plan_id')
      .select('rr.id')

    const reservationRoomIds = candidates.map((c: any) => Number(c.id)).filter((id) => Number.isFinite(id))

    if (reservationRoomIds.length === 0) {
      this.logger.success(`Hotel ${hotelId}: no reservation_rooms to fix`)
      return
    }

    this.logger.info(`Hotel ${hotelId}: ${reservationRoomIds.length} reservation_rooms to fix`)

    const hotel = await Hotel.query().where('id', hotelId).preload('roomChargesTaxRates').firstOrFail()
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
        SET meal_plan_id = rate.meal_plan_id,
            meal_plan_rate_include = TRUE
        FROM room_rates AS rate
        WHERE rr.room_rate_id = rate.id
          AND rr.hotel_id = ?
          AND rr.meal_plan_id IS NULL
          AND rate.meal_plan_rate_include = TRUE
          AND rate.meal_plan_id IS NOT NULL
        `,
        [hotelId]
      )
      this.logger.success(`Hotel ${hotelId}: reservation_rooms updated (meal plan linked)`)
    } else {
      this.logger.info(`Hotel ${hotelId}: dry-run, skipping reservation_rooms update`)
    }

    const rooms = await ReservationRoom.query()
      .whereIn('id', reservationRoomIds)
      .preload('mealPlan', (mpQuery: any) => {
        mpQuery.preload('extraCharges', (ecQ: any) => {
          ecQ.preload('taxRates')
        })
      })

    let updatedTransactions = 0

    for (const rr of rooms as any[]) {
      const mealPlanIncluded = Boolean(rr.mealPlanRateInclude)
      const mealPlan = rr.mealPlan
      const packageGrossDailyRate = Number(rr.roomRate ?? 0)
      const guestCounts = {
        adults: Number(rr.adults ?? 0),
        children: Number(rr.children ?? 0),
        infants: Number(rr.infants ?? 0),
      }

      let mealPlanGrossPerDay = 0
      if (mealPlanIncluded && mealPlan && Array.isArray(mealPlan.extraCharges) && mealPlan.extraCharges.length > 0) {
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
      const roomNetWithoutTax = percRate > 0 ? roomAdjustedGross / (1 + percRate) : roomAdjustedGross
      const roomTax = Math.max(0, totalRoomAmount - roomNetWithoutTax)

      const roomFinalRate = this.round2(totalRoomAmount)
      const roomFinalNetAmount = this.round2(roomNetWithoutTax)
      const roomFinalRateTaxe = this.round2(roomTax)

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
          })

        updatedTransactions += Number(res || 0)
      }

      if (dryRun) {
        this.logger.info(
          `reservation_room ${rr.id}: room_final_rate=${roomFinalRate} room_final_rate_taxe=${roomFinalRateTaxe} room_final_net_amount=${roomFinalNetAmount}`
        )
      }
    }

    if (!dryRun) {
      this.logger.success(`Hotel ${hotelId}: updated ${updatedTransactions} folio_transactions rows`)
    }
  }
}
