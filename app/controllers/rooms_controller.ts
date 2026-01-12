import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Room from '#models/room'
import RoomType from '#models/room_type'
import ReservationRoom from '#models/reservation_room'
import { createRoomValidator, updateRoomValidator } from '#validators/room'
import LoggerService from '#services/logger_service'
import RoomBlock from '#models/room_block'
import HouseKeeper from '#models/house_keeper'
import SupabaseService from '#services/supabase_service'
import CheckInCheckOutNotificationService from '#services/notification_action_service'

export default class RoomsController {
  private supabaseService: SupabaseService

  constructor() {
    this.supabaseService = new SupabaseService()
  }
  /**
   * Display a list of rooms
   */

  async index({ params, request, response }: HttpContext) {
    try {
      const hotelId = params.hotelId
      if (!hotelId) {
        return response.badRequest({
          message: 'hotelId is required in route params',
        })
      }
      const page = request.input('page', 1)
      const limit = request.input('limit', 100)
      const search = request.input('search')
      const roomTypeId = request.input('room_type_id')
      const floor = request.input('floor')
      const status = request.input('status')
      const housekeepingStatus = request.input('housekeeping_status')
      const maintenanceStatus = request.input('maintenance_status')
      const smokingAllowed = request.input('smoking_allowed')
      const petFriendly = request.input('pet_friendly')
      const accessible = request.input('accessible')

      const query = Room.query()

      query.where('hotel_id', hotelId)

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
        .orderBy('sort_key', 'asc')
        .orderBy('floor_number', 'asc')
        .orderBy('room_number', 'asc')
        .paginate(page, limit)

      return response.ok({
        message: 'Rooms retrieved successfully',
        data: rooms,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Failed to retrieve rooms',
        error: error.message,
      })
    }
  }

  /**
   * Create a new room
   */
  async store(ctx: HttpContext) {
    const { request, response, auth } = ctx
    try {
      const roomImages = request.files('roomImages', {
        size: '5mb',
        extnames: ['jpg', 'jpeg', 'png', 'webp']
      })

      const payload = await request.validateUsing(createRoomValidator)
      const { taxRateIds, ...roomData } = payload

      const uploadedImageUrls: string[] = []

      if (roomImages && roomImages.length > 0) {
        const imagesToUpload = roomImages.slice(0, 2)

        for (const image of imagesToUpload) {
          try {

            const result = await this.supabaseService.uploadFile(image, 'hotel', 'rooms')
            uploadedImageUrls.push(result.url)

          } catch (uploadError) {
            console.error(` Failed to upload ${image.clientName}:`, uploadError.message)
          }
        }
      }

      const room = await Room.create({
        ...roomData,
        images: uploadedImageUrls,
        createdBy: auth.user?.id,
      })

      // Attach tax rates if provided
      if (taxRateIds && taxRateIds.length > 0) {
        await room.related('taxRates').attach(taxRateIds)
      }

      await room.load('hotel')
      await room.load('roomType')
      await room.load('taxRates')

      await LoggerService.log({
        actorId: auth.user?.id || 0,
        action: 'CREATE',
        entityType: 'Room',
        entityId: room.id,
        hotelId: room.hotelId,
        description: `Room "${room.roomNumber}" created successfully`,
        changes: LoggerService.extractChanges({}, room.toJSON()),
        ctx,
      })

      return response.created({
        message: 'Room created successfully',
        data: room,
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to create room',
        error: error.message,
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
        data: room,
      })
    } catch (error) {
      return response.notFound({
        message: 'Room not found',
        error: error.message,
      })
    }
  }

  /**
   * Update a room
   */

