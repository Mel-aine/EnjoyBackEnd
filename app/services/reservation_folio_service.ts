import Folio from '#models/folio'
import Reservation from '#models/reservation'
import Guest from '#models/guest'
import FolioService, { CreateFolioData } from '#services/folio_service'
import { FolioType, TransactionCategory, TransactionType } from '#app/enums'
import db from '@adonisjs/lucid/services/db'

export interface ReservationFolioData {
  reservationId: number
  folioType?: FolioType
  creditLimit?: number
  notes?: string
  createdBy: number
}

export interface WalkInFolioData {
  hotelId: number
  guestId: number
  folioType?: FolioType
  creditLimit?: number
  notes?: string
  createdBy: number
}

export interface AddGuestToReservationData {
  reservationId: number
  guestId: number
  isPrimary?: boolean
  guestType?: 'adult' | 'child' | 'infant'
  roomAssignment?: number
  specialRequests?: string
  dietaryRestrictions?: string
  accessibility?: string
  emergencyContact?: string
  emergencyPhone?: string
  notes?: string
  createdBy: number
}

export default class ReservationFolioService {
  /**
   * Create folio automatically when reservation is confirmed
   */
  static async createFolioForReservation(data: ReservationFolioData): Promise<Folio> {
    return await db.transaction(async (trx) => {
      // Get reservation details
      const reservation = await Reservation.query({ client: trx })
        .where('id', data.reservationId)
        .preload('hotel')
        .preload('guests', (query) => {
          query.pivotColumns(['is_primary'])
        })
        .firstOrFail()
      
      // Get the primary guest for the reservation
      let primaryGuest = reservation.guests.find(guest => guest.$extras.pivot_is_primary)
      
      // If no primary guest is found, get the first guest or fall back to the original guest_id
      if (!primaryGuest && reservation.guests.length > 0) {
        primaryGuest = reservation.guests[0]
      }
      
      // If still no guest, try to get the guest from the guest_id column
      if (!primaryGuest && reservation.guestId) {
        primaryGuest = await Guest.findOrFail(reservation.guestId)
      }
      
      if (!primaryGuest) {
        throw new Error('No guest found for this reservation')
      }
      
      // Determine folio type based on reservation
      let folioType = data.folioType || FolioType.GUEST
      if (reservation.groupId) {
        folioType = FolioType.GROUP
      }
      /* 
      TODO Manage Company Id
      else if (reservation.companyId) {
        folioType = 'company'
      }*/
      
      // Create folio using the main service
      const folioData: CreateFolioData = {
        hotelId: reservation.hotelId,
        guestId: primaryGuest.id,
        reservationId: data.reservationId,
        groupId: reservation.groupId??undefined,
       // companyId: reservation.companyId,
        folioType,
        creditLimit: data.creditLimit || 0,
        notes: data.notes || `Auto-created for reservation ${reservation.confirmationNumber}`,
        createdBy: data.createdBy
      }
      
      const folio = await FolioService.createFolio(folioData)
      
      // Update reservation with folio reference
     /* await reservation.useTransaction(trx).merge({
        folioId: folio.id,
        lastModifiedBy: data.createdBy
      }).save()
      */
      return folio
    })
  }
  
  /**
   * Create folio for walk-in guests
   */
  static async createFolioForWalkIn(data: WalkInFolioData): Promise<Folio> {
    const folioData: CreateFolioData = {
      hotelId: data.hotelId,
      guestId: data.guestId,
      folioType: data.folioType!,
      creditLimit: data.creditLimit || 0,
      notes: data.notes || 'Walk-in guest folio',
      createdBy: data.createdBy
    }
    
    return await FolioService.createFolio(folioData)
  }
  
  /**
   * Create multiple folios for group reservations
   */
  static async createFoliosForGroup(
    reservationId: number, 
    guestIds: number[], 
    createdBy: number
  ): Promise<Folio[]> {
    return await db.transaction(async (trx) => {
      const reservation = await Reservation.query({ client: trx })
        .where('id', reservationId)
        .preload('guests')
        .firstOrFail()
      
      const folios: Folio[] = []
      
      // Create master folio for the group
      const masterFolio = await this.createFolioForReservation({
        reservationId,
        folioType: FolioType.MASTER,
        notes: `Master folio for group reservation ${reservation.confirmationNumber}`,
        createdBy
      })
      folios.push(masterFolio)
      
      // Create individual guest folios for each guest in the reservation
      const reservationGuestIds = guestIds.length > 0 ? guestIds : reservation.guests.map(g => g.id)
      
      for (const guestId of reservationGuestIds) {
        const guestFolioData: CreateFolioData = {
          hotelId: reservation.hotelId,
          guestId,
          reservationId,
          groupId: reservation.groupId??undefined,
          folioType: FolioType.GUEST,
          notes: `Guest folio for group reservation ${reservation.confirmationNumber}`,
          createdBy
        }
        
        const guestFolio = await FolioService.createFolio(guestFolioData)
        folios.push(guestFolio)
      }
      
      return folios
    })
  }
  
