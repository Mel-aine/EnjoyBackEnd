import { BaseCommand, args } from '@adonisjs/core/ace'
import { CommandOptions } from '@adonisjs/core/types/ace'
import { DateTime } from 'luxon'

export default class RunNightAuditInterval extends BaseCommand {
  static commandName = 'night:audit:interval'
  static description = 'Run night audit for a date range without sending reports'

  static options: CommandOptions = {
    startApp: true
  }

  @args.string({ description: 'Hotel ID' })
  declare hotelId: string

  @args.string({ description: 'Start Date (YYYY-MM-DD)' })
  declare startDate: string

  @args.string({ description: 'End Date (YYYY-MM-DD)' })
  declare endDate: string

  async run() {
    const { default: NightAuditService } = await import('#services/night_audit_service')
    
    const hotelId = Number(this.hotelId)
    const start = DateTime.fromISO(this.startDate)
    const end = DateTime.fromISO(this.endDate)

    if (!start.isValid || !end.isValid) {
      this.logger.error('Invalid date format. Use YYYY-MM-DD')
      return
    }

    if (end < start) {
      this.logger.error('End date must be after start date')
      return
    }

    let current = start
    while (current <= end) {
      this.logger.info(`Running night audit for ${current.toISODate()}...`)
      
      try {
        await NightAuditService.calculateNightAudit({
          auditDate: current,
          hotelId: hotelId,
          skipReport: true
        })
        this.logger.success(`Completed night audit for ${current.toISODate()}`)
      } catch (error) {
        this.logger.error(`Failed night audit for ${current.toISODate()}: ${error.message}`)
      }

      current = current.plus({ days: 1 })
    }
  }
}
