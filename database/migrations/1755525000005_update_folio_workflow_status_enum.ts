import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'folios'

  async up() {
    // Drop the existing check constraint
    this.schema.raw('ALTER TABLE folios DROP CONSTRAINT IF EXISTS folios_workflow_status_check')
    
    // Add the new check constraint with all WorkflowStatus enum values
    this.schema.raw(`
      ALTER TABLE folios 
      ADD CONSTRAINT folios_workflow_status_check 
      CHECK (workflow_status IN (
        'draft', 'active', 'review', 'approved', 'finalized', 'closed'
      ))
    `)
  }

  async down() {
    // Drop the new constraint
    this.schema.raw('ALTER TABLE folios DROP CONSTRAINT IF EXISTS folios_workflow_status_check')
    
    // Restore a basic constraint (assuming original had fewer values)
    this.schema.raw(`
      ALTER TABLE folios 
      ADD CONSTRAINT folios_workflow_status_check 
      CHECK (workflow_status IN ('draft', 'active', 'closed'))
    `)
  }
}