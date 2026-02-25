import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Module extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare slug: string

  @column()
  declare name: string

  @column()
  declare priceMonthly: number

  @column()
  declare description: string | null

  @column()
  declare isActive: boolean

  @column()
  declare isBundle: boolean

  @column({
    prepare: (value: any) => JSON.stringify(value),
    consume: (value: string) => (value ? JSON.parse(value) : []),
  })
  declare includedModulesJson: string[]

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}