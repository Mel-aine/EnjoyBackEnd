import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // ============================================
    // 1. Table: sync_operations
    // ============================================
    this.schema.createTable('sync_operations', (table) => {
      table.increments('id')
      table.integer('hotel_id').unsigned().notNullable().references('id').inTable('hotels').onDelete('CASCADE')
      table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.string('operation_id', 64).notNullable().unique()
      table.string('operation_type', 32).notNullable()
      table.string('resource_type', 64).notNullable()
      table.integer('resource_id').nullable()
      table.jsonb('payload').notNullable()
      table.string('status', 16).notNullable().defaultTo('pending')
      table.integer('priority').notNullable().defaultTo(0)
      table.timestamp('client_timestamp').notNullable()
      table.timestamp('server_timestamp').defaultTo(this.now())
      table.jsonb('conflict_data').nullable()
      table.text('error_message').nullable()
      table.integer('retry_count').defaultTo(0)
      table.integer('max_retries').defaultTo(3)
      table.timestamp('created_at').defaultTo(this.now())
      table.timestamp('updated_at').defaultTo(this.now())
    })

    this.schema.raw(`
      CREATE INDEX idx_sync_ops_hotel_user ON sync_operations(hotel_id, user_id);
      CREATE INDEX idx_sync_ops_status ON sync_operations(status);
      CREATE INDEX idx_sync_ops_created ON sync_operations(created_at);
    `)

    // ============================================
    // 2. Table: sync_conflicts
    // ============================================
    this.schema.createTable('sync_conflicts', (table) => {
      table.increments('id')
      table.integer('sync_operation_id').unsigned().references('id').inTable('sync_operations').onDelete('SET NULL')
      table.integer('hotel_id').unsigned().notNullable().references('id').inTable('hotels').onDelete('CASCADE')
      table.string('resource_type', 64).notNullable()
      table.integer('resource_id').notNullable()
      table.integer('client_version').notNullable()
      table.integer('server_version').notNullable()
      table.jsonb('client_data').notNullable()
      table.jsonb('server_data').notNullable()
      table.string('resolution', 16).defaultTo('pending')
      table.integer('resolved_by').unsigned().references('id').inTable('users').onDelete('SET NULL')
      table.timestamp('resolved_at').nullable()
      table.timestamp('created_at').defaultTo(this.now())
    })

    // ============================================
    // 3. Table: sync_checkpoints
    // ============================================
    this.schema.createTable('sync_checkpoints', (table) => {
      table.increments('id')
      table.integer('hotel_id').unsigned().notNullable().references('id').inTable('hotels').onDelete('CASCADE')
      table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.string('device_id', 64).notNullable()
      table.string('resource_type', 64).notNullable()
      table.timestamp('last_sync_at').nullable()
      table.bigInteger('last_version').defaultTo(0)
      table.unique(['hotel_id', 'user_id', 'device_id', 'resource_type'])
    })
  }

  async down() {
    this.schema.dropTable('sync_checkpoints')
    this.schema.dropTable('sync_conflicts')
    this.schema.dropTable('sync_operations')
  }
}
