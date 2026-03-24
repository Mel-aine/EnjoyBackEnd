import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'add_ons'

  async up() {
    const hasTable = await this.schema.hasTable(this.tableName)
    if (!hasTable) return

    const hasName = await this.schema.hasColumn(this.tableName, 'name')
    if (!hasName) {
      this.schema.alterTable(this.tableName, (table) => {
        table.string('name').nullable()
      })
    }

    await this.schema.raw(`UPDATE ${this.tableName} SET name = 'Unnamed Add-on' WHERE name IS NULL;`)

    this.schema.alterTable(this.tableName, (table) => {
      table.string('name').notNullable().alter()
    })
  }

  async down() {
    const hasTable = await this.schema.hasTable(this.tableName)
    if (!hasTable) return

    const hasName = await this.schema.hasColumn(this.tableName, 'name')
    if (!hasName) return

    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('name')
    })
  }
}
