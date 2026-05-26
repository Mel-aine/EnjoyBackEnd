import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'
import HotelWhatsappTemplate, { TemplateStatus } from '#models/hotel_whatsapp_template'
import { ENJOY_STANDARD_TEMPLATES, EnjoyTemplateDefinition } from '../types/enjoyTemplates.js'
import Hotel from '#models/hotel'

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

type WhatsappCredentials = {
  baseUrl: string
  wabaId: string
  accessToken: string
}

export default class WhatsappTemplateSyncService {

  // ---------------------------------------------------------------------------
  // Credentials — managed par défaut, custom si l'hôtel a les siens
  // ---------------------------------------------------------------------------

  private async getCredentials(hotelId?: number): Promise<WhatsappCredentials> {
    if (hotelId) {
      const hotel = await Hotel.query()
        .where('id', hotelId)
        .where('whatsapp_enabled', true)
        .firstOrFail()

      if (hotel.whatsappProviderType === 'meta' && hotel.whatsappConfig?.accessToken) {
        return {
          baseUrl: `${hotel.whatsappConfig.baseUrl}/${hotel.whatsappConfig.version}`,
          wabaId: hotel.whatsappConfig.wabaId,
          accessToken: hotel.whatsappConfig.accessToken,
        }
      }
    }

    return {
      baseUrl: `${env.get('WHATSAPP_MANAGED_BASE_URL')}/${env.get('WHATSAPP_MANAGED_VERSION')}`,
      wabaId: env.get('WHATSAPP_MANAGED_WABA_ID') || '',
      accessToken: env.get('WHATSAPP_MANAGED_TOKEN') || '',
    }
  }

  // ---------------------------------------------------------------------------
  // Public — Sync
  // ---------------------------------------------------------------------------

  public async syncTemplates(hotelId?: number): Promise<SyncResult> {
    const result: SyncResult = { created: [], skipped: [], failed: [] }

    const credentials = await this.getCredentials(hotelId)
    const existingOnMeta = await this.fetchExistingMetaTemplates(credentials)
    const existingNames = new Set(existingOnMeta.map((t) => t.name))

    for (const templateDef of ENJOY_STANDARD_TEMPLATES) {
      try {
        // Si déjà APPROVED en base → skip
        const dbRecord = await HotelWhatsappTemplate.query()
          .where('template_name', templateDef.name)
          .first()

        if (dbRecord?.status === 'APPROVED') {
          logger.info(`[TemplateSyncService] "${templateDef.name}" déjà APPROVED — skipped`)
          result.skipped.push(templateDef.name)
          continue
        }

        if (existingNames.has(templateDef.name)) {
          // Existe sur Meta → sync local uniquement
          const metaTemplate = existingOnMeta.find((t) => t.name === templateDef.name)!
          await this.upsertTemplate(templateDef, metaTemplate.id, metaTemplate.status)
          logger.info(`[TemplateSyncService] "${templateDef.name}" déjà sur Meta (${metaTemplate.status}) — sync locale`)
          result.skipped.push(templateDef.name)
          continue
        }

        // N'existe pas sur Meta → on le crée
        const created = await this.createTemplateOnMeta(templateDef, credentials)
        await this.upsertTemplate(templateDef, created.id, created.status)
        logger.info(`[TemplateSyncService] "${templateDef.name}" créé (status: ${created.status})`)
        result.created.push(templateDef.name)

      } catch (error: any) {
        logger.error({ err: error }, `[TemplateSyncService] Échec "${templateDef.name}"`)
        result.failed.push(templateDef.name)
      }
    }

    logger.info({ hotelId: hotelId ?? 'managed', result }, '[TemplateSyncService] Sync terminée')
    return result
  }

  // ---------------------------------------------------------------------------
  // Public — Webhook statut Meta
  // ---------------------------------------------------------------------------

