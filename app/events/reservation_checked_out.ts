import { BaseEvent } from '@adonisjs/core/events'

export default class ReservationCheckedOut extends BaseEvent {
  constructor(
     public readonly reservationId: number,
    public readonly hotelId: number,
    public readonly guestId: number | null,
    public readonly recipientPhone: string | null,
    public readonly recipientName: string,
    public readonly hotelName: string,
    public readonly invoiceUrl: string,
    public readonly guestName?: string | null,
    public readonly guestPhone?: string | null,

  ) {
    super()
  }
}
