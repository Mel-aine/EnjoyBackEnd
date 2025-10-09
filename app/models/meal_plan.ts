import { DateTime } from 'luxon'
import { BaseModel, column, manyToMany, hasMany, belongsTo } from '@adonisjs/lucid/orm'
import type { ManyToMany, HasMany, BelongsTo } from '@adonisjs/lucid/types/relations'
import ExtraCharge from './extra_charge.js'
import MealPlanComponent from './meal_plan_component.js'
import Hotel from './hotel.js'
import User from './user.js'

export default class MealPlan extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotelId: number

  @column()
  declare name: string

  @column({ columnName: 'short_code' })
  declare shortCode: string

  @column()
  declare description: string | null

  @column()
  declare status: string

  @column({ columnName: 'is_all_inclusive' })
  declare isAllInclusive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @column()
  declare createdBy: number | null

  @column()
  declare lastModifiedBy: number | null

  @manyToMany(() => ExtraCharge, {
    pivotTable: 'meal_plan_components',
    localKey: 'id',
    pivotForeignKey: 'meal_plan_id',
    relatedKey: 'id',
    pivotRelatedForeignKey: 'extra_charge_id',
    pivotColumns: ['quantity_per_day', 'target_guest_type']
  })
  declare extraCharges: ManyToMany<typeof ExtraCharge>

  @hasMany(() => MealPlanComponent, { foreignKey: 'mealPlanId' })
  declare components: HasMany<typeof MealPlanComponent>

  @belongsTo(() => Hotel, { foreignKey: 'hotelId' })
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => User, { foreignKey: 'createdBy' })
  declare createdByUser: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'lastModifiedBy' })
  declare lastModifiedByUser: BelongsTo<typeof User>
}