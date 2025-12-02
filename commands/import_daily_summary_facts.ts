import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import fs from 'fs'
import { DateTime } from 'luxon'
import DailySummaryFact from '#models/daily_summary_fact'

type InputItem = {
  date?: string
  audit_date?: string
  manager_report_data?: any
  managerReportData?: any
  manager?: any
  daily?: any
  daily_revenue_report_data?: any
  dailyRevenue?: any
}

export default class ImportDailySummaryFacts extends BaseCommand {
  public static commandName = 'import:daily-summary-facts'
  public static description = 'Import Daily Summary Facts (manager report + daily revenue JSON) for a hotel'
  public static options: CommandOptions = { startApp: true }

  @flags.number({ description: 'Hotel ID (default: 2)', alias: 'h' })
  declare hotelId: number | undefined

  @flags.string({ description: 'Path to JSON file', alias: 'f' })
  declare file: string | undefined

  @flags.string({ description: 'Audit date (YYYY-MM-DD) if importing a single object', alias: 'd' })
  declare date: string | undefined

  /**
   * Usage examples:
   * - node ace import:daily-summary-facts -h 2 -f "C:\\path\\to\\daily_summary.json"
   * - node ace import:daily-summary-facts -f "C:\\path\\to\\one_day.json" -d 2025-11-28
   *
   * Input JSON shape supported:
   * - Array of objects: [{ date: "YYYY-MM-DD", daily: {...}, manager_report_data: {...} }, ...]
   * - Single object: { date: "YYYY-MM-DD", daily: {...}, manager_report_data: {...} }
   *   If no `date` inside object, provide `--date`.
   */
  public async run() {
    const HOTEL_ID = Number(this.hotelId ?? 2)
    const filePath = this.file

    if (!Number.isFinite(HOTEL_ID) || HOTEL_ID <= 0) {
      this.logger.error('Invalid or missing --hotel-id')
      return
    }
    if (!filePath) {
      this.logger.error('Missing --file path to JSON')
      return
    }
    if (!fs.existsSync(filePath)) {
      this.logger.error(`File not found: ${filePath}`)
      return
    }

    let rawJson: unknown
    try {
      rawJson = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    } catch (err: any) {
      this.logger.error(`Failed to parse JSON: ${err?.message || String(err)}`)
      return
    }

    const items: InputItem[] = Array.isArray(rawJson)
      ? (rawJson as InputItem[])
      : [rawJson as InputItem]

    let created = 0
    let updated = 0
    for (const item of items) {
      const dateStr = (item.audit_date || item.date || this.date || '').trim()
      const dt = DateTime.fromISO(dateStr)
      if (!dt.isValid) {
        this.logger.warning(`Skipping entry with invalid date: ${JSON.stringify(item).slice(0, 200)}...`)
        continue
      }

      // Normalize payload keys
      const manager = item.manager_report_data ?? item.managerReportData ?? item.manager ?? null
      const daily = item.daily ?? item.daily_revenue_report_data ?? item.dailyRevenue ?? null

      // Find existing fact for hotel + date
      const existing = await DailySummaryFact.query()
        .where('hotel_id', HOTEL_ID)
        .where('audit_date', dt.toISODate()!)
        .first()

      if (existing) {
        existing.merge({
          managerReportData: manager ?? existing.managerReportData ?? null,
          dailyRevenueReportData: daily ?? existing.dailyRevenueReportData ?? null,
        })
        await existing.save()
        updated++
        this.logger.info(`Updated daily_summary_fact for hotel ${HOTEL_ID} on ${dt.toISODate()}`)
      } else {
        await DailySummaryFact.create({
          auditDate: dt,
          hotelId: HOTEL_ID,
          managerReportData: manager ?? null,
          dailyRevenueReportData: daily ?? null,
        })
        created++
        this.logger.info(`Created daily_summary_fact for hotel ${HOTEL_ID} on ${dt.toISODate()}`)
      }
    }

    this.logger.success(`Import complete. Created: ${created}, Updated: ${updated}`)
  }
}

