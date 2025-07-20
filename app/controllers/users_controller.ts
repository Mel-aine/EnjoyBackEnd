import User from '#models/user'
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'
import ServiceUserAssignment from '#models/service_user_assignment'
import type { HttpContext } from '@adonisjs/core/http'
import Reservation from '#models/reservation'
import Payment from '#models/payment'
import Log from '#models/activity_log'
import LoggerService from '#services/logger_service'
import { DateTime } from 'luxon'

export default class UsersController extends CrudController<typeof User> {
  private userService: CrudService<typeof User>

  constructor() {
    super(new CrudService(User))
    this.userService = new CrudService(User)
  }

  public async createWithUserAndRole(ctx: HttpContext) {
    const { request, response, auth } = ctx
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
        created_by: auth.user?.id || null,
        last_modified_by: auth.user?.id || null,
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
        actorId: auth.user!.id,
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
    const { request, response, params, auth } = ctx
    const data = request.body()
    const userId = params.id

    try {
      const user = await this.userService.findById(userId)
      if (!user) {
        return response.status(404).send({ message: 'Utilisateur non trouvé' })
      }

      await user.load('role')
      const oldRoleName = user.role?.role_name || 'Rôle inconnu'

      const oldData = {
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone_number: user.phone_number,
        role_name: oldRoleName,
        address: user.address,
        nationality: user.nationality,
        service_id: await this.getUserServiceId(user.id),
      }

      user.first_name = data.first_name
      user.last_name = data.last_name
      user.email = data.email
      user.phone_number = data.phone_number
      user.role_id = data.role_id
      user.address = data.address
      user.nationality = data.nationality
      user.last_modified_by = auth.user?.id || null

      if (data.password) {
        user.password = data.password
      }

      await user.save()

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

      await user.load('role')
      const newRoleName = user.role?.role_name || 'Rôle inconnu'

      const newData = {
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone_number: user.phone_number,
        role_name: newRoleName,
        address: user.address,
        nationality: user.nationality,
        service_id: data.service_id,
      }

      const changes = LoggerService.extractChanges(oldData, newData)

      await LoggerService.log({
        actorId: auth.user!.id,
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

  private async getUserServiceId(userId: number): Promise<number | null> {
    const assignment = await ServiceUserAssignment.query().where('user_id', userId).first()
    return assignment?.service_id ?? null
  }

  public async getCustomerProfile({ params, response }: HttpContext) {
    const customerId = Number(params.id)

    if (isNaN(customerId)) {
      return response.badRequest({ message: 'Invalid customer ID.' })
    }

    try {
      // 1. Customer Details
      const customer = await User.query().where('id', customerId).preload('role').firstOrFail()

      // 2. Payment History
      const payments = await Payment.query().where('user_id', customerId).orderBy('created_at', 'desc')
      const paymentIds = payments.map((p) => p.id.toString())

      // Get all reservations for the user
      const reservations = await Reservation.query().where('user_id', customerId).preload('service')
        .orderBy('arrived_date', 'desc')
      const reservationIds = reservations.map((r) => r.id.toString())

      // 3. Activity Logs
      // Note: This assumes a 'Log' model exists for activity logging.
      const activityLogs = await Log.query()
        .where((query) => {
          query
            .where('user_id', customerId)
            .orWhere((subQuery) => {
              subQuery.where('entity_type', 'User').andWhere('entity_id', customerId.toString())
            })
            .orWhere((subQuery) => {
              subQuery.where('entity_type', 'Reservation').whereIn('entity_id', reservationIds)
            })
            .orWhere((subQuery) => {
              subQuery.where('entity_type', 'Payment').whereIn('entity_id', paymentIds)
            })
        })
        .orderBy('created_at', 'desc')
        .limit(50)

      // 4. Reservation Payments is covered by Payment History

      // 5. Hotel Status
      const now = DateTime.now()
      const currentReservation = reservations.find((r) => r.status === 'checked_in')
      let currentReservationDetails = null;

      if (currentReservation) {
        await currentReservation.load('reservationServiceProducts', (rspQuery) => {
          rspQuery.preload('serviceProduct')
        })
        currentReservationDetails = currentReservation.serialize()
      }
      // Last visit details (most recent completed/checked-out reservation in the past)
      const lastVisit = reservations.find(
        (r) =>
          (r.status === 'checked_out' || r.status === 'completed') &&
          r.depart_date &&
          r.depart_date < now
      )
      const lastVisitDetails = lastVisit
        ? {
          reservationId: lastVisit.id,
          reservationNumber: lastVisit.reservation_number,
          serviceName: lastVisit.service.name,
          checkInDate: lastVisit.arrived_date?.toISODate(),
          checkOutDate: lastVisit.depart_date?.toISODate(),
        }
        : null;
      // Upcoming visit details (closest confirmed/pending reservation in the future)
      const upcomingVisit = reservations
        .filter(
          (r) =>
            (r.status === 'confirmed' || r.status === 'pending') &&
            r.arrived_date &&
            r.arrived_date > now
        )
        .sort((a, b) => a.arrived_date!.toMillis() - b.arrived_date!.toMillis())[0]

      const upcomingVisitDetails = upcomingVisit
        ? {
          reservationId: upcomingVisit.id,
          reservationNumber: upcomingVisit.reservation_number,
          serviceName: upcomingVisit.service.name,
          checkInDate: upcomingVisit.arrived_date?.toISODate(),
          checkOutDate: upcomingVisit.depart_date?.toISODate(),
        }
        : null;

      const hotelStatus = {
        isPresent: !!currentReservation,
        reservationDetails: {
          reservationId: currentReservationDetails?.id,
          reservationNumber: currentReservationDetails?.reservationNumber,
          serviceName: currentReservationDetails?.service.name,
          checkInDate: currentReservationDetails?.arrivedDate,
          checkOutDate: currentReservationDetails?.departDate,
          roomNumber: currentReservationDetails?.reservationServiceProducts[0]?.serviceProduct.productName,

        },
      }

      // 6. Outstanding Balances
      const unpaidReservations = reservations.filter(
        (r) => r.remaining_amount && r.remaining_amount > 0 && r.status !== 'cancelled'
      )

      const outstandingBalances = {
        hasOutstanding: unpaidReservations.length > 0,
        details: unpaidReservations.map((r) => ({
          reservationId: r.id,
          reservationNumber: r.reservation_number,
          remainingAmount: r.remaining_amount,
        })),
      }

      return response.ok({
        customerDetails: customer.serialize(),
        paymentHistory: payments.map((p) => p.serialize()),
        activityLogs: activityLogs.map((l) => l.serialize()),
        hotelStatus,
        outstandingBalances,
        lastVisitDetails,
        upcomingVisitDetails
      })
    } catch (error) {
      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({ message: 'Customer not found' })
      }
      console.error('Error fetching customer profile:', error)
      return response.internalServerError({
        message: 'Failed to fetch customer profile',
        error: error.message,
      })
    }
  }
}
