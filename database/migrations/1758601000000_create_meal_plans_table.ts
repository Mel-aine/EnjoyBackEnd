import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'meal_plans'

  async up() {
    const hasTable = await this.schema.hasTable(this.tableName)
    if (!hasTable) {
      this.schema.createTable(this.tableName, (table) => {
        table.increments('id')
        table.integer('hotel_id').unsigned().references('id').inTable('hotels').onDelete('CASCADE')
        table.string('name', 255).notNullable()
        table.string('short_code', 50).notNullable()
        table.text('description').nullable()
        table.string('status', 50).notNullable().defaultTo('Active')
        table.boolean('is_all_inclusive').notNullable().defaultTo(false)

        // Audit
        table.integer('created_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL')
        table.integer('last_modified_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL')

        table.timestamp('created_at')
        table.timestamp('updated_at')

        table.index(['hotel_id'])
        table.index(['short_code'])
        table.index(['status'])
      })
    }
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}