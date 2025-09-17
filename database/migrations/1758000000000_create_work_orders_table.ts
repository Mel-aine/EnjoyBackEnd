import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'work_orders'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      
      // Auto-generated order number
      table.string('order_number', 50).notNullable().unique()
      
      // Block dates for the room
      table.date('block_from_date').nullable()
      table.date('block_to_date').nullable()
      
      // Room relationship
      table
        .integer('room_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('rooms')
        .onDelete('CASCADE')
      
      // Due date and time for completion
      table.timestamp('due_date_time', { useTz: true }).notNullable()
      
      // Work order details
      table.text('description').notNullable()
      
      // Category enum
      table.enum('category', ['clean', 'repair', 'maintenance', 'others']).notNullable()
      
      // Priority enum
      table.enum('priority', ['low', 'medium', 'high']).notNullable().defaultTo('medium')
      
      // Status enum
      table.enum('status', ['assigned', 'completed', 'in_progress']).notNullable().defaultTo('assigned')
      
      // Assigned user relationship
      table
        .integer('assigned_to_user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      
      // Room status enum
      table.enum('room_status', ['dirty', 'clean']).notNullable().defaultTo('dirty')
      
      // Reason for the work order
      table.string('reason', 255).nullable()
      
      // Hotel relationship
      table
        .integer('hotel_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('hotels')
        .onDelete('CASCADE')
      
      // Notes field for tracking actions
      table.text('notes').nullable()
      
      // Audit fields
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      
      // Indexes for performance
      table.index(['hotel_id'])
      table.index(['room_id'])
      table.index(['assigned_to_user_id'])
      table.index(['status'])
      table.index(['category'])
      table.index(['priority'])
      table.index(['due_date_time'])
      table.index(['created_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}