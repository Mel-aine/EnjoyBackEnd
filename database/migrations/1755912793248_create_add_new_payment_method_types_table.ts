import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'payment_methods'

  async up() {
    this.db.rawQuery(`ALTER TYPE "method_type" ADD VALUE 'mobile_payment';`).exec()
  }

  async down() {
    // In PostgreSQL, removing an enum value is a complex and potentially risky operation.
    // It often requires creating a new enum with the desired values, updating all tables that use the enum, and then dropping the old enum.
    // A safer approach for this rollback is to do nothing, leaving the 'mobile_payment' value in the enum.
    // This is intentionally left blank to prevent accidental data loss or schema corruption.
  }
}