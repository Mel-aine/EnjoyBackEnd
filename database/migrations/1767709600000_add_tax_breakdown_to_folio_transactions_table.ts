import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'folio_transactions'

  async up() {
    // Use raw to ensure idempotent column creation
    await this.schema.raw(`ALTER TABLE ${this.tableName} ADD COLUMN IF NOT EXISTS tax_breakdown JSONB`)
  }

  async down() {
    await this.schema.raw(`ALTER TABLE ${this.tableName} DROP COLUMN IF EXISTS tax_breakdown`)
  }
}

