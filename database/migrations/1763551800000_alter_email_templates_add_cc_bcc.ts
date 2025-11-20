import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AlterEmailTemplatesAddCcBcc extends BaseSchema {
  protected tableName = 'email_templates'

  public async up () {
    // Add cc and bcc as jsonb arrays, default NULL
    this.schema.raw(`
      ALTER TABLE "${this.tableName}" 
      ADD COLUMN IF NOT EXISTS "cc" jsonb NULL,
      ADD COLUMN IF NOT EXISTS "bcc" jsonb NULL;
    `)
  }

  public async down () {
    this.schema.raw(`
      ALTER TABLE "${this.tableName}" 
      DROP COLUMN IF EXISTS "cc",
      DROP COLUMN IF EXISTS "bcc";
    `)
  }
}