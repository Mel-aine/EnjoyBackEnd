import { BaseCommand } from '@adonisjs/core/ace'
import TaxRate from '#models/tax_rate'
import db from '@adonisjs/lucid/services/db'

export default class ResetTaxRateAudit extends BaseCommand {
  public static commandName = 'tax:reset-audit'
  public static description = 'Set createdByUserId and updatedByUserId to NULL for all tax rates'
  public static options = { startApp: true }

  public async run() {
    this.logger.info('Resetting TaxRate audit user fields to NULL...')
    try {
      const columnsResult = await db.raw(`
        SELECT column_name FROM information_schema.columns WHERE table_name = 'tax_rates';
      `)
      const columns: string[] = columnsResult?.rows?.map((r: any) => r.column_name) ?? []
      this.logger.info(`tax_rates columns: ${columns.join(', ')}`)

      // Prefer raw query to avoid issues with model property/column mapping
      const affected = await db.from('tax_rates').update({
        created_by_user_id: null,
        updated_by_user_id: null,
      })

      this.logger.success(`Updated ${affected} tax rate rows.`)
    } catch (error: any) {
      this.logger.error('Failed to reset tax rate audit fields:')
      console.error(error?.stack || error)
    }
  }
}