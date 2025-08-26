import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'guests'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('fax').nullable()
      table.string('registration_number').nullable()
      table.string('id_number').nullable()
      table.string('id_type').nullable()
      table.string('issuing_country').nullable()
      table.string('issuing_city').nullable()
      table.string('id_photo').nullable()
      table.string('profile_photo').nullable()
      table.date('id_expiry_date').nullable()
      table
        .enum('vip_status', ['none', 'bronze', 'silver', 'gold', 'platinum', 'diamond'])
        .nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('fax').nullable()
      table.string('registration_number').nullable()
      table.string('id_number').nullable()
      table.string('id_type').nullable()
      table.string('issuing_country').nullable()
      table.string('issuing_city').nullable()
      table.string('id_photo').nullable()
      table.string('profile_photo').nullable()
      table.date('id_expiry_date').nullable()
      table
        .enum('vip_status', ['none', 'bronze', 'silver', 'gold', 'platinum', 'diamond'])
        .nullable()
    })
  }
}
