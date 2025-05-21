import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import { AccessToken } from '@adonisjs/auth/access_tokens'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import hash from '@adonisjs/core/services/hash'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import Role from '#models/role'
import Services from '#models/service'


const AuthFinder = withAuthFinder(() => hash.use('scrypt'), {
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

  // @column()
  // declare profile_picture: string | null

  @column.dateTime()
  declare last_login: DateTime | null

  @column()
  declare two_factor_enabled: boolean

  @column()
  declare phone_number: string | null

  @column()
  declare address: string

  @column({ serializeAs: null }) // Masquer le mot de passe dans les réponses
  declare password: string

  @column()
  declare role_id: number

  @column()
  declare service_id: number | null
  @column()
  declare status: 'active' | 'inactive' | 'suspended'

  @column()
  declare created_by: number | null

  @column()
  declare last_modified_by: number | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  /** Relation avec le rôle */
  @belongsTo(() => Role, { foreignKey: 'role_id' })
  declare role: BelongsTo<typeof Role>

  @belongsTo(() => Services, { foreignKey: 'service_id' })
  declare Services: BelongsTo<typeof Services>

  @belongsTo(() => User, { foreignKey: 'created_by' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'last_modified_by' })
  declare modifier: BelongsTo<typeof User>

  static accessTokens = DbAccessTokensProvider.forModel(User, {
    expiresIn: '30 days',
    prefix: 'ray_',
    table: 'auth_access_tokens',
    type: 'auth_token',
    tokenSecretLength: 40,
  })

  currentAccessToken?: AccessToken
}
