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
const ReservationsController = () => import('#controllers/reservations_controller')
const PickupDropoffReportsController = () => import('#controllers/pickup_dropoff_reports_controller')
const GuestCheckoutReportsController = () => import('#controllers/guest_checkout_reports_controller')
const DailyReceiptReportsController = () => import('#controllers/daily_receipt_reports_controller')
const WorkOrderReportsController = () => import('#controllers/work_order_reports_controller')
const RoomStatusReportsController = () => import('#controllers/room_status_controller')
const ReservationReportsController = () => import('#controllers/reservation_reports_controller')
const HotelHistoriesController = () => import('#controllers/hotel_histories_controller')


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

  // Receipt printing route
  router.get('/receipt/:transactionId', [ReportsController, 'printReceipt'])

  router.get('/invoice/:transactionId', [ReportsController, 'printInvoice'])

  // Company printing routes
  router.get('/company-receipt/:transactionId', [ReportsController, 'printCompanyReceipt'])
  router.get('/company-voucher/:companyId', [ReportsController, 'printCompanyVoucher'])

  // POS Receipt printing route
  router.get('/pos-receipt/:transactionId', [ReportsController, 'printPosReceipt'])
  router.post('/incidental-invoice', [ReportsController, 'printIncidentalInvoice'])




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

  router.group(() => {
    router.post('/arrivals', [ReservationReportsController, 'generateArrivalList'])
    router.post('/departures', [ReservationReportsController, 'generateDepartureList'])
    router.post('/cancelled', [ReservationReportsController, 'generateCancelledList'])
    router.post('/void', [ReservationReportsController, 'generateVoidList'])
    router.post('/arrivals-pdf', [ReservationReportsController, 'generateArrivalListPdf'])
    router.post('/departures-pdf', [ReservationReportsController, 'generateDepartureListPdf'])
    router.post('/cancelled-pdf', [ReservationReportsController, 'generateCancelledListPdf'])
    router.post('/void-pdf', [ReservationReportsController, 'generateVoidListPdf'])
  }).prefix('/reservation')

  // Reservation export
  router.group(() => {
    router.post('/arrival-list', [ReportsController, 'export']).where('reportType', 'arrivalList')
    router.post('/departure-list', [ReportsController, 'export']).where('reportType', 'departureList')
    router.post('/guest-checked-in', [ReportsController, 'export']).where('reportType', 'guestCheckedIn')
    router.post('/guest-checked-out', [ReportsController, 'export']).where('reportType', 'guestCheckedOut')
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
    router.post('/rooms-status', [RoomStatusReportsController, 'generateRoomsByStatus'])
    router.post('/rooms-status-pdf', [RoomStatusReportsController, 'generateRoomsByStatusPdf'])

    // In-house reservations filtered by roomId and roomTypeId (JSON)
    router.get('/inhouse-guests', [ReservationsController, 'getInHouseReservations'])

    // Occupied rooms with rate type relation (JSON)
    router.get('/occupied-rooms', [ReservationsController, 'getOccupiedRooms'])

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
    //Meal Plan Report 
    router.post('/MealPlan-report-pdf', [ReportsController, 'generateMealPlanReportPdf'])

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

    // Business Analysis Report
    router.get('/business-analysis', [ReportsController, 'getBusinessAnalysis'])
    router.post('/business-analysis-pdf', [ReportsController, 'generateBusinessAnalysisPdf'])

    // Contribution Analysis Report
    router.get('/contribution-analysis-report', [ReportsController, 'getContributionAnalysisReport'])
    router.post('/contribution-analysis-report-pdf', [ReportsController, 'generateContributionAnalysisReportPdf'])

    // Monthly Country-wise PAX Analysis
    router.get('/monthly-country-wise-pax-analysis', [ReportsController, 'getMonthlyCountryWisePaxAnalysis'])
    router.post('/monthly-country-wise-pax-analysis-pdf', [ReportsController, 'generateMonthlyCountryWisePaxAnalysisPdf'])

    // Monthly Revenue by Income Stream
    router.get('/monthly-revenue-by-income-stream', [ReportsController, 'getMonthlyRevenueByIncomeStream'])
    router.post('/monthly-revenue-by-income-stream-pdf', [ReportsController, 'generateMonthlyRevenueByIncomeStreamPdf'])

    // Monthly Statistics
    router.get('/monthly-statistics', [ReportsController, 'getMonthlyStatistics'])
    router.post('/monthly-statistics-pdf', [ReportsController, 'generateMonthlyStatisticsPdf'])

    // Monthly Summary
    router.get('/monthly-summary', [ReportsController, 'getMonthlySummary'])
    router.post('/monthly-summary-pdf', [ReportsController, 'generateMonthlySummaryPdf'])

    // Monthly Tax Report
    router.get('/monthly-tax', [ReportsController, 'getMonthlyTax'])
    router.post('/monthly-tax-pdf', [ReportsController, 'generateMonthlyTaxPdf'])

    // Room Sale Statistics
    router.get('/room-sale-statistics', [ReportsController, 'getRoomSaleStatistics'])
    router.post('/room-sale-statistics-pdf', [ReportsController, 'generateRoomSaleStatisticsPdf'])

    // Room Statistics
    router.get('/room-statistics', [ReportsController, 'getRoomStatistics'])
    router.post('/room-statistics-pdf', [ReportsController, 'generateRoomStatisticsPdf'])

    // Room on Books
    router.get('/room-on-books', [ReportsController, 'getRoomOnBooks'])
    router.post('/room-on-books-pdf', [ReportsController, 'generateRoomOnBooksPdf'])

    // Yearly Statistics
    router.get('/yearly-statistics', [ReportsController, 'getYearlyStatistics'])
    router.post('/yearly-statistics-pdf', [ReportsController, 'generateYearlyStatisticsPdf'])

    // Performance Analysis Report
    router.get('/performance-analysis-report', [ReportsController, 'getPerformanceAnalysisReport'])
    router.post('/performance-analysis-report-pdf', [ReportsController, 'generatePerformanceAnalysisReportPdf'])

    // IP Report
    router.get('/ip-report', [ReportsController, 'getIpReport'])
    router.post('/ip-report-pdf', [ReportsController, 'generateIpReportPdf'])

    // City Ledger Detail
    router.get('/city-ledger-detail', [ReportsController, 'getCityLedgerDetail'])
    router.post('/city-ledger-detail-pdf', [ReportsController, 'generateCityLedgerDetailPdf'])

    // City Ledger Summary
    router.get('/city-ledger-summary', [ReportsController, 'getCityLedgerSummary'])
    router.post('/city-ledger-summary-pdf', [ReportsController, 'generateCityLedgerSummaryPdf'])

    // Payment Summary (data endpoint)
    router.get('/payment-summary', [ReportsController, 'getPaymentSummary'])

    // Daily Revenue PDF report
    router.get('/daily-revenue-pdf', [ReportsController, 'generateDailyRevenuePdf'])

    // Daily Operations Summary data (JSON)
    router.get('/daily-operations-report', [ReportsController, 'getDailyOperationsReport'])

    // Daily Operations Summary PDF (arrivals, stayovers, departures, no-shows, cancellations)
    router.post('/daily-operations-report-pdf', [ReportsController, 'generateDailyOperationsReportPdf'])
    // New Report Endpoints
    // Folio List Report
    router.post('/folio-list', [ReportsController, 'getFolioListReport'])

    // Audit Report
    router.post('/audit', [ReportsController, 'getAuditReport'])

    // Guest List Report
    router.post('/guest-list', [ReportsController, 'getGuestListReport'])
    // Void Reports
    router.post('/void-charge', [ReportsController, 'getVoidChargeReport'])
    router.post('/void-payment', [ReportsController, 'getVoidPaymentReport'])
    router.post('/void-transaction', [ReportsController, 'getVoidTransactionReport'])
  }).prefix('/statistics')

  // New Report Endpoints
  router.group(() => {
    // Pickup/Dropoff Guest Report
    router.post('/pickup-dropoff', [PickupDropoffReportsController, 'generate'])

    // Guest Checkout Report
    router.post('/guest-checkout', [GuestCheckoutReportsController, 'generate'])
    //router.post('/guest-checkout-pdf', [GuestCheckoutReportsController, 'generateGuestCheckoutReportPdf'])

    // Daily Receipt Reports
    router.post('/daily-receipt-summary', [DailyReceiptReportsController, 'generateSummary'])
    router.post('/daily-receipt-refund-detail', [DailyReceiptReportsController, 'generateDailyRefundDetail'])
    router.post('/daily-receipt-detail', [DailyReceiptReportsController, 'generateDetail'])
    router.post('/daily-receipt-summary-pdf', [DailyReceiptReportsController, 'generateSummaryPdf'])
    router.post('/daily-receipt-detail-pdf', [DailyReceiptReportsController, 'generateDetailPdf'])
    router.post('/daily-receipt-refund-detail-pdf', [DailyReceiptReportsController, 'generateDailyRefundDetailPdf'])
    router.post('/daily-receipt-revenue', [DailyReceiptReportsController, 'generatedailyRevenueReport'])
    router.post('/daily-receipt-revenue-pdf', [DailyReceiptReportsController, 'generatedailyRevenueReportPdf'])
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

  // Hotel Histories Reports
  router.group(() => {
    // Get hotel histories with pagination and filters
    router.get('/', [HotelHistoriesController, 'index'])
  }).prefix('/hotel-histories')

}).prefix('/api/reports').use(middleware.auth())
// Temporarily disabled auth for testing
// .use(middleware.auth())
