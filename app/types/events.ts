
import ReservationCheckedOut from '#events/reservation_checked_out'

declare module '@adonisjs/core/types' {
  interface EventsList {
    'reservation:checked_out': ReservationCheckedOut
  }
}