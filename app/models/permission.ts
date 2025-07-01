import { DateTime } from 'luxon'
import { BaseModel, column, manyToMany} from '@adonisjs/lucid/orm'
import type { ManyToMany } from '@adonisjs/lucid/types/relations'
import Role from '#models/role'

export default class Permission extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

   @column()
  declare name: string

  @column()
  declare label: string | null

  @column()
  declare icon: string | null

  @column()
  declare category: string | null

  /**
   * Relations
   */
  @manyToMany(() => Role, {
    pivotTable: 'role_permissions',
    pivotTimestamps: true,
  })
  declare roles: ManyToMany<typeof Role>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
