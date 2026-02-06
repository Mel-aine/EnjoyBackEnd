import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { DateTime } from 'luxon'
import FolioTransaction from '#models/folio_transaction'
import { TransactionType, PaymentMethodType } from '#app/enums'

export default class FixVoidedPaymentTransfers extends BaseCommand {
  static commandName = 'fix:voided-payment-transfers'
  static description = 'Find voided City Ledger payments that have non-voided transfers and fix them'

  static options: CommandOptions = {
    startApp: true
  }

  @args.string({ description: 'Hotel ID', required: false })
  declare hotelIdArg: string

  @flags.string({ alias: 'h', description: 'Hotel ID' })
  declare hotelIdFlag: string

  @flags.boolean({ alias: 'd', description: 'Dry run (preview only)', default: false })
  declare dryRun: boolean

  async run() {
    const hotelId = Number(this.hotelIdFlag || this.hotelIdArg)
    
    if (!hotelId || isNaN(hotelId)) {
      this.logger.error('Please provide a valid Hotel ID using argument or -h flag')
      return
    }

    const isDryRun = this.dryRun

    this.logger.info(`Checking voided City Ledger payments for hotel ${hotelId}...`)
    if (isDryRun) {
      this.logger.info('DRY RUN MODE: No changes will be made.')
    } else {
      this.logger.warning('LIVE MODE: Non-voided transfers linked to voided payments will be VOIDED.')
    }

    // 1. Get all VOIDED payment transactions where payment method is City Ledger
    const voidedPayments = await FolioTransaction.query()
      .where('hotel_id', hotelId)
      .where('transaction_type', TransactionType.PAYMENT)
      .where('is_voided', true)
      .preload('paymentMethod')
      .whereHas('paymentMethod', (q) => {
        q.where('method_type', PaymentMethodType.CITY_LEDGER)
      })

    this.logger.info(`Found ${voidedPayments.length} ${voidedPayments[0].id} voided City Ledger payments.`)

    const results = []
    let fixedCount = 0
    let foundCount = 0

    for (const payment of voidedPayments) {
      // 2. Check for transfer transaction linked to this payment that is NOT voided
      const transfer = await FolioTransaction.query()
        .where('original_transaction_id', payment.id)
        .where('transaction_type', TransactionType.TRANSFER)
        .where('is_voided', false)
        .first()

      if (transfer) {
        foundCount++
        let actionTaken = 'None'

        if (!isDryRun) {
          try {
            transfer.isVoided = true
            transfer.voidedAt = DateTime.now()
            // Use the same user who voided the payment, or default to 1 (System/Admin) if missing
            transfer.voidedBy = payment.voidedBy || 1
            transfer.voidReason = `System fix: Orphaned transfer from voided payment ${payment.id}`
            
            await transfer.save()
            
            actionTaken = 'VOIDED_TRANSFER'
            fixedCount++
          } catch (error) {
            this.logger.error(`Failed to void transfer ${transfer.id}: ${error.message}`)
            actionTaken = 'ERROR'
          }
        } else {
          actionTaken = 'WOULD_VOID'
        }

        results.push({
          paymentId: payment.id,
          voidedDate: payment.voidedAt ? payment.voidedAt.toFormat('yyyy-MM-dd HH:mm') : 'Unknown',
          transferId: transfer.id,
          transferAmount: transfer.amount,
          action: actionTaken
        })
      }
    }

    if (results.length === 0) {
      this.logger.info('No orphaned non-voided transfers found.')
    } else {
      const tableData = results.map(r => ({
        'Payment ID': r.paymentId,
        'Voided Date': r.voidedDate,
        'Transfer ID': r.transferId,
        'Transfer Amount': r.transferAmount,
        'Action': r.action
      }))
      
      console.table(tableData)
      
      if (isDryRun) {
        this.logger.info(`Found ${foundCount} transfers to void. Run without --dry-run (or -d) to void them.`)
      } else {
        this.logger.success(`Successfully voided ${fixedCount} orphaned transfers.`)
      }
    }
  }
}
