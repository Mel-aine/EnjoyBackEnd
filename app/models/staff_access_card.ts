// app/models/staff_access_card.ts

import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, ManyToMany } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Door from '#models/door'

export default class StaffAccessCard extends BaseModel {
  @column({ isPrimary: true })
  declare id: number


  @column()
  declare userId: number | null


  @column()
  declare staffFirstName: string | null

  @column()
  declare staffLastName: string | null

  @column()
  declare staffPosition: string | null

  @column()
  declare staffPhoneNumber: string | null

  @column()
  declare cardUid: string

  @column()
  declare userIdOnDevice: string

  @column()
  declare accessType: 'master' | 'limited' | 'temporary'

  @column()
  declare status: 'active' | 'revoked' | 'lost' | 'suspended'

  @column.dateTime()
  declare validFrom: DateTime | null

  @column.dateTime()
  declare validUntil: DateTime | null

  @column()
  declare notes: string | null

  @column()
  declare issuedBy: number | null

  @column()
  declare revokedBy: number | null

  @column.dateTime()
  declare issuedAt: DateTime

  @column.dateTime()
  declare revokedAt: DateTime | null

  @column()
  declare syncStatus: 'pending' | 'synced' | 'failed'

  @column()
  declare syncedDoorsCount: number

  @column.dateTime()
  declare lastSyncedAt: DateTime | null

  @column()
  declare createdBy: number | null

  @column()
  declare lastModifiedBy: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relations
  @belongsTo(() => User, { foreignKey: 'userId' })
  declare user: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'issuedBy' })
  declare issuer: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'revokedBy' })
  declare revoker: BelongsTo<typeof User>

  @manyToMany(() => Door, {
    pivotTable: 'staff_access_card_doors',
    pivotForeignKey: 'staff_access_card_id',
    pivotRelatedForeignKey: 'door_id',
    pivotTimestamps: true,
  })
  declare doors: ManyToMany<typeof Door>


  public getStaffName(): string {
    // Si lié à un user, utiliser ses infos
    if (this.user) {
      return `${this.user.firstName} ${this.user.lastName}`
    }

    // Sinon, utiliser les infos du staff standalone
    if (this.staffFirstName && this.staffLastName) {
      return `${this.staffFirstName} ${this.staffLastName}`
    }

    return 'Unknown Staff'
  }

  /**
   * Vérifie si le badge est lié à un compte utilisateur
   */
  public isLinkedToUser(): boolean {
    return this.userId !== null
  }

  /**
   * Vérifie si le badge est actuellement valide
   */
  public isValid(): boolean {
    if (this.status !== 'active') return false

    const now = DateTime.now()

    if (this.validFrom && now < this.validFrom) return false
    if (this.validUntil && now > this.validUntil) return false

    return true
  }

  /**
   * Vérifie si le badge a expiré
   */
  public isExpired(): boolean {
    if (!this.validUntil) return false
    return DateTime.now() > this.validUntil
  }
}