  async update(ctx: HttpContext) {
    const { params, request, response, auth } = ctx
    try {
      const room = await Room.findOrFail(params.id)
      const oldData = room.toJSON()

      //  Récupérer les nouveaux fichiers uploadés
      const roomImages = request.files('roomImages', {
        size: '5mb',
        extnames: ['jpg', 'jpeg', 'png', 'webp']
      })


      const payload = await request.validateUsing(updateRoomValidator)
      const { taxRateIds, ...roomData } = payload

      //  Gérer le remplacement des images
      let updatedImageUrls = room.images || []

      if (roomImages && roomImages.length > 0) {
        // Supprimer les anciennes images de Supabase
        if (room.images && Array.isArray(room.images) && room.images.length > 0) {
          for (const oldImageUrl of room.images) {
            try {
              const filePath = this.supabaseService.extractFilePathFromUrl(oldImageUrl, 'hotel')
              await this.supabaseService.deleteFile(filePath, 'hotel')
            } catch (deleteError) {
              console.error(` Erreur suppression ancienne image:`, deleteError.message)
            }
          }
        }

        // Upload les nouvelles images
        updatedImageUrls = []
        const imagesToUpload = roomImages.slice(0, 2)

        for (const image of imagesToUpload) {
          try {
            const result = await this.supabaseService.uploadFile(image, 'hotel', 'rooms')
            updatedImageUrls.push(result.url)
          } catch (uploadError) {
            console.error(` Failed to upload ${image.clientName}:`, uploadError.message)
          }
        }
      }

      room.merge({
        ...roomData,
        images: updatedImageUrls,
        lastModifiedBy: auth.user?.id,
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

      const changes = LoggerService.extractChanges(oldData, payload)
      if (Object.keys(changes).length > 0) {
        await LoggerService.log({
          actorId: auth.user?.id || 0,
          action: 'UPDATE',
          entityType: 'Room',
          entityId: room.id,
          hotelId: room.hotelId,
          description: `Room "${room.roomNumber}" updated successfully`,
          changes: changes,
          ctx,
        })
      }

      return response.ok({
        message: 'Room updated successfully',
        data: room,
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to update room',
        error: error.message,
      })
    }
  }

  /**
   * Delete a room
   */
  async destroy(ctx: HttpContext) {
    const { params, response, auth } = ctx
    try {
      const room = await Room.findOrFail(params.id)

      // Check if there are any active reservations for this room
      const activeReservations = await room
        .related('reservationRooms')
        .query()
        .whereIn('status', ['confirmed', 'checked_in'])
        .count('* as total')

      if (activeReservations[0].$extras.total > 0) {
        return response.badRequest({
          message: 'Cannot delete room with active reservations',
        })
      }

      if (room.images && Array.isArray(room.images) && room.images.length > 0) {
        for (const imageUrl of room.images) {
          try {
            const filePath = this.supabaseService.extractFilePathFromUrl(imageUrl, 'hotel')
            await this.supabaseService.deleteFile(filePath, 'hotel')
          } catch (deleteError) {
            console.error(`Erreur lors de la suppression de l'image ${imageUrl}:`, deleteError.message)
          }
        }
      }

      await room.delete()

      await LoggerService.log({
        actorId: auth.user?.id || 0,
        action: 'DELETE',
        entityType: 'Room',
        entityId: room.id,
        hotelId: room.hotelId,
        description: `Room "${room.roomNumber}" deleted successfully`,
        changes: {},
        ctx,
      })

      return response.ok({
        message: 'Room deleted successfully',
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to delete room',
        error: error.message,
      })
    }
  }

  /**
   * Update maintenance status
   */
  async updateMaintenanceStatus({ params, request, response }: HttpContext) {
    try {
      const room = await Room.findOrFail(params.id)
      const { maintenanceNotes, nextMaintenanceDate } = request.only([
        'maintenanceNotes',
        'nextMaintenanceDate',
      ])

      if (maintenanceNotes) {
        room.maintenanceNotes = maintenanceNotes
      }
      if (nextMaintenanceDate) {
        room.nextMaintenanceDate = DateTime.fromJSDate(new Date(nextMaintenanceDate))
      }

      await room.save()

      return response.ok({
        message: 'Maintenance status updated successfully',
        data: room,
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to update maintenance status',
        error: error.message,
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
      const reservations = await room
        .related('reservationRooms')
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
          reservations: reservations.length,
        },
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to check room availability',
        error: error.message,
      })
    }
  }

  /**
   * Get available rooms by room type ID
   */
  // async getAvailableRoomsByRoomTypeId({ params, request, response }: HttpContext) {
  //   try {
  //     const roomTypeId = params.roomTypeId
  //     const { startDate, endDate } = request.only(['startDate', 'endDate'])

  //     // Validate room type exists
  //     const roomType = await RoomType.findOrFail(roomTypeId)

  //     // Get all rooms of this type
  //     const roomsQuery = Room.query()
  //       .where('room_type_id', roomTypeId)
  //       .where('status', 'available')
  //       .preload('roomType')

  //     const rooms = await roomsQuery

  //     // If date range is provided, filter out rooms with reservations
  //     let availableRooms = rooms
  //     if (startDate && endDate) {
  //       const availableRoomIds: any = []

  //       for (const room of rooms) {
  //         const reservations = await ReservationRoom.query()
  //           .where('room_id', room.id)
  //           .where('check_in_date', '<=', endDate)
  //           .where('check_out_date', '>=', startDate)
  //           .whereIn('status', ['confirmed', 'checked_in', 'reserved'])

  //         if (reservations.length === 0) {
  //           availableRoomIds.push(room.id)
  //         }
  //       }

  //       availableRooms = rooms.filter((room) => availableRoomIds.includes(room.id))
  //     }

  //     return response.ok({
  //       message: 'Available rooms retrieved successfully',
  //       data: {
  //         roomType: {
  //           id: roomType.id,
  //           name: roomType.name,
  //           description: roomType.description,
  //         },
  //         totalRooms: rooms.length,
  //         availableRooms: availableRooms.length,
  //         dateRange: startDate && endDate ? { startDate, endDate } : null,
  //         rooms: availableRooms.map((room) => ({
  //           id: room.id,
  //           roomNumber: room.roomNumber,
  //           roomName: room.roomName,
  //           floorNumber: room.floorNumber,
  //           status: room.status,
  //           housekeepingStatus: room.housekeepingStatus,
  //           maintenanceStatus: room.maintenanceStatus,
  //         })),
  //       },
  //     })
  //   } catch (error) {
  //     return response.badRequest({
  //       message: 'Failed to retrieve available rooms',
  //       error: error.message,
  //     })
  //   }
  // }

  async getAvailableRoomsByRoomTypeId({ params, request, response }: HttpContext) {
    try {
      const roomTypeId = params.roomTypeId
      const { startDate, endDate } = request.only(['startDate', 'endDate'])
      // Validate room type exists
      const roomType = await RoomType.findOrFail(roomTypeId)
      console.log('Room type found:', roomType)

      // Get all rooms of this type
      const rooms = await Room.query()
        .where('room_type_id', roomTypeId)
        //.where('status', 'available')
        .preload('roomType')
        .preload('taxRates')
        .orderBy('sort_key', 'asc')
      console.log(
        'All rooms of this type:',
        rooms.map((r) => r.id)
      )

      // Si date fournie, créer objet DateTime Luxon pour comparaison
      const date = startDate ? DateTime.fromISO(startDate) : DateTime.now()
      console.log('Target date:', date.toISO())

      // Récupérer les blocks pour ce type de chambre à la date cible
      const blockedRoomsResult = await RoomBlock.query()
        .where('room_type_id', roomTypeId)
        // .whereNot('status', 'completed')
        .where(function (query) {
          query.where('block_from_date', '<', endDate).where('block_to_date', '>', startDate)
        })
        .select('room_id')

      console.log('Blocked rooms (not completed):', blockedRoomsResult)

      const blockedRoomIds = blockedRoomsResult.map((b) => b.roomId)
      console.log('Blocked room IDs:', blockedRoomIds)

      // Filter rooms based on blocked rooms
      let availableRooms = rooms.filter((room) => !blockedRoomIds.includes(room.id))
      console.log(
        'Rooms after filtering blocked:',
        availableRooms.map((r) => r.id)
      )

      // Filter rooms based on reservations if date range provided
      if (startDate && endDate) {
        // Batch query overlapping reservations for all rooms of this type
        const roomIds = availableRooms.map((r) => r.id)
        let occupiedRoomIds = new Set<number>()

        if (roomIds.length > 0) {
          const overlappingReservations = await ReservationRoom.query()
            .whereIn('room_id', roomIds)
            .where('check_in_date', '<', endDate)
            .where('check_out_date', '>', startDate)
            .whereIn('status', ['reserved', 'checked_in', 'day_use'])
            .select('room_id')

          occupiedRoomIds = new Set<number>(
            (overlappingReservations.map((rr) => rr.roomId) ?? []).filter(
              (id): id is number => typeof id === 'number'
            )
          )
        }

        availableRooms = availableRooms.filter((room) => !occupiedRoomIds.has(room.id))
        console.log('Rooms after filtering reservations:', availableRooms.map((r) => r.id))
      }

      return response.ok({
        message: 'Available rooms retrieved successfully',
        data: {
          roomType: {
            id: roomType.id,
            name: roomType.roomTypeName,
          },
          totalRooms: rooms.length,
          availableRooms: availableRooms.length,
          dateRange: startDate && endDate ? { startDate, endDate } : null,
          rooms: availableRooms.map((room) => ({
            id: room.id,
            roomNumber: room.roomNumber,
            floorNumber: room.floorNumber,
            status: room.status,
            housekeepingStatus: room.housekeepingStatus,
            taxRates: room.taxRates?.map((tax) => ({
              id: tax.taxRateId,
              name: tax.taxName,
              postingType: tax.postingType,
              amount: tax.amount,
              percentage: tax.percentage,
            })) || [],
          })),
        },
      })
    } catch (error) {
      console.error('Error fetching available rooms:', error)
      return response.badRequest({
        message: 'Failed to retrieve available rooms',
        error: error.message,
      })
    }
  }

  async getFrontOfficeBookingData({ params, request, response }: HttpContext) {
    try {
      const hotelId = params.hotelId
      const { startDate, endDate } = request.only(['startDate', 'endDate']) // Assuming ISO format
      //console.log('enter here', startDate, endDate)
      // **Validation and Date Preparation**
      if (!startDate || !endDate) {
        return response.badRequest({
          message: 'Both startDate and endDate are required.',
        })
      }

      const checkInDate = DateTime.fromISO(startDate)
      const checkOutDate = DateTime.fromISO(endDate)

      if (!checkInDate.isValid || !checkOutDate.isValid) {
        return response.badRequest({
          message: 'Invalid date format. Use ISO format (YYYY-MM-DD).',
        })
      }

      // Ensure check-out is after check-in (basic logic guard)
      if (checkOutDate < checkInDate) {
        return response.badRequest({
          message: 'Check-out date must be after check-in date.',
        })
      }

      const checkInISO = checkInDate.toISODate()!
      const checkOutISO = checkOutDate.toISODate()!

      // **1. Get All Room Types (to get IDs)**
      const roomTypesResult = await RoomType.query()
        .where('hotel_id', hotelId)
        .select(['id'])

      const roomTypeIds = roomTypesResult.map((e) => e.id)
      if (roomTypeIds.length === 0) {
        return response.ok({ message: 'No room types found for this hotel.', data: [] })
      }

      // **2. Identify Blocked Rooms (Standard Overlap Logic)**
      // Conflict if (Block_Start <= Request_End) AND (Block_End >= Request_Start)
      const blockedRoomsResult = await RoomBlock.query()
        .whereIn('room_type_id', roomTypeIds)
        .where('block_from_date', '<=', checkOutISO)
        .where('block_to_date', '>=', checkInISO)
        .select('room_id')
      //  console.log('room bloc', blockedRoomsResult)
      const blockedRoomIds = blockedRoomsResult.map((b) => b.roomId)

      // **3. Identify Reserved Rooms (Standard Overlap Logic)**
      // Conflict if (Reservation_Start < Request_End) AND (Reservation_End > Request_Start)
      const reservedRoomsResult = await ReservationRoom.query()
        .whereIn('status', ['confirmed', 'checked_in', 'reserved'])
        .where('check_in_date', '<', checkOutISO)
        .where('check_out_date', '>', checkInISO)
        .whereNotNull('roomId')
        .select(['room_id'])
      // console.log('room res', reservedRoomsResult)
      const reservedRoomIds = reservedRoomsResult.map((r) => r.roomId)

      // **4. Combine Exclusions**
      // Using a Set ensures uniqueness (though array spread is often clearer/faster for smaller lists)
      const unavailableRoomIds = [...reservedRoomIds, ...blockedRoomIds]

      //console.log('unavailableRoomIds', unavailableRoomIds)

      // **5. Final Fetch with SQL Exclusion (Major Optimization)**
      const finalRoomsData = await RoomType.query()
        .where('hotel_id', hotelId)
        .preload('roomRates', (queryRate) => {
          queryRate.select(['id', 'room_type_id', 'rate_type_id'])
          queryRate.preload('rateType', (queryRateType) => {
            queryRateType.select(['id', 'rate_type_name'])
          })
        })
        .preload('rooms', (queryRoom) => {
          queryRoom.select(['id', 'room_number', 'status', 'housekeeping_status'])
          // Filter out UNVAILABLE rooms in the database query
          if (unavailableRoomIds.length > 0) {
            queryRoom.whereNotIn('id', unavailableRoomIds)
          }
        })
        .select(['id', 'room_type_name', 'base_adult', 'base_child', 'max_adult', 'max_child', 'sort_order'])
        .orderBy('sort_order', 'asc')

      // No need for post-fetch filtering in JavaScript anymore!
      //console.log('finalRoomsData', finalRoomsData);
      return response.ok({
        message: 'Available rooms retrieved successfully',
        data: finalRoomsData, // This now contains only available rooms within each roomType.rooms array
      })
    } catch (error) {
      // Log the full error for debugging, but only send a generic message to the client
      console.error('Error fetching available rooms:', error)
      return response.internalServerError({
        message: 'Failed to retrieve available rooms',
      })
    }
  }

  /**
   * get room by room type
   */
  async getRoomByRoomTypeId({ params, request, response }: HttpContext) {
    try {
      const roomTypeId = params.roomTypeId
      // Validate room type exists
      const roomType = await RoomType.findOrFail(roomTypeId)
      console.log('Room type found:', roomType)

      // Get all rooms of this type
      const rooms = await Room.query()
        .where('room_type_id', roomTypeId)
        .where('status', 'occupied')
        .preload('roomType')
        .orderBy('sort_key', 'asc')
      console.log(
        'All rooms of this type:',
        rooms.map((r) => r.id)
      )


      return response.ok({
        message: 'Available rooms retrieved successfully',
        data: {
          roomType: {
            id: roomType.id,
            name: roomType.roomTypeName,
          },
          totalRooms: rooms.length,
          rooms: rooms
        },
      })
    } catch (error) {
      console.error('Error fetching available rooms:', error)
      return response.badRequest({
        message: 'Failed to retrieve available rooms',
        error: error.message,
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
      const outOfOrderRooms = await query
        .clone()
        .where('status', 'out_of_order')
        .count('* as total')
      const maintenanceRooms = await query
        .clone()
        .where('status', 'maintenance')
        .count('* as total')
      const dirtyRooms = await query
        .clone()
        .where('housekeeping_status', 'dirty')
        .count('* as total')
      const cleanRooms = await query
        .clone()
        .where('housekeeping_status', 'clean')
        .count('* as total')
      const inspectedRooms = await query
        .clone()
        .where('housekeeping_status', 'inspected')
        .count('* as total')

      const stats = {
        totalRooms: totalRooms[0].$extras.total,
        availableRooms: availableRooms[0].$extras.total,
        occupiedRooms: occupiedRooms[0].$extras.total,
        outOfOrderRooms: outOfOrderRooms[0].$extras.total,
        maintenanceRooms: maintenanceRooms[0].$extras.total,
        dirtyRooms: dirtyRooms[0].$extras.total,
        cleanRooms: cleanRooms[0].$extras.total,
        inspectedRooms: inspectedRooms[0].$extras.total,
        occupancyRate:
          totalRooms[0].$extras.total > 0
            ? ((occupiedRooms[0].$extras.total / totalRooms[0].$extras.total) * 100).toFixed(2)
            : 0,
      }

      return response.ok({
        message: 'Room statistics retrieved successfully',
        data: stats,
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve statistics',
        error: error.message,
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
        .orderBy('sort_key', 'asc')
        .preload('roomType')
        .preload('blocks')
        .preload('assignedHousekeeper', (query) => {
          query.select('id', 'name', 'phone')
        })
        .preload('reservationRooms', (query) => {
          query.preload('reservation', (reservationQuery) => {
            reservationQuery
              // 1. AJOUT: Inclure 'checkinDate' dans la sélection
              .select(['id', 'status', 'departDate', 'guestId', 'checkInDate'])
              .preload('guest', (guestQuery) => {
                guestQuery.select(['id', 'title', 'firstName', 'lastName'])
              })
          })
        })

      const detailedRooms = rooms.map((room) => {
        const reservations = room.reservationRooms

        const reservationData = reservations.map((rr) => ({
          reservation: rr.reservation,
          // guest: rr.reservation?.guest ?? null,
          guest: rr.reservation?.guest ? rr.reservation.guest.serialize() : null,
          status: rr.reservation?.status ?? null,
        }))

        const checkedInReservation = reservationData.find(
          (r) => r.reservation?.status === 'checked-in' || r.reservation?.status === 'checked_in'
        )

        // const guestName = checkedInReservation?.guest
        //   ? `${checkedInReservation.guest.firstName || ''} ${checkedInReservation.guest.lastName || ''}`.trim() ||
        //     null
        //   : null
        const guestName = checkedInReservation?.guest
          ? checkedInReservation.guest.displayName
          : null


        const checkInTime = checkedInReservation?.reservation?.checkInDate
          ? typeof checkedInReservation.reservation.checkInDate === 'string'
            ? checkedInReservation.reservation.checkInDate
            : checkedInReservation.reservation.checkInDate.toString()
          : null

        const reservationsWithDepart = reservationData
          .filter((r) => r.reservation?.departDate != null)
          .sort((a, b) => {
            const dateA = DateTime.fromISO(a.reservation?.departDate?.toString() || '')
            const dateB = DateTime.fromISO(b.reservation?.departDate?.toString() || '')
            // Tri descendant pour avoir la date de départ la plus récente en premier
            return dateB.toMillis() - dateA.toMillis()
          })

        const latestDeparture = reservationsWithDepart[0]

        const nextAvailable = latestDeparture?.reservation?.departDate
          ? typeof latestDeparture.reservation.departDate === 'string'
            ? latestDeparture.reservation.departDate
            : latestDeparture.reservation.departDate.toString()
          : null

        const checkOutTime = nextAvailable

        return {
          ...room.serialize(),
          roomType: room.roomType?.serialize(),
          reservations: reservationData,
          guestName,
          nextAvailable,
          checkOutTime,


          checkInTime,
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
      const reservations = await ReservationRoom.query()
        .whereHas('room', (query) => {
          query.where('hotel_id', hotelId)
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
          guest: guest
            ? guest.displayName
            : 'Inconnu',
          email: guest?.email ?? user?.email ?? '',
          room: room?.roomNumber ?? 'Non spécifié',
          checkin: res.checkInDate?.toFormat('dd/MM/yyyy') ?? '',
          checkout: res.checkOutDate?.toFormat('dd/MM/yyyy') ?? '',
          status: res.status ?? '',
          amount: res.totalAmount ?? 0,
        }
      })

      return response.ok(formatted)
    } catch (error) {
      console.error(error)
      return response.internalServerError({
        message: 'Erreur lors de la récupération des réservations.',
      })
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
        error: error.message,
      })
    }
  }

  /**
   * Get housekeeping status by hotel Id - WITH BUSINESS LOGIC
   */
  async getHouseStatus({ params, request, response }: HttpContext) {
    try {
      const { hotelId } = params
      const { room_type_filter } = request.qs()

      // Query de base avec les relations
      let query = Room.query()
        .where('hotel_id', hotelId)
        .where('is_deleted', false)
        .preload('roomType')
        .preload('bedType')
        .preload('blocks')
        .preload('workOrders')
        .preload('assignedHousekeeper', (housekeeperQuery) => {
          housekeeperQuery.select('id', 'name', 'phone')
        })
        .preload('reservationRooms', (reservationQuery) => {
          reservationQuery
            .where('status', 'checked_in') // ← uniquement les occupants présents
            .select('id', 'adults', 'children')
        })


        .orderBy('floor_number', 'asc')
        .orderBy('room_number', 'asc')

      // Filtrage par type de chambre si spécifié
      if (room_type_filter) {
        query = query.where('room_type_id', room_type_filter)
      }

      const rooms = await query

      // Transformation des données avec logique métier
      const transformedRooms = rooms.map((room) => {
        const actualHousekeepingStatus = this.getHousekeepingStatusFromRoomStatus(
          room.status,
          room.housekeepingStatus
        )
        const occupants = room.reservationRooms?.reduce((total, rr) => {
          return total + (rr.adults || 0) + (rr.children || 0);
        }, 0) || 0;
        return {
          id: room.id.toString(),
          name: room.roomNumber,
          beds: room.maxOccupancy || 0,
          occupants,
          isChecked: false,
          section: this.getRoomSection(room.roomType?.roomTypeName || ''),
          blocks: room.blocks,
          workOrders: room.workOrders,
          roomType: room.roomType?.roomTypeName || 'Unknown',
          housekeepersRemarks: room.housekeepingRemarks || '',
          roomTypeId: room.roomType?.id || 0,
          status: room.status,
          housekeepingStatus: actualHousekeepingStatus,
          tag: this.getRoomTag(room),
          statusType: this.getStatusType(actualHousekeepingStatus, room.status),
          assignedHousekeeperId: room.assignedHousekeeper ? room.assignedHousekeeper.id : null,
          assignedHousekeeper: room.assignedHousekeeper
            ? `${room.assignedHousekeeper.name}`
            : '',
        }
      })

      // Récupération des types de chambres pour les filtres
      const roomTypes = await RoomType.query()
        .where('hotel_id', hotelId)
        .where('is_deleted', false)
        .select('id', 'roomTypeName')

      // Récupération des housekeepers
      const housekeepers = await HouseKeeper.query()
        .where('hotel_id', hotelId)
        .select('id', 'name', 'phone')

      return response.ok({
        rooms: transformedRooms,
        roomTypes: roomTypes.map((rt) => ({
          value: rt.id,
          label: rt.roomTypeName,
        })),
        housekeepers: housekeepers.map((hk) => ({
          value: hk.id,
          label: `${hk.name}`,
        })),
        statusOptions: [
          { value: 'available', label: 'Available' },
          { value: 'occupied', label: 'Occupied' },
          { value: 'out_of_order', label: 'Out Of Order' },
          { value: 'maintenance', label: 'Maintenance' },
        ],
        housekeepingStatusOptions: [
          { value: 'clean', label: 'Clean' },
          { value: 'dirty', label: 'Dirty' },
          { value: 'out_of_order', label: 'Out Of Order' },
        ],
      })
    } catch (error) {
      console.error('Error fetching houseview data:', error)
      return response.internalServerError({
        message: 'Error fetching houseview data',
      })
    }
  }

  /**
   * Bulk Update - WITH BUSINESS LOGIC RESTRICTIONS
   */

async bulkUpdate({ request, response, auth }: HttpContext) {
  try {
    const {
      room_ids,
      operation,
      housekeeping_status,
      housekeeper_id,
      user_id,
    } = request.only([
      'room_ids',
      'operation',
      'housekeeping_status',
      'housekeeper_id',
      'user_id',
    ])

    //  Validations de base
    if (!room_ids || !Array.isArray(room_ids) || room_ids.length === 0) {
      return response.badRequest({ message: 'Room IDs are required and must be an array' })
    }
    if (!operation) {
      return response.badRequest({ message: 'Operation is required' })
    }

    //  Récupérer les chambres (une seule fois)
    const rooms = await Room.query().whereIn('id', room_ids)
    if (rooms.length === 0) {
      return response.badRequest({ message: 'No rooms found for the provided IDs' })
    }

    //  Préparer les données de mise à jour SQL
    const updateData: any = {
      last_modified_by: user_id || auth.user?.id,
      updated_at: DateTime.now(),
    }

    switch (operation) {
      case 'set_status':
        if (housekeeping_status) {
          updateData.housekeeping_status = housekeeping_status
        }
        break
      case 'assign_housekeeper':
        updateData.assigned_housekeeper_id = housekeeper_id || null
        break
      case 'clear_status':
        updateData.housekeeping_status = null
        break
      case 'clear_remark':
        updateData.housekeeping_remarks = null
        break
      case 'unassign_housekeeper':
        updateData.assigned_housekeeper_id = null
        break
    }

    //  Exécuter la mise à jour massive en SQL
    const updatedCount = await Room.query().whereIn('id', room_ids).update(updateData)


    const actorId = auth.user?.id || 0
    const finalNewStatus = updateData.housekeeping_status
    const finalHousekeeperId = housekeeper_id || 0

    setImmediate(async () => {
      console.log(`⏱️ Background Task: Sending notifications for ${rooms.length} rooms...`)

      const HousekeepingNotifService = CheckInCheckOutNotificationService

      // On traite toutes les notifications en parallèle pour gagner encore plus de temps
      const notificationPromises = rooms.map(async (room) => {
        try {
          const oldStatus: any = room.housekeepingStatus
          const newStatus = finalNewStatus ?? oldStatus

          // Notifications spécifiques au type de statut
          if (newStatus === 'clean') {
            await HousekeepingNotifService.notifyRoomReady(room.id, finalHousekeeperId, actorId)
          } else if (newStatus === 'dirty') {
            await HousekeepingNotifService.notifyRoomDirty(room.id, actorId, 'normal')
          } else if (newStatus === 'inspected') {
            await HousekeepingNotifService.notifyRoomInspected(room.id, actorId, true)
          } else if (newStatus === 'out_of_order') {
            await HousekeepingNotifService.notifyRoomBlocked(room.id, actorId, 'Maintenance requise')
          }

          // Notification de changement de statut global
          if (oldStatus !== newStatus) {
            await HousekeepingNotifService.notifyStatusChange(room.id, oldStatus, newStatus, actorId)
          }
        } catch (err) {
          console.error(` Background Notif Error for Room ${room.id}:`, err.message)
        }
      })

      // On attend que toutes les promesses soient terminées (Settled = succès ou échec)
      await Promise.allSettled(notificationPromises)

    })

    // Réponse immédiate au client
    return response.ok({
      message: `Successfully updated ${updatedCount} rooms`,
      updated_count: updatedCount,
      operation,
      affected_rooms: room_ids,
    })

  } catch (error) {
    console.error('❌ Error in bulk update:', error)
    return response.internalServerError({
      message: 'Error updating rooms. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    })
  }
}

  /**
   * Update room status - WITH BUSINESS LOGIC
   */
  async updateStatus({ params, request, response }: HttpContext) {
    try {
      const room = await Room.findOrFail(params.id)
      const { status } = request.only(['status'])

      room.status = status

      // Apply business logic for housekeeping status
      room.housekeepingStatus = this.getHousekeepingStatusFromRoomStatus(
        status,
        room.housekeepingStatus
      )

      await room.save()

      return response.ok({
        message: 'Room status updated successfully',
        data: room,
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to update room status',
        error: error.message,
      })
    }
  }

  /**
   * Update housekeeping status - WITH RESTRICTIONS
   */


  public async updateHousekeepingStatus({ params, request, response,auth }: HttpContext) {
    try {
      const room = await Room.findOrFail(params.id)

      const body = request.all()

      const housekeepingStatus = body.housekeepingStatus || body.data?.housekeepingStatus
      const remarkInfo = body.data?.data ? body.data.data : body.data
      const data = body.data
      const removeRemarkId = body.removeRemarkId

      console.log('data received for updateHousekeepingStatus:', {
        housekeepingStatus,
        data,
        removeRemarkId,
      })

      //  Vérification business rules pour le housekeepingStatus
      if (housekeepingStatus) {
        room.housekeepingStatus = housekeepingStatus
      }

      //  Initialiser le tableau des remarques si nécessaire
      let currentRemarks: any[] = Array.isArray(room.housekeepingRemarks)
        ? room.housekeepingRemarks
        : []

      //  Supprimer une remarque si removeRemarkId est fourni
      if (removeRemarkId) {
        currentRemarks = currentRemarks.filter((r) => r.id !== removeRemarkId)
      }

      //Ajouter une nouvelle remarque
      if (remarkInfo && (remarkInfo.remark || remarkInfo.fdRemark)) {
      const newRemark = {
        id: Date.now().toString(),
        remark: remarkInfo.remark,
        fdRemark: remarkInfo.fdRemark,
        status: remarkInfo.status || housekeepingStatus,
        housekeeperId: remarkInfo.housekeeper,
        createdAt: new Date().toISOString(),
      }

      currentRemarks.push(newRemark)
      console.log('New Clean Remark pushed:', newRemark)

      // Mettre à jour le housekeeper assigné
      if (remarkInfo.housekeeper) {
        room.assignedHousekeeperId = remarkInfo.housekeeper
      }
    }

    room.housekeepingRemarks = currentRemarks
    await room.save()


      //notifications
      setImmediate(async () => {
        try {
          await CheckInCheckOutNotificationService.notifyIssueDetected(
            room.id,
            auth.user?.id!,
            remarkInfo?.remark || 'Nouvelle remarque détectée'
          )
        } catch (err) {
          console.error("Erreur task de fond:", err.message)
        }
      })

      return response.ok({
        message: 'Housekeeping status updated successfully',
        data: room,
      })
    } catch (error) {
      console.error(' Error in updateHousekeepingStatus:', error)
      return response.badRequest({
        message: 'Failed to update housekeeping status',
        error: error.message,
      })
    }
  }


  /**
   * PRIVATE HELPER METHODS - BUSINESS LOGIC
   */

  /**
   * Détermine le statut de ménage basé sur le statut de la chambre
   */
  private getHousekeepingStatusFromRoomStatus(
    roomStatus: string,
    currentHousekeepingStatus: string
  ): string {
    switch (roomStatus?.toLowerCase()) {
      case 'occupied':
        // Si la chambre est occupée, on garde son statut ménage (dirty/clean), sinon "Dirty" par défaut
        return currentHousekeepingStatus || 'No Status'

      case 'available':
        // Si disponible, on garde son statut ménage, sinon "Dirty"
        return currentHousekeepingStatus || 'No Status'

      case 'out_of_order':
      case 'maintenance':
        return 'Out Of Order'

      default:
        return currentHousekeepingStatus || 'No Status'
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
   * Génère un tag pour la chambre (initiales du housekeeper ou autre)
   */
  private getRoomTag(room: any): string {
    if (room.assignedHousekeeper) {
      const firstName = room.assignedHousekeeper.firstName || ''
      const lastName = room.assignedHousekeeper.lastName || ''
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
    }

    if (room.status === 'out_of_order') {
      return ''
    }

    if (room.housekeepingStatus === 'dirty') {
      return ''
    }

    return ''
  }

  /**
   * Détermine le type de statut pour la couleur
   */
  private getStatusType(
    housekeepingStatus: string,
    occupancyStatus: string
  ): 'red' | 'green' | 'gray' | 'orange' {
    if (occupancyStatus?.toLowerCase() === 'occupied') {
      return 'red'
    }

    if (occupancyStatus?.toLowerCase() === 'out_of_order') {
      return 'gray'
    }

    switch (housekeepingStatus?.toLowerCase()) {
      case 'clean':
        return 'green'
      case 'dirty':
        return 'orange'
      case 'out_of_order':
        return 'gray'
      default:
        return 'gray'
    }
  }
}
