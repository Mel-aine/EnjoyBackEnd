import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { DateTime } from 'luxon'

import ReportsEmailService from '#services/reports_email_service'

export default class SendDailyEmail extends BaseCommand {
  public static commandName = 'reports:send-daily-email'
  public static description = 'Send daily (Today) email report for a hotel'
  public static options: CommandOptions = { startApp: true }

  @flags.number({ description: 'Hotel ID to send the email for', alias: 'h' })
  declare hotelId: number | undefined

  @flags.string({ description: 'As-of date (YYYY-MM-DD) used in email subject', alias: 'd' })
  declare date: string | undefined

  public async run() {
    const HOTEL_ID = Number.isFinite(this.hotelId) ? Number(this.hotelId) : 2
    if (!Number.isFinite(HOTEL_ID) || HOTEL_ID <= 0) {
      this.logger.error('Invalid --hotel-id value')
      return
    }

    if (this.date) {
      const parsed = DateTime.fromISO(this.date)
      if (!parsed.isValid) {
        this.logger.error(`Invalid --date value: ${this.date}. Expected YYYY-MM-DD.`)
        return
      }
    }

    this.logger.info(`Sending daily email for hotel ${HOTEL_ID}...`)
    const service = new ReportsEmailService()
    await service.sendDailyEmail(HOTEL_ID, this.date)
    this.logger.success('Daily email sent.')
  }
}

