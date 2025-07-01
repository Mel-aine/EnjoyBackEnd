import { DateTime } from 'luxon'
import { BaseModel, column, hasMany , belongsTo} from '@adonisjs/lucid/orm'
import type { HasMany,BelongsTo } from '@adonisjs/lucid/types/relations'
import Option from '#models/option'
import Services from '#models/service'

export default class ProductType extends BaseModel {
  @column({ isPrimary: true })
  declare id: number
  @column()
  declare name: string

  @column()
  declare description: string

  @column()
  declare default_guest: number

  @column()
  declare price : number

  @column()
  declare extra_guest_price: number | null


  @column()
  declare default_deposit: number | null

   @column()
  declare status: 'active' | 'inactive' | 'suspended'

  @column()
  declare service_id: number

  @hasMany(() => Option,{foreignKey: 'product_type_id'})
  declare options: HasMany <typeof Option>

  @belongsTo(() => Services, { foreignKey: 'service_id' })
    declare Services: BelongsTo<typeof Services>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
