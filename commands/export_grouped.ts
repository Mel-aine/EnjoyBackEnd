
import { BaseCommand } from '@adonisjs/core/ace'
import fs from 'fs'
import path from 'path'

export default class ExportGrouped extends BaseCommand {
  public static commandName = 'export:grouped'
  public static description = 'Regroupe les données par catégorie logique (ex: bar, snack) et génère un fichier JSON pour chaque'

  public async run() {
    const sourcePath = './data/data-administrations.json'
    const outputDir = './data/categories'

    const categoryMapping: Record<string, string> = {
      "Training": "Training",
      "Public Service": "Public_Service",
      "church": "church",
    }

    // Lire les données JSON
    const data = JSON.parse(fs.readFileSync(sourcePath, 'utf-8'))

    // Organiser par catégorie logique
    const grouped: Record<string, any[]> = {}

    for (const item of data) {
      const original = item.categorie || 'Autre'
      const mapped = categoryMapping[original] || original.toLowerCase().replace(/[^a-z0-9]/gi, '_')
      if (!grouped[mapped]) {
        grouped[mapped] = []
      }
      grouped[mapped].push(item)
    }

    // Créer le dossier de sortie si besoin
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    // Écriture des fichiers
    for (const [cat, items] of Object.entries(grouped)) {
      const filePath = path.join(outputDir, `${cat}.json`)
      fs.writeFileSync(filePath, JSON.stringify(items, null, 2), 'utf-8')
      this.logger.success(`✔ Fichier créé : ${cat}.json (${items.length} éléments)`)
    }

    this.logger.success(`✅ Export terminé : ${Object.keys(grouped).length} fichiers générés.`)
  }
}
