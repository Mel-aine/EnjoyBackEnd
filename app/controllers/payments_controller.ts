import type { HttpContext } from '@adonisjs/core/http'
import Payment from '#models/payment';
import Reservation from '#models/reservation';
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'


const paymentService = new CrudService(Payment)

export default class PaymentsController extends CrudController<typeof Payment> {
  constructor() {
    super(paymentService)
  }

  async storePayment({ request, response }: HttpContext) {
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
        service_id : data.service_id,
        created_by: data.created_by,
        last_modified_by: data.last_modified_by,
      };

      // Crée le paiement
      const payment = await paymentService.create(paymentData)

      const reservation = await Reservation.find(data.reservation_id)
      if (reservation) {
        if (paymentData.status === 'pending') {
          reservation.payment_status = 'pending'
        } else {
          reservation.payment_status = 'paid'
        }
        // reservation.payment = 'paid'
        reservation.status = 'confirmed'
        await reservation.save()
      } else {
        return response.status(404).json({ error: 'Reservation not found' });
      }

      return response.status(201).json(payment)
    } catch (error) {
      console.error('Error storing payment:', error);
      return response.status(500).json({ error: 'Failed to store payment' });
    }
  }

  async confirmPayment({ params, response }: HttpContext) {
    try {
      const paymentId = params.id

      const payment = await Payment.find(paymentId)
      if (!payment) {
        return response.status(404).json({ error: 'Paiement introuvable' })
      }

      payment.status = 'paid'
      payment.last_modified_by = payment.created_by
      await payment.save()

      const reservation = await Reservation.find(payment.reservation_id)
      if (!reservation) {
        return response.status(404).json({ error: 'Réservation introuvable' })
      }

      reservation.payment_status = 'paid'
      // reservation.status = 'confirmed'
      await reservation.save()

      return response.ok({ message: 'Paiement confirmé avec succès', payment, reservation })
    } catch (error) {
      console.error('Erreur lors de la confirmation du paiement :', error)
      return response.status(500).json({ error: 'Erreur serveur lors de la confirmation' })
    }
  }


}

