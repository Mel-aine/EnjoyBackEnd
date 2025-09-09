import type { HttpContext } from '@adonisjs/core/http'
import Department from '#models/department'
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'
import ServiceUserAssignment from '#models/service_user_assignment'
import Task from '#models/task'
import Schedules from '#models/employee_schedule'
import ActivityLog from '#models/activity_log'
import User from '#models/user'
import Database from '@adonisjs/lucid/services/db'
import {
  createDepartmentValidator,
  updateDepartmentValidator,
  assignStaffValidator
} from '#validators/department'

const departmentService = new CrudService(Department)

export default class DepartmentsController {


  /**
   * Get all departments for a service
   */
  public async index({ request, response }: HttpContext) {

    const page = request.input('page', 1)
    const limit = request.input('limit', 20)
    const search = request.input('search', '')
    const status = request.input('status', '')
    const hotelId = request.input('hotelId')

    try {
      const query = Department.query()
      .preload('responsibleUser', (userQuery) => {
          userQuery.select('id', 'firstName', 'lastName', 'email', 'phoneNumber')
        })


      if (hotelId) {
        query.where('hotel_id', hotelId)
      }

      // Apply search filter
      if (search) {
        query.where((searchQuery) => {
          searchQuery
            .whereLike('name', `%${search}%`)
            .orWhereLike('description', `%${search}%`)
        })
      }

      // Apply status filter
      if (status) {
        query.where('status', status)
      }

      const departments = await query
        .orderBy('name', 'asc')
        .paginate(page, limit)

      return response.ok({
        data: departments.serialize(),
        meta: {
          total: departments.total,
          per_page: departments.perPage,
          current_page: departments.currentPage,
          last_page: departments.lastPage,
        }
      })
    } catch (error) {
      console.error('Error fetching departments:', error)
      return response.internalServerError({
        message: 'Failed to fetch departments',
        error: error.message,
      })
    }
  }

  /**
   * Create a new department
   */
  public async store({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createDepartmentValidator)
      const user = auth.user!

      // Check if department name already exists in the service
      const existingDepartment = await Department.query()
        .whereRaw('LOWER(name) = ?', [payload.name.toLowerCase()])
        .where('hotel_id', payload.hotel_id)
        .first()

      if (existingDepartment) {
        return response.conflict({
           code : 'DEPARTMENT_ALREADY_EXISTS_NAME',
          message: 'A department with this name already exists in this service'
        })
      }

      const department = await Department.create({
        ...payload,
        createdBy: user.id,
        lastModifiedBy: user.id,
        status: payload.status || 'active'
      })

      // Load the department with relationships
      // await department.load('responsibleUser')

      // Log activity
      await ActivityLog.create({
        userId: user.id,
        entityType: 'Department',
        entityId: department.id,
        action: 'CREATE',
        description: `Created department: ${department.name}`,
        meta: { departmentName: department.name }
      })

      return response.created({
        message: 'Department created successfully',
        data: department.serialize()
      })
    } catch (error) {
      console.error('Error creating department:', error)
      return response.internalServerError({
        message: 'Failed to create department',
        error: error.message,
      })
    }
  }

  /**
   * Get a specific department
   */
  // public async show({ params, response }: HttpContext) {
  //   const { serviceId, id } = params

  //   try {
  //     const department = await Department.query()
  //       .where('id', id)
  //       .where('service_id', serviceId)
  //       .preload('responsibleUser', (userQuery) => {
  //         userQuery.select('id', 'firstName', 'lastName', 'email', 'phone')
  //       })
  //       .preload('createdBy', (userQuery) => {
  //         userQuery.select('id', 'firstName', 'lastName')
  //       })
  //       .preload('updatedByUser', (userQuery) => {
  //         userQuery.select('id', 'firstName', 'lastName')
  //       })
  //       .firstOrFail()

  //     return response.ok({
  //       data: department.serialize()
  //     })
  //   } catch (error) {
  //     if (error.code === 'E_ROW_NOT_FOUND') {
  //       return response.notFound({ message: 'Department not found' })
  //     }
  //     console.error('Error fetching department:', error)
  //     return response.internalServerError({
  //       message: 'Failed to fetch department',
  //       error: error.message,
  //     })
  //   }
  // }

  /**
   * Update a department
   */
