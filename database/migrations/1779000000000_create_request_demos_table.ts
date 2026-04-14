import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'request_demos'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.string('contact_name').notNullable()
      table.string('company_name').notNullable()
      table.string('property_type').nullable()
      table.integer('number_of_rooms').nullable()
      table.string('phone_number').nullable()
      table.string('country').nullable()
      table.string('email').notNullable().index()
      table.string('preferred_language').nullable()
      table.string('lead_source').nullable()
      table.text('notes_message').nullable()
      table.string('competition').nullable()

      table.boolean('accept_condition').notNullable().defaultTo(false)
      table.boolean('email_send').notNullable().defaultTo(false)

      table
        .enum('status', [
          'New',
          'Qualified',
          'Demo Scheduled',
          'Demo Completed',
          'Trial',
          'Negotiation',
          'Converted',
          'Lost',
          'Junk',
        ])
        .notNullable()
        .defaultTo('New')
        .index()

      table.integer('owner_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL')
      table.integer('created_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL')
      table.timestamp('follow_up_date').nullable()
      table.string('city').nullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
