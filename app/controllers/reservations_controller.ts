// import CrudController from '#controllers/crud_controller'
// import CrudService from '#services/crud_service'
// import User from '#models/user'
// import Reservation from '#models/reservation'
// import ReservationServiceProduct from '#models/reservation_service_product'

// import type { HttpContext } from '@adonisjs/core/http'

// export default class ReservationsController extends CrudController<typeof Reservation> {
//   private userService: CrudService<typeof User>
//   private reservationService: CrudService<typeof Reservation>

//   constructor() {
//     // Appelle le constructeur parent avec le service de réservation
//     super(new CrudService(Reservation))

//     // Initialise les services nécessaires
//     this.userService = new CrudService(User)
//     this.reservationService = new CrudService(Reservation)
//   }

//   public async createWithUserAndReservation({ request, response }: HttpContext) {
//     const data = request.body()

//     try {
//       // Créer l'utilisateur
//       const user = await this.userService.create({
//         first_name: data.first_name,
//         last_name: data.last_name,
//         email: data.email,
//         phone_number: data.phone_number,
//         role_id: data.role_id || 4,
//         status: 'active',
//         created_by: data.created_by || null,
//         last_modified_by: data.last_modified_by || null,
//       })

//       // Créer la réservation associée à l'utilisateur
//       // const reservation = await this.reservationService.create({
//       //   user_id: user.id,
//       //   service_id: data.service_id,
//       //   reservation_type: data.reservation_type,
//       //   reservation_number: data.reservation_number || null,
//       //   status: data.status || 'pending',
//       //   total_amount: data.total_amount,
//       //   guest_count: data.guest_count,
//       //   number_of_seats: data.number_of_seats || null,
//       //   special_requests: data.special_requests || null,
//       //   cancellation_reason: data.cancellation_reason || null,
//       //   arrived_date: data.arrived_date,
//       //   depart_date: data.depart_date,
//       //   reservation_product: data.reservation_product,
//       //   reservation_time: data.reservation_time,
//       //   comment: data.comment,
//       //   created_by: user.id,
//       //   last_modified_by: user.id,
//       //   payment: data.payment,
//       //   payment_status: data.payment_status,
//       // })
//       // Ajoute ces champs à ton payload de création
//       const reservation = await this.reservationService.create({
//         user_id: user.id,
//         service_id: data.service_id,
//         reservation_type: data.reservation_type,
//         reservation_number: data.reservation_number || null,
//         status: data.status || 'pending',
//         total_amount: data.total_amount,
//         guest_count: data.guest_count,
//         number_of_seats: data.number_of_seats || null,
//         special_requests: data.special_requests || null,
//         cancellation_reason: data.cancellation_reason || null,
//         arrived_date: data.arrived_date,
//         depart_date: data.depart_date,
//         reservation_product: data.reservation_product,
//         reservation_time: data.reservation_time,
//         comment: data.comment,
//         created_by: user.id,
//         last_modified_by: user.id,
//         payment_status: data.payment_status,

//         // Nouveaux champs du modèle
//         discount_amount: data.discount_amount || 0,
//         tax_amount: data.tax_amount || 0,
//         final_amount: data.final_amount || data.total_amount,
//         paid_amount: data.paid_amount || 0,
//       })
//       if (Array.isArray(data.products)) {
//         const serviceProductsToCreate = data.products.map((item) => ({
//           reservation_id: reservation.id,
//           service_product_id: item.service_product_id,
//           start_date: item.start_date,
//           end_date: item.end_date,
//           created_by: user.id,
//           last_modified_by: user.id,
//         }))

//         await ReservationServiceProduct.createMany(serviceProductsToCreate)
//       }

//       return response.created({ user, reservation })
//     } catch (error) {
//       return response.status(500).send({
//         message: 'Error while creating',
//         error: error.message,
//       })
//     }
//   }

//   public async updateReservation({ request, response, params }: HttpContext) {
//     const reservationId = params.id
//     const data = request.body()

//     try {
//       // Récupère la réservation
//       const existingReservation = await this.reservationService.findById(reservationId)
//       if (!existingReservation) {
//         return response.status(404).send({ message: 'Reservation not found' })
//       }

//       // Met à jour l'utilisateur lié à la réservation si des infos utilisateur sont présentes
//       const userId = existingReservation.user_id
//       const userUpdatePayload: any = {}

