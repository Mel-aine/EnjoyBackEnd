import { createWriteStream, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { DateTime } from 'luxon'
import crypto from 'node:crypto'
import env from '#start/env'
import DocumentTokens from '#models/document_tokens_table'

export default class DocumentTokenService {

  static async store(buffer: Buffer, filename: string, ttlMinutes = 60): Promise<string> {
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

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = DateTime.now().plus({ minutes: ttlMinutes })

    // ✅ Stocker en DB au lieu de la Map
    await DocumentTokens.create({ token, filename, filePath, expiresAt })

    // Nettoyer les tokens expirés en DB
    await this.cleanup()

    const baseUrl = env.get('APP_URL', 'http://localhost:3333').replace(/\/$/, '')
    return `${baseUrl}/documents/pdf/${token}`
  }

  static async resolve(token: string): Promise<{ filePath: string; filename: string } | null> {
    const doc = await DocumentTokens.query()
      .where('token', token)
      .where('expires_at', '>', DateTime.now().toSQL())
      .first()

    if (!doc) return null
    return { filePath: doc.filePath, filename: doc.filename }
  }

  private static async cleanup() {
    await DocumentTokens.query()
      .where('expires_at', '<', DateTime.now().toSQL())
      .delete()
  }
}