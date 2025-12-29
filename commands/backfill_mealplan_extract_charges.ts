import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import Reservation from '#models/reservation'
import FolioTransaction from '#models/folio_transaction'
import FolioService from '#services/folio_service'
import { generateTransactionCode } from '../app/utils/generate_guest_code.js'
import { TransactionCategory, TransactionStatus, TransactionType } from '#app/enums'

export default class BackfillMealplanExtractCharges extends BaseCommand {
  public static commandName = 'hotel:backfill-mealplan-extract'
  public static description =
    'Backfill missing meal-plan EXTRACT_CHARGE transactions for a hotel'
  public static options: CommandOptions = { startApp: true }

  @flags.number({ description: 'Hotel ID', alias: 'h' })
  declare hotelId: number | undefined

  @flags.boolean({ description: 'Preview only (no writes)', alias: 'd' })
  declare dryRun: boolean

  @flags.number({ description: 'Limit reservations scanned', alias: 'l' })
  declare limit: number | undefined

  @flags.number({ description: 'User ID for createdBy/lastModifiedBy', alias: 'u' })
  declare postedBy: number | undefined

  private normalizeGuestTarget(value: unknown) {
    return `${value ?? ''}`.trim().toLowerCase()
  }

  private normalizeAssignOnToken(value: unknown): string | null {
    const raw = `${value ?? ''}`.trim()
    if (!raw) return null
    const key = raw.replaceAll('_', ' ').toLowerCase()
    if (key === 'check in' || key === 'checkin') return 'CheckIn'
    if (key === 'stay over' || key === 'stayover') return 'StayOver'
    if (key === 'check out' || key === 'checkout') return 'CheckOut'
    return raw
  }

