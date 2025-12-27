import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import { ReservationStatus, TransactionCategory, TransactionStatus, TransactionType } from '../enums.js'
import { generateTransactionCode } from '../utils/generate_guest_code.js'
import FolioService from '../services/folio_service.js'

export default class PosController {
  /**
   * Get hotel information by hotel ID
   * GET /pos/hotels/:hotelId
   */
  async getHotelInfo({ params, response }: HttpContext) {
    try {
      const { hotelId } = params

      if (!hotelId) {
        return response.status(400).json({
          success: false,
          message: 'Hotel ID is required'
        })
      }

      // Import Hotel model
      const { default: Hotel } = await import('#models/hotel')
      console.log('reservation', hotelId)
      // Get hotel information
      const hotel = await Hotel.find(parseInt(hotelId))

      if (!hotel) {
        return response.status(404).json({
          success: false,
          message: 'Hotel not found'
        })
      }

      return response.json({
        success: true,
        data: {
          id: hotel.id,
          hotelName: hotel.hotelName,
          address: hotel.address,
          city: hotel.city,
          state: hotel.stateProvince,
          country: hotel.country,
          zipCode: hotel.postalCode,
          phone: hotel.phoneNumber,
          email: hotel.email,
          website: hotel.website,
          currency: hotel.currencies,
          timezone: hotel.timezone,
          checkInTime: hotel.checkInTime,
          checkOutTime: hotel.checkOutTime,
          createdAt: hotel.createdAt,
          updatedAt: hotel.updatedAt
        }
      })

    } catch (error) {
      logger.error('Error getting hotel info:', error)
      return response.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      })
    }
  }

  /**
   * Get all in-house reservations (checked-in status)
   * GET /pos/hotels/:hotelId/inhouse
   */
  async getInHouseReservations({ params, response }: HttpContext) {
    try {
      const { hotelId } = params

      if (!hotelId) {
        return response.status(400).json({
          success: false,
          message: 'Hotel ID is required'
        })
      }

      // Import required models
      const { default: ReservationRoom } = await import('#models/reservation_room')

      // Get all checked-in reservation rooms for the hotel
      const inHouseReservations = await ReservationRoom.query()
        .where('hotel_id', parseInt(hotelId))
        .where('status', "checked_in")
        .preload('guest')
        .preload('reservation', (reservationQuery:any) => {
          reservationQuery.preload('guest')
          reservationQuery.preload('folios')
        })
        .preload('room')

      // Format the response data
      const formattedData = inHouseReservations?.map(reservationRoom => {
        const guest = reservationRoom.reservation?.guest
        const room = reservationRoom.room
        const folio = reservationRoom.reservation.folios?.[0]

        return {
          guestName: guest ? `${guest.fullName}`.trim() : 'Unknown Guest',
          roomId: room?.id || null,
          reservationRoomId: reservationRoom.id,
          checkinDate: reservationRoom.checkInDate ? reservationRoom.checkInDate.toISODate() : null,
          checkoutDate: reservationRoom.checkOutDate ? reservationRoom.checkOutDate.toISODate() : null,
          hotelId: parseInt(hotelId),
          hotelNumber: room?.roomNumber || null,
          folioId: folio?.id || null
        }
      })

      return response.json({
        success: true,
        data: formattedData,
        count: formattedData.length
      })

    } catch (error) {
      logger.error('Error getting in-house reservations:', error)
      return response.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      })
    }
  }

  /**
   * Post room transaction to folio
   * POST /pos/hotels/:hotelId/roomposting
   */
  async postRoomTransaction({ params, request, response }: HttpContext) {
    try {
      const { hotelId } = params

      if (!hotelId) {
        return response.status(400).json({
          success: false,
          message: 'Hotel ID is required'
        })
      }

      // Get request body data
      const {
        folioId,
        reservationRoomId,
        roomId,
        amount,
        description,
        table,
        userName,
        transactionDate,
        articles
      } = request.only([
        'folioId',
        'reservationRoomId',
        'roomId',
        'amount',
        'description',
        'table',
        'userName',
        'transactionDate',
        'articles'
      ])

      // Validate required fields
      const requiredFields = ['folioId', 'reservationRoomId', 'roomId', 'amount', 'description', 'userName']
      const missingFields = requiredFields.filter(field => !request.input(field))

      if (missingFields.length > 0) {
        return response.status(400).json({
          success: false,
          message: `Missing required fields: ${missingFields.join(', ')}`
        })
      }

      // Validate hotel ID matches
      if (parseInt(hotelId) !== parseInt(request.input('hotelId', hotelId))) {
        return response.status(400).json({
          success: false,
          message: 'Hotel ID mismatch'
        })
      }

      // Import FolioTransaction model
      const { default: FolioTransaction } = await import('#models/folio_transaction')

      // Verify folio exists
      const { default: Folio } = await import('#models/folio')
      const folio = await Folio.find(parseInt(folioId))

      if (!folio) {
        return response.status(404).json({
          success: false,
          message: 'Folio not found'
        })
      }
      const transactionNumber = parseInt(Date.now().toString().slice(-9));
      const transactionCode =generateTransactionCode('RMP');

      // Normalize articles to an object (optional)
      let itemSummaryData: object | null = null
      const rawItemSummary = articles ?? request.input('intem_summary')
      if (rawItemSummary) {
        if (typeof rawItemSummary === 'string') {
          try {
            itemSummaryData = JSON.parse(rawItemSummary)
          } catch {
            itemSummaryData = { value: rawItemSummary }
          }
        } else if (typeof rawItemSummary === 'object') {
          itemSummaryData = rawItemSummary as object
        }
      }

      // Create the transaction
      const transaction = await FolioTransaction.create({
        folioId: parseInt(folioId),
        //  reservationRoomId: parseInt(reservationRoomId),
        // roomId: parseInt(roomId),
        hotelId: parseInt(hotelId),
        amount: parseFloat(amount),
        totalAmount:parseFloat(amount),
        description: description,
        transactionCode: transactionCode,
        transactionNumber: transactionNumber,
        table: table,
        transactionTime: DateTime.now().toFormat('HH:mm:ss'),
        category: TransactionCategory.POSTING, // Fixed category as specified
        particular: 'Room Posting',
        // type: 'Room Posting',
        transactionType: TransactionType.ROOM_POSTING, // Fixed type as specified
        transactionDate: transactionDate ? DateTime.fromISO(transactionDate) : DateTime.now(),
        //  createdBy: userName,
        postingDate: DateTime.now(),
        itemSummary: itemSummaryData,
        status: TransactionStatus.COMPLETED
      })
      await FolioService.updateFolioTotals(parseInt(folioId))
      return response.status(201).json({
        success: true,
        message: 'Room posting transaction created successfully',
        data: {
          id: transaction.id,
          folioId: transaction.folioId,
          reservationRoomId: transaction.folio?.reservationRoomId,
          hotelId: transaction.hotelId,
          amount: transaction.amount,
          description: transaction.description,
          category: transaction.category,
          type: transaction.transactionType,
          transactionDate: transaction.transactionDate,
          createdBy: transaction.createdBy,
          status: transaction.status,
          createdAt: transaction.createdAt,
          updatedAt: transaction.updatedAt
        }
      })

    } catch (error) {
      logger.error('Error creating room posting transaction:', error)
      return response.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      })
    }
  }
}