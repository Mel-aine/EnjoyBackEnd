import { DateTime } from 'luxon'
import { BaseModel, column ,belongsTo,hasMany,manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo,HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import Service from '#models/service'
import ProductOption from '#models/production_option'
import ReservationServiceProduct from '#models/reservation_service_product'
import ProductType from '#models/product_type'
import ServiceImage from '#models/service_image'
import User from '#models/user'
import Option from '#models/option'
import Reservation from '#models/reservation'

export default class ServiceProduct extends BaseModel {
  @column({ isPrimary: true })
  declare id: number
  @column()
  declare service_id: number

  @column()
  declare product_name: string

  @column()
   declare capacity: number | null

  @column()
   declare floor: number | null

   @column()
   declare room_number: number | null

  @column()
  declare product_type_id: number

  @column()
  declare price: number

  @column()
  declare description: string

  @column()
  declare availability: boolean

  @column()
  declare customization_allowed: boolean

  @column()
  declare payment_type: string

  @column()
  declare status: string

  @hasMany(() => ProductOption, {
    foreignKey: 'service_product_id',
  })
  declare options: HasMany<typeof ProductOption>

  @column()
  declare created_by: number | null

  @column()
  declare last_modified_by: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relations

  @belongsTo(() => Service, { foreignKey: 'service_id' })
  declare service: BelongsTo<typeof Service>

  @hasMany(() => ReservationServiceProduct, { foreignKey: 'service_product_id' })
declare reservationServiceProducts: HasMany<typeof ReservationServiceProduct>


  @belongsTo(() => ProductType, {
    foreignKey: 'product_type_id',
  })
  declare productType: BelongsTo<typeof ProductType>

  @hasMany(() => ServiceImage, { foreignKey: 'service_product_id', })
  declare images: HasMany<typeof ServiceImage>


  @belongsTo(() => User, { foreignKey: 'created_by'})
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'last_modified_by' })
  declare modifier: BelongsTo<typeof User>

    @manyToMany(() => Reservation, {
    pivotTable: 'reservation_service_products',
    pivotForeignKey: 'service_product_id',
    pivotRelatedForeignKey: 'reservation_id',
  })
  declare reservations: ManyToMany<typeof Reservation>

@manyToMany(() => Option, {
  pivotTable: 'production_options',
  pivotForeignKey: 'service_product_id',
  pivotRelatedForeignKey: 'option_id',
  pivotColumns: ['value'],
})
declare availableOptions: ManyToMany<typeof Option>

}
