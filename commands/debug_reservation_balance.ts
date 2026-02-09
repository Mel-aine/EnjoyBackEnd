import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import Reservation from '#models/reservation'
import { TransactionStatus, TransactionType, TransactionCategory } from '#app/enums'

export default class DebugReservationBalance extends BaseCommand {
  static commandName = 'debug:reservation-balance'
  static description = 'Debug reservation balance calculation by listing transactions and their effect'

  static options: CommandOptions = {
    startApp: true
  }

  @args.string({ description: 'Hotel ID' })
  declare hotelId: string

  @args.string({ description: 'Reservation ID' })
  declare reservationId: string

  async run() {
    const hotelId = Number(this.hotelId)
    const reservationId = Number(this.reservationId)

    if (isNaN(hotelId) || isNaN(reservationId)) {
      this.logger.error('Invalid Hotel ID or Reservation ID')
      return
    }

    this.logger.info(`Debugging balance for Reservation ${reservationId} in Hotel ${hotelId}...`)

    try {
      const reservation = await Reservation.query()
        .where('hotel_id', hotelId)
        .where('id', reservationId)
        .preload('folios', (folioQuery) => {
          folioQuery.preload('transactions', (trxQuery) => {
            trxQuery.orderBy('created_at', 'asc')
          })
        })
        .firstOrFail()

      this.logger.info(`Reservation found: ${reservation.confirmationNumber}`)

      let totalCharges = 0
      let totalPayments = 0
      let totalAdjustments = 0
      let totalTaxes = 0
      let totalServiceCharges = 0
      let totalDiscounts = 0

      const transactionDetails = []

      for (const folio of reservation.folios) {
        this.logger.info(`Processing Folio ${folio.id} (${folio.folioType})...`)

        for (const transaction of folio.transactions) {
          const amount = Number(transaction.amount) || 0
          const isVoided = transaction.status === TransactionStatus.VOIDED || transaction.isVoided === true
          
          let effect = 'Ignored (Voided)'
          let category = 'Other'
          const taxAmount = Number(transaction.taxAmount) || 0
          const serviceChargeAmount = Number(transaction.serviceChargeAmount) || 0
          
          if (!isVoided) {
             switch (transaction.transactionType) {
              case 'charge':
              case TransactionType.ROOM_POSTING:
                totalCharges += amount
                totalTaxes += taxAmount
                totalServiceCharges += serviceChargeAmount
                effect = `+${amount} (Charge) | Tax: +${taxAmount} | SC: +${serviceChargeAmount}`
                category = 'Charge'
                break
              case TransactionType.TRANSFER:
                if (transaction.category === TransactionCategory.TRANSFER_IN) {
                  totalCharges += amount
                  effect = `+${amount} (Transfer In)`
                  category = 'Charge'
                } else if (transaction.category === TransactionCategory.TRANSFER_OUT) {
                  totalPayments += Math.abs(amount)
                  effect = `+${Math.abs(amount)} (Transfer Out -> Payment)`
                  category = 'Payment'
                } else {
                   // Fallback
                    if (amount > 0) {
                        totalCharges += amount
                        effect = `+${amount} (Transfer Fallback -> Charge)`
                        category = 'Charge'
                    } else {
                        totalPayments += Math.abs(amount)
                        effect = `+${Math.abs(amount)} (Transfer Fallback -> Payment)`
                        category = 'Payment'
                    }
                }
                break
              case 'payment':
                totalPayments += Math.abs(amount)
                effect = `+${Math.abs(amount)} (Payment)`
                category = 'Payment'
                break
              case 'adjustment':
                totalAdjustments += amount
                effect = `+${amount} (Adjustment)`
                category = 'Adjustment'
                break
              case 'tax':
              case TransactionCategory.CITY_TAX:
                totalTaxes += amount
                effect = `+${amount} (Tax Transaction)`
                category = 'Tax'
                // Do NOT add taxAmount from transaction properties
                break
              case 'discount':
                totalDiscounts += Math.abs(amount)
                totalCharges -= Math.abs(amount)
                effect = `-${Math.abs(amount)} (Discount -> Reduce Charge)`
                category = 'Discount'
                break
              case 'refund':
                totalPayments -= amount
                effect = `-${amount} (Refund -> Reduce Payment)`
                category = 'Payment'
                break
              default:
                if (amount > 0 && transaction.category !== TransactionCategory.PAYMENT) {
                    totalCharges += amount
                    totalTaxes += taxAmount
                    totalServiceCharges += serviceChargeAmount
                    effect = `+${amount} (Generic Charge) | Tax: +${taxAmount} | SC: +${serviceChargeAmount}`
                    category = 'Charge'
                } else {
                    effect = 'Ignored (Type Unknown)'
                }
            }
          }

          transactionDetails.push({
            ID: transaction.id,
            Type: transaction.transactionType,
            Category: transaction.category,
            Amount: amount,
            Voided: isVoided ? 'YES' : 'NO',
            Effect: effect
          })
        }
      }
      
      console.table(transactionDetails)

      const outstandingBalance =
        totalCharges +
        totalTaxes +
        totalServiceCharges -
        totalPayments +
        totalAdjustments

      this.logger.info('--- Calculation Summary ---')
      this.logger.info(`Total Charges: ${totalCharges.toFixed(2)}`)
      this.logger.info(`Total Taxes: ${totalTaxes.toFixed(2)}`)
      this.logger.info(`Total Service Charges: ${totalServiceCharges.toFixed(2)}`)
      this.logger.info(`Total Payments: ${totalPayments.toFixed(2)}`)
      this.logger.info(`Total Adjustments: ${totalAdjustments.toFixed(2)}`)
      this.logger.info(`Total Discounts: ${totalDiscounts.toFixed(2)}`)
      this.logger.info('---------------------------')
      this.logger.info(`Outstanding Balance: ${outstandingBalance.toFixed(0)}`)
      
      const check = (totalCharges + totalTaxes + totalServiceCharges + totalAdjustments) - totalPayments
      this.logger.info(`Verification (Charges+Tax+SC+Adj - Pay): ${check.toFixed(0
      )}`)


    } catch (error) {
      this.logger.error(`Error: ${error.message}`)
      console.error(error)
    }
  }
}
