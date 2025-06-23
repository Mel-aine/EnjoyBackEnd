// import { BaseCommand } from '@adonisjs/core/ace'
// import type { CommandOptions } from '@adonisjs/core/types/ace'

// export default class EnrichServices extends BaseCommand {
//   static commandName = 'enrich:services'
//   static description = ''

//   static options: CommandOptions = {}

//   async run() {
//     this.logger.info('Hello world from "EnrichServices"')
//   }
// }

import { BaseCommand } from '@adonisjs/core/ace'
import axios from 'axios'
import { readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

export default class EnrichServices extends BaseCommand {
  static commandName = 'services:enrich'
  static description = 'Enrichit les services avec des coordonnées géographiques'

  async run() {
    const inputFile = './data/address.json'
    const outputFile = './data/services_with_address.json'
    const failedFile = './data/failed_geocoding.json'

    if (!existsSync(inputFile)) {
      this.logger.error(`❌ Le fichier d'entrée est introuvable : ${path.resolve(inputFile)}`)
      return
    }

    const cleanAddressParts = (...parts: string[]) => {
      const seen = new Set<string>()
      return parts
        .map(p => p?.replace(/\(.*?\)/g, '').trim())
        .filter(Boolean)
        .filter(p => {
          if (seen.has(p)) return false
          seen.add(p)
          return true
        })
        .join(', ')
    }

    async function getCoordinates(address: string) {
      try {
        const encoded = encodeURIComponent(address)
        const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json`
        const res = await axios.get(url, {
          headers: {
            'User-Agent': 'AdonisGeocoder/1.0',
          },
        })

        if (res.data.length > 0) {
          const loc = res.data[0]
          return { lat: parseFloat(loc.lat), lng: parseFloat(loc.lon) }
        } else {
          return null
        }
      } catch (error: any) {
        console.error('Erreur de géocodage :', address, error.message)
        return null
      }
    }

    const raw = await readFile(inputFile, 'utf-8')
    const services = JSON.parse(raw)
    const failed: any[] = []

    for (let i = 0; i < services.length; i++) {
      const service = services[i]

      const fullAddress = cleanAddressParts(
        service.localisation,
        service.adresse.street,
        service.adresse.city,
        service.adresse.country
      )

      this.logger.info(`📍 Géocodage : ${fullAddress}`)
      let coords = await getCoordinates(fullAddress)

      if (!coords) {
        // Fallback : ville + pays uniquement
        const fallback = cleanAddressParts(service.adresse.city, service.adresse.country)
        console.warn(`⚠️ Échec. Re-tentative avec fallback : ${fallback}`)
        coords = await getCoordinates(fallback)
      }

      if (!coords) {
        console.warn(`⚠️ Aucun résultat pour : ${fullAddress}`)
        failed.push({ ...service, attempted_address: fullAddress })
      }

      service.address_service = {
        text: fullAddress,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
      }

      await new Promise((res) => setTimeout(res, 1000)) // Respect Nominatim : 1 requête/sec
    }

    await writeFile(outputFile, JSON.stringify(services, null, 2), 'utf-8')
    await writeFile(failedFile, JSON.stringify(failed, null, 2), 'utf-8')

    this.logger.success(`✅ Services enrichis sauvegardés dans : ${outputFile}`)
    if (failed.length > 0) {
      console.warn(`⚠️ ${failed.length} adresses non localisées. Voir : ${failedFile}`)
    }
  }
}



// fonctionne
// import { BaseCommand } from '@adonisjs/core/ace'
// import { readFile, writeFile } from 'node:fs/promises'
// import axios from 'axios'

// export default class EnrichServices extends BaseCommand {
//   public static commandName = 'services:enrich'
//   public static description = 'Ajoute les coordonnées GPS aux services à partir de l’adresse'

//   // Pause entre les requêtes pour respecter Nominatim
//   private async sleep(ms: number) {
//     return new Promise(resolve => setTimeout(resolve, ms))
//   }

//   // Nettoyer une chaîne (accents, casse, espaces)
//   private normalize(str?: string | null): string {
//     return str?.normalize('NFD')
//              .replace(/[\u0300-\u036f]/g, '')
//              .toLowerCase()
//              .trim() ?? ''
//   }

//   // Récupérer les coordonnées GPS depuis Nominatim
//   private async getCoordinates(address: string): Promise<{ lat: number, lon: number } | null> {
//     const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`
//     try {
//       const res = await axios.get(url, {
//         headers: {
//           'User-Agent': 'MonApp/1.0 (melaineevans7@gmail.com)'
//         }
//       })

//       if (res.data.length > 0) {
//         return {
//           lat: parseFloat(res.data[0].lat),
//           lon: parseFloat(res.data[0].lon),
//         }
//       } else {
//         console.warn(`Pas de résultat pour : ${address}`)
//         return null
//       }
//     } catch (error: any) {
//       this.logger.error(`Erreur Nominatim pour ${address} : ${error.message}`)
//       return null
//     }
//   }

//   public async run() {
//     // const inputFile = './data/services.json'
//     // const outputFile = './data/services_with_coords.json'
//     const inputFile = './data/address.json'
//     const outputFile = './data/services_with_address.json'

//     type Service = {
//       localisation: string
//       adresse?: {
//         street?: string
//         city?: string | null
//         country?: string | null
//       }
//       [key: string]: any
//     }

//     const raw = await readFile(inputFile, 'utf-8')
//     const services: Service[] = JSON.parse(raw)

//     // Préparer les adresses uniques
//     const uniqueAddresses = Array.from(new Set(
//       services
//         .map(s => {
//           const street = this.normalize(s.adresse?.street)
//           const city = this.normalize(s.adresse?.city)
//           const country = this.normalize(s.adresse?.country)

//           if (city && country) {
//             return street ? `${street}, ${city}, ${country}` : `${city}, ${country}`
//           }

//           return null
//         })
//         .filter((a): a is string => a !== null)
//     ))

//     this.logger.info(`Nombre d’adresses uniques à géocoder : ${uniqueAddresses.length}`)

//     const coordsCache: Record<string, { lat: number, lon: number } | null> = {}

//     // Géocodage
//     for (const address of uniqueAddresses) {
//       this.logger.info(`📍 Géocodage : ${address}`)
//       coordsCache[address] = await this.getCoordinates(address)
//       await this.sleep(1000) // éviter surcharge
//     }

//     // Appliquer coordonnées aux services
//     for (const service of services) {
//       const street = this.normalize(service.adresse?.street)
//       const city = this.normalize(service.adresse?.city)
//       const country = this.normalize(service.adresse?.country)

//       if (!city || !country) {
//         console.warn(`Adresse incomplète pour service: ${service.localisation || 'unknown'}`)
//         service.address_service = {
//           text: null,
//           lat: null,
//           lng: null,
//         }
//         continue
//       }

//       const key = street ? `${street}, ${city}, ${country}` : `${city}, ${country}`
//       const coords = coordsCache[key]

//       service.address_service = {
//         text: key,
//         lat: coords?.lat ?? null,
//         lng: coords?.lon ?? null,
//       }
//     }

//     await writeFile(outputFile, JSON.stringify(services, null, 2), 'utf-8')
//     this.logger.info(`✅ Fichier enrichi sauvegardé : ${outputFile}`)
//   }
// }

