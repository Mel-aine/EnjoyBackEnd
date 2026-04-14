import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { DateTime } from 'luxon'
import FolioTransaction from '#models/folio_transaction'
import PaymentMethod from '#models/payment_method'
import Folio from '#models/folio'
import CompanyAccount from '#models/company_account'
import CityLedgerService from '#services/city_ledger_service'
import { TransactionType, PaymentMethodType, FolioType } from '#app/enums'

export default class CheckCityLedgerPayments extends BaseCommand {
  static commandName = 'check:city-ledger-payments'
  static description = 'Check for city ledger payments that might be missing transfers'

  static options: CommandOptions = {
    startApp: true
  }

  @args.string({ description: 'Hotel ID', required: false })
  declare hotelIdArg: string

  @flags.string({ alias: 'h', description: 'Hotel ID' })
  declare hotelIdFlag: string

  @flags.boolean({ alias: 'd', description: 'Dry run (preview only)', default: false })
  declare dryRun: boolean

  @flags.string({ alias: 'f', description: 'Start date (YYYY-MM-DD)' })
  declare from: string

  @flags.string({ alias: 't', description: 'End date (YYYY-MM-DD)' })
  declare to: string

  async run() {
    const hotelId = Number(this.hotelIdFlag || this.hotelIdArg)
    
    if (!hotelId || isNaN(hotelId)) {
      this.logger.error('Please provide a valid Hotel ID using argument or -h flag')
      return
    }

    let dateFrom: DateTime | null = null
    let dateTo: DateTime | null = null

    if (this.from) {
      dateFrom = DateTime.fromFormat(this.from, 'yyyy-MM-dd')
      if (!dateFrom.isValid) {
        this.logger.error(`Invalid start date format: ${this.from}. Use YYYY-MM-DD`)
        return
      }
    }

    if (this.to) {
      dateTo = DateTime.fromFormat(this.to, 'yyyy-MM-dd')
      if (!dateTo.isValid) {
        this.logger.error(`Invalid end date format: ${this.to}. Use YYYY-MM-DD`)
        return
      }
    }

    const isDryRun = this.dryRun

    this.logger.info(`Checking City Ledger payments for hotel ${hotelId}...`)
    if (dateFrom) this.logger.info(`From: ${dateFrom.toFormat('yyyy-MM-dd')}`)
    if (dateTo) this.logger.info(`To: ${dateTo.toFormat('yyyy-MM-dd')}`)

    if (isDryRun) {
      this.logger.info('DRY RUN MODE: No changes will be made.')
    } else {
      this.logger.warning('LIVE MODE: Missing transactions will be created.')
    }

    // 1. Get all payment transactions where payment method is City Ledger
    const query = FolioTransaction.query()
      .where('hotel_id', hotelId)
      .where('transaction_type', TransactionType.PAYMENT)
      .where('is_voided', false)
      .preload('paymentMethod')
      .preload('guest')
      .whereHas('paymentMethod', (q) => {
        q.where('method_type', PaymentMethodType.CITY_LEDGER)
      })

    if (dateFrom) {
      query.where('transaction_date', '>=', dateFrom.toSQLDate()!)
    }
    if (dateTo) {
      query.where('transaction_date', '<=', dateTo.toSQLDate()!)
    }
    
    const payments = await query
    
    this.logger.info(`Found ${payments.length} City Ledger payments.`)

    const results = []
    let missingFolioCount = 0
    let missingTransferCount = 0
    let fixedCount = 0
    let failedCount = 0

    for (const payment of payments) {
      const paymentMethod = payment.paymentMethod
      if (!paymentMethod || !paymentMethod.companyId) {
        continue
      }
      
      const companyId = paymentMethod.companyId
      const companyAccount = await CompanyAccount.find(companyId)
      const companyName = companyAccount ? companyAccount.companyName : 'UNKNOWN'

      let guestName = payment.guestName
      if (!guestName && payment.guest) {
        guestName = `${payment.guest.firstName || ''} ${payment.guest.lastName || ''}`.trim()
      }
      
      // 2. Check if a Folio exists for this company
      const companyFolio = await Folio.query()
        .where('hotel_id', hotelId)
        .where('company_id', companyId)
        .where('folio_type', FolioType.COMPANY)
        .first()

      // 3. Check for transfer transaction linked to this payment
      const transfer = await FolioTransaction.query()
        .where('original_transaction_id', payment.id)
        .where('transaction_type', TransactionType.TRANSFER)
        .first()

      let status = 'OK'
      let actionTaken = 'None'

      if (!companyFolio) {
          missingFolioCount++
          status = 'MISSING_FOLIO'
      }
      
      if (!transfer) {
          missingTransferCount++
          if (status === 'OK') status = 'MISSING_TRANSFER'
          else status += ', MISSING_TRANSFER'

          // FIX LOGIC
          if (!isDryRun) {
            try {
               // Ensure folio has guest and reservationRoom->room preloaded before creating CL child
               await payment.load('folio', (folioQuery: any) => {
                folioQuery.preload('guest')
                folioQuery.preload('reservationRoom', (roomQuery: any) => {
                  roomQuery.preload('room')
                })
              })

              const result = await CityLedgerService.createCityLedgerChildForPayment({
                originalTransaction: payment,
                postedBy: payment.createdBy, // Use the original transaction creator
              })

              if (result && result.child) {
                actionTaken = `CREATED_TRANSFER (ID: ${result.child.id})`
                fixedCount++
              } else {
                actionTaken = 'FAILED_TO_CREATE'
                failedCount++
              }
            } catch (error) {
              this.logger.error(`Failed to fix payment ${payment.id}: ${error.message}`)
              actionTaken = 'ERROR'
              failedCount++
            }
          } else {
            actionTaken = 'WOULD_FIX'
          }
      }

      results.push({
        paymentId: payment.id,
        amount: payment.amount,
        guestName: guestName || 'UNKNOWN',
        companyId: companyId,
        companyName: companyName,
        companyFolioId: companyFolio ? companyFolio.id : 'MISSING',
        transferId: transfer ? transfer.id : (actionTaken.startsWith('CREATED') ? 'CREATED' : 'MISSING'),
        date: payment.transactionDate ? payment.transactionDate.toFormat('yyyy-MM-dd') : 'N/A',
        status: status,
        action: actionTaken
      })
    }

    if (results.length === 0) {
      this.logger.info('No transactions found matching the criteria.')
    } else {
      const tableData = results.map(r => ({
        'Payment ID': r.paymentId,
        'Date': r.date,
        'Amount': r.amount,
        'Guest': r.guestName,
        'Company ID': r.companyId,
        'Company Name': r.companyName,
        'Company Folio': r.companyFolioId,
        'Transfer ID': r.transferId,
        'Status': r.status,
        'Action': r.action
      }))
      console.table(tableData)
    }

    this.logger.info(`Summary:`)
    this.logger.info(`- Total Payments: ${results.length}`)
    this.logger.info(`- Missing Company Folio: ${missingFolioCount}`)
    this.logger.info(`- Missing Transfer: ${missingTransferCount}`)
    if (!isDryRun) {
        this.logger.info(`- Fixed: ${fixedCount}`)
        this.logger.info(`- Failed: ${failedCount}`)
    }
  }
}
