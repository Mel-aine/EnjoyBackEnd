import { BaseCommand } from '@adonisjs/core/ace'
import { readFile, writeFile } from 'fs/promises'

export default class InjectCoords extends BaseCommand {
  static commandName = 'inject:coords'
  static description = 'Injecte les coordonnées dans les services depuis address.json'

  async run() {
    const serviceFile = './data/services_with_coords.json'
    const addressFile = './data/services_with_address.json'
    const outputFile = './data/services_with_coords_updated.json'

    try {
      console.log('📂 Lecture des fichiers JSON...')
      const [servicesRaw, addressesRaw] = await Promise.all([
        readFile(serviceFile, 'utf-8'),
        readFile(addressFile, 'utf-8'),
      ])

      console.log('🔄 Parsing JSON...')
      const services = JSON.parse(servicesRaw)
      const addresses = JSON.parse(addressesRaw)

      // Crée une Map par nom de service (normalisé)
      const addressMap = new Map<string, any>()
      for (const addr of addresses) {
        if (typeof addr.nom === 'string' && addr.address_service) {
          addressMap.set(addr.nom.trim().toLowerCase(), addr.address_service)
        }
      }
      console.log(`🗺️  Coordonnées disponibles pour ${addressMap.size} services (par nom).`)

      let updatedCount = 0
      let missingNameCount = 0

      for (const service of services) {
        if (typeof service.nom !== 'string' || service.nom.trim() === '') {
          console.warn(`⚠️ Nom manquant ou invalide pour un service`)
          missingNameCount++
          continue
        }

        const normalizedNom = service.nom.trim().toLowerCase()
        const addrService = addressMap.get(normalizedNom)

        if (addrService) {
          // Remplace complètement address_service par celle du fichier addresses
          service.address_service = addrService
          updatedCount++
          console.info(`✅ Coordonnées injectées pour : ${service.nom}`)
        } else {
          console.warn(`⚠️ Aucun address_service trouvé pour le nom : ${service.nom}`)
        }
      }

      await writeFile(outputFile, JSON.stringify(services, null, 2), 'utf-8')
      console.log(`🎯 Fichier mis à jour sauvegardé : ${outputFile}`)
      console.log(`📈 Résumé : ${updatedCount} services mis à jour, ${missingNameCount} sans nom valide.`)
    } catch (error: any) {
      console.error(`❌ Erreur : ${error.message}`)
    }
  }
}
