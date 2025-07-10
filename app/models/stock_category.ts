import { DateTime } from 'luxon'
import { BaseModel, column , belongsTo} from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Service from '#models/service'
import User from '#models/user'

export default class StockCategory extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare service_id: number

  @column()
  declare description: string | null

  @column()
  declare parent_category_id: number

  @column()
  declare created_by: number | null

  @column()
  declare last_modified_by: number | null

  @belongsTo(() => User, {
    foreignKey: 'created_by'
  })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'last_modified_by' })
  declare modifier: BelongsTo<typeof User>


  @belongsTo(() => Service, { foreignKey: 'service_id' })
  declare Services: BelongsTo<typeof Service>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
