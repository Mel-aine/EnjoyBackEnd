import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'guests'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
         table.string('place_of_birth').nullable()
         table.string('profession').nullable()



    })


  }

  async down() {

    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('place_of_birth')
      table.dropColumn('profession')

    })
  }
}
