import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reservation_rooms'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('send_mail').defaultTo(0)
      table.boolean('check_out_mail').defaultTo(0)
      table.boolean('thank_you_email_to_guest').defaultTo(0)
      table.boolean('supress_rate').defaultTo(0)
      table.boolean('access_guest_portal').defaultTo(0)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('send_mail').defaultTo(0)
      table.boolean('check_out_mail').defaultTo(0)
      table.boolean('thank_you_email_to_guest').defaultTo(0)
      table.boolean('supress_rate').defaultTo(0)
      table.boolean('access_guest_portal').defaultTo(0)
    })
  }
}
