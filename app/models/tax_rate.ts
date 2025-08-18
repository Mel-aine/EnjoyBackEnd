
import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, ManyToMany } from '@adonisjs/lucid/types/relations'
import Hotel from '#models/hotel'
import Room from '#models/room'

export default class TaxRate extends BaseModel {
  @column({ isPrimary: true, columnName: 'tax_rate_id' })
  declare taxRateId: number

  @column({ columnName: 'hotel_id' })
  declare hotelId: number

  @column({ columnName: 'short_name' })
  declare shortName: string

  @column({ columnName: 'tax_name' })
  declare taxName: string

  @column.date({ columnName: 'applies_from' })
  declare appliesFrom: DateTime | null

  @column({ columnName: 'exempt_after' })
  declare exemptAfter: number | null

  @column({ columnName: 'posting_type' })
  declare postingType: string // 'flat_amount', 'flat_percentage', 'slab'

  @column()
  declare amount: number | null // if postingType = flat_amount

  @column()
  declare percentage: number | null // if postingType = flat_percentage

  @column({ columnName: 'slab_info' })
  declare slabInfo: string | null // if postingType = slab

  @column({ columnName: 'apply_tax' })
  declare applyTax: string // 'before_discount', 'after_discount'

  @column({ columnName: 'apply_tax_on_rack_rate' })
  declare applyTaxOnRackRate: boolean

  @column()
  declare status: string // 'active', 'inactive'

  @manyToMany(() => TaxRate, {
    pivotTable: 'tax_rate_dependencies',
    localKey: 'taxRateId',
    pivotForeignKey: 'tax_rate_id',
    relatedKey: 'taxRateId',
    pivotRelatedForeignKey: 'depends_on_tax_rate_id'
  })
  declare taxApplyAfter: ManyToMany<typeof TaxRate>

  @column({ columnName: 'is_active' })
  declare isActive: boolean

  @column({ columnName: 'applies_to_room_rate' })
  declare appliesToRoomRate: boolean

  @column({ columnName: 'applies_to_fnb' })
  declare appliesToFnb: boolean

  @column({ columnName: 'applies_to_other_services' })
  declare appliesToOtherServices: boolean

  @column.date({ columnName: 'effective_date' })
  declare effectiveDate: DateTime | null

  @column.date({ columnName: 'end_date' })
  declare endDate: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Hotel, { foreignKey: 'hotelId' })
  declare hotel: BelongsTo<typeof Hotel>

  @manyToMany(() => Room, {
    pivotTable: 'room_tax_rates',
    localKey: 'taxRateId',
    pivotForeignKey: 'tax_rate_id',
    relatedKey: 'id',
    pivotRelatedForeignKey: 'room_id'
  })
  declare rooms: ManyToMany<typeof Room>
}
