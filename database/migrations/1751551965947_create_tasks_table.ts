import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'tasks'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('title').nullable()
      table.text('description').nullable()
      table.text('task_type').nullable()
      table.integer('assigned_to').unsigned().references('id').inTable('users').onDelete('CASCADE')
      table.integer('created_by').unsigned().references('id').inTable('users').onDelete('CASCADE')
      table.datetime('due_date').nullable()
      table.float('estimated_hours').nullable()
      table.enum('priority', ['low', 'medium', 'high']).defaultTo('medium')
      table.enum('status', ['pending', 'in_progress', 'completed', 'cancelled','done', 'todo']).defaultTo('todo')
      table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL').nullable()
      table.integer('service_id').unsigned().references('id').inTable('services').onDelete('SET NULL').nullable()
      table.integer('service_product_id').unsigned().references('id').inTable('service_products').onDelete('CASCADE').nullable()
      table.integer('last_modified_by').unsigned().references('id').inTable('users').onDelete('SET NULL').nullable()
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
