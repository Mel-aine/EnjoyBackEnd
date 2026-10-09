import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'cancellation_settings'

  async up() {
    const hasTable = await this.schema.hasTable(this.tableName)
    if (hasTable) return

    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('hotel_id').unsigned().notNullable().references('id').inTable('hotels').onDelete('CASCADE')

      // Délai de franchise : annulation gratuite jusqu'à N heures avant le check-in
      table.integer('cancellation_free_hours').notNullable().defaultTo(24)

      // FIRST_NIGHT | PERCENTAGE | FIXED_AMOUNT | FULL_STAY | FREE
      table
        .string('cancellation_charge_type', 20)
        .notNullable()
        .defaultTo('FIRST_NIGHT')

      // Valeur associée : % pour PERCENTAGE, montant pour FIXED_AMOUNT, ignoré sinon
      table.decimal('cancellation_charge_value', 12, 2).nullable().defaultTo(0)

      table.integer('last_modified_by_user_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL')

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.unique(['hotel_id'])
    })
  }

  async down() {
    const hasTable = await this.schema.hasTable(this.tableName)
    if (!hasTable) return

    this.schema.dropTable(this.tableName)
  }
}
