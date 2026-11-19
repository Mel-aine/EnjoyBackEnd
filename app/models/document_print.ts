import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import type { PrintReference } from '#services/print_layout'

export default class DocumentPrint extends BaseModel {
  static table = 'document_prints'

  @column({ isPrimary: true }) declare id: string
  @column() declare printNumber: string
  @column.dateTime() declare createdAt: DateTime
  @column() declare userId: number | null
  @column() declare hotelId: number | null
  @column() declare reservationId: number | null
  @column() declare folioId: number | null
  @column() declare data: Record<string, any>
  @column() declare reference: PrintReference
  @column() declare documentType: string
  @column() declare template: string
  @column() declare language: string
  @column() declare operationId: string | null
  @column() declare sha256: string
  @column({ serializeAs: null }) declare pdfData: Buffer
}
