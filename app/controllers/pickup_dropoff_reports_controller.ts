import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import { createPickupDropoffReportValidator } from '#validators/pickup_dropoff_report'
import PickupsDropoffsLog from '../models/pickups_dropoffs_log.js'

export default class PickupDropoffReportsController {
  /**
   * Generate Pickup/Dropoff Guest Report
   * Input: startDate, endDate, type (Pickup, Dropoff, Both)
   * Output: List with hotel details and guest information
   */
  async generate({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createPickupDropoffReportValidator)
      const { startDate, endDate, type, hotelId } = payload

      const startDateTime = DateTime.fromISO(startDate)
      const endDateTime = DateTime.fromISO(endDate)

      // Build query based on type
      let query = PickupsDropoffsLog.query()
        .preload('guest')
        .preload('hotel')
        .preload('transportationMode')
        .preload('reservation',(reserQuery)=>{
          reserQuery.preload('reservationRooms',(resQuery)=>{
            resQuery.preload('room')
          })
        })
        .where('scheduledDateTime', '>=', startDateTime.toSQLDate())
        .where('scheduledDateTime', '<=', endDateTime.toSQLDate())
        

      if (hotelId) {
        query = query.where('hotelId', hotelId)
      }

      // Filter by pickup/dropoff requirements
      if (type) {
        query = query.where('serviceType',type)
      } 

      const pickdata = await query.orderBy('arrivalDate', 'asc')

      // Process data for pickup
      const pickupData = pickdata
        .filter(res => res.serviceType === 'Pickup')
        .map(reservation => ({
          hotelName: reservation.hotel.hotelName,
          startDate: startDateTime.toFormat('yyyy-MM-dd'),
          endDate: endDateTime.toFormat('yyyy-MM-dd'),
          pickDropDateTime: reservation.scheduledDateTime ? 
            reservation.scheduledDateTime.toFormat('yyyy-MM-dd HH:mm:ss') : 
            reservation.actualDateTime?.toFormat('yyyy-MM-dd HH:mm:ss'),
          guestName: `${reservation.guest.fullName}`,
          roomNo: reservation.reservation?.reservationRooms[0]?.room?.roomNumber,
          mode: reservation.transportationMode.name || 'Standard',
          vehicle: reservation.externalVehicleMatriculation || '',
          description: reservation.pickupPoint
        }))

      // Process data for dropoff
      const dropoffData = pickdata
        .filter(res => res.serviceType === 'Dropoff')
        .map(reservation => ({
          hotelName: reservation.hotel.hotelName,
          startDate: startDateTime.toFormat('yyyy-MM-dd'),
          endDate: endDateTime.toFormat('yyyy-MM-dd'),
          pickDropDateTime: reservation.scheduledDateTime ? 
            reservation.scheduledDateTime.toFormat('yyyy-MM-dd HH:mm:ss') : 
            reservation.actualDateTime?.toFormat('yyyy-MM-dd HH:mm:ss'),
          guestName: `${reservation.guest.displayName}`,
          roomNo: reservation.reservation?.reservationRooms[0]?.room?.roomNumber || 'N/A',
          mode: reservation.transportationMode.name,
          vehicle: reservation.externalVehicleMatriculation,
          description: reservation.dropoffPoint
        }))

      // Prepare response based on type
      const responseData: any = {}

      if (type === 'Pickup' || type === 'Both') {
        responseData.pickup = {
          list: pickupData,
          totalGuests: pickupData.length
        }
      }

      if (type === 'Dropoff' || type === 'Both') {
        responseData.dropoff = {
          list: dropoffData,
          totalGuests: dropoffData.length
        }
      }


      return response.ok({
        success: true,
        message: 'Pickup/Dropoff guest report generated successfully',
        data: responseData,
        filters: {
          startDate,
          endDate,
          type,
          hotelId
        },
        generatedAt: DateTime.now().toISO(),
        generatedBy: auth.user?.firstName + ' ' + auth.user?.lastName
      })

    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to generate pickup/dropoff guest report',
        error: error.message
      })
    }
  }
}