import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reservation_rooms'

  async up() {
    const hasTable = await this.schema.hasTable(this.tableName)
    if (hasTable) {
      await this.schema.raw(`
        DO $$
        BEGIN
          -- is_complementary
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = current_schema()
              AND table_name = '${this.tableName}'
              AND column_name = 'is_complementary'
          ) THEN
            ALTER TABLE ${this.tableName}
              ADD COLUMN is_complementary boolean NULL;
          END IF;

          -- tax_includes
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = current_schema()
              AND table_name = '${this.tableName}'
              AND column_name = 'tax_includes'
          ) THEN
            ALTER TABLE ${this.tableName}
              ADD COLUMN tax_includes boolean NULL;
          END IF;

          -- meal_plan_rate_include
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = current_schema()
              AND table_name = '${this.tableName}'
              AND column_name = 'meal_plan_rate_include'
          ) THEN
            ALTER TABLE ${this.tableName}
              ADD COLUMN meal_plan_rate_include boolean NULL;
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
              AND column_name = 'is_complementary'
          ) THEN
            ALTER TABLE ${this.tableName}
              DROP COLUMN is_complementary;
          END IF;

          IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = current_schema()
              AND table_name = '${this.tableName}'
              AND column_name = 'tax_includes'
          ) THEN
            ALTER TABLE ${this.tableName}
              DROP COLUMN tax_includes;
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