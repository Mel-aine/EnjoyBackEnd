import { BaseCommand, flags } from '@adonisjs/core/ace'
/**
 * Quick usage for Hotel 3
 *
 * - Send latest summary:  node ace reports:send-daily-summary -h 3
 * - Send for a date:      node ace reports:send-daily-summary -h 3 -d YYYY-MM-DD
 *
 * The `-h` flag is the hotel id (alias for `--hotel-id`).
 * The `-d` flag is the audit date (alias for `--date`).
 */
import type { CommandOptions } from '@adonisjs/core/types/ace'

import DailySummaryFact from '#models/daily_summary_fact'
import ReportsEmailService from '#services/reports_email_service'
import Hotel from '#models/hotel'
import { DateTime } from 'luxon'
import NightAuditService from '#services/night_audit_service'

export default class SendDailySummary extends BaseCommand {
  public static commandName = 'reports:send-daily-summary'
  public static description = 'Send the Daily Summary email for a selected hotel and date'
  public static options: CommandOptions = { startApp: true }

  @flags.number({ description: 'Hotel ID to send summary for', alias: 'h' })
  declare hotelId: number | undefined

  @flags.string({ description: 'Audit date (YYYY-MM-DD). Defaults to latest available', alias: 'd' })
  declare date: string | undefined

  /**
   * Usage examples:
   *  node ace reports:send-daily-summary --hotel-id=3
   *  node ace reports:send-daily-summary -h 3 --date=2025-08-30
   */
  public async run() {
    const HOTEL_ID = Number(this.hotelId)
    if (!Number.isFinite(HOTEL_ID) || HOTEL_ID <= 0) {
      this.logger.error('Invalid or missing --hotel-id flag')
      return
    }

    let auditDate: DateTime | null = null
    if (this.date) {
      const parsed = DateTime.fromISO(this.date)
      if (!parsed.isValid) {
        this.logger.error(`Invalid --date value: ${this.date}. Expected YYYY-MM-DD.`)
        return
      }
      auditDate = parsed
    }

    const hotel = await Hotel.find(HOTEL_ID)
    if (!hotel) {
      this.logger.error(`Hotel not found: ${HOTEL_ID}`)
      return
    }

    const targetAuditDate = (auditDate ?? hotel.currentWorkingDate ?? DateTime.now()).startOf('day')

    await NightAuditService.calculateNightAudit({
      auditDate: targetAuditDate,
      hotelId: HOTEL_ID,
    })

    const fact: DailySummaryFact | null = await NightAuditService.getNightAuditDetails(
      targetAuditDate,
      HOTEL_ID
    )

    if (!fact) {
      this.logger.error(
        `No DailySummaryFact found for hotel ${HOTEL_ID} (date=${targetAuditDate.toISODate()})`
      )
      return
    }

    // Robust audit date formatting regardless of model column type
    const formatAuditDate = (value: unknown): string => {
      const v: any = value as any
      if (v && typeof v.toFormat === 'function') {
        return v.toFormat('yyyy-LL-dd')
      }
      if (typeof v === 'string') {
        const byIso = DateTime.fromISO(v)
        if (byIso.isValid) return byIso.toFormat('yyyy-LL-dd')
        const bySql = DateTime.fromSQL(v)
        if (bySql.isValid) return bySql.toFormat('yyyy-LL-dd')
        return v
      }
      if (v instanceof Date) {
        return DateTime.fromJSDate(v).toFormat('yyyy-LL-dd')
      }
      return String(v)
    }

    this.logger.info(
      `Sending Daily Summary email for hotel ${HOTEL_ID} (${hotel.hotelName}) on ${formatAuditDate(fact.auditDate)}...`
    )

    try {
      const service = new ReportsEmailService()
      await service.sendDailySummaryEmail(fact)
      await service.sendDailyEmail(fact.hotelId, fact.auditDate.toISODate()!)
      this.logger.success('Daily Summary email sent successfully.')
    } catch (error: any) {
      this.logger.error(`Failed to send Daily Summary email: ${error?.message || String(error)}`)
      throw error
    }
  }
}
