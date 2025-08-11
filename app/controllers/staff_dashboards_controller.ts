import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Task from '#models/task'
import Schedules from '#models/employee_schedule'
import ServiceUserAssignment from '#models/service_user_assignment'

export default class StaffDashboardsController {
  public async index({ response, params }: HttpContext) {
    try {
      const serviceId = Number(params.serviceId)

      if (!serviceId) {
        return response.badRequest({ message: 'Paramètre serviceId manquant ou invalide' })
      }

      // Staff actif dans ce service
      const activeStaff = await ServiceUserAssignment.query()
        .where('service_id', serviceId)
        .whereHas('user', (query) => {
          query.where('status', 'active')
        })
        .count('* as total')

      const today = DateTime.now().toISODate()

      // Staff de service aujourd’hui
      const staffOnDuty = await Schedules.query()
        .where('service_id', serviceId)
        .whereRaw('DATE(schedule_date) = ?', [today])
        .count('* as total')

      // Tâches du jour
      const todayTasks = {
        total: await Task.query()
          .where('service_id', serviceId)
          .whereRaw('DATE(due_date) = ?', [today])
          .count('* as total'),

        todo: await Task.query()
          .where('service_id', serviceId)
          .where('status', 'todo')
          .whereRaw('DATE(due_date) = ?', [today])
          .count('* as total'),

        in_progress: await Task.query()
          .where('service_id', serviceId)
          .where('status', 'in_progress')
          .whereRaw('DATE(due_date) = ?', [today])
          .count('* as total'),

        done: await Task.query()
          .where('service_id', serviceId)
          .where('status', 'done')
          .whereRaw('DATE(due_date) = ?', [today])
          .count('* as total'),
      }

      // Tâches en retard
      const overdueTasks = await Task.query()
        .where('service_id', serviceId)
        .where('status', '!=', 'done')
        .where('due_date', '<', new Date())
        .count('* as total')

      // 5 dernières tâches créées
      const recentTasks = await Task.query()
        .where('service_id', serviceId)
        .orderBy('created_at', 'desc')
        .limit(5)

      return response.ok({
        message: 'Dashboard data retrieved successfully',
        data: {
          active_staff: Number(activeStaff[0].$extras.total),
          staff_on_duty: Number(staffOnDuty[0].$extras.total),
          today_tasks: {
            total: Number(todayTasks.total[0].$extras.total),
            todo: Number(todayTasks.todo[0].$extras.total),
            in_progress: Number(todayTasks.in_progress[0].$extras.total),
            done: Number(todayTasks.done[0].$extras.total),
          },
          overdue_tasks: Number(overdueTasks[0].$extras.total),
          recent_tasks: recentTasks,
        },
      })
    } catch (error) {
      console.error(error)
      return response.internalServerError({
        message: 'Erreur lors de la récupération du dashboard',
      })
    }
  }
}
