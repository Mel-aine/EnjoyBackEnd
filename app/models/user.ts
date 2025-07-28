import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany, manyToMany, beforeSave } from '@adonisjs/lucid/orm'
import { AccessToken } from '@adonisjs/auth/access_tokens'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'
import type { BelongsTo, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import hash from '@adonisjs/core/services/hash'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import Role from '#models/role'
import Services from '#models/service'
import ServiceUserAssignment from '#models/service_user_assignment'
import Permission from '#models/permission'
import Reservation from '#models/reservation'

const AuthFinder = withAuthFinder(() => hash.use('argon'), {
  uids: ['email'],
  passwordColumnName: 'password',
})

export default class User extends AuthFinder(BaseModel) {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare first_name: string

  @column()
  declare last_name: string

  @column()
  declare email: string

  @column()
  declare nationality: string | null

  @column.dateTime()
  declare last_login: DateTime | null

  @column()
  declare two_factor_enabled: boolean

  @column()
  declare phone_number: string | null

  @column()
  declare address: string

  @column({ serializeAs: null })
  declare password: string

  @column()
  declare status: 'active' | 'inactive' | 'suspended'

  @column()
  declare service_id: string | null

  @column()
  declare role_id: number

  @column()
  declare created_by: number | null

  @column()
  declare last_modified_by: number | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

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
  @belongsTo(() => Role, { foreignKey: 'role_id' })
  declare role: BelongsTo<typeof Role>

  @belongsTo(() => Services, { foreignKey: 'service_id' })
  declare service: BelongsTo<typeof Services>

  @hasMany(() => Services, {
    foreignKey: 'created_by',
  })
  declare services: HasMany<typeof Services>

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
    if (!this.role_id) return false

    await this.load('role' as any, (query) => {
      query.preload('permissions')
    })

    await this.role.load('permissions')

    return this.role.permissions.some((permission) => permission.name === permissionName)
  }

  public async hasAnyPermission(permissions: string[]): Promise<boolean> {
    if (!this.role_id) return false

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

    return assignment?.service_id ?? null
  }
}
