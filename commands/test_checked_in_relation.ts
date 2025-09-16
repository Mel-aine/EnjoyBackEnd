import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import Reservation from '#models/reservation'
import User from '#models/user'
import Database from '@adonisjs/lucid/services/db'

export default class TestCheckedInRelation extends BaseCommand {
  static commandName = 'test:checked-in-relation'
  static description = 'Test the checkedInByUser relation in reservations'

  static options: CommandOptions = {}

  async run() {
    try {
      this.logger.info('Testing checkedInByUser relation using raw queries...')
      
      // Check total reservations
      const reservationCountResult = await Database.rawQuery('SELECT COUNT(*) as total FROM reservations')
      this.logger.info(`Total reservations: ${reservationCountResult.rows[0].total}`)
      
      // Check reservations with checked_in_by values
      const reservationsWithCheckedInBy = await Database.rawQuery(`
        SELECT r.id, r.reservation_number, r.checked_in_by, u.first_name, u.last_name, u.email 
        FROM reservations r 
        LEFT JOIN users u ON r.checked_in_by = u.id 
        WHERE r.checked_in_by IS NOT NULL 
        LIMIT 10
      `)
      
      this.logger.info(`Found ${reservationsWithCheckedInBy.rows.length} reservations with checked_in_by values`)
      
      for (const row of reservationsWithCheckedInBy.rows) {
        this.logger.info(`\nReservation ID: ${row.id}`)
        this.logger.info(`Reservation Number: ${row.reservation_number}`)
        this.logger.info(`Checked in by ID: ${row.checked_in_by}`)
        
        if (row.first_name) {
          this.logger.info(`Checked in by user: ${row.first_name} ${row.last_name} (${row.email})`)
        } else {
          this.logger.info('Checked in by user: NULL - User not found')
        }
      }
      
      // Check total users
      const userCountResult = await Database.rawQuery('SELECT COUNT(*) as total FROM users')
      this.logger.info(`\nTotal users in database: ${userCountResult.rows[0].total}`)
      
      // Check if there are any reservation_rooms with checked_in_by
      const reservationRoomsWithCheckedInBy = await Database.rawQuery(`
        SELECT rr.id, rr.reservation_id, rr.checked_in_by, u.first_name, u.last_name, u.email 
        FROM reservation_rooms rr 
        LEFT JOIN users u ON rr.checked_in_by = u.id 
        WHERE rr.checked_in_by IS NOT NULL 
        LIMIT 10
      `)
      
      this.logger.info(`\nFound ${reservationRoomsWithCheckedInBy.rows.length} reservation_rooms with checked_in_by values`)
      
      for (const row of reservationRoomsWithCheckedInBy.rows) {
        this.logger.info(`\nReservation Room ID: ${row.id}`)
        this.logger.info(`Reservation ID: ${row.reservation_id}`)
        this.logger.info(`Checked in by ID: ${row.checked_in_by}`)
        
        if (row.first_name) {
          this.logger.info(`Checked in by user: ${row.first_name} ${row.last_name} (${row.email})`)
        } else {
          this.logger.info('Checked in by user: NULL - User not found')
        }
      }
      
      // Check reservations with checked_in_by but without preload
      const reservationsWithoutPreload = await Reservation.query()
        .whereNotNull('checked_in_by')
        .limit(3)
      
      this.logger.info(`\nTesting without preload:`)  
      for (const reservation of reservationsWithoutPreload) {
        this.logger.info(`Reservation ${reservation.id} - checked_in_by: ${reservation.checkedInBy}`)
        // Try to access the relation without preload
        try {
          const user = reservation.checkedInByUser
          this.logger.info(`User relation (without preload): ${user ? 'Loaded' : 'NULL'}`)
        } catch (error) {
          this.logger.info(`Error accessing relation without preload: ${error.message}`)
        }
      }
      
    } catch (error) {
      this.logger.error('Error testing relation:')
      this.logger.error(error.message)
      this.logger.error(error.stack)
    }
  }
}