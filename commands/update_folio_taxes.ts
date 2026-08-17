import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import FolioTransaction from '#models/folio_transaction'
import TaxRate from '#models/tax_rate'
import { TransactionCategory, TransactionType } from '#app/enums'

export default class UpdateFolioTaxes extends BaseCommand {
  public static commandName = 'update:folio_taxes'
  public static description = 'Update taxes and amounts for MealPlan and Room transactions'
  public static options: CommandOptions = { startApp: true }

  @flags.number({ description: 'Hotel ID', alias: 'h' })
  declare hotelId: number | undefined

  @flags.number({ description: 'Reservation ID', alias: 'r' })
  declare reservationId: number | undefined

  @flags.boolean({ description: 'Dry run - preview changes without saving', alias: 'd' })
  declare dryRun: boolean

  public async run() {
    const round2 = (value: number) => Math.round(value * 100) / 100

    const baseQuery = FolioTransaction.query()

    if (this.dryRun) {
      this.logger.info('Running in DRY RUN mode. No changes will be saved to the database.')
    }

    if (this.hotelId) {
      baseQuery.where('hotelId', this.hotelId)
      this.logger.info(`Filtering by hotelId = ${this.hotelId}`)
    }

    if (this.reservationId) {
      baseQuery.whereHas('reservationRoom', (rrQ) => {
        rrQ.where('reservationId', this.reservationId!)
      })
      this.logger.info(`Filtering by reservationId = ${this.reservationId}`)
    }

    // Part 1: MealPlan Transactions
    this.logger.info('Processing MealPlan Transactions...')
    const mealPlanTransactions = await baseQuery.clone()
      .whereNotNull('mealPlanId')
      .preload('mealPlan', (q) => {
        q.preload('extraCharges', (ecQ) => {
          ecQ.preload('taxRates')
        })
      })
      .preload('extraCharge', (q) => {
        q.preload('taxRates')
      })

    let mpCount = 0
    for (const trx of mealPlanTransactions) {
      if (!trx.mealPlan) continue

      const taxRates = new Map<number, TaxRate>()
      if (trx.extraCharge) {
        for (const tr of trx.extraCharge.taxRates) {
          taxRates.set(tr.taxRateId, tr)
        }
      } else {
        for (const ec of trx.mealPlan.extraCharges) {
          for (const tr of ec.taxRates) {
            taxRates.set(tr.taxRateId, tr)
          }
        }
      }

      if (taxRates.size === 0) continue

      const quantity = trx.quantity ?? 1
      const totalGross = Number(trx.totalAmount ?? (trx.amount ?? 0) + (trx.taxAmount ?? 0)) || 0

      let percentageSum = 0
      let flatSum = 0
      for (const t of taxRates.values()) {
        if (t.postingType === 'flat_percentage' && t.percentage) {
          percentageSum += Number(t.percentage) || 0
        } else if (t.postingType === 'flat_amount' && t.amount) {
          flatSum += Number(t.amount) || 0
        }
      }

      const totalFlat = flatSum * quantity
      const applyFlat = totalGross > totalFlat
      const effectiveTotalFlat = applyFlat ? totalFlat : 0
      const adjustedGross = Math.max(0, totalGross - effectiveTotalFlat)
      const percRate = percentageSum > 0 ? percentageSum / 100 : 0
      const netWithoutTax = percRate > 0 ? adjustedGross / (1 + percRate) : adjustedGross
      const includedTaxAmount = Math.max(0, totalGross - netWithoutTax)
      const unitPriceNet = quantity > 0 ? netWithoutTax / quantity : netWithoutTax

      let total = 0
      const breakdown: Array<{
        taxRateId: number
        taxName: string
        taxAmount: number
        percentage: number | null
      }> = []

      for (const taxRate of taxRates.values()) {
        const percentage = Number(taxRate.percentage) || 0
        let taxAmount = 0

        if (taxRate.postingType === 'flat_percentage') {
          taxAmount =
            percRate > 0
              ? (adjustedGross / (1 + percRate)) * (percentage / 100)
              : 0
        } else if (taxRate.postingType === 'flat_amount') {
          taxAmount = applyFlat ? (Number(taxRate.amount) || 0) * quantity : 0
        }

        total += taxAmount
        breakdown.push({
          taxRateId: taxRate.taxRateId,
          taxName: taxRate.taxName,
          taxAmount,
          percentage: taxRate.percentage,
        })
      }

      const newAmount = round2(netWithoutTax)
      const newTaxAmount = round2(includedTaxAmount)
      const newTotalAmount = round2(netWithoutTax + includedTaxAmount)
      const newUnitPrice = round2(unitPriceNet)

      if (this.dryRun) {
        const oldAmount = Number(trx.amount ?? 0)
        const oldTax = Number(trx.taxAmount ?? 0)
        const oldTotal = Number(trx.totalAmount ?? 0)
        const diff = round2((newTotalAmount ?? 0) - (oldTotal ?? 0))
        this.logger.info(
          `[DryRun] MP Trx ${trx.id}: amt ${oldAmount}->${newAmount}, tax ${oldTax}->${newTaxAmount}, total ${oldTotal}->${newTotalAmount} (diff ${diff}), applyFlat=${applyFlat}, flatSum=${flatSum.toFixed(2)} Breakdown=${JSON.stringify(breakdown)}`,
        )
      } else {
        trx.amount = newAmount
        trx.taxAmount = newTaxAmount
        trx.totalAmount = newTotalAmount
        trx.unitPrice = newUnitPrice
        trx.netAmount = newAmount
        trx.taxBreakdown = { items: breakdown, total: round2(total) }
        await trx.save()
      }
      mpCount++
    }
    this.logger.success(`Processed ${mpCount} MealPlan transactions`)

    // Part 2: Room Transactions
    this.logger.info('Processing Room Transactions...')
    const roomTransactions = await baseQuery.clone()
      .where((q) => {
        q.where('category', TransactionCategory.ROOM).where(
          'transactionType',
          TransactionType.CHARGE,
        )
      })
      .preload('reservationRoom', (rrQ) => {
        rrQ.preload('room', (rQ) => {
          rQ.preload('taxRates')
        })
        rrQ.preload('hotel', (hQ) => {
          hQ.preload('roomChargesTaxRates')
        })
      })

    let roomCount = 0
    for (const trx of roomTransactions) {
      const rr = trx.reservationRoom
      const roomTaxRates = rr?.room?.taxRates || []
      const hotelFallback = rr?.hotel?.roomChargesTaxRates || []
      const allApplied = roomTaxRates.length > 0 ? roomTaxRates : hotelFallback
      const applied = allApplied.filter((t) => t.hotelId === trx.hotelId)

      if (!applied || applied.length === 0) continue

      const quantity = trx.quantity ?? 1
      const totalGross = Number(trx.roomFinalRate ?? trx.totalAmount ?? (trx.amount ?? 0) + (trx.taxAmount ?? 0)) || 0

      let percentageSum = 0
      let flatSum = 0
      for (const t of applied) {
        if (t.postingType === 'flat_percentage' && t.percentage) {
          percentageSum += Number(t.percentage) || 0
        } else if (t.postingType === 'flat_amount' && t.amount) {
          flatSum += Number(t.amount) || 0
        }
      }

      const totalFlat = flatSum * quantity
      const applyFlat = totalGross > totalFlat
      const effectiveTotalFlat = applyFlat ? totalFlat : 0
      const adjustedGross = Math.max(0, totalGross - effectiveTotalFlat)
      const percRate = percentageSum > 0 ? percentageSum / 100 : 0
      const netWithoutTax = percRate > 0 ? adjustedGross / (1 + percRate) : adjustedGross
      const dailyTaxAmount = Math.max(0, totalGross - netWithoutTax)

      const totalRoomAmount = totalGross
      const roomAdjustedGross = Math.max(0, totalRoomAmount - effectiveTotalFlat)
      const roomNetWithoutTax =
        percRate > 0 ? roomAdjustedGross / (1 + percRate) : roomAdjustedGross
      const roomFinalRateTaxe = Math.max(0, totalRoomAmount - roomNetWithoutTax)

      const baseRateGross = Number((trx as any).roomFinalBaseRate ?? totalGross) || 0
      const baseRateAdjustedGross = Math.max(0, baseRateGross - effectiveTotalFlat)
      const baseRateNetWithoutTax =
        percRate > 0 ? baseRateAdjustedGross / (1 + percRate) : baseRateAdjustedGross

      let total = 0
      const breakdown: Array<{
        taxRateId: number
        taxName: string
        taxAmount: number
        percentage: number | null
      }> = []

      for (const taxRate of applied) {
        const percentage = Number(taxRate.percentage) || 0
        let taxAmount = 0

        if (taxRate.postingType === 'flat_percentage') {
          taxAmount =
            percRate > 0
              ? (roomAdjustedGross / (1 + percRate)) * (percentage / 100)
              : 0
        } else if (taxRate.postingType === 'flat_amount') {
          taxAmount = applyFlat ? (Number(taxRate.amount) || 0) * quantity : 0
        }

        total += Number(taxAmount)
        breakdown.push({
          taxRateId: taxRate.taxRateId,
          taxName: taxRate.taxName,
          taxAmount,
          percentage: taxRate.percentage,
        })
      }

      const newAmount = round2(netWithoutTax)
      const newTaxAmount = round2(dailyTaxAmount)
      const newTotalAmount = round2(netWithoutTax + dailyTaxAmount)
      const newRoomFinalRate = round2(totalRoomAmount)
      const newRoomFinalNetAmount = round2(roomNetWithoutTax)
      const newRoomFinalRateTaxe = round2(roomFinalRateTaxe)
      const newRoomFinalBaseRate = round2(baseRateNetWithoutTax)

      if (this.dryRun) {
        const oldAmount = Number(trx.amount ?? 0)
        const oldTax = Number(trx.taxAmount ?? 0)
        const oldTotal = Number(trx.totalAmount ?? 0)
        const oldRoomNet = Number((trx as any).roomFinalNetAmount ?? 0)
        const diff = round2((newTotalAmount ?? 0) - (oldTotal ?? 0))
        this.logger.info(
          `[DryRun] ROOM Trx ${trx.id}: amt ${oldAmount}->${newAmount}, tax ${oldTax}->${newTaxAmount}, total ${oldTotal}->${newTotalAmount} (diff ${diff}), roomNet ${oldRoomNet}->${newRoomFinalNetAmount}, applyFlat=${applyFlat}, flatSum=${flatSum.toFixed(2)} Breakdown=${JSON.stringify(breakdown)}`,
        )
      } else {
        trx.amount = newAmount
        trx.taxAmount = newTaxAmount
        trx.totalAmount = newTotalAmount
        trx.unitPrice = newAmount
        trx.netAmount = newAmount
        trx.roomFinalRate = newRoomFinalRate
        trx.roomFinalNetAmount = newRoomFinalNetAmount
        trx.roomFinalRateTaxe = newRoomFinalRateTaxe
        trx.roomFinalBaseRate = newRoomFinalBaseRate
        trx.taxBreakdown = { items: breakdown, total: round2(total) }
        await trx.save()
      }

      roomCount++
    }
    this.logger.success(`Processed ${roomCount} Room transactions`)
  }
}
