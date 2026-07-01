import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export type TemplateStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED' | 'DISABLED'

export type TemplateComponent = {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS'
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'
  text?: string
  example?: any
  buttons?: Array<{
    type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'
    text: string
    url?: string
    phone_number?: string
    example?: string[] | any
  }>
}


export default class HotelWhatsappTemplate extends BaseModel {
  @column({ isPrimary: true })
  declare id: number


  @column()
  declare templateName: string

  @column()
  declare templateId: string | null

  @column()
  declare category: string

  @column()
  declare language: string

  @column()
  declare status: TemplateStatus

  @column()
  declare rejectionReason: string | null

  @column({
  
    prepare: (value) => value ? JSON.stringify(value) : null,
    consume: (value) => typeof value === 'string' ? JSON.parse(value) : value
  })
  declare components: TemplateComponent[] | null

  @column.dateTime()
  declare lastSyncedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime



  /**
   * Guard : empêche tout envoi si le template n'est pas APPROVED
   */
  public get isApproved(): boolean {
    return this.status === 'APPROVED'
  }
}