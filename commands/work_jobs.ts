import { BaseCommand } from '@adonisjs/core/ace'
import { CommandOptions } from '@adonisjs/core/types/ace'
import Job from '#models/job'
import NightAuditService from '#services/night_audit_service'
import { DateTime } from 'luxon'

export default class WorkJobs extends BaseCommand {
  static commandName = 'work:jobs'
  static description = 'Process pending jobs'

  static options: CommandOptions = {
    startApp: true
  }

  async run() {
    this.logger.info('Starting job worker...')
    
    while (true) {
      try {
        const job = await Job.query()
          .where('status', 'pending')
          .orWhere((query) => {
            query.where('status', 'failed')
                 .where((subQuery) => {
                   subQuery.where('type', 'NIGHT_AUDIT').where('attempts', '<', 10)
                     .orWhereNot('type', 'NIGHT_AUDIT').where('attempts', '<', 6)
                 })
          })
          .orderBy('created_at', 'asc')
          .first()

        if (!job) {
          // No jobs found, wait for 5 seconds
          await new Promise(resolve => setTimeout(resolve, 5000))
          continue
        }

        this.logger.info(`Processing job ${job.id} (Type: ${job.type}, Attempt: ${job.attempts + 1})`)
        
        job.status = 'processing'
        await job.save()

        try {
          if (job.type === 'NIGHT_AUDIT') {
             const { auditDate, hotelId, userId, skipReport } = job.payload
             await NightAuditService.processNightAudit({
               auditDate: DateTime.fromISO(auditDate),
               hotelId,
               userId,
               skipReport
             })
          } else {
             this.logger.warning(`Unknown job type: ${job.type}`)
          }
          
          job.status = 'completed'
          await job.save()
          this.logger.info(`Job ${job.id} completed successfully`)

        } catch (error) {
          job.attempts += 1
          job.lastError = error instanceof Error ? error.message : String(error)
          job.status = 'failed' 
          
          await job.save()
          this.logger.error(`Job ${job.id} failed: ${job.lastError}`)
        }
      } catch (error) {
        this.logger.error(`Worker error: ${error instanceof Error ? error.message : String(error)}`)
        await new Promise(resolve => setTimeout(resolve, 5000))
      }
    }
  }
}
