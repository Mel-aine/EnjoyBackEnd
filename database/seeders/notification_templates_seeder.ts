import { BaseSeeder } from '@adonisjs/lucid/seeders'
import NotificationTemplate from '#models/notification_template'

export default class NotificationTemplatesSeeder extends BaseSeeder {
  public async run() {
    const templates: Array<{
      code: string
      channel: 'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP'
      locale: string
      subjectTemplate: string
      contentTemplate: string
      isActive?: boolean
    }> = [
      // Core Work Order triggers (already integrated)
      {
        code: 'WORK_ORDER_ASSIGNED',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'New Work Order Assigned #[WorkOrderId]',
        contentTemplate:
          'You have been assigned to work order #[WorkOrderId] for room [RoomNumber]. Current status: [Status].',
      },
      {
        code: 'WORK_ORDER_CREATED',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Work Order Created #[WorkOrderId]',
        contentTemplate:
          'Order #[WorkOrderId] for room [RoomNumber] created. Status: [Status]. Priority: [Priority].',
      },
      {
        code: 'WORK_ORDER_DELETED',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Work Order Deleted #[WorkOrderId]',
        contentTemplate:
          'Work order #[WorkOrderId] has been deleted. Number: [OrderNumber].',
      },
      {
        code: 'WORK_ORDER_STATUS_UPDATED',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Work Order #[WorkOrderId] Status Updated',
        contentTemplate:
          'Status changed from [OldStatus] to [NewStatus] for work order #[WorkOrderId] (room [RoomNumber]).',
      },

      // // Reception / Front Desk
      {
        code: 'VIP_ARRIVAL',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'VIP Arrival: [GuestName]',
        contentTemplate:
          'VIP ARRIVAL: Guest [GuestName] has arrived. Status: [VIPLevel]. Immediate action required.',
      },
      {
        code: 'LATE_CHECKOUT',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Late Check-out Alert: Room [RoomNumber]',
        contentTemplate:
          'Room [RoomNumber] still occupied at [Time]. Please verify with guest.',
      },
      {
        code: 'BOOKING_UPDATE',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Booking Update: [ReservationNumber]',
        contentTemplate:
          'Booking [ReservationNumber] changed. New status: [Status]. See details.',
      },
      {
        code: 'RESERVATION_CREATED',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Reservation Created [ReservationNumber]',
        contentTemplate:
          'Reservation [ReservationNumber] created. Arrival: [ArrivalDate], Departure: [DepartureDate], Status: [Status].',
      },
      {
        code: 'RESERVATION_MODIFIED',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Reservation Modified [ReservationNumber]',
        contentTemplate:
          'Reservation [ReservationNumber] modified. Arrival: [ArrivalDate], Departure: [DepartureDate], Status: [Status].',
      },
      {
        code: 'RESERVATION_CANCELLED',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Reservation Cancelled [ReservationNumber]',
        contentTemplate:
          'Reservation [ReservationNumber] cancelled. Arrival: [ArrivalDate], Departure: [DepartureDate].',
      },

      // Payments / Accounting
      {
        code: 'PAYMENT_FAILED',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Payment Failed: Room [RoomNumber] / [GuestName]',
        contentTemplate:
          'Card declined for Rm [RoomNumber] / Guest [GuestName]. Amount: [Amount].',
      },
      {
        code: 'DEPOSIT_REMINDER',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Deposit Reminder: [GroupName]',
        contentTemplate:
          'Payment due for group [GroupName]. Amount: [Amount].',
      },

      // Security / Capacity
      {
        code: 'SECURITY_OVERCAPACITY',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Security: Overcapacity in Room [RoomNumber]',
        contentTemplate:
          'Overcapacity detected in Rm [RoomNumber]. Current occupants: [Number].',
      },

      // Housekeeping / Room Status
      {
        code: 'ROOM_READY_CLEAN',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Room Ready: [RoomNumber] is CLEAN',
        contentTemplate:
          'Rm [RoomNumber] is CLEAN and available for assignment.',
      },
      {
        code: 'ROOM_STATUS_UPDATED',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Room Status Updated: [RoomNumber]',
        contentTemplate:
          'Room [RoomNumber] status changed from [OldStatus] to [NewStatus].',
      },
      {
        code: 'DND_ALERT',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'DND Alert: Room [RoomNumber]',
        contentTemplate:
          'Rm [RoomNumber] still on "Do Not Disturb" for 24h. Check required.',
      },
      {
        code: 'HOUSEKEEPING_STATUS_UPDATED',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Housekeeping Status Updated: [RoomNumber]',
        contentTemplate:
          'Room [RoomNumber] housekeeping status changed from [OldStatus] to [NewStatus].',
      },

      // // Maintenance
      {
        code: 'MAINT_REQUEST',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Maintenance Request: Room [RoomNumber]',
        contentTemplate:
          'Reported issue in Rm [RoomNumber]: [IssueDescription].',
      },
      {
        code: 'MAINT_COMPLETE',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Maintenance Complete: #[TaskId]',
        contentTemplate:
          'Task #[TaskId] in Rm [RoomNumber] resolved. Room back in service.',
      },
      {
        code: 'PREVENTIVE_REMINDER',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Preventive Task Due: [TaskName]',
        contentTemplate:
          'Preventive task [TaskName] due today. Area: [ZoneFloor].',
      },

      // Room out of service / Inventory
      {
        code: 'ROOM_OOS',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Room Out of Service: [RoomNumber]',
        contentTemplate:
          'Rm [RoomNumber] set to Out of Service. Reason: [Reason]. Est. duration: [DurationDays] days.',
      },
      {
        code: 'LOW_INVENTORY',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Low Inventory: [RoomType]',
        contentTemplate:
          'Warning, only [Quantity] rooms left in category [RoomType].',
      },

      // Groups / Sales
      {
        code: 'NEW_GROUP_BOOKING',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'New Group Confirmed: [GroupName]',
        contentTemplate:
          '[Number] rooms blocked from [StartDate] to [EndDate] for group [GroupName].',
      },

      // // Revenue / Rate Parity
      {
        code: 'RATE_PARITY_ALERT',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Rate Parity Alert: [OTAName]',
        contentTemplate:
          '[OTAName] selling Rm [RoomType] at [Price] (Lower than direct rate).',
      },

      // OTA Events
      {
        code: 'NEW_OTA_BOOKING',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'New OTA Booking: [OTARef]',
        contentTemplate:
          'Received via [OTAName]. Ref: [OTARef]. Guest: [GuestName]. Arrival: [ArrivalDate].',
      },
      {
        code: 'OTA_MODIFICATION',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'OTA Modification: [OTARef]',
        contentTemplate:
          '[OTAName] Ref: [OTARef]. Dates/Room changed. Check schedule.',
      },
      {
        code: 'OTA_CANCELLATION',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'OTA Cancellation: [OTARef]',
        contentTemplate:
          '[OTAName] Ref: [OTARef] cancelled. Room is now available for sale.',
      },
      {
        code: 'OTA_SYNC_ERROR',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'OTA Sync Error: [OTAName]',
        contentTemplate:
          'Update failed for [OTAName]. Error code: [ErrorCode]. Check connection.',
      },

      // Lost & Found / Security
      {
        code: 'ITEM_FOUND',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Item Found: Room [RoomNumber]',
        contentTemplate:
          'Item found in Rm [RoomNumber]. Type: [ItemCategory]. Logged as ID #[ItemId].',
      },

      // Optional French variants (codes include language suffix)
      {
        code: 'WORK_ORDER_ASSIGNED_FR',
        channel: 'IN_APP',
        locale: 'fr',
        subjectTemplate: 'Nouvelle Tâche Assignée #[WorkOrderId]',
        contentTemplate:
          'Vous avez été assigné à l’ordre de travail #[WorkOrderId] pour la chambre [RoomNumber]. Statut actuel : [Status].',
      },
      {
        code: 'WORK_ORDER_STATUS_UPDATED_FR',
        channel: 'IN_APP',
        locale: 'fr',
        subjectTemplate: 'Statut Mis à Jour : Tâche #[WorkOrderId]',
        contentTemplate:
          'Statut changé de [OldStatus] à [NewStatus] pour l’ordre de travail #[WorkOrderId] (chambre [RoomNumber]).',
      },
      {
        code: 'VIP_ARRIVAL_FR',
        channel: 'IN_APP',
        locale: 'fr',
        subjectTemplate: 'Arrivée VIP : [GuestName]',
        contentTemplate:
          'VIP ARRIVÉE : Le client [GuestName] est arrivé. Statut : [VIPLevel]. Action immédiate requise.',
      },
      {
        code: 'LATE_CHECKOUT_FR',
        channel: 'IN_APP',
        locale: 'fr',
        subjectTemplate: 'Alerte Départ Tardif : Chambre [RoomNumber]',
        contentTemplate:
          'Chambre [RoomNumber] toujours occupée à [Time]. Vérifier avec le client.',
      },

      //Add more templates as needed
      // Reservation notifications
      {
        code: 'RESERVATION_DIRECT_WEB_CREATED',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Direct Web Reservation Created [ReservationNumber]',
        contentTemplate:
          'Direct web reservation [ReservationNumber] created. Arrival: [ArrivalDate], Departure: [DepartureDate], Status: [Status].',
      },
      {
        code:'RESERVATION_CONFIRMATION_GUEST',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Reservation Confirmation [ReservationNumber]',
        contentTemplate:
          'Dear [GuestName], your reservation [ReservationNumber] is confirmed. Arrival: [ArrivalDate], Departure: [DepartureDate].',
      },
      {
        code: 'RESERVATION_PENDING',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Reservation Pending [ReservationNumber]',
        contentTemplate:
          'Reservation [ReservationNumber] is pending. Arrival: [ArrivalDate], Departure: [DepartureDate], Status: [Status].',
      },
      // Stay amendment notification
      {
        code: 'STAY_AMENDED',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Stay Amended [ReservationNumber]',
        contentTemplate:
          'Reservation [ReservationNumber] stay amended. New Arrival: [ArrivalDate], New Departure: [DepartureDate], Status: [Status].',
      },
      {
        code:'STAY_AMENDED_STAFF',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Guest Stay Amended [ReservationNumber]',
        contentTemplate:
          'Guest reservation [ReservationNumber] stay amended. New Arrival: [ArrivalDate], New Departure: [DepartureDate], Status: [Status].',
      },
        //Room change notification
      {
        code: 'ROOM_MOVE_GUEST',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Room Changed [ReservationNumber]',
        contentTemplate:
          'Reservation [ReservationNumber] room changed to [NewRoomNumber]. Previous Room: [OldRoomNumber].',
      },
      {
        code:'ROOM_MOVE_STAFF',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Guest Room Changed [ReservationNumber]',
        contentTemplate:
          'Guest reservation [ReservationNumber] room changed to [NewRoomNumber]. Previous Room: [OldRoomNumber].',
      },
      //cancellation notifications
      {
        code: 'RESERVATION_PARTIAL_CANCELLED',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Reservation Partially Cancelled [ReservationNumber]',
        contentTemplate:
          'Reservation [ReservationNumber] partially cancelled. Arrival: [ArrivalDate], Departure: [DepartureDate].',
      },
      {
        code: 'RESERVATION_CANCELLED_GUEST',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Reservation Cancelled [ReservationNumber]',
        contentTemplate:
          'Reservation [ReservationNumber] cancelled. Arrival: [ArrivalDate], Departure: [DepartureDate].',
      },
      {
        code: 'RESERVATION_PARTIAL_CANCELLED_GUEST',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Reservation Partially Cancelled [ReservationNumber]',
        contentTemplate:
          'Dear [GuestName], your reservation [ReservationNumber] has been partially cancelled. Arrival: [ArrivalDate], Departure: [DepartureDate].',
      },
      {
        code: 'RESERVATION_CANCELLED_GUEST_OTA',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Reservation Cancelled [ReservationNumber]',
        contentTemplate:
          'Dear [GuestName], your reservation [ReservationNumber] made via [OTAName] has been cancelled. Arrival: [ArrivalDate], Departure: [DepartureDate].',
      },
      // voided notifications
      {
        code: 'RESERVATION_VOIDED',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Reservation Voided [ReservationNumber]',
        contentTemplate:
          'Reservation [ReservationNumber] has been voided.',
      },
      {
        code: 'RESERVATION_VOIDED_GUEST',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Reservation Voided [ReservationNumber]',
        contentTemplate:
          'Dear [GuestName], your reservation [ReservationNumber] has been voided.',
      },
      {
        code: 'RESERVATION_PARTIAL_VOIDED',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Reservation Partially Voided [ReservationNumber]',
        contentTemplate:
          'Reservation [ReservationNumber] has been partially voided.',
      },
      {
        code: 'PAX_CHANGED_GUEST',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Guest Count Changed [ReservationNumber]',
        contentTemplate:
          'Dear [GuestName], the number of guests for your reservation [ReservationNumber] has been changed to [NewPaxCount].',
      },
      {
        code: 'PAX_CHANGED_STAFF',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Guest Count Changed [ReservationNumber]',
        contentTemplate:
          'The number of guests for reservation [ReservationNumber] has been changed to [NewPaxCount].',

      },
      {
        code: 'RATE_CHANGED_STAFF',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Rate Changed [ReservationNumber]',
        contentTemplate:
          'The rate for reservation [ReservationNumber] has been changed to [NewRate]. Previous Rate: [OldRate].',
      },
      {
        code: 'RATE_CHANGED_GUEST',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Rate Changed [ReservationNumber]',
        contentTemplate:
          'Dear [GuestName], the rate for your reservation [ReservationNumber] has been changed to [NewRate]. Previous Rate: [OldRate].',
      },
      {
        code: 'CHECKIN_COMPLETED_STAFF',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Guest Check-In Completed [ReservationNumber]',
        contentTemplate:
          'Guest [GuestName] has completed check-in for reservation [ReservationNumber]. Room: [RoomNumber].',

      },
      {
        code: 'CHECKIN_COMPLETED_GUEST',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Check-In Completed [ReservationNumber]',
        contentTemplate:
          'Dear [GuestName], you have successfully completed check-in for your reservation [ReservationNumber]. Your room number is [RoomNumber].',
      },
      {
        code: 'CHECKOUT_COMPLETED_STAFF',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Guest Check-Out Completed [ReservationNumber]',
        contentTemplate:
          'Guest [GuestName] has completed check-out for reservation [ReservationNumber]. Room: [RoomNumbers].',
      },
      {
        code: 'CHECKOUT_COMPLETED_GUEST',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Check-Out Completed [ReservationNumber]',
        contentTemplate:
          'Dear [GuestName], you have successfully completed check-out for your reservation [ReservationNumber]. We hope you had a pleasant stay!',
      },
      {
        code: 'ROOM_BLOCKED_STAFF',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Room Blocked [RoomNumber]',
        contentTemplate:
          'Room [RoomNumber] has been blocked. Reason: [Reason]. Blocked By: [ChangedBy].',
      },
      {
        code: 'CLEANING_INCOMPLETE_STAFF',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Cleaning Incomplete [RoomNumber]',
        contentTemplate:
          'Cleaning for room [RoomNumber] is incomplete. Assigned Housekeeper: [HouseKeeperName].',
      },
      {
        code: 'CLEANING_COMPLETED_STAFF',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Cleaning Completed [RoomNumber]',
        contentTemplate:
          'Cleaning for room [RoomNumber] has been completed by Housekeeper: [HouseKeeperName].',
      },
      {
        code: 'ROOM_INSPECTED_STAFF',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Room Inspected [RoomNumber]',
        contentTemplate:
          'Room [RoomNumber] has been inspected by Supervisor: [SupervisorName]. Status: [InspectionStatus].',
      },
      {
        code: 'ROOM_DIRTY_HOUSEKEEPING',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Room Marked Dirty [RoomNumber]',
        contentTemplate:
          'Room [RoomNumber] has been marked as Dirty. Notified Housekeeping Team.',
      },
      {
        code: 'HOUSEKEEPING_STATUS_CHANGED_STAFF',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Housekeeping Status Changed [RoomNumber]',
        contentTemplate:
          'Housekeeping status for room [RoomNumber] changed from [OldStatus] to [NewStatus] by [ChangedBy].',
      },
      {
        code: 'ROOM_READY_STAFF',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Room Ready [RoomNumber]',
        contentTemplate:
          'Room [RoomNumber] is now ready and available for assignment. Updated by [HousekeeperName].',
      },
      {
        code: 'ROOM_BLOCKED_HOUSEKEEPING',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Room Blocked for Housekeeping [RoomNumber]',
        contentTemplate:
          'Room [RoomNumber] has been blocked for housekeeping. Reason: [Reason]. Blocked By: [ChangedBy].',
      },
      {
        code: 'ROOM_INSPECTION_FAILED_HOUSEKEEPING',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Room Inspection Failed [RoomNumber]',
        contentTemplate:
          'Room [RoomNumber] inspection failed. Issues: [IssuesList]. Notified Housekeeping Team.',
      },
      {
        code: 'ROOM_DIRTY_HOUSEKEEPING',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Room Marked Dirty [RoomNumber]',
        contentTemplate:
          'Room [RoomNumber] has been marked as Dirty. Notified Housekeeping Team.',
      },
      {
        code: 'HOUSEKEEPING_STATUS_CHANGED_HOUSEKEEPING',
        channel: 'IN_APP',
        locale: 'en',
        subjectTemplate: 'Housekeeping Status Changed [RoomNumber]',
        contentTemplate:
          'Housekeeping status for room [RoomNumber] changed from [OldStatus] to [NewStatus] by [ChangedBy].',
      },
     {
      code: 'HOUSEKEEPING_ISSUE_DETECTED_STAFF',
      channel: 'IN_APP',
      locale: 'en',
      subjectTemplate: 'Housekeeping Issue Detected [RoomNumber]',
      contentTemplate:
        'A housekeeping issue has been detected in room [RoomNumber]. Issue Details: [Description]. Please address promptly.',
     },
     {
      code: 'ROOM_BLOCK_MODIFIED_STAFF',
      channel: 'IN_APP',
      locale: 'en',
      subjectTemplate: 'Room Block Modified [RoomNumber]',
      contentTemplate:
        'The block status for room [RoomNumber] has been modified. Modified By: [ModifiedBy].',
     },
     {
      code: 'ROOM_UNBLOCKED_STAFF',
      channel: 'IN_APP',
      locale: 'en',
      subjectTemplate: 'Room Unblocked [RoomNumber]',
      contentTemplate:
        'Room [RoomNumber] has been unblocked and is now available for assignment. Unblocked By: [UnblockedBy].',
     },
     {
      code: 'ROOM_BLOCK_MODIFIED_HOUSEKEEPING',
      channel: 'IN_APP',
      locale: 'en',
      subjectTemplate: 'Room Block Modified [RoomNumber]',
      contentTemplate:
        'The block status for room [RoomNumber] has been modified. Modified By: [ModifiedBy].',
     },
     {
      code: 'ROOM_UNBLOCKED_HOUSEKEEPING',
      channel: 'IN_APP',
      locale: 'en',
      subjectTemplate: 'Room Unblocked [RoomNumber]',
      contentTemplate:
        'Room [RoomNumber] has been unblocked and is now available for assignment. Unblocked By: [UnblockedBy].',
     },
     {
      code: 'LOST_AND_FOUND_ITEM_REPORTED',
      channel: 'IN_APP',
      locale: 'en',
      subjectTemplate: 'Lost and Found Item Reported [ItemId]',
      contentTemplate:
        'A new lost and found item has been reported. Item ID: [ItemId], Description: [Description], Reported By: [ReportedBy].',
     }

    ]

    for (const tpl of templates) {
      await NotificationTemplate.updateOrCreate(
        { code: tpl.code },
        {
          channel: tpl.channel,
          locale: tpl.locale,
          subjectTemplate: tpl.subjectTemplate,
          contentTemplate: tpl.contentTemplate,
          isActive: tpl.isActive ?? true,
        }
      )
    }
  }
}

