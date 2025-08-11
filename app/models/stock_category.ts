import { DateTime } from 'luxon'
import { BaseModel, column , belongsTo} from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Hotel from '#models/hotel'
import User from '#models/user'

export default class StockCategory extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare hotel_id: number

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


  @belongsTo(() => Hotel, { foreignKey: 'hotel_id' })
  declare hotel: BelongsTo<typeof Hotel>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
