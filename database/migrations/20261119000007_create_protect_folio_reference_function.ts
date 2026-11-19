import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    await this.schema.raw(`
      CREATE OR REPLACE FUNCTION public.protect_folio_reference() RETURNS trigger
      LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
      BEGIN
        IF TG_OP='UPDATE' THEN
          IF OLD.folio_number IS DISTINCT FROM NEW.folio_number THEN
            RAISE EXCEPTION 'An issued folio reference cannot be changed';
          END IF;
          RETURN NEW;
        END IF;
        IF EXISTS (SELECT 1 FROM public.activity_logs l WHERE l.entity_type IN ('Folio','folio') AND
          (l.meta->'after'->>'folio_number'=NEW.folio_number OR l.meta->'before'->>'folio_number'=NEW.folio_number
            OR l.changes->'folioNumber'->>'new'=NEW.folio_number))
          OR EXISTS (SELECT 1 FROM public.document_prints p WHERE p.reference->>'number'=NEW.folio_number) THEN
          RAISE EXCEPTION 'Folio reference % has already been issued and cannot be reused',NEW.folio_number;
        END IF;
        RETURN NEW;
      END $$;
    `)
  }

  async down() {
    await this.schema.raw('DROP FUNCTION IF EXISTS public.protect_folio_reference()')
  }
}
