import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'meal_plans'

  async up() {
    const hasTable = await this.schema.hasTable(this.tableName)
    if (!hasTable) return

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

          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = '${this.tableName}'
              AND column_name = 'assign_meal_plan_on'
              AND data_type = 'ARRAY'
          ) THEN
            ALTER TABLE ${this.tableName}
              ALTER COLUMN assign_meal_plan_on TYPE varchar(255)
              USING array_to_string(assign_meal_plan_on, ',');
          END IF;

          UPDATE ${this.tableName}
            SET assign_meal_plan_on = replace(
              replace(
                replace(assign_meal_plan_on, 'Check In', 'CheckIn'),
                'Stay Over',
                'StayOver'
              ),
              'Check Out',
              'CheckOut'
            );

          ALTER TABLE ${this.tableName}
            ALTER COLUMN assign_meal_plan_on SET DEFAULT 'StayOver';

          UPDATE ${this.tableName}
            SET assign_meal_plan_on = 'StayOver'
            WHERE assign_meal_plan_on IS NULL OR trim(assign_meal_plan_on) = '';

          ALTER TABLE ${this.tableName}
            ALTER COLUMN assign_meal_plan_on SET NOT NULL;

          ALTER TABLE ${this.tableName}
            ADD CONSTRAINT meal_plans_assign_meal_plan_on_check
            CHECK (
              assign_meal_plan_on ~ '^(CheckIn|StayOver|CheckOut)(,(CheckIn|StayOver|CheckOut))*$'
            );
        END IF;
      END $$;
    `)
  }

  async down() {
    const hasTable = await this.schema.hasTable(this.tableName)
    if (!hasTable) return

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

          UPDATE ${this.tableName}
            SET assign_meal_plan_on = replace(
              replace(
                replace(assign_meal_plan_on, 'Check In', 'CheckIn'),
                'Stay Over',
                'StayOver'
              ),
              'Check Out',
              'CheckOut'
            );

          ALTER TABLE ${this.tableName}
            ALTER COLUMN assign_meal_plan_on TYPE varchar(50)[]
            USING string_to_array(assign_meal_plan_on, ',');

          ALTER TABLE ${this.tableName}
            ALTER COLUMN assign_meal_plan_on SET DEFAULT ARRAY['StayOver'];

          UPDATE ${this.tableName}
            SET assign_meal_plan_on = ARRAY['StayOver']
            WHERE assign_meal_plan_on IS NULL OR COALESCE(array_length(assign_meal_plan_on, 1), 0) = 0;

          ALTER TABLE ${this.tableName}
            ALTER COLUMN assign_meal_plan_on SET NOT NULL;

          ALTER TABLE ${this.tableName}
            ADD CONSTRAINT meal_plans_assign_meal_plan_on_check
            CHECK (
              assign_meal_plan_on <@ ARRAY['CheckIn', 'StayOver', 'CheckOut']::varchar(50)[]
              AND COALESCE(array_length(assign_meal_plan_on, 1), 0) > 0
            );
        END IF;
      END $$;
    `)
  }
}