//       if (data.first_name) userUpdatePayload.first_name = data.first_name
//       if (data.last_name) userUpdatePayload.last_name = data.last_name
//       if (data.email) userUpdatePayload.email = data.email
//       if (data.phone_number) userUpdatePayload.phone_number = data.phone_number
//       if (data.role_id) userUpdatePayload.role_id = data.role_id
//       if (data.last_modified_by) userUpdatePayload.last_modified_by = data.last_modified_by

//       if (Object.keys(userUpdatePayload).length > 0) {
//         await this.userService.update(userId, userUpdatePayload)
//       }

//       // Met à jour la réservation
//       // const updatedReservation = await this.reservationService.update(reservationId, {
//       //   service_id: data.service_id,
//       //   reservation_type: data.reservation_type,
//       //   status: data.status,
//       //   total_amount: data.total_amount,
//       //   total_person: data.total_person,
//       //   arrived_date: data.arrived_date,
//       //   depart_date: data.depart_date,
//       //   reservation_product: data.reservation_product,
//       //   reservation_time: data.reservation_time,
//       //   comment: data.comment,
//       //   last_modified_by: data.last_modified_by || existingReservation.last_modified_by,
//       //   payment: data.payment,
//       // })
//       const updatedReservation = await this.reservationService.update(reservationId, {
//         service_id: data.service_id,
//         reservation_type: data.reservation_type,
//         status: data.status,
//         total_amount: data.total_amount,
//         guest_count: data.guest_count,
//         number_of_seats: data.number_of_seats,
//         arrived_date: data.arrived_date,
//         depart_date: data.depart_date,
//         reservation_product: data.reservation_product,
//         reservation_time: data.reservation_time,
//         comment: data.comment,
//         last_modified_by: data.last_modified_by || existingReservation.last_modified_by,
//         payment_status: data.payment_status,
//         discount_amount: data.discount_amount,
//         tax_amount: data.tax_amount,
//         final_amount: data.final_amount,
//         paid_amount: data.paid_amount,
//       })
//       if (Array.isArray(data.products)) {
//         // Supprime les anciens
//         await ReservationServiceProduct.query()
//           .where('reservation_id', reservationId)
//           .delete()

//         // Ajoute les nouveaux
//         const newProducts = data.products.map((item) => ({
//           reservation_id: reservationId,
//           service_product_id: item.service_product_id,
//           start_date: item.start_date,
//           end_date: item.end_date,
//           created_by: data.last_modified_by,
//           last_modified_by: data.last_modified_by,
//         }))

//         await ReservationServiceProduct.createMany(newProducts)
//       }

//       return response.ok({
//         message: 'Reservation and user updated successfully',
//         reservation: updatedReservation,
//       })
//     } catch (error) {
//       return response.status(500).send({
//         message: 'Error while updating reservation or user',
//         error: error.message,
//       })
//     }
//   }
// }
import CrudController from '#controllers/crud_controller'
import CrudService from '#services/crud_service'
import User from '#models/user'
import Reservation from '#models/reservation'
import ServiceProduct from '#models/service_product'
import ReservationServiceProduct from '#models/reservation_service_product'
import type { HttpContext } from '@adonisjs/core/http'
import LoggerService from '#services/logger_service'
import { generateReservationNumber } from '../utils/generate_reservation_number.js'
import { DateTime } from 'luxon'

export default class ReservationsController extends CrudController<typeof Reservation> {
  private userService: CrudService<typeof User>
  private reservationService: CrudService<typeof Reservation>

  constructor() {
    super(new CrudService(Reservation))
    this.userService = new CrudService(User)
    this.reservationService = new CrudService(Reservation)
  }



