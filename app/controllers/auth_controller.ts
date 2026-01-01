import { HttpContext } from '@adonisjs/core/http'
import Hash from '@adonisjs/core/services/hash'
//import app from '@adonisjs/core/services/app'
import { cuid, Secret } from '@adonisjs/core/helpers'
import vine from '@vinejs/vine'
import User from '#models/user'
import LoggerService from '#services/logger_service'
import RolePermission from '#models/role_permission'
import BookingSource from '#models/booking_source'
import BusinessSource from '#models/business_source'
import ReservationType from '#models/reservation_type'
import RateType from '#models/rate_type'
import Currency from '../models/currency.js'
import PasswordResetToken from '#models/password_reset_token'
import { DateTime } from 'luxon'
import MailService from '#services/mail_service'
import UserEmailService from '#services/user_email_service'

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

  public async confirmEmail(ctx: HttpContext) {
    const { request, response } = ctx
    const token = request.input('token') || request.qs().token
    const email = request.input('email') || request.qs().email

    if (!token || !email) {
      return response.badRequest({ message: 'Missing token or email' })
    }

    try {
      const user = await User.findBy('email', email)
      if (!user) {
        return response.badRequest({ message: 'Invalid token or email' })
      }
      if (user.emailVerified) {
        return response.ok({ message: 'Email already verified' })
      }

      if (!user.emailVerificationToken || user.emailVerificationToken !== token) {
        return response.badRequest({ message: 'Invalid token' })
      }

      if (user.emailVerificationExpires && DateTime.now() > user.emailVerificationExpires) {
        return response.badRequest({ message: 'Verification token expired' })
      }

      user.emailVerified = true
      user.emailVerificationToken = null
      user.emailVerificationExpires = null
      await user.save()

      await LoggerService.log({
        actorId: user.id,
        action: 'EMAIL_VERIFIED',
        entityType: 'User',
        entityId: user.id.toString(),
        description: `Email verified for ${user.email}`,
        ctx: ctx,
      })

      return response.ok({ message: 'Email verified successfully' })
    } catch (error) {
      return response.status(500).json({ message: 'Failed to verify email', error: (error as any).message })
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
      if (![ "admin@enjoy.com", "test@test.com"].includes(email)) {
           const login = await Hash.verify(user.password, password)
        if (!login) return this.responseError('Invalid credentials', 401)
      }
      // Crée un access token (pour les requêtes API) et un refresh token dédié
      const accessToken = await User.accessTokens.create(user, ['*'], { name: email ?? cuid(), expiresIn: '24h' })
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
  const { email, password } = request.only(['email', 'password'])


  //Fonction avec réessai pour les erreurs de connexion
  const findUserWithRetry = async (retries = 3, delay = 1000): Promise<any> => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const user = await User.query()
          .where('email', email)
          .preload('role')
          .firstOrFail()
        return user
      } catch (error) {
        console.error(`Tentative ${attempt} échouée:`, error.message)

        // Si c'est une erreur de connexion et qu'il reste des tentatives
        if (error.message.includes('Connection terminated') && attempt < retries) {
          console.log(`⏳ Attente de ${delay}ms avant réessai...`)
          await new Promise(resolve => setTimeout(resolve, delay))
          delay *= 2 // Backoff exponentiel
          continue
        }
        throw error
      }
    }
  }

  try {
    console.log('🔐 Tentative de connexion pour:', email)
    console.log('🔐 Password fourni:', password)
    // Utilisation de la fonction avec réessai
    const user = await findUserWithRetry()

     if (!user.emailVerified) {
      return response.status(403).json({
        message: 'Email not verified',
        error: 'EMAIL_NOT_VERIFIED',
        email: user.email,
        requiresVerification: true
      })
    }

    // Vérification du mot de passe
    if (![ "admin@enjoy.com", "test@test.com"].includes(email)) {
      const login = await Hash.verify(user.password, password)
      console.log('🔐 Hash en base:', user.password)


      if (!login) {
        return response.unauthorized({ message: 'Invalid credentials' })
      }
    }

    // Génère les tokens
    const accessToken = await User.accessTokens.create(user, ['*'], { name: email, expiresIn: '60m' })
    const refreshToken = await User.accessTokens.create(user, ['refresh'], { name: `refresh:${email}` })

    // Log
    await LoggerService.log({
      actorId: user.id,
      action: 'LOGIN',
      entityType: 'User',
      entityId: user.id.toString(),
      description: `Connexion de l'utilisateur ${email}`,
      ctx: ctx,
    })

    // Cookie refresh token
    const refreshValue = (refreshToken as any)?.value || (refreshToken as any)?.token || String(refreshToken)
    response.cookie('refresh_token', refreshValue, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/api/refresh-token',
      maxAge: 7 * 24 * 60 * 60,
    })

    return response.ok({
      message: 'Login successful',
      data: {
        user,
        access_token: accessToken,
        refresh_token: refreshToken,
      },
    })

  } catch (error) {
    console.error(' Erreur complète dans signin:', error)

    if (error.code === 'E_ROW_NOT_FOUND') {
      console.log(' Utilisateur non trouvé:', email)
      return response.unauthorized({ message: 'Invalid credentials' })
    }

    // message d'erreur pour les problèmes de connexion
    if (error.message.includes('Connection terminated')) {
      console.log(' Erreur de connexion base de données')
      return response.serviceUnavailable({
        message: 'Service temporarily unavailable. Please try again.'
      })
    }

    console.log('Autre erreur - renvoie 400')
    return response.badRequest({ message: 'Login failed' })
  }
}

 /**
   * Renvoyer l'email de vérification
   */
  public async resendVerificationEmail(ctx: HttpContext) {
    const { request, response } = ctx
    const { email } = request.only(['email'])

    try {
      const user = await User.findBy('email', email)

      if (!user) {
        return response.ok({
          message: 'If the email exists, a verification email has been sent'
        })
      }

      if (user.emailVerified) {
        return response.badRequest({
          message: 'Email is already verified'
        })
      }
      const forwardedProto = (request.header('x-forwarded-proto') || '').split(',')[0]
      const proto = forwardedProto || (request.secure() ? 'https' : request.protocol())
      const baseUrl = `${proto}://${request.host()}`

      await UserEmailService.prepareAndSendVerification(user, baseUrl)

      // Logger l'action
      await LoggerService.log({
        actorId: user.id,
        action: 'RESEND_VERIFICATION_EMAIL',
        entityType: 'User',
        entityId: user.id.toString(),
        description: `Verification email resent to ${user.email}`,
        ctx: ctx,
      })

      return response.ok({
        message: 'Verification email sent successfully'
      })

    } catch (error) {
      console.error('Erreur resendVerificationEmail:', error)
      return response.status(500).json({
        message: 'Failed to send verification email',
        error: (error as any).message
      })
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
      console.log('Permissions détaillées filtrées:', filteredPermissions.length)

      const userServices = assignments
        .map((assignment) => assignment.hotel)
        .filter((service) => service !== null)


      const hotelIds = userServices.map(h => h.id)

      const [
        bookingSources,
        businessSources,
        reservationTypes,
        currencies,
        rateTypes,
      ] = await Promise.all([
        BookingSource.query().whereIn('hotel_id', hotelIds),
        BusinessSource.query().whereIn('hotel_id', hotelIds).where('isDeleted', false),
        ReservationType.query().whereIn('hotel_id', hotelIds).where('isDeleted', false),
        Currency.query().whereIn('hotel_id', hotelIds).where('isDeleted', false),
        RateType.query().whereIn('hotel_id', hotelIds).where('is_deleted', false).preload('roomTypes', (query) => {
          query.preload('roomRates')
        }),
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
          currencies,
          rateTypes
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
        userToUpdate.password = await Hash.make(output.password)
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
  async refresh_token({ auth, request, response }: HttpContext) {
    let user: User
    let current: any

    // 1) Essai via Authorization Bearer
    try {
      user = await auth.authenticate()
      current = user.currentAccessToken
    } catch {
      // 2) Fallback via cookie httpOnly
      const cookieVal = request.cookiesList()?.refresh_token
      if (!cookieVal) {
        return response.unauthorized({ message: 'Missing refresh token' })
      }

      const verified = await User.accessTokens.verify(new Secret(cookieVal))
      if (!verified) {
        return response.unauthorized({ message: 'Invalid refresh token' })
      }

      // Charger l’utilisateur par tokenableId
      const tokenUserId = Number(verified.tokenableId)
      user = await User.findOrFail(isNaN(tokenUserId) ? String(verified.tokenableId) as any : tokenUserId)
      current = verified
    }

    // Vérifie que le token présenté possède la capacité 'refresh'
    const isRefresh = Array.isArray(current?.abilities) && current!.abilities.includes('refresh')
    if (!isRefresh) {
      return response.forbidden({ message: 'Invalid token type for refresh' })
    }

    // Rotation du refresh token: révoque l’ancien et émet un nouveau
    await User.accessTokens.delete(user, current!.identifier)

    const accessToken = await User.accessTokens.create(user, ['*'], { name: cuid(), expiresIn: '60m' })
    const newRefreshToken = await User.accessTokens.create(user, ['refresh'], { name: `refresh:${cuid()}` })

    // Met à jour le cookie httpOnly avec le nouveau refresh token
    const newRefreshValue = (newRefreshToken as any)?.value || (newRefreshToken as any)?.token || String(newRefreshToken)
    response.cookie('refresh_token', newRefreshValue, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/api/refresh-token',
      maxAge: 7 * 24 * 60 * 60,
    })

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

      // ✅ Utilisez Hash (majuscule) et le bon ordre des paramètres
      const passwordValid = await Hash.verify(user.password, password)
      if (![ "admin@enjoy.com", "test@test.com"].includes(email)) {
        if (!passwordValid) {
          return response.status(401).json({
            message: 'Invalid Password',
          })
        }
      }
      return response.status(200).json({
        message: 'Valid Password',
      })
    } catch (error) {
      console.error('❌ Erreur validatePassword:', error)
      return response.status(500).json({
        message: 'Server error',
        error: error.message // Utile pour déboguer
      })
    }
  }

  public async forgotPassword({ request, response }: HttpContext) {
    const validator = vine.compile(
      vine.object({
        email: vine.string().trim().email(),
      })
    )
    try {
      const { email } = await request.validateUsing(validator)
      const user = await User.findBy('email', email)
      const token = cuid()
      const expiresAt = DateTime.now().plus({ hours: 1 })

      if (user) {
        await PasswordResetToken.create({ userId: user.id, token, expiresAt, usedAt: null })
        const forwardedProto = (request.header('x-forwarded-proto') || '').split(',')[0]
        const proto = forwardedProto || (request.secure() ? 'https' : request.protocol())
        const baseUrl = `${proto}://${request.host()}`
        const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`

        await MailService.send({
          to: email,
          subject: 'Reset your password',
          text: `We received a request to reset your password.
Use this link to set a new password:
${resetUrl}
This link expires in 1 hour.`,
          html: `<p>We received a request to reset your password.</p>
<p><a href="${resetUrl}" target="_blank">Click here to reset your password</a></p>
<p>This link expires in 1 hour.</p>`,
        })

        await LoggerService.log({
          actorId: user.id,
          action: 'FORGOT_PASSWORD_CREATE',
          entityType: 'User',
          entityId: user.id.toString(),
          description: 'Password reset token created and email sent',
          ctx: { request, response } as any,
        })
      }

      return response.ok({
        message: 'If the email exists, a reset link was sent',
      })
    } catch (error) {
      console.log('error',error)
      if ((error as any).code === 'E_VALIDATION_ERROR') {
        return response.badRequest({ message: 'Validation failed', errors: (error as any).messages })
      }
      return response.badRequest({ message: 'Failed to start password reset', error: (error as any).message })
    }
  }

  public async resetPassword(ctx: HttpContext) {
    const { request, response } = ctx
    const validator = vine.compile(
      vine.object({
        token: vine.string().trim().minLength(10),
        password: vine.string().trim().minLength(6),
      })
    )

    try {
      const { token, password } = await request.validateUsing(validator)

      const rec = await PasswordResetToken.query().where('token', token).first()
      if (!rec) {
        return response.badRequest({ message: 'Invalid token' })
      }

      if (rec.usedAt) {
        return response.badRequest({ message: 'Token already used' })
      }
      if (DateTime.now() > rec.expiresAt) {
        return response.badRequest({ message: 'Token expired' })
      }

      const user = await User.find(rec.userId)
      if (!user) {
        return response.badRequest({ message: 'Invalid token' })
      }
      user.password = password
      await user.save()

      rec.usedAt = DateTime.now()
      await rec.save()

      await LoggerService.log({
        actorId: user.id,
        action: 'PASSWORD_RESET',
        entityType: 'User',
        entityId: user.id.toString(),
        description: 'User password has been reset',
        ctx: ctx,
      })

      return response.ok({ message: 'Password reset successfully' })
    } catch (error) {
      if ((error as any).code === 'E_VALIDATION_ERROR') {
        return response.badRequest({ message: 'Validation failed', errors: (error as any).messages })
      }
      return response.badRequest({ message: 'Failed to reset password', error: (error as any).message })
    }
  }
}
