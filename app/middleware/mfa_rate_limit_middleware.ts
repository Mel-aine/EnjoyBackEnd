import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { DateTime } from 'luxon'
import LoginSecurityService from '#services/login_security_service'
import TwoFactorAuthService from '#services/two_factor_auth_service'
import MfaChallenge from '#models/mfa_challenge'
import User from '#models/user'

const MFA_VERIFY_MAX_PER_CHALLENGE = 5
const MFA_RECOVERY_MAX_PER_15MIN = 5

export default class MfaRateLimitMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const { request, response } = ctx
    const ip = request.ip()

    const scrape = LoginSecurityService.checkScrapingRate(ip)
    if (!scrape.ok) {
      response.header('Retry-After', String(scrape.retryAfterSec ?? 60))
      return response.status(429).json({
        status: 'error',
        message: 'Too many requests.',
        error: 'TOO_MANY_REQUESTS_PER_IP',
        retry_after_seconds: scrape.retryAfterSec ?? 60,
      })
    }

    const path = String(request.url() ?? '')
    const method = String(request.method() ?? '').toUpperCase()

    // POST /mfa/email/send
    if (method === 'POST' && path.includes('/mfa/email/send')) {
      const body = request.body() as any
      const challengeId = body?.mfa_challenge_id
      if (challengeId) {
        const ch = await MfaChallenge.query().where('challenge_id', challengeId).first()
        if (ch) {
          const user = await User.find(ch.userId)
          if (user) {
            const status = await TwoFactorAuthService.getSendEmailStatus(user)
            if (!status.canSend) {
              response.header('Retry-After', String(status.retryAfterSec ?? 60))
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
          }
        }
      }
    }

    // POST /mfa/verify
    if (method === 'POST' && path.includes('/mfa/verify')) {
      const body = request.body() as any
      const challengeId = body?.mfa_challenge_id
      if (challengeId) {
        const ch = await MfaChallenge.query().where('challenge_id', challengeId).first()
        if (ch) {
          if (ch.attempts >= MFA_VERIFY_MAX_PER_CHALLENGE) {
            ch.isConsumed = true
            await ch.save()
            return response.status(429).json({
              status: 'error',
              message: 'Too many MFA attempts on this challenge.',
              error: 'MFA_VERIFY_RATE_LIMIT',
            })
          }
        }
      }
    }

    // POST /mfa/recovery/use
    if (method === 'POST' && path.includes('/mfa/recovery/use')) {
      const body = request.body() as any
      const email = String(body?.email ?? '').trim().toLowerCase()
      if (email) {
        const since = DateTime.now().minus({ minutes: 15 })
        const { default: LoginAttemptModel } = await import('#models/login_attempt')
        const rows: any = await LoginAttemptModel.query()
          .where('email', email)
          .andWhere('failure_reason', 'MFA_FAILED')
          .andWhere('created_at', '>=', since.toSQL() as any)
          .count('* as total')
        const count = Number(rows?.[0]?.total ?? 0)
        if (count >= MFA_RECOVERY_MAX_PER_15MIN) {
          return response.status(429).json({
            status: 'error',
            message: 'Too many recovery code attempts.',
            error: 'MFA_RECOVERY_RATE_LIMIT',
            retry_after_seconds: 900,
          })
        }
      }
    }

    return next()
  }
}
