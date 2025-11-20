import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'email_accounts'

  public async up() {
    const hasTable = await this.schema.hasTable(this.tableName)
    if (!hasTable) return

    // Use raw SQL with IF NOT EXISTS for resilience across environments
    await this.schema.raw(
      `ALTER TABLE "${this.tableName}" ADD COLUMN IF NOT EXISTS "status" varchar(255) NOT NULL DEFAULT 'pending'`
    )
    await this.schema.raw(
      `ALTER TABLE "${this.tableName}" ADD COLUMN IF NOT EXISTS "is_default" boolean NOT NULL DEFAULT false`
    )
  }

  public async down() {
    const hasTable = await this.schema.hasTable(this.tableName)
    if (!hasTable) return

    await this.schema.raw(
      `ALTER TABLE "${this.tableName}" DROP COLUMN IF EXISTS "status"`
    )
    await this.schema.raw(
      `ALTER TABLE "${this.tableName}" DROP COLUMN IF EXISTS "is_default"`
    )
  }
}