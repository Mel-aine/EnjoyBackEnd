// app/services/supabase_service.ts
import { createClient } from '@supabase/supabase-js'
import env from '#start/env'
import { MultipartFile } from '@adonisjs/bodyparser'
import fs from 'node:fs'

interface UploadResult {
  url: string
  path: string
}

export default class SupabaseService {
  private client

  constructor() {
    const supabaseUrl = env.get('SUPABASE_URL')
    const supabaseKey = env.get('SUPABASE_SERVICE_KEY')

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('SUPABASE_URL et SUPABASE_SERVICE_KEY doivent être définis dans .env')
    }

    this.client = createClient(supabaseUrl, supabaseKey)
  }

  /**
   * Convertir le type MIME générique en type spécifique
   */
  private getSpecificMimeType(file: MultipartFile): string {
    const extension = file.extname?.toLowerCase()

    const mimeMap: { [key: string]: string } = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      'bmp': 'image/bmp',
      'ico': 'image/x-icon'
    }

    return mimeMap[extension || ''] || 'image/jpeg' // default to jpeg
  }

  /**
   * Upload un fichier vers Supabase Storage
   */
  public async uploadFile(
    file: MultipartFile,
    bucket: string = 'hotel',
    folder?: string
  ): Promise<UploadResult> {
    try {
      // Vérifier si le fichier existe
      if (!file) {
        throw new Error('Aucun fichier fourni')
      }


      // Vérifier que le fichier temporaire existe
      if (!file.tmpPath || !fs.existsSync(file.tmpPath)) {
        throw new Error('Fichier temporaire non trouvé')
      }

      // Lire le contenu du fichier depuis le chemin temporaire
      const fileBuffer = fs.readFileSync(file.tmpPath)

      // Générer un nom de fichier unique
      const fileExt = file.extname || 'jpg'
      const fileName = `${folder ? `${folder}/` : ''}${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`

      // Obtenir le type MIME spécifique
      const specificMimeType = this.getSpecificMimeType(file)

      // Upload vers Supabase
      const { data, error } = await this.client.storage
        .from(bucket)
        .upload(fileName, fileBuffer, {
          cacheControl: '3600',
          upsert: false,
          contentType: specificMimeType
        })

      if (error) {
        console.error('❌ Supabase upload error:', error)
        throw new Error(`Supabase upload error: ${error.message}`)
      }

      // Récupérer l'URL publique
      const { data: urlData } = this.client.storage
        .from(bucket)
        .getPublicUrl(data.path)

      console.log('✅ File uploaded successfully:', urlData.publicUrl)

      return {
        url: urlData.publicUrl,
        path: data.path
      }

    } catch (error: any) {
      console.error('❌ Upload failed:', error)
      throw new Error(`Failed to upload file: ${error.message}`)
    }
  }

  /**
   * Upload multiple de fichiers
   */
  public async uploadMultipleFiles(
    files: MultipartFile[],
    bucket: string = 'hotel',
    folder?: string
  ): Promise<UploadResult[]> {
    const uploadPromises = files.map(file => this.uploadFile(file, bucket, folder))
    return Promise.all(uploadPromises)
  }

  /**
   * Supprimer un fichier de Supabase Storage
   */
  public async deleteFile(filePath: string, bucket: string = 'hotel'): Promise<void> {
    try {
      const { error } = await this.client.storage
        .from(bucket)
        .remove([filePath])

      if (error) {
        throw new Error(`Supabase delete error: ${error.message}`)
      }
    } catch (error: any) {
      throw new Error(`Failed to delete file: ${error.message}`)
    }
  }

  /**
   * Extraire le chemin du fichier depuis l'URL Supabase
   */
  public extractFilePathFromUrl(url: string, bucket: string = 'hotel'): string {
    try {
      const urlObj = new URL(url)
      const pathParts = urlObj.pathname.split('/')

      // Format Supabase: /storage/v1/object/public/BUCKET_NAME/FILE_PATH
      const bucketIndex = pathParts.indexOf(bucket)
      if (bucketIndex !== -1) {
        return pathParts.slice(bucketIndex + 1).join('/')
      }

      // Fallback
      return pathParts.slice(-1)[0] || ''
    } catch (error: any) {
      throw new Error('URL Supabase invalide')
    }
  }
}
