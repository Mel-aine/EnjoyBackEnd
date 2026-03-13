
import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import { createUserValidator, updateUserValidator } from '../../validators/user.js'

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
        .orWhereILike('lastName',`%${search}%`)
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
  async store({ request, response }: HttpContext) {
    try {

    const payload = await request.validateUsing(createUserValidator)

    const user = await User.create({
      firstName: payload.firstName,
      lastName: payload.lastName,
      username: payload.username ?? null,
      email: payload.email,
      roleId: payload.roleId ?? null,
      isActive: payload.isActive ?? true,
    })

    await user.load('role')

    return response.created(user)
  }  catch (error) {
    console.log(error)
      return response.internalServerError({
        success: false,
        message: 'Error creating user ',
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
}
