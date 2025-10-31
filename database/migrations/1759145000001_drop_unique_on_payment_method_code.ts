import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'payment_methods'

  async up() {
    // Drop unique constraint/index on method_code to allow duplicates
    // For Postgres, drop the constraint first, then the index if still present
    await this.db.rawQuery('ALTER TABLE payment_methods DROP CONSTRAINT IF EXISTS payment_methods_method_code_unique')
    await this.db.rawQuery('DROP INDEX IF EXISTS payment_methods_method_code_unique')
  }

  async down() {
    // Restore global unique constraint on method_code if rolled back
    this.schema.alterTable(this.tableName, (table) => {
      table.unique(['method_code'])
    })
  }
}