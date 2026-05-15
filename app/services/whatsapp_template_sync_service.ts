import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'
import HotelWhatsappTemplate, { TemplateStatus } from '#models/hotel_whatsapp_template'
import { ENJOY_STANDARD_TEMPLATES, EnjoyTemplateDefinition } from '../types/enjoyTemplates.js'

type MetaTemplateCreateResponse = {
  id: string
  status: TemplateStatus
}

type MetaTemplateListItem = {
  id: string
  name: string
  status: TemplateStatus
  language: string
}

type SyncResult = {
  created: string[]
  skipped: string[]
  failed: string[]
}

export default class WhatsappTemplateSyncService {
  // Credentials centralisés depuis .env
  private get baseUrl() {
    return `${env.get('WHATSAPP_MANAGED_BASE_URL')}/${env.get('WHATSAPP_MANAGED_VERSION')}`
  }

  private get wabaId() {
    return env.get('WHATSAPP_MANAGED_WABA_ID')
  }

  private get accessToken() {
    return env.get('WHATSAPP_MANAGED_TOKEN')
  }

  // ---------------------------------------------------------------------------
  // Public
  // ---------------------------------------------------------------------------

  public async syncHotelTemplates(hotelId: number): Promise<SyncResult> {
    const result: SyncResult = { created: [], skipped: [], failed: [] }

    const existingOnMeta = await this.fetchExistingMetaTemplates()
    const existingNames = new Set(existingOnMeta.map((t) => t.name))

    for (const templateDef of ENJOY_STANDARD_TEMPLATES) {
      try {
        const dbRecord = await HotelWhatsappTemplate.query()
          .where('hotel_id', hotelId)
          .where('template_name', templateDef.name)
          .first()

        // Déjà approuvé → skip
        if (dbRecord?.status === 'APPROVED') {
          logger.info(`[TemplateSyncService] "${templateDef.name}" déjà APPROVED — skipped`)
          result.skipped.push(templateDef.name)
          continue
        }

        // Existe sur Meta mais pas en base → sync statut local
        if (existingNames.has(templateDef.name)) {
          const metaTemplate = existingOnMeta.find((t) => t.name === templateDef.name)!
          await this.upsertLocalTemplate(hotelId, templateDef, metaTemplate.id, metaTemplate.status)
          logger.info(
            `[TemplateSyncService] "${templateDef.name}" déjà sur Meta (${metaTemplate.status}) — sync locale`
          )
          result.skipped.push(templateDef.name)
          continue
        }

        // Créer sur Meta
        const created = await this.createTemplateOnMeta(templateDef)
        await this.upsertLocalTemplate(hotelId, templateDef, created.id, created.status)
        logger.info(
          `[TemplateSyncService] Template "${templateDef.name}" créé (status: ${created.status})`
        )
        result.created.push(templateDef.name)
      } catch (error) {
        logger.error(
          { err: error },
          `[TemplateSyncService] Échec création "${templateDef.name}" pour hotel ${hotelId}`
        )
        result.failed.push(templateDef.name)

        await HotelWhatsappTemplate.query()
          .where('hotel_id', hotelId)
          .where('template_name', templateDef.name)
          .update({ status: 'REJECTED', rejection_reason: error.message })
      }
    }

    logger.info({ hotelId, result }, '[TemplateSyncService] Synchronisation terminée')
    return result
  }

  public async handleStatusWebhook(payload: {
    hotelId: number
    templateName: string
    status: TemplateStatus
    rejectionReason?: string
  }): Promise<void> {
    const { hotelId, templateName, status, rejectionReason } = payload

    await HotelWhatsappTemplate.query()
      .where('hotel_id', hotelId)
      .where('template_name', templateName)
      .update({
        status,
        rejection_reason: rejectionReason ?? null,
        last_synced_at: DateTime.now(),
      })

    logger.info(
      `[TemplateSyncService] Statut mis à jour: hotel=${hotelId} template=${templateName} status=${status}`
    )
  }

  /**
   * Guard à appeler avant tout envoi de message template.
   * Lève une erreur si le template n'est pas APPROVED.
   */
  public async assertTemplateApproved(
    hotelId: number,
    templateName: string
  ): Promise<HotelWhatsappTemplate> {
    const template = await HotelWhatsappTemplate.query()
      .where('hotel_id', hotelId)
      .where('template_name', templateName)
      .firstOrFail()

    if (!template.isApproved) {
      throw new Error(
        `Impossible d'envoyer : template "${templateName}" est "${template.status}". Seuls les templates APPROVED peuvent être utilisés.`
      )
    }

    return template
  }

  // ---------------------------------------------------------------------------
  // Privé — Meta API
  // ---------------------------------------------------------------------------

  private async createTemplateOnMeta(
    templateDef: EnjoyTemplateDefinition
  ): Promise<MetaTemplateCreateResponse> {
    const payload = {
      name: templateDef.name,
      category: templateDef.category,
      language: templateDef.language,
      components: templateDef.components,
    }

    logger.info({ payload: JSON.stringify(payload) }, '[TemplateSyncService] Payload envoyé à Meta')

    const response = await fetch(`${this.baseUrl}/${this.wabaId}/message_templates`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = (await response.json()) as any

    logger.info({ response: JSON.stringify(data) }, '[TemplateSyncService] Réponse Meta complète')

    if (!response.ok) {
      throw new Error(
        `Meta API ${response.status}: ${data?.error?.message ?? JSON.stringify(data)} | error_data: ${JSON.stringify(data?.error)}`
      )
    }

    return data as MetaTemplateCreateResponse
  }

  private async fetchExistingMetaTemplates(): Promise<MetaTemplateListItem[]> {
    const url = new URL(`${this.baseUrl}/${this.wabaId}/message_templates`)
    url.searchParams.set('fields', 'id,name,status,language')
    url.searchParams.set('limit', '100')

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    })

    if (!response.ok) {
      logger.warn('[TemplateSyncService] Impossible de lister les templates Meta')
      return []
    }

    const data = (await response.json()) as any
    return data.data ?? []
  }

  // ---------------------------------------------------------------------------
  // Privé — Base de données
  // ---------------------------------------------------------------------------

  private async upsertLocalTemplate(
    hotelId: number,
    templateDef: EnjoyTemplateDefinition,
    metaTemplateId: string,
    status: TemplateStatus
  ): Promise<HotelWhatsappTemplate> {
    const existing = await HotelWhatsappTemplate.query()
      .where('hotel_id', hotelId)
      .where('template_name', templateDef.name)
      .first()

    if (existing) {
      existing.merge({
        templateId: metaTemplateId,
        status,
        components: templateDef.components,
        lastSyncedAt: DateTime.now(),
      })
      await existing.save()
      return existing
    }

    return HotelWhatsappTemplate.create({
      hotelId,
      templateName: templateDef.name,
      templateId: metaTemplateId,
      category: templateDef.category,
      language: templateDef.language,
      status,
      components: templateDef.components,
      lastSyncedAt: DateTime.now(),
    })
  }
}