  public async createWithUserAndReservation(ctx: HttpContext) {
    console.log(JSON.stringify(ctx.request.body()))
    const { request, response } = ctx
    const data = request.body()
    try {
      let user = await User.query().where('email', data.email).first()

      if (!user) {
        user = await this.userService.create({
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          phone_number: data.phone_number,
          role_id: data.role_id || 4,
          status: 'active',
          created_by: data.created_by || null,
          last_modified_by: data.last_modified_by || null,
        })
      }
      const reservation = await this.reservationService.create({
        user_id: user.id,
        service_id: data.service_id,
        reservation_type: data.reservation_type || 'Booking via Enjoy',
        reservation_number: generateReservationNumber(),
        status: data.status || 'pending',
        total_amount: data.total_amount,
        guest_count: data.guest_count,
        number_of_seats: data.number_of_seats || null,
        special_requests: data.special_requests || null,
        cancellation_reason: data.cancellation_reason || null,
        arrived_date: data.arrived_date || null,
        depart_date: data.depart_date || null,
        reservation_time: data.reservation_time || null,
        comment: data.comment,
        created_by: user.id,
        last_modified_by: user.id,
        customer_type: data.customer_type || null,
        group_name: data.group_name || null,
        company_name: data.company_name || null,
        payment_status: data.payment_status || 'pending',
        discount_amount: data.discount_amount || 0,
        tax_amount: data.tax_amount || 0,
        final_amount: data.final_amount || data.total_amount,
        paid_amount: data.paid_amount || 0,
        booking_source: data.booking_source || null,
        check_in_date: data.check_in_date || null,
        check_out_date: data.check_out_date || null,
        number_of_nights: data.number_of_nights || null,
        remaining_amount: data.remaining_amount || 0,
        invoice_available: data.invoice_available || false,

      })
      if (Array.isArray(data.products) && data.products.length > 0) {
        const productsPayload = data.products.map((item) => {
        const numberOfNights = reservation.number_of_nights ?? 0;
        const extraGuests = parseInt(item.extra_guest, 10) || 0;
        const extraGuestPrice = reservation.tax_amount || 0;
        const totalExtraGuestPrice = extraGuestPrice * extraGuests * numberOfNights;
        return {
          reservation_id: reservation.id,
          service_product_id: item.service_product_id,
          start_date: item.start_date,
          end_date: item.end_date,
          created_by: user.id,
          last_modified_by: user.id,
          total_adult: parseInt(item.total_adult, 10) || 0,
          total_children: parseInt(item.total_children, 10) || 0,
          rate_per_night: item.rate_per_night,
          taxes: item.taxes,
          discounts: item.discounts,
          extra_guest: extraGuests,
          extra_guest_price: extraGuestPrice,
          total_extra_guest_price: totalExtraGuestPrice,
          total_amount: totalExtraGuestPrice + item.rate_per_night * numberOfNights,
          // TODO status: 'awaiting',
        };
      });


        await ReservationServiceProduct.createMany(productsPayload)

        for (const product of data.products) {
          const serviceProduct = await ServiceProduct.find(product.service_product_id)
          if (serviceProduct && serviceProduct.status !== 'occupied' && serviceProduct.status !== 'checked-in') {
            serviceProduct.status = 'booked'
            await serviceProduct.save()
          }
        }
      }

      // Log the activity using our new service
      await LoggerService.log({
        actorId: user.id,
        action: 'CREATE',
        entityType: 'Reservation',
        entityId: reservation.id,
        description: `Reservation #${reservation.id} was created for user ${user.first_name}.`,
        ctx: ctx, // Pass the full context
      })

      return response.created({ user, reservation })
    } catch (error) {
      return response.status(500).send({
        message: 'Erreur lors de la création de l’utilisateur ou de la réservation',
        error: error.message,
      })
    }
  }

