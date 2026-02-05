import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'retry_queues'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
     table.increments('id').primary()

      // Références
      table.integer('reservation_id').unsigned().nullable()
      table.foreign('reservation_id').references('reservations.id').onDelete('SET NULL')
      table.integer('door_id').unsigned().nullable()
      table.foreign('door_id').references('doors.id').onDelete('CASCADE')

      // Informations utilisateur
      table.string('user_id_on_device', 50).nullable()
      table.string('card_number', 100).nullable()
      table.string('user_name', 255).nullable()

      // Type d'opération
      table.enum('operation', ['grant', 'revoke']).nullable()

      // Statut de la tâche
      table.enum('status', ['pending', 'processing', 'completed', 'failed'])
        .defaultTo('pending')
        .notNullable()

      // Gestion des retries
      table.integer('retry_count').defaultTo(0).notNullable()
      table.integer('max_retries').defaultTo(5).notNullable()

      // Messages d'erreur
      table.text('error_message').nullable()
      table.text('last_error').nullable()

      // Timestamps
      table.timestamp('last_retry_at').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      // Index pour optimiser les requêtes
      table.index(['status', 'retry_count'], 'idx_queue_status_retry')
      table.index(['door_id'], 'idx_queue_door')
      table.index(['reservation_id'], 'idx_queue_reservation')
      table.index(['created_at'], 'idx_queue_created')
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
