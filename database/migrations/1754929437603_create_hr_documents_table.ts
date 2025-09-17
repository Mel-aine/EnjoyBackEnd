import { BaseSchema } from '@adonisjs/lucid/schema'

export default class  extends BaseSchema {
  protected tableName = 'hr_documents'

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

      table.enu('document_type', ['EmploymentContract','WarningLetter','Resume','Certificate','PerformanceReview','LeaveRequest','OfferLetter','TerminationLetter','NDA','Other' ]).nullable()

      table.string('document_name', 255).notNullable()
      table.string('file_url', 500).notNullable()

      table.timestamp('upload_datetime', { useTz: true }).notNullable()

      table
        .integer('uploaded_by_user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
    }
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
