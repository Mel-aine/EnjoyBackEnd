import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import ProductType from '#models/product_type'
import Category from '#models/category'

export default class Option extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare option_name: string

  @column()
  declare product_type_id?: number

  @column()
  declare category_id?: number

  @column()
  declare description: string

  @column()
  declare value: string


  @column()
  declare is_default: boolean

  @column()
  declare type: 'picklist' | 'text' | 'number'

  // @column({
  //   prepare: (value: string[] | null) => JSON.stringify(value),
  //   consume: (value: string | null) => value ? JSON.parse(value) : [],
  // })
  @column({
    consume: (value: any) => {
      if (Array.isArray(value)) return value
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value)
          if (Array.isArray(parsed)) return parsed
          return value.split(',').map((v) => v.trim())
        } catch {
          return value.split(',').map((v) => v.trim())
        }
      }
      return []
    },
    prepare: (value: string[]) => JSON.stringify(value),
  })
  declare values: string[]

  @column()
  declare created_by: number | null

  @column()
  declare last_modified_by: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => ProductType, { foreignKey: 'product_type_id' })
  declare typeProduct: BelongsTo<typeof ProductType>

  @belongsTo(() => Category, { foreignKey: 'category_id' })
  declare category: BelongsTo<typeof Category>
 
  @belongsTo(() => User, { foreignKey: 'created_by' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'last_modified_by' })
  declare modifier: BelongsTo<typeof User>

}
