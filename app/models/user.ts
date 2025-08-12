import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany, manyToMany, beforeSave } from '@adonisjs/lucid/orm'
import { AccessToken } from '@adonisjs/auth/access_tokens'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'
import type { BelongsTo, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import hash from '@adonisjs/core/services/hash'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import Role from '#models/role'
import ServiceUserAssignment from '#models/service_user_assignment'
import Permission from '#models/permission'
import Reservation from '#models/reservation'
import Hotel from '#models/hotel'

const AuthFinder = withAuthFinder(() => hash.use('argon'), {
  uids: ['email'],
  passwordColumnName: 'password',
})

export default class User extends AuthFinder(BaseModel) {
  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'hotel_id' })
  declare hotelId: number

  @column()
  declare username: string

  @column({ serializeAs: null, columnName: 'password_hash' })
  declare passwordHash: string

  @column({ columnName: 'first_name' })
  declare firstName: string

  @column({ columnName: 'last_name' })
  declare lastName: string

  @column()
  declare email: string

  @column({ columnName: 'employee_id' })
  declare employeeId: number | null

  @column({ columnName: 'is_active' })
  declare isActive: boolean

  @column({ columnName: 'preferred_language' })
  declare preferredLanguage: string | null

  @column({ columnName: 'theme_preference' })
  declare themePreference: 'Blue' | 'Black' | 'Silver' | 'SystemDefault' | null

  @column({ columnName: 'is_cdi' })
  declare isCdi: boolean

  @column()
  declare nationality: string | null

  @column.date({ columnName: 'date_of_birth' })
  declare dateOfBirth: DateTime | null

  @column({ columnName: 'place_of_birth' })
  declare placeOfBirth: string | null

  @column()
  declare gender: string | null

  @column()
  declare city: string | null

  @column()
  declare country: string | null

  @column({ columnName: 'emergency_phone' })
  declare emergencyPhone: string | null

  @column({ columnName: 'personal_email' })
  declare personalEmail: string | null

  @column({ columnName: 'social_security_number' })
  declare socialSecurityNumber: string | null

  @column({ columnName: 'national_id_number' })
  declare nationalIdNumber: string | null

  @column({ columnName: 'special_preferences' })
  declare specialPreferences: string | null


  @column.date({ columnName: 'hire_date' })
  declare hireDate: DateTime | null

  @column({ columnName: 'contract_type' })
  declare contractType: string | null

  @column.date({ columnName: 'contract_end_date' })
  declare contractEndDate: DateTime | null

  @column({ columnName: 'data_processing_consent' })
  declare dataProcessingConsent: boolean

  @column.date({ columnName: 'consent_date' })
  declare consentDate: DateTime | null

  @column.dateTime({ columnName: 'last_login' })
  declare lastLogin: DateTime | null

  @column({ columnName: 'two_factor_enabled' })
  declare twoFactorEnabled: boolean

  @column({ columnName: 'phone_number' })
  declare phoneNumber: string | null

  @column()
  declare address: string

  @column({ serializeAs: null })
  declare password: string

  @column()
  declare status: 'active' | 'inactive' | 'suspended'

  @column({ columnName: 'service_id' })
  declare serviceId: string | null

  @column({ columnName: 'role_id' })
  declare roleId: number

  @column({ columnName: 'created_by' })
  declare createdBy: number | null

  @column({ columnName: 'last_modified_by' })
  declare lastModifiedBy: number | null

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updatedAt: DateTime

  // Define accessTokens before the beforeSave hook
  static accessTokens = DbAccessTokensProvider.forModel(User, {
    expiresIn: '30 days',
    prefix: 'ray_',
    table: 'auth_access_tokens',
    type: 'auth_token',
    tokenSecretLength: 40,
  })

  currentAccessToken?: AccessToken

  /** Relation avec le rôle */
  @belongsTo(() => Hotel, { foreignKey: 'hotel_id' })
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => Role, { foreignKey: 'role_id' })
  declare role: BelongsTo<typeof Role>

  @hasMany(() => Hotel, {
    foreignKey: 'created_by',
  })
  declare hotels: HasMany<typeof Hotel>

  @hasMany(() => ServiceUserAssignment, { foreignKey: 'user_id' })
  declare serviceAssignments: HasMany<typeof ServiceUserAssignment>

  @belongsTo(() => User, { foreignKey: 'created_by' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'last_modified_by' })
  declare modifier: BelongsTo<typeof User>

  @hasMany(() => Reservation, { foreignKey: 'user_id' })
  declare reservations: HasMany<typeof Reservation>

  @manyToMany(() => Permission, {
    pivotTable: 'role_permissions',
    pivotForeignKey: 'role_id',
    pivotRelatedForeignKey: 'permission_id',
    pivotColumns: ['role_id'],
  })
  declare permissions: ManyToMany<typeof Permission>

  @beforeSave()
  static async beforeSaveHook(user: User) {
    if (user.$dirty.password) {
      console.log('🔐 [HASH DEBUG] Mot de passe sera haché pour:', user.email)
      // The withAuthFinder mixin will handle the actual hashing
    }
  }

  public async hasPermission(permissionName: string): Promise<boolean> {
    if (!this.roleId) return false

    await this.load('role' as any, (query) => {
      query.preload('permissions')
    })

    await this.role.load('permissions')

    return this.role.permissions.some((permission) => permission.name === permissionName)
  }

  public async hasAnyPermission(permissions: string[]): Promise<boolean> {
    if (!this.roleId) return false

    await this.load('role' as any, (query) => {
      query.preload('permissions')
    })

    await this.role.load('permissions')

    return permissions.some((permission) =>
      this.role.permissions.some((p) => p.name === permission)
    )
  }

  public async getServiceId(): Promise<number | null> {
    const assignment = await ServiceUserAssignment.query().where('user_id', this.id).first()

    return assignment?.hotel_id ?? null
  }
}
