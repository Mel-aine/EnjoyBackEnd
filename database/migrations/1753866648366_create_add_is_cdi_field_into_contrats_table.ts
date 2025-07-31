import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddIsCdiToEmploymentContracts extends BaseSchema {
  protected tableName = 'employment_contracts'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('is_cdi').nullable().after('base_salary')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('is_cdi')
    })
  }
}
