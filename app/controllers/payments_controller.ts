import type { HttpContext } from '@adonisjs/core/http'
import Payment from '#models/payment';
import Reservation from '#models/reservation';
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'
import LoggerService from '#services/logger_service'
import logger from '@adonisjs/core/services/logger'


const paymentService = new CrudService(Payment)

export default class PaymentsController extends CrudController<typeof Payment> {
  constructor() {
    super(paymentService)
  }

  async storePayment(ctx: HttpContext) {
    const { request, response } = ctx
    try {
      const data = request.body()

      const paymentData = {
        user_id: data.user_id,
        reservation_id: data.reservation_id,
        order_id: data.order_id,
        amount_paid: data.amount_paid,
        payment_method: data.payment_method,
        payment_date: data.payment_date,
        payment_details: data.payment_details || null,
        status: data.status,
        notes: data.notes || null,
        transaction_id: data.transaction_id,
        service_id: data.service_id,
        created_by: data.created_by,
        last_modified_by: data.last_modified_by,
      };
      logger.info('this is an info message')
      logger.info(JSON.stringify(paymentData))
      console.log('reservation', paymentData)
      // Crée le paiement
      const payment = await paymentService.create(paymentData)
      // Log payment creation
      if (payment.created_by)
        await LoggerService.log({
          actorId: payment.created_by,
          action: 'CREATE',
          entityType: 'Payment',
          entityId: payment.id,
          description: `Payment #${payment.id} for amount ${payment.amount_paid} was created.`,
          ctx: ctx,
        })
      const reservation = await Reservation.find(data.reservation_id)
      if (reservation) {
        logger.info(JSON.stringify(reservation))
        const oldStatus = reservation.payment_status
        const oldReservationStatus = reservation.status

        if (paymentData.status === 'pending') {
          reservation.payment_status = 'pending'
        } else {
          reservation.payment_status = 'paid'
        }
        // reservation.payment = 'paid'
        if (reservation.payment_status === 'paid')
          reservation.status = 'confirmed';
        reservation.paid_amount = parseFloat(`${reservation.paid_amount}`) + parseFloat(`${data.amount_paid}`);
        if (reservation.total_amount && reservation.paid_amount)
          reservation.remaining_amount = reservation.total_amount - reservation.paid_amount;
        reservation.last_modified_by = payment.created_by


        logger.info(JSON.stringify(reservation))

        await reservation.save()
        // Log reservation update
        if (payment.created_by)
          await LoggerService.log({
            actorId: payment.created_by,
            action: 'UPDATE',
            entityType: 'Reservation',
            entityId: reservation.id,
            description: `Reservation #${reservation.id} status updated to '${reservation.status}' (was '${oldReservationStatus}') and payment status to '${reservation.payment_status}' (was '${oldStatus}').`,
            ctx: ctx,
          })
      } else {
        return response.status(404).json({ error: 'Reservation not found' });
      }

      return response.status(201).json(payment)
    } catch (error) {
      console.error('Error storing payment:', error);
      return response.status(500).json({ error: 'Failed to store payment' });
    }
  }

  async confirmPayment(ctx: HttpContext) {
    const { params, response } = ctx
    try {
      const paymentId = params.id

      const payment = await Payment.find(paymentId)
      if (!payment) {
        return response.status(404).json({ error: 'Paiement introuvable' })
      }
      const oldPaymentStatus = payment.status
      payment.status = 'paid'
      payment.last_modified_by = payment.created_by
      await payment.save()
      // Log payment confirmation
      if (payment.last_modified_by)
        await LoggerService.log({
          actorId: payment.last_modified_by,
          action: 'UPDATE',
          entityType: 'Payment',
          entityId: payment.id,
          description: `Payment #${payment.id} status changed from '${oldPaymentStatus}' to 'paid'.`,
          ctx: ctx,
        })
      const reservation = await Reservation.find(payment.reservation_id)
      if (!reservation) {
        return response.status(404).json({ error: 'Réservation introuvable' })
      }

      const oldReservationPaymentStatus = reservation.payment_status
      reservation.payment_status = 'paid'
      // reservation.status = 'confirmed'
      await reservation.save()

      // Log reservation update
      if (payment.last_modified_by)
        await LoggerService.log({
          actorId: payment.last_modified_by,
          action: 'UPDATE',
          entityType: 'Reservation',
          entityId: reservation.id,
          description: `Reservation #${reservation.id} payment status updated to 'paid' (was '${oldReservationPaymentStatus}') after payment confirmation.`,
          ctx: ctx,
        })

      return response.ok({ message: 'Paiement confirmé avec succès', payment, reservation })
    } catch (error) {
      console.error('Erreur lors de la confirmation du paiement :', error)
      return response.status(500).json({ error: 'Erreur serveur lors de la confirmation' })
    }
  }


}

