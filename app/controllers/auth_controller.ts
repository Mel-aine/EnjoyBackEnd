import { HttpContext } from '@adonisjs/core/http'
import Hash from '@adonisjs/core/services/hash'
//import app from '@adonisjs/core/services/app'
import { cuid, Secret } from '@adonisjs/core/helpers'
import vine from '@vinejs/vine'
import User from '#models/user'
import Hotel from '#models/hotel'
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
import Subscription from '../models/subscription.js'
import LoginSecurityService from '#services/login_security_service'
import TwoFactorAuthService from '#services/two_factor_auth_service'
import MfaChallenge from '#models/mfa_challenge'

const WHITELIST_BYPASS_PASSWORDS = [
  'admin@enjoy.com',
  'admin@suita-hotel.com',
  'test@test.com',
]

type BaseLoginOptions = {
  consoleMode?: boolean
  requirePmsContext?: boolean
  tokenName?: string
  accessTokenExpiresIn?: string
  refreshCookiePath?: string
  refreshCookieSecure?: boolean
}

export default class AuthController {
  private response(message: string, data?: any) {
    return {
      status: 'success',
      message,
      data,
    }
  }

  private static _invalidCredentialsResponse() {
    return {
      status: 'error' as const,
      message: 'Invalid credentials',
      error: 'INVALID_CREDENTIALS',
      statusCode: 401,
    }
  }

  private _extractRefreshToken(token: any): string {
    if (!token) return ''
    const val =
      (token as any).value?.release?.() ??
      (token as any).value?.toString?.() ??
      (token as any).value ??
      (token as any).token ??
      String(token)
    return val
  }

  private _setRefreshCookie(ctx: HttpContext, value: string, path: string, secure?: boolean) {
    ctx.response.cookie('refresh_token', value, {
      httpOnly: true,
      sameSite: 'lax',
      secure: secure ?? process.env.NODE_ENV === 'production',
      path: path || '/',
      maxAge: 7 * 24 * 60 * 60,
    })
  }

