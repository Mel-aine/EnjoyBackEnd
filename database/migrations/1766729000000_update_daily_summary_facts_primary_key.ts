import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'daily_summary_facts'

  async up() {
    await this.db.rawQuery(`ALTER TABLE ${this.tableName} ADD COLUMN IF NOT EXISTS id BIGSERIAL`)
    await this.db.rawQuery(`UPDATE ${this.tableName} SET id = DEFAULT WHERE id IS NULL`)
    await this.db.rawQuery(`ALTER TABLE ${this.tableName} ALTER COLUMN id SET NOT NULL`)

    await this.db.rawQuery(`ALTER TABLE ${this.tableName} DROP CONSTRAINT IF EXISTS daily_summary_facts_pkey`)
    await this.db.rawQuery(`ALTER TABLE ${this.tableName} ADD CONSTRAINT daily_summary_facts_pkey PRIMARY KEY (id)`)

    await this.db.rawQuery(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'daily_summary_facts_audit_date_hotel_id_unique'
        ) THEN
          ALTER TABLE ${this.tableName}
          ADD CONSTRAINT daily_summary_facts_audit_date_hotel_id_unique
          UNIQUE (audit_date, hotel_id);
        END IF;
      END $$;
    `)
  }

  async down() {
    await this.db.rawQuery(`ALTER TABLE ${this.tableName} DROP CONSTRAINT IF EXISTS daily_summary_facts_audit_date_hotel_id_unique`)
    await this.db.rawQuery(`ALTER TABLE ${this.tableName} DROP CONSTRAINT IF EXISTS daily_summary_facts_pkey`)
    await this.db.rawQuery(`ALTER TABLE ${this.tableName} DROP COLUMN IF EXISTS id`)
    await this.db.rawQuery(`ALTER TABLE ${this.tableName} ADD CONSTRAINT daily_summary_facts_pkey PRIMARY KEY (audit_date)`)
  }
}

