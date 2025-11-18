import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, beforeSave, afterCreate, afterUpdate } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Hotel from './hotel.js'
import MailjetService from '#services/mailjet_service'
import LoggerService from '#services/logger_service'

export default class EmailAccount extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotelId: number

  @column()
  declare title: string

  @column()
  declare emailAddress: string

  @column()
  declare displayName: string

  @column()
  declare signature: string

  @column()
  declare status: 'pending' | 'verify'

  @column()
  declare isActive: boolean

  @column()
  declare isDefault: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @column()
  declare createdBy: number | null

  @column()
  declare lastModifiedBy: number | null

  @belongsTo(() => Hotel)
  declare hotel: BelongsTo<typeof Hotel>

  @beforeSave()
  public static async enforceSingleDefault(model: EmailAccount) {
    const changed = model.$dirty && Object.prototype.hasOwnProperty.call(model.$dirty, 'isDefault')
    if (!changed) return
    if (model.isDefault) {
      await EmailAccount.query()
        .where('hotel_id', model.hotelId)
        .whereNot('id', model.id || 0)
        .update({ is_default: false })
    }
  }

  @afterCreate()
  public static async syncMailjetAfterCreate(model: EmailAccount) {
    try {
      await MailjetService.ensureSender(model.emailAddress, model.displayName)
      await MailjetService.createOrUpdateContact(model.emailAddress, model.displayName)
      if (model.status === 'pending') {
        await MailjetService.sendVerification(model.emailAddress, {
          displayName: model.displayName,
          hotelId: model.hotelId,
        })
        if (model.createdBy) {
          await LoggerService.logActivity({
            userId: model.createdBy,
            action: 'MAILJET_VERIFICATION_SENT',
            resourceType: 'EmailAccount',
            resourceId: model.id,
            hotelId: model.hotelId,
            details: { email: model.emailAddress, status: model.status }
          })
        }
      }
      if (model.createdBy) {
        await LoggerService.logActivity({
          userId: model.createdBy,
          action: 'MAILJET_SENDER_REGISTERED',
          resourceType: 'EmailAccount',
          resourceId: model.id,
          hotelId: model.hotelId,
          details: { email: model.emailAddress }
        })
      }
      if (model.createdBy) {
        await LoggerService.logActivity({
          userId: model.createdBy,
          action: 'MAILJET_CONTACT_SYNC',
          resourceType: 'EmailAccount',
          resourceId: model.id,
          hotelId: model.hotelId,
          details: { email: model.emailAddress }
        })
      }
    } catch (error) {
      console.error('Mailjet sync after create failed:', error)
    }
  }

  @afterUpdate()
  public static async syncMailjetAfterUpdate(model: EmailAccount) {
    try {
      await MailjetService.ensureSender(model.emailAddress, model.displayName)
      await MailjetService.createOrUpdateContact(model.emailAddress, model.displayName)
      // Only resend verification when still pending
      if (model.status === 'pending') {
        await MailjetService.sendVerification(model.emailAddress, {
          displayName: model.displayName,
          hotelId: model.hotelId,
        })
        if (model.lastModifiedBy) {
          await LoggerService.logActivity({
            userId: model.lastModifiedBy,
            action: 'MAILJET_VERIFICATION_SENT',
            resourceType: 'EmailAccount',
            resourceId: model.id,
            hotelId: model.hotelId,
            details: { email: model.emailAddress, status: model.status }
          })
        }
      }
      if (model.lastModifiedBy) {
        await LoggerService.logActivity({
          userId: model.lastModifiedBy,
          action: 'MAILJET_SENDER_REGISTERED',
          resourceType: 'EmailAccount',
          resourceId: model.id,
          hotelId: model.hotelId,
          details: { email: model.emailAddress }
        })
      }
      if (model.lastModifiedBy) {
        await LoggerService.logActivity({
          userId: model.lastModifiedBy,
          action: 'MAILJET_CONTACT_SYNC',
          resourceType: 'EmailAccount',
          resourceId: model.id,
          hotelId: model.hotelId,
          details: { email: model.emailAddress }
        })
      }
    } catch (error) {
      console.error('Mailjet sync after update failed:', error)
    }
  }
}