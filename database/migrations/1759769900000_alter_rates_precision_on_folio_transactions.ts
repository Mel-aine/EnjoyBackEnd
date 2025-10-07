import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'folio_transactions'

  public async up() {
    // Widen rate columns to avoid numeric overflow when storing percentages like 20 or 100
    await this.db.rawQuery(`
      ALTER TABLE ${this.tableName}
      ALTER COLUMN discount_rate TYPE numeric(7,4) USING discount_rate::numeric,
      ALTER COLUMN tax_rate TYPE numeric(7,4) USING tax_rate::numeric,
      ALTER COLUMN service_charge_rate TYPE numeric(7,4) USING service_charge_rate::numeric
    `)
  }

  public async down() {
    // Revert to previous narrower precision (may overflow for values > 9.9999)
    await this.db.rawQuery(`
      ALTER TABLE ${this.tableName}
      ALTER COLUMN discount_rate TYPE numeric(5,4) USING discount_rate::numeric,
      ALTER COLUMN tax_rate TYPE numeric(5,4) USING tax_rate::numeric,
      ALTER COLUMN service_charge_rate TYPE numeric(5,4) USING service_charge_rate::numeric
    `)
  }
}