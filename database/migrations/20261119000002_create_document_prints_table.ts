import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'document_prints'

  async up() {
    const exists = await this.schema.hasTable(this.tableName)

    if (!exists) {
      this.schema.createTable(this.tableName, (table) => {
        table.bigIncrements('id')
        table.text('print_number').notNullable().unique()
        table.jsonb('reference').notNullable()
        table.bigInteger('hotel_id').nullable()
        table.bigInteger('reservation_id').nullable()
        table.bigInteger('folio_id').nullable()
        table.text('document_type').notNullable()
        table.text('template').notNullable()
        table.text('language').notNullable()
        table.specificType('sha256', 'char(64)').notNullable()
        table.specificType('pdf_data', 'bytea').notNullable()
        table.jsonb('data').notNullable()
        table.uuid('operation_id').nullable()
        table.bigInteger('user_id').nullable()
        table
          .timestamp('created_at', { useTz: true })
          .notNullable()
          .defaultTo(this.raw('clock_timestamp()'))

        table.index(['hotel_id', 'reservation_id', 'created_at'], 'document_prints_reservation_idx')
      })
    }

    this.schema.raw(
      'CREATE INDEX IF NOT EXISTS document_prints_reference_idx ON public.document_prints USING gin(reference)'
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