  public async updateReservation(ctx: HttpContext) {
  const { request, response, params } = ctx
  const reservationId = params.id
  const data = request.body()

  try {
    const existingReservation = await this.reservationService.findById(reservationId)
    if (!existingReservation) {
      return response.status(404).send({ message: 'Reservation not found' })
    }

    const userId = existingReservation.user_id
    const userUpdatePayload: Partial<User> = {}

    if (data.first_name) userUpdatePayload.first_name = data.first_name
    if (data.last_name) userUpdatePayload.last_name = data.last_name
    if (data.email) userUpdatePayload.email = data.email
    if (data.phone_number) userUpdatePayload.phone_number = data.phone_number
    if (data.role_id) userUpdatePayload.role_id = data.role_id
    if (data.last_modified_by) userUpdatePayload.last_modified_by = data.last_modified_by

    if (Object.keys(userUpdatePayload).length > 0) {
      await this.userService.update(userId, userUpdatePayload)
    }

    const updatedReservation = await this.reservationService.update(reservationId, {
      service_id: data.service_id,
      reservation_type: data.reservation_type,
      customer_type: data.customer_type,
      status: data.status,
      total_amount: data.total_amount,
      guest_count: data.guest_count,
      number_of_seats: data.number_of_seats,
      arrived_date: data.arrived_date,
      depart_date: data.depart_date,
      reservation_time: data.reservation_time,
      group_name: data.group_name,
      company_name: data.company_name,
      comment: data.comment,
      last_modified_by: data.last_modified_by || existingReservation.last_modified_by,
      payment_status: data.payment_status,
      discount_amount: data.discount_amount,
      tax_amount: data.tax_amount,
      final_amount: data.final_amount,
      paid_amount: data.paid_amount,
    })


    if (!updatedReservation) {
      return response.status(500).send({
        message: 'Échec de la mise à jour de la réservation',
      })
    }

    // 🔁 Gestion des produits liés à la réservation
    if (Array.isArray(data.products)) {
      // Libérer les anciennes chambres
      const oldProducts = await ReservationServiceProduct.query()
        .where('reservation_id', reservationId)

      for (const product of oldProducts) {
        await ServiceProduct.query()
          .where('id', product.service_product_id)
          .update({ status: 'available' })
      }

      // Supprimer les anciens liens
      await ReservationServiceProduct.query()
        .where('reservation_id', reservationId)
        .delete()

      const numberOfNights = updatedReservation.number_of_nights ?? 0

      const productsPayload = data.products.map((item) => {
        const extraGuests = parseInt(item.extra_guest, 10) || 0
        const extraGuestPrice = updatedReservation.tax_amount || 0;
        const totalExtraGuestPrice = extraGuestPrice * extraGuests * numberOfNights
        return {
          reservation_id: reservationId,
          service_product_id: item.service_product_id,
          start_date: item.start_date,
          end_date: item.end_date,
          created_by: data.last_modified_by,
          last_modified_by: data.last_modified_by,
          total_adult: parseInt(item.total_adult, 10) || 0,
          total_children: parseInt(item.total_children, 10) || 0,
          rate_per_night: item.rate_per_night,
          taxes: item.taxes,
          discounts: item.discounts,
          extra_guest: extraGuests,
          extra_guest_price: extraGuestPrice,
          total_extra_guest_price: totalExtraGuestPrice,
          total_amount: totalExtraGuestPrice + (item.rate_per_night || 0) * numberOfNights
        }
      })

      // Créer les nouveaux liens
      await ReservationServiceProduct.createMany(productsPayload)

      const productIds = data.products.map(p => p.service_product_id)

      await ServiceProduct.query()
        .whereIn('id', productIds)
        .update({ status: 'booked' })
    }

    // ✅ Logging de l'action
    await LoggerService.log({
      actorId: data.last_modified_by || existingReservation.last_modified_by,
      action: 'UPDATE',
      entityType: 'Reservation',
      entityId: reservationId,
      description: `Reservation #${reservationId} was updated.`,
      ctx: ctx,
    })

    return response.ok({
      message: 'Réservation et utilisateur mis à jour avec succès',
      reservation: updatedReservation,
    })
  } catch (error) {
    console.error('🔴 Erreur lors de la mise à jour de la réservation :', error)
    return response.status(500).send({
      message: 'Erreur lors de la mise à jour de la réservation ou de l’utilisateur',
      error: error.message,
      stack: error.stack,
      dataReceived: data
    })
  }
}


  async showByServiceProductId({ params, response }: HttpContext) {
    try {
      const { serviceProductId } = params

      // Validation du paramètre
      if (!serviceProductId) {
        return response.badRequest({ message: 'serviceProductId is required' })
      }

      const serviceIdNum = parseInt(serviceProductId, 10)
      if (isNaN(serviceIdNum)) {
        return response.badRequest({ message: 'Invalid serviceProductId' })
      }

      // Récupération des réservations liées à un service product
      const items = await ReservationServiceProduct.query()
        .where('service_product_id', serviceIdNum)
        .preload('reservation')
        .preload('serviceProduct')
        .preload('creator')
        .preload('modifier')

      // Si aucune réservation trouvée
      if (items.length === 0) {
        return response.notFound({ message: 'No reservations found for this service product' })
      }

      return response.ok(items)
    } catch (error) {
      console.error(error)
      return response.internalServerError({
        message: 'Error fetching reservations for service product',
        error: error.message,
      })
    }
  }

