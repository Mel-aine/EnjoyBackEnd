import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import Role from '#models/role'
import { createUserValidator, updateUserValidator } from '../../validators/user.js'
import { cuid } from '@adonisjs/core/helpers'
import { DateTime } from 'luxon'
import MailService from '#services/mail_service'
import PasswordResetToken from '#models/password_reset_token'

export default class UsersConsolesController {
  /**
   * GET /users
   * Query params: page, limit, search, isActive
   */
  async index({ request, response }: HttpContext) {
    const page = request.input('page', 1)
    const limit = request.input('limit', 20)
    const search = request.input('search', '')
    const isActiveRaw = request.input('isActive')

    const query = User.query().preload('role')

    // Filtre recherche
    if (search) {
      query.where((q) => {
        q.whereILike('firstName', `%${search}%`)
          .orWhereILike('lastName', `%${search}%`)
          .orWhereILike('username', `%${search}%`)
          .orWhereILike('email', `%${search}%`)
      })
    }

    // Filtre isActive
    if (isActiveRaw !== undefined && isActiveRaw !== null && isActiveRaw !== '') {
      const isActive = isActiveRaw === 'true' || isActiveRaw === true
      query.where('is_active', isActive)
    }

    const users = await query
      .whereNull('hotelId')
      .orderBy('created_at', 'desc')
      .paginate(page, limit)

    return response.ok(users)
  }

  /**
   * POST /users
   */
  // async store({ request, response }: HttpContext) {
  //   try {

  //   const payload = await request.validateUsing(createUserValidator)

  //   const user = await User.create({
  //     firstName: payload.firstName,
  //     lastName: payload.lastName,
  //     username: payload.username ?? null,
  //     email: payload.email,
  //     roleId: payload.roleId ?? null,
  //     isActive: payload.isActive ?? true,
  //   })

  //   await user.load('role')

  //   return response.created(user)
  // }  catch (error) {
  //   console.log(error)
  //     return response.internalServerError({
  //       success: false,
  //       message: 'Error creating user ',
  //       error: error.message,
  //     })
  //   }

  // }

  async store({ request, response }: HttpContext) {
    try {
      console.log('[store] Début de la création utilisateur')

      const payload = await request.validateUsing(createUserValidator)
      console.log('[store] Payload validé :', payload)

      const user = await User.create({
        firstName: payload.firstName,
        lastName: payload.lastName,
        username: payload.username ?? null,
        email: payload.email,
        roleId: payload.roleId ?? null,
        isActive: payload.isActive ?? true,
      })
      console.log('[store] Utilisateur créé :', user.toJSON())

      await user.load('role')
      console.log('[store] Rôle chargé :', user.role?.toJSON() ?? 'aucun rôle')

      const token = cuid()
      const expiresAt = DateTime.now().plus({ hours: 24 })
      console.log('[store] Token généré :', token)
      console.log('[store] Expiration du token :', expiresAt.toISO())

      await PasswordResetToken.create({
        userId: user.id,
        token,
        expiresAt,
        usedAt: null,
      })
      console.log('[store] PasswordResetToken créé en base')

      const forwardedProto = (request.header('x-forwarded-proto') || '').split(',')[0]
      const proto = forwardedProto || (request.secure() ? 'https' : request.protocol())
      const baseUrl = `${proto}://${request.host()}`
      const resetUrl = `${baseUrl}/reset-password-console?token=${encodeURIComponent(token)}`
      console.log('[store] Reset URL générée :', resetUrl)

      await MailService.send({
        to: user.email,
        subject: 'Bienvenue — Définissez votre mot de passe',
        text: `Bonjour ${user.firstName} ${user.lastName},

Votre compte a été créé avec succès.

Pour accéder à la plateforme, vous devez d'abord définir votre mot de passe en cliquant sur le lien ci-dessous :

${resetUrl}

Ce lien expire dans 24 heures.`,
        html: `
        <p>Bonjour <strong>${user.firstName} ${user.lastName}</strong>,</p>
        <p>Votre compte a été créé avec succès.</p>
        <p>Pour accéder à la plateforme, vous devez d'abord définir votre mot de passe :</p>
        <p>
          <a href="${resetUrl}" target="_blank"
            style="display:inline-block;padding:10px 20px;background-color:#4F46E5;color:#fff;text-decoration:none;border-radius:6px;">
            Définir mon mot de passe
          </a>
        </p>
        <p>Ce lien expire dans <strong>24 heures</strong>.</p>
        <p>Si vous n'êtes pas à l'origine de cette création de compte, ignorez cet email.</p>
      `,
      })
      console.log('[store] Email envoyé à :', user.email)

      console.log('[store] Création utilisateur terminée avec succès')
      return response.created(user)
    } catch (error) {
      console.log('[store] Erreur :', error)
      console.log('[store] Message :', error.message)
      console.log('[store] Stack :', error.stack)
      return response.internalServerError({
        success: false,
        message: 'Error creating user',
        error: error.message,
      })
    }
  }
  /**
   * PUT /users/:id
   */
  async update({ params, request, response }: HttpContext) {
    const user = await User.findOrFail(params.id)

    const payload = await request.validateUsing(updateUserValidator)

    user.merge({
      firstName: payload.firstName,
      lastName: payload.lastName,
      username: payload.username ?? user.username,
      email: payload.email,
      roleId: payload.roleId ?? user.roleId,
      isActive: payload.isActive ?? user.isActive,
    })

    await user.save()
    await user.load('role')

    return response.ok(user)
  }

  /**
   * DELETE /users/:id
   */
  async destroy({ params, response }: HttpContext) {
    const user = await User.findOrFail(params.id)
    await user.delete()

    return response.ok({ message: 'Utilisateur supprimé avec succès' })
  }

  /**
   * show
   */

  async show({ params, response }: HttpContext) {
    try {
      const user = await User.query()
        .where('id', params.id)
        .preload('role', (q) => {
          q.select(['id', 'role_name'])
        })
        .preload('activityLogs', (logQuery) => {
          logQuery.orderBy('created_at', 'desc').limit(20)
        })
        .firstOrFail()

      return response.ok({
        message: 'User retrieved successfully',
        data: user,
      })
    } catch (error) {
      return response.notFound({
        message: 'User not found',
        error: error.message,
      })
    }
  }

  async getCommercials({ request, response }: HttpContext) {
    const page = request.input('page', 1)
    const limit = request.input('limit', 20)
    const search = request.input('search', '')

    const commercialRoles = await Role.query()
      .whereILike('role_name', '%commercial%')
      .orWhereILike('role_name', '%sales%')
      .orWhereILike('role_name', '%sale%')
      .orWhereILike('role_name', '%resp%')
      .orWhereILike('role_name', '%responsable%')

    if (commercialRoles.length === 0) {
      return response.ok({ data: [], meta: { total: 0, page, perPage: limit } })
    }

    const roleIds = commercialRoles.map((r) => r.id)

    const query = User.query().preload('role').whereNull('hotel_id').whereIn('role_id', roleIds)

    if (search) {
      query.where((q) => {
        q.whereILike('firstName', `%${search}%`)
          .orWhereILike('lastName', `%${search}%`)
          .orWhereILike('username', `%${search}%`)
          .orWhereILike('email', `%${search}%`)
      })
    }

    const users = await query.orderBy('created_at', 'desc').paginate(page, limit)

    return response.ok(users)
  }
}
