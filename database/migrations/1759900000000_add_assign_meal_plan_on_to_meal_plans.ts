import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'meal_plans'

  async up() {
    const hasTable = await this.schema.hasTable(this.tableName)
    if (hasTable) {
      await this.schema.raw(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = '${this.tableName}'
              AND column_name = 'assign_meal_plan_on'
              AND data_type = 'character varying'
              AND udt_name = 'varchar'
          ) THEN
            UPDATE ${this.tableName}
              SET assign_meal_plan_on = CASE assign_meal_plan_on
                WHEN 'Check In' THEN 'CheckIn'
                WHEN 'Stay Over' THEN 'StayOver'
                WHEN 'Check Out' THEN 'CheckOut'
                ELSE assign_meal_plan_on
              END;

            ALTER TABLE ${this.tableName}
              ALTER COLUMN assign_meal_plan_on TYPE varchar(50)[]
              USING ARRAY[assign_meal_plan_on];

            ALTER TABLE ${this.tableName}
              ALTER COLUMN assign_meal_plan_on SET DEFAULT ARRAY['StayOver'];
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = current_schema()
              AND table_name = '${this.tableName}'
              AND column_name = 'assign_meal_plan_on'
          ) THEN
            ALTER TABLE ${this.tableName}
              ADD COLUMN assign_meal_plan_on varchar(50)[] NOT NULL DEFAULT ARRAY['StayOver'];
          ELSE
            UPDATE ${this.tableName}
              SET assign_meal_plan_on =
                array_replace(
                  array_replace(
                    array_replace(assign_meal_plan_on, 'Check In', 'CheckIn'),
                    'Stay Over',
                    'StayOver'
                  ),
                  'Check Out',
                  'CheckOut'
                );
          END IF;

          ALTER TABLE ${this.tableName}
            DROP CONSTRAINT IF EXISTS meal_plans_assign_meal_plan_on_check;
          ALTER TABLE ${this.tableName}
            ADD CONSTRAINT meal_plans_assign_meal_plan_on_check
            CHECK (
              assign_meal_plan_on <@ ARRAY['CheckIn', 'StayOver', 'CheckOut']::varchar(50)[]
              AND COALESCE(array_length(assign_meal_plan_on, 1), 0) > 0
            );
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
              AND column_name = 'assign_meal_plan_on'
          ) THEN
            ALTER TABLE ${this.tableName}
              DROP CONSTRAINT IF EXISTS meal_plans_assign_meal_plan_on_check;
            ALTER TABLE ${this.tableName}
              DROP COLUMN assign_meal_plan_on;
          END IF;
        END $$;
      `)
    }
  }
}
