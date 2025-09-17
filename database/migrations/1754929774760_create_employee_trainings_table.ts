import { BaseSchema } from '@adonisjs/lucid/schema'

export default class  extends BaseSchema {
  protected tableName = 'employee_trainings'

  public async up() {
    // Check if table exists first
    const hasTable = await this.schema.hasTable(this.tableName)
    
    if (!hasTable) {
      this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      table
        .integer('employee_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('employees')
        .onDelete('CASCADE')

      table.string('training_name', 255).notNullable()
      table.string('training_provider', 255).nullable()
      table.date('completion_date').notNullable()
      table.date('certification_valid_until').nullable()
      table.decimal('training_cost', 10, 2).notNullable().defaultTo(0.00)
      table.text('notes').nullable()

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
    }
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
