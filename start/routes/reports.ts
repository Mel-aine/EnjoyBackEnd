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
const PickupDropoffReportsController = () => import('#controllers/pickup_dropoff_reports_controller')
const GuestCheckoutReportsController = () => import('#controllers/guest_checkout_reports_controller')
const DailyReceiptReportsController = () => import('#controllers/daily_receipt_reports_controller')
const WorkOrderReportsController = () => import('#controllers/work_order_reports_controller')

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
<<<<<<< HEAD
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
=======
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
    router.get('/monthly-revenue-pdf', [ReportsController, 'generateMonthlyRevenuePdf'])
    
    // Payment Summary PDF report
    router.post('/payment-summary-pdf', [ReportsController, 'generatePaymentSummaryPdf'])
    
    // Revenue By Rate Type Summary PDF report
    router.post('/revenue-by-rate-type-summary-pdf', [ReportsController, 'generateRevenueByRateTypeSummaryPdf'])
    
    // Statistics By Room Type PDF report
    router.post('/statistics-by-room-type-pdf', [ReportsController, 'generateStatisticsByRoomTypePdf'])
    
    // Daily Revenue PDF report
  router.get('/daily-revenue-pdf', [ReportsController, 'generateDailyRevenuePdf'])
}).prefix('/statistics')

// New Report Endpoints
router.group(() => {
  // Pickup/Dropoff Guest Report
  router.post('/pickup-dropoff', [PickupDropoffReportsController, 'generate'])
  
  // Guest Checkout Report
  router.post('/guest-checkout', [GuestCheckoutReportsController, 'generate'])
  
  // Daily Receipt Reports
  router.post('/daily-receipt-summary', [DailyReceiptReportsController, 'generateSummary'])
  router.post('/daily-receipt-detail', [DailyReceiptReportsController, 'generateDetail'])
}).prefix('/statistics')

// Work Order Reports
router.group(() => {
  // Get available work order report types
  router.get('/', [WorkOrderReportsController, 'index'])
  
  // Generate work order reports
  router.post('/generate', [WorkOrderReportsController, 'generate'])
  
  // Specific work order report endpoints
  router.post('/by-status', [WorkOrderReportsController, 'generate']).where('reportType', 'workOrdersByStatus')
  router.post('/by-priority', [WorkOrderReportsController, 'generate']).where('reportType', 'workOrdersByPriority')
  router.post('/by-department', [WorkOrderReportsController, 'generate']).where('reportType', 'workOrdersByDepartment')
  router.post('/by-assignee', [WorkOrderReportsController, 'generate']).where('reportType', 'workOrdersByAssignee')
  router.post('/overdue', [WorkOrderReportsController, 'generate']).where('reportType', 'workOrdersOverdue')
  router.post('/completed', [WorkOrderReportsController, 'generate']).where('reportType', 'workOrdersCompleted')
  router.post('/summary', [WorkOrderReportsController, 'generate']).where('reportType', 'workOrdersSummary')
}).prefix('/work-orders')
  
}).prefix('/api/reports').use(middleware.auth())
// Temporarily disabled auth for testing
// .use(middleware.auth())
>>>>>>> 91074651adf826150472e60c5b4961e16d9e72fe
