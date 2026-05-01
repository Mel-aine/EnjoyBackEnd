import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import SubscriptionRenewalService from '#services/subscription_renewal_service'
import { DateTime } from 'luxon'

export default class RenewSubscriptions extends BaseCommand {
  public static commandName = 'subscriptions:renew'
  public static description = 'Renews expired subscriptions, creates a single invoice per customer, and emails the invoice'
  public static options: CommandOptions = { startApp: true }

  @flags.number({ description: 'Hotel ID to renew subscriptions for', alias: 'h' })
  declare hotelId: number | undefined

  @flags.string({ description: 'Backfill: create invoice for a specific month (YYYY-MM) if missing', alias: 'm' })
  declare month: string | undefined

  @flags.boolean({ description: 'Do not send emails', alias: 'n' })
  declare noEmail: boolean | undefined

  public async run() {
    const service = new SubscriptionRenewalService()
    if (this.month) {
      const hotelId = Number(this.hotelId)
      if (!Number.isFinite(hotelId) || hotelId <= 0) {
        this.logger.error('Missing or invalid --hotel-id when using --month')
        return
      }

      const result = await service.generateMonthlyInvoiceIfMissing({
        hotelId,
        month: this.month,
        runAt: DateTime.now(),
        sendEmail: !this.noEmail,
      })

      if (result.created && result.invoiceNumber) {
        this.logger.success(`Invoice created: ${result.invoiceNumber}`)
      } else {
        this.logger.info(`No invoice created: ${result.reason ?? 'already exists or nothing to bill'}`)
      }
      return
    }

    const result = await service.runMonthlyRenewal(DateTime.now(), this.hotelId)

    this.logger.info(`Processed hotels: ${result.processedHotels}`)
    this.logger.info(`Created invoices: ${result.createdInvoices.length}`)
  }
}

