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

  // Mettre à jour le profil utilisateur
  async update_user({ auth, request }: HttpContext) {
    const user = await auth.authenticate()
    const payload = request.body()

    const validator = vine.compile(
      vine.object({
        password: vine.string().minLength(8).maxLength(32).confirmed().optional(),
        name: vine.string().optional(),
        email: vine.string().email().unique({ table: 'users', column: 'email' }).optional()

      })
    )

    const output = await validator.validate(payload)
    // const photo = request.file('photo', {
    //   size: '2mb',
    //   extnames: ['jpg', 'png', 'jpeg'],
    // })

    // // Téléchargement de la photo si fournie
    // if (photo) {
    //   if (!photo.isValid) return this.responseError('Validation error', 422, photo.errors)

    //   // Suppression de l'ancienne photo
    //   if (user.photo) {
    //     fs.unlink(app.makePath(`uploads/user-photo/${user.photo}`), (err) => {
    //       if (err) console.error('Error removing file:', err)
    //     })
    //   }

    //   // Déplacement de la nouvelle photo
    //   await photo.move(app.makePath('uploads/user-photo'), {
    //     name: `${cuid()}.${photo.extname}`,
    //   })
    //   output.photo = photo.fileName!
    // }

    await user?.merge(output).save()
    this.response('User updated successfully', user)
  }

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
