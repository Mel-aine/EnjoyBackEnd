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
      const oldRoleName = user.role?.roleName

      const oldData = {
        first_name: user.firstName,
        last_name: user.lastName,
        email: user.email,
        phone_number: user.phoneNumber,
        role_name: oldRoleName,
        address: user.address,
        nationality: user.nationality,
        service_id: await this.getUserServiceId(user.id),
        profession: user.profession,
        company_id: user.companyId,
        date_of_birth: user.dateOfBirth,
        place_of_birth: user.placeOfBirth,
        gender: user.gender,
        city: user.city,
        country: user.country,
        emergency_phone: user.emergencyPhone,
        personal_email: user.personalEmail,
        social_security_number: user.socialSecurityNumber,
        national_id_number: user.nationalIdNumber,
        hire_date: user.hireDate,
        contract_type: user.contractType,
        contract_end_date: user.contractEndDate,
        data_processing_consent: user.dataProcessingConsent,
        consent_date: user.consentDate,
        permis_discounts: user.permisDiscounts ? JSON.parse(user.permisDiscounts) : [],
        permis_privileges: user.permisPrivileges ? JSON.parse(user.permisPrivileges) : [],
        permis_reports: user.permisReports ? JSON.parse(user.permisReports) : []
      }

      user.firstName = data.first_name
      user.lastName = data.last_name
      user.email = data.email
      user.phoneNumber = data.phone_number
      user.roleId = data.role_id
      user.address = data.address
      user.nationality = data.nationality
      user.profession = data.profession || null
      user.companyId = data.company_id || null
      user.lastModifiedBy = auth.user?.id || null
      user.hireDate = data.hire_date ? DateTime.fromISO(data.hire_date) : null
      user.dateOfBirth = data.date_of_birth ? DateTime.fromISO(data.date_of_birth) : null
      user.placeOfBirth = data.place_of_birth
      user.gender = data.gender
      user.city = data.city
      user.country = data.country
      user.emergencyPhone = data.emergency_phone
      user.personalEmail = data.personal_email
      user.socialSecurityNumber = data.social_security_number
      user.nationalIdNumber = data.national_id_number
      user.contractType = data.contract_type
      user.contractEndDate = data.contract_end_date
        ? DateTime.fromISO(data.contract_end_date)
        : null
      user.dataProcessingConsent = data.data_processing_consent
      user.consentDate = data.consent_date ? DateTime.fromISO(data.consent_date) : null

      // Nouveaux champs de permissions
      user.permisDiscounts = data.permis_discounts ? JSON.stringify(data.permis_discounts) : null
      user.permisPrivileges = data.permis_privileges ? JSON.stringify(data.permis_privileges) : null
      user.permisReports = data.permis_reports ? JSON.stringify(data.permis_reports) : null

      if (data.password) {
        user.password = data.password
      }

      await user.save()

      const assignment = await ServiceUserAssignment.query().where('user_id', user.id).first()

      if (assignment) {
        assignment.hotel_id = data.service_id
        assignment.role = data.role
        assignment.department_id = data.department_id;
        assignment.hire_date = data.hire_date ? DateTime.fromISO(data.hire_date) : null

        await assignment.save()
      } else {
        await ServiceUserAssignment.create({
          user_id: user.id,
          hotel_id: data.service_id,
          role: data.role,
          department_id: data.department_id || null,
          hire_date: data.hire_date || null,
        })
      }

      await user.load('role')
      const newRoleName = user.role?.roleName || 'Rôle inconnu'

      const newData = {
        first_name: user.firstName,
        last_name: user.lastName,
        email: user.email,
        phone_number: user.phoneNumber,
        role_name: newRoleName,
        address: user.address,
        nationality: user.nationality,
        service_id: data.service_id,
        profession: user.profession,
        company_id: user.companyId,
        date_of_birth: user.dateOfBirth,
        place_of_birth: user.placeOfBirth,
        gender: user.gender,
        city: user.city,
        country: user.country,
        emergency_phone: user.emergencyPhone,
        personal_email: user.personalEmail,
        social_security_number: user.socialSecurityNumber,
        national_id_number: user.nationalIdNumber,
        hire_date: user.hireDate,
        contract_type: user.contractType,
        contract_end_date: user.contractEndDate,
        data_processing_consent: user.dataProcessingConsent,
        consent_date: user.consentDate,
        permis_discounts: data.permis_discounts || [],
        permis_privileges: data.permis_privileges || [],
        permis_reports: data.permis_reports || [],
      }

      const changes = LoggerService.extractChanges(oldData, newData)

      await LoggerService.log({
        actorId: auth.user!.id,
        action: 'UPDATE',
        entityType: 'User',
        entityId: user.id.toString(),
        description: `Mise à jour du profil utilisateur ${user.firstName} ${user.lastName}`,
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
    return assignment?.hotel_id ?? null
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
      const reservations = await Reservation.query().where('user_id', customerId).preload('hotel')
        .orderBy('arrivedDate', 'desc')
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
        await currentReservation.load('reservationRooms', (rspQuery) => {
          rspQuery.preload('room')
        })
        currentReservationDetails = currentReservation.serialize()
      }
      // Last visit details (most recent completed/checked-out reservation in the past)
      const lastVisit = reservations.find(
        (r) =>
          (r.status === 'checked_out' || r.status === 'completed') &&
          r.departDate! < now
      )
      const lastVisitDetails = lastVisit
        ? {
          reservationId: lastVisit.id,
          reservationNumber: lastVisit.reservationNumber,
          serviceName: lastVisit.hotel.hotelName,
          checkInDate: lastVisit.arrivedDate?.toISODate(),
          checkOutDate: lastVisit.departDate?.toISODate(),
        }
        : null;
      // Upcoming visit details (closest confirmed/pending reservation in the future)
      const upcomingVisit = reservations
        .filter(
          (r) =>
            (r.status === 'confirmed' || r.status === 'pending') &&
            r.arrivedDate &&
            r.arrivedDate > now
        )
        .sort((a, b) => a.arrivedDate!.toMillis() - b.arrivedDate!.toMillis())[0]

      const upcomingVisitDetails = upcomingVisit
        ? {
          reservationId: upcomingVisit.id,
          reservationNumber: upcomingVisit.reservationNumber,
          serviceName: upcomingVisit.hotel.hotelName,
          checkInDate: upcomingVisit.arrivedDate?.toISODate(),
          checkOutDate: upcomingVisit.departDate?.toISODate(),
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
        (r) => r.remainingAmount && r.remainingAmount > 0 && r.status !== 'cancelled'
      )

      const totalRemainingAmount = unpaidReservations.reduce(
        (sum, r) => sum + (parseFloat(`${r.remainingAmount}`) || 0),
        0
      )

      let dueDate: string | null = null
      let description = ''

      if (unpaidReservations.length > 0) {
        // Find the reservation with the earliest due date
        const earliestReservation = unpaidReservations.reduce((earliest, current) => {
          if (!earliest.departDate) return current
          if (!current.departDate) return earliest
          return current.departDate < earliest.departDate ? current : earliest
        })

        dueDate = earliestReservation.departDate?.toISODate() ?? null

        if (unpaidReservations.length === 1) {
          const r = unpaidReservations[0]
          description = `This is the final payment for booking #${r.reservationNumber} at ${r.hotel.hotelName}.`
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
          reservationNumber: r.reservationNumber,
          remainingAmount: r.remainingAmount,
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


      // 2. Fetch all service assignments for the user, with department and service info
      const assignments = await ServiceUserAssignment.query()
        .where('user_id', userId)
        .preload('department')
        .preload('hotel')
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
        permis_discounts: user.permisDiscounts ? JSON.parse(user.permisDiscounts) : [],
        permis_privileges: user.permisPrivileges ? JSON.parse(user.permisPrivileges) : [],
        permis_reports: user.permisReports ? JSON.parse(user.permisReports) : [],
      }

      if (assignments && assignments.length > 0) {
        responseData.department = assignments[0].department?.serialize()
        responseData.hireDate = assignments[0].hire_date?.toISODate() ?? null
        responseData.role = assignments[0].role // This is the specific role/title in the assignment
      }

      return response.ok({ ...responseData })
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
    const serviceId = parseInt(params.serviceId)

    if (isNaN(serviceId)) {
      return response.badRequest({ message: 'Invalid serviceId' })
    }

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
      'permis_discounts',
      'permis_privileges',
      'permis_reports',
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
      roleId: role.id,
      createdBy: currentUser.id,
      lastModifiedBy: currentUser.id,
      permisDiscounts: data.permis_discounts ? JSON.stringify(data.permis_discounts) : null,
      permisPrivileges: data.permis_privileges ? JSON.stringify(data.permis_privileges) : null,
      permisReports: data.permis_reports ? JSON.stringify(data.permis_reports) : null,
    })

    return response.created(newUser)
  } catch (error) {
    console.error('Error creating client:', error)
    return response.internalServerError({
      message: 'Error creating client.',
    })
  }
}

/**
 * getUser By Id
 */
public async getUserById({ params, response }: HttpContext) {
    try {
      const id = params.id

      const users = await User.query()
        .where('id', id)
        .preload('role')
        .preload('serviceAssignments', (query) => {
          query.preload('department')
        })
        .preload('hotel')
        .firstOrFail()

      return response.ok({
        success: true,
        data: users,
        message: 'user récupéré avec succès',
      })
    } catch (error) {
      console.error('Error retrieving room block:', error)

      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({
          success: false,
          message: 'user non trouvé',
        })
      }

      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la récupération du user',
        error: error.message,
      })
    }
  }




}
