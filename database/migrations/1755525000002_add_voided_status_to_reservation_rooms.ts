import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reservation_rooms'

  async up() {
    // Drop the existing check constraint
    this.schema.raw(`
      ALTER TABLE reservation_rooms 
      DROP CONSTRAINT IF EXISTS reservation_rooms_status_check
    `)
    
    // Add the new check constraint with 'voided' and 'blocked' included
    this.schema.raw(`
      ALTER TABLE reservation_rooms 
      ADD CONSTRAINT reservation_rooms_status_check 
      CHECK (status IN ('reserved', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show', 'moved', 'voided', 'blocked'))
    `)
  }

  async down() {
    // Drop the new check constraint
    this.schema.raw(`
      ALTER TABLE reservation_rooms 
      DROP CONSTRAINT IF EXISTS reservation_rooms_status_check
    `)
    
    // Restore the original check constraint without 'voided' and 'blocked'
    this.schema.raw(`
      ALTER TABLE reservation_rooms 
      ADD CONSTRAINT reservation_rooms_status_check 
      CHECK (status IN ('reserved', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show', 'moved'))
    `)
  }
}