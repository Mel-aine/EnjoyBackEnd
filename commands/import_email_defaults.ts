import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

import TemplateCategory from '#models/template_category'
import EmailTemplate from '#models/email_template'
import EmailAccount from '#models/email_account'
import { DEFAULT_TEMPLATE_CATEGORIES, DEFAULT_EMAIL_TEMPLATES } from '../app/data/default_email_templates.js'

export default class ImportEmailDefaults extends BaseCommand {
  public static commandName = 'import:email-defaults'
  public static description = 'Seed default template categories and email templates for a specific hotel'
  public static options: CommandOptions = { startApp: true }

  @flags.number({ description: 'Hotel Id to seed defaults for', alias: 'h' })
  declare hotelId: number | undefined

  /**
   * Usage:
   * node ace import:email-defaults --hotelId=3
   */
  public async run() {
    const HOTEL_ID = Number(this.hotelId ?? 3)
    if (!Number.isFinite(HOTEL_ID) || HOTEL_ID <= 0) {
      this.logger.error('Invalid or missing --hotelId flag')
      return
    }

    this.logger.info(`Seeding defaults for hotel ${HOTEL_ID}...`)

    let createdCategories = 0
    let skippedCategories = 0

    for (const category of DEFAULT_TEMPLATE_CATEGORIES) {
      const exists = await TemplateCategory.query()
        .where('hotel_id', HOTEL_ID)
        .where('category', category)
        .where('is_deleted', false)
        .first()

      if (exists) {
        skippedCategories++
        continue
      }
      await TemplateCategory.create({
        hotelId: HOTEL_ID,
        category,
        createdByUserId: null,
        updatedByUserId: null,
        isDeleted: false,
        isDeleable: false,
      })
      createdCategories++
    }

    this.logger.success(`Categories — created: ${createdCategories}, skipped: ${skippedCategories}`)

    let defaultAccount = await EmailAccount.query()
      .where('hotel_id', HOTEL_ID)
      .where('is_default', true)
      .first()

    if (!defaultAccount) {
      defaultAccount = await EmailAccount.query().where('hotel_id', HOTEL_ID).first()
      if (!defaultAccount) {
        this.logger.error(`No email account found for hotel ${HOTEL_ID}. Create one and retry.`)
        this.logger.info('Skipping template seeding due to missing email account.')
      }
    }

    let createdTemplates = 0
    let skippedTemplates = 0

    for (const tpl of DEFAULT_EMAIL_TEMPLATES) {
      const category = await TemplateCategory.query()
        .where('hotel_id', HOTEL_ID)
        .where('category', tpl.category)
        .where('is_deleted', false)
        .first()
      if (!category) {
        this.logger.warning(`Missing category for template '${tpl.name}': ${tpl.category}`)
        continue
      }

      const exists = await EmailTemplate.query()
        .where('hotel_id', HOTEL_ID)
        .where('name', tpl.name)
        .first()
      if (exists) {
        skippedTemplates++
        continue
      }

      if (!defaultAccount) {
        skippedTemplates++
        continue
      }

      await EmailTemplate.create({
        name: tpl.name,
        templateCategoryId: category.id,
        autoSend: tpl.autoSend ?? 'Manual',
        attachment: null,
        emailAccountId: defaultAccount.id,
        scheduleDate: null,
        subject: tpl.subject,
        messageBody: tpl.bodyHtml,
        hotelId: HOTEL_ID,
        isDeleted: false,
        isDeleable: false,
        createdBy: null,
        lastModifiedBy: null,
        cc: null,
        bcc: null,
      })
      createdTemplates++
    }

    this.logger.success(`Templates — created: ${createdTemplates}, skipped: ${skippedTemplates}`)
    this.logger.success('Seeding complete.')
  }
}