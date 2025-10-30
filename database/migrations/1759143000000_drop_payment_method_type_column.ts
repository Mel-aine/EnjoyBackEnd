import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'payment_methods'

  async up() {
    // Drop potential check constraints linked to the 'type' column (names may vary)
    this.schema.raw('ALTER TABLE payment_methods DROP CONSTRAINT IF EXISTS payment_methods_type_check')
    this.schema.raw('ALTER TABLE payment_methods DROP CONSTRAINT IF EXISTS payment_methods_type_chk')
    this.schema.raw('ALTER TABLE payment_methods DROP CONSTRAINT IF EXISTS chk_payment_methods_type')

    // Drop the 'type' column
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('type')
    })
  }

  async down() {
    // Re-add the 'type' column if rolling back
    this.schema.alterTable(this.tableName, (table) => {
      table.enum('type', ['CASH', 'BANK']).notNullable().defaultTo('BANK')
    })
  }
}