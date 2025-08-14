import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'room_rates'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Make rate_date nullable
      table.date('rate_date').nullable().alter()
      
      // Make season_id nullable
      table.integer('season_id').unsigned().nullable().alter()
      
      // Make source_id nullable
      table.integer('source_id').unsigned().nullable().alter()
      
      // Make effective_from nullable
      table.date('effective_from').nullable().alter()
      
      // Make effective_to nullable
      table.date('effective_to').nullable().alter()
      
      // Make extra_adult_rate nullable
      table.decimal('extra_adult_rate', 10, 2).nullable().alter()
      
      // Make extra_child_rate nullable
      table.decimal('extra_child_rate', 10, 2).nullable().alter()
      
      // Make status nullable
      table.string('status').nullable().alter()
      
      // Make created_by nullable
      table.integer('created_by').unsigned().nullable().alter()
      
      // Make last_modified_by nullable
      table.integer('last_modified_by').unsigned().nullable().alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Revert rate_date to not nullable
      table.date('rate_date').notNullable().alter()
      
      // Revert season_id to not nullable
      table.integer('season_id').unsigned().notNullable().alter()
      
      // Revert source_id to not nullable
      table.integer('source_id').unsigned().notNullable().alter()
      
      // Revert effective_from to not nullable
      table.date('effective_from').notNullable().alter()
      
      // Revert effective_to to not nullable
      table.date('effective_to').notNullable().alter()
      
      // Revert extra_adult_rate to not nullable
      table.decimal('extra_adult_rate', 10, 2).notNullable().alter()
      
      // Revert extra_child_rate to not nullable
      table.decimal('extra_child_rate', 10, 2).notNullable().alter()
      
      // Revert status to not nullable
      table.string('status').notNullable().alter()
      
      // Revert created_by to not nullable
      table.integer('created_by').unsigned().notNullable().alter()
      
      // Revert last_modified_by to not nullable
      table.integer('last_modified_by').unsigned().notNullable().alter()
    })
  }
}