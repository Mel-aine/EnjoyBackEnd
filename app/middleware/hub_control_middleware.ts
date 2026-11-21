import crypto from 'node:crypto'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import env from '#start/env'

/**
 * Protects `/api/hub-control` (the routes the hub dashboard calls).
 *
 * Every request must carry `Authorization: Bearer <HUB_CONTROL_KEY>`, the key
 * shared with the hub through its `ENJOY_CONTROL_KEY` variable. Both values are
 * hashed with SHA-256 and compared in constant time, so the response time never
 * leaks how many characters matched.
 *
 * No key configured means the API is off: answering 503 is safer than leaving
 * it open for anyone who guesses.
 *
 * A small in-memory limit (per IP) keeps a leaked key from hammering enjoy.
 */

const MAX_REQUESTS_PER_MINUTE = 120

type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

function sha256(value: string): Buffer {
  return crypto.createHash('sha256').update(value).digest()
}

export function safeKeyEqual(given: string, expected: string): boolean {
  if (!given || !expected) return false
  const a = sha256(given)
  const b = sha256(expected)
  return crypto.timingSafeEqual(a, b)
}

function rateLimited(ip: string, now = Date.now()): boolean {
  const bucket = buckets.get(ip)
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + 60_000 })
    return false
  }
  bucket.count++
  return bucket.count > MAX_REQUESTS_PER_MINUTE
}

/** Test helper: clears the rate-limit buckets. */
export function resetHubControlRateLimit() {
  buckets.clear()
}

export default class HubControlMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const expected = env.get('HUB_CONTROL_KEY')
    if (!expected) {
      return ctx.response.serviceUnavailable({
        error: {
          code: 'not_configured',
          message: 'HUB_CONTROL_KEY is not set on this enjoy installation',
        },
      })
    }

    const header = String(ctx.request.header('authorization') ?? '').trim()
    const given = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''

    if (!safeKeyEqual(given, String(expected))) {
      return ctx.response.unauthorized({
        error: { code: 'unauthorized', message: 'Invalid control key' },
      })
    }

    if (rateLimited(ctx.request.ip())) {
      return ctx.response.tooManyRequests({
        error: { code: 'too_many_requests', message: 'Too many control requests' },
      })
    }

    return next()
  }
}
