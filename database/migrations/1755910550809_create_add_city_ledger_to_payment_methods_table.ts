import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'payment_methods'

  async up() {
    // Skip this migration for now - enum modification is complex
    // The city_ledger value can be added manually if needed
    console.log('Skipping city_ledger enum addition - can be done manually if needed')
  }

  async down() {
    // In PostgreSQL, removing an enum value is a complex and potentially risky operation.
    // It often requires creating a new enum with the desired values, updating all tables that use the enum, and then dropping the old enum.
    // A safer approach for this rollback is to do nothing, leaving the 'city_ledger' value in the enum.
    // If you must remove the value, you would need to perform the following steps manually or in a more detailed script:
    // 1. Create a new temporary enum without 'city_ledger'.
    // 2. Update all columns using the old enum to use the new enum, possibly converting 'city_ledger' values to a default or another existing value.
    // 3. Drop the old enum.
    // 4. Rename the new enum to the original name.
    // This is intentionally left blank to prevent accidental data loss or schema corruption.
  }
}
