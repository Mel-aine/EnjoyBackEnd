import { BaseSeeder } from '@adonisjs/lucid/seeders'
import ReservationType from '#models/reservation_type'
import Hotel from '#models/hotel'

export default class extends BaseSeeder {
  async run() {
    console.log('Starting reservation types reset...')
    
    // Delete all existing reservation types
    console.log('Deleting all existing reservation types...')
    await ReservationType.query().delete()
    console.log('All reservation types deleted successfully')
    
    // Get all hotels
    const hotels = await Hotel.all()
    console.log(`Found ${hotels.length} hotels in database`)
    
    if (hotels.length === 0) {
      console.log('No hotels found in database')
      return
    }
    
    // Create default reservation types for each hotel
    for (const hotel of hotels) {
      console.log(`Creating default reservation types for hotel: ${hotel.hotelName} (ID: ${hotel.id})`)
      
      const defaultReservationTypes = [
        {
          hotelId: hotel.id,
          name: 'Confirmed Booking',
          isHold: false,
          status: 'active' as const,
          reservationStatus: 'confirmed' as const,
          createdByUserId: null,
          updatedByUserId: null,
          isDeleted: false
        },
        {
           hotelId: hotel.id,
           name: 'Unconfirmed Booking Inquiry',
           isHold: false,
           status: 'active' as const,
           reservationStatus: 'pending' as const,
           createdByUserId: null,
           updatedByUserId: null,
           isDeleted: false
         },
         {
           hotelId: hotel.id,
           name: 'Online Failed Booking',
           isHold: false,
           status: 'active' as const,
           reservationStatus: 'confirmed' as const,
           createdByUserId: null,
           updatedByUserId: null,
           isDeleted: false
         },
         {
           hotelId: hotel.id,
           name: 'Hold Confirmed Booking',
           isHold: true,
           status: 'active' as const,
           reservationStatus: 'confirmed' as const,
           createdByUserId: null,
           updatedByUserId: null,
           isDeleted: false
         },
         {
           hotelId: hotel.id,
           name: 'Hold Unconfirmed Booking',
           isHold: true,
           status: 'active' as const,
           reservationStatus: 'pending' as const,
           createdByUserId: null,
           updatedByUserId: null,
           isDeleted: false
         },
      ]
      
      for (const reservationType of defaultReservationTypes) {
        await ReservationType.create(reservationType)
      }
      
      console.log(`Created 5 default reservation types for hotel: ${hotel.hotelName}`)
    }
    
    console.log(`Reservation types reset completed successfully for ${hotels.length} hotels`)
  }
}