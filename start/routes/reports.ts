/*
|--------------------------------------------------------------------------
| Reports Routes
|--------------------------------------------------------------------------
|
| This file contains all routes related to hotel management reports
| including reservation reports, front office reports, back office reports,
| audit reports, statistical reports, and custom reports.
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const ReportsController = () => import('#controllers/reports_controller')

// Group all report routes under /api/reports prefix
router.group(() => {
  // Get all available report types
  router.get('/', [ReportsController, 'index'])
  
  // Generate a specific report
  router.post('/generate', [ReportsController, 'generate'])
  
  // Export report in different formats (CSV, PDF, Excel)
  router.post('/export', [ReportsController, 'export'])
  
  // Generate custom report
  router.post('/custom', [ReportsController, 'generateCustom'])
  
  // Get report templates for custom reports
  router.get('/templates', [ReportsController, 'getTemplates'])
  
  // Get report statistics for dashboard
  router.get('/stats', [ReportsController, 'getReportStats'])
  
  // Specific report endpoints for direct access
  
  // Reservation Reports
  router.group(() => {
    router.post('/arrival-list', [ReportsController, 'generate']).where('reportType', 'arrivalList')
    router.post('/departure-list', [ReportsController, 'generate']).where('reportType', 'departureList')
    router.post('/confirmed', [ReportsController, 'generate']).where('reportType', 'confirmedReservations')
    router.post('/cancelled', [ReportsController, 'generate']).where('reportType', 'cancelledReservations')
    router.post('/no-show', [ReportsController, 'generate']).where('reportType', 'noShowReservations')
    router.post('/forecast', [ReportsController, 'generate']).where('reportType', 'reservationForecast')
    router.post('/void', [ReportsController, 'generate']).where('reportType', 'voidReservations')
  }).prefix('/reservations')

    // Reservation export
  router.group(() => {
    router.post('/arrival-list', [ReportsController, 'export']).where('reportType', 'arrivalList')
    router.post('/departure-list', [ReportsController, 'export']).where('reportType', 'departureList')
    router.post('/confirmed', [ReportsController, 'export']).where('reportType', 'confirmedReservations')
    router.post('/cancelled', [ReportsController, 'export']).where('reportType', 'cancelledReservations')
    router.post('/no-show', [ReportsController, 'export']).where('reportType', 'noShowReservations')
    router.post('/forecast', [ReportsController, 'generate']).where('reportType', 'reservationForecast')
    router.post('/void', [ReportsController, 'export']).where('reportType', 'voidReservations')
  }).prefix('/exports')
  // Front Office Reports
  router.group(() => {
    router.post('/checked-in', [ReportsController, 'generate']).where('reportType', 'guestCheckedIn')
    router.post('/checked-out', [ReportsController, 'generate']).where('reportType', 'guestCheckedOut')
    router.post('/room-availabilitys', [ReportsController, 'generate']).where('reportType', 'roomAvailability')
    router.post('/room-status', [ReportsController, 'generate']).where('reportType', 'roomStatus')
    router.post('/tasks', [ReportsController, 'generate']).where('reportType', 'taskList')
    router.post('/room-availability', [ReportsController, 'generateRoomAvailabilityData'])
    
    // PDF
    router.post('/room-availability-pdf', [ReportsController, 'generateRoomAvailabilityPdf'])
    
    // Export
    router.post('/room-availability-export', [ReportsController, 'exportRoomAvailabilityReport'])
    
  }).prefix('/front-office')
  
  // Back Office Reports
  router.group(() => {
    router.post('/revenue', [ReportsController, 'generate']).where('reportType', 'revenueReport')
    router.post('/expenses', [ReportsController, 'generate']).where('reportType', 'expenseReport')
    router.post('/cashier', [ReportsController, 'generate']).where('reportType', 'cashierReport')
  }).prefix('/back-office')
  
  // Audit Reports
  router.group(() => {
    router.post('/user-activity', [ReportsController, 'generate']).where('reportType', 'userActivityLog')
  }).prefix('/audit')
  
  // Statistical Reports
  router.group(() => {
    router.post('/occupancy', [ReportsController, 'generate']).where('reportType', 'occupancyReport')
    router.post('/adr', [ReportsController, 'generate']).where('reportType', 'adrReport')
    router.post('/revpar', [ReportsController, 'generate']).where('reportType', 'revparReport')
    router.post('/market-segments', [ReportsController, 'generate']).where('reportType', 'marketSegmentAnalysis')
    router.post('/business-sources', [ReportsController, 'generate']).where('reportType', 'sourceOfBusinessReport')
    // Monthly occupancy PDF report
    router.get('/monthly-occupancy-pdf', [ReportsController, 'generateMonthlyOccupancyPdf'])
  }).prefix('/statistics')
  
}).prefix('/api/reports').use(middleware.auth())

// Public routes (no authentication required)
router.group(() => {
  // Health check for reports service
  router.get('/health', ({ response }) => {
    return response.ok({
      success: true,
      message: 'Reports service is running',
      timestamp: new Date().toISOString()
    })
  })
}).prefix('/api/reports')