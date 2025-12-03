import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'folio_transactions'

  public async up() {
    const hasTable = await this.schema.hasTable(this.tableName)
    if (!hasTable) return

    // Use Postgres IF NOT EXISTS to avoid duplicate column errors
    await this.schema.raw(
      `ALTER TABLE ${this.tableName}
       ADD COLUMN IF NOT EXISTS reservation_room_id integer NULL`
    )

    // Create index if not exists (safe even if column pre-exists)
    await this.schema.raw(
      `CREATE INDEX IF NOT EXISTS idx_${this.tableName}_reservation_room_id
       ON ${this.tableName}(reservation_room_id)`
    )

    // Foreign key creation can fail on duplicates and isn't critical to app logic.
    // If needed, add via a guarded DO block by explicit constraint name.
  }

  public async down() {
    const hasTable = await this.schema.hasTable(this.tableName)
    if (!hasTable) return

    // Drop index if exists
    await this.schema.raw(
      `DROP INDEX IF EXISTS idx_${this.tableName}_reservation_room_id`
    )

    // Drop column if exists
    await this.schema.raw(
      `ALTER TABLE ${this.tableName}
       DROP COLUMN IF EXISTS reservation_room_id`
    )
  }
}
