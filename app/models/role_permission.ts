import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Role from '#models/role'
import Permission from '#models/permission'
import User from '#models/user'
import Hotel from '#models/hotel'

export default class RolePermission extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare role_id: number | null

  @column()
  declare created_by: number | null

  @column()
  declare last_modified_by: number | null

  @column()
  declare permission_id: number | null

  @column()
  declare hotel_id: number | null

  @belongsTo(() => Role, {
    foreignKey: 'role_id',
  })
  declare role: BelongsTo<typeof Role>

  @belongsTo(() => Permission, {
    foreignKey: 'permission_id',
  })
  declare permission: BelongsTo<typeof Permission>

  @belongsTo(() => Hotel, { foreignKey: 'hotel_id' })
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => User, { foreignKey: 'created_by' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'last_modified_by' })
  declare modifier: BelongsTo<typeof User>
  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
