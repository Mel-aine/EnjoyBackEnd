import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Hotel from '#models/hotel'
import Permission from '#models/permission'
import RolePermission from '#models/role_permission'

export default class Role extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare role_name: string

  @column()
  declare role_description: string | null

  @column()
  declare description: string | null

  @column()
  declare hotel_id: number | null

  @column()
  declare created_by: number | null

  @column()
  declare category_id: number | null


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

  @hasMany(() => RolePermission, {
    foreignKey: 'role_id',
  })
  declare rolePermissions: HasMany<typeof RolePermission>

  @manyToMany(() => Permission, {
    pivotTable: 'role_permissions',
    pivotForeignKey: 'role_id',
    pivotRelatedForeignKey: 'permission_id',
  })
  declare permissions: ManyToMany<typeof Permission>

  @belongsTo(() => Hotel, { foreignKey: 'hotel_id' })
  declare hotel: BelongsTo<typeof Hotel>

  /**
   * Vérifie si le rôle a une permission donnée
   */
  public async hasPermission(permissionName: string): Promise<boolean> {
    await this.load((loader: any) => loader.load('permissions'))
    return this.permissions.some((perm) => perm.name === permissionName)
  }
}
