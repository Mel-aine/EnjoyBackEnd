import { DateTime } from 'luxon'
import { BaseModel, column ,belongsTo} from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import typeProduct from '#models/type_product'

export default class Option extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare option_name: string

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

  @belongsTo(() => typeProduct,{foreignKey:'id'})
  declare typeProduct: BelongsTo<typeof typeProduct>
  // Relations
  @belongsTo(() => User, { foreignKey: 'created_by' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'last_modified_by' })
  declare modifier: BelongsTo<typeof User>

}