  public async handleStatusWebhook(payload: {
    templateName: string
    status: TemplateStatus
    rejectionReason?: string
  }): Promise<void> {
    const { templateName, status, rejectionReason } = payload

    await HotelWhatsappTemplate.query()
      .where('template_name', templateName)
      .update({
        status,
        rejection_reason: rejectionReason ?? null,
        last_synced_at: DateTime.now(),
      })

    logger.info(`[TemplateSyncService] Statut mis à jour: template=${templateName} status=${status}`)
  }

  // ---------------------------------------------------------------------------
  // Public — Guard avant envoi
  // ---------------------------------------------------------------------------

  public async assertTemplateApproved(templateName: string): Promise<HotelWhatsappTemplate> {
    const template = await HotelWhatsappTemplate.query()
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

  private async fetchExistingMetaTemplates(credentials: WhatsappCredentials): Promise<MetaTemplateListItem[]> {
    const url = new URL(`${credentials.baseUrl}/${credentials.wabaId}/message_templates`)
    url.searchParams.set('fields', 'id,name,status,language')
    url.searchParams.set('limit', '100')

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${credentials.accessToken}` },
    })

    if (!response.ok) {
      logger.warn('[TemplateSyncService] Impossible de lister les templates Meta')
      return []
    }

    const data = (await response.json()) as any
    return data.data ?? []
  }

  private async createTemplateOnMeta(
    templateDef: EnjoyTemplateDefinition,
    credentials: WhatsappCredentials
  ): Promise<MetaTemplateCreateResponse> {
    const payload = {
      name: templateDef.name,
      category: templateDef.category,
      language: templateDef.language,
      components: templateDef.components,
    }

    logger.info({ payload: JSON.stringify(payload) }, '[TemplateSyncService] Payload envoyé à Meta')

    const response = await fetch(`${credentials.baseUrl}/${credentials.wabaId}/message_templates`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = (await response.json()) as any
    logger.info({ response: JSON.stringify(data) }, '[TemplateSyncService] Réponse Meta complète')

    if (!response.ok) {
      throw new Error(`Meta API ${response.status}: ${data?.error?.message ?? JSON.stringify(data)}`)
    }

    return data as MetaTemplateCreateResponse
  }


  // Dans WhatsappTemplateSyncService

  public async refreshStatuses(hotelId?: number): Promise<{ updated: string[]; unchanged: string[] }> {
    const result = { updated: [], unchanged: [] } as { updated: string[]; unchanged: string[] }

    const credentials = await this.getCredentials(hotelId)
    const existingOnMeta = await this.fetchExistingMetaTemplates(credentials)

    const dbTemplates = await HotelWhatsappTemplate.query()

    for (const dbTemplate of dbTemplates) {
      const metaTemplate = existingOnMeta.find((t) => t.name === dbTemplate.templateName)

      if (!metaTemplate) {
        logger.warn(`[TemplateSyncService] "${dbTemplate.templateName}" introuvable sur Meta`)
        continue
      }

      if (metaTemplate.status !== dbTemplate.status) {
        logger.info(
          `[TemplateSyncService] "${dbTemplate.templateName}" status: ${dbTemplate.status} → ${metaTemplate.status}`
        )
        dbTemplate.status = metaTemplate.status
        dbTemplate.lastSyncedAt = DateTime.now()
        await dbTemplate.save()
        result.updated.push(dbTemplate.templateName)
      } else {
        result.unchanged.push(dbTemplate.templateName)
      }
    }

    logger.info({ result }, '[TemplateSyncService] Refresh statuts terminé')
    return result
  }
  // ---------------------------------------------------------------------------
  // Privé — Base de données
  // ---------------------------------------------------------------------------

  private async upsertTemplate(
    templateDef: EnjoyTemplateDefinition,
    metaTemplateId: string,
    status: TemplateStatus
  ): Promise<HotelWhatsappTemplate> {
    return HotelWhatsappTemplate.updateOrCreate(
      { templateName: templateDef.name },
      {
        templateId: metaTemplateId,
        category: templateDef.category,
        language: templateDef.language,
        status,
        components: templateDef.components,
        lastSyncedAt: DateTime.now(),
      }
    )
  }
}