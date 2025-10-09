import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reservation_rooms'

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
              AND column_name = 'meal_plan_id'
          ) THEN
            ALTER TABLE ${this.tableName}
              ADD COLUMN meal_plan_id integer NULL;
            ALTER TABLE ${this.tableName}
              ADD CONSTRAINT reservation_rooms_meal_plan_fk
                FOREIGN KEY (meal_plan_id)
                REFERENCES meal_plans (id)
                ON DELETE SET NULL;
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
              AND column_name = 'meal_plan_id'
          ) THEN
            ALTER TABLE ${this.tableName}
              DROP CONSTRAINT IF EXISTS reservation_rooms_meal_plan_fk;
            ALTER TABLE ${this.tableName}
              DROP COLUMN meal_plan_id;
          END IF;
        END $$;
      `)
    }
  }
}