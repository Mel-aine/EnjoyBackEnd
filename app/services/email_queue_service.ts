import EmailTemplate from '#models/email_template'
import EmailQueue from '#models/email_queue'
import { EmailStatus } from '#models/email_queue'

export interface QueueEmailData {
  templateName: string
  recipientEmail: string
  dataContext: Record<string, any>
}

export default class EmailQueueService {
  /**
   * Ajouter un email à la file d'attente
   */
  static async queueEmail(data: QueueEmailData): Promise<EmailQueue> {
    // Récupérer le template par son nom
    const template = await EmailTemplate.findBy('template_name', data.templateName)
    
    if (!template) {
      throw new Error(`Template '${data.templateName}' not found`)
    }

    // Créer l'entrée dans la file d'attente
    const queueItem = await EmailQueue.create({
      emailTemplateId: template.id,
      recipientEmail: data.recipientEmail,
      dataContext: data.dataContext,
      status: EmailStatus.PENDING,
      retryCount: 0
    })

    return queueItem
  }

  /**
   * Récupérer les emails en attente de traitement
   */
  static async getPendingEmails(limit: number = 10): Promise<EmailQueue[]> {
    return await EmailQueue.query()
      .where('status', EmailStatus.PENDING)
      .orderBy('created_at', 'asc')
      .limit(limit)
      .preload('emailTemplate')
  }

  /**
   * Marquer un email comme en cours de traitement
   */
  static async markAsProcessing(emailQueueId: number): Promise<void> {
    const queueItem = await EmailQueue.findOrFail(emailQueueId)
    queueItem.status = EmailStatus.PROCESSING
    queueItem.retryCount += 1
    queueItem.lastAttemptAt = new Date()
    await queueItem.save()
  }

  /**
   * Marquer un email comme envoyé avec succès
   */
  static async markAsSent(emailQueueId: number): Promise<void> {
    const queueItem = await EmailQueue.findOrFail(emailQueueId)
    queueItem.status = EmailStatus.SENT
    await queueItem.save()
  }

  /**
   * Marquer un email comme échoué
   */
  static async markAsFailed(emailQueueId: number): Promise<void> {
    const queueItem = await EmailQueue.findOrFail(emailQueueId)
    queueItem.status = EmailStatus.FAILED
    await queueItem.save()
  }

  /**
   * Récupérer les emails échoués pour retry
   */
  static async getFailedEmailsForRetry(maxRetries: number = 3, limit: number = 10): Promise<EmailQueue[]> {
    return await EmailQueue.query()
      .where('status', EmailStatus.FAILED)
      .where('retry_count', '<', maxRetries)
      .orderBy('created_at', 'asc')
      .limit(limit)
      .preload('emailTemplate')
  }
}