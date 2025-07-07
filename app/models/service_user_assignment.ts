import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Service from '#models/service'
import User from '#models/user'
import Role from '#models/role'
import Department from '#models/department'

export default class ServiceUserAssignment extends BaseModel {
  @column({ isPrimary: true })
  declare id: number


  @column()
  declare user_id: number

  @column()
  declare service_id: number

  @column()
  declare role: string

  @belongsTo(() => Role, {
    foreignKey: 'role',
    localKey: 'role_name',
  })
  declare roleModel: BelongsTo<typeof Role>

  @column()
  public department_id?: number

   @column.dateTime()
  declare hire_date: DateTime | null

  @belongsTo(() => Department, { foreignKey: 'department_id' })
  declare department: BelongsTo<typeof Department>

  @belongsTo(() => User, { foreignKey: 'user_id' })
    declare user: BelongsTo<typeof User>

   @belongsTo(() => Service, { foreignKey: 'service_id' })
   declare service: BelongsTo<typeof Service>


  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
