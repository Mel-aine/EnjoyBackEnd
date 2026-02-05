import { DateTime } from 'luxon'
import { BaseModel, column ,belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Door from './door.js'
import Reservation from './reservation.js'

export default class RetryQueue extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare reservationId: number | null

  @column()
  declare doorId: number | null

  @column()
  declare userIdOnDevice: string

  @column()
  declare cardNumber: string | null

  @column()
  declare userName: string | null

  @column()
  declare operation: string

  @column()
  declare status: string

  @column()
  declare retryCount: number

  @column()
  declare maxRetries: number

  @column()
  declare errorMessage: string | null

  @column()
  declare lastError: string | null

  @column.dateTime()
  declare lastRetryAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  //relation

  @belongsTo(() => Reservation, { foreignKey: 'reservationId' })
  declare reservation: BelongsTo<typeof Reservation>

  @belongsTo(() => Door, { foreignKey: 'doorId' })
  declare door: BelongsTo<typeof Door>

  /**
   * Vérifie si la tâche peut être retentée
   */
  public canRetry(): boolean {
    return this.status === 'pending' && this.retryCount < this.maxRetries
  }

  /**
   * Incrémente le compteur de retry
   */
  public incrementRetry(errorMessage?: string): void {
    this.retryCount++
    this.lastRetryAt = DateTime.now()

    if (errorMessage) {
      this.lastError = errorMessage
    }

    // Si on a atteint le max de retries, marquer comme échoué
    if (this.retryCount >= this.maxRetries) {
      this.status = 'failed'
      this.errorMessage = `Max retries (${this.maxRetries}) exceeded. Last error: ${this.lastError}`
    }
  }

  /**
   * Marque la tâche comme complétée
   */
  public markAsCompleted(): void {
    this.status = 'completed'
    this.errorMessage = null
    this.lastError = null
  }

  /**
   * Marque la tâche comme échouée
   */
  public markAsFailed(errorMessage: string): void {
    this.status = 'failed'
    this.errorMessage = errorMessage
  }


}
