import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import ServiceImage from '#models/service_image'
import Category from '#models/category'

export default class Service extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column()
  declare category_id: number

  @belongsTo(() => Category, {
    foreignKey: 'category_id'
  })
  declare category: BelongsTo<typeof Category>

  @column()
  declare address_service: string | null

  @column()
  declare phone_number_service: string | null

  @column()
  declare email_service: string | null

  @column()
  declare website: string | null

  // @column()
  // declare openings: string | null
  // @column({
  //   prepare: (value: any) => JSON.stringify(value),
  //   consume: (value: string) => JSON.parse(value),
  // })
  // declare openings: any

  @column()
  declare price_range: '$' | '$$' | '$$$' | '$$$$'

  @column()
  declare average_rating: number | null

  @column()
  declare review_count: number | null

  // @column()
  // declare facilities: any

  @column()
  declare policies: string | null

  @column()
  declare capacity: number | null

  // @column()
  // declare payment_methods: any

  @column()
  declare logo: string | null

  @column({
  prepare: (value: string[]) => JSON.stringify(value),
    consume: (value) => {
    try {
      if (!value) return [];
      if (Array.isArray(value)) return value;
      if (typeof value === 'string' && value.trim().startsWith('[')) {
        return JSON.parse(value);
      }
      if (typeof value === 'string') {
        return [value];
      }

      return [];
    } catch (e) {
      console.error('Erreur parsing images:', e, value);
      return [];
    }
  }
  })
  declare images: string[]

  // @column({
  //   prepare: (value) => JSON.stringify(value),
  //   consume: (value) => {
  //     try {
  //       if (!value) return [];
  //       return typeof value === 'string' ? JSON.parse(value) : value;
  //     } catch (e) {
  //       console.error('Erreur parsing images:', e, value);
  //       return [];
  //     }
  //   },
  // })
  // declare images: string[]


  @column({
    prepare: (value) => JSON.stringify(value),
    consume: (value) => typeof value === 'string' ? JSON.parse(value) : value,
  })
  declare openings: Record<string, any>

  // @column({
  //   prepare: (value) => JSON.stringify(value),
  //   consume: (value) => typeof value === 'string' ? JSON.parse(value) : value,
  // })
  // declare images: string[]

  @column({
    prepare: (value) => JSON.stringify(value),
    consume: (value) => typeof value === 'string' ? JSON.parse(value) : value,
  })
  declare facilities: string[]

  @column({
    prepare: (value) => JSON.stringify(value),
    consume: (value) => typeof value === 'string' ? JSON.parse(value) : value,
  })
  declare payment_methods: string[]

  @column()
  declare status_service: 'active' | 'inactive' | 'suspended'

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

  @hasMany(() => ServiceImage, {
    foreignKey: 'service_id',
  })
  declare serviceImages: HasMany<typeof ServiceImage>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
