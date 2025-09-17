/*
|--------------------------------------------------------------------------
| POS Routes
|--------------------------------------------------------------------------
|
| This file contains all routes related to Point of Sale (POS) integration
| These routes use API key authentication instead of user authentication
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const PosController = () => import('#controllers/pos_controller')

// Group all POS routes under /pos prefix with API key authentication
router.group(() => {
  
  // Get hotel information
  router.get('/hotels/:hotelId', [PosController, 'getHotelInfo'])
  
  // Get in-house reservations (checked-in status)
  router.get('/hotels/:hotelId/inhouse', [PosController, 'getInHouseReservations'])
  
  // Post room transaction to folio
  router.post('/hotels/:hotelId/roomposting', [PosController, 'postRoomTransaction'])
  
}).prefix('/pos').use(middleware.apiKey())