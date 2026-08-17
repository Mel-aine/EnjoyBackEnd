import { DateTime } from 'luxon'
import crypto from 'node:crypto'
import { cuid } from '@adonisjs/core/helpers'
import Hash from '@adonisjs/core/services/hash'
import encryption from '@adonisjs/core/services/encryption'
import { OTP } from 'otplib'
import QRCode from 'qrcode'
import User from '#models/user'
import MfaMethod, { type MfaMethodType } from '#models/mfa_method'
import MfaChallenge, { type MfaChallengeType } from '#models/mfa_challenge'
import MfaRecoveryCode from '#models/mfa_recovery_code'
import MailService from '#services/mail_service'

const totp = new OTP({
  strategy: 'totp',
})
const TOTP_DEFAULTS = {
  digits: 6 as const,
  period: 30,
  algorithm: 'sha1' as const,
  // Tolérance : ±30s (soit 1 période avant/après en secondes)
  epochTolerance: 30,
}

const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const RECOVERY_COUNT = 8
const RECOVERY_LENGTH = 8
const EMAIL_CHALLENGE_TTL_MINUTES = 5
const EMAIL_CHALLENGE_MAX_ATTEMPTS = 3
const EMAIL_SEND_MIN_INTERVAL_SEC = 60
const EMAIL_SEND_MAX_PER_10MIN = 3

export type EmailChallengeResult = {
  challengeId: string
  code: string
  expiresAt: DateTime
}

export type VerifyChallengeResult = {
  valid: boolean
  userId?: number
  failReason?: 'NOT_FOUND' | 'EXPIRED' | 'TOO_MANY_ATTEMPTS' | 'INVALID_CODE' | 'ALREADY_CONSUMED'
  attemptsLeft?: number
}

export type TotpSetupResult = {
  secret: string
  otpauthUrl: string
  qrCodeB64: string
}

export type ConfirmTotpResult = {
  method: MfaMethod
  recoveryCodes: string[]
}

export type RecoveryHint = {
  id: number
  codeHint: string
  usedAt: DateTime | null
}

export default class TwoFactorAuthService {
  // =======================
  // MFA global
  // =======================
  static async isMfaEnabled(user: User): Promise<boolean> {
    const count = await MfaMethod.query()
      .where('user_id', user.id)
      .andWhere('is_verified', true)
      .count('* as total')
    return Number((count as any)[0]?.total ?? 0) > 0
  }

  static async getAvailableMethods(user: User) {
    const rows = await MfaMethod.query()
      .where('user_id', user.id)
      .andWhere('is_verified', true)
      .orderBy('is_default', 'desc')
      .orderBy('id', 'asc')
    return rows.map((r) => ({
      id: r.id,
      type: r.methodType,
      is_default: r.isDefault,
      is_verified: r.isVerified,
      label: r.label ?? null,
      last_used_at: r.lastUsedAt?.toISO() ?? null,
    }))
  }

  static async getDefaultMethod(user: User): Promise<MfaMethod | null> {
    const found = await MfaMethod.query()
      .where('user_id', user.id)
      .andWhere('is_verified', true)
      .andWhere('is_default', true)
      .first()
    if (found) return found
    return (
      (await MfaMethod.query()
        .where('user_id', user.id)
        .andWhere('is_verified', true)
        .orderBy('id', 'asc')
        .first()) ?? null
    )
  }

  static async setDefaultMethod(user: User, methodId: number) {
    const target = await MfaMethod.query()
      .where('id', methodId)
      .andWhere('user_id', user.id)
      .first()
    if (!target) throw new Error('METHOD_NOT_FOUND')
    if (!target.isVerified) throw new Error('METHOD_NOT_VERIFIED')
    await MfaMethod.query().where('user_id', user.id).update({ is_default: false })
    target.isDefault = true
    await target.save()
  }

