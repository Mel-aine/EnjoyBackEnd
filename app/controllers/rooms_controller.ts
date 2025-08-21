import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Room from '#models/room'
import RoomType from '#models/room_type'
import User from '#models/user'
import ReservationRoom from '#models/reservation_room'
import { createRoomValidator, updateRoomValidator } from '#validators/room'

export default class RoomsController {
  /**
   * Display a list of rooms
   */
  async index({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const search = request.input('search')
      const hotelId = request.input('hotel_id')
      const roomTypeId = request.input('room_type_id')
      const floor = request.input('floor')
      const status = request.input('status')
      const housekeepingStatus = request.input('housekeeping_status')
      const maintenanceStatus = request.input('maintenance_status')
      const smokingAllowed = request.input('smoking_allowed')
      const petFriendly = request.input('pet_friendly')
      const accessible = request.input('accessible')

      const query = Room.query()

      if (hotelId) {
        query.where('hotel_id', hotelId)
      }

      if (roomTypeId) {
        query.where('room_type_id', roomTypeId)
      }

      if (search) {
        query.where((builder) => {
          builder
            .where('room_number', 'ILIKE', `%${search}%`)
            .orWhere('room_name', 'ILIKE', `%${search}%`)
            .orWhere('description', 'ILIKE', `%${search}%`)
        })
      }

      if (floor) {
        query.where('floor_number', floor)

      }

      if (status) {
        query.where('status', status)
      }

      if (housekeepingStatus) {
        query.where('housekeeping_status', housekeepingStatus)
      }

      if (maintenanceStatus) {
        query.where('maintenance_status', maintenanceStatus)
      }

      if (smokingAllowed !== undefined) {
        query.where('smoking_allowed', smokingAllowed)
      }

      if (petFriendly !== undefined) {
        query.where('pet_friendly', petFriendly)
      }

      if (accessible !== undefined) {
        query.where('accessible', accessible)
      }

      const rooms = await query
        .preload('hotel')
        .preload('roomType')
        .preload('bedType')
        .preload('modifier')
        .preload('taxRates')
        .preload('creator')
        .orderBy('floor_number', 'asc')
        .orderBy('room_number', 'asc')
        .paginate(page, limit)

      return response.ok({
        message: 'Rooms retrieved successfully',
        data: rooms
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Failed to retrieve rooms',
        error: error.message
      })
    }
  }

