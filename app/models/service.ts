import { DateTime } from 'luxon'
import { BaseModel, column,belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo   } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Category from '#models/category'

export default class Service extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare description: string

  @column()
  declare category_id: number

  @belongsTo(() => Category, {
    foreignKey: 'id'
  })
  declare category: BelongsTo<typeof Category>

  @column()
  declare address: string

  @column()
  declare phone_number: string

  @column()
  declare email: string

  @column()
  declare website: string

  @column()
  declare opening_days: string

  @column()
  declare opening_hours: string

  @column()
  declare price_range: string

  @column()
  declare facilities: string

  @column()
  declare policies: string

  @column()
  declare capacity: number

  @column()
  declare payment_methods: string

  @column()
  declare logo: string

  @column({
    prepare: (value: string[]) => JSON.stringify(value), // Convertir en JSON avant l’insertion
    consume: (value: string) => JSON.parse(value), // Convertir JSON en tableau après récupération
  })
  declare images: string[]

  @column()
  declare status: 'active' | 'inactive' | 'suspended'

  @column()
  declare created_by: number | null

  @column()
  declare last_modified_by: number | null

  @belongsTo(() => User, {
    foreignKey: 'created_by'
  })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'last_modified_by' })
  declare modifier: BelongsTo<typeof User>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