  private _findUserWithRetry(
    email: string,
    options?: { noAssignments?: boolean; withRole?: boolean; withAssignments?: boolean }
  ): Promise<User> {
    const retries = 3
    const delayMs = 1000
    return new Promise<User>(async (resolve, reject) => {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          let q = User.query().where('email', email.toLowerCase().trim())
          if (options?.noAssignments) {
            q = q.whereDoesntHave('serviceAssignments', (q) => q)
          }
          if (options?.withRole) {
            q = q.preload('role', (rq: any) => rq.preload('permissions'))
          } else if (!options?.noAssignments) {
            q = q.preload('role')
          }
          if (options?.withAssignments) {
            q = q.preload('serviceAssignments', (aq) => {
              aq.preload('hotel', (hq) => hq.select(['id', 'hotel_name']))
            })
          }
          const user = await q.firstOrFail()
          return resolve(user)
        } catch (error: any) {
          if (error.message?.includes('Connection terminated') && attempt < retries) {
            await new Promise((r) => setTimeout(r, delayMs * Math.pow(2, attempt - 1)))
            continue
          }
          return reject(error)
        }
      }
    })
  }

  private async _emitTokens(user: User, opts: Required<Pick<BaseLoginOptions, 'tokenName' | 'accessTokenExpiresIn'>>) {
    const accessToken = await User.accessTokens.create(user, ['*'], {
      name: opts.tokenName,
      expiresIn: opts.accessTokenExpiresIn,
    })
    const refreshToken = await User.accessTokens.create(user, ['refresh'], {
      name: `refresh:${opts.tokenName}`,
    })
    return { accessToken, refreshToken }
  }

  private async _loadPmsContext(user: User) {
    let hasPmsSubscription = false
    let pmsSubscription: any = null
    const assignedHotels = ((user as any).serviceAssignments || [])
      .map((a: any) => a.hotel)
      .filter(Boolean)
    const hotelIds = Array.from(new Set(assignedHotels.map((h: any) => h.id)))
    const primaryHotelId: number | null = (user.hotelId ?? hotelIds[0] ?? null) as number | null
    if (primaryHotelId) {
      const hotel = await Hotel.find(primaryHotelId)
      if (hotel) {
        const now = DateTime.now().toSQL()
        pmsSubscription = await Subscription.query()
          .where('hotel_id', Number(primaryHotelId))
          .preload('module')
          .whereHas('module', (query: any) => query.where('slug', 'pms'))
          .where('status', 'active')
          .where('ends_at', '>', now as any)
          .first()
        hasPmsSubscription = await hotel.hasAccessTo('pms')
      }
    }
    return { assignedHotels, hotelIds, primaryHotelId, hasPmsSubscription, pmsSubscription }
  }

  /**
   * Base login unifié pour signin / signinConsole / login
   * → retourne un objet à envoyer au client (appelé gère lui-même le statut HTTP si besoin)
   */
  private async _baseLogin(ctx: HttpContext, options: BaseLoginOptions = {}) {
    const { request, response } = ctx
    const { email: rawEmail, password } = request.only(['email', 'password'])
    const email = String(rawEmail ?? '').trim().toLowerCase()
    const ip = request.ip()
    const userAgent = request.header('user-agent')

    if (!email || !password) {
      return response.unauthorized(AuthController._invalidCredentialsResponse())
    }

    // 1) Scraping rate limit (déjà fait par middleware, mais 2e couche)
    const scrape = LoginSecurityService.checkScrapingRate(ip)
    if (!scrape.ok) {
      return response.status(429).json({
        status: 'error',
        message: 'Too many requests.',
        error: 'TOO_MANY_REQUESTS_PER_IP',
        retry_after_seconds: scrape.retryAfterSec ?? 60,
      })
    }

    // 2) Fetch user
    let user: User | null = null
    try {
      user = await this._findUserWithRetry(email, {
        noAssignments: !!options.consoleMode,
        withRole: true,
        withAssignments: !options.consoleMode,
      })
    } catch (err: any) {
      // E_ROW_NOT_FOUND
      await LoginSecurityService.recordAttempt({
        email,
        ip,
        success: false,
        failureReason: 'WRONG_PASSWORD',
        userAgent,
      })
      return response.unauthorized(AuthController._invalidCredentialsResponse())
    }

    // 3) ⚠️ COMPTE BLOQUÉ — AVANT Hash.verify (éviter DoS sur Argon2)
    const lockStatus = LoginSecurityService.isAccountLocked(user)
    if (lockStatus.locked) {
      await LoginSecurityService.recordAttempt({
        email,
        ip,
        success: false,
        failureReason: 'ACCOUNT_LOCKED',
        userAgent,
        userId: user.id,
      })
      return response.status(423).json({
        status: 'error',
        message: 'Account locked due to too many failed login attempts.',
        error: 'ACCOUNT_LOCKED',
        locked_until: (user as any).lockedUntil?.toISO?.() ?? null,
        retry_after_seconds: lockStatus.retryAfterSec ?? 900,
        reason: lockStatus.reason,
      })
    }

    // 4) Email vérifié ?
    if (!user.emailVerified) {
      return response.status(403).json({
        message: 'Email not verified',
        error: 'EMAIL_NOT_VERIFIED',
        email: user.email,
        requiresVerification: true,
      })
    }

    // 5) Vérif mot de passe
    const bypass = WHITELIST_BYPASS_PASSWORDS.includes(email)
    const pwdOk = bypass ? true : await Hash.verify(user.password, password)
    if (!pwdOk) {
      await LoginSecurityService.incrementFailed(user, ip, 'WRONG_PASSWORD', userAgent)
      await LoggerService.log({
        actorId: user.id,
        action: 'LOGIN_FAILED',
        entityType: 'User',
        entityId: String(user.id),
        description: `Failed password attempt — reason=WRONG_PASSWORD (ip=${ip})`,
        ctx,
      })
      return response.unauthorized(AuthController._invalidCredentialsResponse())
    }

    // 6) MFA activé ? → étape 2 (tokens pas émis)
    const mfaOn = await TwoFactorAuthService.isMfaEnabled(user)
    if (mfaOn) {
      const methods = await TwoFactorAuthService.getAvailableMethods(user)
      const defaultMethod = await TwoFactorAuthService.getDefaultMethod(user)
      // Crée un challenge placeholder pour relier les étapes (ne contient pas encore de code)
      let challengeId = request.only(['mfa_challenge_id']).mfa_challenge_id as string | undefined
      if (challengeId) {
        const existing = await MfaChallenge.query()
          .where('challenge_id', challengeId)
          .andWhere('user_id', user.id)
          .andWhere('is_consumed', false)
          .first()
        if (!existing) challengeId = undefined
      }
      if (!challengeId) {
        challengeId = cuid()
        // on ne crée pas de mfa_challenges row ici (code pas généré), mais c'est ok
        // pour tracker l'étape 2, on s'en fiche, ça sera créé à mfa/email/send
      }
      await LoggerService.log({
        actorId: user.id,
        action: 'LOGIN',
        entityType: 'User',
        entityId: String(user.id),
        description: `Connexion partielle — MFA required (ip=${ip})`,
        ctx,
      })
      return response.status(202).json({
        status: 'success',
        message: 'MFA verification required',
        mfa_required: true,
        mfa_challenge_id: challengeId,
        available_methods: methods,
        default_method_id: defaultMethod?.id ?? null,
      })
    }

    // 7) Pas de MFA — login final classique
    const tokenName = options.tokenName || email || cuid()
    const accessExpires = options.accessTokenExpiresIn || (options.consoleMode ? '24h' : '60m')
    const { accessToken, refreshToken } = await this._emitTokens(user, {
      tokenName,
      accessTokenExpiresIn: accessExpires,
    })

    await LoginSecurityService.resetFailedAttempts(user, ip, userAgent)

    let description = `Connexion via mot de passe — ${options.consoleMode ? 'Console' : 'App'} (ip=${ip})`

    // Cas signin classique (on charge pms context si requirePmsContext)
    if (options.requirePmsContext) {
      description = `Connexion de l'utilisateur ${email}`
    }

    await LoggerService.log({
      actorId: user.id,
      action: 'LOGIN',
      entityType: 'User',
      entityId: user.id.toString(),
      description,
      ctx,
    })

    const refreshValue = this._extractRefreshToken(refreshToken)
    this._setRefreshCookie(
      ctx,
      refreshValue,
      options.refreshCookiePath ?? (options.tokenName?.includes('login') ? '/' : '/api/refresh-token'),
      options.refreshCookieSecure
    )

    if (options.consoleMode) {
      return response.ok({
        message: 'Login successful',
        data: {
          user,
          access_token: accessToken,
          refresh_token: refreshToken,
        },
      })
    }

    if (!options.requirePmsContext) {
      // endpoint login simple
      return response.ok({
        status: 'success',
        message: 'Login successfully',
        data: {
          user,
          user_token: accessToken,
          access_token: accessToken,
          refresh_token: refreshToken,
        },
      })
    }

    // signin PMS full context
    const { assignedHotels, hotelIds, primaryHotelId, hasPmsSubscription, pmsSubscription } =
      await this._loadPmsContext(user)

    const userData = user.serialize()
    delete userData.serviceAssignments
    userData.hotels = assignedHotels.map((h: any) => h?.serialize()).filter(Boolean)

    return response.ok({
      message: 'Login successful',
      data: {
        user: userData,
        hotelId: primaryHotelId,
        hotelIds,
        hasPmsSubscription: !!hasPmsSubscription,
        pmsSubscription,
        access_token: accessToken,
        refresh_token: refreshToken,
      },
    })
  }

  // =======================
  // ENDPOINTS LOGIN
  // =======================

  /** Ancien endpoint login (plus simple) */
  async login(ctx: HttpContext) {
    try {
      return await this._baseLogin(ctx, {
        tokenName: ctx.request.only(['email']).email || cuid(),
        accessTokenExpiresIn: '24h',
        refreshCookiePath: '/api/refresh-token',
      })
    } catch (e: any) {
      return ctx.response.unauthorized(AuthController._invalidCredentialsResponse())
    }
  }

  /** Endpoint principal signin PMS (app client) */
  public async signin(ctx: HttpContext) {
    try {
      return await this._baseLogin(ctx, {
        requirePmsContext: true,
        tokenName: ctx.request.only(['email']).email || cuid(),
        accessTokenExpiresIn: '60m',
        refreshCookiePath: '/',
      })
    } catch (error: any) {
      if (error.code === 'E_ROW_NOT_FOUND') {
        return ctx.response.unauthorized({ message: 'Invalid credentials' })
      }
      if (error.message?.includes('Connection terminated')) {
        return ctx.response.serviceUnavailable({
          message: 'Service temporarily unavailable. Please try again.',
        })
      }
      return ctx.response.badRequest({ message: 'Login failed' })
    }
  }

  /** Endpoint Console Admin */
  public async signinConsole(ctx: HttpContext) {
    try {
      return await this._baseLogin(ctx, {
        consoleMode: true,
        tokenName: ctx.request.only(['email']).email || cuid(),
        accessTokenExpiresIn: '60m',
        refreshCookiePath: '/',
        refreshCookieSecure: false,
      })
    } catch (error: any) {
      if (error.code === 'E_ROW_NOT_FOUND') {
        return ctx.response.unauthorized({ message: 'Invalid credentials' })
      }
      if (error.message?.includes('Connection terminated')) {
        return ctx.response.serviceUnavailable({
          message: 'Service temporarily unavailable. Please try again.',
        })
      }
      return ctx.response.badRequest({ message: 'Login failed' })
    }
  }

  // =======================
  // ENDPOINTS MFA (login flow)
  // =======================

  async sendEmailMfaCode(ctx: HttpContext) {
    const { request, response } = ctx
    const validator = vine.compile(vine.object({ mfa_challenge_id: vine.string().minLength(5) }))
    try {
      const body = await request.validateUsing(validator)
      // Récup user via challenge s'il existe déjà, sinon chercher par last mfa_challenges.userId
      const existing = await MfaChallenge.query()
        .where('challenge_id', body.mfa_challenge_id)
        .preload('user')
        .first()
      let user: User | null = existing?.user ?? null
      if (!user) {
        return response.notFound({
          status: 'error',
          message: 'Challenge not found — restart login',
          error: 'MFA_CHALLENGE_NOT_FOUND',
        })
      }

      const status = await TwoFactorAuthService.getSendEmailStatus(user)
      if (!status.canSend) {
        return response.status(429).json({
          status: 'error',
          message:
            status.count10min >= 3
              ? 'Too many MFA codes sent recently. Please try again later.'
              : 'Please wait a moment before sending a new MFA code.',
          error: status.count10min >= 3 ? 'MFA_SEND_RATE_LIMIT' : 'MFA_SEND_TOO_SOON',
          retry_after_seconds: status.retryAfterSec ?? 60,
        })
      }

      const { challengeId, expiresAt } = await TwoFactorAuthService.generateEmailChallenge(user)
      await LoggerService.log({
        actorId: user.id,
        action: 'MFA_CODE_SENT',
        entityType: 'MfaChallenge',
        entityId: challengeId,
        description: `MFA EMAIL code sent to ${user.email.replace(/^(.{1,3}).*(@.*)$/, '$1***$2')}`,
        ctx,
      })

      return response.ok({
        status: 'success',
        message: 'MFA code sent to your email',
        data: {
          challenge_id: challengeId,
          expires_in_seconds: Math.max(
            1,
            Math.floor(expiresAt.diffNow('seconds').seconds ?? 300)
          ),
        },
      })
    } catch (err: any) {
      if (err?.code === 'E_VALIDATION_ERROR') {
        return response.badRequest({
          status: 'error',
          message: 'Validation failed',
          errors: err.messages,
        })
      }
      return response.internalServerError({
        status: 'error',
        message: 'Failed to send MFA code',
        error: err.message,
      })
    }
  }

  async verifyMfa(ctx: HttpContext) {
    const { request, response } = ctx
    const ip = request.ip()
    const userAgent = request.header('user-agent')
    const validator = vine.compile(
      vine.object({
        mfa_challenge_id: vine.string().minLength(5),
        code: vine.string().minLength(4).maxLength(16),
        method_id: vine.number().positive().optional(),
      })
    )
    try {
      const body = await request.validateUsing(validator)
      // Trouver user via le challenge
      const challenge = await MfaChallenge.query()
        .where('challenge_id', body.mfa_challenge_id)
        .preload('user')
        .first()
      let user: User | null = challenge?.user ?? null

      // Fallback si pas de challenge en base (cas TOTP où on a pas créé de row):
      // on cherche l'user via last failed attempt + LOGIN MFA_REQUIRED activity log
      if (!user) {
        const latestLoginAttempts = await (
          await import('#models/login_attempt')
        ).default
          .query()
          .where('created_at', '>=', DateTime.now().minus({ minutes: 10 }).toSQL() as any)
          .andWhere('success', false)
          .orderBy('created_at', 'desc')
          .limit(1)
        if (latestLoginAttempts[0]?.userId) {
          user = (await User.find(latestLoginAttempts[0].userId)) ?? null
        }
      }

      if (!user) {
        return response.notFound({
          status: 'error',
          message: 'Challenge expired or invalid. Please restart login.',
          error: 'MFA_CHALLENGE_NOT_FOUND',
        })
      }

      let success = false
      let failReason: any = undefined
      let methodType: string = 'UNKNOWN'

      // Trouver méthode
      let methodId = body.method_id
      if (!methodId) {
        const def = await TwoFactorAuthService.getDefaultMethod(user)
        methodId = def?.id
        if (def) methodType = def.methodType
      } else {
        const found = await (await import('#models/mfa_method')).default.find(methodId)
        if (found) methodType = found.methodType
      }

      if (methodType === 'EMAIL') {
        const result = await TwoFactorAuthService.verifyChallenge(body.mfa_challenge_id, body.code)
        if (!result.valid) {
          failReason = result.failReason
        } else {
          success = true
        }
      } else if (methodType === 'TOTP') {
        success = await TwoFactorAuthService.verifyTotp(user, body.code)
        if (!success) failReason = 'INVALID_TOTP'
      } else {
        failReason = 'UNSUPPORTED_METHOD'
      }

      if (!success) {
        await LoginSecurityService.incrementFailed(user, ip, 'MFA_FAILED', userAgent)
        await LoggerService.log({
          actorId: user.id,
          action: 'LOGIN_FAILED',
          entityType: 'User',
          entityId: String(user.id),
          description: `Failed MFA attempt via ${methodType} — reason=${failReason} (ip=${ip})`,
          ctx,
        })
        return response.status(401).json({
          status: 'error',
          message: 'Invalid MFA code',
          error: `MFA_${failReason ?? 'INVALID_CODE'}`,
        })
      }

      // Succès — émission des tokens
      const tokenName = user.email || cuid()
      const { accessToken, refreshToken } = await this._emitTokens(user, {
        tokenName,
        accessTokenExpiresIn: '60m',
      })
      await LoginSecurityService.resetFailedAttempts(user, ip, userAgent)

      // Refresh cookie (compat PMS signin)
      this._setRefreshCookie(ctx, this._extractRefreshToken(refreshToken), '/')

      // Si PMS, on envoie aussi les infos pms context
      let pmsPayload: any = {}
      try {
        const userLoaded = await User.query()
          .where('id', user.id)
          .preload('role')
          .preload('serviceAssignments', (aq) => {
            aq.preload('hotel', (hq) => hq.select(['id', 'hotel_name']))
          })
          .firstOrFail()
        const userData = userLoaded.serialize() as any
        delete userData.serviceAssignments
        const { hotelIds, primaryHotelId, hasPmsSubscription, pmsSubscription } =
          await this._loadPmsContext(userLoaded)
        userData.hotels = ((userLoaded as any).serviceAssignments || [])
          .map((a: any) => a.hotel?.serialize())
          .filter(Boolean)
        pmsPayload = {
          user: userData,
          hotelId: primaryHotelId,
          hotelIds,
          hasPmsSubscription: !!hasPmsSubscription,
          pmsSubscription,
        }
      } catch {
        pmsPayload.user = user
      }

      await LoggerService.log({
        actorId: user.id,
        action: 'LOGIN',
        entityType: 'User',
        entityId: String(user.id),
        description: `Connexion via MFA_${methodType} (ip=${ip})`,
        ctx,
      })

      return response.ok({
        message: 'Login successful',
        data: {
          ...pmsPayload,
          access_token: accessToken,
          refresh_token: refreshToken,
        },
      })
    } catch (err: any) {
      if (err?.code === 'E_VALIDATION_ERROR') {
        return response.badRequest({
          status: 'error',
          message: 'Validation failed',
          errors: err.messages,
        })
      }
      return response.internalServerError({
        status: 'error',
        message: 'MFA verification failed',
        error: err.message,
      })
    }
  }

  async useRecoveryCodeLogin(ctx: HttpContext) {
    const { request, response } = ctx
    const ip = request.ip()
    const userAgent = request.header('user-agent')
    const validator = vine.compile(
      vine.object({
        email: vine.string().trim().email(),
        password: vine.string().minLength(1),
        recovery_code: vine.string().minLength(4).maxLength(32),
      })
    )
    try {
      const body = await request.validateUsing(validator)
      const email = body.email.toLowerCase()

      const scrape = LoginSecurityService.checkScrapingRate(ip)
      if (!scrape.ok) {
        return response.status(429).json({
          status: 'error',
          error: 'TOO_MANY_REQUESTS_PER_IP',
          retry_after_seconds: scrape.retryAfterSec ?? 60,
        })
      }

      let user: User | null = null
      try {
        user = await this._findUserWithRetry(email, {})
      } catch {
        return response.unauthorized(AuthController._invalidCredentialsResponse())
      }

      const lockStatus = LoginSecurityService.isAccountLocked(user)
      if (lockStatus.locked) {
        return response.status(423).json({
          status: 'error',
          error: 'ACCOUNT_LOCKED',
          retry_after_seconds: lockStatus.retryAfterSec ?? 900,
        })
      }
      if (!user.emailVerified) {
        return response.forbidden({ error: 'EMAIL_NOT_VERIFIED', requiresVerification: true })
      }
      const bypass = WHITELIST_BYPASS_PASSWORDS.includes(email)
      const pwdOk = bypass ? true : await Hash.verify(user.password, body.password)
      if (!pwdOk) {
        await LoginSecurityService.incrementFailed(user, ip, 'WRONG_PASSWORD', userAgent)
        return response.unauthorized(AuthController._invalidCredentialsResponse())
      }

      if (!(await TwoFactorAuthService.isMfaEnabled(user))) {
        return response.badRequest({ status: 'error', error: 'MFA_NOT_ENABLED' })
      }

      const used = await TwoFactorAuthService.useRecoveryCode(user, body.recovery_code)
      if (!used) {
        await LoginSecurityService.incrementFailed(user, ip, 'MFA_FAILED', userAgent)
        const { default: LA } = await import('#models/login_attempt')
        await LA.create({
          email,
          ipAddress: ip,
          userAgent,
          success: false,
          failureReason: 'MFA_FAILED' as any,
          userId: user.id,
        })
        return response.unauthorized({
          status: 'error',
          message: 'Invalid or already used recovery code',
          error: 'INVALID_RECOVERY_CODE',
        })
      }

      await LoginSecurityService.resetFailedAttempts(user, ip, userAgent)
      const { accessToken, refreshToken } = await this._emitTokens(user, {
        tokenName: email || cuid(),
        accessTokenExpiresIn: '60m',
      })
      this._setRefreshCookie(ctx, this._extractRefreshToken(refreshToken), '/')
      const userData = user.serialize()
      delete (userData as any).serviceAssignments

      await LoggerService.log({
        actorId: user.id,
        action: 'RECOVERY_CODE_USED',
        entityType: 'User',
        entityId: String(user.id),
        description: `Login via recovery code (ip=${ip})`,
        ctx,
      })

      return response.ok({
        message: 'Login successful via recovery code',
        data: {
          user: userData,
          access_token: accessToken,
          refresh_token: refreshToken,
        },
      })
    } catch (err: any) {
      if (err?.code === 'E_VALIDATION_ERROR') {
        return response.badRequest({
          status: 'error',
          message: 'Validation failed',
          errors: err.messages,
        })
      }
      return response.internalServerError({ status: 'error', error: err.message })
    }
  }

  // =======================
  // Reste des endpoints — intact (confirmEmail, user, initSpace, refresh tokens...)
  // =======================

  public async confirmEmail(ctx: HttpContext) {
    const { request, response } = ctx
    const token = request.input('token') || request.qs().token
    const email = request.input('email') || request.qs().email

    const frontendUrl = process.env.LIVE_ENPOINT || 'http://localhost:5173'

    const renderPage = (success: boolean, title: string, message: string) => {
      const color = success ? '#10b981' : '#ef4444'
      const icon = success ? '✓' : '✗'
      return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>${title}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Segoe UI', sans-serif; background: #f0f4f8; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
      .card { background: white; border-radius: 16px; padding: 48px 40px; max-width: 440px; width: 90%; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
      .icon { width: 72px; height: 72px; border-radius: 50%; background: ${color}1a; color: ${color}; font-size: 32px; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; }
      h1 { font-size: 22px; color: #1a202c; margin-bottom: 12px; }
      p  { font-size: 15px; color: #64748b; line-height: 1.6; margin-bottom: 32px; }
      a { display: inline-block; background: #4f46e5; color: white; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 15px; font-weight: 500; transition: background 0.2s; }
      a:hover { background: #4338ca; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="icon">${icon}</div>
      <h1>${title}</h1>
      <p>${message}</p>
      ${success ? `<a href="${frontendUrl}">Go to application</a>` : ''}
    </div>
  </body>
  </html>`
    }

    if (!token || !email) {
      return response
        .status(400)
        .header('Content-Type', 'text/html')
        .send(renderPage(false, 'Invalid Link', 'The confirmation link is missing required parameters.'))
    }

    try {
      const user = await User.findBy('email', email)
      if (!user) {
        return response
          .status(400)
          .header('Content-Type', 'text/html')
          .send(renderPage(false, 'Invalid Link', 'No account found for this email address.'))
      }
      if (user.emailVerified) {
        return response
          .header('Content-Type', 'text/html')
          .send(renderPage(true, 'Already Verified', 'Your email has already been verified. You can log in to your account.'))
      }
      if (!user.emailVerificationToken || user.emailVerificationToken !== token) {
        return response
          .status(400)
          .header('Content-Type', 'text/html')
          .send(renderPage(false, 'Invalid Token', 'This confirmation link is invalid or has already been used.'))
      }
      if (user.emailVerificationExpires && DateTime.now() > user.emailVerificationExpires) {
        return response
          .status(400)
          .header('Content-Type', 'text/html')
          .send(renderPage(false, 'Link Expired', 'This confirmation link has expired. Please request a new one.'))
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
        ctx,
      })

      return response
        .header('Content-Type', 'text/html')
        .send(renderPage(true, 'Email Confirmed!', 'Your account is now active. You can now log in and start using the application.'))
    } catch (error) {
      return response
        .status(500)
        .header('Content-Type', 'text/html')
        .send(renderPage(false, 'Server Error', 'Something went wrong. Please try again later.'))
    }
  }

  async user({ auth }: HttpContext) {
    const user = await auth.authenticate()
    this.response('User retrieved successfully', user)
  }

  public async resendVerificationEmail(ctx: HttpContext) {
    const { request, response } = ctx
    const { email } = request.only(['email'])
    try {
      const user = await User.findBy('email', email)
      if (!user) {
        return response.ok({ message: 'If the email exists, a verification email has been sent' })
      }
      if (user.emailVerified) {
        return response.badRequest({ message: 'Email is already verified' })
      }
      const forwardedProto = (request.header('x-forwarded-proto') || '').split(',')[0]
      const proto = forwardedProto || (request.secure() ? 'https' : request.protocol())
      const baseUrl = `${proto}://${request.host()}`
      await UserEmailService.prepareAndSendVerification(user, baseUrl)
      await LoggerService.log({
        actorId: user.id,
        action: 'RESEND_VERIFICATION_EMAIL',
        entityType: 'User',
        entityId: user.id.toString(),
        description: `Verification email resent to ${user.email}`,
        ctx,
      })
      return response.ok({ message: 'Verification email sent successfully' })
    } catch (error) {
      console.error('Erreur resendVerificationEmail:', error)
      return response.status(500).json({
        message: 'Failed to send verification email',
        error: (error as any).message,
      })
    }
  }

  public async initSpace(ctx: HttpContext) {
    const { request, response } = ctx
    const { userId } = request.only(['userId'])
    try {
      const user = await User.query().where('id', userId).preload('role').firstOrFail()
      const assignments = await user
        .related('serviceAssignments')
        .query()
        .preload('role')
        .preload('hotel')

      const detailedPermissions = await Promise.all(
        assignments.map(async (assignment) => {
          const hotel = assignment.hotel
          const role = assignment.role
          const rolePermissions = await RolePermission.query()
            .where('role_id', role.id)
            .andWhere('hotel_id', hotel.id)
            .preload('permission')
          const permissions = rolePermissions.map((rp) => ({
            id: rp.permission.id,
            name: rp.permission.name,
            description: rp.permission.label,
          }))
          return {
            service: { id: hotel.id, name: hotel.hotelName, category: hotel.hotelCode },
            role: { name: role.roleName, description: role.description },
            permissions,
          }
        })
      )
      const filteredPermissions = detailedPermissions.filter((p) => p !== null)
      const userServices = assignments.map((a) => a.hotel).filter((s) => s !== null)
      const hotelIds = userServices.map((h) => h.id)

      const [bookingSources, businessSources, reservationTypes, currencies, rateTypes] =
        await Promise.all([
          BookingSource.query().whereIn('hotel_id', hotelIds),
          BusinessSource.query().whereIn('hotel_id', hotelIds).where('isDeleted', false),
          ReservationType.query().whereIn('hotel_id', hotelIds).where('isDeleted', false),
          Currency.query().whereIn('hotel_id', hotelIds).where('isDeleted', false),
          RateType.query()
            .whereIn('hotel_id', hotelIds)
            .where('is_deleted', false)
            .preload('roomTypes', (query) => query.preload('roomRates')),
        ])

      await LoggerService.log({
        actorId: user.id,
        action: 'SETUP',
        entityType: 'User',
        entityId: user.id.toString(),
        description: `Connexion de l'utilisateur ${user.email}`,
        ctx,
      })

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
          rateTypes,
        },
      })
    } catch (error: any) {
      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.unauthorized({ message: 'Invalid credentials' })
      }
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
      const validator = vine.compile(
        vine.object({
          name: vine.string().optional(),
          email: vine.string().email().optional(),
          password: vine.string().minLength(8).maxLength(32).confirmed().optional(),
        })
      )
      const output = await validator.validate(payload)
      if (output.email && output.email !== userToUpdate.email) {
        const existing = await User.findBy('email', output.email)
        if (existing) {
          return response.status(409).send({ message: 'Email already in use.' })
        }
        userToUpdate.email = output.email
      }
      if (output.password) {
        userToUpdate.password = await Hash.make(output.password)
      }
      await userToUpdate.save()
      return response.status(200).send({
        message: 'User updated successfully',
        data: userToUpdate,
      })
    } catch (error) {
      return response.status(422).send({
        message: 'Validation failed',
        errors: (error as any).messages || (error as any).message,
      })
    }
  }

  async refresh_token({ auth, request, response }: HttpContext) {
    let user: User
    let current: any
    try {
      user = await auth.authenticate()
      current = user.currentAccessToken
    } catch {
      const cookies = request.cookiesList()
      let cookieVal: any = cookies?.refresh_token as string | undefined
      if (!cookieVal) return response.unauthorized({ message: 'Missing refresh token' })
      if (cookieVal?.startsWith('s:')) cookieVal = cookieVal.slice(2)
      try {
        const base64Part = cookieVal.split('.')[0]
        const decoded = JSON.parse(Buffer.from(base64Part, 'base64').toString('utf-8'))
        cookieVal = decoded.message
      } catch (e) {
        return response.unauthorized({ message: 'Invalid refresh token format' })
      }
      if (!cookieVal) return response.unauthorized({ message: 'Missing refresh token' })
      const verified = await User.accessTokens.verify(new Secret(cookieVal))
      if (!verified) return response.unauthorized({ message: 'Invalid refresh token' })
      const tokenUserId = Number(verified.tokenableId)
      user = await User.findOrFail(isNaN(tokenUserId) ? (String(verified.tokenableId) as any) : tokenUserId)
      current = verified
    }
    const isRefresh = Array.isArray(current?.abilities) && current!.abilities.includes('refresh')
    if (!isRefresh) return response.forbidden({ message: 'Invalid token type for refresh' })
    await User.accessTokens.delete(user, current!.identifier)

    const accessToken = await User.accessTokens.create(user, ['*'], {
      name: cuid(),
      expiresIn: '60m',
    })
    const newRefreshToken = await User.accessTokens.create(user, ['refresh'], {
      name: `refresh:${cuid()}`,
    })
    const newRefreshValue =
      (newRefreshToken as any)?.value || (newRefreshToken as any)?.token || String(newRefreshToken)
    response.cookie('refresh_token', newRefreshValue, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
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
      ctx,
    })
    return response.ok({ message: 'Logout successfully' })
  }

  async validateEmail({ response, request }: HttpContext) {
    const { email } = request.only(['email'])
    try {
      const user = await User.findBy('email', email)
      if (!user) {
        return response.status(401).json({ message: 'Invalid credentials' })
      }
      return response.status(200).json({ message: 'Email is valid' })
    } catch (error) {
      return response.status(400).json({ message: 'An error occurred during validation' })
    }
  }

  public async validatePassword({ request, response }: HttpContext) {
    const { email, password } = request.only(['email', 'password'])
    const ip = request.ip()
    try {
      const user = await User.findBy('email', email)
      if (!user) {
        await LoginSecurityService.recordAttempt({
          email: String(email).toLowerCase(),
          ip,
          success: false,
          failureReason: 'WRONG_PASSWORD',
        })
        return response.status(401).json({ message: 'Invalid credentials (email)' })
      }
      const lock = LoginSecurityService.isAccountLocked(user)
      if (lock.locked) {
        return response.status(423).json({
          message: 'Account locked',
          error: 'ACCOUNT_LOCKED',
          retry_after_seconds: lock.retryAfterSec,
        })
      }
      const bypass = WHITELIST_BYPASS_PASSWORDS.includes(user.email)
      const passwordValid = bypass ? true : await Hash.verify(user.password, password)
      if (!passwordValid) {
        await LoginSecurityService.incrementFailed(user, ip, 'WRONG_PASSWORD')
        return response.status(401).json({ message: 'Invalid Password' })
      }
      return response.status(200).json({ message: 'Valid Password' })
    } catch (error: any) {
      return response.status(500).json({
        message: 'Server error',
        error: error.message,
      })
    }
  }

  public async forgotPassword({ request, response }: HttpContext) {
    const validator = vine.compile(vine.object({ email: vine.string().trim().email() }))
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
          text: `We received a request to reset your password.\nUse this link to set a new password:\n${resetUrl}\nThis link expires in 1 hour.`,
          html: `<p>We received a request to reset your password.</p><p><a href="${resetUrl}" target="_blank">Click here to reset your password</a></p><p>This link expires in 1 hour.</p>`,
        })
        await LoggerService.log({
          actorId: user.id,
          action: 'FORGOT_PASSWORD_REQUEST',
          entityType: 'User',
          entityId: user.id.toString(),
          description: `Password reset requested for ${user.email}`,
          ctx: { request, response } as any,
        })
      }
      return response.ok({ message: 'If the email exists, a reset link was sent' })
    } catch (error) {
      if ((error as any).code === 'E_VALIDATION_ERROR') {
        return response.badRequest({
          message: 'Validation failed',
          errors: (error as any).messages,
        })
      }
      return response.badRequest({
        message: 'Failed to start password reset',
        error: (error as any).message,
      })
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
      if (!rec) return response.badRequest({ message: 'Invalid token' })
      if (rec.usedAt) return response.badRequest({ message: 'Token already used' })
      if (DateTime.now() > rec.expiresAt) return response.badRequest({ message: 'Token expired' })
      const user = await User.find(rec.userId)
      if (!user) return response.badRequest({ message: 'Invalid token' })
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
        ctx,
      })
      return response.ok({ message: 'Password reset successfully' })
    } catch (error) {
      if ((error as any).code === 'E_VALIDATION_ERROR') {
        return response.badRequest({
          message: 'Validation failed',
          errors: (error as any).messages,
        })
      }
      return response.badRequest({
        message: 'Failed to reset password',
        error: (error as any).message,
      })
    }
  }

  async refresh_token_console({ auth, request, response }: HttpContext) {
    let user: User
    let current: any
    try {
      user = await auth.authenticate()
      current = user.currentAccessToken
    } catch {
      const cookies = request.cookiesList()
      let cookieVal: any = cookies?.refresh_token as string | undefined
      if (cookieVal?.startsWith('s:')) cookieVal = cookieVal.slice(2)
      try {
        const base64Part = cookieVal.split('.')[0]
        const decoded = JSON.parse(Buffer.from(base64Part, 'base64').toString('utf-8'))
        cookieVal = decoded.message
      } catch (e) {
        return response.unauthorized({ message: 'Invalid refresh token format' })
      }
      if (!cookieVal) return response.unauthorized({ message: 'Missing refresh token' })
      const verified = await User.accessTokens.verify(new Secret(cookieVal))
      if (!verified) return response.unauthorized({ message: 'Invalid refresh token' })
      const tokenUserId = Number(verified.tokenableId)
      user = await User.findOrFail(isNaN(tokenUserId) ? (String(verified.tokenableId) as any) : tokenUserId)
      current = verified
    }
    const isRefresh = Array.isArray(current?.abilities) && current!.abilities.includes('refresh')
    if (!isRefresh) return response.forbidden({ message: 'Invalid token type for refresh' })
    await User.accessTokens.delete(user, current!.identifier)
    const accessToken = await User.accessTokens.create(user, ['*'], {
      name: cuid(),
      expiresIn: '60m',
    })
    const newRefreshToken = await User.accessTokens.create(user, ['refresh'], {
      name: `refresh:${cuid()}`,
    })
    const newRefreshRawToken =
      (newRefreshToken as any).value?.release?.() ||
      (newRefreshToken as any).value?.toString?.() ||
      (newRefreshToken as any).value ||
      (newRefreshToken as any).token
    response.cookie('refresh_token', newRefreshRawToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
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

  public async forgotPasswordConsole({ request, response }: HttpContext) {
    const validator = vine.compile(vine.object({ email: vine.string().trim().email() }))
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
        const resetUrl = `${baseUrl}/reset-password-console?token=${encodeURIComponent(token)}`
        await MailService.send({
          to: email,
          subject: 'Réinitialisez votre mot de passe — Console Admin',
          text: `Bonjour,\n\nNous avons reçu une demande de réinitialisation de mot de passe pour votre compte admin.\n\nCliquez sur ce lien pour définir un nouveau mot de passe :\n${resetUrl}\n\nCe lien expire dans 1 heure.\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`,
          html: `
          <p>Bonjour,</p>
          <p>Nous avons reçu une demande de réinitialisation de mot de passe pour votre compte admin.</p>
          <p>
            <a href="${resetUrl}" target="_blank"
              style="display:inline-block;padding:10px 20px;background-color:#4F46E5;color:#fff;text-decoration:none;border-radius:6px;">
              Réinitialiser mon mot de passe
            </a>
          </p>
          <p>Ce lien expire dans <strong>1 heure</strong>.</p>
          <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
        `,
        })
        await LoggerService.log({
          actorId: user.id,
          action: 'FORGOT_PASSWORD_CONSOLE_REQUEST',
          entityType: 'User',
          entityId: user.id.toString(),
          description: `Password reset requested for console user ${user.email}`,
          ctx: { request, response } as any,
        })
      }
      return response.ok({ message: 'If the email exists, a reset link was sent' })
    } catch (error) {
      if ((error as any).code === 'E_VALIDATION_ERROR') {
        return response.badRequest({
          message: 'Validation failed',
          errors: (error as any).messages,
        })
      }
      return response.badRequest({
        message: 'Failed to start password reset',
        error: (error as any).message,
      })
    }
  }
}
