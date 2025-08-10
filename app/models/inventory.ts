import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Hotel from './hotel.js'
import User from './user.js'

export default class Inventory extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotelId: number

  @column()
  declare itemCode: string

  @column()
  declare itemName: string

  @column()
  declare description: string

  @column()
  declare category: 'housekeeping' | 'maintenance' | 'food_beverage' | 'office_supplies' | 'guest_amenities' | 'linens' | 'furniture' | 'equipment' | 'technology' | 'safety' | 'other'

  @column()
  declare subcategory: string

  @column()
  declare brand: string

  @column()
  declare model: string

  @column()
  declare sku: string

  @column()
  declare barcode: string

  @column()
  declare unitOfMeasure: 'piece' | 'box' | 'case' | 'liter' | 'kilogram' | 'meter' | 'square_meter' | 'cubic_meter' | 'gallon' | 'pound' | 'ounce' | 'dozen' | 'pack' | 'roll' | 'bottle' | 'tube' | 'bag' | 'set'

  @column()
  declare currentStock: number

  @column()
  declare minimumStock: number

  @column()
  declare maximumStock: number

  @column()
  declare reorderPoint: number

  @column()
  declare reorderQuantity: number

  @column()
  declare unitCost: number

  @column()
  declare totalValue: number

  @column()
  declare supplierName: string

  @column()
  declare supplierCode: string

  @column()
  declare supplierContact: object

  @column()
  declare supplierPartNumber: string

  @column()
  declare leadTimeDays: number

  @column.dateTime()
  declare lastOrderDate: DateTime

  @column.dateTime()
  declare nextOrderDate: DateTime

  @column.dateTime()
  declare expiryDate: DateTime

  @column()
  declare shelfLifeDays: number

  @column()
  declare storageLocation: string

  @column()
  declare storageRequirements: 'room_temperature' | 'refrigerated' | 'frozen' | 'dry' | 'climate_controlled' | 'hazardous' | 'secure' | 'special'

  @column()
  declare isPerishable: boolean

  @column()
  declare isHazardous: boolean

  @column()
  declare safetyInstructions: string

  @column()
  declare requiresTraining: boolean

  @column()
  declare usageInstructions: string

  @column()
  declare specifications: object

  @column()
  declare warrantyPeriod: number

  @column.dateTime()
  declare purchaseDate: DateTime

  @column.dateTime()
  declare warrantyExpiry: DateTime

  @column()
  declare serialNumber: string

  @column()
  declare condition: 'new' | 'good' | 'fair' | 'poor' | 'damaged' | 'obsolete'

  @column()
  declare isActive: boolean

  @column()
  declare isConsumable: boolean

  @column()
  declare averageUsagePerDay: number

  @column()
  declare averageUsagePerMonth: number

  @column()
  declare usageVariance: number

  @column.dateTime()
  declare lastInventoryDate: DateTime

  @column()
  declare lastInventoryCount: number

  @column()
  declare inventoryVariance: number

  @column()
  declare autoReorder: boolean

  @column()
  declare usageTracking: object

  @column()
  declare maintenanceSchedule: object

  @column.dateTime()
  declare lastMaintenanceDate: DateTime

  @column.dateTime()
  declare nextMaintenanceDate: DateTime

  @column()
  declare imageUrls: object

  @column()
  declare documentUrls: object

  @column()
  declare internalNotes: string

  @column()
  declare status: 'active' | 'inactive' | 'discontinued' | 'backordered' | 'out_of_stock'

  @column()
  declare createdBy: number

  @column()
  declare lastModifiedBy: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relationships
  @belongsTo(() => Hotel)
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => User, { foreignKey: 'createdBy' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'lastModifiedBy' })
  declare modifier: BelongsTo<typeof User>

  // Computed properties
  get isLowStock() {
    return this.currentStock <= this.reorderPoint
  }

  get isOutOfStock() {
    return this.currentStock <= 0
  }

  get isOverStock() {
    return this.currentStock > this.maximumStock
  }

  get stockLevel() {
    if (this.isOutOfStock) return 'out_of_stock'
    if (this.isLowStock) return 'low_stock'
    if (this.isOverStock) return 'over_stock'
    return 'normal'
  }

  get daysUntilExpiry() {
    if (!this.expiryDate) return null
    return Math.floor(this.expiryDate.diff(DateTime.now()).as('days'))
  }

  get isExpired() {
    return this.expiryDate && DateTime.now() > this.expiryDate
  }

  get isNearExpiry() {
    const days = this.daysUntilExpiry
    return days !== null && days <= 30 && days > 0
  }

  get daysOfStock() {
    if (this.averageUsagePerDay <= 0) return null
    return Math.floor(this.currentStock / this.averageUsagePerDay)
  }

  get needsReorder() {
    return this.autoReorder && this.isLowStock && this.status === 'active'
  }

  get stockTurnover() {
    if (!this.averageUsagePerMonth || this.currentStock <= 0) return 0
    return this.averageUsagePerMonth / this.currentStock
  }

  get stockValue() {
    return this.currentStock * this.unitCost
  }

  get displayName() {
    return `${this.itemName} (${this.itemCode})`
  }

  get stockStatusColor() {
    const colors = {
      'out_of_stock': 'red',
      'low_stock': 'orange',
      'normal': 'green',
      'over_stock': 'blue'
    }
    return colors[this.stockLevel] || 'gray'
  }

  get conditionColor() {
    const colors = {
      'new': 'green',
      'good': 'lightgreen',
      'fair': 'yellow',
      'poor': 'orange',
      'damaged': 'red',
      'obsolete': 'gray'
    }
    return colors[this.condition] || 'gray'
  }
}