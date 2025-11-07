import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate, beforeUpdate } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Hotel from './hotel.js'
import User from './user.js'

export default class Currency extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare country: string

  @column()
  declare name: string

  @column()
  declare sign: string

  @column()
  declare prefixSuffix: 'prefix' | 'suffix'

  @column()
  declare currencyCode: string

  @column()
  declare digitsAfterDecimal: number

  @column()
  declare exchangeRate: number

  @column()
  declare isEditable: boolean

  @column({ columnName: 'is_default' })
  declare isDefault: boolean

  @column()
  declare hotelId: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @column()
  declare createdByUserId: number | null

  @column()
  declare updatedByUserId: number | null

  @column()
  declare isDeleted: boolean

  @column.dateTime()
  declare deletedAt: DateTime | null

  // Relationships
  @belongsTo(() => Hotel)
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => User, {
    foreignKey: 'createdByUserId',
  })
  declare createdBy: BelongsTo<typeof User>

  @belongsTo(() => User, {
    foreignKey: 'updatedByUserId',
  })
  declare updatedBy: BelongsTo<typeof User>

  // Hooks
  @beforeCreate()
  public static async ensureSingleDefaultPerHotel(model: Currency) {
    if (model.isDefault === true) {
      const existingDefault = await Currency.query()
        .where('hotel_id', model.hotelId)
        .where('is_default', true)
        .first()

      if (existingDefault) {
        throw new Error('Only one default currency per hotel is allowed')
      }
    }
  }

  @beforeUpdate()
  public static preventIsDefaultUpdate(model: Currency) {
    if (model.$dirty && Object.prototype.hasOwnProperty.call(model.$dirty, 'isDefault')) {
      throw new Error('The default currency flag (isDefault) is not updatable')
    }
  }
}