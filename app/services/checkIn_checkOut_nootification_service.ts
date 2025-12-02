import { DateTime } from 'luxon'
import Reservation from '#models/reservation'
import ReservationRoom from '#models/reservation_room'
import NotificationService from './notification_service.js'
import logger from '@adonisjs/core/services/logger'
import Hotel from '#models/hotel'
import Guest from '#models/guest'


type RecipientType = 'GUEST' | 'STAFF' | 'HOUSEKEEPING' | 'MAINTENANCE'

export default class CheckInCheckOutNotificationService {

   // NOTIFICATIONS D'ARRIVÉES (CHECK-IN)
   static async notifyCheckInCompleted(reservationId: number, checkedInBy: number) {
    try {
      const reservation = await Reservation.query()
        .where('id', reservationId)
        .preload('guest')
        .preload('reservationRooms', (q) => q.preload('room').preload('roomType').preload('rateType'))
        .preload('hotel')
        .firstOrFail()

      const room = reservation.reservationRooms?.[0]
      const guest = reservation.guest

      //  Notification STAFF
      const staffVariables = await NotificationService.buildVariables('CHECKIN_COMPLETED_STAFF', {
        hotelId: reservation.hotelId,
        reservationId: reservation.id,
        guestId: reservation.guestId,
        extra: {
          ReservationNumber: reservation.reservationNumber || '',
          GuestName: guest ? `${guest.firstName} ${guest.lastName}` : '',
          RoomNumber: room?.room?.roomNumber || 'N/A',
          RoomType: room?.roomType?.roomTypeName || 'N/A',
          CheckInTime: DateTime.now().toFormat('HH:mm'),
          CheckOutDate: reservation.checkOutDate?.toFormat('dd/MM/yyyy') || '',
          Nights: reservation.numberOfNights || 0,
          Balance: reservation.remainingAmount || 0,
          SpecialRequests: reservation.specialNotes || 'Aucune',
          CheckedInBy: checkedInBy,
        },
      })

      await this.notifyHotelStaff(reservation.hotelId, 'CHECKIN_COMPLETED_STAFF', staffVariables, reservationId)

      //  Notification GUEST (bienvenue)
      if (guest && guest.email) {
        const guestVariables = await NotificationService.buildVariables('CHECKIN_COMPLETED_GUEST', {
          hotelId: reservation.hotelId,
          reservationId: reservation.id,
          guestId: reservation.guestId,
          extra: {
            GuestName: `${guest.firstName} ${guest.lastName}`,
            ReservationNumber: reservation.reservationNumber || '',
            RoomNumber: room?.room?.roomNumber || 'N/A',
            RoomType: room?.roomType?.roomTypeName || 'N/A',
            CheckInDate: reservation.checkInDate?.toFormat('dd/MM/yyyy') || DateTime.now().toFormat('dd/MM/yyyy'),
            CheckInTime: DateTime.now().toFormat('HH:mm'),
            CheckOutDate: reservation.checkOutDate?.toFormat('dd/MM/yyyy') || 'N/A',
            CheckOutTime: reservation.checkOutTime || '12:00',
            Nights: reservation.numberOfNights || 0,
            HotelPhone: reservation.hotel?.phoneNumber || '',
          },
        })

        await NotificationService.sendWithTemplate({
          templateCode: 'CHECKIN_COMPLETED_GUEST',
          recipientType: 'GUEST',
          recipientId: reservation.guestId!,
          variables: guestVariables,
          relatedEntityType: 'Reservation',
          relatedEntityId: reservation.id,
          hotelId: reservation.hotelId,
        })
      }

      logger.info(`Check-in completed notifications sent for reservation #${reservation.reservationNumber}`)
    } catch (error) {
      logger.error(' Error sending check-in completed notifications:', error)
    }
  }

