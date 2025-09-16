import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'identity_types'

  async up() {
    // Get all existing hotels
    const hotels = await this.db.from('hotels').select('id', 'hotel_name')
    
    console.log(`Found ${hotels.length} hotels to update with default identity types`)
    
    for (const hotel of hotels) {
      console.log(`Processing hotel: ${hotel.hotel_name} (ID: ${hotel.id})`)
      
      // Delete existing identity types for this hotel
      const deletedCount = await this.db.from('identity_types').where('hotel_id', hotel.id).delete()
      if (deletedCount > 0) {
        console.log(`  Deleted ${deletedCount} existing identity types`)
      }
      
      // Create default identity types
       const defaultIdentityTypes = [
         {
           hotel_id: hotel.id,
           name: 'Passport',
           short_code: 'PASS',
           created_by_user_id: null,
           updated_by_user_id: null,
           is_deleted: false,
           deleted_at: null,
           created_at: new Date(),
           updated_at: new Date()
         },
         {
           hotel_id: hotel.id,
           name: 'National ID Card',
           short_code: 'NAT_ID',
           created_by_user_id: null,
           updated_by_user_id: null,
           is_deleted: false,
           deleted_at: null,
           created_at: new Date(),
           updated_at: new Date()
         }
       ]
      
      await this.db.table('identity_types').insert(defaultIdentityTypes)
      console.log(`  Created ${defaultIdentityTypes.length} default identity types`)
    }
    
    console.log(`Successfully processed ${hotels.length} hotels`)
  }

  async down() {
    // Remove the default identity types we created
    await this.db.from('identity_types')
      .whereIn('short_code', ['PASSPORT', 'NATIONAL_ID'])
      .delete()
  }
}