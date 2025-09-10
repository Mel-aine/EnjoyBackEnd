import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, belongsTo } from '@adonisjs/lucid/orm'
import type { HasMany, BelongsTo } from '@adonisjs/lucid/types/relations'
import RoomType from './room_type.js'
import Room from './room.js'
import RatePlan from './rate_plan.js'
import Discount from './discount.js'
import Inventory from './inventory.js'
import User from './user.js'
import Currency from './currency.js'
import PaymentMethod from './payment_method.js'

export default class Hotel extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'hotel_name' })
  declare hotelName: string

  @column({ columnName: 'hotel_code' })
  declare hotelCode: string

  @column()
  declare address: string | null

  @column()
  declare city: string | null

  @column({ columnName: 'state_province' })
  declare stateProvince: string | null

  @column()
  declare country: string | null

  @column({ columnName: 'postal_code' })
  declare postalCode: string | null

  @column({ columnName: 'phone_number' })
  declare phoneNumber: string | null

  @column()
  declare email: string | null

  @column()
  declare website: string | null

  @column({ columnName: 'total_rooms' })
  declare totalRooms: number

  @column({ columnName: 'total_floors' })
  declare totalFloors: number

  @column({ columnName: 'currency_code' })
  declare currencyCode: string

  @column()
  declare timezone: string

  @column({ columnName: 'tax_rate' })
  declare taxRate: number

  @column({ columnName: 'license_number' })
  declare licenseNumber: string | null

  @column()
  declare status: string

  @column({
    serialize: (value: object | null) => value,
    prepare: (value: object | null) => value ? JSON.stringify(value) : null,
    consume: (value: string | object | null) => {
      if (value === null) return null;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      }
      return typeof value === 'object' ? value : null;
    }
  })
  declare amenities: object | null

  @column({
    serialize: (value: object | null) => value,
    prepare: (value: object | null) => value ? JSON.stringify(value) : null,
    consume: (value: string | object | null) => {
      if (value === null) return null;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      }
      return typeof value === 'object' ? value : null;
    }
  })
  declare policies: object | null

  @column()
  declare description: string | null

  @column({ columnName: 'logo_url' })
  declare logoUrl: string | null

  @column({
    columnName: 'contact_info',
    serialize: (value: object | null) => value,
    prepare: (value: object | null) => value ? JSON.stringify(value) : null,
    consume: (value: string | object | null) => {
      if (value === null) return null;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      }
      return typeof value === 'object' ? value : null;
    }
  })
  declare contactInfo: object | null

  @column({
    columnName: 'social_media',
    serialize: (value: object | null) => value,
    prepare: (value: object | null) => value ? JSON.stringify(value) : null,
    consume: (value: string | object | null) => {
      if (value === null) return null;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      }
      return typeof value === 'object' ? value : null;
    }
  })
  declare socialMedia: object | null

  @column({
    columnName: 'status_colors',
    serialize: (value: object | null) => value,
    prepare: (value: object | null) => value ? JSON.stringify(value) : null,
    consume: (value: string | object | null) => {
      if (value === null) return null;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      }
      return typeof value === 'object' ? value : null;
    }
  })
  declare statusColors: object | null

  @column({
    columnName: 'housekeeping_status_colors',
    serialize: (value: object | null) => value,
    prepare: (value: object | null) => value ? JSON.stringify(value) : null,
    consume: (value: string | object | null) => {
      if (value === null) return null;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      }
      return typeof value === 'object' ? value : null;
    }
  })
  declare housekeepingStatusColors: object | null

  @column({ columnName: 'floor_plan_url' })
  declare floorPlanUrl: string | null

  @column()
  declare fax: string | null

  @column({ columnName: 'system_date_determination_method' })
  declare systemDateDeterminationMethod : 'UseDayClose' | 'RealTime'

  @column({ columnName: 'auto_night_audit_time' })
  declare autoNightAuditTime  : string | null

  @column({ columnName: 'registration_no_1' })
  declare registrationNo1: string | null

  @column({ columnName: 'registration_no_2' })
  declare registrationNo2: string | null

  @column({ columnName: 'registration_no_3' })
  declare registrationNo3: string | null

  @column({ columnName: 'cancellation_policy' })
  declare cancellationPolicy: string | null

  @column({ columnName: 'hotel_policy' })
  declare hotelPolicy: string | null

  @column({ columnName: 'property_type' })
  declare propertyType: string | null

  @column({ columnName: 'address_2' })
  declare address2: string | null

  @column()
  declare grade: number | null

  @column({
    serialize: (value: object | null) => value,
    prepare: (value: object | null) => value ? JSON.stringify(value) : null,
    consume: (value: string | object | null) => {
      if (value === null) return null;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      }
      return typeof value === 'object' ? value : null;
    }
  })
  declare notices: object | null

  @column({
    columnName: 'formula_setting',
    serialize: (value: object | null) => value,
    prepare: (value: object | null) => value ? JSON.stringify(value) : null,
    consume: (value: string | object | null) => {
      if (value === null) return null;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      }
      return typeof value === 'object' ? value : null;
    }
  })
  declare formulaSetting: object | null

  @column({
    columnName: 'document_numbering_setting',
    serialize: (value: object | null) => value,
    prepare: (value: object | null) => value ? JSON.stringify(value) : null,
    consume: (value: string | object | null) => {
      if (value === null) return null;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      }
      return typeof value === 'object' ? value : null;
    }
  })
  declare documentNumberingSetting: object | null

  @column({
    columnName: 'print_email_settings',
    serialize: (value: object | null) => value,
    prepare: (value: object | null) => value ? JSON.stringify(value) : null,
    consume: (value: string | object | null) => {
      if (value === null) return null;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      }
      return typeof value === 'object' ? value : null;
    }
  })
  declare printEmailSettings: object | null

  @column({
    columnName: 'checkin_reservation_settings',
    serialize: (value: object | null) => value,
    prepare: (value: object | null) => value ? JSON.stringify(value) : null,
    consume: (value: string | object | null) => {
      if (value === null) return null;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      }
      return typeof value === 'object' ? value : null;
    }
  })
  declare checkinReservationSettings: object | null

  @column({
    columnName: 'display_settings',
    serialize: (value: object | null) => value,
    prepare: (value: object | null) => value ? JSON.stringify(value) : null,
    consume: (value: string | object | null) => {
      if (value === null) return null;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      }
      return typeof value === 'object' ? value : null;
    }
  })
  declare displaySettings: object | null

  @column({
    columnName: 'registration_settings',
    serialize: (value: object | null) => value,
    prepare: (value: object | null) => value ? JSON.stringify(value) : null,
    consume: (value: string | object | null) => {
      if (value === null) return null;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      }
      return typeof value === 'object' ? value : null;
    }
  })
  declare registrationSettings: object | null

  @column({ columnName: 'min_price' })
  declare minPrice: number | null

  @column({ columnName: 'max_price' })
  declare maxPrice: number | null

  @column({ columnName: 'state_length' })
  declare stateLength: number | null

  @column({ columnName: 'cut_off_time' })
  declare cutOffTime: string | null

  @column({ columnName: 'cut_off_days' })
  declare cutOffDays: number | null

  @column({ columnName: 'max_day_advance' })
  declare maxDayAdvance: number | null

  @column()
  declare longitude: string | null

  @column()
  declare latitude: string | null

  @column({ columnName: 'check_in_time' })
  declare checkInTime: string | null

  @column({ columnName: 'check_out_time' })
  declare checkOutTime: string | null

  @column({ columnName: 'internet_access_type' })
  declare internetAccessType: string | null

  @column({ columnName: 'internet_access_cost' })
  declare internetAccessCost: number | null

  @column({ columnName: 'internet_access_coverage' })
  declare internetAccessCoverage: string | null

  @column({ columnName: 'parking_type' })
  declare parkingType: string | null

  @column({ columnName: 'parking_reservation' })
  declare parkingReservation: boolean | null

  @column({ columnName: 'parking_is_private' })
  declare parkingIsPrivate: boolean | null

  @column({ columnName: 'pets_policy' })
  declare petsPolicy: string | null

  @column({ columnName: 'pets_non_refundable_fee' })
  declare petsNonRefundableFee: number | null

  @column({ columnName: 'pets_refundable_deposit' })
  declare petsRefundableDeposit: number | null

  @column({ columnName: 'smoking_policy' })
  declare smokingPolicy: string | null

  @column({ columnName: 'is_adults_only' })
  declare isAdultsOnly: boolean | null

  @column({ columnName: 'max_count_of_guests' })
  declare maxCountOfGuests: number | null

  @column({ columnName: 'channex_group_id' })
  declare channexGroupId: string | null

  @column({ columnName: 'channex_property_id' })
  declare channexPropertyId: string | null

  @column()
  declare migrated: boolean

  @column({ columnName: 'channel_enable' })
  declare channelEnable: boolean

  @column.dateTime({ columnName: 'last_migration_date' })
  declare lastMigrationDate: DateTime | null

  @column({ columnName: 'created_by' })
  declare createdBy: number | null

  @column({ columnName: 'last_modified_by' })
  declare lastModifiedBy: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relationships
  @hasMany(() => RoomType)
  declare roomTypes: HasMany<typeof RoomType>

  @hasMany(() => Room)
  declare rooms: HasMany<typeof Room>

  @hasMany(() => RatePlan)
  declare ratePlans: HasMany<typeof RatePlan>

  @hasMany(() => Discount)
  declare discounts: HasMany<typeof Discount>

  @hasMany(() => Inventory)
  declare inventories: HasMany<typeof Inventory>

  @hasMany(() => Currency)
  declare currencies: HasMany<typeof Currency>

  @belongsTo(() => User, { foreignKey: 'created_by' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'last_modified_by' })
  declare modifier: BelongsTo<typeof User>

  @hasMany(() => PaymentMethod)
  declare paymentMethods: HasMany<typeof PaymentMethod>

}
