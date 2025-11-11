import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Hotel from '#models/hotel'
import BookingSource from '#models/booking_source'

export default class extends BaseSeeder {
  async run() {
    // Get all hotels
    const hotels = await Hotel.all()

    const defaultBookingSources = [
      {
        sourceName: 'Walk-in',
        sourceCode: 'WALKIN',
        sourceType: 'walk_in',
        commissionRate: 0,
        description: 'Guests who come to the front desk without a prior reservation'
      },
      {
        sourceName: 'Website',
        sourceCode: 'WEBSITE',
        sourceType: 'website',
        commissionRate: 0,
        description: 'Direct bookings made through the hotel\'s own website booking engine'
      },
      {
        sourceName: 'Telephone/Call Center',
        sourceCode: 'PHONE',
        sourceType: 'phone',
        commissionRate: 0,
        description: 'Reservations made over the phone'
      },
      {
        sourceName: 'Outlook Email',
        sourceCode: 'OUTLOOK',
        sourceType: 'email',
        commissionRate: 0,
        description: 'Reservations received via Outlook email inbox'
      },
      {
        sourceName: 'WhatsApp',
        sourceCode: 'WHATSAPP',
        sourceType: 'whatsapp',
        commissionRate: 0,
        description: 'Reservations received via WhatsApp messaging'
      }
    ]

    for (const hotel of hotels) {
      // Delete all existing booking sources for this hotel
      await BookingSource.query().where('hotelId', hotel.id).delete()
      console.log(`Deleted existing booking sources for hotel: ${hotel.name}`)
      
      // Create new default booking sources for this hotel
      for (const bookingSource of defaultBookingSources) {
        await BookingSource.create({
          hotelId: hotel.id,
          sourceName: bookingSource.sourceName,
          sourceCode: bookingSource.sourceCode,
          sourceType: bookingSource.sourceType,
          description: bookingSource.description,
          commissionRate: bookingSource.commissionRate,
          isActive: true,
          priority: 1,
          createdBy: null,
          lastModifiedBy: null
        })
      }
      console.log(`Created new booking sources for hotel: ${hotel.name}`)
    }
  }
}