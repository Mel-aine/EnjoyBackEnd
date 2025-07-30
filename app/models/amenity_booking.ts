import { DateTime } from 'luxon'
import { BaseModel, beforeCreate, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Reservation from '#models/reservation'
import User from '#models/user'
import AmenityBookingItem from '#models/amenity_booking_item'
import { cuid } from '@adonisjs/core/helpers'

export default class AmenityBooking extends BaseModel {
  public static table = 'amenity_bookings'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'reservation_id' })
  declare reservationId: number

  @column({ columnName: 'amenity_order_number' })
  declare amenityOrderNumber: string

  @column({ columnName: 'total_amount' })
  declare totalAmount: number

  @column()
  declare status: 'completed' | 'pending' | 'cancelled'

  @column.dateTime()
  declare bookedAt: DateTime

  @column({ columnName: 'created_by' })
  declare createdBy: number | null

  @column({ columnName: 'last_modified_by' })
  declare lastModifiedBy: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @beforeCreate()
  public static generateOrderNumber(booking: AmenityBooking) {
    if (!booking.amenityOrderNumber) {
      booking.amenityOrderNumber = `AMENITY-${cuid()}`
    }
  }

  @belongsTo(() => Reservation, {
    foreignKey: 'reservationId',
  })
  declare reservation: BelongsTo<typeof Reservation>

  @belongsTo(() => User, {
    foreignKey: 'createdBy',
  })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, {
    foreignKey: 'lastModifiedBy',
  })
  declare modifier: BelongsTo<typeof User>

  @hasMany(() => AmenityBookingItem, {
    foreignKey: 'amenityBookingId',
  })
  declare items: HasMany<typeof AmenityBookingItem>
}

