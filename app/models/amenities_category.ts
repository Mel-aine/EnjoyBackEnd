import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Hotel from '#models/hotel'

export default class AmenitiesCategory extends BaseModel {
  public static table = 'amenities_categories'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column({ columnName: 'hotel_id' })
  declare HotelId: number

  @column()
  declare status: 'active' | 'inactive' | 'archived'

  @column({ columnName: 'source_type' })
  declare sourceType: 'External' | 'Internal'

  @column({ columnName: 'external_system_id' })
  declare externalSystemId: string | null

  @column({ columnName: 'created_by' })
  declare createdBy: number | null

  @column({ columnName: 'last_modified_by' })
  declare lastModifiedBy: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User, { foreignKey: 'createdBy' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'lastModifiedBy' })
  declare modifier: BelongsTo<typeof User>

  @belongsTo(() => Hotel, { foreignKey: 'HotelId' })
  declare service: BelongsTo<typeof Hotel>
}
