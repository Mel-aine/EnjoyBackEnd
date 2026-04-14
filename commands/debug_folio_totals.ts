import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import FolioTransaction from '#models/folio_transaction'
import Folio from '#models/folio'
import { TransactionStatus, TransactionType, TransactionCategory } from '#app/enums'

export default class DebugFolioTotals extends BaseCommand {
  static commandName = 'debug:folio-totals'
  static description = 'Debug folio totals calculation by listing transactions and their contribution'

  static options: CommandOptions = {
    startApp: true
  }

  @args.string({ description: 'Folio ID' })
  declare folioId: string

  async run() {
    const folioId = Number(this.folioId)

    if (isNaN(folioId)) {
      this.logger.error('Invalid Folio ID')
      return
    }

    this.logger.info(`Debugging totals for Folio ${folioId}...`)

    try {
      const folio = await Folio.find(folioId)
      if (!folio) {
        this.logger.error(`Folio ${folioId} not found`)
        return
      }
      this.logger.info(`Folio Type: ${folio.folioType}`)
      this.logger.info(`Current DB Balance: ${folio.balance}`)

      const transactions = await FolioTransaction.query()
        .where('folioId', folioId)
        .orderBy('created_at', 'asc')

      let totalCharges = 0
      let totalPayments = 0
      let totalAdjustments = 0
      let totalTaxes = 0
      let totalServiceCharges = 0
      let totalDiscounts = 0

      const tableData = []

      for (const transaction of transactions) {
        // Logic from FolioService.updateFolioTotals
        const isVoided = transaction.status === TransactionStatus.VOIDED
        const isMealPlan = transaction.mealPlanId !== null

        let status = 'Included'
        if (isVoided) status = 'Ignored (Voided)'
        if (isMealPlan) status = 'Ignored (MealPlan)'

        let chargeContribution = 0
        let paymentContribution = 0
        let adjustmentContribution = 0
        let taxContribution = 0
        let serviceChargeContribution = 0
        let discountContribution = 0

        if (!isVoided && !isMealPlan) {
          const totalAmount = parseFloat(`${transaction.totalAmount}`) || 0
          
          if (transaction.transactionType === TransactionType.CHARGE) {
            totalCharges += totalAmount
            chargeContribution = totalAmount
          } else if (transaction.transactionType === TransactionType.ROOM_POSTING) {
            totalCharges += totalAmount
            chargeContribution = totalAmount
          } else if (transaction.transactionType === TransactionType.PAYMENT) {
            totalPayments += Math.abs(totalAmount)
            paymentContribution = Math.abs(totalAmount)
          } else if (transaction.transactionType === TransactionType.ADJUSTMENT) {
            totalAdjustments += totalAmount
            adjustmentContribution = totalAmount
          } else if (transaction.transactionType === TransactionType.TRANSFER) {
            if (transaction.category === TransactionCategory.TRANSFER_IN) {
              totalCharges += totalAmount
              chargeContribution = totalAmount
            } else if (transaction.category === TransactionCategory.TRANSFER_OUT) {
              totalPayments += Math.abs(totalAmount)
              paymentContribution = Math.abs(totalAmount)
            }
          } else if (transaction.transactionType === TransactionType.REFUND) {
            totalPayments -= Math.abs(totalAmount)
            paymentContribution = -Math.abs(totalAmount)
          }

          taxContribution = parseFloat(`${transaction.taxAmount}`) || 0
          serviceChargeContribution = parseFloat(`${transaction.serviceChargeAmount}`) || 0
          discountContribution = parseFloat(`${transaction.discountAmount}`) || 0

          totalTaxes += taxContribution
          totalServiceCharges += serviceChargeContribution
          totalDiscounts += discountContribution
        }

        tableData.push({
          ID: transaction.id,
          Type: transaction.transactionType,
          Cat: transaction.category,
          TotalAmt: transaction.totalAmount,
          Status: status,
          '+Chg': chargeContribution,
          '+Pay': paymentContribution,
          '+Adj': adjustmentContribution,
          '+Tax': taxContribution,
          '+SC': serviceChargeContribution
        })
      }

      console.table(tableData)

      const calculatedBalance = totalCharges + totalAdjustments - totalPayments

      this.logger.info('--- Calculation Summary ---')
      this.logger.info(`Total Charges: ${totalCharges.toFixed(2)}`)
      this.logger.info(`Total Payments: ${totalPayments.toFixed(2)}`)
      this.logger.info(`Total Adjustments: ${totalAdjustments.toFixed(2)}`)
      this.logger.info(`Total Taxes: ${totalTaxes.toFixed(2)}`)
      this.logger.info(`Total Service Charges: ${totalServiceCharges.toFixed(2)}`)
      this.logger.info(`Total Discounts: ${totalDiscounts.toFixed(2)}`)
      this.logger.info('---------------------------')
      this.logger.info(`Calculated Balance: ${calculatedBalance.toFixed(2)}`)
      this.logger.info(`Stored Balance:     ${folio.balance}`)
      
      const diff = Math.abs(calculatedBalance - folio.balance)
      if (diff > 0.01) {
          this.logger.error(`MISMATCH DETECTED: ${diff.toFixed(2)}`)
      } else {
          this.logger.success('Balances match')
      }

    } catch (error) {
      this.logger.error(`Error: ${error.message}`)
      console.error(error)
    }
  }
}
