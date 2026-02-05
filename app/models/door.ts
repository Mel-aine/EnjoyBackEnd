import { DateTime } from 'luxon'
import { BaseModel, column ,belongsTo ,hasMany} from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Room from './room.js'
import DoorAccessLog from './door_access_log.js'
import User from './user.js'


export default class Door extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

   @column()
  declare name: string

  @column()
  declare ipAddress: string

  @column()
  declare port: number

  @column()
  declare roomId: number | null

  @column()
  declare isActive: boolean

   @column()
  declare lastModifiedBy: number | null

    @column()
    declare createdBy: number | null

    @belongsTo(() => User, { foreignKey: 'createdBy' })
    declare creator: BelongsTo<typeof User>

    @belongsTo(() => User, { foreignKey: 'lastModifiedBy' })
    declare modifier: BelongsTo<typeof User>

  @column.dateTime()
  declare lastSyncedAt: DateTime | null

   @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  /**
   * Relation vers la chambre associée
   */
  @belongsTo(() => Room)
  declare room: BelongsTo<typeof Room>

  /**
   * Relation vers les logs d'accès
   */
  @hasMany(() => DoorAccessLog)
  declare logs: HasMany<typeof DoorAccessLog>

  /**
   * Vérifie si le terminal est opérationnel
   */
  public get isOperational(): boolean {
    return this.isActive && this.ipAddress !== null
  }

  /**
   * Retourne l'adresse complète du terminal (IP:Port)
   */
  public get fullAddress(): string {
    return `${this.ipAddress}:${this.port}`
  }


}
