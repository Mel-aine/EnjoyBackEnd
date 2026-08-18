import { DateTime } from 'luxon'
import crypto from 'node:crypto'
import User from '#models/user'
import LoginAttempt, { type FailureReason } from '#models/login_attempt'

export const LOCKOUT_CONFIG = {
  WINDOW_MINUTES: 15,
  MAX_ATTEMPTS: 5,
  FIRST_LOCK_MINUTES: 15,
  SECOND_LOCK_MINUTES: 60,
  THIRD_LOCK_HOURS: 24,
  RATE_LIMIT_PER_IP_PER_MIN: 20,
} as const

type ScrapingBucket = { count: number; windowStart: number }
const _ipScrapingBuckets = new Map<string, ScrapingBucket>()

export type LockStatus = {
  locked: boolean
  remainingMs: number
  reason?: string
  retryAfterSec?: number
}

export type RateLimitResult = {
  ok: boolean
  retryAfterSec?: number
}

export default class LoginSecurityService {
  static async recordAttempt(params: {
    email: string
    ip: string
    success: boolean
    failureReason?: FailureReason
    userAgent?: string
    userId?: number
  }) {
    const { email, ip, success, failureReason, userAgent, userId } = params

    await LoginAttempt.create({
      email: email.toLowerCase().trim(),
      ipAddress: ip,
      userAgent: userAgent ?? null,
      success,
      failureReason: success ? null : failureReason ?? null,
      userId: userId ?? null,
    })

    if (userId) {
      try {
        const user = await User.find(userId)
        if (user) {
          if (!success) {
            user.loginAttemptsCount = (user.loginAttemptsCount || 0) + 1
            user.lastFailedLoginAt = DateTime.now()
          }
          await user.save()
        }
      } catch {
        // ignore transient errors
      }
    }
  }

  static isAccountLocked(user: Pick<User, 'lockedUntil' | 'lockReason'>): LockStatus {
    if (!user.lockedUntil) {
      return { locked: false, remainingMs: 0 }
    }
    const now = DateTime.now()
    if (now < user.lockedUntil) {
      const remainingMs = user.lockedUntil.diff(now).toMillis()
      return {
        locked: true,
        remainingMs,
        reason: user.lockReason ?? undefined,
        retryAfterSec: Math.max(1, Math.ceil(remainingMs / 1000)),
      }
    }
    return { locked: false, remainingMs: 0 }
  }

  static async checkRateLimit(email: string, ip: string): Promise<RateLimitResult> {
    const since = DateTime.now().minus({ minutes: LOCKOUT_CONFIG.WINDOW_MINUTES })
    const rows = await LoginAttempt.query()
      .where((q) => {
        q.where('email', email.toLowerCase().trim())
        q.andWhere('ip_address', ip)
      })
      .andWhere('success', false)
      .andWhere('created_at', '>=', since.toSQL() as any)
      .count('* as total')

    const count = Number((rows[0] as any)?.$extras?.total ?? 0)
    if (count >= LOCKOUT_CONFIG.MAX_ATTEMPTS) {
      return { ok: false, retryAfterSec: LOCKOUT_CONFIG.WINDOW_MINUTES * 60 }
    }
    return { ok: true }
  }

  static async lockAccount(user: User, durationMinutes: number, reason: string) {
    user.lockedUntil = DateTime.now().plus({ minutes: durationMinutes })
    user.lockReason = reason
    user.loginAttemptsCount = LOCKOUT_CONFIG.MAX_ATTEMPTS
    await user.save()

  }

  static async countRecentLocks(userId: number): Promise<number> {
    const dayAgo = DateTime.now().minus({ hours: LOCKOUT_CONFIG.THIRD_LOCK_HOURS })
    const rows = await LoginAttempt.query()
      .where('user_id', userId)
      .andWhere('failure_reason', 'ACCOUNT_LOCKED')
      .andWhere('created_at', '>=', dayAgo.toSQL() as any)
      .count('* as total')
    return Number((rows[0] as any)?.$extras?.total ?? 0)
  }

  static async incrementFailed(
    userOrEmail: User | string,
    ip: string,
    reason: FailureReason,
    userAgent?: string
  ) {
    let user: User | null = null
    let email: string

    if (typeof userOrEmail === 'string') {
      email = userOrEmail.toLowerCase().trim()
      user = await User.findBy('email', email)
    } else {
      user = userOrEmail
      email = user.email
    }

    await this.recordAttempt({
      email,
      ip,
      success: false,
      failureReason: reason,
      userAgent,
      userId: user?.id,
    })

    if (!user) {
      return { locked: false, attempts: 0 }
    }



    const since = DateTime.now().minus({ minutes: LOCKOUT_CONFIG.WINDOW_MINUTES })

     const recentFails = await LoginAttempt.query()
      .where('user_id', user.id)
      .andWhere('success', false)
      .andWhere('created_at', '>=', since.toSQL() as any)
      .count('* as total')

    const attempts = Number((recentFails[0] as any)?.$extras?.total ?? 0)


    let locked = false
    if (attempts >= LOCKOUT_CONFIG.MAX_ATTEMPTS && !this.isAccountLocked(user).locked) {
      const recentLocks = await this.countRecentLocks(user.id)
      let minutes = LOCKOUT_CONFIG.FIRST_LOCK_MINUTES
      if (recentLocks >= 2) {
        minutes = LOCKOUT_CONFIG.THIRD_LOCK_HOURS * 60
        // also log special suspicious event via failureReason
      } else if (recentLocks >= 1) {
        minutes = LOCKOUT_CONFIG.SECOND_LOCK_MINUTES
      }
      await this.lockAccount(
        user,
        minutes,
        `Too many failed login attempts (${attempts}) in ${LOCKOUT_CONFIG.WINDOW_MINUTES}min — lock ${minutes}min`
      )
      await LoginAttempt.create({
        email: user.email,
        ipAddress: ip,
        userAgent: userAgent ?? null,
        success: false,
        failureReason: 'ACCOUNT_LOCKED',
        userId: user.id,
      })
      locked = true
    }

    return { locked, attempts }
  }

  static async resetFailedAttempts(user: User, ip?: string, userAgent?: string) {
    user.loginAttemptsCount = 0
    user.lastFailedLoginAt = null
    user.lockedUntil = null
    user.lockReason = null
    if (ip) user.lastLoginIp = ip
    if (userAgent) user.lastLoginUserAgent = userAgent
    user.lastLogin = DateTime.now()
    await user.save()
  }

  static checkScrapingRate(ip: string): RateLimitResult {
    const now = Date.now()
    const oneMin = 60 * 1000
    const bucket = _ipScrapingBuckets.get(ip)
    if (!bucket || now - bucket.windowStart >= oneMin) {
      _ipScrapingBuckets.set(ip, { count: 1, windowStart: now })
      return { ok: true }
    }
    bucket.count += 1
    if (bucket.count > LOCKOUT_CONFIG.RATE_LIMIT_PER_IP_PER_MIN) {
      const retryAfterSec = Math.max(1, Math.ceil((bucket.windowStart + oneMin - now) / 1000))
      return { ok: false, retryAfterSec }
    }
    return { ok: true }
  }

  static constantTimeEquals(a: string, b: string): boolean {
    const aBuf = Buffer.from(a)
    const bBuf = Buffer.from(b)
    if (aBuf.length !== bBuf.length) return false
    return crypto.timingSafeEqual(aBuf, bBuf)
  }
}
