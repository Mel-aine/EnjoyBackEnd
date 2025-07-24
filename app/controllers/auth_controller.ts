import { HttpContext } from '@adonisjs/core/http'
import hash from '@adonisjs/core/services/hash'
//import app from '@adonisjs/core/services/app'
import { cuid } from '@adonisjs/core/helpers'
import vine from '@vinejs/vine'
import User from '#models/user'
import ServiceUserAssignment from '#models/service_user_assignment'
import LoggerService from '#services/logger_service'

export default class AuthController {
  // Fonction auxiliaire pour envoyer des réponses d'erreur
  private responseError(message: string, statusCode: number, errors?: any) {
    return {
      status: 'error',
      message,
      errors,
      statusCode,
    }
  }

  // Fonction auxiliaire pour envoyer des réponses de succès
  private response(message: string, data?: any) {
    return {
      status: 'success',
      message,
      data,
    }
  }

  // Connexion
  async login(ctx: HttpContext) {
    const { request } = ctx
    const { email, password } = request.only(['email', 'password'])

    try {
      const user = await User.findBy('email', email)
      if (!user) return this.responseError('Invalid credentials', 401)

      const login = await hash.verify(password, user.password)
      if (!login) return this.responseError('Invalid credentials', 401)

      const token = await User.accessTokens.create(user, ['*'], { name: email ?? cuid() })

      await LoggerService.log({
        actorId: user.id,
        action: 'LOGIN',
        entityType: 'User',
        entityId: user.id.toString(),
        description: `Connexion de l'utilisateur ${email}`,
        ctx: ctx,
      })

      return this.response('Login successfully', { user, user_token: token })
    } catch (error: any) {
      return this.responseError('Invalid credentials', 400)
    }
  }

  // Récupérer les informations de l'utilisateur
  async user({ auth }: HttpContext) {
    const user = await auth.authenticate()
    this.response('User retrieved successfully', user)
  }

  public async signin(ctx: HttpContext) {

    const { request, response } = ctx
    const { email, password } = request.only(['email', 'password'])

    console.log('🔍 [AUTH DEBUG] Tentative de connexion pour:', email)
    console.log('🔍 [AUTH DEBUG] Mot de passe fourni:', password ? '***PRESENTE***' : 'VIDE')

    try {
      const user = await User.query().where('email', email).preload('role').firstOrFail()
      console.log('✅ [AUTH DEBUG] Utilisateur trouvé:', user.email, 'ID:', user.id)
      console.log(
        '🔍 [AUTH DEBUG] Hash en base:',
        user.password ? user.password.substring(0, 20) + '...' : 'VIDE'
      )

      const passwordValid = await hash.verify(password, user.password)
      console.log(
        '🔍 [AUTH DEBUG] Validation mot de passe:',
        passwordValid ? 'VALIDE ✅' : 'INVALIDE ❌'
      )

      if (!passwordValid) {
        console.log('❌ [AUTH DEBUG] Échec - mot de passe incorrect')
        return response.unauthorized({ message: 'Invalid credentials' })
      }
      const isAdmin = user.role?.role_name === 'admin'

      let userServices

      if (isAdmin) {
        userServices = await user.related('services').query().preload('category').limit(50)
      } else {
        const assignments = await user
          .related('serviceAssignments')
          .query()
          .preload('service', (serviceQuery) => {
            serviceQuery.preload('category')
          })

        userServices = assignments.map((a) => a.service)
      }

      const token = await User.accessTokens.create(user, ['*'], { name: email })

      //  Ajout de detailedPermissions (comme getUserPermissions)
      const assignments = await ServiceUserAssignment.query()
        .where('user_id', user.id)
        .preload('service')
        .preload('roleModel', (roleQuery) => {
          roleQuery.preload('permissions')
        })

      const detailedPermissions = assignments.map((assignment) => ({
        service: {
          id: assignment.service?.id,
          name: assignment.service?.name,
        },
        role: {
          name: assignment.roleModel?.role_name,
          description: assignment.roleModel?.description,
        },
        permissions:
          assignment.roleModel?.permissions.map((p) => ({
            id: p.id,
            name: p.name,
            description: p.label,
          })) ?? [],
      }))

      return response.ok({
        message: 'Login successful',
        data: {
          user,
          user_token: token,
          userServices,
          permissions: detailedPermissions,
        },
      })
    } catch (error) {
      if (error.code === 'E_ROW_NOT_FOUND') {
        console.log('❌ [AUTH DEBUG] Utilisateur non trouvé pour email:', email)
        return response.unauthorized({ message: 'Invalid credentials' })
      }
      console.error('❌ [AUTH DEBUG] Erreur login:', error)
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

      console.log('Reçu du frontend :', payload)

      const validator = vine.compile(
        vine.object({
          name: vine.string().optional(),
          email: vine.string().email().optional(),
          password: vine.string().minLength(8).maxLength(32).confirmed().optional(),
        })
      )

      const output = await validator.validate(payload)
      console.log('Après validation VINE :', output)

      if (output.email && output.email !== userToUpdate.email) {
        const existing = await User.findBy('email', output.email)
        if (existing) {
          return response.status(409).send({ message: 'Email already in use.' })
        }
        userToUpdate.email = output.email
      }

      if (output.password) {
        userToUpdate.password = await hash.make(output.password)
        console.log('Mot de passe haché et prêt à être sauvegardé.')
      }

      await userToUpdate.save()
      console.log('Utilisateur mis à jour dans la base de données.')

      return response.status(200).send({
        message: 'User updated successfully',
        data: userToUpdate,
      })
    } catch (error) {
      console.error(error)
      return response.status(422).send({
        message: 'Validation failed',
        errors: error.messages || error.message,
      })
    }
  }

  // Rafraîchir le token
  async refresh_token({ auth }: HttpContext) {
    const user = await auth.authenticate()
    await User.accessTokens.delete(user, user.currentAccessToken.identifier)

    const token = await User.accessTokens.create(user, ['*'], { name: cuid() })
    this.response('Refresh token successfully', { user, user_token: token })
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
      ctx: ctx,
    })

    return response.ok({ message: 'Logout successfully' })
  }

  async validateEmail({ response, request }: HttpContext) {
    const { email } = request.only(['email'])

    try {
      const user = await User.findBy('email', email)
      if (!user) {
        return response.status(401).json({
          message: 'Invalid credentials',
        })
      }
      return response.status(200).json({
        message: 'Email is valid',
      })
    } catch (error) {
      return response.status(400).json({
        message: 'An error occurred during validation',
      })
    }
  }

  public async validatePassword({ request, response }: HttpContext) {
    const { email, password } = request.only(['email', 'password'])

    try {
      const user = await User.findBy('email', email)

      if (!user) {
        return response.status(401).json({
          message: 'Invalid credentials (email)',
        })
      }

      const passwordValid = await hash.verify(password, user.password)

      if (!passwordValid) {
        return response.status(401).json({
          message: 'Invalid Password',
        })
      }

      return response.status(200).json({
        message: 'valid Password',
      })
    } catch (error) {
      return response.status(500).json({
        message: 'server error',
      })
    }
  }
}
