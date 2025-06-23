import { BaseCommand } from '@adonisjs/core/ace'
import fs from 'fs'

export default class FilterService extends BaseCommand {
  public static commandName = 'filter:service'
  public static description = 'Filtrer les adresses sans lat/lng et sauvegarder dans un fichier'

  public async run() {
    try {
      const inputPath = './data/services_with_coords.json'
      const outputPath = './data/address'

      this.logger.info(`Lecture du fichier : ${inputPath}`)
      const rawData = fs.readFileSync(inputPath, 'utf-8')
      const data = JSON.parse(rawData)

      const filtered = data.filter((item:any) => {
        const addr = item.address_service
        return addr && addr.lat === null && addr.lng === null
      })

      fs.writeFileSync(outputPath, JSON.stringify(filtered, null, 2), 'utf-8')
      this.logger.info(`Filtrage terminé. Résultat sauvegardé dans : ${outputPath}`)
    } catch (error) {
      this.logger.error('Erreur durant la commande:', error)
    }
  }
}
