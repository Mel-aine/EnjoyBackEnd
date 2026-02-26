import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import Job from '#models/job'
import { DateTime } from 'luxon'

export default class TestJobDispatch extends BaseCommand {
  public static commandName = 'test:job-dispatch'
  public static description = 'Manually dispatch a NIGHT_AUDIT job for testing purposes'
  public static options: CommandOptions = { startApp: true }

  @flags.number({ description: 'Hotel ID', alias: 'h' })
  declare hotelId: number | undefined

  @flags.string({ description: 'Audit Date (YYYY-MM-DD)', alias: 'd' })
  declare date: string | undefined

  public async run() {
    const hotelId = this.hotelId || 1 // Default to 1
    const dateStr = this.date || DateTime.now().toISODate()
    const auditDate = DateTime.fromISO(dateStr)

    if (!auditDate.isValid) {
      this.logger.error('Invalid date format')
      return
    }

    this.logger.info(`Dispatching NIGHT_AUDIT job for Hotel ${hotelId} on ${dateStr}...`)

    const job = await Job.create({
      type: 'NIGHT_AUDIT',
      payload: {
        auditDate: auditDate.toISODate(),
        hotelId,
        userId: 1, // Dummy user
        skipReport: true // Skip sending emails/reports
      },
      status: 'pending',
      attempts: 0
    })

    const NightAuditRequested = (await import('#events/night_audit_requested')).default
    await NightAuditRequested.dispatch(job.id)

    this.logger.success(`Job dispatched successfully! Job ID: ${job.id}`)
    this.logger.info('Event emitted. Check your logs for processing details.')
  }
}
