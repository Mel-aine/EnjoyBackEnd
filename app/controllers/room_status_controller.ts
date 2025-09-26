import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Hotel from '#models/hotel'
import Room from '#models/room'
import RoomType from '#models/room_type'
import CleaningStatus from '#models/cleaning_status'
import { createRoomStatusReportValidator } from '#validators/room_status_report'
import LoggerService from '#services/logger_service'

export default class RoomStatusReportsController {
  /**
   * Generate Room Status Report
   * Input: date, hotelId
   * Output: Toutes les chambres d'un hôtel organisées par type avec état matin/soir et observations
   */
  async generateRoomsByStatus({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createRoomStatusReportValidator)
      const { date, hotelId } = payload

      // Valider et parser la date
      const reportDate = DateTime.fromISO(date)

      if (!reportDate.isValid) {
        throw new Error('La date fournie est invalide')
      }

      // Get hotel details
      const hotel = await Hotel.findOrFail(hotelId)

      // Get all room types for this hotel with all their rooms
      const roomTypes = await RoomType.query()
        .where('hotel_id', hotelId)
        .where('is_deleted', false)
        .preload('rooms', (roomQuery) => {
          roomQuery.where('isDeleted', false)
            .preload('assignedHousekeeper')
            .orderBy('roomNumber', 'asc')
        })
        .orderBy('room_type_name', 'asc')

      // Get all cleaning statuses for the specific date for this hotel
      const cleaningStatuses = await CleaningStatus.query()
        .whereHas('room', (roomQuery) => {
          roomQuery.where('hotelId', hotelId)
        })
        .where('statusDate', reportDate.toSQLDate())

      // Create a map of cleaning statuses for quick lookup
      const cleaningStatusMap = new Map()
      cleaningStatuses.forEach(status => {
        cleaningStatusMap.set(status.roomId, status)
      })

      // Process room data by type
      const roomsByType = roomTypes.map(roomType => {
        const roomsData = roomType.rooms.map(room => {
          // Get cleaning status for this room on the specified date
          const cleaningStatus = cleaningStatusMap.get(room.id)
          
          // Extract housekeeping remarks for the specific date
          const housekeepingRemarks = room.housekeepingRemarks || []
          const todayRemarks = housekeepingRemarks
            .filter(remark => {
              const remarkDate = DateTime.fromJSDate(new Date(remark.date))
              return remarkDate.hasSame(reportDate, 'day')
            })
            .map(remark => remark.remark)
            .join('; ')

          // Combine observations from multiple sources
          const observations = [
            todayRemarks,
            cleaningStatus?.notes,
            room.maintenanceNotes
          ].filter(Boolean).join(' | ')

          return {
            roomId: room.id,
            roomNumber: room.roomNumber,
            floor: room.floorNumber || room.floor || null,
            etatMatin: cleaningStatus?.morningStatus || room.housekeepingStatus || 'Non défini',
            etatSoir: cleaningStatus?.eveningStatus || room.housekeepingStatus || 'Non défini',
            observations: observations || 'Aucune observation',
            assignedHousekeeper: room.assignedHousekeeper ? 
              `${room.assignedHousekeeper.firstName} ${room.assignedHousekeeper.lastName}` : 
              'Non assigné',
            currentStatus: room.status,
            lastCleaned: cleaningStatus?.updatedAt?.toFormat('HH:mm') || null,
            maintenanceRequired: room.status === 'out_of_order' || !!room.outOfOrderReason
          }
        })

        return {
          roomTypeId: roomType.id,
          roomTypeName: roomType.roomTypeName,
          shortCode: roomType.shortCode,
          totalRooms: roomsData.length,
          rooms: roomsData
        }
      })

      // Calculate summary statistics
      const totalRooms = roomsByType.reduce((sum, type) => sum + type.totalRooms, 0)
      const totalWithMorningStatus = roomsByType.reduce((sum, type) => 
        sum + type.rooms.filter(room => room.etatMatin !== 'Non défini').length, 0
      )
      const totalWithEveningStatus = roomsByType.reduce((sum, type) => 
        sum + type.rooms.filter(room => room.etatSoir !== 'Non défini').length, 0
      )
      const totalWithObservations = roomsByType.reduce((sum, type) => 
        sum + type.rooms.filter(room => room.observations !== 'Aucune observation').length, 0
      )

      // Prepare response data
      const responseData = {
        hotelDetails: {
          hotelId: hotel.id,
          hotelName: hotel.hotelName,
          address: hotel.address,
          email: hotel.email
        },
        reportDate: reportDate.toFormat('yyyy-MM-dd'),
        dateFormatted: reportDate.toFormat('dd/MM/yyyy'),
        roomsByType,
        summary: {
          totalRoomTypes: roomsByType.length,
          totalRooms,
          totalWithMorningStatus,
          totalWithEveningStatus, 
          totalWithObservations,
          completionRate: {
            morning: totalRooms > 0 ? ((totalWithMorningStatus / totalRooms) * 100).toFixed(1) : 0,
            evening: totalRooms > 0 ? ((totalWithEveningStatus / totalRooms) * 100).toFixed(1) : 0,
            observations: totalRooms > 0 ? ((totalWithObservations / totalRooms) * 100).toFixed(1) : 0
          }
        }
      }

      return response.ok({
        success: true,
        message: 'Rapport des statuts des chambres généré avec succès',
        data: responseData,
        filters: {
          date,
          hotelId
        },
        generatedAt: DateTime.now().toISO(),
        generatedBy: auth.user?.firstName + ' ' + auth.user?.lastName
      })

    } catch (error) {
      LoggerService.error('Error generating room status report', {
        error: error.message,
        stack: error.stack,
        userId: auth.user?.id,
        hotelId: request.body().hotelId
      })

      return response.badRequest({
        success: false,
        message: 'Échec de la génération du rapport des statuts des chambres',
        error: error.message
      })
    }
  }

  /**
   * Get detailed room status for a specific room and date
   */
  async getRoomDetailedStatus({ request, response, params }: HttpContext) {
    try {
      const { roomId } = params
      const { date, hotelId } = request.qs()

      const reportDate = DateTime.fromISO(date)
      if (!reportDate.isValid) {
        throw new Error('La date fournie est invalide')
      }

      const room = await Room.findOrFail(roomId)
      await room.load('roomType')
      await room.load('assignedHousekeeper')
      
      // Verify room belongs to the correct hotel
      if (hotelId && room.hotelId !== parseInt(hotelId)) {
        return response.forbidden({
          success: false,
          message: 'La chambre n\'appartient pas à l\'hôtel spécifié'
        })
      }

      // Get cleaning status for the specific date
      const cleaningStatus = await CleaningStatus.query()
        .where('roomId', roomId)
        .where('statusDate', reportDate.toSQLDate())
        .first()

      // Get housekeeping remarks for the specific date
      const housekeepingRemarks = room.housekeepingRemarks || []
      const dayRemarks = housekeepingRemarks.filter(remark => {
        const remarkDate = DateTime.fromJSDate(new Date(remark.date))
        return remarkDate.hasSame(reportDate, 'day')
      })

      return response.ok({
        success: true,
        data: {
          room: {
            id: room.id,
            roomNumber: room.roomNumber,
            floor: room.floorNumber || room.floor,
            roomType: room.roomType?.roomTypeName,
            roomTypeCode: room.roomType?.shortCode
          },
          date: reportDate.toFormat('yyyy-MM-dd'),
          dateFormatted: reportDate.toFormat('dd/MM/yyyy'),
          status: {
            etatMatin: cleaningStatus?.morningStatus || room.housekeepingStatus || 'Non défini',
            etatSoir: cleaningStatus?.eveningStatus || room.housekeepingStatus || 'Non défini',
            currentStatus: room.status,
            housekeepingStatus: room.housekeepingStatus
          },
          observations: {
            cleaningNotes: cleaningStatus?.notes || null,
            housekeepingRemarks: dayRemarks,
            maintenanceNotes: room.maintenanceNotes || null
          },
          assignedHousekeeper: room.assignedHousekeeper ? {
            id: room.assignedHousekeeper.id,
            name: `${room.assignedHousekeeper.firstName} ${room.assignedHousekeeper.lastName}`
          } : null,
          lastUpdated: cleaningStatus?.updatedAt?.toFormat('dd/MM/yyyy HH:mm') || null
        }
      })

    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Échec de récupération du détail de la chambre',
        error: error.message
      })
    }
  }

  /**
   * Update room status (morning, evening, observations)
   */
  async updateRoomStatus({ request, response, params, auth }: HttpContext) {
    try {
      const { roomId } = params
      const { 
        etatMatin, 
        etatSoir, 
        observations, 
        statusDate,
        hotelId
      } = request.body()

      const room = await Room.findOrFail(roomId)
      
      // Verify room belongs to the correct hotel
      if (hotelId && room.hotelId !== hotelId) {
        return response.forbidden({
          success: false,
          message: 'La chambre n\'appartient pas à l\'hôtel spécifié'
        })
      }

      const reportDate = DateTime.fromISO(statusDate || DateTime.now().toISODate())

      // Find or create cleaning status record
      let cleaningStatus = await CleaningStatus.query()
        .where('roomId', roomId)
        .where('statusDate', reportDate.toSQLDate())
        .first()

      if (!cleaningStatus) {
        cleaningStatus = await CleaningStatus.create({
          roomId: room.id,
          statusDate: reportDate.toSQLDate(),
          morningStatus: etatMatin || room.housekeepingStatus,
          eveningStatus: etatSoir || room.housekeepingStatus,
          notes: observations,
          cleanedBy: auth.user?.id
        })
      } else {
        // Update existing record
        if (etatMatin) cleaningStatus.morningStatus = etatMatin
        if (etatSoir) cleaningStatus.eveningStatus = etatSoir
        if (observations) cleaningStatus.notes = observations
        cleaningStatus.cleanedBy = auth.user?.id
        await cleaningStatus.save()
      }

      // Add observation to housekeeping remarks if provided
      if (observations) {
        const existingRemarks = room.housekeepingRemarks || []
        const newRemark = {
          date: reportDate.toISO(),
          remark: observations,
          addedBy: auth.user?.firstName + ' ' + auth.user?.lastName,
          priority: 'normal'
        }
        
        room.housekeepingRemarks = [...existingRemarks, newRemark]
        room.lastModifiedBy = auth.user?.id
        await room.save()
      }

      return response.ok({
        success: true,
        message: 'Statut de la chambre mis à jour avec succès',
        data: {
          roomId: room.id,
          roomNumber: room.roomNumber,
          date: reportDate.toFormat('yyyy-MM-dd'),
          etatMatin: cleaningStatus.morningStatus,
          etatSoir: cleaningStatus.eveningStatus,
          observations: cleaningStatus.notes,
          updatedAt: cleaningStatus.updatedAt.toISO()
        }
      })

    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Échec de mise à jour du statut de la chambre',
        error: error.message
      })
    }
  }
}