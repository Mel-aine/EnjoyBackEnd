import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Simple in-memory rate limiter for sync operations
 * Limits to 10 requests per minute per user+device
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

export default class SyncRateLimitMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const user = ctx.auth.user
    if (!user) {
      return ctx.response.unauthorized({ message: 'Authentication required' })
    }

    const deviceId = ctx.request.input('deviceId', 'unknown')
    const key = `sync:${user.id}:${deviceId}`
    const now = Date.now()

    const entry = rateLimitMap.get(key)

    if (!entry || now > entry.resetAt) {
      // Reset window
      rateLimitMap.set(key, { count: 1, resetAt: now + 60_000 })
      return next()
    }

    if (entry.count >= 10) {
      return ctx.response.tooManyRequests({
        message: 'Too many sync requests. Please wait before syncing again.',
        retryAfter: Math.ceil((entry.resetAt - now) / 1000),
        code: 'SYNC_RATE_LIMITED',
      })
    }

    entry.count++
    return next()
  }
}
