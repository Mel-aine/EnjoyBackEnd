import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddIsDefaultToCurrencies extends BaseSchema {
  protected tableName = 'currencies'

  public async up() {
    // Add column only if it doesn't exist
    await this.schema.raw(
      "ALTER TABLE currencies ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false"
    )

    // Enforce only one default per hotel using a partial unique index (Postgres)
    await this.schema.raw(
      'CREATE UNIQUE INDEX IF NOT EXISTS currencies_hotel_default_true_unique ON currencies (hotel_id) WHERE is_default = true'
    )
  }

  public async down() {
    await this.schema.raw('DROP INDEX IF EXISTS currencies_hotel_default_true_unique')

    // Drop column only if it exists
    await this.schema.raw('ALTER TABLE currencies DROP COLUMN IF EXISTS is_default')
  }
}