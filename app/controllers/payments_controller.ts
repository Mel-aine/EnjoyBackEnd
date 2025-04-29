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
        order_id: data.order_id ,
        amount_paid: data.amount_paid,
        payment_method: data.payment_method,
        date: data.date,
        status: data.status,
        transaction_id: data.transaction_id,
        created_by: data.created_by,
        last_modified_by: data.last_modified_by,
      };

      // Crée le paiement
      const payment = await paymentService.create(paymentData)

      const reservation = await Reservation.find(data.reservation_id)
      if (reservation) {
        if(paymentData.status == 'pending'){
          reservation.payment = 'pending'
        }else{
          reservation.payment = 'paid'
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
}

