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

  public async run() {
    const service = new SubscriptionRenewalService()
    const result = await service.runMonthlyRenewal(DateTime.now(), this.hotelId)

    this.logger.info(`Processed hotels: ${result.processedHotels}`)
    this.logger.info(`Created invoices: ${result.createdInvoices.length}`)
  }
}

