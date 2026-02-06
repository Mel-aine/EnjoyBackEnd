
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'folios'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Drop the existing global unique constraint
      // The constraint name is typically 'folios_folio_number_unique'
      table.dropUnique(['folio_number'])
      
      // Add a composite unique constraint scoped by hotel_id
      table.unique(['hotel_id', 'folio_number'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Revert the changes
      table.dropUnique(['hotel_id', 'folio_number'])
      table.unique(['folio_number'])
    })
  }
}
