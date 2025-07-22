import type { HttpContext } from '@adonisjs/core/http'
import Refund from '#models/refund';
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'

const refundService = new CrudService(Refund)

export default class RefundsController extends CrudController<typeof Refund> {
  constructor() {
    super(refundService)
  }

  async  getRefundByServiceId ({ params, response }: HttpContext) {
    const serviceId = params.serviceId

    if (!serviceId) {
      return response.badRequest({ error: 'serviceId is required.' })
    }

    try {
      const refunds = await Refund
        .query()
        .where('service_id', serviceId)
        .preload('reservation', (reservationQuery) => {
          reservationQuery
            .preload('user')
            .preload('reservationServiceProducts', (rsvpQuery) => {
              rsvpQuery.preload('serviceProduct',(roomType)=>{
                roomType.preload('productType')
              })
            })
        })
        .preload('processed_by_user')

      const formatted = refunds.map((refund) => ({
        refund: {
          id: refund.id,
          amount: refund.refund_amount,
          method: refund.refund_method,
          status: refund.status,
          date: refund.refund_date,
          reason: refund.reason,
          reference: refund.transaction_reference,
          processedBy:`${refund.processed_by_user?.first_name ?? null} ${refund.processed_by_user?.last_name ?? null}`.trim(),
        },
        reservation: {
          id: refund.reservation?.id,
          client: refund.reservation?.user
            ? {
                id: refund.reservation.user.id,
                name: `${refund.reservation.user.first_name ?? ''} ${refund.reservation.user.last_name ?? ''}`.trim(),
                email: refund.reservation.user.email,
              }
            : null,
          products: refund.reservation?.reservationServiceProducts.map((rsvp) => ({
            id: rsvp.serviceProduct?.id,
            name: rsvp.serviceProduct?.product_name,
            room_type :rsvp.serviceProduct?.productType.name,
            description: rsvp.serviceProduct?.description,
            total_amount: rsvp.total_amount,
            start_date: rsvp.start_date,
            end_date: rsvp.end_date,
          })) ?? [],
        },
      }))

      return response.ok(formatted)
    } catch (error) {
      console.error(error)
      return response.internalServerError({ error: 'Unable to fetch refunds.' })
    }


  }

  // filter
async filterRefunds({ request, response, params }: HttpContext) {
  const { roomType, room, startDate, endDate } = request.all()
  const serviceId = params.serviceId

  if (!serviceId) {
    return response.badRequest({ error: 'serviceId is required.' })
  }

  try {
    const query = Refund.query().where('service_id', serviceId)


    if (room) {
      query.whereHas('reservation', (reservationQuery) => {
        reservationQuery.whereHas('reservationServiceProducts', (rsvpQuery) => {
          rsvpQuery.whereHas('serviceProduct', (productQuery) => {
            productQuery.where('room_number', room)
          })
        })
      })
    }


    if (roomType) {
      query.whereHas('reservation', (reservationQuery) => {
        reservationQuery.whereHas('reservationServiceProducts', (rsvpQuery) => {
          rsvpQuery.whereHas('serviceProduct', (productQuery) => {
            productQuery.where('product_type_id', roomType)
          })
        })
      })
    }

    if (startDate) {
      query.where('refund_date', '>=', new Date(startDate))
    }

    if (endDate) {
      query.where('refund_date', '<=', new Date(endDate))
    }


    const refunds = await query
      .preload('reservation', (reservationQuery) => {
        reservationQuery
          .preload('user')
          .preload('reservationServiceProducts', (rsvpQuery) => {
            rsvpQuery.preload('serviceProduct', (roomTypeQuery) => {
              roomTypeQuery.preload('productType')
            })
          })
      })
      .preload('processed_by_user')


    const formatted = refunds.map((refund) => ({
      refund: {
        id: refund.id,
        amount: refund.refund_amount,
        method: refund.refund_method,
        status: refund.status,
        date: refund.refund_date,
        reason: refund.reason,
        reference: refund.transaction_reference,
        processedBy: `${refund.processed_by_user?.first_name ?? ''} ${refund.processed_by_user?.last_name ?? ''}`.trim(),
      },
      reservation: {
        id: refund.reservation?.id,
        client: refund.reservation?.user
          ? {
              id: refund.reservation.user.id,
              name: `${refund.reservation.user.first_name ?? ''} ${refund.reservation.user.last_name ?? ''}`.trim(),
              email: refund.reservation.user.email,
            }
          : null,
        products:
          refund.reservation?.reservationServiceProducts.map((rsvp) => ({
            id: rsvp.serviceProduct?.id,
            name: rsvp.serviceProduct?.product_name,
            room_type: rsvp.serviceProduct?.productType?.name,
            description: rsvp.serviceProduct?.description,
            total_amount: rsvp.total_amount,
            start_date: rsvp.start_date,
            end_date: rsvp.end_date,
          })) ?? [],
      },
    }))

    return response.ok(formatted)
  } catch (error) {
    console.error(error)
    return response.internalServerError({ error: 'Unable to filter refunds.' })
  }
}


}
