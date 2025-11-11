import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reservations'

  public async up() {
    const hasTable = await this.schema.hasTable(this.tableName)
    if (hasTable) {
      this.schema.alterTable(this.tableName, (table) => {
        table.string('ota_reservation_code', 100).nullable()
        table.string('ota_name', 100).nullable()
        table.string('ota_status', 50).nullable()
        table.json('ota_guarantee').nullable()
      })
    }
  }

  public async down() {
    const hasTable = await this.schema.hasTable(this.tableName)
    if (hasTable) {
      this.schema.alterTable(this.tableName, (table) => {
        table.dropColumn('ota_reservation_code')
        table.dropColumn('ota_name')
        table.dropColumn('ota_status')
        table.dropColumn('ota_guarantee')
      })
    }
  }
}