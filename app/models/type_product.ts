import { DateTime } from 'luxon'
import { BaseModel, column, hasMany , belongsTo} from '@adonisjs/lucid/orm'
import type { HasMany,BelongsTo } from '@adonisjs/lucid/types/relations'
import Option from '#models/option'
import Services from '#models/service'

export default class TypeProduct extends BaseModel {
  @column({ isPrimary: true })
  declare id: number
  @column()
  declare name: string

  @column()
  declare description: string

  @column()
  declare status: string

  @hasMany(() => Option,{foreignKey: 'id'})
  declare options: HasMany <typeof Option>

  @belongsTo(() => Services, { foreignKey: 'service_id' })
    declare Services: BelongsTo<typeof Services>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
