import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import vine from '@vinejs/vine'
import LoginSecurityService from '#services/login_security_service'

const emailValidator = vine.compile(vine.object({ email: vine.string().trim().email().optional() }))

export default class LoginRateLimitMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const { request, response } = ctx
    const ip = request.ip()

    // 1) Scraping général : 20 requêtes / minute / IP
    const scrape = LoginSecurityService.checkScrapingRate(ip)
    if (!scrape.ok) {
      response.header('Retry-After', String(scrape.retryAfterSec ?? 60))
      return response.status(429).json({
        status: 'error',
        message: 'Too many requests. Please try again later.',
        error: 'TOO_MANY_REQUESTS_PER_IP',
        retry_after_seconds: scrape.retryAfterSec ?? 60,
      })
    }

    // 2) Rate limit métier sur le couple (email + ip) — si le champ email est fourni
    try {
      const body = request.body()
      const out = await emailValidator.validate(body)
      const email = (out as any)?.email
      if (email) {
        const rl = await LoginSecurityService.checkRateLimit(email, ip)
        if (!rl.ok) {
          response.header('Retry-After', String(rl.retryAfterSec ?? 900))
          return response.status(429).json({
            status: 'error',
            message: 'Too many attempts. Please try again later.',
            error: 'TOO_MANY_ATTEMPTS',
            retry_after_seconds: rl.retryAfterSec ?? 900,
          })
        }
      }
    } catch {
      // ignore validation errors on middleware-level (controller will handle)
    }

    return next()
  }
}
