import type { HttpContext } from '@adonisjs/core/http'
import ServiceUserAssignment from '#models/service_user_assignment';
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'
import User from '#models/user'
import { DateTime } from 'luxon';
// import mail from '@adonisjs/mail/services/main'
// import { randomBytes } from 'node:crypto'
const UserAssigmentService = new CrudService(ServiceUserAssignment)


export default class AssigmentUsersController extends CrudController<typeof ServiceUserAssignment>{
    constructor() {
    super(UserAssigmentService)

  }

  /**
   * Génère un mot de passe aléatoirement sécurisé
//    */
// private generateSecurePassword(length: number = 12): string {
//   if (length < 4) {
//     throw new Error('Le mot de passe doit avoir au moins 4 caractères.')
//   }

//   const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
//   const lowercase = 'abcdefghijklmnopqrstuvwxyz'
//   const numbers = '0123456789'
//   const symbols = '!@#$%^&*'
//   const allChars = uppercase + lowercase + numbers + symbols

//   const getRandomChar = (chars: string) => chars[randomBytes(1)[0] % chars.length]

//   // Assurer au moins un de chaque type
//   const passwordArray = [
//     getRandomChar(uppercase),
//     getRandomChar(lowercase),
//     getRandomChar(numbers),
//     getRandomChar(symbols),
//   ]

//   // Compléter avec des caractères aléatoires
//   for (let i = passwordArray.length; i < length; i++) {
//     passwordArray.push(getRandomChar(allChars))
//   }

//   // Mélanger les caractères pour éviter un ordre prévisible
//   for (let i = passwordArray.length - 1; i > 0; i--) {
//     const j = randomBytes(1)[0] % (i + 1)
//     const temp = passwordArray[i]
//     passwordArray[i] = passwordArray[j]
//     passwordArray[j] = temp
//   }

//   return passwordArray.join('')
// }

//   /**
//    * Génère le contenu HTML de l'email
//    */
//   private generateEmailContent(firstName: string, temporaryPassword: string): string {
//     const loginUrl = process.env.FRONTEND_URL || 'http://localhost:3000/login'

//     return `
//       <!DOCTYPE html>
//       <html>
//       <head>
//           <meta charset="utf-8">
//           <title>Bienvenue - Votre compte a été créé</title>
//           <style>
//               body {
//                   font-family: Arial, sans-serif;
//                   line-height: 1.6;
//                   color: #333;
//                   max-width: 600px;
//                   margin: 0 auto;
//                   padding: 20px;
//               }
//               .header {
//                   background-color: #007bff;
//                   color: white;
//                   padding: 20px;
//                   text-align: center;
//                   border-radius: 8px 8px 0 0;
//               }
//               .content {
//                   background-color: #f8f9fa;
//                   padding: 30px;
//                   border-radius: 0 0 8px 8px;
//               }
//               .password-box {
//                   background-color: #fff;
//                   border: 2px solid #007bff;
//                   padding: 15px;
//                   margin: 20px 0;
//                   text-align: center;
//                   border-radius: 5px;
//               }
//               .password {
//                   font-size: 18px;
//                   font-weight: bold;
//                   color: #007bff;
//                   font-family: monospace;
//               }
//               .warning {
//                   background-color: #fff3cd;
//                   border: 1px solid #ffeaa7;
//                   padding: 10px;
//                   border-radius: 5px;
//                   margin: 15px 0;
//               }
//               .button {
//                   display: inline-block;
//                   background-color: #007bff;
//                   color: white;
//                   padding: 12px 30px;
//                   text-decoration: none;
//                   border-radius: 5px;
//                   margin-top: 20px;
//               }
//               .footer {
//                   margin-top: 30px;
//                   padding-top: 20px;
//                   border-top: 1px solid #ddd;
//                   font-size: 14px;
//                   color: #666;
//               }
//           </style>
//       </head>
//       <body>
//           <div class="header">
//               <h1>Bienvenue dans notre système !</h1>
//           </div>

//           <div class="content">
//               <h2>Bonjour ${firstName},</h2>

//               <p>Votre compte utilisateur a été créé avec succès. Voici vos informations de connexion :</p>

//               <div class="password-box">
//                   <p><strong>Mot de passe temporaire :</strong></p>
//                   <div class="password">${temporaryPassword}</div>
//               </div>

//               <div class="warning">
//                   <p><strong>⚠️ Important :</strong></p>
//                   <ul>
//                       <li>Ce mot de passe est temporaire et doit être changé lors de votre première connexion</li>
//                       <li>Ne partagez jamais vos informations de connexion</li>
//                       <li>Conservez ce mot de passe en sécurité jusqu'à votre première connexion</li>
//                   </ul>
//               </div>

//               <p>Vous pouvez vous connecter dès maintenant en utilisant votre adresse email et le mot de passe ci-dessus :</p>

//               <a href="${loginUrl}" class="button">Se connecter</a>

//               <p style="margin-top: 30px;">
//                   Si vous avez des questions ou rencontrez des difficultés, n'hésitez pas à contacter notre équipe de support.
//               </p>

//               <div class="footer">
//                   <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre directement.</p>
//               </div>
//           </div>
//       </body>
//       </html>
//     `
//   }

//   /**
//    * Envoie le mot de passe par email à l'utilisateur
//    */
//   private async sendPasswordByEmail(userEmail: string, firstName: string, temporaryPassword: string) {
//     try {
//       await mail.send((message) => {
//         message
//           .to(userEmail)
//           .subject('Votre compte a été créé - Mot de passe temporaire')
//           .html(this.generateEmailContent(firstName, temporaryPassword))
//       })

//       console.log(`Email de bienvenue envoyé à ${userEmail}`)
//     } catch (error) {
//       console.error('Erreur lors de l\'envoi de l\'email:', error)
//       throw new Error('Impossible d\'envoyer l\'email de bienvenue')
//     }
//   }

//   public async createUser({ request, response }: HttpContext) {
//     const {
//       first_name,
//       last_name,
//       email,
//       nationality,
//       phone_number,
//       address,
//       role_id,
//       status,
//       created_by,
//       service_id,
//       role,
//       department_id,
//       hire_date,
//     } = request.only([
//       'first_name',
//       'last_name',
//       'email',
//       'nationality',
//       'phone_number',
//       'address',
//       'role_id',
//       'status',
//       'created_by',
//       'service_id',
//       'role',
//       'department_id',
//       'hire_date',
//     ])

//     try {
//       // Vérifier si l'email existe déjà
//       const existingUser = await User.findBy('email', email)
//       if (existingUser) {
//         return response.status(400).json({
//           message: 'Un utilisateur avec cet email existe déjà',
//         })
//       }

//       // Générer un mot de passe temporaire
//       const temporaryPassword = this.generateSecurePassword()

//       // 1. Création utilisateur
//       const user = new User()
//       user.first_name = first_name
//       user.last_name = last_name
//       user.email = email
//       user.nationality = nationality ?? null
//       user.phone_number = phone_number ?? null
//       user.address = address
//       user.password = temporaryPassword // Le mot de passe sera hashé automatiquement par le modèle
//       user.role_id = role_id
//       user.status = status
//       user.created_by = created_by ?? null
//       // user.password_reset_required = true // Forcer le changement de mot de passe à la première connexion

//       await user.save()

//       // 2. Création de l'assignation
//       const assignment = new ServiceUserAssignment()
//       assignment.user_id = user.id
//       assignment.service_id = service_id
//       assignment.role = role
//       assignment.department_id = department_id
//       assignment.hire_date = hire_date ? DateTime.fromISO(hire_date) : null

//       await assignment.save()

//       // 3. Envoyer le mot de passe par email
//       await this.sendPasswordByEmail(email, first_name, temporaryPassword)

//       return response.status(201).json({
//         message: 'Utilisateur créé avec succès. Un email avec le mot de passe temporaire a été envoyé.',
//         user: {
//           id: user.id,
//           first_name: user.first_name,
//           last_name: user.last_name,
//           email: user.email,
//           status: user.status,
//         },
//         assignment: {
//           id: assignment.id,
//           service_id: assignment.service_id,
//           role: assignment.role,
//           department_id: assignment.department_id,
//           hire_date: assignment.hire_date,
//         },
//       })
//     } catch (error) {
//       console.error('Erreur lors de la création:', error)

//       return response.status(500).json({
//         message: 'Erreur lors de la création de l\'utilisateur',
//         error: error.message,
//       })
//     }
//   }