  /**
   * Create a new room
   */
  async store({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createRoomValidator)
      const { taxRateIds, ...roomData } = payload

      const room = await Room.create({
        ...roomData,
        createdBy: auth.user?.id
      })

      // Attach tax rates if provided
      if (taxRateIds && taxRateIds.length > 0) {
        await room.related('taxRates').attach(taxRateIds)
      }

      await room.load('hotel')
      await room.load('roomType')
      await room.load('taxRates')

      return response.created({
        message: 'Room created successfully',
        data: room
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to create room',
        error: error.message
      })
    }
  }

  /**
   * Show a specific room
   */
  async show({ params, response }: HttpContext) {
    try {
      const room = await Room.query()
        .where('id', params.id)
        .preload('hotel')
        .preload('roomType')
        .preload('taxRates')
        .preload('reservationRooms')
        .preload('maintenanceRequests')
        .firstOrFail()

      return response.ok({
        message: 'Room retrieved successfully',
        data: room
      })
    } catch (error) {
      return response.notFound({
        message: 'Room not found',
        error: error.message
      })
    }
  }

  /**
   * Update a room
   */
  async update({ params, request, response, auth }: HttpContext) {
    try {
      const room = await Room.findOrFail(params.id)
      const payload = await request.validateUsing(updateRoomValidator)
      const { taxRateIds, ...roomData } = payload

      room.merge({
        ...roomData,
        lastModifiedBy: auth.user?.id
      })

      await room.save()

      // Update tax rates if provided
      if (taxRateIds !== undefined) {
        if (taxRateIds.length > 0) {
          await room.related('taxRates').sync(taxRateIds)
        } else {
          await room.related('taxRates').detach()
        }
      }

      await room.load('hotel')
      await room.load('roomType')
      await room.load('taxRates')

      return response.ok({
        message: 'Room updated successfully',
        data: room
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to update room',
        error: error.message
      })
    }
  }

  /**
   * Delete a room
   */
  async destroy({ params, response }: HttpContext) {
    try {
      const room = await Room.findOrFail(params.id)

      // Check if there are any active reservations for this room
      const activeReservations = await room.related('reservationRooms')
        .query()
        .whereIn('status', ['confirmed', 'checked_in'])
        .count('* as total')

      if (activeReservations[0].$extras.total > 0) {
        return response.badRequest({
          message: 'Cannot delete room with active reservations'
        })
      }

      await room.delete()

      return response.ok({
        message: 'Room deleted successfully'
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to delete room',
        error: error.message
      })
    }
  }
  /**
   * Update room status
   */
  async updateStatus({ params, request, response }: HttpContext) {
    try {
      const room = await Room.findOrFail(params.id)
      const { status } = request.only(['status'])

      room.status = status
      await room.save()

      return response.ok({
        message: 'Room status updated successfully',
        data: room
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to update room status',
        error: error.message
      })
    }
  }

  /**
   * Update housekeeping status
   */
  async updateHousekeepingStatus({ params, request, response }: HttpContext) {
    try {
      const room = await Room.findOrFail(params.id)
      const { housekeepingStatus } = request.only(['housekeepingStatus'])

      room.housekeepingStatus = housekeepingStatus
      await room.save()

      return response.ok({
        message: 'Housekeeping status updated successfully',
        data: room
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to update housekeeping status',
        error: error.message
      })
    }
  }

  /**
   * Update maintenance status
   */
  async updateMaintenanceStatus({ params, request, response }: HttpContext) {
    try {
      const room = await Room.findOrFail(params.id)
      const { maintenanceNotes, nextMaintenanceDate } = request.only(['maintenanceNotes', 'nextMaintenanceDate'])

      if (maintenanceNotes) {
        room.maintenanceNotes = maintenanceNotes
      }
      if (nextMaintenanceDate) {
        room.nextMaintenanceDate = DateTime.fromJSDate(new Date(nextMaintenanceDate))
      }

      await room.save()

      return response.ok({
        message: 'Maintenance status updated successfully',
        data: room
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to update maintenance status',
        error: error.message
      })
    }
  }

  /**
   * Get room availability
   */
  async availability({ params, request, response }: HttpContext) {
    try {
      const room = await Room.findOrFail(params.id)
      const { startDate, endDate } = request.only(['startDate', 'endDate'])

      // Check if room has any reservations in the given date range
      const reservations = await room.related('reservationRooms')
        .query()
        .where('check_in_date', '<=', endDate)
        .where('check_out_date', '>=', startDate)
        .whereIn('status', ['confirmed', 'checked_in'])

      const isAvailable = reservations.length === 0 && room.status === 'available'

      return response.ok({
        message: 'Room availability retrieved successfully',
        data: {
          roomId: room.id,
          roomNumber: room.roomNumber,
          isAvailable,
          status: room.status,
          reservations: reservations.length
        }
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to check room availability',
        error: error.message
      })
    }
  }

  /**
   * Get room statistics
   */
  async stats({ request, response }: HttpContext) {
    try {
      const { hotelId } = request.only(['hotelId'])

      const query = Room.query()
      if (hotelId) {
        query.where('hotel_id', hotelId)
      }

      const totalRooms = await query.clone().count('* as total')
      const availableRooms = await query.clone().where('status', 'available').count('* as total')
      const occupiedRooms = await query.clone().where('status', 'occupied').count('* as total')
      const outOfOrderRooms = await query.clone().where('status', 'out_of_order').count('* as total')
      const maintenanceRooms = await query.clone().where('status', 'maintenance').count('* as total')
      const dirtyRooms = await query.clone().where('housekeeping_status', 'dirty').count('* as total')
      const cleanRooms = await query.clone().where('housekeeping_status', 'clean').count('* as total')
      const inspectedRooms = await query.clone().where('housekeeping_status', 'inspected').count('* as total')

      const stats = {
        totalRooms: totalRooms[0].$extras.total,
        availableRooms: availableRooms[0].$extras.total,
        occupiedRooms: occupiedRooms[0].$extras.total,
        outOfOrderRooms: outOfOrderRooms[0].$extras.total,
        maintenanceRooms: maintenanceRooms[0].$extras.total,
        dirtyRooms: dirtyRooms[0].$extras.total,
        cleanRooms: cleanRooms[0].$extras.total,
        inspectedRooms: inspectedRooms[0].$extras.total,
        occupancyRate: totalRooms[0].$extras.total > 0 ?
          (occupiedRooms[0].$extras.total / totalRooms[0].$extras.total * 100).toFixed(2) : 0
      }

      return response.ok({
        message: 'Room statistics retrieved successfully',
        data: stats
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve statistics',
        error: error.message
      })
    }
  }

  /**
   * Show room with reservations
   */
  async showWithReservations({ params, response }: HttpContext) {
    const roomId = params.id

    const room = await Room.query()
      .where('id', roomId)
      .preload('roomType')
      .preload('reservationRooms', (query) => {
        query.preload('reservation').preload('guest')
      })
      .first()

    if (!room) {
      return response.notFound({ message: 'Chambre non trouvée' })
    }

    const reservations = room.reservationRooms.map((rr) => {
      return {
        id: rr.id,
        checkIn: rr.checkInDate?.toISODate() ?? rr.checkInDate,
        checkOut: rr.checkOutDate?.toISODate() ?? rr.checkOutDate,
        guest: rr.guest ? `${rr.guest.firstName} ${rr.guest.lastName}` : null,
        status: rr.status ?? 'unknown',
      }
    })

    return response.ok({
      id: room.id,
      name: room.roomNumber,
      roomType: room.roomType?.roomTypeName || 'N/A',
      status: room.status,
      housekeepingStatus: room.housekeepingStatus,
      maintenanceStatus: room.condition,
      reservations,
    })
  }

  /**
   * Get rooms with details including reservations
   */
  public async getRoomsWithDetails({ params, response }: HttpContext) {
  const { hotelId } = params

  try {
    const rooms = await Room.query()
      .where('hotel_id', hotelId)
      .preload('roomType')
      .preload('reservationRooms', (query) => {
        query.preload('reservation', (reservationQuery) => {
          reservationQuery
            .select(['id', 'status', 'departDate', 'guestId'])
            .preload('guest', (guestQuery) => {
              guestQuery.select(['id', 'firstName', 'lastName'])
            })
        })
      })

    const detailedRooms = rooms.map((room) => {
      const reservations = room.reservationRooms


      const reservationData = reservations.map((rr) => ({
        reservation: rr.reservation,
        guest: rr.reservation?.guest ?? null,
        status: rr.reservation?.status ?? null,
      }))


      const checkedInReservation = reservationData.find(
        (r) =>
          r.reservation?.status === 'checked-in' ||
          r.reservation?.status === 'checked_in'
      )

      const guestName = checkedInReservation?.guest
        ? `${checkedInReservation.guest.firstName || ''} ${checkedInReservation.guest.lastName || ''}`.trim() || null
        : null


     const reservationsWithDepart = reservationData
      .filter((r) => r.reservation?.departDate != null)
      .sort((a, b) => {
        const dateA = DateTime.fromISO(
          a.reservation?.departDate?.toString() || ''
        )
        const dateB = DateTime.fromISO(
          b.reservation?.departDate?.toString() || ''
        )
        return dateB.toMillis() - dateA.toMillis()
      })


      const latestDeparture = reservationsWithDepart[0]

      const nextAvailable = latestDeparture?.reservation?.departDate
        ? (typeof latestDeparture.reservation.departDate === 'string'
            ? latestDeparture.reservation.departDate
            : latestDeparture.reservation.departDate.toString())
        : null

      const checkOutTime = nextAvailable

      return {
        ...room.serialize(),
        roomType: room.roomType?.serialize(),
        reservations: reservationData,
        guestName,
        nextAvailable,
        checkOutTime,
        status: room.status || 'available',
      }
    })

    return response.ok(detailedRooms)
  } catch (err) {
    console.error('Erreur getRoomsWithDetails:', err)
    return response.status(500).json({
      error: 'Erreur serveur',
      message: err instanceof Error ? err.message : 'Erreur inconnue',
    })
  }
}


  /**
   * Get recent bookings for a hotel
   */
  async getRecentBookings({ params, response }: HttpContext) {
    const hotelId = params.hotelId

    if (!hotelId) {
      return response.badRequest({ error: 'Le hotelId est requis.' })
    }

    try {
      const reservations = await ReservationRoom
        .query()
        .whereHas('room', (query) => {
          query.where('hotel_id', hotelId)
        })
        .preload('reservation', (resQuery) => {
          resQuery.preload('user')
        })
        .preload('room')
        .preload('guest')
        .orderBy('checkInDate', 'desc')
        .limit(10)

      const formatted = reservations.map((res) => {
        const reservation = res.reservation
        const user = reservation?.user
        const guest = res.guest
        const room = res.room

        return {
          guest: guest ? `${guest.firstName} ${guest.lastName}` : (user ? `${user.firstName} ${user.lastName}` : 'Inconnu'),
          email: guest?.email ?? user?.email ?? '',
          room: room?.roomNumber ?? 'Non spécifié',
          checkin: res.checkInDate?.toFormat('dd/MM/yyyy') ?? '',
          checkout: res.checkOutDate?.toFormat('dd/MM/yyyy') ?? '',
          status: reservation?.status ?? '',
          amount: reservation?.finalAmount ?? 0,
        }
      })

      return response.ok(formatted)
    } catch (error) {
      console.error(error)
      return response.internalServerError({ message: 'Erreur lors de la récupération des réservations.' })
    }
  }

  /**
   * Show reservations by room ID
   */
  async showByRoomId({ params, response }: HttpContext) {
    try {
      const { roomId } = params

      // Validation du paramètre
      if (!roomId) {
        return response.badRequest({ message: 'roomId is required' })
      }

      const roomIdNum = parseInt(roomId, 10)
      if (isNaN(roomIdNum)) {
        return response.badRequest({ message: 'Invalid roomId' })
      }

      // Récupération des réservations liées à une chambre
      const items = await ReservationRoom.query()
        .where('room_id', roomIdNum)
        .preload('reservation')
        .preload('room')
        .preload('guest')

      // Si aucune réservation trouvée
      if (items.length === 0) {
        return response.notFound({ message: 'No reservations found for this room' })
      }

      return response.ok(items)
    } catch (error) {
      console.error(error)
      return response.internalServerError({
        message: 'Error fetching reservations for room',
        error: error.message,
      })
    }
  }

