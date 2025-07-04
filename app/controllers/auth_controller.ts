import { HttpContext } from '@adonisjs/core/http'
import hash from '@adonisjs/core/services/hash'
//import app from '@adonisjs/core/services/app'
import { cuid } from '@adonisjs/core/helpers'
import vine from '@vinejs/vine'
import User from '#models/user'
// import fs from 'node:fs'

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
  async login({ request }: HttpContext) {
    const { email, password } = request.only(['email', 'password'])

    try {
      const user = await User.findBy('email', email)
      if (!user) return this.responseError('Invalid credentials', 401)

      const login = await hash.verify(user.password, password)
      if (!login) return this.responseError('Invalid credentials', 401)

      const token = await User.accessTokens.create(user, ['*'], { name: email ?? cuid() })
      return this.response('Login successfully', { user, user_token: token })
    } catch (error: any) {
      this.responseError('Invalid credentials', 400)
    }
  }

  // Récupérer les informations de l'utilisateur
  async user({ auth }: HttpContext) {
    const user = await auth.authenticate()
    this.response('User retrieved successfully', user)
  }


async signin({ request, response }: HttpContext) {
  const { email, password } = request.only(['email', 'password'])

  try {
    const user = await User
      .query()
      .where('email', email)
      .preload('role')
      .firstOrFail()

    const passwordValid = await hash.verify(user.password, password)
    if (!passwordValid) {
      return response.unauthorized({ message: 'Invalid credentials' })
    }

    const isAdmin = user.role?.role_name === 'admin'

    let userServices

    if (isAdmin) {

      userServices = await user.related('services')
        .query()
        .preload('category')
        .limit(50)
    } else {

      const assignments = await user.related('serviceAssignments')
        .query()
        .preload('service', (serviceQuery) => {
          serviceQuery.preload('category')
        })
        .limit(10)

      userServices = assignments.map((a) => a.service)
    }

    const token = await User.accessTokens.create(user, ['*'], { name: email })

    return response.ok({
      message: 'Login successful',
      data: {
        user,
        userServices,
        user_token: token,
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    return response.badRequest({ message: 'Login failed' })
  }
}


  public async update_user({ auth, request, response }: HttpContext) {
    try {
      const user = await auth.authenticate()

      const userId = Number(request.param('id'))
      if (user.id !== userId) {
        return response.status(403).send({ message: 'You do not have permission to update this user.' })
      }

      const userToUpdate = await User.findOrFail(userId)
      const payload = request.body()

      console.log('Reçu du frontend :', payload)

      const validator = vine.compile(
        vine.object({
          name: vine.string().optional(),
          email: vine.string().email().optional(),
          password: vine.string().minLength(8).maxLength(32).confirmed().optional()
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
        data: userToUpdate
      })

    } catch (error) {
      console.error(error)
      return response.status(422).send({
        message: 'Validation failed',
        errors: error.messages || error.message
      })
    }
  }



// async update_user({ auth, request }: HttpContext) {
//   const user = await auth.authenticate()
//   const payload = request.body()

//   const validator = vine.compile(
//     vine.object({
//       password: vine.string().minLength(8).maxLength(32).confirmed().optional(),
//       name: vine.string().optional(),
//       email: vine
//         .string()
//         .email()
//         .optional()
//         .unique({ table: 'users', column: 'email', whereNot: { id: user.id } }),
//     })
//   )

//   try {
//     const output = await validator.validate(payload)

//     if (output.password) {
//       output.password = await hash(output.password)
//     }

//     const photo = request.file('photo', {
//       size: '2mb',
//       extnames: ['jpg', 'png', 'jpeg'],
//     })

//     if (photo) {
//       if (!photo.isValid) {
//         return this.responseError('Invalid photo', 422, photo.errors)
//       }

//       // Supprimer l'ancienne photo
//       if (user.photo) {
//         const oldPhotoPath = app.makePath(`uploads/user-photo/${user.photo}`)
//         fs.existsSync(oldPhotoPath) &&
//           fs.unlink(oldPhotoPath, (err) => {
//             if (err) console.error('Error removing old photo:', err)
//           })
//       }

//       // Enregistrer la nouvelle photo
//       await photo.move(app.makePath('uploads/user-photo'), {
//         name: `${cuid()}.${photo.extname}`,
//       })

//       output.photo = photo.fileName!
//     }

//     await user.merge(output).save()

//     return this.response('User updated successfully', user)
//   } catch (error) {
//     return this.responseError('Validation failed', 422, error.messages || error.message)
//   }
// }


  // Rafraîchir le token
  async refresh_token({ auth }: HttpContext) {
    const user = await auth.authenticate()
    await User.accessTokens.delete(user, user.currentAccessToken.identifier)

    const token = await User.accessTokens.create(user, ['*'], { name: cuid() })
    this.response('Refresh token successfully', { user, user_token: token })
  }

  // Déconnexion
  async logout({ auth }: HttpContext) {
    const user = await auth.authenticate()
    await User.accessTokens.delete(user, user.currentAccessToken.identifier)

    this.response('Logout successfully')
  }

  async validateEmail ({response,request}:HttpContext){
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

      const passwordValid = await hash.verify(user.password, password)

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
