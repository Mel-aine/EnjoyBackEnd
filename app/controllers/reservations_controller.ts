import CrudController from '#controllers/crud_controller'
import CrudService from '#services/crud_service'
import User from '#models/user'
import Reservation from '#models/reservation'
import type { HttpContext } from '@adonisjs/core/http'

export default class ReservationsController extends CrudController<typeof Reservation> {
  private userService: CrudService<typeof User>
  private reservationService: CrudService<typeof Reservation>

  constructor() {
    // Appelle le constructeur parent avec le service de réservation
    super(new CrudService(Reservation))

    // Initialise les services nécessaires
    this.userService = new CrudService(User)
    this.reservationService = new CrudService(Reservation)
  }

  public async createWithUserAndReservation({ request, response }: HttpContext) {
    const data = request.body()

    try {
      // Créer l'utilisateur
      const user = await this.userService.create({
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone_number: data.phone_number,
        role_id: data.role_id || 4,
        status: 'active',
        created_by: data.created_by || null,
        last_modified_by: data.last_modified_by || null,
      })

      // Créer la réservation associée à l'utilisateur
      // const reservation = await this.reservationService.create({
      //   user_id: user.id,
      //   service_id: data.service_id,
      //   reservation_type: data.reservation_type,
      //   reservation_number: data.reservation_number || null,
      //   status: data.status || 'pending',
      //   total_amount: data.total_amount,
      //   guest_count: data.guest_count,
      //   number_of_seats: data.number_of_seats || null,
      //   special_requests: data.special_requests || null,
      //   cancellation_reason: data.cancellation_reason || null,
      //   arrived_date: data.arrived_date,
      //   depart_date: data.depart_date,
      //   reservation_product: data.reservation_product,
      //   reservation_time: data.reservation_time,
      //   comment: data.comment,
      //   created_by: user.id,
      //   last_modified_by: user.id,
      //   payment: data.payment,
      //   payment_status: data.payment_status,
      // })
      // Ajoute ces champs à ton payload de création
      const reservation = await this.reservationService.create({
        user_id: user.id,
        service_id: data.service_id,
        reservation_type: data.reservation_type,
        reservation_number: data.reservation_number || null,
        status: data.status || 'pending',
        total_amount: data.total_amount,
        guest_count: data.guest_count,
        number_of_seats: data.number_of_seats || null,
        special_requests: data.special_requests || null,
        cancellation_reason: data.cancellation_reason || null,
        arrived_date: data.arrived_date,
        depart_date: data.depart_date,
        reservation_product: data.reservation_product,
        reservation_time: data.reservation_time,
        comment: data.comment,
        created_by: user.id,
        last_modified_by: user.id,
        payment_status: data.payment_status,

        // Nouveaux champs du modèle
        discount_amount: data.discount_amount || 0,
        tax_amount: data.tax_amount || 0,
        final_amount: data.final_amount || data.total_amount,
        paid_amount: data.paid_amount || 0,
      })

      return response.created({ user, reservation })
    } catch (error) {
      return response.status(500).send({
        message: 'Error while creating',
        error: error.message,
      })
    }
  }

  public async updateReservation({ request, response, params }: HttpContext) {
    const reservationId = params.id
    const data = request.body()

    try {
      // Récupère la réservation
      const existingReservation = await this.reservationService.findById(reservationId)
      if (!existingReservation) {
        return response.status(404).send({ message: 'Reservation not found' })
      }

      // Met à jour l'utilisateur lié à la réservation si des infos utilisateur sont présentes
      const userId = existingReservation.user_id
      const userUpdatePayload: any = {}

      if (data.first_name) userUpdatePayload.first_name = data.first_name
      if (data.last_name) userUpdatePayload.last_name = data.last_name
      if (data.email) userUpdatePayload.email = data.email
      if (data.phone_number) userUpdatePayload.phone_number = data.phone_number
      if (data.role_id) userUpdatePayload.role_id = data.role_id
      if (data.last_modified_by) userUpdatePayload.last_modified_by = data.last_modified_by

      if (Object.keys(userUpdatePayload).length > 0) {
        await this.userService.update(userId, userUpdatePayload)
      }

      // Met à jour la réservation
      // const updatedReservation = await this.reservationService.update(reservationId, {
      //   service_id: data.service_id,
      //   reservation_type: data.reservation_type,
      //   status: data.status,
      //   total_amount: data.total_amount,
      //   total_person: data.total_person,
      //   arrived_date: data.arrived_date,
      //   depart_date: data.depart_date,
      //   reservation_product: data.reservation_product,
      //   reservation_time: data.reservation_time,
      //   comment: data.comment,
      //   last_modified_by: data.last_modified_by || existingReservation.last_modified_by,
      //   payment: data.payment,
      // })
      const updatedReservation = await this.reservationService.update(reservationId, {
        service_id: data.service_id,
        reservation_type: data.reservation_type,
        status: data.status,
        total_amount: data.total_amount,
        guest_count: data.guest_count,
        number_of_seats: data.number_of_seats,
        arrived_date: data.arrived_date,
        depart_date: data.depart_date,
        reservation_product: data.reservation_product,
        reservation_time: data.reservation_time,
        comment: data.comment,
        last_modified_by: data.last_modified_by || existingReservation.last_modified_by,
        payment_status: data.payment_status,
        discount_amount: data.discount_amount,
        tax_amount: data.tax_amount,
        final_amount: data.final_amount,
        paid_amount: data.paid_amount,
      })

      return response.ok({
        message: 'Reservation and user updated successfully',
        reservation: updatedReservation,
      })
    } catch (error) {
      return response.status(500).send({
        message: 'Error while updating reservation or user',
        error: error.message,
      })
    }
  }
}
