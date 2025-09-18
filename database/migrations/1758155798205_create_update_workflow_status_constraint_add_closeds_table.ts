import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'folios'

  async up() {
    // Drop the existing workflow_status check constraint
    this.schema.raw('ALTER TABLE folios DROP CONSTRAINT IF EXISTS folios_workflow_status_check')
    
    // Add the new check constraint with 'closed' included
    this.schema.raw(`
      ALTER TABLE folios 
      ADD CONSTRAINT folios_workflow_status_check 
      CHECK (workflow_status IN ('draft', 'active', 'review', 'approved', 'finalized', 'closed'))
    `)
  }

  async down() {
    // Drop the new constraint
    this.schema.raw('ALTER TABLE folios DROP CONSTRAINT IF EXISTS folios_workflow_status_check')
    
    // Restore the original constraint without 'closed'
    this.schema.raw(`
      ALTER TABLE folios 
      ADD CONSTRAINT folios_workflow_status_check 
      CHECK (workflow_status IN ('draft', 'active', 'review', 'approved', 'finalized'))
    `)
  }
}