  // Dans CheckinCheckoutNotificationService

/**
 * Notifier un changement de tarif
 */
static async notifyRateChange(
  reservationId: number,
  changedRooms: Array<{
    roomNumber: string
    oldRate: number
    newRate: number
    nights?: number
  }>,
  changedByStaffId: number
) {
  try {
    const reservation = await Reservation.query()
      .where('id', reservationId)
      .preload('guest')
      .preload('reservationRooms', (q) => q.preload('room'))
      .preload('hotel')
      .firstOrFail()

    const guest = reservation.guest
    const hotel = reservation.hotel

    // Variables pour le staff
    const staffVariables = await NotificationService.buildVariables('RATE_CHANGED_STAFF', {
      hotelId: reservation.hotelId,
      reservationId: reservation.id,
      guestId: reservation.guestId,
      extra: {
        ReservationNumber: reservation.reservationNumber || '' ,
        GuestName: guest ? `${guest.firstName} ${guest.lastName}` : 'N/A',
        // ChangedRooms: changedRooms ,
        ChangedBy: changedByStaffId,
        ChangeDate: DateTime.now().toFormat('dd/MM/yyyy HH:mm'),
        TotalChange: changedRooms.reduce((sum, room) => sum + (room.newRate - room.oldRate) * (room.nights || 1), 0),
      },
    })
    console.log(' Staff Variables for RATE_CHANGED_STAFF:', staffVariables)
    await this.notifyHotelStaff(reservation.hotelId, 'RATE_CHANGED_STAFF', staffVariables, reservationId)
    console.log(' Staff notification for RATE_CHANGED_STAFF sent.')

    // Notifier le guest si email présent
    if (guest && guest.email) {
      const guestVariables = await NotificationService.buildVariables('RATE_CHANGED_GUEST', {
        hotelId: reservation.hotelId,
        reservationId: reservation.id,
        guestId: reservation.guestId,
        extra: {
          GuestName: `${guest.firstName} ${guest.lastName}`,
          ReservationNumber: reservation.reservationNumber || '',
          // ChangedRooms: changedRooms,
          ChangeDate: DateTime.now().toFormat('dd/MM/yyyy HH:mm'),
          NewTotal: changedRooms.reduce((sum, room) => sum + room.newRate * (room.nights || 1), 0),
          ContactEmail: hotel.email || 'N/A',
          ContactPhone: hotel.phoneNumber || 'N/A',
        },
      })

      await NotificationService.sendWithTemplate({
        templateCode: 'RATE_CHANGED_GUEST',
        recipientType: 'GUEST',
        recipientId: reservation.guestId!,
        variables: guestVariables,
        relatedEntityType: 'Reservation',
        relatedEntityId: reservation.id,
        actorId: changedByStaffId,
        hotelId: reservation.hotelId,
      })
    }

    logger.info(`Rate change notification sent for reservation #${reservation.reservationNumber}`)
  } catch (error) {
    logger.error(' Error sending rate change notification:', error)
  }
}

/**
 * Notifier un changement du nombre de personnes (pax)
 */
static async notifyPaxChange(
  reservationId: number,
  oldPax: number,
  newPax: number,
  changedByStaffId: number
) {
  try {
    const reservation = await Reservation.query()
      .where('id', reservationId)
      .preload('guest')
      .preload('hotel')
      .firstOrFail()

    const guest = reservation.guest
    const hotel = reservation.hotel

    // Variables pour le staff
    const staffVariables = await NotificationService.buildVariables('PAX_CHANGED_STAFF', {
      hotelId: reservation.hotelId,
      reservationId: reservation.id,
      guestId: reservation.guestId,
      extra: {
        ReservationNumber: reservation.reservationNumber || '',
        GuestName: guest ? `${guest.firstName} ${guest.lastName}` : 'N/A',
        OldPax: oldPax,
        NewPax: newPax,
        ChangedBy: changedByStaffId,
        ChangeDate: DateTime.now().toFormat('dd/MM/yyyy HH:mm'),
      },
    })

    await this.notifyHotelStaff(reservation.hotelId, 'PAX_CHANGED_STAFF', staffVariables, reservationId)

    // Notifier le guest si email présent
    if (guest && guest.email) {
      const guestVariables = await NotificationService.buildVariables('PAX_CHANGED_GUEST', {
        hotelId: reservation.hotelId,
        reservationId: reservation.id,
        guestId: reservation.guestId,
        extra: {
          GuestName: `${guest.firstName} ${guest.lastName}`,
          ReservationNumber: reservation.reservationNumber || '',
          OldPax: oldPax,
          NewPax: newPax,
          ChangeDate: DateTime.now().toFormat('dd/MM/yyyy HH:mm'),
          ContactEmail: hotel.email || 'N/A',
          ContactPhone: hotel.phoneNumber || 'N/A',
        },
      })

      await NotificationService.sendWithTemplate({
        templateCode: 'PAX_CHANGED_GUEST',
        recipientType: 'GUEST',
        recipientId: reservation.guestId!,
        variables: guestVariables,
        relatedEntityType: 'Reservation',
        relatedEntityId: reservation.id,
        actorId: changedByStaffId,
        hotelId: reservation.hotelId,
      })
    }

    logger.info(` Pax change notification sent for reservation #${reservation.reservationNumber}`)
  } catch (error) {
    logger.error('Error sending pax change notification:', error)
  }
}

  static async notifyHotelStaff(hotelId: number, templateCode: string, variables: Record<string, string | number>, reservationId?: number) {
    try {

      const HotelStaffRole = (await import('#models/role')).default
      const HotelStaff = (await import('#models/service_user_assignment')).default
      const staffRoles = await HotelStaffRole.query().where('hotel_id', hotelId)

      const staffRecipients: Array<{ recipientType: RecipientType; recipientId: number }> = []
      for (const role of staffRoles) {
        const staffMembers = await HotelStaff.query().where('role_id', role.id)
        for (const staff of staffMembers) {
          staffRecipients.push({ recipientType: 'STAFF'  , recipientId: staff.id })
        }
      }

      if (staffRecipients.length === 0) {
        logger.warn(`No staff members found to notify for hotel ID ${hotelId}`)
        return
      }
      await NotificationService.sendToManyWithTemplate({
        templateCode,
        recipients: staffRecipients ,
        variables,
        relatedEntityType: reservationId ? 'Reservation' : undefined,
        relatedEntityId: reservationId,
        hotelId,
      })
    } catch (error) {
      logger.error(' Error notifying hotel staff:', error)
    }
  }


}
