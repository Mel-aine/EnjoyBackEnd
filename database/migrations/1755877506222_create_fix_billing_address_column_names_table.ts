import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'company_accounts'

  async up() {
    // Vérifier si la colonne billing_address_line_1 existe
    const hasColumn = await this.db
      .rawQuery(`SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = '${this.tableName}' AND column_name = 'billing_address_line_1'
      )`)
      .then((result) => result.rows[0].exists)

    if (hasColumn) {
      // Si la colonne billing_address_line_1 existe, la renommer en billing_address_line1
      this.schema.alterTable(this.tableName, (table) => {
        this.db.rawQuery(`ALTER TABLE ${this.tableName} RENAME COLUMN billing_address_line_1 TO billing_address_line1`)
      })
    }
  }

  async down() {
    // Vérifier si la colonne billing_address_line1 existe
    const hasColumn = await this.db
      .rawQuery(`SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = '${this.tableName}' AND column_name = 'billing_address_line1'
      )`)
      .then((result) => result.rows[0].exists)

    if (hasColumn) {
      // Si la colonne billing_address_line1 existe, la renommer en billing_address_line_1
      this.schema.alterTable(this.tableName, (table) => {
        this.db.rawQuery(`ALTER TABLE ${this.tableName} RENAME COLUMN billing_address_line1 TO billing_address_line_1`)
      })
    }
  }
}