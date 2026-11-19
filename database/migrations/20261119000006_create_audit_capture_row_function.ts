import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    await this.schema.raw(String.raw`
      CREATE OR REPLACE FUNCTION public.audit_capture_row() RETURNS trigger
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
      DECLARE
        previous jsonb; following jsonb; row_data jsonb; context jsonb; parent_data jsonb;
        diff jsonb := '{}'::jsonb; business_events jsonb := '[]'::jsonb; k text; hotel bigint; reservation bigint; folio bigint;
        actor bigint; entity bigint; entity_key text; actor_name text;
      BEGIN
        IF TG_OP <> 'INSERT' THEN previous := to_jsonb(OLD); END IF;
        IF TG_OP <> 'DELETE' THEN following := to_jsonb(NEW); END IF;
        IF TG_OP='UPDATE' AND previous=following THEN RETURN NEW; END IF;
        row_data := coalesce(following,previous);
        context := public.audit_statement_context();
        FOR k IN SELECT jsonb_object_keys(coalesce(previous,'{}') || coalesce(following,'{}')) LOOP
          IF TG_OP <> 'UPDATE' OR previous->k IS DISTINCT FROM following->k THEN
            diff := diff || jsonb_build_object(k,jsonb_build_object(
              'old', public.audit_redact(jsonb_build_object(k,previous->k))->k,
              'new', public.audit_redact(jsonb_build_object(k,following->k))->k));
          END IF;
        END LOOP;
        IF TG_TABLE_NAME='folio_transactions' AND row_data->>'transaction_type'='payment' THEN
          business_events := business_events || jsonb_build_array('PAYMENT_' || CASE TG_OP WHEN 'INSERT' THEN 'CREATED' WHEN 'DELETE' THEN 'DELETED' ELSE 'UPDATED' END);
        END IF;
        IF TG_OP='UPDATE' THEN
          IF jsonb_exists(diff,'room_rate') THEN business_events := business_events || '["RATE_CHANGED"]'::jsonb; END IF;
          IF jsonb_exists(diff,'room_id') THEN business_events := business_events || '["ROOM_MOVE"]'::jsonb; END IF;
          IF jsonb_exists_any(diff,ARRAY['total_amount','amount','final_amount','total_charges','total_payments','balance']) THEN business_events := business_events || '["AMOUNT_CHANGED"]'::jsonb; END IF;
          IF jsonb_exists_any(diff,ARRAY['check_in_date','check_out_date','arrived_date','depart_date','nights','number_of_nights']) THEN business_events := business_events || '["STAY_DATES_CHANGED"]'::jsonb; END IF;
          IF jsonb_exists_any(diff,ARRAY['tax_amount','taxes','total_taxes','tax_includes']) THEN business_events := business_events || '["TAXES_CHANGED"]'::jsonb; END IF;
          IF jsonb_exists_any(diff,ARRAY['currency_code','original_currency','exchange_rate']) THEN business_events := business_events || '["CURRENCY_CHANGED"]'::jsonb; END IF;
          IF jsonb_exists(diff,'payment_method_id') THEN business_events := business_events || '["PAYMENT_METHOD_CHANGED"]'::jsonb; END IF;
          IF jsonb_exists_any(diff,ARRAY['discount_amount','discounts','discount_id','discount_rate']) THEN business_events := business_events || '["DISCOUNT_CHANGED"]'::jsonb; END IF;
          IF ((jsonb_exists(diff,'is_voided')) AND row_data->>'is_voided'='true') OR ((jsonb_exists(diff,'status')) AND row_data->>'status'='voided') OR ((jsonb_exists(diff,'voided_date')) AND row_data->>'voided_date' IS NOT NULL) THEN business_events := business_events || '["VOID"]'::jsonb; END IF;
          IF ((jsonb_exists(diff,'status')) AND row_data->>'status' IN ('cancelled','canceled')) OR ((jsonb_exists(diff,'cancellation_date')) AND row_data->>'cancellation_date' IS NOT NULL) THEN business_events := business_events || '["CANCEL"]'::jsonb; END IF;
          IF jsonb_exists(diff,'status') THEN business_events := business_events || jsonb_build_array('STATUS_CHANGED'); END IF;
        END IF;
        entity_key := row_data->>'id';
        IF entity_key ~ '^[0-9]{1,18}$' THEN entity := entity_key::bigint; END IF;
        hotel := nullif(row_data->>'hotel_id','')::bigint;
        reservation := nullif(row_data->>'reservation_id','')::bigint;
        folio := nullif(row_data->>'folio_id','')::bigint;
        IF TG_TABLE_NAME='hotels' THEN hotel := entity; END IF;
        IF TG_TABLE_NAME='reservations' THEN reservation := entity; END IF;
        IF reservation IS NULL AND row_data->>'reservation_room_id' IS NOT NULL THEN
          parent_data := public.audit_parent_snapshot('reservation_rooms',row_data->>'reservation_room_id');
          reservation := (parent_data->>'reservation_id')::bigint;
          hotel := coalesce(hotel,(parent_data->>'hotel_id')::bigint);
        END IF;
        IF folio IS NULL AND jsonb_exists(row_data,'folio_transaction_id') THEN
          parent_data := public.audit_parent_snapshot('folio_transactions',row_data->>'folio_transaction_id');
          folio := (parent_data->>'folio_id')::bigint;
          reservation := coalesce(reservation,(parent_data->>'reservation_id')::bigint);
          hotel := coalesce(hotel,(parent_data->>'hotel_id')::bigint);
        END IF;
        IF folio IS NOT NULL AND (hotel IS NULL OR reservation IS NULL) THEN
          parent_data := public.audit_parent_snapshot('folios',folio::text);
          hotel := coalesce(hotel,(parent_data->>'hotel_id')::bigint);
          reservation := coalesce(reservation,(parent_data->>'reservation_id')::bigint);
        END IF;
        IF hotel IS NULL AND reservation IS NOT NULL THEN
          parent_data := public.audit_parent_snapshot('reservations',reservation::text);
          hotel := (parent_data->>'hotel_id')::bigint;
          IF hotel IS NULL THEN
            SELECT l.hotel_id INTO hotel FROM public.activity_logs l
              WHERE l.entity_type='Reservation' AND l.entity_id=reservation
              ORDER BY l.id DESC LIMIT 1;
          END IF;
        END IF;
        IF hotel IS NULL AND row_data->>'guest_id' IS NOT NULL THEN
          parent_data := public.audit_parent_snapshot('guests',row_data->>'guest_id');
          hotel := (parent_data->>'hotel_id')::bigint;
        END IF;
        -- Never claim that the last editor of a row performed a direct SQL DELETE.
        actor := nullif(context->>'actorId','')::bigint;
        actor_name := coalesce(nullif(context->>'actorName',''),CASE WHEN actor IS NULL THEN 'Database/System' ELSE 'User '||actor END);
        INSERT INTO public.activity_logs
          (user_id,username,action,entity_type,entity_id,description,changes,meta,
           hotel_id,reservation_id,created_by,ip_address,user_agent,created_at,updated_at)
        VALUES
          (actor,left(actor_name,255),CASE WHEN TG_OP='INSERT' THEN 'CREATE' ELSE TG_OP END,TG_ARGV[0],entity,
           format('%s %s #%s',TG_OP,TG_TABLE_NAME,coalesce(entity_key,'(composite key)')),
           diff, context || jsonb_build_object(
             'auditVersion',1,'origin','database_trigger','table',TG_TABLE_NAME,'events',business_events,
             'entityKey',entity_key,'databaseUser',session_user,'transactionId',txid_current()::text,
             'source',coalesce(context->>'source','database'),
             'rowActorHint',coalesce(row_data->>'last_modified_by',row_data->>'created_by'),
             'before',public.audit_redact(previous),'after',public.audit_redact(following)),
           hotel,reservation,actor,left(context->>'ipAddress',45),context->>'userAgent',clock_timestamp(),clock_timestamp());
        IF TG_OP='DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
      END $$;
    `)
  }

  async down() {
    await this.schema.raw('DROP FUNCTION IF EXISTS public.audit_capture_row()')
  }
}