  public async checkIn(ctx: HttpContext) {
    const { params, response, request } = ctx;
    const { reservationServiceProducts } = request.body();
    try {
      console.log('Check-in started for reservation ID:', params.id);

      const reservation = await this.reservationService.findById(params.id);
      console.log('Reservation fetched:', reservation);

      if (!reservation) {
        return response.notFound({ message: 'Reservation not found' });
      }

      // Récupérer la liaison avec les produits
      const reservationProducts = await ReservationServiceProduct.query()
        .where('reservation_id', reservation.id).andWhereIn('id', reservationServiceProducts);

      if (!reservationProducts.length) {
        return response.notFound({ message: 'No service product linked to this reservation' });
      }
      const now = DateTime.now();;
      if(!reservation.check_in_date){
        reservation.check_in_date = now;
      }
      for (const link of reservationProducts) {

        const serviceProduct = await ServiceProduct.find(link.service_product_id);
        // TODO link.status ='check_in';
        // TODO link.check_in_date= new Date();
        await link.save();
        if (serviceProduct) {
          serviceProduct.status = 'occupied';
          await serviceProduct.save();
          console.log(`Service product ${serviceProduct.id} status updated to occupied`);
        }
      }

      // Mettre à jour le statut de la réservation
      await this.reservationService.update(reservation.id, { status: 'checked-in' });
      console.log('Reservation status updated to checked-in');

      // Log the check-in activity
      await LoggerService.log({
        actorId: reservation.last_modified_by!, // Assuming the user who checks in is the last modifier
        action: 'CHECK_IN',
        entityType: 'Reservation',
        entityId: reservation.id,
        description: `Reservation #${reservation.id} was checked in.`,
        ctx: ctx,
      })

      return response.ok({
        message: 'Check-in successful',
        reservation,
        reservationProducts,
        serviceProducts: reservationProducts.map((rp) => rp.service_product_id),
      });

    } catch (error) {
      console.error('Error during check-in:', error);
      return response.status(500).send({
        message: 'Error during check-in',
        error: error.message,
      });
    }
  }



  public async checkOut(ctx: HttpContext) {
    const { params, response,request } = ctx
    const { reservationServiceProducts } = request.body();
    try {
      console.log('Check-out started for reservation ID:', params.id);

      const reservation = await this.reservationService.findById(params.id);
      console.log('Reservation fetched:', reservation);

      if (!reservation) {
        return response.notFound({ message: 'Reservation not found' });
      }

      const resServices = await ReservationServiceProduct.query()
        .where('reservation_id', params.id).andWhereIn('id', reservationServiceProducts)
        .preload('serviceProduct');

      if (resServices.length === 0) {
        return response.notFound({ message: 'No service products linked to this reservation' });
      }
/// TODO Update the Reservation status to checkout if all the reservations product are checked out. 
      await this.reservationService.update(reservation.id, { status: 'checked-out' });
      console.log('Reservation status updated to checked-out');

      const updatedServiceProducts: number[] = [];

      for (const rsp of resServices) {
        //rsp.check_out_date = DateTime.now();
        //rsp.status = 'checked-out';
        //await rsp.save();
        const serviceProduct = rsp.serviceProduct;
        if (serviceProduct) {
          serviceProduct.status = 'cleaning';
          await serviceProduct.save();
          updatedServiceProducts.push(serviceProduct.id);
          console.log(`Service product ${serviceProduct.id} status updated to cleaning`);
        }
      }

      // Log the check-out activity
      await LoggerService.log({
        actorId: reservation.last_modified_by!, // Assuming the user who checks out is the last modifier
        action: 'CHECK_OUT',
        entityType: 'Reservation',
        entityId: reservation.id,
        description: `Reservation #${reservation.id} was checked out.`,
        ctx: ctx,
      })

      return response.ok({
        message: 'Check-out successful',
        reservation,
        reservationProducts: resServices.map(rsp => rsp.id),
        serviceProducts: updatedServiceProducts,
      });
    } catch (error) {
      console.error('Error during check-out:', error);
      return response.status(500).send({
        message: 'Error during check-out',
        error: error.message,
      });
    }
  }

  /**
 * Get a single reservation with all its related information,
 * including the user, service product, and payment.
 *
 * GET /reservations/:id
 */
  public async getReservationDetails({ params, response }: HttpContext) {
    try {
      const reservationId = params.reservationId

      const reservation = await Reservation.query()
        .where('id', reservationId)
        .preload('user')
        .preload('service')
        .preload('payments')
        .preload('reservationServiceProducts', (query) => {
          query.preload('serviceProduct')
        })
        .first()

      if (!reservation) {
        return response.notFound({ message: 'Reservation not found' })
      }

      return response.ok(reservation)
    } catch (error) {
      console.error('Error fetching reservation details:', error)
      return response.internalServerError({ message: 'An error occurred while fetching the reservation.' })
    }
  }
}