  /**
   * Auto-post room charges to folio based on reservation
   */
  static async postRoomCharges(reservationId: number, postedBy: number): Promise<void> {
    const reservation = await Reservation.query()
      .where('id', reservationId)
      .preload('folios')
      .preload('guests')
      .preload('reservationRooms', (query) => {
        query.preload('room')
      })//.preload('roomRate')
      .firstOrFail()
    
    if (!reservation.folios || reservation.folios.length === 0) {
      throw new Error('No folio found for this reservation')
    }
    
    // Calculate stay duration
    const checkIn =reservation.checkInDate!; 
    const checkOut = reservation.checkOutDate!
    const nights = checkOut.diff(checkIn, 'days').days
    
    // Post room charges for each room
    for (const reservationRoom of reservation.reservationRooms) {
      const roomRate = reservationRoom.roomRates
      const totalAmount = roomRate.baseRate * nights
      const extraChildAmount = parseFloat(`${roomRate.extraChildRate??0}`) * nights
      const extraAdultAmount = parseFloat(`${roomRate.extraAdultRate??0}`) * nights
      await FolioService.postTransaction({
        folioId: reservation.folios[0].id,
        transactionType: TransactionType.CHARGE,
        category: TransactionCategory.ROOM,
        description: `Room ${reservationRoom.room.roomNumber} - ${nights} nights`,
        amount: totalAmount+extraChildAmount+extraAdultAmount,
        quantity: nights,
        unitPrice: roomRate.baseRate,
        departmentId: 1, // Rooms department
        revenueCenterId: 1, // Room revenue
        glAccountCode: '4100', // Room revenue account
        reference: `RES-${reservation.confirmationNumber}`,
        notes: `Auto-posted room charge for reservation ${reservation.confirmationNumber}`,
        postedBy
      })
    }
  }
  
  /**
   * Auto-post taxes and fees to folio
   */
  static async postTaxesAndFees(reservationId: number, postedBy: number): Promise<void> {
    const reservation = await Reservation.query()
      .where('id', reservationId)
      .preload('folios')
      .preload('guests')
      .preload('hotel')
      .firstOrFail()
    
    if (!reservation.folios || reservation.folios.length === 0) {
      throw new Error('No folio found for this reservation'+postedBy)
    }
    
    // Get the primary folio (first one or master folio)
    //const primaryFolio = reservation.folios.find(f => f.folioType === 'master') || reservation.folios[0]
    
    // Calculate stay duration
    //const checkIn =reservation.checkInDate!; 
    //const checkOut = reservation.checkOutDate!
    //const nights = checkOut.diff(checkIn, 'days').days
    
    // Calculate total number of guests from the many-to-many relationship
    //const totalGuests = reservation.guests.length || reservation.adults || 1
    // TODO cityTaxes
    // Post city tax if applicable
    /*if (reservation.hotel.cityTaxRate && reservation.hotel.cityTaxRate > 0) {
      const cityTaxAmount = reservation.hotel.cityTaxRate * nights * totalGuests
      
      await FolioService.postTransaction({
        folioId: primaryFolio.id,
        transactionType: 'charge',
        category: 'tax',
        description: `City Tax - ${nights} nights, ${totalGuests} guests`,
        amount: cityTaxAmount,
        quantity: nights * totalGuests,
        unitPrice: reservation.hotel.cityTaxRate,
        departmentId: 1,
        glAccountCode: '2200', // Tax payable account
        reference: `TAX-${reservation.confirmationNumber}`,
        notes: `Auto-posted city tax for reservation ${reservation.confirmationNumber}`,
        postedBy
      })
    }
    
    // Post service charges if applicable
    if (reservation.hotel.serviceChargeRate && reservation.hotel.serviceChargeRate > 0) {
      // Calculate service charge based on room charges
      const roomChargesTotal = primaryFolio.totalCharges || 0
      const serviceChargeAmount = roomChargesTotal * (reservation.hotel.serviceChargeRate / 100)
      
      await FolioService.postTransaction({
        folioId: primaryFolio.id,
        transactionType: 'charge',
        category: 'service_charge',
        description: `Service Charge ${reservation.hotel.serviceChargeRate}%`,
        amount: serviceChargeAmount,
        quantity: 1,
        unitPrice: serviceChargeAmount,
        departmentId: 1,
        glAccountCode: '4200', // Service charge revenue
        reference: `SC-${reservation.confirmationNumber}`,
        notes: `Auto-posted service charge for reservation ${reservation.confirmationNumber}`,
        postedBy
      })
    }*/
  }
  
