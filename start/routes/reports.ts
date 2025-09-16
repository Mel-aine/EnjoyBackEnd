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
  }).prefix('/reservations')
  
  // Front Office Reports
  router.group(() => {
    router.post('/checked-in', [ReportsController, 'generate']).where('reportType', 'guestCheckedIn')
    router.post('/checked-out', [ReportsController, 'generate']).where('reportType', 'guestCheckedOut')
    router.post('/room-availability', [ReportsController, 'generate']).where('reportType', 'roomAvailability')
    router.post('/room-status', [ReportsController, 'generate']).where('reportType', 'roomStatus')
    router.post('/tasks', [ReportsController, 'generate']).where('reportType', 'taskList')
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
    // Room status report PDF
    router.post('/room-status-report-pdf', [ReportsController, 'generateRoomStatusReportPdf'])
    // Night audit report PDF
    router.post('/night-audit-report-pdf', [ReportsController, 'generateNightAuditReportPdf'])
    // Management report PDF
    router.post('/management-report-pdf', [ReportsController, 'generateManagementReportPdf'])
    
    // Revenue By Rate Type reports
    router.get('/revenue-by-rate-type', [ReportsController, 'getRevenueByRateType'])
    router.post('/revenue-by-rate-type-pdf', [ReportsController, 'generateRevenueByRateTypePdf'])
    
    // Revenue By Room Type reports
    router.get('/revenue-by-room-type', [ReportsController, 'getRevenueByRoomType'])
    router.post('/revenue-by-room-type-pdf', [ReportsController, 'generateRevenueByRoomTypePdf'])
    
    // Monthly Revenue PDF report
    router.post('/monthly-revenue-pdf', [ReportsController, 'generateMonthlyRevenuePdf'])
    
    // Payment Summary PDF report
    router.post('/payment-summary-pdf', [ReportsController, 'generatePaymentSummaryPdf'])
    
    // Revenue By Rate Type Summary PDF report
    router.post('/revenue-by-rate-type-summary-pdf', [ReportsController, 'generateRevenueByRateTypeSummaryPdf'])
    
    // Statistics By Room Type PDF report
    router.post('/statistics-by-room-type-pdf', [ReportsController, 'generateStatisticsByRoomTypePdf'])
  }).prefix('/statistics')
  
}).prefix('/api/reports').use(middleware.auth())
// Temporarily disabled auth for testing
// .use(middleware.auth())

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
  
  // Test endpoint for debugging roomCharges
  router.get('/test-roomcharges', async ({ request, response }) => {
    const ReportsController = (await import('#controllers/reports_controller')).default
    const controller = new ReportsController()
    
    try {
      const hotelId = parseInt(request.input('hotelId', '1'))
      const asOnDate = request.input('asOnDate', '2024-01-15')
      const { DateTime } = await import('luxon')
      const reportDate = DateTime.fromISO(asOnDate)
      const ptdStartDate = reportDate.startOf('month')
      const ytdStartDate = reportDate.startOf('year')
      const currency = 'USD'
      
      const roomCharges = await controller['getManagementRoomChargesData'](hotelId, reportDate, ptdStartDate, ytdStartDate, currency)
      
      return response.ok({
        success: true,
        roomCharges,
        message: 'Room charges data retrieved successfully'
      })
    } catch (error) {
      return response.status(500).json({
        success: false,
        error: error.message,
        stack: error.stack
      })
    }
  })
  
  // Test template rendering
  router.get('/test-template', async ({ request, response, view }) => {
    const ReportsController = (await import('#controllers/reports_controller')).default
    const controller = new ReportsController()
    
    try {
      const hotelId = parseInt(request.input('hotelId', '1'))
      const asOnDate = request.input('asOnDate', '2024-01-15')
      const { DateTime } = await import('luxon')
      const reportDate = DateTime.fromISO(asOnDate)
      const ptdStartDate = reportDate.startOf('month')
      const ytdStartDate = reportDate.startOf('year')
      const currency = 'USD'
      
      const roomCharges = await controller['getManagementRoomChargesData'](hotelId, reportDate, ptdStartDate, ytdStartDate, currency)
      
      const templateData = {
        data: {
          roomCharges
        }
      }
      
      const html = await view.render('test_template', templateData)
      return response.type('text/html').send(html)
    } catch (error) {
      return response.status(500).json({
        success: false,
        error: error.message,
        stack: error.stack
      })
    }
  })
}).prefix('/api/reports')