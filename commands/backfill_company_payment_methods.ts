import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import CompanyAccount from '#models/company_account'
import BusinessSource from '#models/business_source'
import PaymentMethod from '#models/payment_method'
import CompanyAccountService from '#services/company_account_service'
import { PaymentMethodType } from '#app/enums'
import Database from '@adonisjs/lucid/services/db'

export default class BackfillCompanyPaymentMethods extends BaseCommand {
  public static commandName = 'company:backfill-payment-methods'
  public static description =
    'Create a payment_method for company_accounts missing one (per hotel)'
  public static options: CommandOptions = { startApp: true }

  @flags.number({ description: 'Hotel ID', alias: 'h' })
  declare hotelId: number | undefined

  @flags.boolean({ description: 'Preview changes without writing', alias: 'd' })
  declare dryRun: boolean

  @flags.number({ description: 'created_by / last_modified_by user id', alias: 'u' })
  declare userId: number | undefined

  public async run() {
    const hotelId = Number(this.hotelId ?? 3)
    if (!Number.isFinite(hotelId) || hotelId <= 0) {
      this.logger.error('Missing or invalid --hotel-id')
      return
    }

    const service = new CompanyAccountService()
    const actorId = Number(this.userId ?? 1)

    const candidates = await CompanyAccount.query()
      .where('hotelId', hotelId)
      .where('addToBusinessSource', true)
      .whereNot('doNotCountAsCityLedger', true)
      .orderBy('id', 'asc')

    const candidateIds = candidates.map((c) => c.id)
    const candidateMethodCodes = candidates.map((c) =>
      service.generateShortCode(`CL-${c.companyName}`)
    )

    const existingByCompanyId = new Map<number, PaymentMethod>()
    if (candidateIds.length) {
      const existing = await PaymentMethod.query()
        .where('hotelId', hotelId)
        .where('methodType', PaymentMethodType.CITY_LEDGER)
        .whereIn('companyId', candidateIds)
        .select(['id', 'hotelId', 'companyId', 'methodCode', 'methodType', 'isActive'])

      for (const pm of existing) {
        if (pm.companyId != null) {
          existingByCompanyId.set(pm.companyId, pm)
        }
      }
    }

    const existingByMethodCodeWithNoCompany = new Map<string, PaymentMethod>()
    if (candidateMethodCodes.length) {
      const existingNoCompany = await PaymentMethod.query()
        .where('hotelId', hotelId)
        .where('methodType', PaymentMethodType.CITY_LEDGER)
        .whereNull('companyId')
        .whereIn('methodCode', candidateMethodCodes)
        .select(['id', 'hotelId', 'companyId', 'methodCode', 'methodType', 'isActive'])

      for (const pm of existingNoCompany) {
        existingByMethodCodeWithNoCompany.set(pm.methodCode, pm)
      }
    }

    const sampleNames: string[] = []
    const toProcess: CompanyAccount[] = []

    for (const ca of candidates) {
      const methodCode = service.generateShortCode(`CL-${ca.companyName}`)
      const pmForCompany = existingByCompanyId.get(ca.id)
      const pmWithoutCompany = existingByMethodCodeWithNoCompany.get(methodCode)

      const needsPaymentMethod =
        !pmForCompany || pmForCompany.isActive !== true || (pmForCompany.companyId as any) == null
      const canAttachByCode = pmWithoutCompany != null

      if (needsPaymentMethod || canAttachByCode) {
        toProcess.push(ca)
        if (sampleNames.length < 25) sampleNames.push(`${ca.id}:${String(ca.companyName ?? '').slice(0, 40)}`)
      }
    }

    this.logger.info(
      `Hotel ${hotelId}: ${toProcess.length} company_accounts eligible (addToBusinessSource=true, doNotCountAsCityLedger!=true) without payment method`
    )
    if (sampleNames.length) {
      this.logger.info(`Sample: ${sampleNames.join(', ')}`)
    }

    if (this.dryRun) {
      this.logger.success('Dry run: no changes applied')
      return
    }

    let createdBusinessSources = 0
    let createdPaymentMethods = 0
    let reactivatedPaymentMethods = 0

    for (const ca of toProcess) {
      const trx = await Database.transaction()
      try {
        const bs = await BusinessSource.query({ client: trx })
          .where('hotelId', hotelId)
          .where('name', ca.companyName)
          .first()

        if (!bs) {
          await BusinessSource.create(
            {
              hotelId,
              name: ca.companyName,
              shortCode: service.generateShortCode(ca.companyName),
              registrationNumber: ca.registrationNumber || null,
              createdByUserId: ca.createdBy || actorId,
              updatedByUserId: ca.createdBy || actorId,
              isDeleted: false,
            } as any,
            { client: trx }
          )
          createdBusinessSources++
        }

        const methodCode = service.generateShortCode(`CL-${ca.companyName}`)
        const existingPmForCompany = await PaymentMethod.query({ client: trx })
          .where('hotelId', hotelId)
          .andWhere('companyId', ca.id)
          .andWhere('methodType', PaymentMethodType.CITY_LEDGER)
          .first()

        if (existingPmForCompany) {
          existingPmForCompany.isActive = true
          ;(existingPmForCompany as any).lastModifiedBy = actorId
          await existingPmForCompany.useTransaction(trx).save()
          reactivatedPaymentMethods++
        } else {
          const existingPmWithoutCompany = await PaymentMethod.query({ client: trx })
            .where('hotelId', hotelId)
            .andWhere('methodType', PaymentMethodType.CITY_LEDGER)
            .andWhere('methodCode', methodCode)
            .whereNull('companyId')
            .first()

          if (existingPmWithoutCompany) {
            existingPmWithoutCompany.isActive = true
            ;(existingPmWithoutCompany as any).lastModifiedBy = actorId
            ;(existingPmWithoutCompany as any).companyId = ca.id
            await existingPmWithoutCompany.useTransaction(trx).save()
            reactivatedPaymentMethods++
          } else {
            await PaymentMethod.create(
              {
                hotelId,
                companyId: ca.id,
                methodName: `${ca.companyName}`,
                methodCode: methodCode,
                methodType: PaymentMethodType.CITY_LEDGER,
                shortCode: service.generateShortCode(`CL-${ca.companyName}`),
                isActive: true,
                description: `City ledger payment method for ${ca.companyName}`,
                createdBy: actorId,
                lastModifiedBy: actorId,
              } as any,
              { client: trx }
            )
            createdPaymentMethods++
          }
        }

        await trx.commit()
      } catch (error) {
        try {
          await trx.rollback()
        } catch {}
        throw error
      }
    }

    this.logger.success(
      `Hotel ${hotelId}: created ${createdPaymentMethods} payment_methods, reactivated ${reactivatedPaymentMethods}, created ${createdBusinessSources} business_sources`
    )
  }
}
