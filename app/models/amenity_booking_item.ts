import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import AmenityBooking from '#models/amenity_booking'
import AmenityProduct from '#models/amenity_product'

export default class AmenityBookingItem extends BaseModel {
  public static table = 'amenity_booking_items'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'amenity_booking_id' })
  declare amenityBookingId: number

  @column({ columnName: 'amenity_product_id' })
  declare amenityProductId: number

  @column()
  declare quantity: number

  @column({ columnName: 'price_per_unit' })
  declare pricePerUnit: number

  @column()
  declare subtotal: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => AmenityBooking, {
    foreignKey: 'amenityBookingId',
  })
  declare amenityBooking: BelongsTo<typeof AmenityBooking>

  @belongsTo(() => AmenityProduct, {
    foreignKey: 'amenityProductId',
  })
  declare amenityProduct: BelongsTo<typeof AmenityProduct>
}

