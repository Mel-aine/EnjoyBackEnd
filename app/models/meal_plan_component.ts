import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import MealPlan from './meal_plan.js'
import ExtraCharge from './extra_charge.js'
import Hotel from './hotel.js'
import User from './user.js'

export default class MealPlanComponent extends BaseModel {
  public static table = 'meal_plan_components'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'hotel_id' })
  declare hotelId: number

  @column({ columnName: 'meal_plan_id' })
  declare mealPlanId: number

  @column({ columnName: 'extra_charge_id' })
  declare extraChargeId: number

  @column({ columnName: 'quantity_per_day' })
  declare quantityPerDay: number

  @column({ columnName: 'target_guest_type' })
  declare targetGuestType: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @column({ columnName: 'created_by' })
  declare createdBy: number | null

  @column({ columnName: 'last_modified_by' })
  declare lastModifiedBy: number | null

  @belongsTo(() => MealPlan, { foreignKey: 'mealPlanId' })
  declare mealPlan: BelongsTo<typeof MealPlan>

  @belongsTo(() => ExtraCharge, { foreignKey: 'extraChargeId' })
  declare extraCharge: BelongsTo<typeof ExtraCharge>

  @belongsTo(() => Hotel, { foreignKey: 'hotelId' })
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => User, { foreignKey: 'createdBy' })
  declare createdByUser: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'lastModifiedBy' })
  declare lastModifiedByUser: BelongsTo<typeof User>
}