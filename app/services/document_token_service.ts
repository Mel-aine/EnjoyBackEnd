// app/services/document_token_service.ts
import { createWriteStream, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { DateTime } from 'luxon'
import crypto from 'node:crypto'
import env from '#start/env'

type DocumentRecord = {
  filePath: string
  filename: string
  expiresAt: DateTime
}

// Store en mémoire — remplacer par Redis/DB en production
const store = new Map<string, DocumentRecord>()

export default class DocumentTokenService {

  static async store(buffer: Buffer, filename: string, ttlMinutes = 60): Promise<string> {
    // Sauvegarder le fichier
    const uploadDir = join(process.cwd(), 'storage', 'tmp', 'documents')
    mkdirSync(uploadDir, { recursive: true })

    const filePath = join(uploadDir, filename)
    await new Promise<void>((resolve, reject) => {
      const stream = createWriteStream(filePath)
      stream.write(buffer)
      stream.end()
      stream.on('finish', resolve)
      stream.on('error', reject)
    })

    // Générer un token sécurisé
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = DateTime.now().plus({ minutes: ttlMinutes })

    store.set(token, { filePath, filename, expiresAt })

    // Nettoyer les tokens expirés
    this.cleanup()

    const baseUrl = env.get('APP_URL', 'http://localhost:3333').replace(/\/$/, '')
    return `${baseUrl}/documents/pdf/${token}`
  }

  static async resolve(token: string): Promise<DocumentRecord | null> {
    const doc = store.get(token)
    if (!doc) return null
    if (DateTime.now() > doc.expiresAt) {
      store.delete(token)
      return null
    }
    return doc
  }

  private static cleanup() {
    const now = DateTime.now()
    for (const [token, doc] of store.entries()) {
      if (now > doc.expiresAt) store.delete(token)
    }
  }
}