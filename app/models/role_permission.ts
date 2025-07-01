import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Role from '#models/role'
import Permission from '#models/permission'

export default class RolePermission extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

   @column()
  declare role_id: number | null

  @column()
  declare permission_id: number | null

  @belongsTo(() => Role, {
      foreignKey: 'role_id',
    })
  declare role: BelongsTo<typeof Role>

  @belongsTo(() => Permission, {
        foreignKey: 'permission_id',
      })
  declare permission: BelongsTo<typeof Permission>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
