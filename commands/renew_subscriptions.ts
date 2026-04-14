import { BaseCommand } from '@adonisjs/core/ace'
import SubscriptionRenewalService from '#services/subscription_renewal_service'
import { DateTime } from 'luxon'

export default class RenewSubscriptions extends BaseCommand {
  public static commandName = 'subscriptions:renew'
  public static description = 'Renews expired subscriptions, creates a single invoice per customer, and emails the invoice'

  public async run() {
    const service = new SubscriptionRenewalService()
    const result = await service.runMonthlyRenewal(DateTime.now())

    this.logger.info(`Processed hotels: ${result.processedHotels}`)
    this.logger.info(`Created invoices: ${result.createdInvoices.length}`)
  }
}

