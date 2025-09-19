import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddForeignKeysToDiscounts extends BaseSchema {
  protected tableName = 'discounts'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Add foreign key for createdByUserId
      table
        .integer('created_by_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL') // If the user is deleted, set createdByUserId to NULL
        .onUpdate('CASCADE') // Update createdByUserId if the user ID changes

      // Add foreign key for updatedByUserId
      table
        .integer('updated_by_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL') // If the user is deleted, set updatedByUserId to NULL
        .onUpdate('CASCADE') // Update updatedByUserId if the user ID changes
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Drop foreign keys
      table.dropForeign(['created_by_user_id'])
      table.dropForeign(['updated_by_user_id'])

      // Drop columns
      table.dropColumn('created_by_user_id')
      table.dropColumn('updated_by_user_id')
    })
  }
}