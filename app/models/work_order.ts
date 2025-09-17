import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Room from './room.js'
import User from './user.js'
import Hotel from './hotel.js'

export default class WorkOrder extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare orderNumber: string

  @column.date()
  declare blockFromDate: DateTime

  @column.date()
  declare blockToDate: DateTime

  @column()
  declare roomId: number

  @column.dateTime()
  declare dueDateTime: DateTime

  @column()
  declare description: string

  @column()
  declare category: 'clean' | 'repair' | 'maintenance' | 'others'

  @column()
  declare priority: 'low' | 'medium' | 'high'

  @column()
  declare status: 'assigned' | 'completed' | 'in_progress'

  @column()
  declare assignedToUserId: number

  @column()
  declare roomStatus: 'dirty' | 'clean'

  @column()
  declare reason: string

  @column()
  declare hotelId: number

  @column()
  declare notes: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relationships
  @belongsTo(() => Room, {
    foreignKey: 'roomId',
  })
  declare room: BelongsTo<typeof Room>

  @belongsTo(() => User, {
    foreignKey: 'assignedToUserId',
  })
  declare assignedToUser: BelongsTo<typeof User>

  @belongsTo(() => Hotel, {
    foreignKey: 'hotelId',
  })
  declare hotel: BelongsTo<typeof Hotel>

  // Helper methods
  public static generateOrderNumber(): string {
    const timestamp = Date.now().toString()
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    return `WO${timestamp.slice(-6)}${random}`
  }

  public addNote(userId: number, action: string): void {
    const timestamp = DateTime.now().toFormat('yyyy-MM-dd HH:mm:ss')
    const newNote = `${timestamp} - User ${userId}: ${action}`
    
    if (this.notes) {
      this.notes += `\n${newNote}`
    } else {
      this.notes = newNote
    }
  }

  public updateStatus(newStatus: 'assigned' | 'completed' | 'in_progress', userId: number): void {
    const oldStatus = this.status
    this.status = newStatus
    this.addNote(userId, `Status changed from ${oldStatus} to ${newStatus}`)
  }

  public assignTo(userId: number, assignedByUserId: number): void {
    this.assignedToUserId = userId
    this.addNote(assignedByUserId, `Work order assigned to user ${userId}`)
  }
}