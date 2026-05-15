import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'hotel_whatsapp_templates'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('hotel_id').unsigned().notNullable().references('id').inTable('hotels').onDelete('CASCADE')
      table.string('template_name', 100).notNullable()
      table.string('template_id').nullable().comment('ID retourné par Meta après création')
      table.string('category', 50).notNullable().defaultTo('UTILITY')
      table.string('language', 10).notNullable().defaultTo('fr')
      table.enum('status', ['PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED']).notNullable().defaultTo('PENDING')
      table.text('rejection_reason').nullable()
      table.jsonb('components').nullable().comment('Payload complet du template (header, body, footer, buttons)')
      table.timestamp('last_synced_at').nullable()
      table.timestamps(true, true)

      table.unique(['hotel_id', 'template_name'])
      table.index(['hotel_id', 'status'])
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}