  static async disableMethod(user: User, methodId: number) {
    const rows = await MfaMethod.query()
      .where('id', methodId)
      .andWhere('user_id', user.id)
      .delete()
    if (!rows || (rows as any) < 1) throw new Error('METHOD_NOT_FOUND')
    const remaining = await MfaMethod.query()
      .where('user_id', user.id)
      .andWhere('is_verified', true)
    if (remaining.length === 0) {
      user.twoFactorEnabled = false
      await user.save()
    } else if (!remaining.find((r) => r.isDefault)) {
      remaining[0].isDefault = true
      await remaining[0].save()
    }
  }

  // =======================
  // TOTP
  // =======================
  static async generateTotpSetup(user: User): Promise<TotpSetupResult> {
    // classe OTP.generateSecret(length: number) — 20 octets (160 bits) RFC 6238
    const secret = totp.generateSecret(20)
    const issuer = 'Enjoy PMS'
    const label = `Enjoy:${user.email}`
    const otpauthUrl = totp.generateURI({
      secret,
      label,
      issuer,
      digits: TOTP_DEFAULTS.digits,
      period: TOTP_DEFAULTS.period,
      algorithm: TOTP_DEFAULTS.algorithm,
    })
    const qrCodeB64 = await QRCode.toDataURL(otpauthUrl, {
      width: 280,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    })
    return { secret, otpauthUrl, qrCodeB64 }
  }

  static async confirmTotp(
    user: User,
    code: string,
    secret: string,
    label?: string
  ): Promise<ConfirmTotpResult> {
    const result = totp.verifySync({
      token: code,
      secret,
      digits: TOTP_DEFAULTS.digits,
      period: TOTP_DEFAULTS.period,
      algorithm: TOTP_DEFAULTS.algorithm,
      epochTolerance: TOTP_DEFAULTS.epochTolerance,
    })
    if (!result || !result.valid) {
      const err: any = new Error('INVALID_TOTP_CODE')
      err.code = 'INVALID_TOTP_CODE'
      throw err
    }
    await MfaMethod.query()
      .where('user_id', user.id)
      .andWhere('method_type', 'TOTP')
      .delete()
    const encrypted = encryption.encrypt(secret)
    const otherMethods = await MfaMethod.query().where('user_id', user.id).andWhere('is_verified', true)
    const method = await MfaMethod.create({
      userId: user.id,
      methodType: 'TOTP',
      totpSecret: encrypted,
      label: label ?? 'Google Authenticator',
      isVerified: true,
      isDefault: otherMethods.length === 0,
      lastUsedAt: DateTime.now(),
    })
    user.twoFactorEnabled = true
    await user.save()

    const hasAny =
      (await MfaRecoveryCode.query().where('user_id', user.id).count('* as total') as any)[0]
        ?.total > 0
    const recoveryCodes = hasAny ? [] : await this.generateRecoveryCodes(user)
    return { method, recoveryCodes }
  }

  static async verifyTotp(user: User, code: string): Promise<boolean> {
    const method = await MfaMethod.query()
      .where('user_id', user.id)
      .andWhere('method_type', 'TOTP')
      .andWhere('is_verified', true)
      .first()
    if (!method || !method.totpSecret) return false
    try {
      const secret = encryption.decrypt(method.totpSecret) as string
      const result = totp.verifySync({
        token: code,
        secret,
        digits: TOTP_DEFAULTS.digits,
        period: TOTP_DEFAULTS.period,
        algorithm: TOTP_DEFAULTS.algorithm,
        epochTolerance: TOTP_DEFAULTS.epochTolerance,
      })
      if (result && result.valid) {
        method.lastUsedAt = DateTime.now()
        await method.save()
        return true
      }
      return false
    } catch {
      return false
    }
  }

