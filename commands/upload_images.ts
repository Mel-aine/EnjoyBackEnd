// import { BaseCommand } from '@adonisjs/core/ace'
// import type { CommandOptions } from '@adonisjs/core/types/ace'

// export default class UploadImages extends BaseCommand {
//   static commandName = 'upload:images'
//   static description = ''

//   static options: CommandOptions = {}

//   async run() {
//     this.logger.info('Hello world from "UploadImages"')
//   }
// }

import { BaseCommand } from '@adonisjs/core/ace'
import { readFile, writeFile } from 'fs/promises'
import path from 'path'
import { v2 as cloudinary } from 'cloudinary'


cloudinary.config({
  cloud_name: 'dcyouflk2',
  api_key: '872497377191944',
  api_secret: 'hETu3JwW9WzVr99OxCvIwt3YNA8',
})

export default class UploadImages extends BaseCommand {
  static commandName = 'upload:images'
  static description = 'Upload les images locales vers Cloudinary et met à jour les URLs dans le JSON'

  async run() {
    const inputFile = './data/services_with_coords_updated.json'
    const outputFile = './data/services_with_coords_uploaded.json'

    try {
      this.logger.info('Lecture du fichier JSON...')
      const raw = await readFile(inputFile, 'utf-8')
      const services = JSON.parse(raw)

      for (const service of services) {

        if (service.cover) {
          const coverPath = path.resolve(service.cover)
          try {
            const res = await cloudinary.uploader.upload(coverPath, {
              folder: 'services/covers',
            })
            service.cover = res.secure_url
            this.logger.info(`✅ Cover uploadé pour ${service.nom || 'service inconnu'}`)
          } catch (error: any) {
            console.warn(`⚠️ Erreur upload cover pour ${service.nom}: ${error.message}`)
          }
        }


        if (Array.isArray(service.images)) {
          for (let i = 0; i < service.images.length; i++) {
            const imgPath = path.resolve(service.images[i])
            try {
              const res = await cloudinary.uploader.upload(imgPath, {
                folder: 'services/images',
              })
              service.images[i] = res.secure_url
              this.logger.info(`✅ Image ${i + 1} uploadée pour ${service.nom || 'service inconnu'}`)
            } catch (error: any) {
              console.warn(`⚠️ Erreur upload image ${i + 1} pour ${service.nom}: ${error.message}`)
            }
          }
        }
      }

      await writeFile(outputFile, JSON.stringify(services, null, 2), 'utf-8')
      this.logger.success(`🎯 Fichier mis à jour sauvegardé : ${outputFile}`)
    } catch (error: any) {
      this.logger.error(`❌ Erreur : ${error.message}`)
    }
  }
}
