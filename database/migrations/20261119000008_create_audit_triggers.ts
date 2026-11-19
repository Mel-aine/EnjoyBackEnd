import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    await this.schema.raw(`
      DROP TRIGGER IF EXISTS folio_reference_protected ON public.folios;
      CREATE TRIGGER folio_reference_protected BEFORE INSERT OR UPDATE OF folio_number ON public.folios
        FOR EACH ROW EXECUTE FUNCTION public.protect_folio_reference();

      DROP TRIGGER IF EXISTS activity_logs_immutable ON public.activity_logs;
      CREATE TRIGGER activity_logs_immutable BEFORE UPDATE OR DELETE ON public.activity_logs
        FOR EACH ROW EXECUTE FUNCTION public.audit_reject_mutation();
      DROP TRIGGER IF EXISTS activity_logs_no_truncate ON public.activity_logs;
      CREATE TRIGGER activity_logs_no_truncate BEFORE TRUNCATE ON public.activity_logs
        FOR EACH STATEMENT EXECUTE FUNCTION public.audit_reject_mutation();

      DROP TRIGGER IF EXISTS document_prints_immutable ON public.document_prints;
      CREATE TRIGGER document_prints_immutable BEFORE UPDATE OR DELETE ON public.document_prints
        FOR EACH ROW EXECUTE FUNCTION public.audit_reject_mutation();
      DROP TRIGGER IF EXISTS document_prints_no_truncate ON public.document_prints;
      CREATE TRIGGER document_prints_no_truncate BEFORE TRUNCATE ON public.document_prints
        FOR EACH STATEMENT EXECUTE FUNCTION public.audit_reject_mutation();
    `)

    // Called again by each future migration that adds a public business table.
    await this.schema.raw(String.raw`
      CREATE OR REPLACE FUNCTION public.install_business_audit_triggers() RETURNS void
      LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
      DECLARE t record; entity_type text;
      BEGIN
        FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='public' AND c.relkind='r'
            AND c.relname NOT IN ('activity_logs','document_prints','adonis_schema','adonis_schema_versions','knex_migrations','knex_migrations_lock','spatial_ref_sys')
        LOOP
          entity_type := CASE t.relname
            WHEN 'reservations' THEN 'Reservation' WHEN 'reservation_rooms' THEN 'ReservationRoom'
            WHEN 'folios' THEN 'Folio' WHEN 'folio_transactions' THEN 'FolioTransaction'
            WHEN 'receipts' THEN 'Receipt' WHEN 'guests' THEN 'Guest'
            ELSE replace(initcap(regexp_replace(t.relname,'s$','')),'_','') END;
          EXECUTE format('DROP TRIGGER IF EXISTS business_row_audit ON public.%I',t.relname);
          EXECUTE format('CREATE TRIGGER business_row_audit AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_capture_row(%L)',t.relname,entity_type);
          EXECUTE format('DROP TRIGGER IF EXISTS business_delete_audit ON public.%I',t.relname);
          EXECUTE format('CREATE TRIGGER business_delete_audit BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_capture_row(%L)',t.relname,entity_type);
          EXECUTE format('DROP TRIGGER IF EXISTS business_no_truncate ON public.%I',t.relname);
          EXECUTE format('CREATE TRIGGER business_no_truncate BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.audit_reject_truncate()',t.relname);
        END LOOP;
      END $$;
    `)

    await this.schema.raw('SELECT public.install_business_audit_triggers()')
  }

  async down() {
    await this.schema.raw(`
      DO $$ DECLARE t record; BEGIN
        FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='public' AND c.relkind='r'
        LOOP
          EXECUTE format('DROP TRIGGER IF EXISTS business_row_audit ON public.%I',t.relname);
          EXECUTE format('DROP TRIGGER IF EXISTS business_delete_audit ON public.%I',t.relname);
          EXECUTE format('DROP TRIGGER IF EXISTS business_no_truncate ON public.%I',t.relname);
        END LOOP;
      END $$;

      DROP TRIGGER IF EXISTS folio_reference_protected ON public.folios;
      DROP TRIGGER IF EXISTS activity_logs_immutable ON public.activity_logs;
      DROP TRIGGER IF EXISTS activity_logs_no_truncate ON public.activity_logs;
      DROP TRIGGER IF EXISTS document_prints_immutable ON public.document_prints;
      DROP TRIGGER IF EXISTS document_prints_no_truncate ON public.document_prints;
      DROP FUNCTION IF EXISTS public.install_business_audit_triggers();
    `)
  }
}
