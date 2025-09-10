import type { HttpContext } from '@adonisjs/core/http'
import ServiceUserAssignment from '#models/service_user_assignment'
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'
import User from '#models/user'
import { DateTime } from 'luxon'
const UserAssigmentService = new CrudService(ServiceUserAssignment)

export default class AssigmentUsersController extends CrudController<typeof ServiceUserAssignment> {
  private userService: CrudService<typeof User>
  constructor() {
    super(UserAssigmentService)
    this.userService = new CrudService(User)
  }

  public async createUser(ctx: HttpContext) {
    const { request, response, auth } = ctx
    const data = request.body()

    try {
      const hotelId = Number.parseInt(data.hotel_id, 10)
      if (Number.isNaN(hotelId)) {
        return response.badRequest({ message: 'Invalid hotelId' })
      }

      // 1. Vérifier si l'utilisateur existe déjà (par email)
      let user = await User.query().where('email', data.email).first()

      let isNewUser = false

      if (!user) {
        user = await this.userService.create({
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          phone_number: data.phone_number,
          role_id: data.role_id,
          hotel_id:data.hotel_id,
          address: data.address,
          nationality: data.nationality,
          status: 'active',
          created_by: auth.user?.id || null,
          last_modified_by: auth.user?.id || null,
          password: data.password,
          date_of_birth: data.date_of_birth ? DateTime.fromISO(data.date_of_birth) : null,
          place_of_birth: data.place_of_birth,
          gender: data.gender,
          city: data.city,
          country: data.country,
          company_name: data.company_name,
          state_province: data.state_province,
          postal_code: data.postal_code,
          fax: data.fax,
          registration_number: data.registration_number,
          emergency_phone: data.emergency_phone,
          personal_email: data.personal_email,
          social_security_number: data.social_security_number,
          national_id_number: data.national_id_number,
          hire_date: data.hire_date ? DateTime.fromISO(data.hire_date) : null,
          contract_type: data.contract_type,
          contract_end_date: data.contract_end_date ? DateTime.fromISO(data.contract_end_date) : null,
          data_processing_consent: data.data_processing_consent || false,
          consent_date: data.consent_date ? DateTime.fromISO(data.consent_date) : null,
          permis_discounts: data.permis_discounts ? JSON.stringify(data.permis_discounts) : null,
          permis_privileges: data.permis_privileges ? JSON.stringify(data.permis_privileges) : null,
          permis_reports: data.permis_reports ? JSON.stringify(data.permis_reports) : null,
        })
        isNewUser = true;
        await user.save();
      }

      // 3. Vérifier si une assignation existe déjà
      const existingAssignment = await ServiceUserAssignment.query()
        .where('user_id', user.id)
        .andWhere('hotel_id', hotelId)
        .first()

      if (existingAssignment) {
        return response.status(200).json({
          message: 'User already assigned to this service',
          user,
          assignment: existingAssignment,
          note: isNewUser ? 'New user created' : 'Existing user reused',
        })
      }

      // 4. Créer une assignation si elle n'existe pas encore
      const assignment = new ServiceUserAssignment()
      assignment.user_id = user.id
      assignment.hotel_id = hotelId
      assignment.role_id = data.role_id
      assignment.department_id = data.department_id
      assignment.hire_date = data.hire_date ? DateTime.fromISO(data.hire_date) : null

      await assignment.save()

      return response.status(isNewUser ? 201 : 200).json({
        message: isNewUser
          ? 'User and assignment created successfully'
          : 'Existing user assigned to new service',
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

  /**
   * Get a paginated list of employees for a specific service,
   * including their role and department for that assignment.
   */
  public async getEmployeesForService({ params, request, response }: HttpContext) {
    try {
      const hotelId = Number.parseInt(params.hotelId, 10)
      if (Number.isNaN(hotelId)) {
        return response.badRequest({ message: 'Invalid hotelId' })
      }

      const { roleId, departmentId, search } = request.qs()
      const page = request.input('page', 1)
      const perPage = request.input('perPage', 15)

      const query = ServiceUserAssignment.query().where('hotel_id', hotelId)

      if (departmentId) {
        query.where('department_id', departmentId)
      }

      if (roleId) {
        query.whereHas('user', (userQuery) => {
          userQuery.where('role_id', roleId)
        })
      }

      if (search) {
        query.whereHas('user', (userQuery) => {
          userQuery.whereILike('first_name', `%${search}%`).orWhereILike('last_name', `%${search}%`)
        })
      }

      const assignmentsPaginator = await query
        .preload('user', (userQuery) => {
          userQuery.preload('role')
        })
        .preload('department')
        .preload('role')
        .paginate(page, perPage)

      // Transform paginated data to include role and department with user details
      const result = assignmentsPaginator.toJSON()
      result.data = result.data
        .map((assignment) => {
          if (!assignment.user) return null

          return {
            ...assignment.$attributes,
            ...assignment.user.$attributes,
            role: assignment.role,
            department: assignment.department,
          }
        })
        .filter(Boolean) // Remove any null entries if a user was not found

      return response.ok(result)
    } catch (error) {
      console.error('Error fetching employees for service:', error)
      return response.internalServerError({
        message: 'Error fetching employees for the service',
        error: error.message,
      })
    }
  }

  /**
   * Update User
   */

public async updateUser(ctx: HttpContext) {
  const { request, response, auth, params } = ctx
  const data = request.body()
  const userId = params.id

  try {
    // Vérifier si l'utilisateur existe
    const user = await User.find(userId)
    if (!user) {
      return response.notFound({ message: 'User not found' })
    }

    const hotelId = Number.parseInt(data.hotel_id || data.service_id, 10)
    if (Number.isNaN(hotelId)) {
      return response.badRequest({ message: 'Invalid hotelId/serviceId' })
    }

    // Mettre à jour les données utilisateur
    await user.merge({
      firstName: data.first_name || user.firstName,
      lastName: data.last_name || user.lastName,
      email: data.email || user.email,
      phoneNumber: data.phone_number || user.phoneNumber,
      roleId: data.role_id || user.roleId,
      address: data.address || data.address_line || user.address,
      nationality: data.nationality || user.nationality,
      lastModifiedBy: auth.user?.id || null,
      dateOfBirth: data.date_of_birth ? DateTime.fromISO(data.date_of_birth) : user.dateOfBirth,
      placeOfBirth: data.place_of_birth || user.placeOfBirth,
      gender: data.gender || user.gender,
      city: data.city || user.city,
      country: data.country || user.country,
      companyName: data.company_name || user.companyName,
      stateProvince: data.state_province || user.stateProvince,
      postalCode: data.postal_code || user.postalCode,
      fax: data.fax || user.fax,
      registrationNumber: data.registration_number || user.registrationNumber,
      emergencyPhone: data.emergency_phone || user.emergencyPhone,
      personalEmail: data.personal_email || user.personalEmail,
      socialSecurityNumber: data.social_security_number || user.socialSecurityNumber,
      nationalIdNumber: data.national_id_number || user.nationalIdNumber,
      hireDate: data.hire_date ? DateTime.fromISO(data.hire_date) : user.hireDate,
      contractType: data.contract_type || user.contractType,
      contractEndDate: data.contract_end_date ? DateTime.fromISO(data.contract_end_date) : user.contractEndDate,
      dataProcessingConsent: data.data_processing_consent !== undefined ? data.data_processing_consent : user.dataProcessingConsent,
      consentDate: data.consent_date ? DateTime.fromISO(data.consent_date) : user.consentDate,

      // Champs d'adresse additionnels
      // stateProvince: data.state_province || user.stateProvince,
      // postalCode: data.postal_code || user.postalCode,
      // companyName: data.company_name || user.companyName,
      // fax: data.fax || user.fax,
      // registrationNumber: data.registration_number || user.registrationNumber,

      // Permissions - convertir en JSON si nécessaire
      permisDiscounts: data.discounts || data.perms_discounts
        ? JSON.stringify(data.discounts || data.perms_discounts)
        : user.permisDiscounts,
      permisPrivileges: data.privileges || data.permis_privileges
        ? JSON.stringify(data.privileges || data.permis_privileges)
        : user.permisPrivileges,
      permisReports: data.reports || data.permis_reports
        ? JSON.stringify(data.reports || data.permis_reports)
        : user.permisReports,
    })

    await user.save()

    // Mettre à jour l'assignation si nécessaire
    if (data.department_id || data.role_id) {
      const assignment = await ServiceUserAssignment.query()
        .where('user_id', user.id)
        .andWhere('hotel_id', hotelId)
        .first()

      if (assignment) {
        await assignment.merge({
          department_id: data.department_id ,
          role_id: data.role_id ,
        })
        await assignment.save()
      } else {
        // Créer une assignation si elle n'existe pas
        const newAssignment = new ServiceUserAssignment()
        newAssignment.user_id = user.id
        newAssignment.hotel_id = hotelId
        newAssignment.role_id = data.role_id || user.roleId
        newAssignment.department_id = data.department_id
        newAssignment.hire_date = data.hire_date ? DateTime.fromISO(data.hire_date) : null
        await newAssignment.save()
      }
    }

    // Recharger l'utilisateur avec ses relations
    await user.load('role')
    await user.load('serviceAssignments', (query) => {
      query.preload('department')
    })

    return response.ok({
      message: 'User updated successfully',
      user,
    })

  } catch (error) {
    console.error('Error updating user:', error)
    return response.status(500).json({
      message: 'Error updating user',
      error: error.message,
    })
  }
}

/**
 * delete user
 */
public async deleteUser(ctx: HttpContext) {
  const { response, params } = ctx
  const userId = params.id

  try {
    // Vérifier si l'utilisateur existe
    const user = await User.find(userId)
    if (!user) {
      return response.notFound({ message: 'User not found' })
    }

    // Option 1: Suppression logique (recommandée)
    // Marquer l'utilisateur comme inactif au lieu de le supprimer complètement
    // const softDelete = request.input('soft_delete', true)

    // if (softDelete) {
    //   await user.merge({
    //     status: 'inactive',
    //     isActive: false,
    //     lastModifiedBy: ctx.auth.user?.id || null,
    //   })
    //   await user.save()

    //   // Optionnellement, désactiver aussi les assignations
    //   await ServiceUserAssignment.query()
    //     .where('user_id', user.id)
    //     .update({
    //       updated_at: DateTime.now(),
    //     })

    //   return response.ok({
    //     message: 'User deactivated successfully',
    //     user: {
    //       id: user.id,
    //       status: user.status,
    //       is_active: user.isActive
    //     }
    //   })
    // }
      // D'abord, supprimer toutes les assignations liées
      await ServiceUserAssignment.query()
        .where('user_id', user.id)
        .delete()

      // Ensuite, supprimer l'utilisateur
      await user.delete()

      return response.ok({
        message: 'User and related assignments deleted successfully',
        deletedUserId: userId
      })


  } catch (error) {
    console.error('Error deleting user:', error)

    // Gestion des erreurs de contraintes de clé étrangère
    if (error.code === '23503' || error.message.includes('foreign key constraint')) {
      return response.status(409).json({
        message: 'Cannot delete user due to existing references. Consider deactivating instead.',
        error: 'Foreign key constraint violation'
      })
    }

    return response.status(500).json({
      message: 'Error deleting user',
      error: error.message,
    })
  }
}

/**
 * Fonction alternative pour supprimer un utilisateur d'un service spécifique
 * sans supprimer complètement l'utilisateur du système
 */
public async removeUserFromService(ctx: HttpContext) {
  const { response, params } = ctx
  const userId = params.userId
  const hotelId = Number.parseInt(params.hotelId, 10)

  try {
    if (Number.isNaN(hotelId)) {
      return response.badRequest({ message: 'Invalid hotelId' })
    }

    // Vérifier si l'utilisateur existe
    const user = await User.find(userId)
    if (!user) {
      return response.notFound({ message: 'User not found' })
    }

    // Supprimer uniquement l'assignation au service
    const deletedAssignments = await ServiceUserAssignment.query()
      .where('user_id', userId)
      .andWhere('hotel_id', hotelId)
      .delete()

    // if (deletedAssignments === 0) {
    //   return response.notFound({
    //     message: 'User assignment to this service not found'
    //   })
    // }

    return response.ok({
      message: 'User removed from service successfully',
      userId,
      hotelId,
      removedAssignments: deletedAssignments
    })

  } catch (error) {
    console.error('Error removing user from service:', error)
    return response.status(500).json({
      message: 'Error removing user from service',
      error: error.message,
    })
  }
}

/**
 * Fonction pour restaurer un utilisateur désactivé
 */
public async restoreUser(ctx: HttpContext) {
  const { response, params, auth } = ctx
  const userId = params.id

  try {
    const user = await User.find(userId)
    if (!user) {
      return response.notFound({ message: 'User not found' })
    }

    await user.merge({
      status: 'active',
      isActive: true,
      lastModifiedBy: auth.user?.id || null,
    })
    await user.save()

    return response.ok({
      message: 'User restored successfully',
      user: {
        id: user.id,
        status: user.status,
        is_active: user.isActive
      }
    })

  } catch (error) {
    console.error('Error restoring user:', error)
    return response.status(500).json({
      message: 'Error restoring user',
      error: error.message,
    })
  }
}
}
