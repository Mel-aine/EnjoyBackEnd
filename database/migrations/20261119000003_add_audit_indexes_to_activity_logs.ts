import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'activity_logs'

  async up() {
    await this.schema.raw(`
      CREATE INDEX IF NOT EXISTS activity_logs_reservation_time_idx
        ON public.${this.tableName} (hotel_id, reservation_id, created_at);
      CREATE INDEX IF NOT EXISTS activity_logs_operation_idx
        ON public.${this.tableName} ((meta->>'operationId'));
      CREATE INDEX IF NOT EXISTS activity_logs_parent_snapshot_idx
        ON public.${this.tableName} ((meta->>'table'), (meta->>'entityKey'), id DESC);
    `)
  }

  async down() {
    await this.schema.raw(`
      DROP INDEX IF EXISTS public.activity_logs_reservation_time_idx;
      DROP INDEX IF EXISTS public.activity_logs_operation_idx;
      DROP INDEX IF EXISTS public.activity_logs_parent_snapshot_idx;
    `)
  }
}
