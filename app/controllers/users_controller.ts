import User from '#models/user'
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'
import ServiceUserAssignment from '#models/service_user_assignment'
import type { HttpContext } from '@adonisjs/core/http'
import Reservation from '#models/reservation'
import Payment from '#models/folio'
import Log from '#models/activity_log'
import LoggerService from '#services/logger_service'
import { DateTime } from 'luxon'
import Permission from '#models/permission'
import Service from '#models/hotel'
import ActivityLog from '#models/activity_log'
import logger from '@adonisjs/core/services/logger'
import EmploymentContract from '#models/employment_contract'
import Role from '#models/role'

export default class UsersController extends CrudController<typeof User> {
  private userService: CrudService<typeof User>

  constructor() {
    super(new CrudService(User))
    this.userService = new CrudService(User)
  }



  public async updateUserWithService(ctx: HttpContext) {

    logger.info('uuser')
    const { request, response, params, auth } = ctx
    const data = request.body()
    const userId = params.id
    logger.info(data)

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
        date_of_birth: user.date_of_birth,
        place_of_birth: user.place_of_birth,
        gender: user.gender,
        city: user.city,
        country: user.country,
        emergency_phone: user.emergency_phone,
        personal_email: user.personal_email,
        social_security_number: user.social_security_number,
        national_id_number: user.national_id_number,
        hire_date: user.hire_date,
        contract_type: user.contract_type,
        contract_end_date: user.contract_end_date,
        data_processing_consent: user.data_processing_consent,
        consent_date: user.consent_date
      }

      user.first_name = data.first_name
      user.last_name = data.last_name
      user.email = data.email
      user.phone_number = data.phone_number
      user.role_id = data.role_id
      user.address = data.address
      user.nationality = data.nationality
      user.last_modified_by = auth.user?.id || null
      user.hire_date = data.hire_date ? DateTime.fromISO(data.hire_date) : null
      user.date_of_birth = data.date_of_birth ? DateTime.fromISO(data.date_of_birth) : null
      user.place_of_birth = data.place_of_birth
      user.gender = data.gender
      user.city = data.city
      user.country = data.country
      user.emergency_phone = data.emergency_phone
      user.personal_email = data.personal_email
      user.social_security_number = data.social_security_number
      user.national_id_number = data.national_id_number
      user.contract_type = data.contract_type
      user.contract_end_date = data.contract_end_date
        ? DateTime.fromISO(data.contract_end_date)
        : null
      user.data_processing_consent = data.data_processing_consent
      user.consent_date = data.consent_date ? DateTime.fromISO(data.consent_date) : null

      if (data.password) {
        user.password = data.password
      }

      await user.save()

      const assignment = await ServiceUserAssignment.query().where('user_id', user.id).first()