  // =======================
  // EMAIL method
  // =======================
  static async enableEmailMethod(user: User): Promise<MfaMethod> {
    if (!user.emailVerified) {
      const err: any = new Error('EMAIL_NOT_VERIFIED')
      err.code = 'EMAIL_NOT_VERIFIED'
      throw err
    }
    let method = await MfaMethod.query()
      .where('user_id', user.id)
      .andWhere('method_type', 'EMAIL')
      .first()
    const others = await MfaMethod.query().where('user_id', user.id).andWhere('is_verified', true)
    if (!method) {
      method = await MfaMethod.create({
        userId: user.id,
        methodType: 'EMAIL',
        isVerified: true,
        isDefault: others.length === 0,
        label: user.email,
      })
    } else {
      method.isVerified = true
      method.label = user.email
      await method.save()
    }
    user.twoFactorEnabled = true
    await user.save()
    return method
  }

  static async getSendEmailStatus(user: User): Promise<{
    canSend: boolean
    retryAfterSec?: number
    count10min: number
    lastSentAt?: DateTime
  }> {
    const now = DateTime.now()
    const tenAgo = now.minus({ minutes: 10 })
    const sent = await MfaChallenge.query()
      .where('user_id', user.id)
      .andWhere('method_type', 'EMAIL')
      .andWhere('created_at', '>=', tenAgo.toSQL() as any)
      .orderBy('created_at', 'desc')
    const count10min = sent.length
    const lastSentAt = sent[0]?.createdAt
    const minIntervalSec = EMAIL_SEND_MIN_INTERVAL_SEC
    if (lastSentAt) {
      const elapsed = Math.max(0, Math.floor(now.diff(lastSentAt, 'seconds').seconds ?? 0))
      if (elapsed < minIntervalSec) {
        return { canSend: false, retryAfterSec: minIntervalSec - elapsed, count10min, lastSentAt }
      }
    }
    if (count10min >= EMAIL_SEND_MAX_PER_10MIN) {
      const oldestWithin10 = sent[sent.length - 1]
      const retryAfterSec = oldestWithin10
        ? Math.max(0, Math.ceil(tenAgo.plus({ minutes: 10 }).diff(oldestWithin10.createdAt, 'seconds').seconds ?? 0))
        : 600
      return { canSend: false, retryAfterSec, count10min, lastSentAt }
    }
    return { canSend: true, count10min, lastSentAt }
  }

  static async generateEmailChallenge(user: User): Promise<EmailChallengeResult> {
    const code = String(crypto.randomInt(100000, 999999 + 1)).padStart(6, '0')
    const challengeId = cuid()
    const hashedCode = await Hash.make(code)
    const expiresAt = DateTime.now().plus({ minutes: EMAIL_CHALLENGE_TTL_MINUTES })
    const row = await MfaChallenge.create({
      userId: user.id,
      challengeId,
      methodType: 'EMAIL' as MfaChallengeType,
      hashedCode,
      deliveredTo: user.email,
      attempts: 0,
      isConsumed: false,
      expiresAt,
    })
    await this._sendEmailCode(user, code, EMAIL_CHALLENGE_TTL_MINUTES)
    return { challengeId: row.challengeId, code, expiresAt }
  }

  private static async _sendEmailCode(user: User, code: string, ttlMinutes: number) {
    const text = `Bonjour ${user.firstName ?? user.email},

Votre code de connexion Enjoy est : ${code}

Ce code est valable ${ttlMinutes} minutes et ne peut être utilisé qu'une seule fois.

Si vous n'êtes pas à l'origine de cette tentative de connexion, changez immédiatement votre mot de passe.

L'équipe Enjoy.`
    const html = `<!DOCTYPE html>
<html><body style="font-family:'Segoe UI',sans-serif;background:#f1f5f9;margin:0;padding:40px 20px;">
  <div style="max-width:480px;background:#ffffff;border-radius:16px;padding:40px;margin:0 auto;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="color:#475569;font-size:14px;margin-bottom:20px;">Bonjour ${user.firstName ? user.firstName : user.email},</div>
    <div style="color:#0f172a;font-size:16px;margin-bottom:24px;">Voici votre code de connexion Enjoy :</div>
    <div style="font-size:32px;letter-spacing:12px;font-weight:700;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;text-align:center;color:#4f46e5;margin-bottom:24px;">${code}</div>
    <div style="color:#64748b;font-size:13px;line-height:1.6;">Ce code est valable <strong>${ttlMinutes} minutes</strong> et ne peut être utilisé qu'une seule fois.</div>
    <div style="color:#94a3b8;font-size:12px;margin-top:24px;">Si vous n'êtes pas à l'origine de cette tentative, changez immédiatement votre mot de passe.</div>
  </div>
</body></html>`
    try {
      await MailService.send({
        to: user.email,
        subject: '[Enjoy] Votre code de connexion',
        text,
        html,
      })
    } catch (err) {
      console.error('[TwoFactorAuthService] Failed to send MFA email code to', user.email, err)
    }
  }

