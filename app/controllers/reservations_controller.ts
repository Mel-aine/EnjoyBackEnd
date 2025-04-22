

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
        role_id: data.role_id || 1,
        status: 'active',
        created_by: data.created_by || null,
        last_modified_by: data.last_modified_by || null,
      })

      // Créer la réservation associée à l'utilisateur
      const reservation = await this.reservationService.create({
        user_id: user.id,
        service_id: data.service_id,
        reservation_type: data.reservation_type,
        status: data.status || 'pending',
        total_price: data.total_price,
        total_person: data.total_person,
        arrived_date: data.arrived_date,
        depart_date: data.depart_date,
        reservation_product : data.reservation_product,
        reservation_time: data.reservation_time,
        comment: data.comment,
        created_by: user.id,
        last_modified_by: user.id,
        payment:data.payment
      })

      return response.created({ user, reservation })
    } catch (error) {
      return response.status(500).send({
        message: 'Erreur lors de la création',
        error: error.message,
      })
    }
  }
}