      if (assignment) {
        assignment.service_id = data.service_id
        assignment.role = data.role
        assignment.department_id = data.department_id;
        assignment.hire_date = data.hire_date ? DateTime.fromISO(data.hire_date) : null

        await assignment.save()
      } else {
        await ServiceUserAssignment.create({
          user_id: user.id,
          service_id: data.service_id,
          role: data.role,
          department_id: data.department_id || null,
          hire_date: data.hire_date || null,
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
        date_of_birth: user.date_of_birth,
        place_of_birth: user.place_of_birth,
        gender: user.gender,
        city: user.city,
        country: user.country,
        emergency_phone: user.emergency_phone,
        personal_email: user.personal_email,
        social_security_number: user.social_security_number,
        national_id_number: user.national_id_number,
        hire_date: user.hire_date,
        contract_type: user.contract_type,
        contract_end_date: user.contract_end_date,
        data_processing_consent: user.data_processing_consent,
        consent_date: user.consent_date,
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
          r.depart_date! < now
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

      const totalRemainingAmount = unpaidReservations.reduce(
        (sum, r) => sum + (parseFloat(`${r.remaining_amount}`) || 0),
        0
      )

      let dueDate: string | null = null
      let description = ''

      if (unpaidReservations.length > 0) {
        // Find the reservation with the earliest due date
        const earliestReservation = unpaidReservations.reduce((earliest, current) => {
          if (!earliest.depart_date) return current
          if (!current.depart_date) return earliest
          return current.depart_date < earliest.depart_date ? current : earliest
        })

        dueDate = earliestReservation.depart_date?.toISODate() ?? null

        if (unpaidReservations.length === 1) {
          const r = unpaidReservations[0]
          description = `This is the final payment for booking #${r.reservation_number} at ${r.service.name}.`
        } else {
          description = `This is the final payment for your flight and hotel bookings. You have ${unpaidReservations.length} outstanding payments.`
        }
      }

      const outstandingBalances = {
        hasOutstanding: unpaidReservations.length > 0,
        totalRemainingAmount,
        dueDate,
        description,
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
        upcomingVisitDetails,
        reservations
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

  public async getUserDetails({ params, response }: HttpContext) {
    const userId = Number(params.id)

    if (Number.isNaN(userId)) {
      return response.badRequest({ message: 'Invalid user ID.' })
    }

    try {
      // 1. Fetch user and their primary role
      const user = await User.query().where('id', userId).preload('role').firstOrFail()

      // Fetch all employment contracts for the user
      const allContracts = await EmploymentContract.query().where('employee_id', userId)

      // Fetch the most recent employment contract
      const recentContract = await EmploymentContract.query()
        .where('employee_id', userId)
        .orderBy('contract_id', 'desc')
        .first()

      // 2. Fetch all service assignments for the user, with department and service info
      const assignments = await ServiceUserAssignment.query()
        .where('user_id', userId)
        .preload('department')
        .preload('service')

      // 3. Get all permissions for that user's role across all their assigned services.
      const serviceIds = assignments.map((a) => a.service_id)
      let permissions: Permission[] = []

      if (user.role_id) {
        permissions = await Permission.query().whereHas('rolePermissions', (rpQuery) => {
          rpQuery.where('role_id', user.role_id).where((q) => {
            // Permissions for assigned services OR global permissions
            if (serviceIds.length > 0) {
              q.whereIn('service_id', serviceIds).orWhereNull('service_id')
            } else {
              // If no assignments, only get global permissions
              q.whereNull('service_id')
            }
          })
        })
      }
      // Get activities
      const activityHistory = await ActivityLog.query()
        .where((query) => {
          query.where('user_id', userId)
        })
        .orderBy('created_at', 'desc')
        .limit(100)
      // 4. Structure the response.
      const serializedUser = user.serialize()

      let responseData: any = {
        ...serializedUser,
        activityLogs: activityHistory.map((a) => a.serialize()),
        permissions: permissions.map((p) => p.serialize()),
      }

      if (assignments && assignments.length > 0) {
        responseData.department = assignments[0].department?.serialize()
        responseData.hireDate = assignments[0].hire_date?.toISODate() ?? null
        responseData.role = assignments[0].role // This is the specific role/title in the assignment
      }
      console.log('-->responseData', responseData)

      return response.ok({ ...responseData, recentContract, allContracts })
    } catch (error) {
      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({ message: 'User not found' })
      }
      console.error('Error fetching user details:', error)
      return response.internalServerError({
        message: 'Failed to fetch user details',
        error: error.message,
      })
    }
  }

  public async getUserByServices(ctx: HttpContext) {
    const { params, response } = ctx
    const serviceId = Number(params.id)
    if (Number.isNaN(serviceId)) {
      return response.badRequest({ message: 'Invalid service ID.' })
    }

    try {
      // 1. Customer Details
      const userByServiceList = await ServiceUserAssignment.query()
        .where('service_id', serviceId)
        .preload('user')
      return response.ok({
        data: JSON.stringify(userByServiceList),
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
  /**
 * Retrieves all clients for a specific hotel (service).
 * A client is a user who has made at least one reservation for this hotel.
 */
  public async getClientsByService({ params, response }: HttpContext) {
  try {
    const { serviceId } = params

    // Vérifier que le service existe
    const service = await Service.find(serviceId)
    if (!service) {
      return response.notFound({ message: 'Service not found.' })
    }

    // Filtrer tous les utilisateurs ayant le rôle "client" et appartenant à ce service
    const roleClient = await Role.findByOrFail('role_name', 'customer')

    const clients = await User.query()
      .where('service_id', serviceId)
      .andWhere('role_id', roleClient.id)

    return response.ok(clients)
  } catch (error) {
    console.error(error)
    return response.internalServerError({ message: 'Error retrieving clients.' })
  }
}

public async storeClient({ request, auth, response }: HttpContext) {
  try {
    const data = request.only([
      'gender',
      'first_name',
      'last_name',
      'email',
      'country',
      'national_id_number',
      'address',
      'phone_number',
      'special_preferences',
      'service_id',
      'date_of_birth',
    ])

    const { email, service_id } = data

    // Vérifie si un utilisateur avec cet email existe déjà pour ce service
    const existingUser = await User.query()
      .where('email', email)
      .andWhere('service_id', service_id)
      .first()

    if (existingUser) {
      return response.conflict({
        message: 'This email is already in use for this service',
      })
    }

    const role = await Role.findByOrFail('role_name', 'customer')

    const currentUser = auth.user!

    const newUser = await User.create({
      ...data,
      role_id: role.id,
      created_by: currentUser.id,
      last_modified_by: currentUser.id,
    })

    return response.created(newUser)
  } catch (error) {
    console.error('Error creating client:', error)
    return response.internalServerError({
      message: 'Error creating client.',
    })
  }
}




}
