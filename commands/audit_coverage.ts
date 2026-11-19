import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'

export default class AuditCoverage extends BaseCommand {
  static commandName = 'audit:coverage'
  static description = 'Verify PostgreSQL row-audit coverage and immutable audit/document storage'
  static options: CommandOptions = { startApp: true }

  async run() {
    const result = await db.rawQuery(`
      SELECT c.relname AS table_name FROM pg_class c
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind='r'
        AND c.relname NOT IN ('activity_logs','document_prints','adonis_schema','adonis_schema_versions','knex_migrations','knex_migrations_lock','spatial_ref_sys')
        AND (SELECT count(*) FROM pg_trigger t WHERE t.tgrelid=c.oid
          AND t.tgname IN ('business_row_audit','business_delete_audit','business_no_truncate')
          AND t.tgenabled IN ('O','A')) <> 3
      ORDER BY c.relname
    `)
    const protection = await db.rawQuery(`
      SELECT c.relname, count(*)::int AS count FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
      AND ((c.relname='activity_logs' AND t.tgname IN ('activity_logs_immutable','activity_logs_no_truncate'))
        OR (c.relname='document_prints' AND t.tgname IN ('document_prints_immutable','document_prints_no_truncate')))
      AND t.tgenabled IN ('O','A') GROUP BY c.relname
    `)
    const missingProtection = ['activity_logs', 'document_prints'].filter(
      (name) => !protection.rows.some((row: any) => row.relname === name && row.count === 2)
    )
    const reference = await db.rawQuery(`SELECT
      to_regclass('public.folio_reference_sequence') IS NOT NULL AS sequence_present,
      EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.folios'::regclass
        AND tgname='folio_reference_protected' AND tgenabled IN ('O','A')) AS reference_protected`)
    if (!reference.rows[0].sequence_present || !reference.rows[0].reference_protected) {
      missingProtection.push('folio_reference')
    }
    if (result.rows.length || missingProtection.length) {
      this.logger.error(
        JSON.stringify({ unauditedTables: result.rows, unprotectedTables: missingProtection })
      )
      this.exitCode = 1
      return
    }
    this.logger.success(
      'All existing public business tables are audited; audit history and PDFs are immutable'
    )
  }
}
