import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { DateTime } from 'luxon'
import Folio from '#models/folio'
import FolioTransaction from '#models/folio_transaction'
import PaymentMethod from '#models/payment_method'
import CompanyAccount from '#models/company_account'
import CompanyAccountService from '#services/company_account_service'
import CityLedgerService from '#services/city_ledger_service'
import CompanyFolioService from '#services/company_folio_service'
import {
  FolioType,
  FolioStatus,
  SettlementStatus,
  WorkflowStatus,
  TransactionType,
  PaymentMethodType,
} from '#app/enums'

export default class AuditCityLedgerOrphans extends BaseCommand {
  static commandName = 'audit:city-ledger-orphans'
  static description =
    'Find and fix CITY_LEDGER orphans: create missing company folios and report missing transfers'

  static options: CommandOptions = {
    startApp: true,
  }

  @args.string({ description: 'Hotel ID', required: false })
  declare hotelIdArg: string

  @flags.number({ alias: 'h', description: 'Hotel ID' })
  declare hotelIdFlag: number

  @flags.boolean({ alias: 'd', description: 'Dry run (preview only)', default: false })
  declare dryRun: boolean

  @flags.number({ alias: 'u', description: 'User ID for audit fields', default: 1 })
  declare userId: number

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

    const actorId = Number(this.userId)
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
        this.logger.error(`Invalid start date format: ${this.to}. Use YYYY-MM-DD`)
        return
      }
    }

    this.logger.info(`=== Audit City Ledger Orphans — Hotel ${hotelId} ===`)
    if (dateFrom) this.logger.info(`From: ${dateFrom.toFormat('yyyy-MM-dd')}`)
    if (dateTo) this.logger.info(`To: ${dateTo.toFormat('yyyy-MM-dd')}`)
    if (this.dryRun) this.logger.info('DRY RUN MODE: No changes will be made.')
    this.logger.info('')

    // ── PART 1: Payment methods CITY_LEDGER without a matching company folio ──

    const clPaymentMethods = await PaymentMethod.query()
      .where('hotelId', hotelId)
      .where('methodType', PaymentMethodType.CITY_LEDGER)
      .where('isActive', true)
      .select(['id', 'hotelId', 'companyId', 'methodName', 'methodCode'])

    this.logger.info(`Found ${clPaymentMethods.length} active CITY_LEDGER payment methods.`)

    // Collect unique companyIds that need a folio
    const companyIdsNeeded = new Set<number>()
    const pmByCompanyId = new Map<number, PaymentMethod[]>()

    for (const pm of clPaymentMethods) {
      if (!pm.companyId) continue
      // Match getOrCreateCompanyFolio logic: any folio for this company+hotel
      const companyFolio = await Folio.query()
        .where('companyId', pm.companyId)
        .where('hotelId', hotelId)
        .first()

      if (!companyFolio) {
        companyIdsNeeded.add(pm.companyId)
        const list = pmByCompanyId.get(pm.companyId) || []
        list.push(pm)
        pmByCompanyId.set(pm.companyId, list)
      }
    }

    if (companyIdsNeeded.size) {
      this.logger.info('')
      this.logger.info(
        `── PART 1: ${companyIdsNeeded.size} companies need a COMPANY folio ──`
      )

      const companies = await CompanyAccount.query()
        .where('hotelId', hotelId)
        .whereIn('id', [...companyIdsNeeded])

      const nextFolioNumber = await this.generateCompanyFolioNumber()
      let folioIdx = 0
      let created = 0

      for (const company of companies) {
        const folioNumber = `CF${(nextFolioNumber + folioIdx).toString().padStart(6, '0')}`
        folioIdx++

        this.logger.info(
          `  → ${company.companyName} (ID: ${company.id}) — folio ${folioNumber}`
        )

        if (!this.dryRun) {
          await Folio.create({
            hotelId,
            companyId: company.id,
            folioNumber,
            folioName: `Company Folio - ${company.companyName}`,
            folioType: FolioType.COMPANY,
            status: FolioStatus.OPEN,
            settlementStatus: SettlementStatus.PENDING,
            workflowStatus: WorkflowStatus.ACTIVE,
            openedDate: DateTime.now(),
            openedBy: actorId,
            balance: 0,
            creditLimit: company.creditLimit || 0,
            currencyCode: 'XAF',
            exchangeRate: 1,
            createdBy: actorId,
            lastModifiedBy: actorId,
          } as any)
          created++
        }
      }

      if (this.dryRun) {
        this.logger.info(`  Dry run: would create ${companyIdsNeeded.size} folios`)
      } else {
        this.logger.success(`  Created ${created} company folios`)
      }
    } else {
      this.logger.info('')
      this.logger.info(
        '── PART 1: All CITY_LEDGER payment methods have a company folio ✅ ──'
      )
    }

    // ── PART 2: City ledger payments without a transfer to the company folio ──

    const paymentQuery = FolioTransaction.query()
      .where('hotelId', hotelId)
      .where('transactionType', TransactionType.PAYMENT)
      .where('isVoided', false)
      .whereHas('paymentMethod', (q) => {
        q.where('methodType', PaymentMethodType.CITY_LEDGER)
      })
      .preload('paymentMethod')
      .preload('guest')
      .preload('folio', (folioQ) => {
        folioQ.preload('guest')
        folioQ.preload('reservationRoom', (rrQ) => {
          rrQ.preload('room')
        })
      })

    if (dateFrom) {
      paymentQuery.where('transactionDate', '>=', dateFrom.toSQLDate()!)
    }
    if (dateTo) {
      paymentQuery.where('transactionDate', '<=', dateTo.toSQLDate()!)
    }

    const payments = await paymentQuery

    this.logger.info('')
    this.logger.info(`Found ${payments.length} CITY_LEDGER payments (non-voided).`)

    let part2Created = 0

    const orphanPayments: Array<{
      paymentId: number
      amount: number
      date: string
      guestName: string
      companyId: number | null
      companyName: string
      hasTransfer: boolean
      transferId: number | null
    }> = []

    for (const payment of payments) {
      const pm = payment.paymentMethod
      if (!pm || !pm.companyId) continue

      // Match getOrCreateCompanyFolio logic: any folio for this company+hotel
      const companyFolio = await Folio.query()
        .where('companyId', pm.companyId)
        .where('hotelId', hotelId)
        .first()

      const transfer = await FolioTransaction.query()
        .where('originalTransactionId', payment.id)
        .where('transactionType', TransactionType.TRANSFER)
        .first()

      const company = await CompanyAccount.find(pm.companyId)

      let guestName = payment.guestName
      if (!guestName && payment.guest) {
        guestName = `${payment.guest.firstName || ''} ${payment.guest.lastName || ''}`.trim()
      }

      const missingFolio = !companyFolio
      const missingTransfer = !transfer

      if (missingFolio || missingTransfer) {
        orphanPayments.push({
          paymentId: payment.id,
          amount: payment.amount,
          date: payment.transactionDate
            ? payment.transactionDate.toFormat('yyyy-MM-dd')
            : 'N/A',
          guestName: guestName || 'UNKNOWN',
          companyId: pm.companyId,
          companyName: company?.companyName || 'UNKNOWN',
          hasTransfer: !missingTransfer,
          transferId: transfer?.id ?? null,
        })
      }

      // Create missing transfer on the company folio using the same service as production
      if (!missingTransfer && companyFolio) continue

      if (!this.dryRun) {
        // Ensure folio relations are loaded for the service
        if (!payment.folio) {
          await payment.load('folio', (folioQ) => {
            folioQ.preload('guest')
            folioQ.preload('reservationRoom', (rrQ) => {
              rrQ.preload('room')
            })
          })
        }

        const result = await CityLedgerService.createCityLedgerChildForPayment({
          originalTransaction: payment,
          postedBy: actorId,
        })

        if (result) {
          part2Created++
        }
      }
    }

    if (orphanPayments.length) {
      this.logger.info('')
      this.logger.info(
        `── PART 2: CITY_LEDGER payments WITHOUT a transfer or company folio${!this.dryRun ? ` — created ${part2Created} transfers` : ''} ──`
      )
      console.table(
        orphanPayments.map((o) => ({
          'Payment ID': o.paymentId,
          Date: o.date,
          Amount: o.amount,
          Guest: o.guestName,
          'Company ID': o.companyId,
          'Company Name': o.companyName,
          Transfer: o.hasTransfer ? `#${o.transferId}` : 'MISSING ❌',
        }))
      )
    } else {
      this.logger.info('')
      this.logger.info('── PART 2: All CITY_LEDGER payments have transfers ✅ ──')
    }

    // ── PART 3: Payment methods CITY_LEDGER without companyId → fix by matching ──

    const orphanPms = await PaymentMethod.query()
      .where('hotelId', hotelId)
      .where('methodType', PaymentMethodType.CITY_LEDGER)
      .where('isActive', true)
      .whereNull('companyId')
      .select(['id', 'hotelId', 'companyId', 'methodName', 'methodCode'])

    let part3Linked = 0
    let part3Unmatched = 0
    let part3TransfersCreated = 0

    if (orphanPms.length) {
      this.logger.info('')
      this.logger.info(
        `── PART 3: ${orphanPms.length} CITY_LEDGER payment methods without companyId ──`
      )

      const service = new CompanyAccountService()
      const allCompanies = await CompanyAccount.query()
        .where('hotelId', hotelId)
        .select(['id', 'companyName'])

      // Build lookup: expected methodCode → company
      const codeToCompany = new Map<string, CompanyAccount>()
      for (const ca of allCompanies) {
        const expectedCode = service.generateShortCode(`CL-${ca.companyName}`)
        codeToCompany.set(expectedCode, ca)
      }

      let matched = 0
      let unmatched = 0
      const matchedPms: Array<{
        pmId: number
        methodName: string
        methodCode: string
        companyId: number
        companyName: string
        transfersCreated: number
      }> = []
      const unmatchedPms: Array<{
        pmId: number
        methodName: string
        methodCode: string
      }> = []

      for (const pm of orphanPms) {
        const company = codeToCompany.get(pm.methodCode)
        if (company) {
          let transfersForPm = 0

          if (!this.dryRun) {
            // 1. Link the payment method to the company
            await PaymentMethod.query()
              .where('id', pm.id)
              .update({ companyId: company.id, lastModifiedBy: actorId })

            // 2. Ensure company folio exists (getOrCreateCompanyFolio)
            const companyFolioService = new CompanyFolioService()
            await companyFolioService.getOrCreateCompanyFolio(company.id, hotelId, actorId)

            // 3. Find all payments using this payment method that are missing a transfer
            const orphanPaymentsForPm = await FolioTransaction.query()
              .where('hotelId', hotelId)
              .where('transactionType', TransactionType.PAYMENT)
              .where('isVoided', false)
              .where('paymentMethodId', pm.id)
              .whereNotIn('id', (subQ) => {
                subQ
                  .select('originalTransactionId')
                  .from('folio_transactions')
                  .where('transactionType', TransactionType.TRANSFER)
                  .whereNotNull('originalTransactionId')
              })
              .preload('paymentMethod')
              .preload('guest')
              .preload('folio', (folioQ) => {
                folioQ.preload('guest')
                folioQ.preload('reservationRoom', (rrQ) => {
                  rrQ.preload('room')
                })
              })

            // 4. Create transfers for each orphan payment
            for (const payment of orphanPaymentsForPm) {
              const result = await CityLedgerService.createCityLedgerChildForPayment({
                originalTransaction: payment,
                postedBy: actorId,
              })
              if (result) {
                transfersForPm++
                part3TransfersCreated++
              }
            }
          }

          matchedPms.push({
            pmId: pm.id,
            methodName: pm.methodName,
            methodCode: pm.methodCode,
            companyId: company.id,
            companyName: company.companyName,
            transfersCreated: transfersForPm,
          })
          matched++
          part3Linked++
        } else {
          unmatchedPms.push({
            pmId: pm.id,
            methodName: pm.methodName,
            methodCode: pm.methodCode,
          })
          unmatched++
          part3Unmatched++
        }
      }

      if (matchedPms.length) {
        this.logger.info('')
        this.logger.info(`  Matched and ${this.dryRun ? 'would link' : 'linked'}: ${matched}`)
        console.table(
          matchedPms.map((m) => ({
            'PM ID': m.pmId,
            'Method Name': m.methodName,
            'Method Code': m.methodCode,
            '→ Company ID': m.companyId,
            '→ Company Name': m.companyName,
            'Transfers Created': m.transfersCreated,
          }))
        )
      }

      if (unmatchedPms.length) {
        this.logger.info('')
        this.logger.info(`  Unmatched (no company found by methodCode): ${unmatched}`)
        console.table(
          unmatchedPms.map((u) => ({
            'PM ID': u.pmId,
            'Method Name': u.methodName,
            'Method Code': u.methodCode,
          }))
        )
      }
    } else {
      this.logger.info('')
      this.logger.info(
        '── PART 3: All CITY_LEDGER payment methods have a companyId ✅ ──'
      )
    }

    // ── Summary ──

    this.logger.info('')
    this.logger.info('=== SUMMARY ===')
    this.logger.info(
      `- Companies missing folio: ${companyIdsNeeded.size}${this.dryRun ? ' (dry run)' : ` — created ${companyIdsNeeded.size}`}`
    )
    this.logger.info(
      `- Payments missing transfer/folio: ${orphanPayments.length}${this.dryRun ? ' (dry run)' : ` — created ${part2Created} transfers`}`
    )
    this.logger.info(
      `- PM without companyId: ${orphanPms.length}${this.dryRun ? ' (dry run)' : ` — linked ${part3Linked}, created ${part3TransfersCreated} transfers`}`
    )

    if (this.dryRun) {
      this.logger.info('')
      this.logger.success('Dry run: no changes applied. Run without -d to fix.')
    }
  }

  private async generateCompanyFolioNumber(): Promise<number> {
    const lastFolio = await Folio.query()
      .where('folioType', FolioType.COMPANY)
      .orderBy('id', 'desc')
      .first()

    return lastFolio ? parseInt(lastFolio.folioNumber.replace(/\D/g, '')) + 1 : 1
  }
}
