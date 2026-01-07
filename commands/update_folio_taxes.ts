import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import FolioTransaction from '#models/folio_transaction'
import TaxRate from '#models/tax_rate'
import MealPlan from '#models/meal_plan'
import { TransactionCategory, TransactionType } from '#app/enums'
import Hotel from '#models/hotel'

export default class UpdateFolioTaxes extends BaseCommand {
  public static commandName = 'update:folio_taxes'
  public static description = 'Update taxes for MealPlan and Room transactions'
  public static options: CommandOptions = { startApp: true }

  @flags.number({ description: 'Hotel ID', alias: 'h' })
  declare hotelId: number | undefined

  @flags.boolean({ description: 'Dry run - preview changes without saving', alias: 'd' })
  declare dryRun: boolean

  public async run() {
    const hotelId = this.hotelId
    const query = FolioTransaction.query()

    if (this.dryRun) {
      this.logger.info('Running in DRY RUN mode. No changes will be saved to the database.')
    }

    if (hotelId) {
      query.where('hotelId', hotelId)
    }

    // Part 1: MealPlan Transactions
    this.logger.info('Processing MealPlan Transactions...')
    const mealPlanTransactions = await query.clone()
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
      let isInclusive = false

      if (trx.extraCharge) {
        // Use tax rates from the specific extra charge
        for (const tr of trx.extraCharge.taxRates) {
          taxRates.set(tr.taxRateId, tr)
        }
        
        // Check if taxes are included in the amount
        // If trx.amount is close to the gross rate, assume it is inclusive
        const expectedGross = (trx.extraCharge.rate || 0) * (trx.quantity || 1)
        if (expectedGross > 0 && Math.abs(trx.amount - expectedGross) < 0.1) {
          isInclusive = true
        }
      } else {
        // Fallback: Get all tax rates from all extra charges in the meal plan
        for (const ec of trx.mealPlan.extraCharges) {
          for (const tr of ec.taxRates) {
            taxRates.set(tr.taxRateId, tr)
          }
        }
      }

      if (taxRates.size > 0) {
        let total = 0
        const breakdown: Array<{ taxRateId: number; taxName: string; taxAmount: number; percentage: number | null }> = []
        
        // Calculate total percentage for back-calculation if inclusive
        let totalPercentage = 0
        if (isInclusive) {
          for (const taxRate of taxRates.values()) {
            if (taxRate.postingType === 'flat_percentage') {
              totalPercentage += taxRate.percentage || 0
            }
          }
        }

        for (const taxRate of taxRates.values()) {
          const percentage = taxRate.percentage || 0
          let taxAmount = 0
          
          if (isInclusive) {
            // Back-calculate tax from inclusive amount
            if (taxRate.postingType === 'flat_percentage') {
              // Formula: Tax = (Gross * Rate) / (100 + TotalRate)
              // Or: Net = Gross / (1 + TotalRate/100)
              // Tax = Net * Rate/100
              // Tax = (Gross / (1 + TotalRate/100)) * Rate/100
              taxAmount = (trx.amount / (1 + totalPercentage / 100)) * (percentage / 100)
            } else if (taxRate.postingType === 'flat_amount') {
               // Handle flat amount with inclusive? Complex. 
               // Assuming simple subtraction for now or keep as flat amount
               taxAmount = taxRate.amount || 0
            }
          } else {
            // Calculate tax on top of exclusive amount
            const taxableAmount = trx.amount
            if (taxRate.postingType === 'flat_percentage') {
              taxAmount = (taxableAmount * percentage) / 100
            } else if (taxRate.postingType === 'flat_amount') {
              taxAmount = taxRate.amount || 0
            }
          }
          
          total += taxAmount
          breakdown.push({
            taxRateId: taxRate.taxRateId,
            taxName: taxRate.taxName,
            taxAmount,
            percentage: taxRate.percentage,
          })
        }
        
        if (this.dryRun) {
          this.logger.info(`[DryRun] MealPlan Transaction ${trx.id}: TotalTax=${total} Inclusive=${isInclusive} Breakdown=${JSON.stringify(breakdown)}`)
        } else {
          //trx.taxAmount = total
          trx.taxBreakdown = { items: breakdown, total }
          await trx.save()
        }
        mpCount++
      }
    }
    this.logger.success(`Processed ${mpCount} MealPlan transactions`)

    this.logger.info('Processing Room Transactions...')
    const roomTransactions = await query.clone()
      .where((q) => {
        q.where('category', TransactionCategory.ROOM)
         .where('transactionType', TransactionType.CHARGE)
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
      const applied = roomTaxRates.length > 0 ? roomTaxRates : hotelFallback

      if (!applied || applied.length === 0) continue

      let total = 0
      const breakdown: Array<{ taxRateId: number; taxName: string; taxAmount: number; percentage: number | null }> = []

      for (const taxRate of applied) {
        if (trx.hotelId !== taxRate.hotelId) continue
        const taxableAmount = Number(trx.roomFinalNetAmount) // Use base rate if available
        const percentage = taxRate.percentage || 0
        let taxAmount = 0
        if (taxRate.postingType === 'flat_percentage') {
          taxAmount = (taxableAmount * percentage) / 100
        } else if (taxRate.postingType === 'flat_amount') {
          taxAmount = taxRate.amount || 0
        }
        total += Number(taxAmount)
        breakdown.push({
          taxRateId: taxRate.taxRateId,
          taxName: taxRate.taxName,
          taxAmount,
          percentage: taxRate.percentage,
        })
      }

      // Check if roomFinalNetAmount + totalTax equals roomFinalRate
      if (trx.roomFinalNetAmount && Math.abs((Number(trx.roomFinalNetAmount) + total) - Number(trx.roomFinalRate)) > 0.05) {
        this.logger.warning(`Room Transaction ${trx.id} verification failed: Net(${trx.roomFinalNetAmount}) + Tax(${total}) != Final(${trx.roomFinalRate}). Diff=${Math.abs((Number(trx.roomFinalNetAmount) + total) - Number(trx.roomFinalRate))}`)
      }

      if (this.dryRun) {
        this.logger.info(`[DryRun] Room Transaction ${trx.id}: TotalTax=${total} Breakdown=${JSON.stringify(breakdown)}`)
      } else {
        //trx.taxAmount = total
        trx.taxBreakdown = { items: breakdown, total }
        await trx.save()
      }

      roomCount++
    }
    this.logger.success(`Processed ${roomCount} Room transactions`)
  }
}
