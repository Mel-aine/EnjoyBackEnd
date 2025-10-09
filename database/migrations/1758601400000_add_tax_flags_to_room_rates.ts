import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'room_rates'

  async up() {
    const hasTable = await this.schema.hasTable(this.tableName)
    if (hasTable) {
      await this.schema.raw(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = current_schema()
              AND table_name = '${this.tableName}'
              AND column_name = 'tax_include'
          ) THEN
            ALTER TABLE ${this.tableName}
              ADD COLUMN tax_include boolean NOT NULL DEFAULT false;
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = current_schema()
              AND table_name = '${this.tableName}'
              AND column_name = 'meal_plan_rate_include'
          ) THEN
            ALTER TABLE ${this.tableName}
              ADD COLUMN meal_plan_rate_include boolean NOT NULL DEFAULT false;
          END IF;
        END $$;
      `)
    }
  }

  async down() {
    const hasTable = await this.schema.hasTable(this.tableName)
    if (hasTable) {
      await this.schema.raw(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = current_schema()
              AND table_name = '${this.tableName}'
              AND column_name = 'tax_include'
          ) THEN
            ALTER TABLE ${this.tableName}
              DROP COLUMN tax_include;
          END IF;

          IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = current_schema()
              AND table_name = '${this.tableName}'
              AND column_name = 'meal_plan_rate_include'
          ) THEN
            ALTER TABLE ${this.tableName}
              DROP COLUMN meal_plan_rate_include;
          END IF;
        END $$;
      `)
    }
  }
}