  /**
   * Get all folios for a reservation (useful for group bookings)
   */
  static async getFoliosForReservation(reservationId: number): Promise<Folio[]> {
    return await Folio.query()
      .where('reservationId', reservationId)
      .preload('guest')
      .preload('transactions')
      .orderBy('folioType', 'asc')
      .orderBy('createdAt', 'asc')
  }
  
  /**
   * Check if reservation has folio created
   */
  static async hasReservationFolio(reservationId: number): Promise<boolean> {
    const folio = await Folio.query()
      .where('reservationId', reservationId)
      .first()
    
    return !!folio
  }

  /**
   * Add a guest to an existing reservation
   */
  static async addGuestToReservation(data: AddGuestToReservationData): Promise<void> {
    return await db.transaction(async (trx) => {
      const reservation = await Reservation.query({ client: trx })
        .where('id', data.reservationId)
        .firstOrFail()

      // If this is set as primary guest, unset other primary guests
      if (data.isPrimary) {
        await db.from('reservation_guests')
          .where('reservation_id', data.reservationId)
          .update({ is_primary: false })
      }

      // Add the guest to the reservation
      await db.table('reservation_guests').insert({
        reservation_id: reservation.id,
        guest_id: data.guestId,
        is_primary: data.isPrimary || false,
        guest_type: data.guestType || 'adult',
        room_assignment: data.roomAssignment,
        special_requests: data.specialRequests,
        dietary_restrictions: data.dietaryRestrictions,
        accessibility: data.accessibility,
        emergency_contact: data.emergencyContact,
        emergency_phone: data.emergencyPhone,
        notes: data.notes,
        created_by: data.createdBy,
        created_at: new Date(),
        updated_at: new Date()
      })
    })
  }

  /**
   * Remove a guest from a reservation
   */
  static async removeGuestFromReservation(
    reservationId: number, 
    guestId: number
  ): Promise<void> {
    await db.from('reservation_guests')
      .where('reservation_id', reservationId)
      .where('guest_id', guestId)
      .delete()
  }

  /**
   * Create individual folios for each guest in a reservation
   */
  static async createIndividualFoliosForGuests(
    reservationId: number,
    createdBy: number
  ): Promise<Folio[]> {
    return await db.transaction(async (trx) => {
      const reservation = await Reservation.query({ client: trx })
        .where('id', reservationId)
        .preload('guests')
        .preload('folios', (folioQuery) => {
          folioQuery.preload('transactions', (transactionQuery) => {
            transactionQuery.where('category', 'room_charge')
          })
        })
        .firstOrFail()

      // Find the primary guest's folio
      const primaryFolio = reservation.folios.find(folio => {
        // Check if this folio belongs to the primary guest
        const primaryGuest = reservation.guests.find(guest => guest.$extras.pivot_is_primary)
        return primaryGuest && folio.guestId === primaryGuest.id
      }) || reservation.folios[0] // Fallback to first folio if no primary found

      if (!primaryFolio) {
        throw new Error('No primary folio found for reservation')
      }

      const folios: Folio[] = []
      const roomChargeTransactions = primaryFolio.transactions || []

      for (const guest of reservation.guests) {
        // Skip if this is the primary guest (they already have the folio)
        if (guest.$extras.pivot_is_primary) {
          folios.push(primaryFolio)
          continue
        }

        const folioData: CreateFolioData = {
          hotelId: reservation.hotelId,
          guestId: guest.id,
          reservationId,
          groupId: reservation.groupId??undefined,
         // companyId: reservation.companyId,
          folioType: FolioType.GUEST,
          creditLimit: 0,
          notes: `Individual folio for ${guest.firstName} ${guest.lastName} - Reservation ${reservation.confirmationNumber}`,
          createdBy
        }

        const folio = await FolioService.createFolio(folioData)
        folios.push(folio)

        // Copy all room charge transactions from primary folio to this guest's folio
        for (const transaction of roomChargeTransactions) {
          await FolioService.postTransaction({
          folioId: folio.id,
          transactionType: transaction.transactionType,
            category: transaction.category,
            description: `${transaction.description} (Copied from primary folio)`,
            amount: transaction.amount,
            quantity: transaction.quantity,
            unitPrice: transaction.unitPrice,
            taxAmount: transaction.taxAmount,
            serviceChargeAmount: transaction.serviceChargeAmount,
            discountAmount: transaction.discountAmount,
            //departmentCode: transaction.department,
            //revenueCenterCode: transaction.revenueCenter,
            //costCenterCode: transaction.costCenter,
            //glAccountCode: transaction.glAccount,
            //reference: transaction.reference,
            notes: `Copied from primary guest folio - ${transaction.notes || ''}`,
            postedBy: createdBy
          })
        }
      }

      return folios
    })
  }

