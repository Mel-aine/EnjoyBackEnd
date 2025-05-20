import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'services'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('name', 255).notNullable()
      table.text('description').nullable()
      table.integer('category_id').unsigned().references('id').inTable('categories').onDelete('CASCADE')
      table.string('address_service', 255).nullable()
      table.string('phone_number_service', 20).nullable()
      table.string('email_service', 255).nullable()
      table.string('website', 255).nullable()
      table.json('openings').nullable()
      table.enu('price_range', ['$', '$$', '$$$', '$$$$']).defaultTo('$$')
      table.json('facilities').nullable()
      table.text('policies').nullable()
      table.integer('capacity').nullable()
      table.json('payment_methods').nullable()
      table.decimal('average_rating', 3, 2).defaultTo(0.0).nullable()
      table.integer('review_count').defaultTo(0).nullable()

      table.string('logo', 255).nullable()

      table
        .enu('status_service', ['active', 'inactive', 'suspended']).defaultTo('active')
      table.json('images').nullable()
      table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL').nullable()
      table.integer('last_modified_by').unsigned().references('id').inTable('users').onDelete('SET NULL').nullable()
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