  static async verifyChallenge(challengeId: string, inputCode: string): Promise<VerifyChallengeResult> {
    const row = await MfaChallenge.query().where('challenge_id', challengeId).first()
    if (!row) return { valid: false, failReason: 'NOT_FOUND' }
    if (row.isConsumed) return { valid: false, failReason: 'ALREADY_CONSUMED' }
    if (DateTime.now() > row.expiresAt) return { valid: false, failReason: 'EXPIRED' }
    if (row.attempts >= EMAIL_CHALLENGE_MAX_ATTEMPTS) {
      row.isConsumed = true
      await row.save()
      return { valid: false, failReason: 'TOO_MANY_ATTEMPTS' }
    }
    row.attempts = row.attempts + 1
    await row.save()
    const ok = await Hash.verify(row.hashedCode, inputCode)
    if (ok) {
      row.isConsumed = true
      await row.save()
      const method = await MfaMethod.query()
        .where('user_id', row.userId)
        .andWhere('method_type', row.methodType as MfaMethodType)
        .first()
      if (method) {
        method.lastUsedAt = DateTime.now()
        await method.save()
      }
      return { valid: true, userId: row.userId }
    }
    return {
      valid: false,
      failReason: 'INVALID_CODE',
      attemptsLeft: Math.max(0, EMAIL_CHALLENGE_MAX_ATTEMPTS - row.attempts),
    }
  }

  // =======================
  // Recovery codes
  // =======================
  static async generateRecoveryCodes(user: User): Promise<string[]> {
    const codes: string[] = []
    for (let i = 0; i < RECOVERY_COUNT; i++) {
      codes.push(this._randomRecovery())
    }
    try {
      await MfaRecoveryCode.query().where('user_id', user.id).delete()
    } catch {
      /* ignore */
    }
    for (const code of codes) {
      const hashed = await Hash.make(code)
      await MfaRecoveryCode.create({
        userId: user.id,
        hashedCode: hashed,
        codeHint: '****' + code.slice(-4),
        usedAt: null,
      })
    }
    return codes
  }

  static async useRecoveryCode(user: User, rawCode: string): Promise<boolean> {
    const code = rawCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
    if (code.length !== RECOVERY_LENGTH) return false
    const rows = await MfaRecoveryCode.query()
      .where('user_id', user.id)
      .andWhereNull('used_at')
    for (const r of rows) {
      if (await Hash.verify(r.hashedCode, code)) {
        r.usedAt = DateTime.now()
        await r.save()
        return true
      }
    }
    return false
  }

  static async getRecoveryHints(user: User): Promise<RecoveryHint[]> {
    const rows = await MfaRecoveryCode.query()
      .where('user_id', user.id)
      .orderBy('id', 'asc')
    return rows.map((r) => ({
      id: r.id,
      codeHint: r.codeHint,
      usedAt: r.usedAt,
    }))
  }

  private static _randomRecovery(): string {
    const out: string[] = []
    for (let i = 0; i < RECOVERY_LENGTH; i++) {
      out.push(RECOVERY_ALPHABET[crypto.randomInt(0, RECOVERY_ALPHABET.length)])
    }
    return out.join('')
  }
}