  /**
   * Create folios for all guests when reservation is confirmed
   * This method should be called when a reservation status is updated to 'confirmed'
   */
  static async createFoliosOnConfirmation(
    reservationId: number,
    confirmedBy: number
  ): Promise<Folio[]> {
    return await db.transaction(async (trx) => {
      const reservation = await Reservation.query({ client: trx })
        .where('id', reservationId)
        .preload('guests')
        .firstOrFail()

      // Check if reservation is confirmed
      if (reservation.status !== 'confirmed') {
        throw new Error('Reservation must be confirmed to create folios')
      }

      // Check if folios already exist
      const existingFolios = await this.getFoliosForReservation(reservationId)
      if (existingFolios.length > 0) {
        // If folios exist, create individual folios for all guests
        return await this.createIndividualFoliosForGuests(reservationId, confirmedBy)
      }

      // Create primary folio first
      await this.createFolioForReservation({
        reservationId,
        folioType: FolioType.GUEST,
        notes: `Primary folio for reservation ${reservation.confirmationNumber}`,
        createdBy: confirmedBy
      })

      // Post room charges to primary folio
      await this.postRoomCharges(reservationId, confirmedBy)

      // Create individual folios for all guests (including copying charges)
      return await this.createIndividualFoliosForGuests(reservationId, confirmedBy)
    })
  }

  /**
   * Get all guests for a reservation with their pivot data
   */
  static async getReservationGuests(reservationId: number) {
    const reservation = await Reservation.query()
      .where('id', reservationId)
      .preload('guests', (query) => {
        query.pivotColumns([
          'is_primary', 'guest_type', 'room_assignment', 
          'special_requests', 'dietary_restrictions', 'accessibility',
          'emergency_contact', 'emergency_phone', 'notes'
        ])
      })
      .firstOrFail()

    return reservation.guests
  }

  /**
   * Update guest information in a reservation
   */
  static async updateGuestInReservation(
    reservationId: number,
    guestId: number,
    updateData: Partial<AddGuestToReservationData>
  ): Promise<void> {
    const updateFields: any = {}
    
    if (updateData.isPrimary !== undefined) updateFields.is_primary = updateData.isPrimary
    if (updateData.guestType) updateFields.guest_type = updateData.guestType
    if (updateData.roomAssignment !== undefined) updateFields.room_assignment = updateData.roomAssignment
    if (updateData.specialRequests !== undefined) updateFields.special_requests = updateData.specialRequests
    if (updateData.dietaryRestrictions !== undefined) updateFields.dietary_restrictions = updateData.dietaryRestrictions
    if (updateData.accessibility !== undefined) updateFields.accessibility = updateData.accessibility
    if (updateData.emergencyContact !== undefined) updateFields.emergency_contact = updateData.emergencyContact
    if (updateData.emergencyPhone !== undefined) updateFields.emergency_phone = updateData.emergencyPhone
    if (updateData.notes !== undefined) updateFields.notes = updateData.notes
    
    updateFields.updated_at = new Date()

    // If setting as primary, unset other primary guests first
    if (updateData.isPrimary) {
      await db.from('reservation_guests')
        .where('reservation_id', reservationId)
        .where('guest_id', '!=', guestId)
        .update({ is_primary: false })
    }

    await db.from('reservation_guests')
      .where('reservation_id', reservationId)
      .where('guest_id', guestId)
      .update(updateFields)
  }
}