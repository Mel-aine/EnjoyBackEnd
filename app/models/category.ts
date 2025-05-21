import { DateTime } from 'luxon'
import { BaseModel, column,belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo} from '@adonisjs/lucid/types/relations'
import User from '#models/user'



export default class Category extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare category_name: string

  @column()
  declare description: string

  @column()
  declare parent_category_id: number

  @column()
  declare status: 'active' | 'inactive' | 'archived'

  @column()
  declare created_by: number | null

  @column()
  declare last_modified_by: number | null

  // @belongsTo(() => Category, {
  //   foreignKey: 'parent_category_id'
  // })
  // declare parentCategory: BelongsTo<typeof Category>

  // @hasMany(() => Category, {
  //   foreignKey: 'parent_category_id'
  // })
  // declare subCategories: HasMany<typeof Category>

  @belongsTo(() => User, { foreignKey: 'created_by' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'last_modified_by' })
  declare modifier: BelongsTo<typeof User>

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

}
