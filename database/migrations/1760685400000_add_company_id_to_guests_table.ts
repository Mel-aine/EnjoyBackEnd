import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddCompanyIdToGuestsTable extends BaseSchema {
  protected tableName = 'guests'

  public async up() {
    const exists = await this.schema.hasColumn(this.tableName, 'company_id')
    if (!exists) {
      this.schema.alterTable(this.tableName, (table) => {
        table
          .integer('company_id')
          .unsigned()
          .nullable()
          .references('id')
          .inTable('company_accounts')
          .onDelete('SET NULL')
      })
    }
  }

  public async down() {
    const exists = await this.schema.hasColumn(this.tableName, 'company_id')
    if (exists) {
      this.schema.alterTable(this.tableName, (table) => {
        table.dropColumn('company_id')
      })
    }
  }
}