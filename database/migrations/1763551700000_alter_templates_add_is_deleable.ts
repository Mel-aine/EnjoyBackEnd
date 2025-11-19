import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  public async up() {
    const emailTemplatesTable = 'email_templates'
    const templateCategoriesTable = 'template_categories'

    const hasEmailTemplates = await this.schema.hasTable(emailTemplatesTable)
    if (hasEmailTemplates) {
      await this.schema.raw(
        `ALTER TABLE "${emailTemplatesTable}" ADD COLUMN IF NOT EXISTS "is_deleable" boolean NOT NULL DEFAULT true`
      )
    }

    const hasTemplateCategories = await this.schema.hasTable(templateCategoriesTable)
    if (hasTemplateCategories) {
      await this.schema.raw(
        `ALTER TABLE "${templateCategoriesTable}" ADD COLUMN IF NOT EXISTS "is_deleable" boolean NOT NULL DEFAULT true`
      )
    }
  }

  public async down() {
    const emailTemplatesTable = 'email_templates'
    const templateCategoriesTable = 'template_categories'

    const hasEmailTemplates = await this.schema.hasTable(emailTemplatesTable)
    if (hasEmailTemplates) {
      await this.schema.raw(
        `ALTER TABLE "${emailTemplatesTable}" DROP COLUMN IF EXISTS "is_deleable"`
      )
    }

    const hasTemplateCategories = await this.schema.hasTable(templateCategoriesTable)
    if (hasTemplateCategories) {
      await this.schema.raw(
        `ALTER TABLE "${templateCategoriesTable}" DROP COLUMN IF EXISTS "is_deleable"`
      )
    }
  }
}