import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'folios'

  async up() {
    // Drop the existing check constraint
    this.schema.raw('ALTER TABLE folios DROP CONSTRAINT IF EXISTS folios_status_check')
    
    // Add the new check constraint with 'voided' included
    this.schema.raw(`
      ALTER TABLE folios 
      ADD CONSTRAINT folios_status_check 
      CHECK (status IN ('open', 'closed', 'transferred', 'disputed', 'voided'))
    `)
  }

  async down() {
    // Drop the new constraint
    this.schema.raw('ALTER TABLE folios DROP CONSTRAINT IF EXISTS folios_status_check')
    
    // Restore the original constraint without 'voided'
    this.schema.raw(`
      ALTER TABLE folios 
      ADD CONSTRAINT folios_status_check 
      CHECK (status IN ('open', 'closed', 'transferred', 'disputed'))
    `)
  }
}