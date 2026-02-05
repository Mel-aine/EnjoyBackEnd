import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'doors'
  protected logsTableName = 'door_access_logs'

  public async up() {
    // Table des portes (Terminaux ZKTeco)
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('name', 255).notNullable()
      table.string('ip_address', 45).notNullable().unique()
      table.integer('port').defaultTo(4370)

      // Relation avec les chambres
      table.integer('room_id').unsigned().nullable()
        .references('id').inTable('rooms')
        .onDelete('SET NULL')

      // Statut et configuration
      table.boolean('is_active').defaultTo(true)
      // Synchronisation
      table.timestamp('last_synced_at', { useTz: true }).nullable()

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      // Index
      table.index('room_id')
      table.index('is_active')
      table.index('last_synced_at')
    })

    // Table des logs d'accès
    this.schema.createTable(this.logsTableName, (table) => {
      table.increments('id').primary()

      table.integer('door_id').unsigned().notNullable()
        .references('id').inTable('doors')
        .onDelete('CASCADE')

      table.string('user_id_on_device', 50).notNullable()

      table.integer('verify_mode').nullable()

      table.integer('in_out_status').nullable()

      table.string('user_name', 255).nullable()

      table.boolean('access_granted').defaultTo(true)

      table.timestamp('access_time', { useTz: true }).notNullable()

      table.timestamp('created_at', { useTz: true }).notNullable()

      // Index pour améliorer les performances
      table.index('door_id')
      table.index('user_id_on_device')
      table.index('access_time')
      table.index(['door_id', 'access_time'])
    })

  }

  public async down() {
    this.schema.dropTable(this.logsTableName)
    this.schema.dropTable(this.tableName)
  }
}
