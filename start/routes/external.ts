import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const ExternalApiController = () => import('#controllers/external_api_controller')

router
  .group(() => {
    router.get('/configuration/hotels/:hotelId', [ExternalApiController, 'getHotel'])
    router.get('/configuration/hotels/:hotelId/room_types', [ExternalApiController, 'roomTypes'])
    router.get('/configuration/hotels/:hotelId/rooms', [ExternalApiController, 'rooms'])
    router.get('/configuration/hotels/:hotelId/rooms/views/details', [ExternalApiController, 'roomsWithDetails'])
    router.get('/configuration/hotels/:hotelId/rooms/availability-by-room-type', [
      ExternalApiController,
      'availabilityByRoomType',
    ])
    router.get('/configuration/hotels/:hotelId/rooms/available-by-room-type/:roomTypeId', [
      ExternalApiController,
      'roomsAvailabilityByRoomType',
    ])
    router.get('/configuration/hotels/:hotelId/rooms/:id/availability', [ExternalApiController, 'roomAvailability'])
    router.get('/configuration/hotels/:hotelId/rooms/house-status', [ExternalApiController, 'houseStatus'])
    router.get('/configuration/hotels/:hotelId/bed_types', [ExternalApiController, 'bedTypes'])
    router.get('/configuration/hotels/:hotelId/room_rates', [ExternalApiController, 'roomRates'])
    router.get('/configuration/hotels/:hotelId/seasons', [ExternalApiController, 'seasons'])
    router.get('/configuration/hotels/:hotelId/rate_types', [ExternalApiController, 'rateTypes'])
    router.get('/configuration/hotels/:hotelId/extra_charges', [ExternalApiController, 'extraCharges'])

    router.get('/guests', [ExternalApiController, 'guests'])
    router.get('/guests/:id', [ExternalApiController, 'guestDetails'])
    router.post('/guests', [ExternalApiController, 'createGuest'])

    router.post('/reservation/create', [ExternalApiController, 'reservationCreate'])
    router.get('/reservation/:reservationId/details', [ExternalApiController, 'reservationDetails'])
    router.post('/reservation/:reservationId/cancel', [ExternalApiController, 'reservationCancel'])
    router.post('/reservation/:reservationId/checkin', [ExternalApiController, 'reservationCheckIn'])
    router.post('/reservation/:reservationId/check-out', [ExternalApiController, 'reservationCheckOut'])
    router.post('/reservation/:reservationId/payment', [ExternalApiController, 'reservationAddPayment'])
    router.post('/reservation/:reservationId/assign-room', [ExternalApiController, 'reservationAssignRoom'])
    router.post('/reservation/:reservationId/unassign-room', [ExternalApiController, 'reservationUnassignRoom'])

    router.get('/hotels/:id/reservation/search', [ExternalApiController, 'reservationSearch'])
    router.get('/hotels/:id/reservation/arrivals', [ExternalApiController, 'reservationArrivals'])
    router.get('/hotels/:id/reservation/departures', [ExternalApiController, 'reservationDepartures'])

    router.get('/room-blocks/:hotelId', [ExternalApiController, 'roomBlocksByHotel'])
    router.post('/room-blocks', [ExternalApiController, 'roomBlockCreate'])
    router.delete('/room-blocks/:id', [ExternalApiController, 'roomBlockDelete'])

    router.post('/folios/reservation', [ExternalApiController, 'folioCreateForReservation'])
    router.post('/folios/transactions', [ExternalApiController, 'folioPostTransaction'])
    router.get('/folios/:folioId/statement', [ExternalApiController, 'folioStatement'])

    router.post('/folio-print/print_confirm_booking-pdf', [ExternalApiController, 'folioPrintConfirmBookingPdf'])
    router.post('/folio-print/print-pdf', [ExternalApiController, 'folioPrintPdf'])
    router.post('/folio-print/send-invoice-email', [ExternalApiController, 'folioSendInvoiceEmail'])

    router.get('/dashboard/availability/:serviceId', [ExternalApiController, 'dashboardAvailability'])

    router.post('/reports/statistics/management-report-pdf', [ExternalApiController, 'managementReportPdf'])
    router.post('/reports/statistics/night-audit-report-pdf', [ExternalApiController, 'nightAuditReportPdf'])
  })
  .prefix('/external')
  .use([middleware.apiKey()])
