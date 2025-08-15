import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'folios'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Drop the check constraint for folio_type
      // The constraint name might be auto-generated, so we'll try common patterns
      this.schema.raw('ALTER TABLE folios DROP CONSTRAINT IF EXISTS folios_folio_type_check')
      this.schema.raw('ALTER TABLE folios DROP CONSTRAINT IF EXISTS folios_folio_type_chk')
      this.schema.raw('ALTER TABLE folios DROP CONSTRAINT IF EXISTS chk_folios_folio_type')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Recreate the check constraint if needed
      this.schema.raw("ALTER TABLE folios ADD CONSTRAINT folios_folio_type_check CHECK (folio_type IN ('master', 'split', 'group', 'individual'))")
    })
  }
}