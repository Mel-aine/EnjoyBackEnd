import { BaseCommand } from '@adonisjs/core/ace'
import { promises as fs } from 'fs'
import path from 'path'

export default class CompareJson extends BaseCommand {
  static commandName = 'compare:json'
  public static description = 'Compare et synchronise deux fichiers JSON de traduction'

  public async run() {
    const baseDir = './files'
    const fileEn = path.join(baseDir, 'en.json')
    const fileFr = path.join(baseDir, 'fr.json')
    const outputDiff = path.join(baseDir, 'diff.json')
    const outputFrSynced = path.join(baseDir, 'fr.synced.json')
    const outputEnSynced = path.join(baseDir, 'en.synced.json')

    try {
      const [enContent, frContent] = await Promise.all([
        fs.readFile(fileEn, 'utf-8'),
        fs.readFile(fileFr, 'utf-8'),
      ])

      const enJson = JSON.parse(enContent)
      const frJson = JSON.parse(frContent)

      const onlyInEn: Record<string, string> = {}
      const onlyInFr: Record<string, string> = {}
      const differentValues: Record<string, { en: string; fr: string }> = {}

      // 1. Analyse et comparaison
      for (const key in enJson) {
        if (!(key in frJson)) {
          onlyInEn[key] = enJson[key]
        } else if (enJson[key] !== frJson[key]) {
          differentValues[key] = { en: enJson[key], fr: frJson[key] }
        }
      }

      for (const key in frJson) {
        if (!(key in enJson)) {
          onlyInFr[key] = frJson[key]
        }
      }

      const stats = {
        totalInEN: Object.keys(enJson).length,
        totalInFR: Object.keys(frJson).length,
        onlyInEN: Object.keys(onlyInEn).length,
        onlyInFR: Object.keys(onlyInFr).length,
        differentValues: Object.keys(differentValues).length,
      }

      const diffResult = { onlyInEn, onlyInFr, differentValues, stats }
      await fs.writeFile(outputDiff, JSON.stringify(diffResult, null, 2), 'utf-8')

      // 2. Générer fr.synced.json avec toutes les clés de EN
      const frSynced: Record<string, string> = {}
      for (const key of Object.keys(enJson)) {
        frSynced[key] = key in frJson ? frJson[key] : ''
      }
      await fs.writeFile(outputFrSynced, JSON.stringify(frSynced, null, 2), 'utf-8')

      // 3. Générer en.synced.json avec toutes les clés de FR
      const enSynced: Record<string, string> = {}
      for (const key of Object.keys(frJson)) {
        enSynced[key] = key in enJson ? enJson[key] : ''
      }
      await fs.writeFile(outputEnSynced, JSON.stringify(enSynced, null, 2), 'utf-8')

      this.logger.success('✅ Différences enregistrées dans files/diff.json')
      this.logger.success('✅ fr.synced.json et en.synced.json générés avec clés synchronisées')
    } catch (error) {
      this.logger.error('❌ Erreur : ' + error.message)
    }
  }
}
