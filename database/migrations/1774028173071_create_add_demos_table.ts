import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'request_demos'

  async up() {
    const hasTable = await this.schema.hasTable(this.tableName)
    if (!hasTable) return

    const [hasCreatedBy, hasCity] = await Promise.all([
      this.schema.hasColumn(this.tableName, 'created_by'),
      this.schema.hasColumn(this.tableName, 'city'),
    ])

    if (hasCreatedBy && hasCity) return

    this.schema.alterTable(this.tableName, (table) => {
      if (!hasCreatedBy) {
        table.integer('created_by').unsigned().nullable().references('id').inTable('users')
      }
      if (!hasCity) {
        table.string('city').nullable()
      }
    })
  }

  async down() {
    const hasTable = await this.schema.hasTable(this.tableName)
    if (!hasTable) return

    const [hasCreatedBy, hasCity] = await Promise.all([
      this.schema.hasColumn(this.tableName, 'created_by'),
      this.schema.hasColumn(this.tableName, 'city'),
    ])

    if (!hasCreatedBy && !hasCity) return

    this.schema.alterTable(this.tableName, (table) => {
      if (hasCreatedBy) {
        table.dropColumn('created_by')
      }
      if (hasCity) {
        table.dropColumn('city')
      }
    })
  }
}
