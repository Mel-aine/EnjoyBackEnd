import { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import Hash from '@adonisjs/core/services/hash'
import TwoFactorAuthService from '#services/two_factor_auth_service'
import LoggerService from '#services/logger_service'
import User from '#models/user'

export default class MfaController {
  private _resSuccess<T = any>(data: T, message = 'Success') {
    return { status: 'success' as const, message, data }
  }
  private _resError(message: string, code: number, error?: string, extras?: any) {
    return { status: 'error' as const, message, error, statusCode: code, ...(extras ?? {}) }
  }

  async listMethods({ auth, response }: HttpContext) {
    const user = (await auth.authenticate()) as User
    const methods = await TwoFactorAuthService.getAvailableMethods(user)
    const enabled = await TwoFactorAuthService.isMfaEnabled(user)
    const hints = await TwoFactorAuthService.getRecoveryHints(user)
    return response.ok(
      this._resSuccess({
        mfa_enabled_overall: enabled,
        methods,
        has_recovery_codes: hints.length > 0,
        recovery_codes: hints,
      })
    )
  }

  async setupTotp({ auth, response }: HttpContext) {
    const user = (await auth.authenticate()) as User
    const out = await TwoFactorAuthService.generateTotpSetup(user)
    return response.ok(
      this._resSuccess({
        secret: out.secret,
        otpauth_url: out.otpauthUrl,
        qr_code_b64: out.qrCodeB64,
      })
    )
  }

  async confirmTotp({ auth, request, response }: HttpContext) {
    const user = (await auth.authenticate()) as User
    const validator = vine.compile(
      vine.object({
        code: vine.string().minLength(6).maxLength(6).regex(/^\d+$/),
        secret: vine.string().minLength(16).maxLength(64),
        label: vine.string().maxLength(100).optional(),
      })
    )
    try {
      const body = await request.validateUsing(validator)
      const result = await TwoFactorAuthService.confirmTotp(user, body.code, body.secret, body.label)
      await LoggerService.log({
        actorId: user.id,
        action: 'MFA_METHOD_ENABLED',
        entityType: 'MfaMethod',
        entityId: String(result.method.id),
        description: `MFA TOTP method enabled (${result.method.label ?? 'default'})`,
        ctx: { request, response } as any,
      })
      return response.status(201).json(
        this._resSuccess({
          method: {
            id: result.method.id,
            type: result.method.methodType,
            label: result.method.label,
            is_default: result.method.isDefault,
            is_verified: result.method.isVerified,
          },
          recovery_codes: result.recoveryCodes,
        })
      )
    } catch (err: any) {
      if (err?.code === 'E_VALIDATION_ERROR') {
        return response.badRequest(this._resError('Validation failed', 422, 'VALIDATION_ERROR', err.messages))
      }
      if (err?.code === 'INVALID_TOTP_CODE') {
        return response.unauthorized(this._resError('Invalid TOTP code', 401, 'INVALID_TOTP_CODE'))
      }
      return response.internalServerError(
        this._resError('Failed to enable TOTP', 500, 'TOTP_SETUP_FAILED', err.message)
      )
    }
  }

  // async enableEmail({ auth, response }: HttpContext) {
  //   const user = (await auth.authenticate()) as User
  //   try {
  //     const method = await TwoFactorAuthService.enableEmailMethod(user)
  //     await TwoFactorAuthService.generateEmailChallenge(user)
  //     await LoggerService.log({
  //       actorId: user.id,
  //       action: 'MFA_METHOD_ENABLED',
  //       entityType: 'MfaMethod',
  //       entityId: String(method.id),
  //       description: 'MFA EMAIL method enabled',
  //       ctx: { request: {} as any, response } as any,
  //     })
  //     return response.status(201).json(
  //       this._resSuccess({
  //         method: {
  //           id: method.id,
  //           type: method.methodType,
  //           label: method.label,
  //           is_default: method.isDefault,
  //         },
  //       })
  //     )
  //   } catch (err: any) {
  //     if (err?.code === 'EMAIL_NOT_VERIFIED') {
  //       return response.forbidden(this._resError('Email must be verified first', 403, 'EMAIL_NOT_VERIFIED'))
  //     }
  //     return response.internalServerError(
  //       this._resError('Failed to enable email MFA', 500, 'EMAIL_MFA_FAILED', err.message)
  //     )
  //   }
  // }

  async sendEmailEnrollmentCode({ auth, response }: HttpContext) {
    const user = (await auth.authenticate()) as User
    if (!user.emailVerified) {
      return response.forbidden(this._resError('Email must be verified first', 403, 'EMAIL_NOT_VERIFIED'))
    }
    try {
      const { challengeId, expiresAt } = await TwoFactorAuthService.generateEmailChallenge(user)
      return response.ok(
        this._resSuccess({
          challenge_id: challengeId,
          expires_in_seconds: Math.max(1, Math.floor(expiresAt.diffNow('seconds').seconds ?? 300)),
        })
      )
    } catch (err: any) {
      return response.internalServerError(
        this._resError('Failed to send code', 500, 'EMAIL_MFA_SEND_FAILED', err.message)
      )
    }
  }

  async confirmEmailEnrollment({ auth, request, response }: HttpContext) {
    const user = (await auth.authenticate()) as User
    const validator = vine.compile(
      vine.object({
        challenge_id: vine.string().minLength(5),
        code: vine.string().minLength(4).maxLength(16),
      })
    )
    try {
        const body = await request.validateUsing(validator)
      const result = await TwoFactorAuthService.verifyChallenge(body.challenge_id, body.code)
      if (!result.valid || result.userId !== user.id) {
        return response.status(401).json(
          this._resError('Invalid or expired code', 401, `MFA_${result.failReason ?? 'INVALID_CODE'}`)
        )
      }
      const method = await TwoFactorAuthService.enableEmailMethod(user, body.challenge_id)
      await LoggerService.log({
        actorId: user.id,
        action: 'MFA_METHOD_ENABLED',
        entityType: 'MfaMethod',
        entityId: String(method.id),
        description: 'MFA EMAIL method enabled',
        ctx: { request, response } as any,
      })
      return response.status(201).json(
        this._resSuccess({
          method: {
            id: method.id,
            type: method.methodType,
            label: method.label,
            is_default: method.isDefault,
          },
        })
      )
    } catch (err: any) {
      if (err?.code === 'E_VALIDATION_ERROR') {
        return response.badRequest(this._resError('Validation failed', 422, 'VALIDATION_ERROR', err.messages))
      }
      if (err?.code === 'EMAIL_ENROLLMENT_NOT_VERIFIED') {
        return response.unauthorized(this._resError('Enrollment not verified', 401, 'EMAIL_ENROLLMENT_NOT_VERIFIED'))
      }
      return response.internalServerError(
        this._resError('Failed to enable email MFA', 500, 'EMAIL_MFA_FAILED', err.message)
      )
    }
  }

  async disableMethod({ auth, request, response, params }: HttpContext) {
    const user = (await auth.authenticate()) as User
    const bodyValidator = vine.compile(
      vine.object({ current_password: vine.string().minLength(1) })
    )
    const methodId = Number(params.id)
    if (!Number.isFinite(methodId) || methodId <= 0) {
      return response.badRequest(this._resError('Invalid method id', 400, 'INVALID_METHOD_ID'))
    }
    try {
      const body = await request.validateUsing(bodyValidator)
      const ok = await Hash.verify(user.password, body.current_password)
      if (!ok) {
        return response.forbidden(this._resError('Invalid password', 403, 'INVALID_PASSWORD'))
      }
      await TwoFactorAuthService.disableMethod(user, methodId)
      await LoggerService.log({
        actorId: user.id,
        action: 'MFA_METHOD_DISABLED',
        entityType: 'MfaMethod',
        entityId: String(methodId),
        description: 'MFA method disabled',
        ctx: { request, response } as any,
      })
      return response.ok(this._resSuccess(null, 'MFA method disabled'))
    } catch (err: any) {
      if (err?.code === 'E_VALIDATION_ERROR') {
        return response.badRequest(this._resError('Validation failed', 422, 'VALIDATION_ERROR', err.messages))
      }
      if (err?.message === 'METHOD_NOT_FOUND') {
        return response.notFound(this._resError('Method not found', 404, 'METHOD_NOT_FOUND'))
      }
      return response.internalServerError(
        this._resError('Failed to disable MFA method', 500, 'MFA_DISABLE_FAILED', err.message)
      )
    }
  }

  async setDefault({ auth, response, params }: HttpContext) {
    const user = (await auth.authenticate()) as User
    const methodId = Number(params.id)
    if (!Number.isFinite(methodId) || methodId <= 0) {
      return response.badRequest(this._resError('Invalid method id', 400, 'INVALID_METHOD_ID'))
    }
    try {
      await TwoFactorAuthService.setDefaultMethod(user, methodId)
      return response.ok(this._resSuccess(null, 'Default method updated'))
    } catch (err: any) {
      if (err.message === 'METHOD_NOT_FOUND')
        return response.notFound(this._resError('Method not found', 404, 'METHOD_NOT_FOUND'))
      if (err.message === 'METHOD_NOT_VERIFIED')
        return response.badRequest(this._resError('Method not verified', 400, 'METHOD_NOT_VERIFIED'))
      return response.internalServerError(
        this._resError('Failed to update default MFA method', 500, 'MFA_DEFAULT_FAILED', err.message)
      )
    }
  }

  async getRecoveryCodes({ auth, response }: HttpContext) {
    const user = (await auth.authenticate()) as User
    if (!(await TwoFactorAuthService.isMfaEnabled(user))) {
      return response.badRequest(this._resError('MFA not enabled', 400, 'MFA_NOT_ENABLED'))
    }
    const hints = await TwoFactorAuthService.getRecoveryHints(user)
    return response.ok(this._resSuccess(hints))
  }

  async regenerateRecoveryCodes({ auth, request, response }: HttpContext) {
    const user = (await auth.authenticate()) as User
    const validator = vine.compile(vine.object({ current_password: vine.string().minLength(1) }))
    try {
      const body = await request.validateUsing(validator)
      const ok = await Hash.verify(user.password, body.current_password)
      if (!ok) {
        return response.forbidden(this._resError('Invalid password', 403, 'INVALID_PASSWORD'))
      }
      const codes = await TwoFactorAuthService.generateRecoveryCodes(user)
      await LoggerService.log({
        actorId: user.id,
        action: 'RECOVERY_CODES_REGENERATED',
        entityType: 'User',
        entityId: String(user.id),
        description: 'Recovery codes regenerated',
        ctx: { request, response } as any,
      })
      return response.ok(this._resSuccess({ recovery_codes: codes }))
    } catch (err: any) {
      if (err?.code === 'E_VALIDATION_ERROR') {
        return response.badRequest(this._resError('Validation failed', 422, 'VALIDATION_ERROR', err.messages))
      }
      return response.internalServerError(
        this._resError('Failed to regenerate codes', 500, 'RECOVERY_REGEN_FAILED', err.message)
      )
    }
  }
}
