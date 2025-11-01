import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // Create function to sync company account current_balance from folio balance
    await this.schema.raw(`
      CREATE OR REPLACE FUNCTION sync_company_balance_on_folio()
      RETURNS trigger AS $$
      BEGIN
        IF NEW.company_id IS NOT NULL THEN
          UPDATE company_accounts
          SET current_balance = COALESCE(NEW.balance, 0)
          WHERE id = NEW.company_id;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `)

    // Create trigger on folios for insert or balance/company changes
    await this.schema.raw(`
      DROP TRIGGER IF EXISTS folios_sync_company_balance_aiu ON folios;
      CREATE TRIGGER folios_sync_company_balance_aiu
      AFTER INSERT OR UPDATE OF balance, company_id ON folios
      FOR EACH ROW
      EXECUTE FUNCTION sync_company_balance_on_folio();
    `)
  }

  async down() {
    await this.schema.raw(`
      DROP TRIGGER IF EXISTS folios_sync_company_balance_aiu ON folios;
      DROP FUNCTION IF EXISTS sync_company_balance_on_folio();
    `)
  }
}