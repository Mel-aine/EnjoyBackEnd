import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Hotel from './hotel.js'

export default class HotelHistory extends BaseModel {
  public static table = 'hotel_histories'

  @column({ isPrimary: true })
  declare id: number

  // Link to hotel
  @column()
  declare hotelId: number

  @belongsTo(() => Hotel)
  declare hotel: BelongsTo<typeof Hotel>

  // Requested fields
  @column()
  declare hotelName: string | null

  @column()
  declare reservationNumber: string | null // Res #

  @column.date()
  declare bookingDate: DateTime | null

  @column()
  declare bookingTime: string | null // HH:mm or time string

  @column()
  declare guestName: string | null

  @column()
  declare userName: string | null // User

  @column.date()
  declare arrivalDate: DateTime | null // Arrival

  @column.date()
  declare departureDate: DateTime | null // Dept (Departure)

  @column()
  declare room: string | null

  @column()
  declare rateType: string | null

  @column()
  declare pax: number | null

  @column()
  declare total: number | null

  @column()
  declare adr: number | null // Average Daily Rate

  @column()
  declare deposit: number | null

  @column()
  declare source: string | null

  @column()
  declare totalTax: number | null

  @column()
  declare totalCharges: number | null

  @column()
  declare commission: number | null

  @column()
  declare voucher: string | null

  @column()
  declare status: string | null

  @column()
  declare dueAmount: number | null // Due Amt.

  @column()
  declare email: string | null

  @column()
  declare mobileNo: string | null

  @column()
  declare city: string | null

  @column()
  declare country: string | null

  @column()
  declare zipCode: string | null

  @column()
  declare state: string | null

  @column()
  declare folioNo: string | null

  @column()
  declare preference: string | null

  @column()
  declare travelAgent: string | null

  @column()
  declare salesperson: string | null

  @column()
  declare remark: string | null

  @column()
  declare reservationType: string | null

  @column()
  declare marketCode: string | null

  @column()
  declare paymentType: string | null

  @column()
  declare numberOfNights: number | null

  @column.date()
  declare cancellationDate: DateTime | null

  @column.dateTime()
  declare lastModifiedDate: DateTime | null

  @column()
  declare lastModifiedBy: string | null

  @column()
  declare numberOfRoomsBooked: number | null

  @column({
    prepare: (value: object | null) => (value ? JSON.stringify(value) : null),
    consume: (value: any) => {
      if (!value) return null
      try {
        return typeof value === 'string' ? JSON.parse(value) : value
      } catch {
        return null
      }
    },
  })
  declare extractCharge: Record<string, any> | null

  // Audit timestamps
  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}

