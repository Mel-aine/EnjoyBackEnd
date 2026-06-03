import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'document_tokens'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
       table.increments('id').primary()
      table.string('token', 64).unique().notNullable()
      table.string('filename').notNullable()
      table.string('file_path').notNullable()
      table.timestamp('expires_at').notNullable()
      table.timestamps(true)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}