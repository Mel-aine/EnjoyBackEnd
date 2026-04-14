import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'hotels'

  async up() {
    const hasUseCashering = await this.schema.hasColumn(this.tableName, 'use_cashering')
    const hasUseChannel = await this.schema.hasColumn(this.tableName, 'use_channel')

    if (!hasUseCashering || !hasUseChannel) {
      this.schema.alterTable(this.tableName, (table) => {
        if (!hasUseCashering) {
          table.boolean('use_cashering').notNullable().defaultTo(false)
        }
        if (!hasUseChannel) {
          table.boolean('use_channel').notNullable().defaultTo(false)
        }
      })
    }
  }

  async down() {
    const hasUseCashering = await this.schema.hasColumn(this.tableName, 'use_cashering')
    const hasUseChannel = await this.schema.hasColumn(this.tableName, 'use_channel')

    if (hasUseCashering || hasUseChannel) {
      this.schema.alterTable(this.tableName, (table) => {
        if (hasUseCashering) {
          table.dropColumn('use_cashering')
        }
        if (hasUseChannel) {
          table.dropColumn('use_channel')
        }
      })
    }
  }
}
