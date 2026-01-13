import { BaseCommand, args } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'
import FolioService from '#services/folio_service'

export default class UpdateFolioTotalsForList extends BaseCommand {
  public static commandName = 'folio:update:totals'
  public static description = 'Recalculate totals for a comma-separated list of folio IDs'
  public static options: CommandOptions = { startApp: true }

  @args.string({ description: 'Comma-separated folio IDs (e.g. 10,11,12)' })
  declare folioIds: string

  private parseFolioIds(input: string): number[] {
    const tokens = input
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    const ids: number[] = []
    for (const token of tokens) {
      const id = Number(token)
      if (!Number.isFinite(id) || id <= 0) continue
      ids.push(id)
    }
    return [...new Set(ids)]
  }

  public async run() {
    const ids = this.parseFolioIds(this.folioIds ?? '')

    if (!ids.length) {
      this.logger.error('No valid folio IDs provided')
      return
    }

    this.logger.info(`Updating folio totals for ${ids.length} folio(s)...`)

    await db.transaction(async (trx) => {
      for (const folioId of ids) {
        this.logger.info(`Updating folio ${folioId}`)
        await FolioService.updateFolioTotals(folioId, trx)
      }
    })

    this.logger.success(`Done. Updated totals for ${ids.length} folio(s).`)
  }
}

