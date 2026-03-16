import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.raw(`
      ALTER TABLE subscriptions
      DROP CONSTRAINT IF EXISTS subscriptions_status_check;
    `)

    this.schema.raw(`
      ALTER TABLE subscriptions
      ADD CONSTRAINT subscriptions_status_check
      CHECK (status IN ('active', 'past_due', 'canceled', 'ended'));
    `)
  }

  async down() {
    this.schema.raw(`
      ALTER TABLE subscriptions
      DROP CONSTRAINT IF EXISTS subscriptions_status_check;
    `)

    this.schema.raw(`
      ALTER TABLE subscriptions
      ADD CONSTRAINT subscriptions_status_check
      CHECK (status IN ('active', 'past_due', 'canceled'));
    `)
  }
}
