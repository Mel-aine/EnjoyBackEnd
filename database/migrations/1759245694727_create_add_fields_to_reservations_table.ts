import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reservations'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
       table.string('bill_to').nullable().after('guest_id')
         table.string('payment_type').nullable().after('bill_to')


      table
        .integer('market_code_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('market_codes')
        .onDelete('SET NULL')
        .after('payment_type')

    })


  }

  async down() {

    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('bill_to')
      table.dropColumn('payment_type')
      table.dropColumn('market_code_id')
    })
  }
}
