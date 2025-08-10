import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Hotel from './hotel.js'
import Room from './room.js'
import User from './user.js'

export default class MaintenanceRequest extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotelId: number

  @column()
  declare roomId: number

  @column()
  declare requestNumber: string

  @column()
  declare title: string

  @column()
  declare description: string

  @column()
  declare category: 'electrical' | 'plumbing' | 'hvac' | 'furniture' | 'appliances' | 'structural' | 'safety' | 'technology' | 'other'

  @column()
  declare subcategory: string

  @column()
  declare priority: 'low' | 'normal' | 'high' | 'urgent' | 'emergency'

  @column()
  declare status: 'open' | 'assigned' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled' | 'closed'

  @column()
  declare urgency: 'low' | 'medium' | 'high' | 'critical'

  @column()
  declare impact: 'low' | 'medium' | 'high' | 'critical'

  @column()
  declare reportedBy: number

  @column.dateTime()
  declare reportedAt: DateTime

  @column()
  declare assignedTo: number

  @column.dateTime()
  declare assignedAt: DateTime

  @column.dateTime()
  declare scheduledDate: DateTime

  @column.dateTime()
  declare startedAt: DateTime

  @column.dateTime()
  declare completedAt: DateTime

  @column.dateTime()
  declare dueDate: DateTime

  @column()
  declare estimatedDuration: number

  @column()
  declare actualDuration: number

  @column()
  declare estimatedCost: number

  @column()
  declare actualCost: number

  @column()
  declare workOrderNumber: string

  @column()
  declare vendorRequired: boolean

  @column()
  declare vendorName: string

  @column()
  declare vendorContact: object

  @column()
  declare partsRequired: object

  @column()
  declare partsOrdered: object

  @column()
  declare partsReceived: object

  @column()
  declare toolsRequired: object

  @column()
  declare skillsRequired: object

  @column()
  declare safetyRequirements: object

  @column()
  declare permitRequired: boolean

  @column()
  declare permitNumber: string

  @column()
  declare inspectionRequired: boolean

  @column()
  declare inspectionPassed: boolean

  @column()
  declare workPerformed: string

  @column()
  declare resolutionNotes: string

  @column()
  declare preventiveMeasures: string

  @column()
  declare followUpRequired: boolean

  @column.dateTime()
  declare followUpDate: DateTime

  @column()
  declare guestImpact: boolean

  @column()
  declare roomOutOfOrder: boolean

  @column.dateTime()
  declare outOfOrderFrom: DateTime

  @column.dateTime()
  declare outOfOrderTo: DateTime

  @column()
  declare revenueImpact: number

  @column()
  declare guestCompensation: number

  @column()
  declare insuranceClaim: boolean

  @column()
  declare claimNumber: string

  @column()
  declare warrantyWork: boolean

  @column()
  declare warrantyProvider: string

  @column()
  declare recurringIssue: boolean

  @column()
  declare previousRequests: object

  @column()
  declare rootCauseAnalysis: string

  @column()
  declare qualityRating: number

  @column()
  declare customerSatisfaction: number

  @column()
  declare photos: object

  @column()
  declare documents: object

  @column()
  declare beforePhotos: object

  @column()
  declare afterPhotos: object

  @column()
  declare videoDocumentation: object

  @column()
  declare communicationLog: object

  @column()
  declare escalationHistory: object

  @column()
  declare approvalRequired: boolean

  @column()
  declare approvedBy: number

  @column.dateTime()
  declare approvedAt: DateTime

  @column()
  declare budgetCode: string

  @column()
  declare costCenter: string

  @column()
  declare assetTag: string

  @column()
  declare serialNumber: string

  @column()
  declare modelNumber: string

  @column()
  declare manufacturer: string

  @column()
  declare installationDate: DateTime

  @column()
  declare lastMaintenanceDate: DateTime

  @column()
  declare nextMaintenanceDate: DateTime

  @column()
  declare maintenanceHistory: object

  @column()
  declare notes: string

  @column()
  declare internalNotes: string

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
  get isOverdue() {
    return this.dueDate && DateTime.now() > this.dueDate && !this.isCompleted
  }

  get isCompleted() {
    return ['completed', 'closed'].includes(this.status)
  }

  get isInProgress() {
    return ['assigned', 'in_progress'].includes(this.status)
  }

  get daysOpen() {
    const endDate = this.completedAt || DateTime.now()
    return Math.floor(endDate.diff(this.reportedAt).as('days'))
  }

  get timeToComplete() {
    if (!this.completedAt) return null
    return this.completedAt.diff(this.reportedAt).as('hours')
  }

  get isEmergency() {
    return this.priority === 'emergency'
  }

  get isHighPriority() {
    return ['high', 'urgent', 'emergency'].includes(this.priority)
  }

  get costVariance() {
    if (!this.estimatedCost || !this.actualCost) return null
    return ((this.actualCost - this.estimatedCost) / this.estimatedCost) * 100
  }

  get timeVariance() {
    if (!this.estimatedDuration || !this.actualDuration) return null
    return ((this.actualDuration - this.estimatedDuration) / this.estimatedDuration) * 100
  }

  get priorityColor() {
    const colors = {
      'low': 'green',
      'normal': 'blue',
      'high': 'orange',
      'urgent': 'red',
      'emergency': 'darkred'
    }
    return colors[this.priority] || 'gray'
  }

  get statusColor() {
    const colors = {
      'open': 'red',
      'assigned': 'orange',
      'in_progress': 'blue',
      'on_hold': 'yellow',
      'completed': 'green',
      'cancelled': 'gray',
      'closed': 'darkgreen'
    }
    return colors[this.status] || 'gray'
  }
}