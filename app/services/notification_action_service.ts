import { DateTime } from 'luxon'
import Reservation from '#models/reservation'
import NotificationService from './notification_service.js'
import logger from '@adonisjs/core/services/logger'
import User from '#models/user'
import Room from '#models/room'
import HouseKeeper from '#models/house_keeper'


type RecipientType = 'GUEST' | 'STAFF' | 'HOUSEKEEPING' | 'MAINTENANCE'
type HousekeepingStatus = 'clean' | 'dirty' | 'inspected' | 'out_of_order'



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

    const checkOutDate = reservation.checkOutDate
      ? (reservation.checkOutDate instanceof DateTime
          ? reservation.checkOutDate
          : DateTime.fromJSDate(new Date(reservation.checkOutDate)))
      : null

    const checkInDate = reservation.checkInDate
      ? (reservation.checkInDate instanceof DateTime
          ? reservation.checkInDate
          : DateTime.fromJSDate(new Date(reservation.checkInDate)))
      : DateTime.now()


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
        CheckOutDate: checkOutDate?.toFormat('dd/MM/yyyy') || 'N/A',
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
          CheckInDate: checkInDate.toFormat('dd/MM/yyyy'),
          CheckInTime: DateTime.now().toFormat('HH:mm'),
          CheckOutDate: checkOutDate?.toFormat('dd/MM/yyyy') || 'N/A',
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

  } catch (error) {
    logger.error(' Error sending check-in completed notifications:', error)
    throw error
  }
}

/**
 * NOTIFICATIONS DE DÉPARTS (CHECK-OUT)
 */