  private parseAssignMealPlanOn(value: unknown): Set<string> {
    if (Array.isArray(value)) {
      const tokens = value.map((t) => this.normalizeAssignOnToken(t)).filter(Boolean) as string[]
      return new Set(tokens)
    }
    const trimmed = `${value ?? ''}`.trim()
    if (!trimmed) return new Set()
    const tokens = trimmed
      .split(',')
      .map((t) => this.normalizeAssignOnToken(t))
      .filter(Boolean) as string[]
    return new Set(tokens)
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

  private isoDate(d: DateTime | null | undefined) {
    return d ? d.toISODate() : null
  }

  public async run() {
    const hotelId = Number(this.hotelId ?? 3)
    const dryRun = Boolean(this.dryRun)
    const limit = Number(this.limit ?? 0)
    const postedByDefault = Number(this.postedBy ?? 1)

    if (!Number.isFinite(hotelId) || hotelId <= 0) {
      this.logger.error('Invalid --hotel-id')
      return
    }
    if (!Number.isFinite(postedByDefault) || postedByDefault <= 0) {
      this.logger.error('Invalid --posted-by')
      return
    }

    const lastTx = await FolioTransaction.query()
      .where('hotelId', hotelId)
      .orderBy('transactionNumber', 'desc')
      .first()
    let nextHotelTransactionNumber = Number(lastTx?.transactionNumber ?? 0) + 1

    const query = Reservation.query()
      .where('hotelId', hotelId)
      .whereNotNull('arrivedDate')
      .preload('reservationRooms', (q) =>
        q
          .preload('room')
          .preload('mealPlan', (mpQuery) =>
            mpQuery.preload('extraCharges', (ecQ) => {
              ecQ.preload('taxRates')
            })
          )
      )
      .preload('folios', (q) =>
        q.preload('transactions', (tr) =>
          tr
            .where('transactionType', TransactionType.CHARGE)
            .whereIn('category', [TransactionCategory.ROOM, TransactionCategory.EXTRACT_CHARGE])
        )
      )

    if (limit > 0) query.limit(limit)

    const reservations = await query

    let reservationsScanned = 0
    let reservationsWithMissing = 0
    let transactionsToCreate = 0
    let transactionsCreated = 0
    let affectedFolios = new Set<number>()

    const nowIsoTime = DateTime.now().toFormat('HH:mm:ss')

    for (const reservation of reservations as any[]) {
      reservationsScanned += 1
      const postedBy = Number((reservation as any)?.createdBy ?? postedByDefault)
      if (!Number.isFinite(postedBy) || postedBy <= 0) continue

      const arrivedDate: DateTime | null = (reservation as any).arrivedDate ?? null
      if (!arrivedDate) continue

      const allTx = (reservation.folios || []).flatMap((f: any) => f.transactions || [])
      const roomChargeTx = allTx.filter(
        (t: any) =>
          t.transactionType === TransactionType.CHARGE &&
          t.category === TransactionCategory.ROOM &&
          !t.isVoided &&
          t.status !== TransactionStatus.VOIDED
      )
      if (roomChargeTx.length === 0) continue

      const extractTx = allTx.filter(
        (t: any) =>
          t.transactionType === TransactionType.CHARGE &&
          t.category === TransactionCategory.EXTRACT_CHARGE &&
          !t.isVoided &&
          t.status !== TransactionStatus.VOIDED
      )

      const getTargetFolioIdForRoom = (reservationRoomId: number) => {
        const found = (reservation.folios || []).find((f: any) => f.reservationRoomId === reservationRoomId)
        if (found?.id) return found.id
        const fallback = roomChargeTx.find((t: any) => t.reservationRoomId === reservationRoomId)
        return fallback?.folioId ?? null
      }

      const batch: any[] = []
      let hasMissingForReservation = false

      for (const rr of reservation.reservationRooms as any[]) {
        if (!rr) continue
        if (!Boolean(rr.mealPlanRateInclude)) continue

        const mealPlan: any = rr.mealPlan
        if (!mealPlan) continue

        const mealPlanAssignOn = this.parseAssignMealPlanOn(
          (mealPlan as any)?.assignMealPlanOn ?? (mealPlan as any)?.assign_meal_plan_on
        )
        if (!mealPlanAssignOn.size) continue

        const extraCharges = Array.isArray(mealPlan.extraCharges) ? mealPlan.extraCharges : []
        if (!extraCharges.length) continue

        const rawNights = Number(rr.nights ?? 0)
        const effectiveNights = rawNights === 0 ? 1 : rawNights
        const guestCounts = {
          adults: Number(rr.adults ?? 0),
          children: Number(rr.children ?? 0),
          infants: Number(rr.infants ?? 0),
        }

        const mealPlanComponents: Array<{
          extra: any
          extraChargeId: number | null
          quantity: number
          netAmount: number
          taxAmount: number
          unitPrice: number
        }> = []

        for (const extra of extraCharges as any[]) {
          const qtyPerDay = Number(
            extra.$extras?.pivot_quantity_per_day ??
              extra.$extras?.quantity_per_day ??
              extra.$extras?.pivot_quantityPerDay ??
              extra.$extras?.quantityPerDay ??
              0
          )
          const targetGuestType =
            extra.$extras?.pivot_target_guest_type ??
            extra.$extras?.target_guest_type ??
            extra.$extras?.pivot_targetGuestType ??
            extra.$extras?.targetGuestType
          const baseQty = Math.max(0, qtyPerDay)
          const guestCount = Math.max(0, this.getGuestCountForTarget(targetGuestType, guestCounts))
          const quantity = (extra as any).fixedPrice ? baseQty : baseQty * guestCount
          const unitPriceGross = Number(extra.rate || 0)
          const totalGross = unitPriceGross * quantity

          if (quantity <= 0 || totalGross <= 0) continue

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
            extraChargeId: Number((extra as any)?.id ?? 0) || null,
            quantity,
            netAmount: netWithoutTax,
            taxAmount: includedTaxAmount,
            unitPrice: unitPriceNet,
          })
        }

        if (!mealPlanComponents.length) continue

        const folioId = getTargetFolioIdForRoom(Number(rr.id))
        if (!folioId) continue

        for (let night = 1; night <= effectiveNights; night++) {
          const transactionDate =
            rawNights === 0 ? arrivedDate : arrivedDate?.plus({ days: night - 1 }) ?? arrivedDate

          const checkInDate = arrivedDate ?? transactionDate
          const stayOverDate = arrivedDate ? arrivedDate.plus({ days: night }) : transactionDate?.plus({ days: 1 })
          const checkOutDate =
            (reservation as any).departDate ??
            arrivedDate.plus({ days: effectiveNights }) ??
            transactionDate?.plus({ days: 1 }) ??
            transactionDate

          const shouldCreateCheckIn = night === 1 && mealPlanAssignOn.has('CheckIn') && Boolean(checkInDate)
          const shouldCreateStayOver = night < effectiveNights && mealPlanAssignOn.has('StayOver') && Boolean(stayOverDate)
          const shouldCreateCheckOut = night === effectiveNights && mealPlanAssignOn.has('CheckOut') && Boolean(checkOutDate)

          const maybePush = (dayType: string, d: DateTime | null | undefined) => {
            const dayIso = this.isoDate(d)
            if (!dayIso) return

            for (const comp of mealPlanComponents) {
              const already = extractTx.some(
                (t: any) =>
                  Number(t.reservationRoomId) === Number(rr.id) &&
                  Number(t.extraChargeId ?? 0) === Number(comp.extraChargeId ?? 0) &&
                  this.isoDate(t.postingDate) === dayIso &&
                  !t.isVoided &&
                  t.status !== TransactionStatus.VOIDED
              )
              if (already) continue

              hasMissingForReservation = true
              transactionsToCreate += 1

              if (dryRun) {
                this.logger.info(
                  `DRY-RUN create: res=${reservation.id} rr=${rr.id} folio=${folioId} night=${night}/${effectiveNights} dayType=${dayType} date=${dayIso} extra=${comp.extraChargeId} qty=${comp.quantity}`
                )
                continue
              }

              batch.push({
                hotelId: reservation.hotelId,
                folioId,
                reservationId: reservation.id,
                reservationRoomId: rr.id,
                mealPlanId: Number((mealPlan as any)?.id ?? 0) || null,
                extraChargeId: comp.extraChargeId,
                transactionNumber: nextHotelTransactionNumber++,
                transactionType: TransactionType.CHARGE,
                category: TransactionCategory.EXTRACT_CHARGE,
                particular: `${(comp.extra as any)?.name ?? ''} Qt(${comp.quantity})`,
                description: `${(comp.extra as any)?.name || 'Meal Component'} - ${mealPlan.name || 'Meal Plan'}`,
                amount: Number(comp.netAmount.toFixed(2)),
                quantity: Number(comp.quantity) || 0,
                unitPrice: Number(comp.unitPrice.toFixed(2)),
                taxAmount: Number(comp.taxAmount.toFixed(2)),
                serviceChargeAmount: 0,
                discountAmount: 0,
                netAmount: Number(comp.netAmount.toFixed(2)),
                grossAmount: Number(comp.netAmount.toFixed(2)),
                totalAmount: Number((comp.netAmount + comp.taxAmount).toFixed(2)),
                notes: ``,
                transactionCode: generateTransactionCode(),
                transactionTime: nowIsoTime,
                postingDate: d ?? DateTime.now(),
                currentWorkingDate: d ?? null,
                transactionDate: d ?? DateTime.now(),
                status: TransactionStatus.PENDING,
                createdBy: postedBy,
                lastModifiedBy: postedBy,
              } as any)
            }
          }

          if (shouldCreateCheckIn) maybePush('CheckIn', checkInDate)
          if (shouldCreateStayOver) maybePush('StayOver', stayOverDate)
          if (shouldCreateCheckOut) maybePush('CheckOut', checkOutDate)
        }
      }

      if (hasMissingForReservation) {
        reservationsWithMissing += 1
      }

      if (!dryRun && batch.length > 0) {
        const trx = await db.transaction()
        try {
          const createMany = async () => {
            await FolioTransaction.createMany(batch as any[], { client: trx })
          }

          try {
            await createMany()
          } catch (error) {
            const message = (error as any)?.message ?? String(error)
            if (message.includes('folio_transactions_hotel_id_transaction_number_unique')) {
              const lastInserted = await FolioTransaction.query({ client: trx })
                .where('hotelId', hotelId)
                .orderBy('transactionNumber', 'desc')
                .first()
              nextHotelTransactionNumber = Math.max(
                nextHotelTransactionNumber,
                Number(lastInserted?.transactionNumber ?? 0) + 1
              )
              for (const tx of batch) {
                tx.transactionNumber = nextHotelTransactionNumber++
              }
              await createMany()
            } else {
              throw error
            }
          }

          for (const tx of batch) {
            if (tx.folioId) affectedFolios.add(Number(tx.folioId))
          }
          const uniqueFolioIds = [...new Set(batch.map((t) => Number(t.folioId)).filter(Boolean))]
          for (const folioId of uniqueFolioIds) {
            await FolioService.updateFolioTotals(folioId, trx)
          }
          await trx.commit()
          transactionsCreated += batch.length
        } catch (error) {
          await trx.rollback()
          this.logger.error(
            `Failed reservation ${reservation.id}: ${(error as any)?.message ?? String(error)}`
          )
        }
      }
    }

    const affectedFolioCount = affectedFolios.size
    this.logger.success(
      `Hotel ${hotelId}: scanned=${reservationsScanned} reservationsWithMissing=${reservationsWithMissing} toCreate=${transactionsToCreate} created=${transactionsCreated} affectedFolios=${affectedFolioCount} dryRun=${dryRun}`
    )
  }
}

