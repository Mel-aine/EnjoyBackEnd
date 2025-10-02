import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'house_keepers'

  public async up() {
    const hasTable = await this.schema.hasTable(this.tableName)
    if (!hasTable) {
      this.schema.createTable(this.tableName, (table) => {
        table.increments('id').primary()

        table
          .integer('hotel_id')
          .unsigned()
          .notNullable()
          .references('id')
          .inTable('hotels')
          .onDelete('CASCADE')

        table.string('name').notNullable()
        table.string('phone').notNullable()

        table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
        table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

        table.index(['hotel_id'])
      })
    }
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}