  public async createUser({ request, response }: HttpContext) {

    const {
      first_name,
      last_name,
      email,
      nationality,
      phone_number,
      address,
      password,
      role_id,
      status,
      created_by,
      service_id,
      role,
      department_id,
      hire_date,
    } = request.only([
      'first_name',
      'last_name',
      'email',
      'nationality',
      'phone_number',
      'address',
      'password',
      'role_id',
      'status',
      'created_by',
      'service_id',
      'role',
      'department_id',
      'hire_date',
    ])

    try {
      // 1. Création utilisateur
      const user = new User()
      user.first_name = first_name
      user.last_name = last_name
      user.email = email
      user.nationality = nationality ?? null
      user.phone_number = phone_number ?? null
      user.address = address
      user.password = password
      user.role_id = role_id
      user.status = status
      user.created_by = created_by ?? null

      await user.save()


      const assignment = new ServiceUserAssignment()
      assignment.user_id = user.id
      assignment.service_id = service_id
      assignment.role = role
      assignment.department_id = department_id
      assignment.hire_date = hire_date ? DateTime.fromISO(hire_date) : null

      await assignment.save()

      return response.status(201).json({
        message: 'User and assignment created successfully',
        user,
        assignment,
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Error creating user or assignment',
        error: error.message,
      })
    }
  }

}
