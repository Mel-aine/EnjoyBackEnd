import NightAuditRequested from '#events/night_audit_requested'
import NightAuditService from '#services/night_audit_service'
import Job from '#models/job'
import { DateTime } from 'luxon'

export default class ProcessNightAudit {
  public async handle(event: NightAuditRequested) {
    const jobId = event.jobId
    const maxAttempts = 10
    const retryDelayMs = 5000 // 5 seconds

    const job = await Job.find(jobId)
    if (!job) {
      console.error(`Job ${jobId} not found`)
      return
    }

    // Mark as processing
    job.status = 'processing'
    await job.save()

    try {
      const { auditDate, hotelId, userId, skipReport } = job.payload

      await NightAuditService.processNightAudit({
        auditDate: DateTime.fromISO(auditDate),
        hotelId,
        userId,
        skipReport
      })

      job.status = 'completed'
      await job.save()

    } catch (error) {
      console.error(`Night Audit Job ${jobId} failed:`, error)
      
      job.attempts += 1
      job.lastError = error instanceof Error ? error.message : String(error)
      job.status = 'failed'
      await job.save()

      if (job.attempts < maxAttempts) {
        // Retry logic: Re-emit event after delay
        // Note: setTimeout is not persistent across restarts, but better than nothing for a free solution.
        // A robust solution would check for failed jobs on startup.
        console.log(`Retrying job ${jobId} in ${retryDelayMs}ms (Attempt ${job.attempts + 1}/${maxAttempts})`)
        setTimeout(() => {
          NightAuditRequested.dispatch(jobId)
        }, retryDelayMs)
      } else {
        console.error(`Job ${jobId} permanently failed after ${maxAttempts} attempts.`)
      }
    }
  }
}