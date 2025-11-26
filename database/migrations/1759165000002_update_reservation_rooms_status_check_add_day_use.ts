import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reservation_rooms'

  public async up() {
    // Ensure status enum includes 'day_use'
    await this.schema.raw(`
      ALTER TABLE ${this.tableName}
      DROP CONSTRAINT IF EXISTS reservation_rooms_status_check;
    `)

    await this.schema.raw(`
      ALTER TABLE ${this.tableName}
      ADD CONSTRAINT reservation_rooms_status_check
      CHECK (status IN (
        'reserved', 'confirmed', 'checked_in', 'checked_out',
        'cancelled', 'no_show', 'moved', 'voided', 'blocked', 'day_use'
      ));
    `)
  }

  public async down() {
    // Revert to constraint without 'day_use' (matches prior migration)
    await this.schema.raw(`
      ALTER TABLE ${this.tableName}
      DROP CONSTRAINT IF EXISTS reservation_rooms_status_check;
    `)

    await this.schema.raw(`
      ALTER TABLE ${this.tableName}
      ADD CONSTRAINT reservation_rooms_status_check
      CHECK (status IN (
        'reserved', 'confirmed', 'checked_in', 'checked_out',
        'cancelled', 'no_show', 'moved', 'voided', 'blocked'
      ));
    `)
  }
}

