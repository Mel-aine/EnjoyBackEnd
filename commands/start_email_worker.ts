import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import EmailWorker from '#workers/email_worker'

export default class StartEmailWorker extends BaseCommand {
  static commandName = 'email:worker'
  static description = 'Start the email worker to process the email queue'

  static options: CommandOptions = {
    startApp: true,
    allowUnknownFlags: false,
    staysAlive: true,
  }

  private worker: EmailWorker | null = null

  async run() {
    this.logger.info('Starting email worker...')
    
    this.worker = new EmailWorker()
    
    // Gérer l'arrêt propre du worker
    process.on('SIGINT', () => {
      this.logger.info('Received SIGINT, stopping email worker...')
      if (this.worker) {
        this.worker.stop()
      }
      process.exit(0)
    })

    process.on('SIGTERM', () => {
      this.logger.info('Received SIGTERM, stopping email worker...')
      if (this.worker) {
        this.worker.stop()
      }
      process.exit(0)
    })

    // Démarrer le worker
    this.worker.start()
    
    this.logger.info('Email worker started successfully')
    this.logger.info('Press Ctrl+C to stop the worker')
    
    // Garder le processus en vie
    return new Promise(() => {})
  }
}