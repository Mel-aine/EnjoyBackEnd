import User from '#models/user'
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'
import ServiceUserAssignment from '#models/service_user_assignment'
import type { HttpContext } from '@adonisjs/core/http'
import LoggerService from '#services/logger_service'

export default class UsersController extends CrudController<typeof User> {
  private userService: CrudService<typeof User>

  constructor() {
    super(new CrudService(User))
    this.userService = new CrudService(User)
  }

  public async createWithUserAndRole(ctx: HttpContext) {
    const { request, response } = ctx
    const data = request.body()

    try {
      const user = await this.userService.create({
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone_number: data.phone_number,
        role_id: data.role_id,
        address: data.address,
        nationality: data.nationality,
        status: 'active',
        created_by: data.created_by || null,
        last_modified_by: data.last_modified_by || null,
        password: data.password,
      })

      await user.load('role')
      const roleName = user.role?.role_name || 'Rôle inconnu'

      await ServiceUserAssignment.create({
        user_id: user.id,
        service_id: data.service_id,
        role: data.role,
        department_id: data.department_id || null,
        hire_date: data.hire_date || null,
      })

      await LoggerService.log({
        actorId: data.created_by || 0,
        action: 'CREATE',
        entityType: 'User',
        entityId: user.id.toString(),
        description: `Création de l'utilisateur ${user.first_name} ${user.last_name} avec le rôle ${roleName}`,
        ctx,
      })

      return response.created({ user })
    } catch (error) {
      console.error('Error in createWithUser:', error)
      return response.status(500).send({
        message: 'Erreur lors de la création',
        error: error.message,
      })
    }
  }

  public async updateUserWithService(ctx: HttpContext) {
    const { request, response, params } = ctx
    const data = request.body()
    const userId = params.id

    try {
      const user = await this.userService.findById(userId)
      if (!user) {
        return response.status(404).send({ message: 'Utilisateur non trouvé' })
      }

      // Charger la relation role pour récupérer le nom du rôle actuel
      await user.load('role')
      const oldRoleName = user.role?.role_name || 'Rôle inconnu'

      const oldData = {
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone_number: user.phone_number,
        role_name: oldRoleName, // Nom du rôle au lieu de l'ID
        address: user.address,
        nationality: user.nationality,
        service_id: await this.getUserServiceId(user.id),
      }

      // Mise à jour des données utilisateur
      user.first_name = data.first_name
      user.last_name = data.last_name
      user.email = data.email
      user.phone_number = data.phone_number
      user.role_id = data.role_id
      user.address = data.address
      user.nationality = data.nationality
      user.last_modified_by = data.last_modified_by || null

      if (data.password) {
        user.password = data.password
      }

      await user.save()

      // Gestion des affectations de service
      const assignment = await ServiceUserAssignment.query().where('user_id', user.id).first()

      if (assignment) {
        assignment.service_id = data.service_id
        assignment.role = data.role
        await assignment.save()
      } else {
        await ServiceUserAssignment.create({
          user_id: user.id,
          service_id: data.service_id,
          role: data.role,
        })
      }

      // Recharger la relation role pour obtenir le nouveau nom du rôle
      await user.load('role')
      const newRoleName = user.role?.role_name || 'Rôle inconnu'

      const newData = {
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone_number: user.phone_number,
        role_name: newRoleName, // Nom du nouveau rôle
        address: user.address,
        nationality: user.nationality,
        service_id: data.service_id,
      }

      const changes = LoggerService.extractChanges(oldData, newData)

      await LoggerService.log({
        actorId: data.last_modified_by || 0,
        action: 'UPDATE',
        entityType: 'User',
        entityId: user.id.toString(),
        description: `Mise à jour du profil utilisateur ${user.first_name} ${user.last_name}`,
        changes,
        ctx,
      })

      return response.ok({ message: 'Utilisateur mis à jour', user })
    } catch (error) {
      console.error('Error in updateUserWithService:', error)
      return response.status(500).send({
        message: 'Erreur lors de la mise à jour',
        error: error.message,
      })
    }
  }

  // 🔧 Utilitaire pour récupérer l'ancien service lié à l'utilisateur
  private async getUserServiceId(userId: number): Promise<number | null> {
    const assignment = await ServiceUserAssignment.query().where('user_id', userId).first()
    return assignment?.service_id ?? null
  }

}