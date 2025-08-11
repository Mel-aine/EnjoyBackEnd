import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Hotel from '#models/hotel'
import Room from '#models/room'

export default class Task extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare title: string | null

  @column()
  declare description: string | null

  @column()
  declare task_type: string | null

  @column()
  declare assigned_to: number

  @column()
  declare created_by: number | null

  @column.dateTime()
  declare due_date: DateTime | null

  @column()
  declare estimated_hours: number | null

  @column()
  declare priority: 'low' | 'medium' | 'high'

  @column()
  declare status: 'pending' | 'in_progress' | 'todo' | 'cancelled' | 'done'

  @column()
  declare hotel_id: number | null

  @column()
  declare room_id: number | null

  @column()
  declare last_modified_by: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // 🔁 Relations

  @belongsTo(() => User, { foreignKey: 'assigned_to' })
  declare assignedUser: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'created_by' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'last_modified_by' })
  declare modifier: BelongsTo<typeof User>

  @belongsTo(() => Hotel, { foreignKey: 'hotel_id' })
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => Room, { foreignKey: 'room_id' })
  declare room: BelongsTo<typeof Room>


}
