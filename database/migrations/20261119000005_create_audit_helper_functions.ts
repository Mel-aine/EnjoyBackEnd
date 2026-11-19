import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    await this.schema.raw(String.raw`
      CREATE OR REPLACE FUNCTION public.audit_redact(value jsonb) RETURNS jsonb
      LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog, public AS $$
      DECLARE result jsonb; k text; v jsonb;
      BEGIN
        IF value IS NULL THEN RETURN NULL; END IF;
        IF jsonb_typeof(value)='object' THEN
          result := '{}'::jsonb;
          FOR k,v IN SELECT * FROM jsonb_each(value) LOOP
            result := result || jsonb_build_object(k, CASE
              WHEN k ~* '(password|secret|token|authorization|cookie|api.{0,1}key|private.{0,1}key|otp|recovery.{0,1}code|card.{0,1}number|cvv|passport|id.{0,1}photo|id.{0,1}number|hash|credential|(^|_)(key|salt)$|pdf_data)'
              THEN '"[REDACTED]"'::jsonb ELSE public.audit_redact(v) END);
          END LOOP;
          RETURN result;
        ELSIF jsonb_typeof(value)='array' THEN
          SELECT coalesce(jsonb_agg(public.audit_redact(e.value) ORDER BY e.ordinality),'[]'::jsonb)
            INTO result FROM jsonb_array_elements(value) WITH ORDINALITY e(value, ordinality);
          RETURN result;
        END IF;
        RETURN value;
      END $$;
    `)

    await this.schema.raw(String.raw`
      CREATE OR REPLACE FUNCTION public.audit_statement_context() RETURNS jsonb
      LANGUAGE plpgsql STABLE SET search_path = pg_catalog, public AS $$
      DECLARE marker text;
      BEGIN
        marker := substring(current_query() FROM '^/\*enjoy_audit:([A-Za-z0-9+/=]+)\*/');
        IF marker IS NULL THEN RETURN '{}'::jsonb; END IF;
        RETURN convert_from(decode(marker,'base64'),'UTF8')::jsonb;
      END $$;
    `)

    await this.schema.raw(String.raw`
      CREATE OR REPLACE FUNCTION public.audit_parent_snapshot(parent_table text, parent_id text) RETURNS jsonb
      LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
      DECLARE snapshot jsonb;
      BEGIN
        IF parent_id IS NULL OR parent_table NOT IN ('reservations','reservation_rooms','folios','folio_transactions','guests','rooms','room_types','company_accounts') THEN RETURN NULL; END IF;
        IF to_regclass(format('public.%I',parent_table)) IS NOT NULL THEN
          EXECUTE format('SELECT to_jsonb(p) FROM public.%I p WHERE p.id::text=$1',parent_table) INTO snapshot USING parent_id;
        END IF;
        IF snapshot IS NULL THEN
          SELECT coalesce(nullif(l.meta->'after','null'::jsonb),l.meta->'before') INTO snapshot
            FROM public.activity_logs l WHERE l.meta->>'table'=parent_table AND l.meta->>'entityKey'=parent_id
            ORDER BY l.id DESC LIMIT 1;
        END IF;
        RETURN snapshot;
      END $$;
    `)

    await this.schema.raw(`
      CREATE OR REPLACE FUNCTION public.audit_reject_mutation() RETURNS trigger
      LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
      BEGIN RAISE EXCEPTION 'Audit history is append-only: % on % is forbidden',TG_OP,TG_TABLE_NAME; END $$;
    `)

    await this.schema.raw(`
      CREATE OR REPLACE FUNCTION public.audit_reject_truncate() RETURNS trigger
      LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
      BEGIN RAISE EXCEPTION 'Use audited DELETE instead of TRUNCATE on %',TG_TABLE_NAME; END $$;
    `)
  }

  async down() {
    await this.schema.raw(`
      DROP FUNCTION IF EXISTS public.audit_redact(jsonb);
      DROP FUNCTION IF EXISTS public.audit_statement_context();
      DROP FUNCTION IF EXISTS public.audit_parent_snapshot(text,text);
      DROP FUNCTION IF EXISTS public.audit_reject_mutation();
      DROP FUNCTION IF EXISTS public.audit_reject_truncate();
    `)
  }
}
