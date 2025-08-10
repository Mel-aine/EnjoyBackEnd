import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Hotel from './hotel.js'
import Room from './room.js'
import User from './user.js'

export default class CleaningStatus extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotelId: number

  @column()
  declare roomId: number

  @column()
  declare status: 'clean' | 'dirty' | 'inspected' | 'out_of_order' | 'maintenance' | 'deep_clean'

  @column()
  declare previousStatus: string

  @column.dateTime()
  declare statusChangedAt: DateTime

  @column()
  declare assignedTo: number

  @column.dateTime()
  declare assignedAt: DateTime

  @column.dateTime()
  declare startedAt: DateTime

  @column.dateTime()
  declare completedAt: DateTime

  @column()
  declare estimatedDuration: number

  @column()
  declare actualDuration: number

  @column()
  declare cleaningType: 'checkout' | 'maintenance' | 'deep_clean' | 'inspection' | 'touch_up'

  @column()
  declare priority: 'low' | 'normal' | 'high' | 'urgent'

  @column()
  declare guestCheckout: DateTime

  @column()
  declare nextGuestCheckin: DateTime

  @column()
  declare specialInstructions: string

  @column()
  declare cleaningNotes: string

  @column()
  declare issuesFound: object

  @column()
  declare suppliesUsed: object

  @column()
  declare equipmentUsed: object

  @column()
  declare qualityScore: number

  @column()
  declare inspectedBy: number

  @column.dateTime()
  declare inspectedAt: DateTime

  @column()
  declare inspectionNotes: string

  @column()
  declare inspectionPassed: boolean

  @column()
  declare reinspectionRequired: boolean

  @column()
  declare maintenanceRequired: boolean

  @column()
  declare maintenanceIssues: object

  @column()
  declare inventoryIssues: object

  @column()
  declare guestComplaints: object

  @column()
  declare photosBeforeCleaning: object

  @column()
  declare photosAfterCleaning: object

  @column()
  declare checklist: object

  @column()
  declare checklistCompleted: boolean

  @column()
  declare environmentalFactors: object

  @column()
  declare weatherConditions: string

  @column()
  declare seasonalRequirements: object

  @column()
  declare costCenter: string

  @column()
  declare laborCost: number

  @column()
  declare supplyCost: number

  @column()
  declare totalCost: number

  @column()
  declare efficiency: number

  @column()
  declare productivityScore: number

  @column()
  declare guestSatisfactionImpact: number

  @column()
  declare revenueImpact: number

  @column()
  declare isActive: boolean

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

  @belongsTo(() => Room)
  declare room: BelongsTo<typeof Room>

  @belongsTo(() => User, { foreignKey: 'createdBy' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'lastModifiedBy' })
  declare modifier: BelongsTo<typeof User>

  // Computed properties
  get isCompleted() {
    return this.status === 'clean' || this.status === 'inspected'
  }

  get isInProgress() {
    return this.startedAt && !this.completedAt
  }

  get isOverdue() {
    if (!this.nextGuestCheckin || this.isCompleted) return false
    return DateTime.now() > this.nextGuestCheckin
  }

  get timeRemaining() {
    if (!this.nextGuestCheckin || this.isCompleted) return null
    const remaining = this.nextGuestCheckin.diff(DateTime.now())
    return remaining.as('minutes')
  }

  get durationMinutes() {
    if (!this.startedAt || !this.completedAt) return null
    return this.completedAt.diff(this.startedAt).as('minutes')
  }

  get isEfficient() {
    return this.actualDuration <= this.estimatedDuration
  }

  get statusColor() {
    const colors = {
      'clean': 'green',
      'dirty': 'red',
      'inspected': 'blue',
      'out_of_order': 'orange',
      'maintenance': 'yellow',
      'deep_clean': 'purple'
    }
    return colors[this.status] || 'gray'
  }
}