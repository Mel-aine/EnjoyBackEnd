import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'activity_logs'

  async up() {
    // Historical identifiers must survive deletion of their original records.
    await this.schema.raw(`
      DO $$ DECLARE c record; BEGIN
        FOR c IN SELECT conname FROM pg_constraint
          WHERE conrelid = 'public.activity_logs'::regclass AND contype = 'f'
        LOOP
          EXECUTE format('ALTER TABLE public.activity_logs DROP CONSTRAINT %I', c.conname);
        END LOOP;
      END $$;
    `)
  }

  async down() {
    await this.schema.raw(`
      ALTER TABLE public.activity_logs DROP CONSTRAINT IF EXISTS activity_logs_user_id_foreign;
      ALTER TABLE public.activity_logs ADD CONSTRAINT activity_logs_user_id_foreign
        FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL NOT VALID;

      ALTER TABLE public.activity_logs DROP CONSTRAINT IF EXISTS activity_logs_created_by_foreign;
      ALTER TABLE public.activity_logs ADD CONSTRAINT activity_logs_created_by_foreign
        FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL NOT VALID;

      ALTER TABLE public.activity_logs DROP CONSTRAINT IF EXISTS activity_logs_reservation_id_foreign;
      ALTER TABLE public.activity_logs ADD CONSTRAINT activity_logs_reservation_id_foreign
        FOREIGN KEY (reservation_id) REFERENCES public.reservations(id) ON DELETE CASCADE NOT VALID;
    `)
  }
}
