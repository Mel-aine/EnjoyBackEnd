import { BaseSchema } from '@adonisjs/lucid/schema'

export default class RemovePositionIdFromContracts extends BaseSchema {
  protected tableName = 'employment_contracts'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('position_id')
    })
  }

  async down() {
    // Comme la suppression est définitive, on ne remet pas le champ dans le down()
  }
}