static async notifyCheckOutCompleted(
  reservationId: number,
  checkedOutBy: number,
  details: {
    checkedOutRooms: Array<{ roomNumber: string; roomId: number | null }>
    checkOutTime: DateTime
    allRoomsCheckedOut: boolean
  }
) {
  try {
    const reservation = await Reservation.query()
      .where('id', reservationId)
      .preload('guest')
      .preload('reservationRooms', (q) => q.preload('room').preload('roomType'))
      .preload('hotel')
      .preload('folios', (q) => q.preload('transactions'))
      .firstOrFail()

    const guest = reservation.guest
    const hotel = reservation.hotel

    // Calculer le total payé
    const totalPaid = reservation.folios.reduce((sum, folio) => {
      return sum + folio.transactions
        .filter((t: any) => t.transactionType === 'PAYMENT')
        .reduce((s: number, t: any) => s + Number(t.amount || 0), 0)
    }, 0)

    // Variables pour le staff
    const staffVariables = await NotificationService.buildVariables('CHECKOUT_COMPLETED_STAFF', {
      hotelId: reservation.hotelId,
      reservationId: reservation.id,
      guestId: reservation.guestId,
      extra: {
        ReservationNumber: reservation.reservationNumber || '',
        GuestName: guest ? `${guest.firstName} ${guest.lastName}` : 'N/A',
        CheckOutTime: details.checkOutTime.toFormat('HH:mm'),
        CheckOutDate: details.checkOutTime.toFormat('dd/MM/yyyy'),
        RoomNumbers: details.checkedOutRooms.map(r => r.roomNumber).join(', '),
        TotalStay: reservation.numberOfNights || 0,
        TotalAmount: reservation.totalAmount || 0,
        TotalPaid: totalPaid,
        CheckedOutBy: checkedOutBy,
        AllRoomsCheckedOut: details.allRoomsCheckedOut ? 'Yes' : 'No'
      },
    })


    await this.notifyHotelStaff(reservation.hotelId, 'CHECKOUT_COMPLETED_STAFF', staffVariables, reservationId)

    // Notification GUEST
    if (guest && guest.email) {
      const guestVariables = await NotificationService.buildVariables('CHECKOUT_COMPLETED_GUEST', {
        hotelId: reservation.hotelId,
        reservationId: reservation.id,
        guestId: reservation.guestId,
        extra: {
          GuestName: `${guest.firstName} ${guest.lastName}`,
          ReservationNumber: reservation.reservationNumber || '',
          CheckOutDate: details.checkOutTime.toFormat('dd/MM/yyyy'),
          CheckOutTime: details.checkOutTime.toFormat('HH:mm'),
          HotelName: hotel.hotelName || '',
          TotalStay: reservation.numberOfNights || 0,
          TotalAmount: reservation.totalAmount || 0,
          HotelPhone: hotel.phoneNumber || '',
          HotelEmail: hotel.email || ''
        },
      })

      await NotificationService.sendWithTemplate({
        templateCode: 'CHECKOUT_COMPLETED_GUEST',
        recipientType: 'GUEST',
        recipientId: reservation.guestId!,
        variables: guestVariables,
        relatedEntityType: 'Reservation',
        relatedEntityId: reservation.id,
        hotelId: reservation.hotelId,
      })
    }

    logger.info(`Check-out completed notifications sent for reservation #${reservation.reservationNumber}`)
  } catch (error) {
    logger.error(' Error sending check-out completed notifications:', error)
  }
}



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
        OldRate: changedRooms.reduce((sum, room) => sum + room.oldRate * (room.nights || 1), 0),
        NewRate: changedRooms.reduce((sum, room) => sum + room.newRate * (room.nights || 1), 0),
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
          OldRate: changedRooms.reduce((sum, room) => sum + room.oldRate * (room.nights || 1), 0),
          NewRate: changedRooms.reduce((sum, room) => sum + room.newRate * (room.nights || 1), 0),
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

     let changedByName: string = String(changedByStaffId)
      try {
        const user = await User.find(changedByStaffId)
        if (user) changedByName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || String(changedByStaffId)
      } catch (_err) {

       changedByName = String(changedByStaffId)
      }

    // Variables pour le staff
    const staffVariables = await NotificationService.buildVariables('PAX_CHANGED_STAFF', {
      hotelId: reservation.hotelId,
      reservationId: reservation.id,
      guestId: reservation.guestId,
      extra: {
        ReservationNumber: reservation.reservationNumber || '',
        GuestName: guest ? `${guest.firstName} ${guest.lastName}` : 'N/A',
        OldPax: oldPax,
        NewPaxCount: newPax,
        ChangedBy: changedByName,
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
          NewPaxCount: newPax,
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

    const staffRoles = await HotelStaffRole.query().where('hotel_id', hotelId).orWhere((q) => {
      q.whereRaw('LOWER(role_name) = ?', ['admin'])
    })


    const staffRecipients: Array<{ recipientType: RecipientType; recipientId: number }> = []


    for (const role of staffRoles) {
      const staffMembers = await HotelStaff.query().where('role_id', role.id)
        console.log(' Staff :', staffMembers)

      for (const staff of staffMembers) {
        staffRecipients.push({ recipientType: 'STAFF', recipientId: staff.user_id })
      }
    }


    if (staffRecipients.length === 0) {
      logger.warn(` No staff members found to notify for hotel ID ${hotelId}`)
      return
    }

    await NotificationService.sendToManyWithTemplate({
      templateCode,
      recipients: staffRecipients,
      variables,
      relatedEntityType: reservationId ? 'Reservation' : undefined,
      relatedEntityId: reservationId,
      hotelId,
    })
  } catch (error) {
    logger.error(' Error notifying hotel staff:', error)
    throw error
  }
}


/**
   * Notifier quand une chambre est prête (clean)
   */
  static async notifyRoomReady(
    roomId: number,
    housekeeperId: number,
    completedBy: number
  ) {
    try {
      const room = await Room.query()
        .where('id', roomId)
        .preload('hotel')
        .preload('roomType')
        .firstOrFail()

    let changedByName: string = String(housekeeperId)
      try {
        const user = await User.find(housekeeperId)
        if (user) changedByName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || String(housekeeperId)
      } catch (_err) {

       changedByName = String(housekeeperId)
      }

      const staffVariables = await NotificationService.buildVariables('ROOM_READY_STAFF', {
        hotelId: room.hotelId,
        extra: {
          RoomNumber: room.roomNumber,
          RoomType: room.roomType?.roomTypeName || 'N/A',
          HousekeeperName: changedByName,
          CompletedTime: DateTime.now().toFormat('HH:mm'),
          CompletedDate: DateTime.now().toFormat('dd/MM/yyyy'),
          CompletedBy: changedByName,
        },
      })

      await this.notifyHotelStaff(room.hotelId, 'ROOM_READY_STAFF', staffVariables)
      logger.info(`Room ready notification sent for room #${room.roomNumber}`)
    } catch (error) {
      logger.error(' Error sending room ready notification:', error)
    }
  }

  /**
   * Notifier changement de statut housekeeping
   */
  static async notifyStatusChange(
    roomId: number,
    oldStatus: HousekeepingStatus,
    newStatus: HousekeepingStatus,
    changedBy: number,
    notes?: string
  ) {
    try {
      const room = await Room.query()
        .where('id', roomId)
        .preload('hotel')
        .preload('roomType')
        .firstOrFail()

      const statusLabels: Record<HousekeepingStatus, string> = {
        clean: 'Propre',
        dirty: 'Sale',
        inspected: 'Inspectée',
        out_of_order: 'Hors service'
      }

    let changedByName: string = String(changedBy)
      try {
        const user = await User.find(changedBy)
        if (user) changedByName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || String(changedBy)
      } catch (_err) {

       changedByName = String(changedBy)
      }

      const staffVariables = await NotificationService.buildVariables('HOUSEKEEPING_STATUS_CHANGED_STAFF', {
        hotelId: room.hotelId,
        extra: {
          RoomNumber: room.roomNumber,
          RoomType: room.roomType?.roomTypeName || 'N/A',
          OldStatus: statusLabels[oldStatus] || oldStatus,
          NewStatus: statusLabels[newStatus] || newStatus,
          ChangedBy: changedByName,
          ChangeDate: DateTime.now().toFormat('dd/MM/yyyy HH:mm'),
          Notes: notes || 'Aucune',
        },
      })

      await this.notifyHotelStaff(room.hotelId, 'HOUSEKEEPING_STATUS_CHANGED_STAFF', staffVariables)

      // Notifier les gouvernantes
      await this.notifyHousekeepers(room.hotelId, 'HOUSEKEEPING_STATUS_CHANGED_HOUSEKEEPING', staffVariables)

      logger.info(`Housekeeping status change notification sent for room #${room.roomNumber}`)
    } catch (error) {
      logger.error(' Error sending status change notification:', error)
    }
  }

  /**
   * Notifier quand une chambre est sale (dirty)
   */
  static async notifyRoomDirty(
    roomId: number,
    markedBy: number,
    priority?: 'low' | 'normal' | 'high'
  ) {
    try {
      const room = await Room.query()
        .where('id', roomId)
        .preload('hotel')
        .preload('roomType')
        .firstOrFail()

      const priorityLabels = {
        low: 'Basse',
        normal: 'Normale',
        high: 'Haute'
      }

    let changedByName: string = String(markedBy)
      try {
        const user = await User.find(markedBy)
        if (user) changedByName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || String(markedBy)
      } catch (_err) {

       changedByName = String(markedBy)
      }

      const housekeepingVariables = await NotificationService.buildVariables('ROOM_DIRTY_HOUSEKEEPING', {
        hotelId: room.hotelId,
        extra: {
          RoomNumber: room.roomNumber,
          RoomType: room.roomType?.roomTypeName || 'N/A',
          Priority: priorityLabels[priority || 'normal'],
          ReportedTime: DateTime.now().toFormat('HH:mm'),
          ReportedDate: DateTime.now().toFormat('dd/MM/yyyy'),
          ChangedBy: changedByName,
        },
      })

      await this.notifyHousekeepers(room.hotelId, 'ROOM_DIRTY_HOUSEKEEPING', housekeepingVariables)
      logger.info(`Room dirty notification sent to housekeepers for room #${room.roomNumber}`)
    } catch (error) {
      logger.error(' Error sending room dirty notification:', error)
    }
  }

  /**
   * Notifier quand une chambre a été inspectée
   */
  static async notifyRoomInspected(
    roomId: number,
    inspectedBy: number,
    passed: boolean,
    notes?: string
  ) {
    try {
      const room = await Room.query()
        .where('id', roomId)
        .preload('hotel')
        .preload('roomType')
        .firstOrFail()

      const staffVariables = await NotificationService.buildVariables('ROOM_INSPECTED_STAFF', {
        hotelId: room.hotelId,
        extra: {
          RoomNumber: room.roomNumber,
          RoomType: room.roomType?.roomTypeName || 'N/A',
          InspectionResult: passed ? 'Approuvée' : 'Non approuvée',
          InspectedBy: inspectedBy,
          InspectionTime: DateTime.now().toFormat('HH:mm'),
          InspectionDate: DateTime.now().toFormat('dd/MM/yyyy'),
          Notes: notes || 'Aucune',
        },
      })

      await this.notifyHotelStaff(room.hotelId, 'ROOM_INSPECTED_STAFF', staffVariables)

      // Si l'inspection a échoué, notifier aussi les gouvernantes
      if (!passed) {
        await this.notifyHousekeepers(room.hotelId, 'ROOM_INSPECTION_FAILED_HOUSEKEEPING', staffVariables)
      }

      logger.info(`Room inspection notification sent for room #${room.roomNumber}`)
    } catch (error) {
      logger.error(' Error sending room inspection notification:', error)
    }
  }



  /**
   * Notifier quand le ménage est terminé
   */
  static async notifyCleaningCompleted(
    roomId: number,
    housekeeperId: number,
    completedBy: number,
    duration?: number // en minutes
  ) {
    try {
      const room = await Room.query()
        .where('id', roomId)
        .preload('hotel')
        .preload('roomType')
        .firstOrFail()

      const housekeeper = await HouseKeeper.find(housekeeperId)

      const staffVariables = await NotificationService.buildVariables('CLEANING_COMPLETED_STAFF', {
        hotelId: room.hotelId,
        extra: {
          RoomNumber: room.roomNumber,
          RoomType: room.roomType?.roomTypeName || 'N/A',
          HousekeeperName: housekeeper ? housekeeper.name : 'N/A',
          CompletedTime: DateTime.now().toFormat('HH:mm'),
          CompletedDate: DateTime.now().toFormat('dd/MM/yyyy'),
          Duration: duration ? `${duration} minutes` : 'N/A',
          CompletedBy: completedBy,
        },
      })

      await this.notifyHotelStaff(room.hotelId, 'CLEANING_COMPLETED_STAFF', staffVariables)
      logger.info(`Cleaning completed notification sent for room #${room.roomNumber}`)
    } catch (error) {
      logger.error('❌ Error sending cleaning completed notification:', error)
    }
  }

  /**
   * Notifier quand le ménage est incomplet
   */
  static async notifyCleaningIncomplete(
    roomId: number,
    housekeeperId: number,
    reason: string,
    reportedBy: number
  ) {
    try {
      const room = await Room.query()
        .where('id', roomId)
        .preload('hotel')
        .preload('roomType')
        .firstOrFail()

      const housekeeper = await HouseKeeper.find(housekeeperId)

      const staffVariables = await NotificationService.buildVariables('CLEANING_INCOMPLETE_STAFF', {
        hotelId: room.hotelId,
        extra: {
          RoomNumber: room.roomNumber,
          RoomType: room.roomType?.roomTypeName || 'N/A',
          HousekeeperName: housekeeper ? housekeeper.name : 'N/A',
          Reason: reason,
          ReportedTime: DateTime.now().toFormat('HH:mm'),
          ReportedDate: DateTime.now().toFormat('dd/MM/yyyy'),
          ReportedBy: reportedBy,
        },
      })

      await this.notifyHotelStaff(room.hotelId, 'CLEANING_INCOMPLETE_STAFF', staffVariables)

      // Notifier aussi la gouvernante concernée
      if (housekeeper) {
        await this.notifySpecificHousekeeper(housekeeperId, room.hotelId, 'CLEANING_INCOMPLETE_HOUSEKEEPING', staffVariables)
      }

      logger.info(`Cleaning incomplete notification sent for room #${room.roomNumber}`)
    } catch (error) {
      logger.error('❌ Error sending cleaning incomplete notification:', error)
    }
  }

  /**
   * Notifier un problème détecté par les gouvernantes
   */
  static async notifyIssueDetected(
    roomId: number,
    housekeeperId: number,
    description: string,
    issueType?: 'maintenance' | 'damage' | 'lost_items' | 'other',
    severity?: 'low' | 'medium' | 'high'
  ) {
    try {
      const room = await Room.query()
        .where('id', roomId)
        .preload('hotel')
        .preload('roomType')
        .firstOrFail()

      const housekeeper = await HouseKeeper.find(housekeeperId)
       let changedByName: string = String(housekeeperId)
      try {
        const user = await User.find(housekeeperId)
        if (user) changedByName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || String(housekeeperId)
      } catch (_err) {

       changedByName = String(housekeeperId)
      }

      const issueTypeLabels = {
        maintenance: 'Maintenance requise',
        damage: 'Dommage détecté',
        lost_items: 'Objets perdus',
        other: 'Autre'
      }

      const severityLabels = {
        low: 'Faible',
        medium: 'Moyenne',
        high: 'Haute'
      }

      const staffVariables = await NotificationService.buildVariables('HOUSEKEEPING_ISSUE_DETECTED_STAFF', {
        hotelId: room.hotelId,
        extra: {
          RoomNumber: room.roomNumber,
          RoomType: room.roomType?.roomTypeName || 'N/A',
          HousekeeperName: changedByName,
          IssueType: issueTypeLabels[issueType!],
          Description: description,
          Severity: severityLabels[severity || 'medium'],
          ReportedTime: DateTime.now().toFormat('HH:mm'),
          ReportedDate: DateTime.now().toFormat('dd/MM/yyyy'),
        },
      })

      await this.notifyHotelStaff(room.hotelId, 'HOUSEKEEPING_ISSUE_DETECTED_STAFF', staffVariables)

      // Si c'est un problème de maintenance, notifier aussi l'équipe maintenance
      if (issueType === 'maintenance') {
        await this.notifyMaintenance(room.hotelId, 'MAINTENANCE_REQUEST_FROM_HOUSEKEEPING', staffVariables)
      }

      logger.info(`Issue detected notification sent for room #${room.roomNumber}`)
    } catch (error) {
      logger.error(' Error sending issue detected notification:', error)
    }
  }

  /**
   * Notifier le blocage d'une chambre pour entretien
   */
  static async notifyRoomBlocked(
    roomId: number,
    blockedBy: number,
    reason: string,
    estimatedDuration?: string
  ) {
    try {
      const room = await Room.query()
        .where('id', roomId)
        .preload('hotel')
        .preload('roomType')
        .firstOrFail()

    let changedByName: string = String(blockedBy)
      try {
        const user = await User.find(blockedBy)
        if (user) changedByName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || String(blockedBy)
      } catch (_err) {

       changedByName = String(blockedBy)
      }

      const staffVariables = await NotificationService.buildVariables('ROOM_BLOCKED_STAFF', {

        hotelId: room.hotelId,
        extra: {
          RoomNumber: room.roomNumber,
          RoomType: room.roomType?.roomTypeName || 'N/A',
          Reason: reason,
          EstimatedDuration: estimatedDuration || 'Non spécifié',
          ChangedBy: changedByName,
          BlockedTime: DateTime.now().toFormat('HH:mm'),
          BlockedDate: DateTime.now().toFormat('dd/MM/yyyy'),
        },
      })

      await this.notifyHotelStaff(room.hotelId, 'ROOM_BLOCKED_STAFF', staffVariables)
      await this.notifyHousekeepers(room.hotelId, 'ROOM_BLOCKED_HOUSEKEEPING', staffVariables)

      logger.info(`Room blocked notification sent for room #${room.roomNumber}`)
    } catch (error) {
      logger.error(' Error sending room blocked notification:', error)
    }
  }

  /**
   * notifier la modification du blocage d'une chambre
   */
  static async notifyRoomBlockModified(
    roomId: number,
    modifiedBy: number,
    oldReason: string,
    newReason: string,
    oldEstimatedDuration?: string,
    newEstimatedDuration?: string
  ) {
    try {
      const room = await Room.query()
        .where('id', roomId)
        .preload('hotel')
        .preload('roomType')
        .firstOrFail()

    let changedByName: string = String(modifiedBy)
      try {
        const user = await User.find(modifiedBy)
        if (user) changedByName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || String(modifiedBy)
      } catch (_err) {

       changedByName = String(modifiedBy)
      }

      const staffVariables = await NotificationService.buildVariables('ROOM_BLOCK_MODIFIED_STAFF', {
        hotelId: room.hotelId,
        extra: {
          RoomNumber: room.roomNumber,
          RoomType: room.roomType?.roomTypeName || 'N/A',
          OldReason: oldReason,
          NewReason: newReason,
          OldEstimatedDuration: oldEstimatedDuration || 'Non spécifié',
          NewEstimatedDuration: newEstimatedDuration || 'Non spécifié',
          ModifiedBy: changedByName,
          ModifiedTime: DateTime.now().toFormat('HH:mm'),
          ModifiedDate: DateTime.now().toFormat('dd/MM/yyyy'),
        },
      })

      await this.notifyHotelStaff(room.hotelId, 'ROOM_BLOCK_MODIFIED_STAFF', staffVariables)
      await this.notifyHousekeepers(room.hotelId, 'ROOM_BLOCK_MODIFIED_HOUSEKEEPING', staffVariables)

      logger.info(`Room block modified notification sent for room #${room.roomNumber}`)
    } catch (error) {
      logger.error(' Error sending room block modified notification:', error)
    }
  }

  /**
   * Notifier le blocage completed d'une chambre
   */
  static async notifyRoomUnblocked(
    roomId: number,
    unblockedBy: number
  ) {
    try {
      const room = await Room.query()
        .where('id', roomId)
        .preload('hotel')
        .preload('roomType')
        .firstOrFail()

    let changedByName: string = String(unblockedBy)
      try {
        const user = await User.find(unblockedBy)
        if (user) changedByName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || String(unblockedBy)
      } catch (_err) {

       changedByName = String(unblockedBy)
      }

      const staffVariables = await NotificationService.buildVariables('ROOM_UNBLOCKED_STAFF', {
        hotelId: room.hotelId,
        extra: {
          RoomNumber: room.roomNumber,
          RoomType: room.roomType?.roomTypeName || 'N/A',
          UnblockedBy: changedByName,
          UnblockedTime: DateTime.now().toFormat('HH:mm'),
          UnblockedDate: DateTime.now().toFormat('dd/MM/yyyy'),
        },
      })

      await this.notifyHotelStaff(room.hotelId, 'ROOM_UNBLOCKED_STAFF', staffVariables)
      await this.notifyHousekeepers(room.hotelId, 'ROOM_UNBLOCKED_HOUSEKEEPING', staffVariables)

      logger.info(`Room unblocked notification sent for room #${room.roomNumber}`)
    } catch (error) {
      logger.error(' Error sending room unblocked notification:', error)
    }
  }


  /**
   * Notifier toutes les gouvernantes d'un hôtel
   */
  private static async notifyHousekeepers(
    hotelId: number,
    templateCode: string,
    variables: Record<string, string | number>
  ) {
    try {
      const housekeepers = await HouseKeeper.query().where('hotel_id', hotelId)

      if (housekeepers.length === 0) {
        logger.warn(`⚠️ No housekeepers found for hotel ID ${hotelId}`)
        return
      }

      const recipients = housekeepers.map(hk => ({
        recipientType: 'HOUSEKEEPING' as RecipientType,
        recipientId: hk.id
      }))

      await NotificationService.sendToManyWithTemplate({
        templateCode,
        recipients,
        variables,
        hotelId,
      })
    } catch (error) {
      logger.error(' Error notifying housekeepers:', error)
    }
  }

  /**
   * Notifier une gouvernante spécifique
   */
  private static async notifySpecificHousekeeper(
    housekeeperId: number,
    hotelId: number,
    templateCode: string,
    variables: Record<string, string | number>
  ) {
    try {
      await NotificationService.sendWithTemplate({
        templateCode,
        recipientType: 'HOUSEKEEPING',
        recipientId: housekeeperId,
        variables,
        hotelId,
      })
    } catch (error) {
      logger.error(' Error notifying specific housekeeper:', error)
    }
  }

  /**
   * Notifier l'équipe de maintenance
   */
  private static async notifyMaintenance(
    hotelId: number,
    templateCode: string,
    variables: Record<string, string | number>
  ) {
    try {
      // À adapter selon votre modèle de maintenance
      const MaintenanceStaff = (await import('#models/service_user_assignment')).default
      const maintenanceStaff = await MaintenanceStaff.query()
        .whereHas('role', (roleQuery) => {
          roleQuery.where('hotel_id', hotelId).where('name', 'LIKE', '%maintenance%')
        })

      if (maintenanceStaff.length === 0) {
        logger.warn(`No maintenance staff found for hotel ID ${hotelId}`)
        return
      }

      const recipients = maintenanceStaff.map(staff => ({
        recipientType: 'MAINTENANCE' as RecipientType,
        recipientId: staff.id
      }))

      await NotificationService.sendToManyWithTemplate({
        templateCode,
        recipients,
        variables,
        hotelId,
      })
    } catch (error) {
      logger.error('❌ Error notifying maintenance:', error)
    }
  }

  /**
   * notifier les objets perdus et trouvés
   */
  static async notifyLostAndFound(
    itemDescription: string,
    foundBy: string,
    locationFound: string,
    dateFound: DateTime,
    hotelId?: number,
  ) {
    try {
      const staffVariables = await NotificationService.buildVariables('LOST_AND_FOUND_ITEM_REPORTED', {
        hotelId,
        extra: {
          ItemDescription: itemDescription,
          FoundBy: foundBy,
          LocationFound: locationFound,
          DateFound: dateFound.toFormat('dd/MM/yyyy'),
          ReportedTime: DateTime.now().toFormat('HH:mm'),
        },
      })

      await this.notifyHotelStaff(hotelId!, 'LOST_AND_FOUND_ITEM_REPORTED', staffVariables)
      logger.info(`Lost and found notification sent for item: ${itemDescription}`)
    } catch (error) {
      logger.error(' Error sending lost and found notification:', error)
    }
  }





}
