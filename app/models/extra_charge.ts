import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, ManyToMany } from '@adonisjs/lucid/types/relations'
import Hotel from './hotel.js'
import User from './user.js'
import TaxRate from './tax_rate.js'

export default class ExtraCharge extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotelId: number

  @column()
  declare shortCode: string

  @column()
  declare name: string

  @column()
  declare rate: number

  @column()
  declare rateInclusiveTax: number

  @column()
  declare fixedPrice: boolean

  @column()
  declare frontDeskSortKey: number

  @column()
  declare publishOnWeb: boolean

  @column()
  declare voucherNo: string

  @column()
  declare description: string | null

  @column()
  declare webResSortKey: number

  @column.date()
  declare validFrom: DateTime

  @column.date()
  declare validTo: DateTime

  @column()
  declare chargeAppliesOn: string

  @column()
  declare applyChargeOn: string

  @column()
  declare applyChargeAlways: boolean

  // Audit fields
  @column()
  declare createdByUserId: number | null

  @column()
  declare updatedByUserId: number | null

  @column()
  declare isDeleted: boolean

  @column.dateTime()
  declare deletedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relationships
  @belongsTo(() => Hotel)
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => User, {
    foreignKey: 'createdByUserId',
  })
  declare createdByUser: BelongsTo<typeof User>

  @belongsTo(() => User, {
    foreignKey: 'updatedByUserId',
  })
  declare updatedByUser: BelongsTo<typeof User>

  @manyToMany(() => TaxRate, {
    pivotTable: 'extra_charge_tax_rates',
    localKey: 'id',
    pivotForeignKey: 'extra_charge_id',
    relatedKey: 'taxRateId',
    pivotRelatedForeignKey: 'tax_rate_id',
  })
  declare taxRates: ManyToMany<typeof TaxRate>
}