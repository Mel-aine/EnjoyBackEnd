import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
    protected tableName = 'amenity_products'

    async up() {
    // Check if table exists first
    const hasTable = await this.schema.hasTable(this.tableName)
    
    if (!hasTable) {
      this.schema.createTable(this.tableName, (table) => {
            table.increments('id')
            table.string('name').notNullable()
            table.decimal('price', 12, 2).notNullable().defaultTo(0)
            table.text('description').nullable()
            table.enum('status', ['active', 'inactive', 'archived']).defaultTo('active').notNullable()

            table.integer('amenities_category_id').unsigned().references('id').inTable('amenities_categories').onDelete('CASCADE')
            table.integer('hotel_id').unsigned().references('id').inTable('hotels').onDelete('CASCADE')
            table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL').nullable()
            table.integer('last_modified_by').unsigned().references('id').inTable('users').onDelete('SET NULL').nullable()
            table.enum('pricing_model', ['flat_rate', 'time_based']).defaultTo('flat_rate').notNullable()

            // Pour l'unité de temps, applicable seulement si pricing_model est 'time_based'
            table.enum('time_unit', ['hour', 'day']).nullable()

            table.timestamp('created_at', { useTz: true })
            table.timestamp('updated_at', { useTz: true })
        })
    }
    }

    async down() {
        this.schema.dropTable(this.tableName)
    }
}
