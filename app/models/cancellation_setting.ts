import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import Hotel from '#models/hotel'
import User from '#models/user'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export enum CancellationChargeType {
  FIRST_NIGHT = 'FIRST_NIGHT',
  PERCENTAGE = 'PERCENTAGE',
  FIXED_AMOUNT = 'FIXED_AMOUNT',
  FULL_STAY = 'FULL_STAY',
  FREE = 'FREE',
}

/**
 * Politique d'annulation globale unique de l'établissement.
 * Une seule ligne par hôtel (hotel_id unique).
 */
export default class CancellationSetting extends BaseModel {
  public static table = 'cancellation_settings'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'hotel_id' })
  declare hotelId: number

  /**
   * Délai de franchise en heures avant la date/heure de check-in.
   * Ex: 24 => annulation gratuite jusqu'à 24h avant le check-in.
   */
  @column({ columnName: 'cancellation_free_hours' })
  declare cancellationFreeHours: number

  @column({ columnName: 'cancellation_charge_type' })
  declare cancellationChargeType: CancellationChargeType

  /**
   * Valeur de la pénalité :
   * - PERCENTAGE : pourcentage du séjour (ex: 50, 100)
   * - FIXED_AMOUNT : montant fixe
   * - Ignoré pour FIRST_NIGHT / FULL_STAY / FREE
   */
  @column({ columnName: 'cancellation_charge_value' })
  declare cancellationChargeValue: number | null

  @column({ columnName: 'last_modified_by_user_id' })
  declare lastModifiedByUserId: number | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  // Relationships
  @belongsTo(() => Hotel, { foreignKey: 'hotelId' })
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => User, { foreignKey: 'lastModifiedByUserId' })
  declare lastModifiedBy: BelongsTo<typeof User>
}
