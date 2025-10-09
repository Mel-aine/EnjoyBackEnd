import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'extra_charges'

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
              AND column_name = 'is_meal_plan_component'
          ) THEN
            ALTER TABLE ${this.tableName} 
              ADD COLUMN is_meal_plan_component boolean NOT NULL DEFAULT false;
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
              AND column_name = 'is_meal_plan_component'
          ) THEN
            ALTER TABLE ${this.tableName} 
              DROP COLUMN is_meal_plan_component;
          END IF;
        END $$;
      `)
    }
  }
}