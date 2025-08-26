import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, belongsTo, manyToMany, computed } from '@adonisjs/lucid/orm'
import type { HasMany, BelongsTo, ManyToMany } from '@adonisjs/lucid/types/relations'
import Reservation from './reservation.js'
import ReservationGuest from './reservation_guest.js'
import Folio from './folio.js'
import User from './user.js'
import Hotel from './hotel.js'


export default class Guest extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare guestCode: string

  @column()
  declare firstName: string

  @column()
  declare lastName: string

  @column()
  declare middleName: string

  @column()
  declare title: string

  @column()
  declare hotelId: number

  @column()
  declare suffix: string

  @column()
  declare email: string

  @column()
  declare phonePrimary: string

  @column()
  declare mobileNumber: string

  @column()
  declare alternatePhone: string

  @column.date()
  declare dateOfBirth: DateTime

  @column()
  declare gender: string

  @column()
  declare nationality: string

  @column()
  declare language: string

  @column()
  declare idType: string

  @column()
  declare idNumber: string

  @column()
  declare addressLine: string

  @column.date()
  declare idExpiryDate: DateTime

  @column()
  declare passportNumber: string

  @column.date()
  declare passportExpiry: DateTime

  @column()
  declare address: string

  @column()
  declare city: string

  @column()
  declare stateProvince: string

  @column()
  declare country: string

  @column()
  declare postalCode: string

  @column()
  declare companyName: string

  @column()
  declare jobTitle: string

  @column()
  declare emergencyContactName: string

  @column()
  declare emergencyContactPhone: string

  @column()
  declare emergencyContactRelation: string

  @column()
  declare specialRequests: string

  @column()
  declare dietaryRestrictions: string

  @column()
  declare accessibility: string

  @column()
  declare preferences: object

  @column()
  declare loyaltyNumber: string

  @column()
  declare loyaltyLevel: string

  @column()
  declare creditLimit: number

  @column()
  declare paymentTerms: string

  @column()
  declare marketingOptIn: boolean

  @column()
  declare communicationPreferences: object

  @column()
  declare blacklisted: boolean

  @column()
  declare blacklistReason: string

  @column()
  declare vipStatus: string

  @column()
  declare vipLevel: string

  @column()
  declare notes: string

  @column()
  declare profileImage: string

  @column.date()
  declare lastStayDate: DateTime

  @column()
  declare totalStays: number

  @column()
  declare totalSpent: number

  @column()
  declare averageRating: number

  @column()
  declare status: string

  @column()
  declare guestType: string

  @column()
  declare fax: string

  @column()
  declare registrationNumber: string

  @column()
  declare visaNumber: string

  @column()
  declare issuingCountry: string

  @column()
  declare issuingCity: string

  @column()
  declare idPhoto: string

  @column()
  declare profilePhoto: string

  @column()
  declare createdBy: number

  @column()
  declare lastModifiedBy: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relationships
  @hasMany(() => Reservation)
  declare reservations: HasMany<typeof Reservation>

  @hasMany(() => ReservationGuest)
  declare reservationGuests: HasMany<typeof ReservationGuest>

  @manyToMany(() => Reservation, {
    pivotTable: 'reservation_guests',
    localKey: 'id',
    pivotForeignKey: 'guest_id',
    relatedKey: 'id',
    pivotRelatedForeignKey: 'reservation_id',
    pivotColumns: [
      'is_primary',
      'guest_type',
      'room_assignment',
      'special_requests',
      'dietary_restrictions',
      'accessibility',
      'emergency_contact',
      'emergency_phone',
      'notes',
    ],
  })
  declare reservationsAsGuest: ManyToMany<typeof Reservation>



  @hasMany(() => Folio)
  declare folios: HasMany<typeof Folio>

  @belongsTo(() => User, { foreignKey: 'createdBy' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'lastModifiedBy' })
  declare modifier: BelongsTo<typeof User>

  @belongsTo(() => Hotel, { foreignKey: 'hotelId' })
  declare hotel: BelongsTo<typeof Hotel>

  // Computed properties
  @computed()
  get fullName() {
    return `${this.firstName} ${this.lastName}`
  }

  @computed()
  get displayName() {
    const parts = [this.title, this.firstName, this.lastName, this.suffix].filter(Boolean)
    return parts.join(' ')
  }

   public static setPreferences(value: unknown): object | null {
    // Si la valeur est une chaîne non vide
    if (typeof value === 'string' && value.length > 0) {
      try {
        // On essaie de la parser.
        return JSON.parse(value)
      } catch (e) {

        console.error('Failed to parse preferences JSON string:', value, e)
        return null
      }
    }


    if (typeof value === 'object' && value !== null) {
      return value
    }

    return null
  }



  }
