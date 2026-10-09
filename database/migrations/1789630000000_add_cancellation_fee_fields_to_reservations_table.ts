import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reservations'

  async up() {
    const hasTable = await this.schema.hasTable(this.tableName)
    if (!hasTable) return

    const addColumn = async (
      column: string,
      callback: (table: any) => void
    ) => {
      const exists = await this.schema.hasColumn(this.tableName, column)
      if (!exists) {
        this.schema.alterTable(this.tableName, callback)
      }
    }

    // cancellation_fee_amount (decimal) — existe déjà dans certains environnements
    await addColumn('cancellation_fee_amount', (table) => {
      table.decimal('cancellation_fee_amount', 12, 2).nullable()
    })

    // cancellation_type : dans les délais / tardive (statut reste 'cancelled')
    await addColumn('cancellation_type', (table) => {
      table
        .string('cancellation_type', 30)
        .nullable()
        .comment("in_window | late — type d'annulation évalué par la politique")
    })

    // Exonération / dérogation manager
    await addColumn('cancellation_fee_waived', (table) => {
      table.boolean('cancellation_fee_waived').notNullable().defaultTo(false)
    })

    await addColumn('cancellation_waive_reason', (table) => {
      table.text('cancellation_waive_reason').nullable()
    })

    await addColumn('cancelled_by_user_id', (table) => {
      table
        .integer('cancelled_by_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
    })
  }

  async down() {
    const hasTable = await this.schema.hasTable(this.tableName)
    if (!hasTable) return

    const columnsToDrop = [
      'cancellation_type',
      'cancellation_fee_waived',
      'cancellation_waive_reason',
      'cancelled_by_user_id',
    ]

    for (const column of columnsToDrop) {
      const exists = await this.schema.hasColumn(this.tableName, column)
      if (exists) {
        this.schema.alterTable(this.tableName, (table) => {
          table.dropColumn(column)
        })
      }
    }
  }
}
