import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Hub link columns (Enjoy Connectivity Hub, `connect-hub-backend`).
 *
 * The hub hands a PMS API key to enjoy once, through `POST /api/hub-control/hotels/:id/link`.
 * It is stored per hotel so the control API can push catalog and ARI back to the
 * hub, and the webhook URL the hub sends its booking revisions to.
 */
export default class extends BaseSchema {
  protected tableName = 'hotels'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('hub_property_id').nullable()
      table.text('hub_api_key').nullable()
      table.text('hub_webhook_url').nullable()
      table.timestamp('hub_linked_at', { useTz: true }).nullable()
      table.timestamp('hub_last_push_at', { useTz: true }).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('hub_property_id')
      table.dropColumn('hub_api_key')
      table.dropColumn('hub_webhook_url')
      table.dropColumn('hub_linked_at')
      table.dropColumn('hub_last_push_at')
    })
  }
}
