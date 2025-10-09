import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'meal_plan_components'

  async up() {
    const hasTable = await this.schema.hasTable(this.tableName)
    if (!hasTable) {
      this.schema.createTable(this.tableName, (table) => {
        table.increments('id')
        table.integer('hotel_id').unsigned().references('id').inTable('hotels').onDelete('CASCADE')
        table.integer('meal_plan_id').unsigned().references('id').inTable('meal_plans').onDelete('CASCADE')
        table.integer('extra_charge_id').unsigned().references('id').inTable('extra_charges').onDelete('CASCADE')
        table.integer('quantity_per_day').notNullable().defaultTo(1)
        table.string('target_guest_type', 50).notNullable()

        // Audit
        table.integer('created_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL')
        table.integer('last_modified_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL')

        table.timestamp('created_at')
        table.timestamp('updated_at')

        table.index(['hotel_id'])
        table.index(['meal_plan_id'])
        table.index(['extra_charge_id'])
        table.index(['target_guest_type'])
      })
    }
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}