public async update({ params, request, response, auth }: HttpContext) {
  const { id } = params

  try {
    const payload = await request.validateUsing(updateDepartmentValidator)
    const user = auth.user!

    const department = await Department.query()
      .where('id', id)
      .firstOrFail()

    // Vérifier si un autre département avec le même nom existe (insensible à la casse)
    if (payload.name) {
      const existingDepartment = await Department.query()
        .whereRaw('LOWER(name) = ?', [payload.name.toLowerCase()])
        .where('hotel_id', department.hotel_id)
        .where('id', '!=', id)
        .first()

      if (existingDepartment) {
        return response.conflict({
          code: 'DEPARTMENT_ALREADY_EXISTS',
          message: `A department with this name already exists in this service`
        })
      }
    }

    // Stocker les anciennes valeurs pour le logging
    const oldValues = {
      name: department.name,
      description: department.description,
      responsibleUserId: department.responsible_user_id
    }

    // Mettre à jour le département
    department.merge({
      ...payload,
      lastModifiedBy: user.id
    })

    await department.save()
    await department.load('responsibleUser')

    // Log activity
    const changes = this.getChangedFields(oldValues, payload)
    if (changes.length > 0) {
      await ActivityLog.create({
        userId: user.id,
        entityType: 'Department',
        entityId: department.id,
        action: 'UPDATE',
        description: `Updated department: ${department.name}`,
        meta: { changes, oldValues, newValues: payload }
      })
    }

    return response.ok({
      message: 'Department updated successfully',
      data: department.serialize()
    })
  } catch (error) {
    if (error.code === 'E_ROW_NOT_FOUND') {
      return response.notFound({ message: 'Department not found' })
    }
    console.error('Error updating department:', error)
    return response.internalServerError({
      message: 'Failed to update department',
      error: error.message,
    })
  }
}


  /**
   * Delete
   *
   */

  public async destroy({ params, response, auth }: HttpContext) {
  const { id } = params

  try {
    const user = auth.user!

    const department = await Department.query()
      .where('id', id)
      .firstOrFail()

    await department.delete()

    // Log activity
    await ActivityLog.create({
      userId: user.id,
      entityType: 'Department',
      entityId: id,
      action: 'DELETE',
      description: `Deleted department: ${department.name}`,
      meta: { deletedValues: department.serialize() }
    })

    return response.ok({
      message: 'Department deleted successfully'
    })
  } catch (error) {
    if (error.code === 'E_ROW_NOT_FOUND') {
      return response.notFound({ message: 'Department not found' })
    }

    console.error('Error deleting department:', error)
    return response.internalServerError({
      message: 'Failed to delete department',
      error: error.message
    })
  }
}


  /**
   * Get changed fields for activity logging
   */
  private getChangedFields(oldValues: any, newValues: any): string[] {
    const changes: string[] = []

    for (const [key, newValue] of Object.entries(newValues)) {
      if (oldValues[key] !== newValue && newValue !== undefined) {
        changes.push(key)
      }
    }

    return changes
  }

  /**
   * Assign staff to department
   */
  public async assignStaff({ params, request, response, auth }: HttpContext) {
    const { serviceId, departmentId } = params
    const user = auth.user!

    try {
      const payload = await request.validateUsing(assignStaffValidator)
      const { userIds } = payload

      const trx = await Database.transaction()

      try {
        const department = await Department.findOrFail(departmentId)

        // Update existing assignments
        await ServiceUserAssignment.query({ client: trx })
          .whereIn('user_id', userIds)
          .where('hotel_id', serviceId)
          .update({ department_id: departmentId })

        await trx.commit()

        // Log activity
        await ActivityLog.create({
          userId: user.id,
          entityType: 'Department',
          entityId: departmentId,
          action: 'staff_assigned',
          description: `Assigned ${userIds.length} staff member(s) to department: ${department.name}`,
          meta: { userIds, departmentName: department.name }
        })

        return response.ok({
          message: 'Staff assigned successfully to department'
        })
      } catch (error) {
        await trx.rollback()
        throw error
      }
    } catch (error) {
      console.error('Error assigning staff:', error)
      return response.internalServerError({
        message: 'Failed to assign staff to department',
        error: error.message,
      })
    }
  }
}
