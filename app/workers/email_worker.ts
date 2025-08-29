import EmailQueueService from '#services/email_queue_service'
import EmailQueue from '#models/email_queue'
import EmailLog from '#models/email_log'
import { EmailService } from '#services/email_service'
import { DateTime } from 'luxon'

export interface EmailSendResult {
  success: boolean
  message: string
}

export default class EmailWorker {
  private isRunning: boolean = false
  private intervalId: NodeJS.Timeout | null = null
  private readonly processingInterval: number = 5000 // 5 secondes
  private readonly maxRetries: number = 3
  private readonly batchSize: number = 10

  /**
   * Démarrer le worker
   */
  start(): void {
    if (this.isRunning) {
      console.log('Email worker is already running')
      return
    }

    this.isRunning = true
    console.log('Starting email worker...')
    
    this.intervalId = setInterval(async () => {
      await this.processQueue()
    }, this.processingInterval)
  }

  /**
   * Arrêter le worker
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('Email worker is not running')
      return
    }

    this.isRunning = false
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    console.log('Email worker stopped')
  }

  /**
   * Traiter la file d'attente
   */
  private async processQueue(): Promise<void> {
    try {
      // Récupérer les emails en attente
      const pendingEmails = await EmailQueueService.getPendingEmails(this.batchSize)
      
      if (pendingEmails.length === 0) {
        return
      }

      console.log(`Processing ${pendingEmails.length} emails...`)

      // Traiter chaque email
      for (const emailQueue of pendingEmails) {
        await this.processEmail(emailQueue)
      }

      // Traiter les emails échoués pour retry
      const failedEmails = await EmailQueueService.getFailedEmailsForRetry(this.maxRetries, this.batchSize)
      for (const emailQueue of failedEmails) {
        await this.processEmail(emailQueue)
      }
    } catch (error) {
      console.error('Error processing email queue:', error)
    }
  }

  /**
   * Traiter un email individuel
   */
  private async processEmail(emailQueue: EmailQueue): Promise<void> {
    try {
      // Marquer comme en cours de traitement
      await EmailQueueService.markAsProcessing(emailQueue.id)

      // Envoyer l'email
      const result = await this.sendEmail(emailQueue)

      // Logger le résultat
      await this.logEmailResult(emailQueue.id, result)

      // Mettre à jour le statut
      if (result.success) {
        await EmailQueueService.markAsSent(emailQueue.id)
        console.log(`Email sent successfully to ${emailQueue.recipientEmail}`)
      } else {
        await EmailQueueService.markAsFailed(emailQueue.id)
        console.error(`Failed to send email to ${emailQueue.recipientEmail}: ${result.message}`)
      }
    } catch (error) {
      console.error(`Error processing email ${emailQueue.id}:`, error)
      await EmailQueueService.markAsFailed(emailQueue.id)
      await this.logEmailResult(emailQueue.id, {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Envoyer l'email en utilisant EmailService
   */
  private async sendEmail(emailQueue: EmailQueue): Promise<EmailSendResult> {
    try {
      await emailQueue.load('emailTemplate')
      const template = emailQueue.emailTemplate
      
      if (!template) {
        throw new Error('Email template not found')
      }

      // Utiliser EmailService pour envoyer l'email
      const result = await EmailService.sendTemplateEmail(
        template.templateName,
        emailQueue.recipientEmail,
        emailQueue.dataContext
      )

      return result
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to send email'
      }
    }
  }

  /**
   * Logger le résultat de l'envoi
   */
  private async logEmailResult(emailQueueId: number, result: EmailSendResult): Promise<void> {
    await EmailLog.create({
      emailQueueId,
      sentAt: DateTime.now(),
      success: result.success,
      responseMessage: result.message
    })
  }
}