import { DateTime } from 'luxon'
import { BaseModel, column ,belongsTo} from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Door from './door.js'

/**
 * Modes de vérification ZKTeco
 */
export enum VerifyMode {
  PASSWORD = 0,
  FINGERPRINT = 1,
  CARD = 2,
  FACE = 3,
  PALM = 4,
}

/**
 * Statut d'entrée/sortie
 */
export enum InOutStatus {
  ENTRY = 0,
  EXIT = 1,
  UNKNOWN = 2,
}

export default class DoorAccessLog extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare doorId: number

  @column()
  declare userIdOnDevice: string

  @column()
  declare userName: string | null

  @column()
  declare verifyMode: number | null

  @column()
  declare inOutStatus: number | null

  @column()
  declare accessGranted: boolean

  @column.dateTime()
  declare accessTime: DateTime

 @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  /**
   * Relation vers la porte
   */
  @belongsTo(() => Door)
  declare door: BelongsTo<typeof Door>

  /**
   * Retourne le mode de vérification en texte lisible
   */
  public get verifyModeText(): string {
    switch (this.verifyMode) {
      case VerifyMode.PASSWORD:
        return 'Password'
      case VerifyMode.FINGERPRINT:
        return 'Fingerprint'
      case VerifyMode.CARD:
        return 'RFID Card'
      case VerifyMode.FACE:
        return 'Face Recognition'
      case VerifyMode.PALM:
        return 'Palm Print'
      default:
        return 'Unknown'
    }
  }

  /**
   * Retourne le type d'accès en texte lisible
   */
  public get inOutStatusText(): string {
    switch (this.inOutStatus) {
      case InOutStatus.ENTRY:
        return 'Entry'
      case InOutStatus.EXIT:
        return 'Exit'
      default:
        return 'Unknown'
    }
  }



}
