import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'credit_card_pre_authorizations'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table
        .integer('folio_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('folios')
        .onDelete('CASCADE')
      table.string('card_last_four_digits', 4).notNullable()
      table.string('card_expiry_date', 5).notNullable()
      table.decimal('authorized_amount', 10, 2).notNullable()
      table.dateTime('authorization_datetime').notNullable()
      table.dateTime('expiration_datetime').nullable()
      table.enum('status', [
        'Authorized',
        'Captured',
        'Voided',
        'Expired',
        'Failed',
        'Released',
      ]).notNullable()
      table.string('gateway_reference', 255).notNullable()
      table.string('transaction_response_code', 50).nullable()
      table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL').nullable()
      table.integer('last_modified_by').unsigned().references('id').inTable('users').onDelete('SET NULL').nullable()

      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
