import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    await this.schema.raw(`
      CREATE SEQUENCE IF NOT EXISTS public.folio_reference_sequence AS bigint;

      -- Include known historical references, not just the folios still present.
      SELECT setval('public.folio_reference_sequence', coalesce(max(ordinal), 0) + 1, false)
      FROM (
        SELECT substring(folio_number FROM '([0-9]+)$')::bigint AS ordinal
          FROM public.folios
          WHERE folio_number ~ '^F-[0-9]+-[0-9]+(-[0-9]+){0,1}$'
        UNION ALL
        SELECT substring(
            coalesce(
              changes->'folioNumber'->>'new',
              meta->'before'->>'folio_number',
              meta->'after'->>'folio_number'
            ) FROM '([0-9]+)$'
          )::bigint
          FROM public.activity_logs
          WHERE entity_type IN ('Folio', 'folio')
            AND coalesce(
              changes->'folioNumber'->>'new',
              meta->'before'->>'folio_number',
              meta->'after'->>'folio_number'
            ) ~ '^F-[0-9]+-[0-9]+(-[0-9]+){0,1}$'
      ) known_references;
    `)
  }

  async down() {
    await this.schema.raw('DROP SEQUENCE IF EXISTS public.folio_reference_sequence')
  }
}
