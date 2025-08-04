
import CrudController from '#controllers/crud_controller'
import CrudService from '#services/crud_service'
import User from '#models/user'
import Reservation, { ReservationStatus } from '#models/reservation'
import ServiceProduct from '#models/service_product'
import ReservationServiceProduct from '#models/reservation_service_product'
import type { HttpContext } from '@adonisjs/core/http'
import LoggerService from '#services/logger_service'
import { generateReservationNumber } from '../utils/generate_reservation_number.js'
import { DateTime } from 'luxon'
import vine from '@vinejs/vine'
import db from '@adonisjs/lucid/services/db'
import CancellationPolicy from '#models/cancellation_policy'
import Refund from '#models/refund'
import { ReservationProductStatus } from '../enums.js'
// import { messages } from '@vinejs/vine/defaults'
import logger from '@adonisjs/core/services/logger'
import AmenityBooking from '../models/amenity_booking.js'


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
    const { request, response, auth } = ctx
    const data = request.body()
    const trx = await db.transaction()
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
          created_by: auth.user?.id,
          last_modified_by: auth.user?.id,
        })
      }
      const reservation = await this.reservationService.create({
        user_id: user.id,
        service_id: data.service_id,
        reservation_type: data.reservation_type || 'Booking via Enjoy',
        reservation_number: generateReservationNumber(),
        status: data.status || ReservationStatus.PENDING,
        total_amount: data.total_amount,
        guest_count: data.guest_count,
        number_of_seats: data.number_of_seats || null,
        special_requests: data.special_requests || null,
        cancellation_reason: data.cancellation_reason || null,
        arrived_date: data.arrived_date || null,
        depart_date: data.depart_date || null,
        reservation_time: data.reservation_time || null,
        comment: data.comment,
        created_by: auth.user?.id,
        last_modified_by: auth.user?.id,
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
            status: ReservationProductStatus.PENDING
          };
        });


        await ReservationServiceProduct.createMany(productsPayload)

        for (const product of data.products) {
          const serviceProduct = await ServiceProduct.find(product.service_product_id)
          if (serviceProduct && serviceProduct.status !== 'occupied' && serviceProduct.status !== 'checked-in') {
            serviceProduct.status = 'available'
            await serviceProduct.save()
          }
        }
      }

      // Log the activity using our new service
      await LoggerService.log({
        actorId: auth.user?.id!,
        action: 'CREATE',
        entityType: 'Reservation',
        entityId: reservation.id,
        description: `Reservation #${reservation.id} was created for user ${user.first_name}.`,
        ctx: ctx, // Pass the full context
      })
      trx.commit()
      return response.created({ user, reservation })
    } catch (error) {
      trx.rollback()
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
    const { params, response, request, auth } = ctx;
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
      const now = DateTime.now();

      reservation.check_in_date = now;

      for (const link of reservationProducts) {

        const serviceProduct = await ServiceProduct.find(link.service_product_id);
        link.status = ReservationProductStatus.CHECKED_IN;
        link.check_in_date = now;
        await link.save();
        if (serviceProduct) {
          serviceProduct.status = 'occupied';
          await serviceProduct.save();
          console.log(`Service product ${serviceProduct.id} status updated to occupied`);
        }
      }
      reservation.status = ReservationStatus.CHECKED_IN;
      await reservation.save();

      // Mettre à jour le statut de la réservation
      console.log('Reservation status updated to checked-in');

      await LoggerService.log({
        actorId: auth.user!.id, // Assuming the user who checks in is the last modifier
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
    const { params, response, request, auth } = ctx
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

      const updatedServiceProducts: number[] = [];

      for (const rsp of resServices) {
        rsp.check_out_date = DateTime.now();
        rsp.status = ReservationProductStatus.CHECKED_OUT;
        await rsp.save();
        const serviceProduct = rsp.serviceProduct;
        if (serviceProduct) {
          serviceProduct.status = 'dirty';
          await serviceProduct.save();
          updatedServiceProducts.push(serviceProduct.id);
          console.log(`Service product ${serviceProduct.id} status updated to cleaning`);
        }
      }

      const res = await ReservationServiceProduct.query().where('reservation_id', params.id).andWhere('status', '<>', 'checked-out')
      const allCheckedOut = res.length === 0;
      if (allCheckedOut) {
        reservation.check_out_date = DateTime.now();
        reservation.status = ReservationStatus.CHECKED_OUT
        await reservation.save();
        console.log('Reservation status updated to checked-out');
      }

      // Log the check-out activity
      await LoggerService.log({
        actorId: auth.user!.id, // Assuming the user who checks out is the last modifier
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



  /**
 * Verify if user can extend stay in the hotel
 * @param {HttpContext} ctx - Le contexte HTTP
 * @body {{ new_depart_date: string }} - New Depart Date au format ISO (YYYY-MM-DD).
 */
  public async checkExtendStay(ctx: HttpContext) {
    const { params, request, response } = ctx
    const reservationId = params.id
    const res = {
      scenario: -1,
      messages: ""
    }
    const validator = vine.compile(
      vine.object({
        new_depart_date: vine.date(),
      })
    )
    const trx = await db.transaction()
    try {

      const payload = await request.validateUsing(validator, {
        data: request.body(),
      })

      const newDepartDate = DateTime.fromJSDate(payload.new_depart_date)

      const reservation = await Reservation.query({ client: trx })
        .where('id', reservationId)
        .preload('reservationServiceProducts')
        .first()

      if (!reservation) {
        await trx.rollback()
        res.messages = 'Reservation not found.'
        return response.status(200).json(res)
      }

      const oldDepartDate = reservation.depart_date

      if (!oldDepartDate || newDepartDate <= oldDepartDate) {
        await trx.rollback();
        res.messages = 'The new departure date must be later than the current departure date.'
        return response
          .status(200)
          .json(res)
      }

      // --- Vérification des conflits ---
      const conflicts = []
      for (const rsp of reservation.reservationServiceProducts) {
        const product = await ServiceProduct.find(rsp.service_product_id)
        const conflictingReservation = await ReservationServiceProduct.query({ client: trx })
          .where('service_product_id', rsp.service_product_id)
          .where('reservation_id', '!=', reservationId)
          .andWhere((query) => {
            query

              .where('start_date', '<', newDepartDate.toISODate()!)
              .andWhere('start_date', '>=', DateTime.now().toISODate()!)
            // .andWhere('end_date', '>', oldDepartDate.toISODate()!)
          })
          .first()
        logger.info(conflictingReservation)
        if (conflictingReservation) {
          conflicts.push({
            productName: product?.product_name || `ID ${rsp.service_product_id}`,
            productId: rsp.service_product_id,
          })
        }
      }

      if (conflicts.length > 0) {
        await trx.rollback()
        res.scenario = 0
        return response.status(200).json(res)
      } else {
        res.scenario = 2
        return response.status(200).json(res)
      }
    } catch (error) {
      await trx.rollback();
      res.messages = "An error has occurred." + error.message
      console.error('Erreur lors de la prolongation du séjour :', error)
      return response.status(200)
        .json(res)
    }
  }
  /**
   * Prolonge la date de départ d'une réservation existante.
   * @param {HttpContext} ctx - Le contexte HTTP
   * @body {{ new_depart_date: string }} - La nouvelle date de départ au format ISO (YYYY-MM-DD).
   */
  public async extendStay(ctx: HttpContext) {
    const { params, request, response, auth } = ctx
    const reservationId = params.id

    // const validator = vine.compile(
    //   vine.object({
    //     new_depart_date: vine.date(),
    //   })
    // )
    const trx = await db.transaction()
    try {

      // const payload = await request.validateUsing(validator, {
      //   data: request.body(),
      // })
      const body = request.body();
      //const newDepartDate = DateTime.fromJSDate(payload.new_depart_date)
      const reservation = await Reservation.query({ client: trx })
        .where('id', reservationId)
        .preload('reservationServiceProducts')
        .first()

      if (!reservation || !reservation.arrived_date) {
        await trx.rollback()
        return response.notFound({ message: 'Réservation non trouvée.' })
      }

      if (!body.new_depart_date) {
        await trx.rollback()
        return response.notFound({ message: 'Réservation non trouvée.' })
      }
      reservation.depart_date = body.new_depart_date;
      // --- Aucune conflit : Procéder à la prolongation ---
      const oldReservationData = { ...reservation.serialize() }
      const newDepartDate = reservation.depart_date;

      // const newDepartDateLuxon = DateTime.fromISO(newDepartDate);
      // const arrivedDateLuxon = DateTime.fromJSDate(new Date(reservation.arrived_date));
      const newDepartDateLuxon = DateTime.fromISO(String(newDepartDate));
      const arrivedDateLuxon = DateTime.fromISO(String(reservation.arrived_date));

      const oldNumberOfNights = reservation.number_of_nights || 0
      const newNumberOfNights = newDepartDateLuxon!.diff(arrivedDateLuxon, 'days').days
      const additionalNights = newNumberOfNights - oldNumberOfNights
      let additionalAmount = 0
      // Mettre à jour les produits de la réservation
      for (const rsp of reservation.reservationServiceProducts) {
        const rspInTrx = await ReservationServiceProduct.findOrFail(rsp.id, { client: trx })

        const additionalProductCost = parseFloat(`${rspInTrx.rate_per_night!}`) * additionalNights
        additionalAmount += additionalProductCost

        rspInTrx.end_date = newDepartDate!
        rspInTrx.total_amount = parseFloat(`${rspInTrx.total_amount!}`) + additionalProductCost
        rspInTrx.last_modified_by = auth.user!.id
        await rspInTrx.save()
      }

      // Mettre à jour la réservation principale
      reservation.depart_date = newDepartDate
      reservation.number_of_nights = newNumberOfNights
      reservation.total_amount = parseFloat(`${reservation.total_amount!}`) + additionalAmount
      reservation.final_amount = parseFloat(`${reservation.final_amount!}`) + additionalAmount
      reservation.remaining_amount = parseFloat(`${reservation.remaining_amount!}`) + additionalAmount
      reservation.last_modified_by = auth.user!.id
      await reservation.save()

      await trx.commit()

      await LoggerService.log({
        actorId: auth.user!.id,
        action: 'UPDATE',
        entityType: 'Reservation',
        entityId: reservationId,
        description: `Stay for reservation #${reservationId} extended until ${newDepartDate}.`,
        changes: LoggerService.extractChanges(oldReservationData, reservation.serialize()),
        ctx,
      })

      return response.ok({ message: 'The stay was successfully extended.', reservation })
    } catch (error) {
      await trx.rollback()
      console.error('Erreur lors de la prolongation du séjour :', error)
      return response.internalServerError({ message: "An error has occurred.", error: error.message })
    }
  }

  public async getCancellationSummary({ params, response }: HttpContext) {
    try {
      const reservationId = params.id
      const reservation = await Reservation.query().where('id', reservationId).preload('service').preload('reservationServiceProducts').first()

      if (!reservation) {
        return response.notFound({ message: 'Reservation not found' })
      }

      const policy = await CancellationPolicy.query()
        .where('service_id', reservation.service_id)
        .orderBy('created_at', 'desc')
        .first()

      // Case where no policy is defined
      if (!policy) {
        return response.ok({
          isFreeCancellationPossible: true,
          cancellationFee: 0.00,
          deadline: null,
          summaryMessage: "Free cancellation possible at any time, as no policy is defined.",
        })
      }

      // Case where cancellation is always free
      if (policy.cancellation_fee_type === 'none') {
        return response.ok({
          isFreeCancellationPossible: true,
          cancellationFee: 0.00,
          deadline: null,
          summaryMessage: 'Free cancellation possible at any time.',
        })
      }

      if (!reservation.arrived_date) {
        return response.badRequest({ message: "The reservation does not have an arrival date." })
      }

      // Calculate free cancellation deadline
      // const arrivalDate = DateTime.fromJSDate(new Date(reservation.arrived_date))
      const arrivalDate = reservation.arrived_date
      if (!arrivalDate.isValid) {
        return response.badRequest({ message: 'Invalid arrival date format.' })
      }
      const freeCancellationDeadline = arrivalDate.minus({ [policy.free_cancellation_period_unit]: policy.free_cancellation_periodValue })

      const now = DateTime.now()
      const isFreeCancellationPossible = now <= freeCancellationDeadline

      let cancellationFee = 0.00
      let feeDescription = 'Gratuit'

      if (!isFreeCancellationPossible) {
        switch (policy.cancellation_fee_type) {
          case 'fixed':
            cancellationFee = parseFloat(`${policy.cancellation_fee_value || 0}`)
            feeDescription = `$${cancellationFee} (fixed fee)`
            break
          case 'percentage':
            cancellationFee =
              (reservation.final_amount || 0) * ((policy.cancellation_fee_value || 0) / 100)
            feeDescription = `${policy.cancellation_fee_value}% of the total amount`
            break
          case 'first_night':
            cancellationFee = reservation.reservationServiceProducts.reduce(
              (total, p) => total + (parseFloat(`${p.rate_per_night}`) || 0),
              0
            )
            feeDescription = `The amount of the first night ($${cancellationFee})`
            break
        }
      }

      const summaryMessage = isFreeCancellationPossible
        ? `Free cancellation possible until ${freeCancellationDeadline.toFormat('dd/MM/yyyy HH:mm')}.`
        : `A cancellation fee applies: ${feeDescription}. The deadline for free cancellation was ${freeCancellationDeadline.toFormat('dd/MM/yyyy HH:mm')}.`

      return response.ok({
        isFreeCancellationPossible,
        cancellationFee: isFreeCancellationPossible ? 0 : cancellationFee,
        deadline: freeCancellationDeadline.toISO(),
        summaryMessage,
        policyName: policy.policy_name,
      })
    } catch (error) {
      console.error('Error getting cancellation summary:', error)
      return response.internalServerError({
        message: 'Failed to get cancellation summary',
        error: error.message,
      })
    }
  }



  /**
   * Cancel a reservation, apply cancellation policy, and create a refund if necessary.
   * @param {HttpContext} ctx
   */
  public async cancelReservation(ctx: HttpContext) {
    const { params, request, response, auth } = ctx
    const reservationId = params.id
    const { reason = 'Cancelled by user' } = request.body()

    const trx = await db.transaction()

    try {
      // 1. Find the reservation and its related data
      const reservation = await Reservation.query({ client: trx })
        .where('id', reservationId)
        .preload('service')
        .first()

      if (!reservation) {
        await trx.rollback()
        return response.notFound({ message: 'Reservation not found.' })
      }

      // 2. Check if cancellation is allowed
      if (
        [ReservationStatus.CANCELLED, ReservationStatus.CHECKED_OUT, ReservationStatus.CHECKED_IN].includes(
          reservation.status as ReservationStatus
        )
      ) {
        await trx.rollback()
        return response.badRequest({
          message: `Cannot cancel a reservation with status '${reservation.status}'.`,
        })
      }

      // 3. Find the applicable cancellation policy
      const policy = await CancellationPolicy.query({ client: trx })
        .where('service_id', reservation.service_id)
        .orderBy('created_at', 'desc')
        .first()

      // Handle case where no policy is defined (default to full refund)
      if (!policy) {
        reservation.status = ReservationStatus.CANCELLED
        reservation.cancellation_reason = reason
        reservation.last_modified_by = auth.user!.id

        const totalPaid = reservation.paid_amount || 0
        if (totalPaid > 0) {
          await Refund.create(
            {
              reservation_id: reservation.id,
              refund_amount: totalPaid,
              reason: 'Full refund: No cancellation policy found.',
              status: 'processed',
              refund_date: DateTime.now(),
              refund_method: 'automatic',
              processed_by_user_id: auth.user!.id,
            },
            { client: trx }
          )
          reservation.payment_status = 'refunded'
        }
        await reservation.save()
        // const resServices = await ReservationServiceProduct.query()
        //   .where('reservation_id', params.id)
        //   .preload('serviceProduct');
        await LoggerService.log({
          actorId: auth.user!.id,
          action: 'CANCEL',
          entityType: 'Reservation',
          entityId: reservation.id,
          description: `Reservation #${reservation.id} cancelled. No policy found, full refund processed.`,
          ctx: ctx,
        })

        await trx.commit()
        return response.ok({
          message:
            'Reservation cancelled successfully. No policy was found, a full refund has been issued.',
        })
      }

      // 4. Calculate cancellation fee based on policy
      let cancellationFee = 0
      const now = DateTime.now()

      if (!reservation.arrived_date) {
        await trx.rollback()
        return response.badRequest({ message: 'Reservation is missing an arrival date.' })
      }

      // const hoursUntilCheckIn = DateTime.fromJSDate(new Date(reservation.arrived_date)).diff(now, 'hours').hours
      const hoursUntilCheckIn = reservation.arrived_date.diff(now, 'hours').hours
      const freeCancellationHours =
        policy.free_cancellation_period_unit === 'days'
          ? policy.free_cancellation_periodValue * 24
          : policy.free_cancellation_periodValue

      if (hoursUntilCheckIn < freeCancellationHours) {
        switch (policy.cancellation_fee_type) {
          case 'fixed':
            cancellationFee = policy.cancellation_fee_value || 0
            break
          case 'percentage':
            cancellationFee = (reservation.final_amount || 0) * ((policy.cancellation_fee_value || 0) / 100)
            break
          case 'first_night':
            const reservationProducts = await ReservationServiceProduct.query({ client: trx }).where(
              'reservation_id',
              reservation.id
            )
            cancellationFee = reservationProducts.reduce(
              (total, p) => total + (p.rate_per_night || 0),
              0
            )
            break
        }
      }

      // 5. Calculate refund and update reservation
      const totalPaid = reservation.paid_amount || 0
      const refundAmount = Math.max(0, totalPaid - cancellationFee)

      reservation.status = ReservationStatus.CANCELLED
      reservation.cancellation_reason = reason
      reservation.last_modified_by = auth.user!.id

      if (refundAmount > 0) {
        await Refund.create(
          {
            reservation_id: reservation.id,
            refund_amount: refundAmount,
            reason: `Cancellation fee applied: ${cancellationFee}.`,
            status: 'processed',
            refund_date: DateTime.now(),
            refund_method: 'automatic',
            processed_by_user_id: auth.user!.id,
          },
          { client: trx }
        )
        reservation.payment_status = 'refunded'
      } else if (totalPaid > 0) {
        reservation.payment_status = 'paid' // Kept as paid since the fee covers the payment
      }
      await reservation.save()
      const resServices = await ReservationServiceProduct.query({ client: trx })
        .where('reservation_id', params.id)
      for (const resService of resServices) {
        resService.status = ReservationProductStatus.CANCELLED;
        resService.last_modified_by = auth.user!.id;
        await resService.save()
        const serviceProduct = await ServiceProduct.find(resService.service_product_id);
        if (serviceProduct) {
          serviceProduct.status = 'available';
          serviceProduct.last_modified_by = auth.user!.id;
          await serviceProduct.save();
        }
        await LoggerService.log({
          actorId: auth.user!.id,
          action: 'CANCEL',
          entityType: 'ReservationServiceProduct',
          entityId: resService.id,
          description: `Reservation #${resService.id} cancelled.`,
          ctx: ctx,
        })
      }

      // 6. Log and commit
      await LoggerService.log({
        actorId: auth.user!.id,
        action: 'CANCEL',
        entityType: 'Reservation',
        entityId: reservation.id,
        description: `Reservation #${reservation.id} cancelled. Fee: ${cancellationFee}. Refund: ${refundAmount}.`,
        ctx: ctx,
      })

      await trx.commit()

      return response.ok({
        message: `Reservation cancelled. Fee: ${cancellationFee}. Refund issued: ${refundAmount}.`,
        cancellationFee: cancellationFee,
        refundAmount: refundAmount,
      })
    } catch (error) {
      await trx.rollback()
      console.error('Error cancelling reservation:', error)
      return response.internalServerError({
        message: 'Failed to cancel reservation.',
        error: error.message,
      })
    }
  }

  public async searchReservations({ request, response }: HttpContext) {
    try {
      const {
        searchText = '',
        status = '',
        roomType = '',
        checkInDate = '',
        checkOutDate = '',
      } = request.qs()
      const params = request.params()

      const query = Reservation.query()

      // 1. Filter by searchText (guest name, email, reservation number, etc.)
      if (searchText) {
        query.where((builder) => {
          builder
            .where('reservation_number', 'like', `%${searchText}%`)
            .orWhere('group_name', 'like', `%${searchText}%`)
            .orWhere('company_name', 'like', `%${searchText}%`)
            .orWhereHas('user', (userQuery) => {
              userQuery
                .where('first_name', 'like', `%${searchText}%`)
                .orWhere('last_name', 'like', `%${searchText}%`)
                .orWhere('email', 'like', `%${searchText}%`)
                .orWhere('phone_number', 'like', `%${searchText}%`)
            })
        })
      }

      // 2. Filter by status
      if (status) {
        query.where('status', status)
      }

      // 3. Filter by date range (check for overlapping reservations)
      if (checkInDate && checkOutDate) {
        const startDate = DateTime.fromISO(checkInDate).toISODate()
        const endDate = DateTime.fromISO(checkOutDate).toISODate()

        if (startDate && endDate) {
          // A reservation overlaps if its start is before the search's end
          // AND its end is after the search's start.
          query.where('arrived_date', '<', endDate).andWhere('depart_date', '>', startDate)
        }
      }

      // 4. Filter by roomType (product name)
      if (roomType) {
        query.whereHas('reservationServiceProducts', (rspQuery) => {
          rspQuery.whereHas('serviceProduct', (spQuery) => {
            spQuery.where('product_name', 'like', `%${roomType}%`)
          })
        })
      }

      // Preload related data for the response
      query.andWhere('service_id', params.id).preload('user').preload('service').preload('reservationServiceProducts', (rspQuery) => {
        rspQuery.preload('serviceProduct')
      }).orderBy('created_at', 'desc').limit(50)

      const reservations = await query

      return response.ok(reservations)
    } catch (error) {
      logger.error('Error searching reservations: %o', error)
      return response.internalServerError({
        message: 'An error occurred while searching for reservations.',
        error: error.message,
      })
    }
  }

  public async getHotelInvoiceData(ctx: HttpContext) {
    const { params, response, logger } = ctx
    try {
      console.log('Reservation ID is required.', params.id)
      const reservationId = Number.parseInt(params.id, 10)
      console.log('Reservation ID is required.', reservationId)

      if (!reservationId) {
        return response.badRequest({ message: 'Reservation ID is required.' })
      }

      const reservation = await Reservation.query()
        .where('id', reservationId)
        .preload('user')
        .preload('service')
        .preload('payments')
        .preload('reservationServiceProducts', (rspQuery) => {
          rspQuery.preload('serviceProduct', (spQuery) => {
            spQuery.preload('productType')
          })
        })

        .first()

      if (!reservation) {
        return response.notFound({ message: 'Reservation not found' })
      }

      const { user, service, payments, reservationServiceProducts } = reservation;
      const amenityBookings = await AmenityBooking.query().where('reservation_id', reservationId).preload("items", (query) => {
        query.preload('amenityProduct')
      })

      // 1. Hotel Data
      let hotelAddressParts = {
        address: '',
        city: '',
        state: '',
        zip: '',
      }
      try {
        if (service.address_service) {
          const parsedAddress = JSON.parse(service.address_service)
          hotelAddressParts.address = parsedAddress.text || ''
          hotelAddressParts.city = parsedAddress.city || ''
          hotelAddressParts.state = parsedAddress.state || ''
          hotelAddressParts.zip = parsedAddress.zip || ''
        }
      } catch (e) {
        // If parsing fails, use the raw string if it's not JSON
        if (typeof service.address_service === 'string') {
          hotelAddressParts.address = service.address_service
        }
      }
      const hotel = {
        name: service.name,
        address: hotelAddressParts.address,
        city: hotelAddressParts.city,
        state: hotelAddressParts.state,
        zip: hotelAddressParts.zip,
        phone: service.phone_number_service,
        email: service.email_service,
        website: service.website,
      }

      // 2. Guest Data
      const guest = {
        firstName: user.first_name,
        lastName: user.last_name,
        address: user.address,
        city: user.city,
        state: user.country, // Assuming country is used as state
        zip: '', // No zip in user model
        phone: user.phone_number,
        email: user.email,
        passportId: user.national_id_number,
      }

      // 3. Dates & Nights
      const checkinDate = (reservation.check_in_date ?? reservation.arrived_date)?.toISODate() ?? null
      const checkinTime =
        (reservation.check_in_date ?? reservation.arrived_date)?.toISOTime({ suppressSeconds: true, includeOffset: false }) ?? null
      const checkoutDate = (reservation.check_out_date ?? reservation.depart_date)?.toISODate() ?? null
      const checkoutTime =
        (reservation.check_out_date ?? reservation.depart_date)?.toISOTime({ suppressSeconds: true, includeOffset: false }) ?? null
      const nights = reservation.number_of_nights ?? 0

      // 4. Rooms
      const rooms = reservationServiceProducts.map((rsp) => {
        const rate = parseFloat(String(rsp.rate_per_night ?? 0))
        const total = parseFloat(String(rsp.total_amount ?? 0))
        return {
          type: rsp.serviceProduct.productType?.name ?? 'N/A',
          number: rsp.serviceProduct.product_name,
          rate: rate,
          nights: nights,
          total: total,
        }
      })

      // 5. Services (Placeholder for future implementation)
      const services = amenityBookings.map((booking) => ({

        totalAmount: parseFloat(String(booking.totalAmount ?? 0)),
        amenityOrderNumber: booking.amenityOrderNumber,
        items: booking.items.map((item) => ({
          amenityName: item.amenityProduct.name,
          quantity: item.quantity,
          price: item.pricePerUnit,
          total: parseFloat(String(item.quantity ?? 0)) * parseFloat(String(item.pricePerUnit ?? 0)),
        }))
      }))

      // 6. Taxes
      const taxes: any[] = []
      if (reservation.tax_amount && reservation.total_amount) {
        const totalBeforeTax =
          parseFloat(String(reservation.total_amount)) - parseFloat(String(reservation.tax_amount))
        const rate =
          totalBeforeTax > 0
            ? (parseFloat(String(reservation.tax_amount)) / totalBeforeTax) * 100
            : 0
        taxes.push({
          description: 'VAT',
          rate: `${rate.toFixed(2)}%`,
          amount: parseFloat(String(reservation.tax_amount)),
        })
      }

      // 7. Payments
      const paymentDetails = payments.map((p) => {
        let cardType = null
        let cardNumber = null
        if (p.payment_details) {
          try {
            const details = JSON.parse(p.payment_details)
            cardType = details.cardType || null
            cardNumber = details.cardNumber ? `**** **** **** ${details.cardNumber.slice(-4)}` : null
          } catch (e) {
            // ignore if not json
          }
        }
        return {
          method: p.payment_method,
          cardType: cardType,
          cardNumber: cardNumber,
          transactionId: p.transaction_id,
          amount: p.amount_paid,
          description: p.notes,
          date: p.payment_date,
        }
      })

      // 8. Notes
      const notes = reservation.special_requests || reservation.comment || ''

      const invoiceData = {
        hotel,
        guest,
        checkinDate,
        checkinTime,
        checkoutDate,
        checkoutTime,
        nights,
        rooms,
        services,
        taxes,
        payments: paymentDetails,
        notes,
        invoiceNumber: reservation.reservation_number, // Using reservation number as invoice number
        issueDate: DateTime.now().toISODate(),
        subtotal: parseFloat(String(reservation.total_amount ?? 0)),
        total: parseFloat(String(reservation.final_amount ?? 0)),
        amountPaid: parseFloat(String(reservation.paid_amount ?? 0)),
        balanceDue: parseFloat(String(reservation.remaining_amount ?? 0)),
      }

      return response.ok(invoiceData)
    } catch (error) {
      logger.error('Error fetching invoice data: %o', error)
      return response.internalServerError({
        message: 'Failed to fetch invoice data',
        error: error.message,
      })
    }
  }
}
