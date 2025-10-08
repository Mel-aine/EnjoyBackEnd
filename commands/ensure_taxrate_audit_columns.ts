import { BaseCommand } from '@adonisjs/core/ace'
import db from '@adonisjs/lucid/services/db'

export default class EnsureTaxrateAuditColumns extends BaseCommand {
  public static commandName = 'tax:ensure-audit-columns'
  public static description = 'Ensure tax_rates has audit user columns with NULL defaults'
  public static options = { startApp: true }

  public async run() {
    this.logger.info('Ensuring tax_rates audit columns exist...')
    try {
      // Add columns if they do not exist
      await db.raw(`
        ALTER TABLE tax_rates
        ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER NULL,
        ADD COLUMN IF NOT EXISTS updated_by_user_id INTEGER NULL;
      `)

      // Add foreign keys if not already present (Postgres-specific safe guards)
      await db.raw(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'tax_rates_created_by_user_id_fkey'
          ) THEN
            ALTER TABLE tax_rates
              ADD CONSTRAINT tax_rates_created_by_user_id_fkey
              FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
          END IF;
        END $$;
      `)

      await db.raw(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'tax_rates_updated_by_user_id_fkey'
          ) THEN
            ALTER TABLE tax_rates
              ADD CONSTRAINT tax_rates_updated_by_user_id_fkey
              FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
          END IF;
        END $$;
      `)

      this.logger.success('Audit columns ensured on tax_rates.')
    } catch (error: any) {
      this.logger.error('Failed ensuring audit columns:')
      console.error(error?.stack || error)
    }
  }
}