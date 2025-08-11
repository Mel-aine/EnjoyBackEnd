import { BaseSchema } from '@adonisjs/lucid/schema'


export default class PerformanceReviews extends BaseSchema {
  protected tableName = 'performance_reviews'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      table
        .integer('employee_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('employees')
        .onDelete('CASCADE')

      table
        .integer('reviewer_user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')

      table.date('review_date').notNullable()
      table.date('review_period_start').nullable()
      table.date('review_period_end').nullable()

      table.integer('overall_rating').nullable()
      table.text('strengths').nullable()
      table.text('areas_for_improvement').nullable()
      table.text('goals_for_next_period').nullable()
      table.text('employee_comments').nullable()

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
