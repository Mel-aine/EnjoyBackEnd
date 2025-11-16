import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'support_tickets'

  async up() {
    const hasTable = await this.schema.hasTable(this.tableName)
    if (!hasTable) {
      this.schema.createTable(this.tableName, (table) => {
        table.increments('id').primary()
        table.string('title', 255).notNullable()
        table.string('category', 50).notNullable()
        table.string('module', 100).notNullable()
        table.string('impact', 50).notNullable()
        table.string('severity', 50).notNullable()
        table.jsonb('description').notNullable()
        table.jsonb('context').notNullable()
        table.jsonb('attachments').nullable()
        table.string('status', 50).notNullable().defaultTo('open')
        table.string('callback_phone', 50).nullable()
        table.integer('hotel_id').unsigned().references('id').inTable('hotels').onDelete('SET NULL').nullable()
        table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL').nullable()
        table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
        table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      })

      this.schema.raw(`
        ALTER TABLE support_tickets 
        ADD CONSTRAINT support_tickets_category_check 
        CHECK (category IN ('bug','suggestion','question'))
      `)

      this.schema.raw(`
        ALTER TABLE support_tickets 
        ADD CONSTRAINT support_tickets_impact_check 
        CHECK (impact IN ('tous','plusieurs','un','rapport'))
      `)

      this.schema.raw(`
        ALTER TABLE support_tickets 
        ADD CONSTRAINT support_tickets_severity_check 
        CHECK (severity IN ('critical','high','low'))
      `)

      this.schema.raw(`
        ALTER TABLE support_tickets 
        ADD CONSTRAINT support_tickets_status_check 
        CHECK (status IN ('open','in_progress','resolved','closed'))
      `)

      this.schema.raw(`
        ALTER TABLE support_tickets 
        ADD CONSTRAINT support_tickets_module_check 
        CHECK (module IN ('Réservations','Check-in/out','Facturation','Housekeeping','Moteur de réservation','Rapports','Autre'))
      `)
    }
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}