/**
 *
 * Filter
 */
  public async filter({ request, response, params }: HttpContext) {
    try {
      const {
        searchText,
        roomType,
        status,
        floor,
        // equipment = []
      } = request.body()

      const service_id = params.id

      const query = Room.query()
        // .preload('RoomType')

      if (service_id) {
        query.where('service_id', service_id)
      }

      if (searchText) {
        query.whereRaw('CAST(room_number AS TEXT) ILIKE ?', [`%${searchText}%`])
      }

      if (roomType) {
        query.where('product_type_id', roomType)
      }

      if (floor) {
        query.where('floor', floor)
      }

      if (status) {
        query.where('status', status)
      }

      // if (Array.isArray(equipment) && equipment.length > 0) {
      //   for (const item of equipment) {
      //     if (!item.label || !item.value) continue

      //     const [optionName] = item.label.split(':').map((s:any) => s.trim())
      //     const value = item.value

      //     query.whereHas('availableOptions', (optionQuery) => {
      //       optionQuery
      //         .where('option_name', optionName)
      //         .wherePivot('value', value)
      //     })
      //   }
      // }

      const rooms = await query
      return response.ok(rooms)

    } catch (error) {
      console.error('❌ Error filtering rooms:', error)
      return response.status(500).json({
        message: 'Server error',
        error: error.message
      })
    }
  }

  /**
   * get housekeeping status by hotel Id
   */

   async getHouseStatus ({ params, request, response }: HttpContext) {
    try {
      const { hotelId } = params
      const { room_type_filter } = request.qs()

      // Query de base avec les relations
      let query = Room.query()
        .where('hotel_id', hotelId)
        .where('is_deleted', false)
        .preload('roomType')
        .preload('bedType')
        .orderBy('floor_number', 'asc')
        .orderBy('room_number', 'asc')

      // Filtrage par type de chambre si spécifié
      if (room_type_filter) {
        query = query.where('room_type_id', room_type_filter)
      }

      const rooms = await query

      // Transformation des données pour le frontend room.floorNumber,
      const transformedRooms = rooms.map(room => ({
        id: room.id.toString(),
        name: room.roomNumber,
        beds: room.maxOccupancy || 0,
        isChecked: false,
        section: this.getRoomSection(room.roomType?.roomTypeName || ''),
        roomType: room.roomType?.roomTypeName || 'Unknown',
        status: this.getOccupancyStatus(room.status),
        housekeepingStatus: this.getHousekeepingStatus(room.housekeepingStatus),
        tag: this.getRoomTag(room),
        statusType: this.getStatusType(room.housekeepingStatus, room.status)
      }))

      // Récupération des types de chambres pour les filtres
      const roomTypes = await RoomType.query()
        .where('hotel_id', hotelId)
        .where('is_deleted', false)
        .select('id', 'roomTypeName')

      // Récupération des housekeepers
      const housekeepers = await User.query()
        .whereHas('role', (roleQuery) => {
          roleQuery.where('role_name', 'housekeeper')
        })
        .where('hotel_id', hotelId)
        .select('id', 'first_name', 'last_name')

      return response.ok({
        rooms: transformedRooms,
        roomTypes: roomTypes.map(rt => ({
          value: rt.id,
          label: rt.roomTypeName
        })),
        housekeepers: housekeepers.map(hk => ({
          value: hk.id,
          label: `${hk.firstName} ${hk.lastName}`
        })),
        statusOptions: [
          { value: 'available', label: 'Available' },
          { value: 'occupied', label: 'Occupied' },
          { value: 'out_of_order', label: 'Out Of Order' },
          { value: 'maintenance', label: 'Maintenance' }
        ],
        housekeepingStatusOptions: [
          { value: 'clean', label: 'Clean' },
          { value: 'dirty', label: 'Dirty' },
          { value: 'inspected', label: 'Inspected' },
          { value: 'out_of_order', label: 'Out Of Order' }
        ]
      })

    } catch (error) {
      console.error('Error fetching houseview data:', error)
      return response.internalServerError({
        message: 'Error fetching houseview data'
      })
    }
  }

  /**
   * Détermine la section d'une chambre basée sur l'étage et le type
   */
 private getRoomSection(roomTypeName: string): string {
    if (!roomTypeName) {
      return 'Unknown'
    }
    return roomTypeName
  }

  /**
   * Convertit le statut d'occupation de la base vers le frontend
   */
  private getOccupancyStatus(dbStatus: string): string {
    switch (dbStatus?.toLowerCase()) {
      case 'available':
        return 'Available'
      case 'occupied':
        return 'Occupied'
      case 'out_of_order':
        return 'Out Of Order'
      case 'maintenance':
        return 'Maintenance'
      default:
        return 'Available'
    }
  }

  /**
   * Convertit le statut de ménage de la base vers le frontend
   */
  private getHousekeepingStatus(dbStatus: string): string {
    switch (dbStatus?.toLowerCase()) {
      case 'clean':
        return 'Clean'
      case 'dirty':
        return 'Dirty'
      case 'inspected':
        return 'Inspected'
      case 'out_of_order':
        return 'Out Of Order'
      default:
        return 'No Status'
    }
  }

  /**
   * Génère un tag pour la chambre (initiales du housekeeper ou autre)
   */
  private getRoomTag(room: Room): string {
    // Vous pouvez personnaliser cette logique selon vos besoins
    if (room.status === 'out_of_order') {
      return 'OOO'
    }
    if (room.housekeepingStatus === 'dirty') {
      return 'CLN'
    }
    return ''
  }

  /**
   * Détermine le type de statut pour la couleur
   */
  private getStatusType(housekeepingStatus: string, occupancyStatus: string): 'red' | 'green' | 'gray' | 'yellow' {
    if (occupancyStatus?.toLowerCase() === 'out_of_order') {
      return 'gray'
    }

    switch (housekeepingStatus?.toLowerCase()) {
      case 'clean':
      case 'inspected':
        return 'green'
      case 'dirty':
        return 'red'
      case 'out_of_order':
        return 'gray'
      default:
        return 'gray'
    }
  }

  /**
   * BulkUpdate
   */

  async bulkUpdate({ request, response }: HttpContext) {
  try {
    const {
      room_ids,
      operation,
      housekeeping_status,
      housekeeper_id,
      user_id
    } = request.only([
      'room_ids',
      'operation',
      'housekeeping_status',
      'housekeeper_id',
      'user_id'
    ])

    // Validation des données d'entrée
    if (!room_ids || !Array.isArray(room_ids) || room_ids.length === 0) {
      return response.badRequest({
        message: 'Room IDs are required and must be an array'
      })
    }

    if (!operation) {
      return response.badRequest({
        message: 'Operation is required'
      })
    }

    // Préparer les données de mise à jour
    const updateData: any = {
      last_modified_by: user_id,
      updated_at: DateTime.now()
    }

    // Traitement selon le type d'opération
    switch (operation) {
      case 'set_status':
        if (!housekeeping_status) {
          return response.badRequest({
            message: 'Housekeeping status is required for set_status operation'
          })
        }
        updateData.housekeeping_status = housekeeping_status
        break

      case 'assign_housekeeper':
        if (!housekeeper_id) {
          return response.badRequest({
            message: 'Housekeeper ID is required for assign_housekeeper operation'
          })
        }
        // Assumant qu'il y a un champ pour le housekeeper assigné
        updateData.assigned_housekeeper_id = housekeeper_id
        // Ou utilisez un autre champ comme 'tag' si c'est votre structure
        // updateData.tag = housekeeper_id
        break

      case 'clear_status':
        updateData.housekeeping_status = 'No Status'
        break

      case 'unassign_housekeeper':
        updateData.assigned_housekeeper_id = null
        // Ou updateData.tag = '' si vous utilisez le champ tag
        break

      default:
        return response.badRequest({
          message: 'Invalid operation. Supported operations: set_status, assign_housekeeper, clear_status, unassign_housekeeper'
        })
    }

    // Vérifier que les chambres existent
    const existingRooms = await Room.query()
      .whereIn('id', room_ids)
      .select('id')

    if (existingRooms.length !== room_ids.length) {
      return response.badRequest({
        message: 'Some room IDs do not exist'
      })
    }

    // Effectuer la mise à jour en lot
    const updatedCount = await Room.query()
      .whereIn('id', room_ids)
      .update(updateData)

    // Log de l'activité pour audit
    console.log(`Bulk update: ${operation} applied to ${updatedCount} rooms by user ${user_id}`, {
      room_ids,
      operation,
      updateData,
      timestamp: new Date().toISOString()
    })

    return response.ok({
      message: `Successfully updated ${updatedCount} rooms`,
      updated_count: updatedCount,
      operation: operation,
      affected_rooms: room_ids
    })

  } catch (error) {
    console.error('Error in bulk update:', error)

    // Log détaillé de l'erreur
    console.error('Bulk update error details:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    })

    return response.internalServerError({
      message: 'Error updating rooms. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
  }



}
