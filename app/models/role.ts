import { DateTime } from 'luxon'
import { BaseModel, column ,belongsTo,hasMany} from '@adonisjs/lucid/orm'
import type { BelongsTo , HasMany  } from '@adonisjs/lucid/types/relations'
import User from '#models/user'

export default class Role extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare role_name: string

  @column()
  declare description: string | null

   @column()
  declare category_name: string | null

  // @column()
  // declare permissions: Record<string, any> | null

  @column()
  declare created_by: number | null

  @column()
  declare last_modified_by: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User, { foreignKey: 'created_by' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'last_modified_by' })
  declare modifier: BelongsTo<typeof User>

  @hasMany(() => User, { foreignKey: 'role_id' })
  declare users: HasMany<typeof User>

  /**
   * Vérifie si le rôle a une permission donnée
   */
  // public hasPermission(permissionKey: string): boolean {
  //   if (!this.permissions) {
  //     return false
  //   }
  //   return !!this.permissions[permissionKey]
  // }
}
