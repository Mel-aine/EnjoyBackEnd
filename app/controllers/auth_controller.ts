import { HttpContext } from '@adonisjs/core/http'
import hash from '@adonisjs/core/services/hash'
//import app from '@adonisjs/core/services/app'
import { cuid, Secret } from '@adonisjs/core/helpers'
import vine from '@vinejs/vine'
import User from '#models/user'
import LoggerService from '#services/logger_service'
import RolePermission from '#models/role_permission'
import BookingSource from '#models/booking_source'
import BusinessSource from '#models/business_source'
import ReservationType from '#models/reservation_type'
import Currency from '../models/currency.js'

export default class AuthController {
  // Fonction auxiliaire pour envoyer des réponses d'erreur
  private responseError(message: string, statusCode: number, errors?: any) {
    return {
      status: 'error',
      message,
      errors,
      statusCode,
    }
  }

  // Fonction auxiliaire pour envoyer des réponses de succès
  private response(message: string, data?: any) {
    return {
      status: 'success',
      message,
      data,
    }
  }

  // Connexion
  async login(ctx: HttpContext) {
    const { request } = ctx
    const { email, password } = request.only(['email', 'password'])

    try {
      const user = await User.findBy('email', email)
      if (!user) return this.responseError('Invalid credentials', 401)

      const login = await hash.verify(password, user.password)
      if (!login) return this.responseError('Invalid credentials', 401)

      // Crée un access token (pour les requêtes API) et un refresh token dédié
      const accessToken = await User.accessTokens.create(user, ['*'], { name: email ?? cuid(), expiresIn: '10m' })
      const refreshToken = await User.accessTokens.create(user, ['refresh'], { name: `refresh:${email ?? cuid()}` })

      await LoggerService.log({
        actorId: user.id,
        action: 'LOGIN',
        entityType: 'User',
        entityId: user.id.toString(),
        description: `Connexion de l'utilisateur ${email}`,
        ctx: ctx,
      })

      // Place le refresh_token en cookie httpOnly
      const refreshValue = (refreshToken as any)?.value || (refreshToken as any)?.token || String(refreshToken)
      ctx.response.cookie('refresh_token', refreshValue, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/api/refresh-token',
        maxAge: 7 * 24 * 60 * 60, // 7 jours
      })

      return this.response('Login successfully', { user, user_token: accessToken, access_token: accessToken, refresh_token: refreshToken })
    } catch (error: any) {
      return this.responseError('Invalid credentials', 400)
    }
  }

  // Récupérer les informations de l'utilisateur
  async user({ auth }: HttpContext) {
    const user = await auth.authenticate()
    this.response('User retrieved successfully', user)
  }



  public async signin(ctx: HttpContext) {
    const { request, response } = ctx
    const { email } = request.only(['email', 'password'])

    console.log('📩 Requête de connexion reçue:', { email })

    try {
      const user = await User.query().where('email', email).preload('role').firstOrFail()
      console.log('✅ Utilisateur trouvé:', user.id, user.email)

      const passwordValid = true // ⚠️ à remplacer par une vraie vérification
      console.log('🔑 Vérification mot de passe:', passwordValid)

      if (!passwordValid) {
        console.warn('❌ Mot de passe invalide pour:', email)
        return response.unauthorized({ message: 'Invalid credentials' })
      }

      // Génère un access token (API) et un refresh token séparé
      const accessToken = await User.accessTokens.create(user, ['*'], { name: email, expiresIn: '2m' })
      const refreshToken = await User.accessTokens.create(user, ['refresh'], { name: `refresh:${email}` })
      console.log('🪪 Tokens générés:', { accessToken, refreshToken })


      await LoggerService.log({
        actorId: user.id,
        action: 'LOGIN',
        entityType: 'User',
        entityId: user.id.toString(),
        description: `Connexion de l'utilisateur ${email}`,
        ctx: ctx,
      })
      console.log('📝 Log enregistré dans LoggerService')

      // Place le refresh_token en cookie httpOnly
      const refreshValue = (refreshToken as any)?.value || (refreshToken as any)?.token || String(refreshToken)
      response.cookie('refresh_token', refreshValue, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/api/refresh-token',
        maxAge: 7 * 24 * 60 * 60, // 7 jours
      })

      return response.ok({
        message: 'Login successful',
        data: {
          user,
          user_token: accessToken,
          access_token: accessToken,
          refresh_token: refreshToken,
        },
      })
    } catch (error) {
      if (error.code === 'E_ROW_NOT_FOUND') {
        console.warn('❌ Utilisateur introuvable:', email)
        return response.unauthorized({ message: 'Invalid credentials' })
      }
      console.error('🔥 Erreur lors de la connexion:', error)
      return response.badRequest({ message: 'Login failed' })
    }
  }

  public async initSpace(ctx: HttpContext) {
    const { request, response } = ctx
    const { userId } = request.only(['userId']);
    try {
      const user = await User.query().where('id', userId).preload('role').firstOrFail()
      const assignments = await user
        .related('serviceAssignments')
        .query()
        .preload('role')
        .preload('hotel')


      const detailedPermissions = await Promise.all(assignments.map(async (assignment) => {
        const hotel = assignment.hotel
        const role = assignment.role

        const rolePermissions = await RolePermission
          .query()
          .where('role_id', role.id)
          .andWhere('hotel_id', hotel.id)
          .preload('permission')

        const permissions = rolePermissions.map((rp) => ({
          id: rp.permission.id,
          name: rp.permission.name,
          description: rp.permission.label,
        }))

        return {
          service: {
            id: hotel.id,
            name: hotel.hotelName,
            category: hotel.hotelCode,
          },
          role: {
            name: role.roleName,
            description: role.description,
          },
          permissions,
        }
      }))

      const filteredPermissions = detailedPermissions.filter((p) => p !== null)
      console.log('✅ Permissions détaillées filtrées:', filteredPermissions.length)

      const userServices = assignments
        .map((assignment) => assignment.hotel)
        .filter((service) => service !== null)


      const hotelIds = userServices.map(h => h.id)

      const [
        bookingSources,
        businessSources,
        reservationTypes,
        currencies,
      ] = await Promise.all([
        BookingSource.query().whereIn('hotel_id', hotelIds),
        BusinessSource.query().whereIn('hotel_id', hotelIds).where('isDeleted', false),
        ReservationType.query().whereIn('hotel_id', hotelIds).where('isDeleted', false),
        Currency.query().whereIn('hotel_id', hotelIds).where('isDeleted', false),
      ])

      console.log('💱 Currencies:', currencies.length)

      await LoggerService.log({
        actorId: user.id,
        action: 'SETUP',
        entityType: 'User',
        entityId: user.id.toString(),
        description: `Connexion de l'utilisateur ${user.email}`,
        ctx: ctx,
      })
      console.log('📝 Log enregistré dans LoggerService')

      return response.ok({
        message: 'Space initialized successfully',
        data: {
          user,
          userServices,
          permissions: filteredPermissions,
          bookingSources,
          businessSources,
          reservationTypes,
          currencies
        },
      })
    } catch (error: any) {
      if (error.code === 'E_ROW_NOT_FOUND') {
        console.warn('❌ Utilisateur introuvable:', userId)
        return response.unauthorized({ message: 'Invalid credentials' })
      }
      console.error('🔥 Erreur lors de la connexion:', error)
      return response.badRequest({ message: 'Login failed' })
    }
  }



  public async update_user({ auth, request, response }: HttpContext) {
    try {
      const user = await auth.authenticate()

      const userId = Number(request.param('id'))
      if (user.id !== userId) {
        return response
          .status(403)
          .send({ message: 'You do not have permission to update this user.' })
      }

      const userToUpdate = await User.findOrFail(userId)
      const payload = request.body()

      console.log('Reçu du frontend :', payload)

      const validator = vine.compile(
        vine.object({
          name: vine.string().optional(),
          email: vine.string().email().optional(),
          password: vine.string().minLength(8).maxLength(32).confirmed().optional(),
        })
      )

      const output = await validator.validate(payload)
      console.log('Après validation VINE :', output)

      if (output.email && output.email !== userToUpdate.email) {
        const existing = await User.findBy('email', output.email)
        if (existing) {
          return response.status(409).send({ message: 'Email already in use.' })
        }
        userToUpdate.email = output.email
      }

      if (output.password) {
        userToUpdate.password = await hash.make(output.password)
        console.log('Mot de passe haché et prêt à être sauvegardé.')
      }

      await userToUpdate.save()
      console.log('Utilisateur mis à jour dans la base de données.')

      return response.status(200).send({
        message: 'User updated successfully',
        data: userToUpdate,
      })
    } catch (error) {
      console.error(error)
      return response.status(422).send({
        message: 'Validation failed',
        errors: error.messages || error.message,
      })
    }
  }

  // Rafraîchir le token via un Refresh Token
  // Priorité: Authorization Bearer. Fallback: cookie httpOnly 'refresh_token'.
  // async refresh_token({ auth, request, response }: HttpContext) {
  //   let user: User
  //   let current: any

  //   // 1) Essai via Authorization Bearer
  //   try {
  //     user = await auth.authenticate()
  //     current = user.currentAccessToken
  //   } catch {
  //     // 2) Fallback via cookie httpOnly
  //     const cookieVal = request.cookiesList()?.refresh_token
  //     if (!cookieVal) {
  //       return response.unauthorized({ message: 'Missing refresh token' })
  //     }

  //     const verified = await User.accessTokens.verify(new Secret(cookieVal))
  //     if (!verified) {
  //       return response.unauthorized({ message: 'Invalid refresh token' })
  //     }

  //     // Charger l’utilisateur par tokenableId
  //     const tokenUserId = Number(verified.tokenableId)
  //     user = await User.findOrFail(isNaN(tokenUserId) ? String(verified.tokenableId) as any : tokenUserId)
  //     current = verified
  //   }

  //   // Vérifie que le token présenté possède la capacité 'refresh'
  //   const isRefresh = Array.isArray(current?.abilities) && current!.abilities.includes('refresh')
  //   if (!isRefresh) {
  //     return response.forbidden({ message: 'Invalid token type for refresh' })
  //   }

  //   // Rotation du refresh token: révoque l’ancien et émet un nouveau
  //   await User.accessTokens.delete(user, current!.identifier)

  //   const accessToken = await User.accessTokens.create(user, ['*'], { name: cuid(), expiresIn: '10m' })
  //   const newRefreshToken = await User.accessTokens.create(user, ['refresh'], { name: `refresh:${cuid()}` })

  //   // Met à jour le cookie httpOnly avec le nouveau refresh token
  //   const newRefreshValue = (newRefreshToken as any)?.value || (newRefreshToken as any)?.token || String(newRefreshToken)
  //   response.cookie('refresh_token', newRefreshValue, {
  //     httpOnly: true,
  //     sameSite: 'lax',
  //     secure: process.env.NODE_ENV === 'production',
  //     path: '/api/refresh-token',
  //     maxAge: 7 * 24 * 60 * 60,
  //   })

  //   return response.ok({
  //     message: 'Refresh token successfully',
  //     data: {
  //       user,
  //       user_token: accessToken,
  //       access_token: accessToken,
  //       refresh_token: newRefreshToken,
  //     },
  //   })
  // }
  async refresh_token({ auth, request, response }: HttpContext) {
  let user: User
  let current: any

  console.log('=== [REFRESH TOKEN] Début du processus ===')

  try {
    console.log('[1] Tentative via Authorization Bearer')
    user = await auth.authenticate()
    current = user.currentAccessToken
    console.log('[1] Token Bearer authentifié :', current)
  } catch (error) {
    console.warn('[2] Échec du Bearer, fallback cookie httpOnly')

    const cookieVal = request.cookiesList()?.refresh_token
    console.log('[2] Valeur du cookie refresh_token :', cookieVal)

    if (!cookieVal) {
      console.error('[2] Aucun refresh token trouvé dans les cookies')
      return response.unauthorized({ message: 'Missing refresh token' })
    }

    const verified = await User.accessTokens.verify(new Secret(cookieVal))
    console.log('[2] Résultat de la vérification du token cookie :', verified)

    if (!verified) {
      console.error('[2] Token de refresh invalide')
      return response.unauthorized({ message: 'Invalid refresh token' })
    }

    const tokenUserId = Number(verified.tokenableId)
    user = await User.findOrFail(isNaN(tokenUserId) ? String(verified.tokenableId) as any : tokenUserId)
    current = verified
    console.log('[2] Utilisateur trouvé :', user.id)
  }

  console.log('[3] Vérification des capacités du token :', current?.abilities)

  const isRefresh = Array.isArray(current?.abilities) && current.abilities.includes('refresh')
  if (!isRefresh) {
    console.error('[3] Token sans capacité refresh !')
    return response.forbidden({ message: 'Invalid token type for refresh' })
  }

  console.log('[4] Rotation du refresh token : suppression de l’ancien', current.identifier)
  await User.accessTokens.delete(user, current.identifier)

  console.log('[4] Création du nouvel access token...')
  const accessToken = await User.accessTokens.create(user, ['*'], {
    name: cuid(),
    expiresIn: '2m',
  })

  console.log('[4] Création du nouveau refresh token...')
  const newRefreshToken = await User.accessTokens.create(user, ['refresh'], {
    name: `refresh:${cuid()}`,
  })

  const newRefreshValue =
    (newRefreshToken as any)?.value ||
    (newRefreshToken as any)?.token ||
    String(newRefreshToken)

  console.log('[5] Nouveau refresh token généré :', newRefreshValue)

  response.cookie('refresh_token', newRefreshValue, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/refresh-token',
    maxAge:  7 * 24 * 60 * 60,
  })

  console.log('[6] Nouveaux tokens émis avec succès pour l’utilisateur :', user.id)
  console.log('=== [REFRESH TOKEN] Fin du processus ===')

  return response.ok({
    message: 'Refresh token successfully',
    data: {
      user,
      user_token: accessToken,
      access_token: accessToken,
      refresh_token: newRefreshToken,
    },
  })
}

  public async logout(ctx: HttpContext) {
    const { auth, response } = ctx
    const user = await auth.authenticate()
    await User.accessTokens.delete(user, user.currentAccessToken.identifier)

    await LoggerService.log({
      actorId: user.id,
      action: 'LOGOUT',
      entityType: 'User',
      entityId: user.id.toString(),
      description: `Déconnexion de l'utilisateur ${user.email}`,
      ctx: ctx,
    })

    return response.ok({ message: 'Logout successfully' })
  }

  async validateEmail({ response, request }: HttpContext) {
    const { email } = request.only(['email'])

    try {
      const user = await User.findBy('email', email)
      if (!user) {
        return response.status(401).json({
          message: 'Invalid credentials',
        })
      }
      return response.status(200).json({
        message: 'Email is valid',
      })
    } catch (error) {
      return response.status(400).json({
        message: 'An error occurred during validation',
      })
    }
  }

  public async validatePassword({ request, response }: HttpContext) {
    const { email, password } = request.only(['email', 'password'])

    try {
      const user = await User.findBy('email', email)

      if (!user) {
        return response.status(401).json({
          message: 'Invalid credentials (email)',
        })
      }

      const passwordValid = await hash.verify(password, user.password)

      if (!passwordValid) {
        return response.status(401).json({
          message: 'Invalid Password',
        })
      }

      return response.status(200).json({
        message: 'valid Password',
      })
    } catch (error) {
      return response.status(500).json({
        message: 'server error',
      })
    }
  }
}
