import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Hotel from '#models/hotel'
import User from '#models/user'

export default class SystemSettings extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotel_id: number

  @column()
  declare setting_category: string

  @column()
  declare setting_key: string

  @column()
  declare setting_value: string | null

  @column()
  declare setting_data_type: 'String' | 'Integer' | 'Decimal' | 'Boolean' | 'Date' | 'JSON'

  @column()
  declare setting_description: string | null

  @column()
  declare is_system_setting: boolean

  @column()
  declare is_user_configurable: boolean

  @column()
  declare default_value: string | null

  @column()
  declare validation_rules: string | null

  @column()
  declare display_order: number | null

  @column()
  declare is_sensitive: boolean

  @column()
  declare created_by: number

  @column()
  declare last_modified_by: number | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  // Relations
  @belongsTo(() => Hotel, { foreignKey: 'hotel_id' })
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => User, { foreignKey: 'created_by' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'last_modified_by' })
  declare modifier: BelongsTo<typeof User>

  // Computed properties
  get displayName() {
    return `${this.setting_category}.${this.setting_key}`
  }

  get typedValue() {
    if (!this.setting_value) return null
    
    switch (this.setting_data_type) {
      case 'Integer':
        return parseInt(this.setting_value)
      case 'Decimal':
        return parseFloat(this.setting_value)
      case 'Boolean':
        return this.setting_value.toLowerCase() === 'true'
      case 'Date':
        return DateTime.fromISO(this.setting_value)
      case 'JSON':
        try {
          return JSON.parse(this.setting_value)
        } catch {
          return null
        }
      default:
        return this.setting_value
    }
  }

  get isConfigurable() {
    return this.is_user_configurable && !this.is_system_setting
  }
}