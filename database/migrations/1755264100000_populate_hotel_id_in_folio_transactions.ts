import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'folio_transactions'

  async up() {
    // Update existing folio_transactions to set hotel_id from their related folios
    await this.db.rawQuery(`
      UPDATE folio_transactions 
      SET hotel_id = (
        SELECT folios.hotel_id 
        FROM folios 
        WHERE folios.id = folio_transactions.folio_id
      )
      WHERE hotel_id IS NULL
    `)
    
    // Now make the column NOT NULL since all records should have hotel_id
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('hotel_id').unsigned().notNullable().alter()
    })
  }

  async down() {
    // Make the column nullable again
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('hotel_id').unsigned().nullable().alter()
    })
  }
}