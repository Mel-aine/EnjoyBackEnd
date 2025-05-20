import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Service from '#models/service'

export default class Supplier extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare service_id: number

  @column()
  declare email: string

  @column()
  declare phone: string

  // @column()
  // declare website: string | null

  @column()
  declare address: string | null

  // @column()
  // declare category?: string

  // @column()
  // declare description: string | null

  // // Statut actif/inactif
  // @column()
  // declare status?: 'active' | 'inactive'

  // // Horaires d’ouverture éventuels (si applicable)
  // @column()
  // declare openings: string | null // JSON stringifié

  // // Méthodes de paiement acceptées (Mobile Money, Carte, etc.)
  // @column()
  // declare paymentMethods: string | null // JSON stringifié

  @belongsTo(() => Service, { foreignKey: 'service_id' })
  declare service: BelongsTo<typeof Service>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
