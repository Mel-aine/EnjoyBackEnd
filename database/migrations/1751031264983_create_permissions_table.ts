import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'permissions'

  async up() {
    // Check if table exists first
    const hasTable = await this.schema.hasTable(this.tableName)
    
    if (!hasTable) {
      this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('name').notNullable()
      table.string('label').nullable()
      table.string('icon').nullable()
      table.string('category').nullable()
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())
    })
    }
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
