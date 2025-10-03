import type { HttpContext } from '@adonisjs/core/http'
import ReportsService, {
  ReportFilters
} from '#services/reports_service'
import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import { PaymentMethodType, ReservationStatus, TransactionCategory, TransactionType } from '#app/enums'
import PaymentMethod from '#models/payment_method'
import PdfService from '#services/pdf_service'
import Reservation from '#models/reservation'
import Database from '@adonisjs/lucid/services/db'
import NightAuditService from '../services/night_audit_service.js'
import FolioTransaction from '#models/folio_transaction'
import Hotel from '#models/hotel'
import RoomType from '#models/room_type'
import numberToWords from 'number-to-words'
export default class ReportsController {
  /**
   * Get all available report types
   */
  async index({ response }: HttpContext) {
    try {
      const availableReports = ReportsService.getAvailableReports()
      return response.ok({
        success: true,
        data: availableReports
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la récupération des types de rapports',
        error: error.message
      })
    }
  }
  /**
   * Generate a specific report
   */
  async generate({ request, response }: HttpContext) {
    try {
      const { reportType, filters = {} } = request.only(['reportType', 'filters'])

      if (!reportType) {
        return response.badRequest({
          success: false,
          message: 'Le type de rapport est requis'
        })
      }
      const reportFilters: ReportFilters = {
        hotelId: filters.hotelId ? parseInt(filters.hotelId) : undefined,
        startDate: filters.startDate,
        endDate: filters.endDate,
        roomTypeId: filters.roomTypeId ? parseInt(filters.roomTypeId) : undefined,
        guestId: filters.guestId ? parseInt(filters.guestId) : undefined,
        userId: filters.userId ? parseInt(filters.userId) : undefined,
        status: filters.status,
        departmentId: filters.departmentId ? parseInt(filters.departmentId) : undefined,
        bookingSourceId: filters.bookingSourceId ? parseInt(filters.bookingSourceId) : undefined,
        ratePlanId: filters.ratePlanId ? parseInt(filters.ratePlanId) : undefined,

        // AJOUTEZ TOUS CES CHAMPS MANQUANTS :
        company: filters.company,
        travelAgent: filters.travelAgent,
        businessSource: filters.businessSource,
        market: filters.market,
        rateFrom: filters.rateFrom ? parseFloat(filters.rateFrom) : undefined,
        rateTo: filters.rateTo ? parseFloat(filters.rateTo) : undefined,
        reservationType: filters.reservationType,
        taxInclusive: filters.taxInclusive !== undefined ? Boolean(filters.taxInclusive) : undefined,
        selectedColumns: filters.selectedColumns,
        showAmount: filters.showAmount as 'rent_per_night' | 'total_amount',

        // Ajoutez aussi ces champs si nécessaires :
        arrivalFrom: filters.arrivalFrom,
        arrivalTo: filters.arrivalTo,
        roomType: filters.roomType,
        rateType: filters.rateType,
        user: filters.user,
        checkin: filters.checkin
      }

      let reportData

      switch (reportType) {
        // Reservation Reports
        case 'arrivalList':
          reportData = await ReportsService.getArrivalList(reportFilters)
          break
        case 'departureList':
          reportData = await ReportsService.getDepartureList(reportFilters)
          break
        case 'confirmedReservations':
          reportData = await ReportsService.getConfirmedReservations(reportFilters)
          break
        case 'cancelledReservations':
          reportData = await ReportsService.getCancelledReservations(reportFilters)
          break
        case 'noShowReservations':
          reportData = await ReportsService.getNoShowReservations(reportFilters)
          break
        case 'reservationForecast':
          reportData = await ReportsService.getReservationForecast(reportFilters)
          break
        case 'voidReservations':
          reportData = await ReportsService.getVoidReservations(reportFilters)
          break
        // Front Office Reports
        case 'guestCheckedIn':
          reportData = await ReportsService.getGuestCheckedIn(reportFilters)
          break
        case 'guestCheckedOut':
          reportData = await ReportsService.getGuestCheckedOut(reportFilters)
          break
        case 'roomAvailability':
          reportData = await ReportsService.getRoomAvailability(reportFilters)
          break
        case 'roomStatus':
          reportData = await ReportsService.getRoomStatus(reportFilters)
          break
        case 'taskList':
          reportData = await ReportsService.getTaskList(reportFilters)
          break

        // Back Office Reports
        case 'revenueReport':
          reportData = await ReportsService.getRevenueReport(reportFilters)
          break
        case 'expenseReport':
          reportData = await ReportsService.getExpenseReport(reportFilters)
          break
        case 'cashierReport':
          reportData = await ReportsService.getCashierReport(reportFilters)
          break

        // Audit Reports
        case 'userActivityLog':
          reportData = await ReportsService.getUserActivityLog(reportFilters)
          break

        // Statistical Reports
        case 'occupancyReport':
          reportData = await ReportsService.getOccupancyReport(reportFilters)
          break
        case 'adrReport':
          reportData = await ReportsService.getADRReport(reportFilters)
          break
        case 'revparReport':
          reportData = await ReportsService.getRevPARReport(reportFilters)
          break
        case 'marketSegmentAnalysis':
          reportData = await ReportsService.getMarketSegmentAnalysis(reportFilters)
          break
        case 'sourceOfBusinessReport':
          reportData = await ReportsService.getSourceOfBusinessReport(reportFilters)
          break

        default:
          return response.badRequest({
            success: false,
            message: `Type de rapport non reconnu: ${reportType}`
          })
      }

      return response.ok({
        success: true,
        data: reportData
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la génération du rapport',
        error: error.message
      })
    }
  }

  /**
   * Export report to different formats (CSV, PDF, Excel)
   */
  async export({ request, response }: HttpContext) {
    try {
      const { reportType, format = 'csv', filters = {} } = request.only(['reportType', 'format', 'filters'])

      if (!reportType) {
        return response.badRequest({
          success: false,
          message: 'Le type de rapport est requis'
        })
      }

      if (!['csv', 'pdf', 'excel'].includes(format)) {
        return response.badRequest({
          success: false,
          message: 'Format non supporté. Utilisez: csv, pdf, ou excel'
        })
      }

      // Generate the report data first
      const reportFilters: ReportFilters = {
        hotelId: filters.hotelId ? parseInt(filters.hotelId) : undefined,
        startDate: filters.startDate,
        endDate: filters.endDate,
        roomTypeId: filters.roomTypeId ? parseInt(filters.roomTypeId) : undefined,
        guestId: filters.guestId ? parseInt(filters.guestId) : undefined,
        userId: filters.userId ? parseInt(filters.userId) : undefined,
        status: filters.status,
        departmentId: filters.departmentId ? parseInt(filters.departmentId) : undefined,
        bookingSourceId: filters.bookingSourceId ? parseInt(filters.bookingSourceId) : undefined,
        ratePlanId: filters.ratePlanId ? parseInt(filters.ratePlanId) : undefined
      }

      // Get report data using the same logic as generate method
      let reportData: HtmlReport
      switch (reportType) {
        case 'arrivalList':
          reportData = await ReportsService.getArrivalList(reportFilters)
          break
        case 'departureList':
          reportData = await ReportsService.getDepartureList(reportFilters)
          break
        case 'confirmedReservations':
          reportData = await ReportsService.getConfirmedReservations(reportFilters)
          break
        case 'cancelledReservations':
          reportData = await ReportsService.getCancelledReservations(reportFilters)
          break
        case 'noShowReservations':
          reportData = await ReportsService.getNoShowReservations(reportFilters)
          break
        case 'reservationForecast':
          reportData = await ReportsService.getReservationForecast(reportFilters)
          break
        case 'guestCheckedIn':
          reportData = await ReportsService.getGuestCheckedIn(reportFilters)
          break
        case 'guestCheckedOut':
          reportData = await ReportsService.getGuestCheckedOut(reportFilters)
          break
        case 'roomAvailability':
          reportData = await ReportsService.getRoomAvailability(reportFilters)
          break
        case 'roomStatus':
          reportData = await ReportsService.getRoomStatus(reportFilters)
          break
        case 'taskList':
          reportData = await ReportsService.getTaskList(reportFilters)
          break
        case 'revenueReport':
          reportData = await ReportsService.getRevenueReport(reportFilters)
          break
        case 'expenseReport':
          reportData = await ReportsService.getExpenseReport(reportFilters)
          break
        case 'cashierReport':
          reportData = await ReportsService.getCashierReport(reportFilters)
          break
        case 'userActivityLog':
          reportData = await ReportsService.getUserActivityLog(reportFilters)
          break
        case 'occupancyReport':
          reportData = await ReportsService.getOccupancyReport(reportFilters)
          break
        case 'adrReport':
          reportData = await ReportsService.getADRReport(reportFilters)
          break
        case 'revparReport':
          reportData = await ReportsService.getRevPARReport(reportFilters)
          break
        case 'marketSegmentAnalysis':
          reportData = await ReportsService.getMarketSegmentAnalysis(reportFilters)
          break
        case 'sourceOfBusinessReport':
          reportData = await ReportsService.getSourceOfBusinessReport(reportFilters)
          break
        case 'voidReservations':
          reportData = await ReportsService.getVoidReservations(reportFilters)
          break
        default:
          return response.badRequest({
            success: false,
            message: `Type de rapport non reconnu: ${reportType}`
          })
      }

      // Generate filename
      const timestamp = DateTime.now().toFormat('yyyy-MM-dd_HH-mm-ss')
      const filename = `${reportType}_${timestamp}.${format}`

      switch (format) {
        case 'csv':
          return this.exportToCSV(response, reportData, filename)
        case 'pdf':
          return this.exportToPDF(response, reportData, filename)
        case 'excel':
          return this.exportToExcel(response, reportData, filename)
        default:
          return response.badRequest({
            success: false,
            message: 'Format d\'export non supporté'
          })
      }
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de l\'export du rapport',
        error: error.message
      })
    }
  }

  /**
   * Export report to PDF format
   */
  private async exportToPDF(response: Response, reportData: HtmlReport, filename: string) {
    try {
      // Générer le PDF à partir du HTML du rapport
      const pdfBuffer = await PdfService.generatePdfFromHtml(reportData.html, {
        format: 'A4',
        orientation: 'landscape',
        margin: {
          top: '1cm',
          right: '1cm',
          bottom: '1cm',
          left: '1cm'
        }
      })

      // Définir les en-têtes de réponse pour le téléchargement du PDF
      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', `attachment; filename="${filename}"`)
      response.header('Content-Length', pdfBuffer.length.toString())

      // Envoyer le buffer PDF en réponse
      return response.send(pdfBuffer)
    } catch (error) {
      throw new Error(`Erreur lors de la génération du PDF: ${error.message}`)
    }
  }
  /**
   * Generate custom report
   */
  async generateCustom({ request, response }: HttpContext) {
    try {
      const {
        tableName,
        selectedFields = [],
        filters = {},
        joins = [],
        groupBy = [],
        orderBy = []
      } = request.only(['tableName', 'selectedFields', 'filters', 'joins', 'groupBy', 'orderBy'])

      if (!tableName) {
        return response.badRequest({
          success: false,
          message: 'Le nom de la table est requis'
        })
      }

      const reportFilters: ReportFilters = {
        hotelId: filters.hotelId ? parseInt(filters.hotelId) : undefined,
        startDate: filters.startDate,
        endDate: filters.endDate,
        status: filters.status
      }

      const reportData = await ReportsService.generateCustomReport(
        tableName,
        selectedFields,
        reportFilters,
        joins,
        groupBy,
        orderBy
      )

      return response.ok({
        success: true,
        data: reportData
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la génération du rapport personnalisé',
        error: error.message
      })
    }
  }

  /**
   * Get report templates for custom reports
   */
  async getTemplates({ response }: HttpContext) {
    try {
      const templates = {
        availableTables: [
          { name: 'reservations', label: 'Réservations' },
          { name: 'guests', label: 'Clients' },
          { name: 'rooms', label: 'Chambres' },
          { name: 'room_types', label: 'Types de Chambres' },
          { name: 'payments', label: 'Paiements' },
          { name: 'folios', label: 'Folios' },
          { name: 'folio_transactions', label: 'Transactions Folio' },
          { name: 'expenses', label: 'Dépenses' },
          { name: 'tasks', label: 'Tâches' },
          { name: 'activity_logs', label: 'Journaux d\'Activité' }
        ],
        commonFields: {
          reservations: [
            'id', 'confirmation_code', 'reservation_status', 'scheduled_arrival_date',
            'scheduled_departure_date', 'adults', 'children',
            'total_estimated_revenue', 'special_notes', 'created_at', 'updated_at'
          ],
          guests: [
            'id', 'firstName', 'lastName', 'email', 'phoneNumber', 'dateOfBirth',
            'nationality', 'created_at', 'updated_at'
          ],
          rooms: [
            'id', 'room_number', 'room_name', 'floor_number', 'max_occupancy_adults',
            'room_status', 'housekeeping_status', 'maintenance_status'
          ],
          payments: [
            'id', 'amount', 'payment_date', 'payment_status', 'payment_method',
            'transaction_reference', 'created_at'
          ]
        },
        joinOptions: [
          { table: 'guests', on: 'reservations.guest_id' },
          { table: 'hotels', on: 'reservations.hotel_id' },
          { table: 'room_types', on: 'reservations.primary_room_type_id' },
          { table: 'booking_sources', on: 'reservations.booking_source_id' },
          { table: 'rate_plans', on: 'reservations.rate_plan_id' }
        ]
      }

      return response.ok({
        success: true,
        data: templates
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la récupération des modèles',
        error: error.message
      })
    }
  }

  /**
   * Export to CSV format
   */
  private exportToCSV(response: any, reportData: any, filename: string) {
    try {
      if (!reportData.data || reportData.data.length === 0) {
        return response.badRequest({
          success: false,
          message: 'Aucune donnée à exporter'
        })
      }

      // Get headers from first data row
      const headers = Object.keys(reportData.data[0])

      // Create CSV content
      let csvContent = headers.join(',') + '\n'

      reportData.data.forEach((row: any) => {
        const values = headers.map(header => {
          const value = row[header]
          // Escape commas and quotes in values
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`
          }
          return value || ''
        })
        csvContent += values.join(',') + '\n'
      })

      response.header('Content-Type', 'text/csv')
      response.header('Content-Disposition', `attachment; filename="${filename}"`)
      return response.send(csvContent)
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de l\'export CSV',
        error: error.message
      })
    }
  }

  /**
   * Export to PDF format (basic implementation)
   */
  /*   private exportToPDF(response: any, reportData: any, filename: string) {
      try {
        // For now, return JSON with PDF export instructions
        // In a real implementation, you would use a PDF library like puppeteer or jsPDF
        return response.ok({
          success: true,
          message: 'Export PDF non encore implémenté. Utilisez CSV pour le moment.',
          data: {
            reportTitle: reportData.title,
            generatedAt: reportData.generatedAt,
            totalRecords: reportData.totalRecords,
            summary: reportData.summary,
            filename: filename
          }
        })
      } catch (error) {
        return response.internalServerError({
          success: false,
          message: 'Erreur lors de l\'export PDF',
          error: error.message
        })
      }
    } */

  /**
   * Export to Excel format (basic implementation)
   */
  private exportToExcel(response: any, reportData: any, filename: string) {
    try {
      // For now, return JSON with Excel export instructions
      // In a real implementation, you would use a library like exceljs
      return response.ok({
        success: true,
        message: 'Export Excel non encore implémenté. Utilisez CSV pour le moment.',
        data: {
          reportTitle: reportData.title,
          generatedAt: reportData.generatedAt,
          totalRecords: reportData.totalRecords,
          summary: reportData.summary,
          filename: filename
        }
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de l\'export Excel',
        error: error.message
      })
    }
  }

  /**
   * Generate monthly occupancy PDF report
   */
  async generateMonthlyOccupancyPdf({ request, response, auth }: HttpContext) {
    try {
      const { hotelId, month, year } = request.qs()

      if (!hotelId || !month || !year) {
        return response.badRequest({
          success: false,
          message: 'Hotel ID, month, and year are required'
        })
      }

      // Create start and end dates for the month
      const startDate = DateTime.fromObject({ year: parseInt(year), month: parseInt(month), day: 1 })
      const endDate = startDate.endOf('month')

      // Import Reservation model
      const { default: Reservation } = await import('#models/reservation')

      // Get daily reservation counts for the month
      const dailyReservationCounts = await this.getDailyReservationCounts(
        parseInt(hotelId),
        startDate,
        endDate
      )

      // Get authenticated user information
      const user = auth.user
      const printedBy = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown User' : 'System'

      // Generate HTML content
      const htmlContent = this.generateMonthlyOccupancyHtml(dailyReservationCounts, startDate, printedBy)

      // Import PDF generation service
      const { default: PdfGenerationService } = await import('#services/pdf_generation_service')

      // Generate PDF
      const pdfBuffer = await PdfGenerationService.generatePdfFromHtml(htmlContent)

      // Set response headers
      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', `attachment; filename="monthly-reservations-${year}-${month}.pdf"`)

      return response.send(pdfBuffer)
    } catch (error) {
      console.error('Error generating monthly reservations PDF:', error)
      return response.internalServerError({
        success: false,
        message: 'Failed to generate monthly reservations PDF',
        error: error.message
      })
    }
  }

  /**
   * Generate room status report PDF
   */
  async generateRoomStatusReportPdf({ request, response, auth }: HttpContext) {
    try {
      const { hotelId, asOnDate } = request.only(['hotelId', 'asOnDate'])

      if (!hotelId || !asOnDate) {
        return response.badRequest({
          success: false,
          message: 'Hotel ID and asOnDate are required'
        })
      }

      // Parse the date
      const reportDate = DateTime.fromISO(asOnDate)
      if (!reportDate.isValid) {
        return response.badRequest({
          success: false,
          message: 'Invalid date format. Use YYYY-MM-DD format'
        })
      }

      // Import models
      const { default: Hotel } = await import('#models/hotel')
      // Get hotel information
      const hotel = await Hotel.findOrFail(hotelId)
      // Generate all sections data
      let auditDetails = await NightAuditService.getNightAuditDetails(
        reportDate,
        Number(hotelId)
      )
      let roomsByStatus: any = {};
      if (auditDetails && auditDetails?.roomStatusReportData) {
        roomsByStatus = auditDetails?.roomStatusReportData
      } else {
        roomsByStatus = this.generateNightAuditSections(hotelId, reportDate, 'XAF')
      }
      logger.info(roomsByStatus)
      // Get authenticated user information
      const user = auth.user
      const printedBy = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown User' : 'System'

      // Generate HTML content
      const htmlContent = this.generateRoomStatusReportHtml(
        hotel.hotelName,
        reportDate,
        roomsByStatus,
        printedBy
      )

      // Import PDF generation service
      const { default: PdfGenerationService } = await import('#services/pdf_generation_service')

      // Generate PDF
      const pdfBuffer = await PdfGenerationService.generatePdfFromHtml(htmlContent)

      // Set response headers
      const fileName = `room-status-report-${hotel.hotelName.replace(/\s+/g, '-')}-${reportDate.toFormat('yyyy-MM-dd')}.pdf`
      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', `attachment; filename="${fileName}"`)

      return response.send(pdfBuffer)
    } catch (error) {
      console.error('Error generating room status report PDF:', error)
      return response.internalServerError({
        success: false,
        message: 'Failed to generate room status report PDF',
        error: error.message
      })
    }
  }

  /**
   * Generate HTML content for room status report
   */
  private generateRoomStatusReportHtml(
    hotelName: string,
    reportDate: DateTime,
    roomsByStatus: any,
    printedBy: string = 'System'
  ): string {
    const formattedDate = reportDate.toFormat('dd/MM/yyyy')
    const currentDateTime = DateTime.now().toFormat('dd/MM/yyyy HH:mm:ss')

    // Calculate totals
    const totals = {
      occupied: roomsByStatus.occupied.length,
      dueOut: roomsByStatus.dueOut.length,
      vacant: roomsByStatus.vacant.length,
      departed: roomsByStatus.departed.length,
      reserved: roomsByStatus.reserved.length,
      blocked: roomsByStatus.blocked.length
    }

    const generateRoomList = (rooms: any[]) => {
      if (rooms.length === 0) {
        return ''
      }
      return rooms.map(room =>
        `<div style="display: inline-block; margin: 2px 2px; padding: 4px 8px; background: #f8f9fa; border: 1px solid #dee2e6;  font-size: 12px;">
          ${room.roomNumber}
        </div>`
      ).join('')
    }

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Room Status Report - ${hotelName}</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            margin: 20px;
            color: #333;
            line-height: 1.4;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            padding-bottom: 5px;
            border-bottom: 2px solid black;
        }
        .hotel-name {
            font-size: 18px;
            font-weight: bold;
        }
        .report-title {
            font-size: 18px;
            font-weight: bold;
            color:orange
        }
        .date-section {
            text-align: center;
            margin: 15px 0;
            font-size: 14px;
            font-weight: bold;
        }
        .horizontal-line {
            border-top: 1px solid #333;
            margin: 5px 0;
        }
        .section {
            margin: 20px 0;
        }
        .section-title {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 8px;
        }
        .room-list {
            margin: 10px 0;
            min-height: 30px;
        }
        .summary {
            margin: 30px 0;
        }
        .summary-title {
            text-align: center;
            font-size: 16px;
            font-weight: bold;
            margin: 15px 0;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            max-width: 500px;
            margin: 0 auto;
            text-align: center;
        }
        .summary-item {
            padding: 8px;
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            font-size: 14px;
            font-weight: bold;
        }
        .footer {
            margin-top: 40px;
            padding-top: 15px;
            border-top: 1px solid #333;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12px;
        }
        @media print {
            body { margin: 15px; }
            .header { page-break-after: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="hotel-name">${hotelName}</div>
        <div class="report-title">Room Status Report</div>
    </div>

    <div class="date-section">
        As on Date: ${formattedDate}
    </div>
    <div class="horizontal-line"></div>

    <!-- Occupied Rooms Section -->
    <div class="section">
        <div class="section-title">Occupied Rooms</div>
        <div class="horizontal-line"></div>
        <div class="room-list">
            ${generateRoomList(roomsByStatus.occupied)}
        </div>
        <div class="horizontal-line"></div>
    </div>

    <!-- Due Out Rooms Section -->
    <div class="section">
        <div class="section-title">Due Out Rooms</div>
        <div class="horizontal-line"></div>
        <div class="room-list">
            ${generateRoomList(roomsByStatus.dueOut)}
        </div>
        <div class="horizontal-line"></div>
    </div>

    <!-- Vacant Rooms Section -->
    <div class="section">
        <div class="section-title">Vacant Rooms</div>
        <div class="horizontal-line"></div>
        <div class="room-list">
            ${generateRoomList(roomsByStatus.vacant)}
        </div>
        <div class="horizontal-line"></div>
    </div>

    <!-- Departed Rooms Section -->
    <div class="section">
        <div class="section-title">Departed Rooms</div>
        <div class="horizontal-line"></div>
        <div class="room-list">
            ${generateRoomList(roomsByStatus.departed)}
        </div>
        <div class="horizontal-line"></div>
    </div>

    <!-- Reserve Rooms Section -->
    <div class="section">
        <div class="section-title">Reserve Rooms</div>
        <div class="horizontal-line"></div>
        <div class="room-list">
            ${generateRoomList(roomsByStatus.reserved)}
        </div>
        <div class="horizontal-line"></div>
    </div>

    <!-- Blocked Rooms Section -->
    <div class="section">
        <div class="section-title">Blocked Rooms</div>
        <div class="horizontal-line"></div>
        <div class="room-list">
            ${generateRoomList(roomsByStatus.blocked)}
        </div>
        <div class="horizontal-line"></div>
    </div>

    <!-- Summary Section -->
    <div class="summary">
        <div class="horizontal-line"></div>
        <div class="summary-title">Summary</div>
        <div class="horizontal-line"></div>
        <div class="summary-grid">
            <div class="summary-item">Occupied Rooms # ${totals.occupied}</div>
            <div class="summary-item">Departed Rooms # ${totals.departed}</div>
            <div class="summary-item">Due Out Rooms # ${totals.dueOut}</div>
            <div class="summary-item">Vacant Rooms # ${totals.vacant}</div>
            <div class="summary-item">Reserve Rooms # ${totals.reserved}</div>
            <div class="summary-item">Blocked Rooms # ${totals.blocked}</div>
        </div>
    </div>

    <!-- Footer -->
    <div class="footer">
        <div><strong>Printed On:</strong> ${currentDateTime}</div>
        <div><strong>Printed By:</strong> ${printedBy}</div>
        <div><strong>Page 1 of 1</strong></div>
    </div>
</body>
</html>
    `
  }

  /**
   * Generate HTML content for monthly occupancy report
   */
  /**
   * Get daily reservation counts for a month
   */
  private async getDailyReservationCounts(hotelId: number, startDate: DateTime, endDate: DateTime) {
    const { default: Reservation } = await import('#models/reservation')

    const daysInMonth = endDate.day
    const dailyCounts = []

    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = startDate.set({ day })

      // Count reservations for this day (arrivals)
      const reservationCount = await Reservation.query()
        .where('hotel_id', hotelId)
        .whereRaw('DATE(arrived_date) = ?', [currentDate.toSQLDate()])
        .whereNotIn('status', ['cancelled', 'voided'])
        .count('* as total')

      dailyCounts.push({
        day,
        reservationCount: parseInt(reservationCount[0].$extras.total) || 0
      })
    }

    return dailyCounts
  }

  private generateMonthlyOccupancyHtml(reservationData: any[], startDate: DateTime, printedBy: string = 'System'): string {
    const monthName = startDate.toFormat('MMMM yyyy')

    // Calculate chart data
    const maxReservations = Math.max(...reservationData.map(d => d.reservationCount), 1)
    const totalReservations = reservationData.reduce((sum, d) => sum + d.reservationCount, 0)
    const avgReservations = reservationData.length > 0
      ? (totalReservations / reservationData.length)?.toFixed(1)
      : '0.0'

    // Set a fixed y-axis max for better visualization
    const yAxisMax = Math.max(maxReservations, 10)
    const maxChartHeight = 350

    const chartData = reservationData.map(data => ({
      day: data.day,
      reservationCount: data.reservationCount,
      height: Math.max((data.reservationCount / yAxisMax) * maxChartHeight, 2)
    }))

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Monthly Reservations Report - ${monthName}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Inter', sans-serif;
            background-color: #f3f4f6;
            padding: 1.5rem;
            margin: 0;
        }
        .container {
            background-color: white;
            padding: 2rem;
            max-width: 64rem;
            margin-left: auto;
            margin-right: auto;
        }
        .header {
            text-align: center;
            margin-bottom: 2rem;
            border-bottom: 3px solid #ef4444;
            padding-bottom: 1.5rem;
        }
        .header-content {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            margin-top: 0.5rem;
        }
        .header-legend {
            background-color: #ef4444;
            color: white;
            padding: 0.25rem 0.5rem;
            border-radius: 0.375rem;
            font-size: 0.875rem;
        }
        .title {
            background-color: #ef4444;
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 0.5rem;
            display: inline-block;
            font-size: 1.5rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
        }
        .chart-container {
            margin: 2rem 0;
            position: relative;
            height: 450px;
            border: 1px solid #d1d5db;
            background-color: #f9fafb;
            padding: 1.5rem;
        }
        .chart-wrapper {
            position: absolute;
            top: 2rem;
            left: 5rem;
            right: 2rem;
            bottom: 5rem;
            border-left: 2px solid #1f2937;
            border-bottom: 2px solid #1f2937;
        }
        .chart {
            display: flex;
            align-items: flex-end;
            height: 100%;
            padding: 0 0.5rem;
            gap: 3px;
        }
        .bar {
            background-color: #ef4444;
            min-height: 2px;
            flex: 1;
            position: relative;
            border: 1px solid #b91c1c;
        }
        .bar-value {
            position: absolute;
            top: -1.25rem;
            left: 50%;
            transform: translateX(-50%);
            font-size: 0.65rem;
            color: #1f2937;
            font-weight: 700;
            white-space: nowrap;
        }
        .x-axis {
            position: absolute;
            bottom: -2rem;
            left: 0;
            right: 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .x-label {
            font-size: 0.75rem;
            color: #6b7280;
            text-align: center;
            flex: 1;
        }
        .y-axis {
            position: absolute;
            left: 1.5rem;
            top: 2rem;
            bottom: 5rem;
            height: calc(100% - 7rem);
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            align-items: flex-end;
            z-index: 2;
        }
        .y-label {
            font-size: 0.75rem;
            color: #6b7280;
            margin-right: 3px;
            line-height: 1;
            transform: translateY(50%);
        }
        .y-label-zero {
            position: relative;
            margin-right: 3px;
            display: flex;
            align-items: center;
            line-height: 1;
            transform: translateY(50%);
        }
        .red-flag {
            width: 8px;
            height: 8px;
            background-color: #ef4444;
            border-radius: 50%;
            margin-right: 0.25rem;
        }
        .grid-lines {
            position: absolute;
            left: 0;
            right: 0;
            top: 0;
            height: 100%;
            display: flex;
            flex-direction: column-reverse;
            justify-content: space-between;
            z-index: 1;
            padding-bottom: 0.2rem;
        }
        .grid-line {
            border-top: 1px dashed #e5e7eb;
            width: 100%;
        }
        .legend-container {
            display: flex;
            justify-content: space-around;
            margin-top: 0.5rem;
            padding: 0.5rem;
            background-color: #f1f5f9;
            border-radius: 0.5rem;
        }
        .legend-item {
            text-align: center;
        }
        .legend-value {
            font-size: 1rem;
            font-weight: 400;
            color: #1f2937;
        }
        .legend-label {
            font-size: 0.5rem;
            color: #6b7280;
            margin-top: 0.25rem;
        }
        .footer {
            margin-top: 2rem;
            text-align: center;
            font-size: 0.7rem;
            color: #9ca3af;
            border-top: 1px solid #e5e7eb;
            padding-top: 1rem;
            display: flex;
            justify-content: space-between;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="title">Monthly Reservations Report - ${monthName}</h1>
            <div class="header-content">
                <div class="header-legend">
                    ■ Daily Reservations
                </div>
            </div>
        </div>

        <div class="chart-container">
            <div class="y-axis">
                <div class="y-label">${Math.ceil(yAxisMax)}</div>
                <div class="y-label">${Math.ceil(yAxisMax * 0.75)}</div>
                <div class="y-label">${Math.ceil(yAxisMax * 0.5)}</div>
                <div class="y-label">${Math.ceil(yAxisMax * 0.25)}</div>
                <div class="y-label-zero"><span class="red-flag"></span>0</div>
            </div>
            <div class="chart-wrapper">
                <div class="grid-lines">
                    <div class="grid-line"></div>
                    <div class="grid-line"></div>
                    <div class="grid-line"></div>
                    <div class="grid-line"></div>
                </div>
                <div class="chart">
                    ${chartData.map(data => `
                        <div class="bar" style="height: ${data.height}px;">
                            <div class="bar-value">${data.reservationCount}</div>
                        </div>
                    `).join('')}
                </div>
                <div class="x-axis">
                    ${chartData.map(data => `<div class="x-label">${data.day}</div>`).join('')}
                </div>
            </div>
        </div>

        <div class="legend-container">
            <div class="legend-item">
                <div class="legend-value">${avgReservations}</div>
                <div class="legend-label">Average Daily Reservations</div>
            </div>
            <div class="legend-item">
                <div class="legend-value">${maxReservations}</div>
                <div class="legend-label">Peak Daily Reservations</div>
            </div>
            <div class="legend-item">
                <div class="legend-value">${totalReservations}</div>
                <div class="legend-label">Total Reservations</div>
            </div>
        </div>

        <div class="footer">
            <p>Printed On: ${DateTime.now().toFormat('dd/MM/yyyy HH:mm')}</p>
            <p>Printed By: ${printedBy}</p>
            <p>Page 1 of 1</p>
        </div>
    </div>
</body>
</html>
    `
  }

  /**
   * Generate Night Audit Report PDF
   */
  async generateNightAuditReportPdf({ request, response, auth }: HttpContext) {
    try {
      const { hotelId, asOnDate, currency } = request.only(['hotelId', 'asOnDate', 'currency'])

      // Validate required parameters
      if (!hotelId) {
        return response.badRequest({
          success: false,
          message: 'Hotel ID is required'
        })
      }

      if (!asOnDate) {
        return response.badRequest({
          success: false,
          message: 'As On Date is required'
        })
      }

      if (!currency) {
        return response.badRequest({
          success: false,
          message: 'Currency is required'
        })
      }

      // Parse and validate date
      const reportDate = DateTime.fromISO(asOnDate)
      if (!reportDate.isValid) {
        return response.badRequest({
          success: false,
          message: 'Invalid date format. Use ISO format (YYYY-MM-DD)'
        })
      }

      // Import required models
      const { default: Hotel } = await import('#models/hotel')

      // Get hotel information
      const hotel = await Hotel.findOrFail(hotelId)

      // Get authenticated user information
      const user = auth.user
      const printedBy = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown User' : 'System'

      // Generate all sections data
      const auditDetails = await NightAuditService.getNightAuditDetails(
        reportDate,
        Number(hotelId)
      )
      //const sectionsData = await this.generateNightAuditSections(hotelId, reportDate, currency)
      const sectionsData = auditDetails?.nightAuditReportData;
      // Generate HTML content
      const htmlContent = this.generateNightAuditReportHtml(
        hotel.hotelName,
        reportDate,
        currency,
        sectionsData,
        printedBy
      )

      // Import PDF generation service
      const { default: PdfGenerationService } = await import('#services/pdf_generation_service')

      // Generate PDF
      const pdfBuffer = await PdfGenerationService.generatePdfFromHtml(htmlContent)

      // Set response headers
      const fileName = `night-audit-report-${hotel.hotelName.replace(/\s+/g, '-')}-${reportDate.toFormat('yyyy-MM-dd')}.pdf`
      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', `attachment; filename="${fileName}"`)

      return response.send(pdfBuffer)
    } catch (error) {
      console.error('Error generating night audit report PDF:', error)
      return response.internalServerError({
        success: false,
        message: 'Failed to generate night audit report PDF',
        error: error.message
      })
    }
  }

  /**
   * Generate all sections data for Night Audit Report
   */
  public async generateNightAuditSections(hotelId: number, reportDate: DateTime, currency: string) {


    // Section 1: Room Charges
    const roomCharges = await this.getRoomChargesData(hotelId, reportDate, currency)

    // Section 2: Daily Sales
    const dailySales = await this.getDailySalesData(hotelId, reportDate, currency)

    // Section 3: Misc. Charges
    const miscCharges = await this.getMiscChargesData(hotelId, reportDate, currency)

    // Section 4: Room Status
    const roomStatus = await this.getRoomStatusData(hotelId, reportDate)

    // Section 5: Pax Status
    const paxStatus = await this.getPaxStatusData(hotelId, reportDate)

    // Section 6: Pax Analysis
    const paxAnalysis = await this.getPaxAnalysisData(hotelId, reportDate)

    return {
      roomCharges,
      dailySales,
      miscCharges,
      roomStatus,
      paxStatus,
      paxAnalysis
    }
  }

  /**
   * Section 1: Room Charges Data
   */
  private async getRoomChargesData(hotelId: number, reportDate: DateTime, currency: string) {
    const { default: Reservation } = await import('#models/reservation')

    const reservations = await Reservation.query()
      .where('hotel_id', hotelId)
      .where('arrived_date', '<=', reportDate.toFormat('yyyy-MM-dd'))
      .where('depart_date', '>', reportDate.toFormat('yyyy-MM-dd'))
      .whereIn('status', ['checked_in', 'confirmed'])
      .preload('reservationRooms', (roomQuery) => {
        roomQuery.preload('room')
        roomQuery.preload('roomType')
        roomQuery.preload('checkedInByUser')
        roomQuery.preload('roomRates', (rateQuery: any) => {
          rateQuery.preload('rateType')
        })
      })
      .preload('folios')
      .preload('guest')
      .preload('businessSource')
    // 

    const roomChargesData = []
    let totals = {
      normalTariff: 0,
      offeredTariff: 0,
      totalTax: 0,
      totalRent: 0,
      totalVariant: 0
    }

    for (const reservation of reservations) {
      for (const reservationRoom of reservation.reservationRooms) {
        if (reservationRoom.room) {
          const roomRate = reservationRoom.roomRates.baseRate
          const normalTariff = roomRate
          const offeredTariff = reservationRoom.roomRate ?? 0
          const taxAmount = reservationRoom.taxAmount || 0
          const totalRent = Number(offeredTariff) + Number(taxAmount)
          const variance = normalTariff > 0 ? ((roomRate - totalRent) / Number(normalTariff) * 100) : 0

          roomChargesData.push({
            room: `${reservationRoom.room.roomNumber} - ${reservationRoom.roomType?.roomTypeName}`,
            folioNo: reservation.folios?.[0]?.folioNumber,
            guest: reservation.guest ? `${reservation.guest.firstName} ${reservation.guest.lastName}` : '',
            source: reservation.businessSource?.name || '',
            company: reservation.companyName || '',
            rentDate: reservation.arrivedDate?.toFormat('dd/MM/yyyy') || 'N/A',
            rateType: reservationRoom.roomRates?.rateType?.rateTypeName,
            normalTariff,
            offeredTariff,
            totalTax: taxAmount,
            totalRent,
            variance: variance,
            checkinBy: reservationRoom.checkedInByUser ? `${reservationRoom.checkedInByUser.firstName} ${reservationRoom.checkedInByUser.lastName}` : 'N/A'
          })

          totals.normalTariff += Number(normalTariff)
          totals.offeredTariff += Number(offeredTariff)
          totals.totalTax += Number(taxAmount)
          totals.totalRent += Number(totalRent)
          totals.totalVariant += Number(variance)
        }
      }
    }

    return { data: roomChargesData, totals }
  }

  /**
   * Section 2: Daily Sales Data
   */
  private async getDailySalesData(hotelId: number, reportDate: DateTime, currency: string) {
    const { default: FolioTransaction } = await import('#models/folio_transaction')
    const { default: Reservation } = await import('#models/reservation')
    const { TransactionCategory, TransactionType, TransactionStatus } = await import('#app/enums')

    const salesData = []
    let totals = {
      roomCharges: 0,
      extraCharges: 0,
      roomTax: 0,
      extraTax: 0,
      discount: 0,
      adjustment: 0,
      totalSales: 0
    }

    const reportDateStr = reportDate.toFormat('yyyy-MM-dd')

    // 1. Room Sales - Regular room charges posted on the report date
    const roomSalesData = await this.getRoomSalesData(hotelId, reportDateStr, FolioTransaction, TransactionCategory, TransactionType, TransactionStatus)
    salesData.push(roomSalesData)
    this.addToTotals(totals, roomSalesData)

    // 2. Direct Room Sales - Direct sales transactions (walk-ins, etc.)
    const directRoomSalesData = await this.getDirectRoomSalesData(hotelId, reportDateStr, FolioTransaction, Reservation, TransactionCategory, TransactionType, TransactionStatus)
    salesData.push(directRoomSalesData)
    this.addToTotals(totals, directRoomSalesData)

    // 3. Cancellation Sales - Cancellation fees posted on the report date
    const cancellationSalesData = await this.getCancellationSalesData(hotelId, reportDateStr, FolioTransaction, TransactionCategory, TransactionType, TransactionStatus)
    salesData.push(cancellationSalesData)
    this.addToTotals(totals, cancellationSalesData)

    // 4. No Show Sales - No show fees posted on the report date
    const noShowSalesData = await this.getNoShowSalesData(hotelId, reportDateStr, FolioTransaction, TransactionCategory, TransactionType, TransactionStatus)
    salesData.push(noShowSalesData)
    this.addToTotals(totals, noShowSalesData)

    // 5. Day Use Sales - Same day check-in and check-out reservations
    const dayUseSalesData = await this.getDayUseSalesData(hotelId, reportDateStr, FolioTransaction, Reservation, TransactionCategory, TransactionType, TransactionStatus)
    salesData.push(dayUseSalesData)
    this.addToTotals(totals, dayUseSalesData)

    // 6. Late Checkout Sales - Late checkout fees posted on the report date
    const lateCheckoutSalesData = await this.getLateCheckoutSalesData(hotelId, reportDateStr, FolioTransaction, TransactionCategory, TransactionType, TransactionStatus)
    salesData.push(lateCheckoutSalesData)
    this.addToTotals(totals, lateCheckoutSalesData)

    // 7. Incidental Sales - Incidental charges posted on the report date
    const incidentalSalesData = await this.getIncidentalSalesData(hotelId, reportDateStr, FolioTransaction, TransactionCategory, TransactionType, TransactionStatus)
    salesData.push(incidentalSalesData)
    this.addToTotals(totals, incidentalSalesData)

    return { data: salesData, totals }
  }

  /**
   * Helper method to add sales data to totals
   */
  private addToTotals(totals: any, salesData: any) {
    totals.roomCharges += salesData.roomCharges || 0
    totals.extraCharges += salesData.extraCharges || 0
    totals.roomTax += salesData.roomTax || 0
    totals.extraTax += salesData.extraTax || 0
    totals.discount += salesData.discount || 0
    totals.adjustment += salesData.adjustment || 0
    totals.totalSales += salesData.totalSales || 0
  }

  /**
   * Get Room Sales Data - Regular room charges posted on the report date
   */
  private async getRoomSalesData(hotelId: number, reportDateStr: string, FolioTransaction: any, TransactionCategory: any, TransactionType: any, TransactionStatus: any) {
    const transactions = await FolioTransaction.query()
      .where('hotel_id', hotelId)
      .where('category', TransactionCategory.ROOM)
      .where('transaction_type', TransactionType.CHARGE)
      .where('status', TransactionStatus.POSTED)
      .whereRaw('DATE(created_at) = ?', [reportDateStr])

    const roomCharges = transactions.reduce((sum: number, t: any) => sum + Number((t.amount || 0)), 0)
    const roomTax = transactions.reduce((sum: number, t: any) => sum + Number((t.taxAmount || 0)), 0)
    const discount = transactions.reduce((sum: number, t: any) => sum + Number((t.discountAmount || 0)), 0)

    return {
      salesType: 'Room Sales',
      roomCharges,
      extraCharges: 0,
      roomTax,
      extraTax: 0,
      discount,
      adjustment: 0,
      totalSales: roomCharges + roomTax - discount
    }
  }

  /**
   * Get Direct Room Sales Data - Direct sales transactions (walk-ins, etc.)
   */
  private async getDirectRoomSalesData(hotelId: number, reportDateStr: string, FolioTransaction: any, Reservation: any, TransactionCategory: any, TransactionType: any, TransactionStatus: any) {
    // Get reservations that were created and checked in on the same day (walk-ins)
    const walkInReservations = await Reservation.query()
      .where('hotel_id', hotelId)
      .whereRaw('DATE(created_at) = ?', [reportDateStr])
      .whereRaw('DATE(arrived_date) = ?', [reportDateStr])
      .where('status', 'checked_in')

    const reservationIds = walkInReservations.map((r: any) => r.id)

    if (reservationIds.length === 0) {
      return {
        salesType: 'Direct Room Sales',
        roomCharges: 0,
        extraCharges: 0,
        roomTax: 0,
        extraTax: 0,
        discount: 0,
        adjustment: 0,
        totalSales: 0
      }
    }

    const transactions = await FolioTransaction.query()
      .where('hotel_id', hotelId)
      .whereIn('reservation_id', reservationIds)
      .where('category', TransactionCategory.ROOM)
      .where('transaction_type', TransactionType.CHARGE)
      .where('status', TransactionStatus.POSTED)

    const roomCharges = transactions.reduce((sum: number, t: any) => sum + Number((t.amount || 0)), 0)
    const roomTax = transactions.reduce((sum: number, t: any) => sum + Number((t.taxAmount || 0)), 0)
    const discount = transactions.reduce((sum: number, t: any) => sum + Number((t.discountAmount || 0)), 0)

    return {
      salesType: 'Direct Room Sales',
      roomCharges,
      extraCharges: 0,
      roomTax,
      extraTax: 0,
      discount,
      adjustment: 0,
      totalSales: roomCharges + roomTax - discount
    }
  }

  /**
   * Get Cancellation Sales Data - Cancellation fees posted on the report date
   */
  private async getCancellationSalesData(hotelId: number, reportDateStr: string, FolioTransaction: any, TransactionCategory: any, TransactionType: any, TransactionStatus: any) {
    const transactions = await FolioTransaction.query()
      .where('hotel_id', hotelId)
      .where('category', TransactionCategory.CANCELLATION_FEE)
      .where('transaction_type', TransactionType.CHARGE)
      .where('status', TransactionStatus.POSTED)
      .whereRaw('DATE(created_at) = ?', [reportDateStr])

    const extraCharges = transactions.reduce((sum: number, t: any) => sum + Number((t.amount || 0)), 0)
    const extraTax = transactions.reduce((sum: number, t: any) => sum + Number((t.taxAmount || 0)), 0)

    return {
      salesType: 'Cancellation Sales',
      roomCharges: 0,
      extraCharges,
      roomTax: 0,
      extraTax,
      discount: 0,
      adjustment: 0,
      totalSales: extraCharges + extraTax
    }
  }

  /**
   * Get No Show Sales Data - No show fees posted on the report date
   */
  private async getNoShowSalesData(hotelId: number, reportDateStr: string, FolioTransaction: any, TransactionCategory: any, TransactionType: any, TransactionStatus: any) {
    const transactions = await FolioTransaction.query()
      .where('hotel_id', hotelId)
      .where('category', TransactionCategory.NO_SHOW_FEE)
      .where('transaction_type', TransactionType.CHARGE)
      .where('status', TransactionStatus.POSTED)
      .whereRaw('DATE(created_at) = ?', [reportDateStr])

    const extraCharges = transactions.reduce((sum: number, t: any) => sum + Number((t.amount || 0)), 0)
    const extraTax = transactions.reduce((sum: number, t: any) => sum + Number((t.taxAmount || 0)), 0)

    return {
      salesType: 'No Show Sales',
      roomCharges: 0,
      extraCharges,
      roomTax: 0,
      extraTax,
      discount: 0,
      adjustment: 0,
      totalSales: extraCharges + extraTax
    }
  }

  /**
   * Get Day Use Sales Data - Same day check-in and check-out reservations
   */
  private async getDayUseSalesData(hotelId: number, reportDateStr: string, FolioTransaction: any, Reservation: any, TransactionCategory: any, TransactionType: any, TransactionStatus: any) {
    // Get reservations with same check-in and check-out date
    const dayUseReservations = await Reservation.query()
      .where('hotel_id', hotelId)
      .whereRaw('DATE(arrived_date) = DATE(depart_date)')
      .whereRaw('DATE(arrived_date) = ?', [reportDateStr])
      .whereIn('status', ['checked_in', 'checked_out'])

    const reservationIds = dayUseReservations.map((r: any) => r.id)

    if (reservationIds.length === 0) {
      return {
        salesType: 'Day Use Sales',
        roomCharges: 0,
        extraCharges: 0,
        roomTax: 0,
        extraTax: 0,
        discount: 0,
        adjustment: 0,
        totalSales: 0
      }
    }

    const transactions = await FolioTransaction.query()
      .where('hotel_id', hotelId)
      .whereIn('reservation_id', reservationIds)
      .where('category', TransactionCategory.ROOM)
      .where('transaction_type', TransactionType.CHARGE)
      .where('status', TransactionStatus.POSTED)

    const roomCharges = transactions.reduce((sum: number, t: any) => sum + Number((t.amount || 0)), 0)
    const roomTax = transactions.reduce((sum: number, t: any) => sum + Number((t.taxAmount || 0)), 0)
    const discount = transactions.reduce((sum: number, t: any) => sum + Number((t.discountAmount || 0)), 0)

    return {
      salesType: 'Day Use Sales',
      roomCharges,
      extraCharges: 0,
      roomTax,
      extraTax: 0,
      discount,
      adjustment: 0,
      totalSales: roomCharges + roomTax - discount
    }
  }

  /**
   * Get Late Checkout Sales Data - Late checkout fees posted on the report date
   */
  private async getLateCheckoutSalesData(hotelId: number, reportDateStr: string, FolioTransaction: any, TransactionCategory: any, TransactionType: any, TransactionStatus: any) {
    const transactions = await FolioTransaction.query()
      .where('hotel_id', hotelId)
      .where('category', TransactionCategory.LATE_CHECKOUT_FEE)
      .where('transaction_type', TransactionType.CHARGE)
      .where('status', TransactionStatus.POSTED)
      .whereRaw('DATE(created_at) = ?', [reportDateStr])

    const extraCharges = transactions.reduce((sum: number, t: any) => sum + Number((t.amount || 0)), 0)
    const extraTax = transactions.reduce((sum: number, t: any) => sum + Number((t.taxAmount || 0)), 0)

    return {
      salesType: 'Late Checkout Sales',
      roomCharges: 0,
      extraCharges,
      roomTax: 0,
      extraTax,
      discount: 0,
      adjustment: 0,
      totalSales: extraCharges + extraTax
    }
  }

  /**
   * Get Incidental Sales Data - Incidental charges posted on the report date
   */
  private async getIncidentalSalesData(hotelId: number, reportDateStr: string, FolioTransaction: any, TransactionCategory: any, TransactionType: any, TransactionStatus: any) {
    const incidentalCategories = [
      TransactionCategory.FOOD_BEVERAGE,
      TransactionCategory.TELEPHONE,
      TransactionCategory.LAUNDRY,
      TransactionCategory.MINIBAR,
      TransactionCategory.SPA,
      TransactionCategory.BUSINESS_CENTER,
      TransactionCategory.PARKING,
      TransactionCategory.INTERNET,
      TransactionCategory.INCIDENTAL,
      TransactionCategory.MISCELLANEOUS
    ]

    const transactions = await FolioTransaction.query()
      .where('hotel_id', hotelId)
      .whereIn('category', incidentalCategories)
      .where('transaction_type', TransactionType.CHARGE)
      .where('status', TransactionStatus.POSTED)
      .whereRaw('DATE(created_at) = ?', [reportDateStr])

    const extraCharges = transactions.reduce((sum: number, t: any) => sum + Number((t.amount || 0)), 0)
    const extraTax = transactions.reduce((sum: number, t: any) => sum + Number((t.taxAmount || 0)), 0)
    const discount = transactions.reduce((sum: number, t: any) => sum + Number((t.discountAmount || 0)), 0)

    return {
      salesType: 'Incidental Sales',
      roomCharges: 0,
      extraCharges,
      roomTax: 0,
      extraTax,
      discount,
      adjustment: 0,
      totalSales: Number(extraCharges) + Number(extraTax) - Number(discount)
    }
  }

  /**
   * Section 3: Misc. Charges Data
   */
  private async getMiscChargesData(hotelId: number, reportDate: DateTime, currency: string) {
    const { default: Transaction } = await import('#models/folio_transaction')

    const miscCharges = await Transaction.query()
      .where('hotel_id', hotelId)
      .whereRaw('DATE(transaction_date) = ?', [reportDate.toFormat('yyyy-MM-dd')])
      .where('transaction_type', 'charge')
      .whereNot('category', 'room')
      .preload('folio', (folioQuery) => {
        folioQuery.preload('reservation', (resQuery) => {
          resQuery.preload('guest')
          resQuery.preload('reservationRooms', (roomQuery) => {
            roomQuery.preload('room')
          })
        })
      })

    const miscChargesData = []
    let totals = { units: 0, amount: 0 }

    for (const charge of miscCharges) {
      const reservation = charge.folio?.reservation
      const room = reservation?.reservationRooms?.[0]?.room

      miscChargesData.push({
        room: room?.roomNumber,
        folioNo: charge.folio?.folioNumber,
        guest: reservation?.guest ? `${reservation.guest.firstName} ${reservation.guest.lastName}` : 'N/A',
        chargeDate: charge.createdAt.toFormat('dd/MM/yyyy'),
        voucherNo: charge.receiptNumber,
        charge: charge.description,
        unitPrice: charge.amount || 0,
        units: charge.quantity || 1,
        amount: (charge.amount || 0) * (charge.quantity || 1),
        enteredOn: charge.createdAt.toFormat('dd/MM/yyyy HH:mm'),
        remark: charge.notes
      })

      totals.units += charge.quantity || 1
      totals.amount += (charge.amount || 0) * (charge.quantity || 1)
    }

    return { data: miscChargesData, totals }
  }

  /**
   * Section 4: Room Status Data
   */
  private async getRoomStatusData(hotelId: number, reportDate: DateTime) {
    const { default: Room } = await import('#models/room')
    const { default: Reservation } = await import('#models/reservation')

    const totalRooms = await Room.query().where('hotel_id', hotelId).count('* as total')
    const totalRoomsCount = parseInt(totalRooms[0].$extras.total)

    // Get occupancy statistics for the date
    const occupied = await Reservation.query()
      .where('hotel_id', hotelId)
      .where('arrived_date', '<=', reportDate.toFormat('yyyy-MM-dd'))
      .where('depart_date', '>', reportDate.toFormat('yyyy-MM-dd'))
      .where('status', 'checked_in')
      .count('* as total')

    const dueOut = await Reservation.query()
      .where('hotel_id', hotelId)
      .where('depart_date', reportDate.toFormat('yyyy-MM-dd'))
      .where('status', 'checked_in')
      .count('* as total')

    const departed = await Reservation.query()
      .where('hotel_id', hotelId)
      .where('depart_date', reportDate.toFormat('yyyy-MM-dd'))
      .where('status', 'checked_out')
      .count('* as total')

    const reserved = await Reservation.query()
      .where('hotel_id', hotelId)
      .where('arrived_date', reportDate.toFormat('yyyy-MM-dd'))
      .where('status', 'confirmed')
      .count('* as total')

    const occupiedCount = parseInt(occupied[0].$extras.total)
    const dueOutCount = parseInt(dueOut[0].$extras.total)
    const departedCount = parseInt(departed[0].$extras.total)
    const reservedCount = parseInt(reserved[0].$extras.total)
    const vacantCount = totalRoomsCount - occupiedCount
    const blockedCount = 0 // You may need to implement room blocking logic

    return {
      date: reportDate.toFormat('dd/MM/yyyy'),
      totalRooms: totalRoomsCount,
      occupied: occupiedCount,
      dueOut: dueOutCount,
      vacant: vacantCount,
      departed: departedCount,
      reserved: reservedCount,
      blocked: blockedCount
    }
  }

  /**
   * Get room status report data for daily summary fact
   */
  public async getRoomStatusReportData(hotelId: number, reportDate: DateTime, currency: string) {
    // Import models
    const { default: Room } = await import('#models/room')
    const { default: Reservation } = await import('#models/reservation')
    // Get all rooms for the hotel
    const rooms = await Room.query()
      .where('hotel_id', hotelId)
      .preload('roomType')
      .orderBy('floor_number', 'asc')
      .orderBy('room_number', 'asc')

    // Get reservations for the specific date
    const reservations = await Reservation.query()
      .where('hotel_id', hotelId)
      .where('arrived_date', '<=', reportDate.toSQLDate())
      .where('depart_date', '>', reportDate.toSQLDate())
      .whereNotIn('status', ['cancelled', 'voided'])
      .preload('reservationRooms')
      .preload('guest')

    // Get room blocks for the specified date
    const { default: RoomBlock } = await import('#models/room_block')
    const roomBlocks = await RoomBlock.query()
      .where('hotel_id', hotelId)
      .where('block_from_date', '<=', reportDate.toFormat('yyyy-MM-dd'))
      .where('block_to_date', '>=', reportDate.toFormat('yyyy-MM-dd'))
      .where('status', '!=', 'completed')

    // Categorize rooms by status
    const roomsByStatus = {
      occupied: [] as any[],
      dueOut: [] as any[],
      vacant: [] as any[],
      departed: [] as any[],
      reserved: [] as any[],
      blocked: [] as any[]
    }

    // Get reservations checking out today
    const checkingOutToday = await Reservation.query()
      .where('hotel_id', hotelId)
      .where('depart_date', reportDate.toSQLDate())
      .where('status', 'checked_in')
      .preload('reservationRooms')

    // Get reservations arriving today
    const arrivingToday = await Reservation.query()
      .where('hotel_id', hotelId)
      .where('arrived_date', reportDate.toSQLDate())
      .where('status', 'confirmed')
      .preload('reservationRooms')

    // Get departed rooms (checked out today)
    const departedToday = await Reservation.query()
      .where('hotel_id', hotelId)
      .where('depart_date', reportDate.toSQLDate())
      .where('status', 'checked_out')
      .preload('reservationRooms')

    // Create sets for quick lookup
    const occupiedRoomIds = new Set<number>()
    const dueOutRoomIds = new Set<number>()
    const reservedRoomIds = new Set<number>()
    const departedRoomIds = new Set<number>()
    const blockedRoomIds = new Set<number>()

    // Process room blocks
    roomBlocks.forEach((block: any) => {
      blockedRoomIds.add(block.roomId)
    })

    // Process current reservations
    reservations.forEach(reservation => {
      reservation.reservationRooms.forEach(rr => {
        if (rr.roomId) {
          occupiedRoomIds.add(rr.roomId)
        }
      })
    })

    // Process due out rooms
    checkingOutToday.forEach(reservation => {
      reservation.reservationRooms.forEach(rr => {
        if (rr.roomId) {
          dueOutRoomIds.add(rr.roomId)
        }
      })
    })

    // Process arriving today (reserved)
    arrivingToday.forEach(reservation => {
      reservation.reservationRooms.forEach(rr => {
        if (rr.roomId) {
          reservedRoomIds.add(rr.roomId)
        }
      })
    })

    // Process departed rooms
    departedToday.forEach(reservation => {
      reservation.reservationRooms.forEach(rr => {
        if (rr.roomId) {
          departedRoomIds.add(rr.roomId)
        }
      })
    })

    // Categorize all rooms
    rooms.forEach(room => {
      const roomInfo = {
        roomNumber: room.roomNumber,
        roomType: room.roomType?.roomTypeName || 'Unknown',
        floorNumber: room.floorNumber
      }

      if (departedRoomIds.has(room.id)) {
        roomsByStatus.departed.push(roomInfo)
      } else if (dueOutRoomIds.has(room.id)) {
        roomsByStatus.dueOut.push(roomInfo)
      } else if (occupiedRoomIds.has(room.id)) {
        roomsByStatus.occupied.push(roomInfo)
      } else if (reservedRoomIds.has(room.id)) {
        roomsByStatus.reserved.push(roomInfo)
      } else if (blockedRoomIds.has(room.id)) {
        roomsByStatus.blocked.push(roomInfo)
      } else {
        roomsByStatus.vacant.push(roomInfo)
      }
    })
    return roomsByStatus;
  }

  /**
   * Section 5: Pax Status Data
   */
  private async getPaxStatusData(hotelId: number, reportDate: DateTime) {
    const { default: Reservation } = await import('#models/reservation')

    // Due Out guests
    const dueOutReservations = await Reservation.query()
      .where('hotel_id', hotelId)
      .where('depart_date', reportDate.toFormat('yyyy-MM-dd'))
      .where('status', 'checked_in')
      .preload('reservationRooms')

    // Stayover guests
    const stayoverReservations = await Reservation.query()
      .where('hotel_id', hotelId)
      .where('arrived_date', '<', reportDate.toFormat('yyyy-MM-dd'))
      .where('depart_date', '>', reportDate.toFormat('yyyy-MM-dd'))
      .where('status', 'checked_in')
      .preload('reservationRooms')

    const calculatePax = (reservations: any[]) => {
      let rooms = 0, adults = 0, children = 0

      reservations.forEach(reservation => {
        reservation.reservationRooms.forEach((rr: any) => {
          rooms += 1
          adults += rr.adults || 1
          children += rr.children || 0
        })
      })

      return { rooms, adults, children }
    }

    const dueOutPax = calculatePax(dueOutReservations)
    const stayoverPax = calculatePax(stayoverReservations)

    return [
      {
        status: 'Due Out',
        rooms: dueOutPax.rooms,
        adults: dueOutPax.adults,
        children: dueOutPax.children
      },
      {
        status: 'Stayover',
        rooms: stayoverPax.rooms,
        adults: stayoverPax.adults,
        children: stayoverPax.children
      }
    ]
  }

  /**
   * Section 6: Pax Analysis Data
   */
  private async getPaxAnalysisData(hotelId: number, reportDate: DateTime) {
    const { default: Reservation } = await import('#models/reservation')

    const reservations = await Reservation.query()
      .where('hotel_id', hotelId)
      .where('arrived_date', '<=', reportDate.toFormat('yyyy-MM-dd'))
      .where('depart_date', '>', reportDate.toFormat('yyyy-MM-dd'))
      .where('status', 'checked_in')
      .preload('reservationRooms', (roomQuery) => {
        roomQuery.preload('roomRates', (rateQuery) => {
          rateQuery.preload('rateType')
        })
      })

    const rateTypeAnalysis: { [key: string]: { adults: number, children: number } } = {}

    reservations.forEach(reservation => {
      reservation.reservationRooms.forEach((rr: any) => {
        const rateTypeName = rr.roomRates?.rateType?.rateTypeName
        if (!rateTypeAnalysis[rateTypeName]) {
          rateTypeAnalysis[rateTypeName] = { adults: 0, children: 0 }
        }

        rateTypeAnalysis[rateTypeName].adults += rr.adults || 1
        rateTypeAnalysis[rateTypeName].children += rr.children || 0
      })
    })

    return Object.entries(rateTypeAnalysis)
      .filter(([_, data]) => data.adults > 0)
      .map(([rateType, data]) => ({
        rateType,
        adults: data.adults,
        children: data.children
      }))
  }

  /**
   * Generate HTML content for Night Audit Report
   */
  private generateNightAuditReportHtml(
    hotelName: string,
    reportDate: DateTime,
    currency: string,
    sectionsData: any,
    printedBy: string = 'System'
  ): string {
    const formattedDate = reportDate.toFormat('dd/MM/yyyy')
    const currentDateTime = DateTime.now().toFormat('dd/MM/yyyy HH:mm:ss')

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Night Audit Report - ${hotelName}</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            margin: 15px;
            color: #333;
            line-height: 1.3;
            font-size: 12px;
        }
        .page-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            padding-bottom: 5px;
            border-bottom: 2px solid black;
        }
        .hotel-name {
            font-size: 16px;
            font-weight: bold;
        }
        .report-title {
            font-size: 16px;
            font-weight: bold;
        }
        .report-info {
            margin: 10px 0;
            font-weight: bold;
        }
        .horizontal-line {
            border-top: 1px solid #333;
            margin: 5px 0;
        }
        .dotted-line {
            border-top: 1px dotted #333;
            margin: 5px 0;
        }
        .section {
            margin: 15px 0;
            page-break-inside: avoid;
        }
        .section-title {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .data-table {
            width: 100%;
            border-collapse: collapse;
            margin: 5px 0;
            font-size: 10px;
        }
        .data-table th {
            background-color: #f5f5f5;
            border: 1px solid #333;
            padding: 4px 2px;
            text-align: center;
            font-weight: bold;
        }
        .data-table td {
            border: 1px solid #333;
            padding: 3px 2px;
            text-align: left;
        }
        .data-table td.number {
            text-align: right;
        }
        .data-table td.center {
            text-align: center;
        }
        .totals-row {
            background-color: #f0f0f0;
            font-weight: bold;
        }
        .footer {
            position: fixed;
            bottom: 15px;
            left: 15px;
            right: 15px;
            padding-top: 10px;
            border-top: 1px solid #333;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 10px;
        }
        @media print {
            body { margin: 10px; }
            .page-header { page-break-after: avoid; }
            .section { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <!-- Page Header -->
    <div class="page-header">
        <div class="hotel-name">${hotelName}</div>
        <div class="report-title">Night Audit</div>
    </div>

    <!-- Report Info -->
    <div class="report-info">
        As On Date: ${formattedDate} &nbsp;&nbsp;&nbsp;&nbsp; Currency: ${currency}
    </div>
    <div class="horizontal-line"></div>

    <!-- Section 1: Room Charges -->
    <div class="section">
        <div class="section-title">Room Charges</div>
        <div class="horizontal-line"></div>
        <table class="data-table">
            <thead>
                <tr>
                    <th>Room</th>
                    <th>Folio No.</th>
                    <th>Guest</th>
                    <th>Source</th>
                    <th>Company</th>
                    <th>Rent Date</th>
                    <th>Rate Type</th>
                    <th>Nrml.Tariff</th>
                    <th>Ofrd.Tariff</th>
                    <th>Total Tax</th>
                    <th>Total Rent</th>
                    <th>Var %</th>
                    <th>Checkin By</th>
                </tr>
            </thead>
            <tbody>
                ${sectionsData.roomCharges.data.map((row: any) => `
                <tr>
                    <td>${row.room}</td>
                    <td class="center">${row.folioNo}</td>
                    <td>${row.guest}</td>
                    <td>${row.source}</td>
                    <td>${row.company}</td>
                    <td class="center">${row.rentDate}</td>
                    <td>${row.rateType}</td>
                    <td class="number">${row.normalTariff}</td>
                    <td class="number">${row.offeredTariff}</td>
                    <td class="number">${row.totalTax}</td>
                    <td class="number">${row.totalRent}</td>
                    <td class="number">${row.variance}</td>
                    <td>${row.checkinBy}</td>
                </tr>
                `).join('')}
                <tr class="totals-row">
                    <td colspan="7"><strong>Total (${currency}):</strong></td>
                    <td class="number"><strong>${sectionsData.roomCharges.totals.normalTariff}</strong></td>
                    <td class="number"><strong>${sectionsData.roomCharges.totals.offeredTariff}</strong></td>
                    <td class="number"><strong>${sectionsData.roomCharges.totals.totalTax}</strong></td>
                    <td class="number"><strong>${sectionsData.roomCharges.totals.totalRent}</strong></td>
                    <td class="number"><strong>${sectionsData.roomCharges.totals.totalVariant}</strong></td>
                    <td></td>
                </tr>
            </tbody>
        </table>
        <div class="dotted-line"></div>
    </div>

    <!-- Section 2: Daily Sales -->
    <div class="section">
        <div class="section-title">Daily Sales</div>
        <div class="horizontal-line"></div>
        <table class="data-table">
            <thead>
                <tr>
                    <th>Sales Type</th>
                    <th>Room Charges (${currency})</th>
                    <th>Extra Charges (${currency})</th>
                    <th>Room Tax (${currency})</th>
                    <th>Extra Tax (${currency})</th>
                    <th>Discount (${currency})</th>
                    <th>Adjustment (${currency})</th>
                    <th>Total Sales (${currency})</th>
                </tr>
            </thead>
            <tbody>
                ${sectionsData.dailySales.data.map((row: any) => `
                <tr>
                    <td>${row.salesType}</td>
                    <td class="number">${row.roomCharges}</td>
                    <td class="number">${row.extraCharges}</td>
                    <td class="number">${row.roomTax}</td>
                    <td class="number">${row.extraTax}</td>
                    <td class="number">${row.discount}</td>
                    <td class="number">${row.adjustment}</td>
                    <td class="number">${row.totalSales}</td>
                </tr>
                `).join('')}
                <tr class="totals-row">
                    <td><strong>Total:</strong></td>
                    <td class="number"><strong>${sectionsData.dailySales.totals.roomCharges}</strong></td>
                    <td class="number"><strong>${sectionsData.dailySales.totals.extraCharges}</strong></td>
                    <td class="number"><strong>${sectionsData.dailySales.totals.roomTax}</strong></td>
                    <td class="number"><strong>${sectionsData.dailySales.totals.extraTax}</strong></td>
                    <td class="number"><strong>${sectionsData.dailySales.totals.discount}</strong></td>
                    <td class="number"><strong>${sectionsData.dailySales.totals.adjustment}</strong></td>
                    <td class="number"><strong>${sectionsData.dailySales.totals.totalSales}</strong></td>
                </tr>
            </tbody>
        </table>
        <div class="dotted-line"></div>
    </div>

    <!-- Section 3: Misc. Charges -->
    <div class="section">
        <div class="section-title">Misc. Charges</div>
        <div class="horizontal-line"></div>
        <table class="data-table">
            <thead>
                <tr>
                    <th>Room</th>
                    <th>Folio No.</th>
                    <th>Guest</th>
                    <th>Charge Date</th>
                    <th>Voucher No</th>
                    <th>Charge</th>
                    <th>Unit Price (${currency})</th>
                    <th>Unit (Q'ty)</th>
                    <th>Amount (${currency})</th>
                    <th>Entered On</th>
                    <th>Remark</th>
                </tr>
            </thead>
            <tbody>
                ${sectionsData.miscCharges.data.map((row: any) => `
                <tr>
                    <td>${row.room}</td>
                    <td class="center">${row.folioNo}</td>
                    <td>${row.guest}</td>
                    <td class="center">${row.chargeDate}</td>
                    <td class="center">${row.voucherNo}</td>
                    <td>${row.charge}</td>
                    <td class="number">${row.unitPrice}</td>
                    <td class="number">${row.units}</td>
                    <td class="number">${row.amount}</td>
                    <td class="center">${row.enteredOn}</td>
                    <td>${row.remark}</td>
                </tr>
                `).join('')}
                <tr class="totals-row">
                    <td colspan="7"><strong>Total:</strong></td>
                    <td class="number"><strong>${sectionsData.miscCharges.totals.units}</strong></td>
                    <td class="number"><strong>${sectionsData.miscCharges.totals.amount}</strong></td>
                    <td colspan="2"></td>
                </tr>
            </tbody>
        </table>
        <div class="dotted-line"></div>
    </div>

    <!-- Section 4: Room Status -->
    <div class="section">
        <div class="section-title">Room Status</div>
        <div class="horizontal-line"></div>
        <table class="data-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Total Rooms</th>
                    <th>Occupied</th>
                    <th>Due Out</th>
                    <th>Vacant</th>
                    <th>Departed</th>
                    <th>Reserve</th>
                    <th>Blocked</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td class="center">${sectionsData.roomStatus.date}</td>
                    <td class="number">${sectionsData.roomStatus.totalRooms}</td>
                    <td class="number">${sectionsData.roomStatus.occupied}</td>
                    <td class="number">${sectionsData.roomStatus.dueOut}</td>
                    <td class="number">${sectionsData.roomStatus.vacant}</td>
                    <td class="number">${sectionsData.roomStatus.departed}</td>
                    <td class="number">${sectionsData.roomStatus.reserved}</td>
                    <td class="number">${sectionsData.roomStatus.blocked}</td>
                </tr>
            </tbody>
        </table>
        <div class="dotted-line"></div>
    </div>

    <!-- Section 5: Pax Status -->
    <div class="section">
        <div class="section-title">Pax Status</div>
        <div class="horizontal-line"></div>
        <table class="data-table">
            <thead>
                <tr>
                    <th>Status</th>
                    <th>Rooms</th>
                    <th>Adult</th>
                    <th>Child</th>
                </tr>
            </thead>
            <tbody>
                ${sectionsData.paxStatus.map((row: any) => `
                <tr>
                    <td>${row.status}</td>
                    <td class="number">${row.rooms}</td>
                    <td class="number">${row.adults}</td>
                    <td class="number">${row.children}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
        <div class="dotted-line"></div>
    </div>

    <!-- Section 6: Pax Analysis -->
    <div class="section">
        <div class="section-title">Pax Analysis</div>
        <div class="horizontal-line"></div>
        <table class="data-table">
            <thead>
                <tr>
                    <th>Rate Type</th>
                    <th>Adult</th>
                    <th>Child</th>
                </tr>
            </thead>
            <tbody>
                ${sectionsData.paxAnalysis.map((row: any) => `
                <tr>
                    <td>${row.rateType}</td>
                    <td class="number">${row.adults}</td>
                    <td class="number">${row.children}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
        <div class="dotted-line"></div>
    </div>

    <!-- Footer -->
    <div class="footer">
        <div><strong>Printed On:</strong> ${currentDateTime}</div>
        <div><strong>Printed By:</strong> ${printedBy}</div>
        <div><strong>Page 1 of 1</strong></div>
    </div>
</body>
</html>
    `
  }

  /**
   * Get report statistics and analytics
   */
  async getReportStats({ request, response }: HttpContext) {
    try {
      const { hotelId } = request.qs()

      const filters: ReportFilters = {
        hotelId: hotelId ? parseInt(hotelId) : undefined,
        startDate: DateTime.now().startOf('month').toISO(),
        endDate: DateTime.now().endOf('month').toISO()
      }

      // Get key statistics for dashboard
      const [occupancyData, revenueData, arrivalData] = await Promise.all([
        ReportsService.getOccupancyReport(filters),
        ReportsService.getRevenueReport(filters),
        ReportsService.getArrivalList(filters)
      ])

      const stats = {
        occupancy: {
          current: occupancyData.summary?.averageOccupancyRate || 0,
          max: occupancyData.summary?.maxOccupancyRate || 0,
          min: occupancyData.summary?.minOccupancyRate || 0
        },
        revenue: {
          total: revenueData.summary?.totalRevenue || 0,
          average: revenueData.summary?.averageDailyRevenue || 0,
          reservations: revenueData.summary?.totalReservations || 0
        },
        arrivals: {
          today: arrivalData.totalRecords || 0,
          totalRevenue: arrivalData.summary?.totalRevenue || 0,
          totalNights: arrivalData.summary?.totalNights || 0
        }
      }

      return response.ok({
        success: true,
        data: stats
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la récupération des statistiques',
        error: error.message
      })
    }
  }

  /**
   * Generate Management Report PDF
   */
  async generateManagementReportPdf({ request, response, auth }: HttpContext) {
    try {
      const { hotelId, asOnDate, currency } = request.only(['hotelId', 'asOnDate', 'currency'])

      // Validate required parameters
      if (!hotelId) {
        return response.badRequest({
          success: false,
          message: 'Hotel ID is required'
        })
      }

      if (!asOnDate) {
        return response.badRequest({
          success: false,
          message: 'As On Date is required'
        })
      }

      if (!currency) {
        return response.badRequest({
          success: false,
          message: 'Currency is required'
        })
      }

      // Parse and validate date
      const reportDate = DateTime.fromISO(asOnDate)
      if (!reportDate.isValid) {
        return response.badRequest({
          success: false,
          message: 'Invalid date format. Use ISO format (YYYY-MM-DD)'
        })
      }

      // Import required models
      const { default: Hotel } = await import('#models/hotel')

      // Get hotel information
      const hotel = await Hotel.findOrFail(hotelId)

      // Get authenticated user information
      const user = auth.user
      const printedBy = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown User' : 'System'

      // Generate all sections data
      let sectionsData: any = {}
      const auditDetails = await NightAuditService.getNightAuditDetails(
        reportDate,
        Number(hotelId)
      )
      if (auditDetails && auditDetails?.managerReportData) {
        sectionsData = auditDetails?.managerReportData;
      } else {
        sectionsData = await this.generateManagementReportSections(hotelId, reportDate, currency)
      }

      // Generate HTML content using Edge template
      const htmlContent = await this.generateManagementReportHtml(
        hotel.hotelName,
        reportDate,
        currency,
        sectionsData,
        printedBy
      )

      // Import PDF generation service
      const { default: PdfGenerationService } = await import('#services/pdf_generation_service')

      // Generate PDF
      const pdfBuffer = await PdfGenerationService.generatePdfFromHtml(htmlContent)

      // Set response headers
      const fileName = `management-report-${hotel.hotelName.replace(/\s+/g, '-')}-${reportDate.toFormat('yyyy-MM-dd')}.pdf`
      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', `attachment; filename="${fileName}"`)

      return response.send(pdfBuffer)
    } catch (error) {
      console.error('Error generating management report PDF:', error)
      return response.internalServerError({
        success: false,
        message: 'Failed to generate management report PDF',
        error: error.message
      })
    }
  }

  /**
   * Generate all sections data for Management Report
   */
  public async generateManagementReportSections(hotelId: number, reportDate: DateTime, currency: string) {
    // Calculate PTD (Period To Date) - first day of month to report date
    const ptdStartDate = reportDate.startOf('month')

    // Calculate YTD (Year To Date) - first day of year to report date
    const ytdStartDate = reportDate.startOf('year')

    // Section 1: Room Charges
    const roomCharges = await this.getManagementRoomChargesData(hotelId, reportDate, ptdStartDate, ytdStartDate, currency)

    // Section 2: Extra Charges
    const extraCharges = await this.getManagementExtraChargesData(hotelId, reportDate, ptdStartDate, ytdStartDate)

    // Section 3: Discounts
    const discounts = await this.getManagementDiscountData(hotelId, reportDate, ptdStartDate, ytdStartDate)

    // Section 4: Adjustments
    const adjustments = await this.getManagementAdjustmentsData(hotelId, reportDate, ptdStartDate, ytdStartDate)

    // Section 5: Tax
    const tax = await this.getManagementTaxData(hotelId, reportDate, ptdStartDate, ytdStartDate)

    // Section 6: Payments
    const payments = await this.getManagementPaymentData(hotelId, reportDate, ptdStartDate, ytdStartDate)

    // Section 7: City Ledger
    const cityLedger = await this.getManagementCityLedgerData(hotelId, reportDate, ptdStartDate, ytdStartDate, currency)

    // Section 8: Advance Deposit Ledger
    const advanceDepositLedger = await this.getManagementAdvanceDepositLedgerData(hotelId, reportDate, ptdStartDate, ytdStartDate, currency)

    // Section 9: Guest Ledger
    const guestLedger = await this.getManagementGuestLedgerData(hotelId, reportDate, ptdStartDate, ytdStartDate, currency)

    // Section 10: Room Summary
    const roomSummary = await this.getManagementRoomSummaryData(hotelId, reportDate)

    // Section 11: Statistics
    const statistics = await this.getManagementStatisticsData(hotelId, reportDate, roomCharges, roomSummary)
    // section 12
    const posSummary = await this.getManagementPosSummaryData(hotelId, reportDate);
    // section 13
    const posPayment = await this.getManagementPosPaymentSummaryData(hotelId, reportDate);
    // Section 14: Revenue Summary
    const revenueSummary = await this.getManagementRevenueSummaryData(roomCharges, extraCharges)

    return {
      roomCharges,
      extraCharges,
      discounts,
      adjustments,
      tax,
      payments,
      cityLedger,
      advanceDepositLedger,
      guestLedger,
      roomSummary,
      statistics,
      posSummary,
      posPayment,
      revenueSummary
    }
  }

  /**
   * Generate HTML content for Management Report using Edge template
   */
  private async generateManagementReportHtml(
    hotelName: string,
    reportDate: DateTime,
    currency: string,
    sectionsData: any,
    printedBy: string = 'System'
  ): Promise<string> {
    const { default: edge } = await import('edge.js')
    const path = await import('path')
    logger.info(sectionsData)

    // Configure Edge with views directory
    edge.mount(path.join(process.cwd(), 'resources/views'))

    // Format dates
    const asOnDate = reportDate.toFormat('dd/MM/yyyy')
    const ptdDate = reportDate.startOf('month').toFormat('dd/MM/yyyy')
    const ytdDate = reportDate.startOf('year').toFormat('dd/MM/yyyy')
    const printedOn = DateTime.now().toFormat('dd/MM/yyyy HH:mm:ss')

    // Helper function for currency formatting
    const formatCurrency = (amount: number | null | undefined): string => {
      if (amount === null || amount === undefined || isNaN(amount)) {
        return '0.00'
      }
      return amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
    }

    // Calculate totals
    const totals = {
      revenueWithoutTax: {
        today: (sectionsData.roomCharges?.total?.today || 0) + (sectionsData.extraCharges?.today || 0) - (sectionsData.discounts?.today || 0) + (sectionsData.adjustments?.today || 0),
        ptd: (sectionsData.roomCharges?.total?.ptd || 0) + (sectionsData.extraCharges?.ptd || 0) - (sectionsData.discounts?.ptd || 0) + (sectionsData.adjustments?.ptd || 0),
        ytd: (sectionsData.roomCharges?.total?.ytd || 0) + (sectionsData.extraCharges?.ytd || 0) - (sectionsData.discounts?.ytd || 0) + (sectionsData.adjustments?.ytd || 0)
      },
      revenueWithTax: {
        today: 0, // Will be calculated with tax
        ptd: 0,
        ytd: 0
      },
      posToPs: {
        today: 0, // Placeholder
        ptd: 0,
        ytd: 0
      },
      transferToGuestLedger: {
        today: 0, // Placeholder
        ptd: 0,
        ytd: 0
      }
    }

    // Calculate revenue with tax
    totals.revenueWithTax.today = totals.revenueWithoutTax.today + (sectionsData.tax?.today || 0)
    totals.revenueWithTax.ptd = totals.revenueWithoutTax.ptd + (sectionsData.tax?.ptd || 0)
    totals.revenueWithTax.ytd = totals.revenueWithoutTax.ytd + (sectionsData.tax?.ytd || 0)
    logger.info(sectionsData)
    // Prepare template data
    const templateData = {
      hotelName,
      asOnDate,
      ptdDate,
      ytdDate,
      currency,
      printedOn,
      printedBy,
      currentPage: 1,
      totalPages: 1, // Will be calculated by PDF service
      content: {
        ...sectionsData,
        totals
      },
      formatCurrency
    }

    // Render template
    return await edge.render('reports/management_report', templateData)
  }

  /**
   * Get Room Charges data for Management Report
   */
  private async getManagementRoomChargesData(hotelId: number, reportDate: DateTime, ptdStartDate: DateTime, ytdStartDate: DateTime, currency: string) {
    try {
      const { default: FolioTransaction } = await import('#models/folio_transaction')

      // Today's room charges
      const todayRoomCharges = await FolioTransaction.query()
        .whereHas('folio', (folioQuery) => {
          folioQuery.whereHas('reservation', (reservationQuery) => {
            reservationQuery.where('hotel_id', hotelId)
          })
        })
        .where('transaction_date', reportDate.toFormat('yyyy-MM-dd'))
        .where('category', 'room')
        .whereNotIn('status', ['cancelled', 'void'])

      // PTD room charges
      const ptdRoomCharges = await FolioTransaction.query()
        .whereHas('folio', (folioQuery) => {
          folioQuery.whereHas('reservation', (reservationQuery) => {
            reservationQuery.where('hotel_id', hotelId)
          })
        })
        .whereBetween('transaction_date', [ptdStartDate.toFormat('yyyy-MM-dd'), reportDate.toFormat('yyyy-MM-dd')])
        .where('category', 'room')
        .whereNotIn('status', ['cancelled', 'void'])

      // YTD room charges
      const ytdRoomCharges = await FolioTransaction.query()
        .whereHas('folio', (folioQuery) => {
          folioQuery.whereHas('reservation', (reservationQuery) => {
            reservationQuery.where('hotel_id', hotelId)
          })
        })
        .whereBetween('transaction_date', [ytdStartDate.toFormat('yyyy-MM-dd'), reportDate.toFormat('yyyy-MM-dd')])
        .where('category', 'room')
        .whereNotIn('status', ['cancelled', 'void'])

      // Cancellation Revenue
      const todayCancellation = await this.getCancellationRevenue(hotelId, reportDate, reportDate)
      const ptdCancellation = await this.getCancellationRevenue(hotelId, ptdStartDate, reportDate)
      const ytdCancellation = await this.getCancellationRevenue(hotelId, ytdStartDate, reportDate)

      // No Show Revenue
      const todayNoShow = await this.getNoShowRevenue(hotelId, reportDate, reportDate)
      const ptdNoShow = await this.getNoShowRevenue(hotelId, ptdStartDate, reportDate)
      const ytdNoShow = await this.getNoShowRevenue(hotelId, ytdStartDate, reportDate)
      return {
        roomCharges: {
          today: todayRoomCharges.reduce((acc, cur) => acc + Number(cur.amount), 0),
          ptd: ptdRoomCharges.reduce((acc, cur) => acc + Number(cur.amount), 0),
          ytd: ytdRoomCharges.reduce((acc, cur) => acc + Number(cur.amount), 0)
        },
        cancellationRevenue: {
          today: todayCancellation,
          ptd: ptdCancellation,
          ytd: ytdCancellation
        },
        noShowRevenue: {
          today: todayNoShow,
          ptd: ptdNoShow,
          ytd: ytdNoShow
        },
        total: {
          today: todayRoomCharges.reduce((acc, cur) => acc + Number(cur.amount), 0) + Number(todayCancellation) + Number(todayNoShow),
          ptd: ptdRoomCharges.reduce((acc, cur) => acc + Number(cur.amount), 0) + Number(ptdCancellation) + Number(ptdNoShow),
          ytd: ytdRoomCharges.reduce((acc, cur) => acc + Number(cur.amount), 0) + Number(ytdCancellation) + Number(ytdNoShow)
        }
      }
    } catch (error) {
      console.error('Error in getManagementRoomChargesData:', error)
      return {
        roomCharges: { today: 0, ptd: 0, ytd: 0 },
        cancellationRevenue: { today: 0, ptd: 0, ytd: 0 },
        noShowRevenue: { today: 0, ptd: 0, ytd: 0 },
        total: { today: 0, ptd: 0, ytd: 0 }
      }
    }
  }

  /**
   * Get Cancellation Revenue
   */
  private async getCancellationRevenue(hotelId: number, startDate: DateTime, endDate: DateTime) {
    const { default: FolioTransaction } = await import('#models/folio_transaction')

    const result = await FolioTransaction.query()
      .whereHas('folio', (folioQuery) => {
        folioQuery.whereHas('reservation', (reservationQuery) => {
          reservationQuery.where('hotel_id', hotelId)
            .where('status', ReservationStatus.CANCELLED)
        })
      })
      .whereBetween('transaction_date', [startDate.toFormat('yyyy-MM-dd'), endDate.toFormat('yyyy-MM-dd')])
      .where('category', TransactionCategory.CANCELLATION_FEE)
      .whereNotIn('status', ['cancelled', 'void'])

    return result.reduce((acc, cur) => acc + Number(cur.amount), 0)
  }

  /**
   * Get No Show Revenue
   */
  private async getNoShowRevenue(hotelId: number, startDate: DateTime, endDate: DateTime) {
    const { default: FolioTransaction } = await import('#models/folio_transaction')

    const result = await FolioTransaction.query()
      .whereHas('folio', (folioQuery) => {
        folioQuery.whereHas('reservation', (reservationQuery) => {
          reservationQuery.where('hotel_id', hotelId)
            .where('status', ReservationStatus.NOSHOW)
        })
      })
      .whereBetween('transaction_date', [startDate.toFormat('yyyy-MM-dd'), endDate.toFormat('yyyy-MM-dd')])
      .where('category', TransactionCategory.NO_SHOW_FEE)
      .whereNotIn('status', ['cancelled', 'void'])

    return result.reduce((acc, cur) => acc + Number(cur.amount), 0)
  }

  /**
   * Get Extra Charges data for Management Report
   */
  private async getManagementExtraChargesData(hotelId: number, reportDate: DateTime, ptdStartDate: DateTime, ytdStartDate: DateTime) {
    const { default: FolioTransaction } = await import('#models/folio_transaction')
    const { default: ExtraCharge } = await import('#models/extra_charge')

    // Get all extra charges for the hotel
    const extraCharges = await ExtraCharge.query()
      .where('hotel_id', hotelId)

      .select('id', 'name', 'short_code')

    const getExtraChargesByPeriod = async (startDate: DateTime, endDate: DateTime) => {
      // Get all folio transactions in the period
      const transactions = await FolioTransaction.query()
        .whereHas('folio', (folioQuery: any) => {
          folioQuery.whereHas('reservation', (reservationQuery: any) => {
            reservationQuery.where('hotel_id', hotelId)
          })
        })
        .whereBetween('transaction_date', [startDate.toFormat('yyyy-MM-dd'), endDate.toFormat('yyyy-MM-dd')])
        .whereNotIn('status', ['cancelled', 'voided'])
        .whereNot('isVoided', true)
        .whereNotNull('description')
        .where('category', TransactionCategory.EXTRACT_CHARGE)
        .where('transactionType', TransactionType.CHARGE)
        .select('description', 'amount')

      const extraChargeAmounts: any = {}
      let totalExtraCharges = 0

      // Initialize all extra charges with 0
      extraCharges.forEach(extraCharge => {
        extraChargeAmounts[extraCharge.name] = 0
      })

      // Match transaction descriptions with extra charge names
      transactions.forEach(transaction => {
        const description = transaction.description?.toLowerCase() || ''

        extraCharges.forEach(extraCharge => {
          const extraChargeName = extraCharge.name?.toLowerCase() || ''

          // Check if transaction description contains the extra charge name or short code
          if (description.includes(extraChargeName)) {
            logger.info(`Extra charge found: ${extraCharge.name} - ${transaction.amount}`)
            const amount = Number(transaction.amount || 0)
            extraChargeAmounts[extraCharge.name] += amount
            totalExtraCharges += amount
          }
        })
      })

      return { extraChargeAmounts, totalExtraCharges }
    }

    // Calculate for each period
    const todayData = await getExtraChargesByPeriod(reportDate, reportDate)
    const ptdData = await getExtraChargesByPeriod(ptdStartDate, reportDate)
    const ytdData = await getExtraChargesByPeriod(ytdStartDate, reportDate)

    // Build result with individual extra charges and totals
    const result: any = {
      extraCharges: {},
      totals: {
        today: todayData.totalExtraCharges,
        ptd: ptdData.totalExtraCharges,
        ytd: ytdData.totalExtraCharges
      }
    }

    // Add individual extra charge data
    extraCharges.forEach(extraCharge => {
      result.extraCharges[extraCharge.name] = {
        today: todayData.extraChargeAmounts[extraCharge.name] || 0,
        ptd: ptdData.extraChargeAmounts[extraCharge.name] || 0,
        ytd: ytdData.extraChargeAmounts[extraCharge.name] || 0
      }
    })

    return result
  }

  /**
   * Get Discount data for Management Report
   */
  private async getManagementDiscountData(hotelId: number, reportDate: DateTime, ptdStartDate: DateTime, ytdStartDate: DateTime) {
    const { default: FolioTransaction } = await import('#models/folio_transaction')
    const { default: Discount } = await import('#models/discount')

    // Get all active discounts for the hotel
    const discounts = await Discount.query()
      .where('hotel_id', hotelId)
      .where('status', 'active')

    const getDiscountData = async (discount: any, startDate: DateTime, endDate: DateTime) => {
      const transactions = await FolioTransaction.query()
        .whereHas('folio', (folioQuery: any) => {
          folioQuery.whereHas('reservation', (reservationQuery: any) => {
            reservationQuery.where('hotel_id', hotelId)
          })
        })
        .whereBetween('transaction_date', [startDate.toFormat('yyyy-MM-dd'), endDate.toFormat('yyyy-MM-dd')])
        .where('discount_id', discount.id)
        .where('status', 'posted')
        .whereNotIn('status', ['cancelled', 'voided'])
        .whereNot('isVoided', true)
        .whereNotNull('discount_amount')

      return transactions.reduce((sum: number, t: any) => sum + Math.abs(Number(t.discountAmount || 0)), 0)
    }

    const discountData = []
    let totalToday = 0
    let totalPtd = 0
    let totalYtd = 0

    for (const discount of discounts) {
      const today = await getDiscountData(discount, reportDate, reportDate)
      const ptd = await getDiscountData(discount, ptdStartDate, reportDate)
      const ytd = await getDiscountData(discount, ytdStartDate, reportDate)
      discountData.push({
        id: discount.id,
        name: discount.name,
        shortCode: discount.shortCode,
        type: discount.type,
        value: discount.value,
        applyOn: discount.applyOn,
        today,
        ptd,
        ytd
      })
      totalToday += today
      totalPtd += ptd
      totalYtd += ytd
    }

    return {
      discounts: discountData,
      totals: {
        today: totalToday,
        ptd: totalPtd,
        ytd: totalYtd
      },
      // Backward compatibility
      today: totalToday,
      ptd: totalPtd,
      ytd: totalYtd
    }
  }

  /**
   * Get Adjustments data for Management Report
   */
  private async getManagementAdjustmentsData(hotelId: number, reportDate: DateTime, ptdStartDate: DateTime, ytdStartDate: DateTime) {
    const { default: FolioTransaction } = await import('#models/folio_transaction')

    const getAdjustmentData = async (startDate: DateTime, endDate: DateTime) => {
      const transactions = await FolioTransaction.query()
        .whereHas('folio', (folioQuery: any) => {
          folioQuery.whereHas('reservation', (reservationQuery: any) => {
            reservationQuery.where('hotel_id', hotelId)
          })
        })
        .whereBetween('transaction_date', [startDate.toFormat('yyyy-MM-dd'), endDate.toFormat('yyyy-MM-dd')])
        .where('category', 'adjustment')
        .where('status', 'posted')
        .whereNotIn('status', ['cancelled', 'voided'])
        .whereNot('isVoided', true)
        .select('description', 'particular', 'amount')

      const adjustmentTypes: any = {}
      let totalAmount = 0

      transactions.forEach((transaction: any) => {
        const amount = Number(transaction.amount || 0)
        const description = transaction.particular

        // Check if it's a round off adjustment
        const isRoundOff = description.toLowerCase().includes('round') ||
          description.toLowerCase().includes('unit adjustment') ||
          Math.abs(amount) < 1 // Small amounts are likely round offs

        const adjustmentType = isRoundOff ? 'Round Off' : description
        if (isRoundOff) {
          if (!adjustmentTypes[adjustmentType]) {
            adjustmentTypes[adjustmentType] = 0
          }

          adjustmentTypes[adjustmentType] += amount
          totalAmount += amount
        }

      })

      return { types: adjustmentTypes, total: totalAmount }
    }

    const todayData = await getAdjustmentData(reportDate, reportDate)
    const ptdData = await getAdjustmentData(ptdStartDate, reportDate)
    const ytdData = await getAdjustmentData(ytdStartDate, reportDate)

    // Combine all adjustment types
    const allTypes = new Set([
      ...Object.keys(todayData.types),
      ...Object.keys(ptdData.types),
      ...Object.keys(ytdData.types)
    ])

    const adjustmentData = Array.from(allTypes).map(type => ({
      name: type,
      today: todayData.types[type] || 0,
      ptd: ptdData.types[type] || 0,
      ytd: ytdData.types[type] || 0
    })).filter(adj => adj.today !== 0 || adj.ptd !== 0 || adj.ytd !== 0)

    return {
      adjustments: adjustmentData,
      totals: {
        today: todayData.total,
        ptd: ptdData.total,
        ytd: ytdData.total
      },
      // Backward compatibility
      today: todayData.total,
      ptd: ptdData.total,
      ytd: ytdData.total
    }
  }

  /**
   * Get Tax data for Management Report
   */
  private async getManagementTaxData(hotelId: number, reportDate: DateTime, ptdStartDate: DateTime, ytdStartDate: DateTime) {
    const { default: FolioTransaction } = await import('#models/folio_transaction')
    const { default: Tax } = await import('#models/tax_rate')
    const taxs = await Tax.query().where('hotel_id', hotelId);
    // logger.info(taxs)

    const getTaxData = async (taxId: number, startDate: DateTime, endDate: DateTime) => {
      // Get all transactions with preloaded taxes relationship
      const transactions = await FolioTransaction.query()
        .whereNotNull('folio_id')
        .whereHas('folio', (folioQuery: any) => {
          folioQuery.whereHas('reservation', (reservationQuery: any) => {
            reservationQuery.where('hotel_id', hotelId)
          })
        })
        .whereBetween('transaction_date', [startDate.toFormat('yyyy-MM-dd'), endDate.toFormat('yyyy-MM-dd')])
        .where('status', 'posted')
        .whereNotIn('status', ['cancelled', 'voided'])
        .whereNot('isVoided', true)
        .preload('taxes', (taxQuery: any) => {
          taxQuery.where('hotel_id', hotelId)
        })
        .select('id', 'category', 'tax_amount', 'tax_rate', 'description', 'particular')


      let taxesAmount = 0

      transactions.forEach((transaction: any) => {
        // Process taxes from the relationship
        if (transaction.taxes && transaction.taxes.length > 0) {
          transaction.taxes.filter((tax: any) => tax.taxRateId === taxId).forEach((tax: any) => {
            taxesAmount += Number(tax.$pivot.taxAmount || 0)

          })
        }
      })

      return taxesAmount
    }
    const taxsData = []
    let totalToday = 0
    let totalPtd = 0
    let totalYtd = 0
    for (const tax of taxs) {
      const today = await getTaxData(tax.taxRateId, reportDate, reportDate)
      const ptd = await getTaxData(tax.taxRateId, ptdStartDate, reportDate)
      const ytd = await getTaxData(tax.taxRateId, ytdStartDate, reportDate)
      taxsData.push({
        name: tax.taxName,
        today,
        ptd,
        ytd
      })
      totalToday += today
      totalPtd += ptd
      totalYtd += ytd
    }
    return {
      taxes: taxsData,
      totals: {
        today: totalToday,
        ptd: totalPtd,
        ytd: totalYtd
      },
      // Backward compatibility
      today: totalToday,
      ptd: totalPtd,
      ytd: totalYtd
    }

  }

  /**
   * Get Payment data for Management Report
   */
  private async getManagementPaymentData(hotelId: number, reportDate: DateTime, ptdStartDate: DateTime, ytdStartDate: DateTime) {
    const { default: FolioTransaction } = await import('#models/folio_transaction')

    const getPaymentsByMethod = async (startDate: DateTime, endDate: DateTime) => {
      const paymentMethods = await PaymentMethod.query().where('hotel_id', hotelId).where('methodType', PaymentMethodType.CASH);
      const payments = await FolioTransaction.query()
        .whereHas('folio', (folioQuery: any) => {
          folioQuery.whereHas('reservation', (reservationQuery: any) => {
            reservationQuery.where('hotel_id', hotelId)
          })
        })
        .whereBetween('transaction_date', [startDate.toFormat('yyyy-MM-dd'), endDate.toFormat('yyyy-MM-dd')])
        .where('transaction_type', TransactionType.PAYMENT)
        .whereNotIn('status', ['cancel', 'voided'])
        .whereNot('isVoided', true)
        .select('paymentMethodId', 'totalAmount')
        .preload('paymentMethod')
      const paymentMethodsList: any = {}
      let totalPayments = 0
      paymentMethods.forEach(paymentMethod => {
        paymentMethodsList[paymentMethod.methodName] = 0
      })
      payments.filter(payment => payment.paymentMethod)?.forEach(payment => {
        const method: any = payment.paymentMethod.methodName
        const amount = Math.abs(payment.totalAmount || 0) // Payments are typically negative
        paymentMethodsList[method] += amount
        totalPayments += amount
      })

      return { methods: paymentMethodsList, total: totalPayments }
    }

    const todayPayments = await getPaymentsByMethod(reportDate, reportDate)
    const ptdPayments = await getPaymentsByMethod(ptdStartDate, reportDate)
    const ytdPayments = await getPaymentsByMethod(ytdStartDate, reportDate)

    // Combine all payment methods
    const allMethods = new Set([
      ...Object.keys(todayPayments.methods),
      ...Object.keys(ptdPayments.methods),
      ...Object.keys(ytdPayments.methods)
    ])

    const paymentsByMethod = {}
    allMethods.forEach(method => {
      paymentsByMethod[method] = {
        today: todayPayments.methods[method] || 0,
        ptd: ptdPayments.methods[method] || 0,
        ytd: ytdPayments.methods[method] || 0
      }
    })

    return {
      methods: paymentsByMethod,
      total: {
        today: todayPayments.total,
        ptd: ptdPayments.total,
        ytd: ytdPayments.total
      }
    }
  }

  /**
   * Placeholder methods for remaining sections - to be implemented
   */
  private async getManagementCityLedgerData(hotelId: number, reportDate: DateTime, ptdStartDate: DateTime, ytdStartDate: DateTime, currency: string) {
    try {
      const { default: FolioTransaction } = await import('#models/folio_transaction')
      const { default: PaymentMethod } = await import('#models/payment_method')
      const { default: CompanyAccount } = await import('#models/company_account')
      const { PaymentMethodType, TransactionType } = await import('#app/enums')

      // Get city ledger payment methods
      const cityLedgerPaymentMethods = await PaymentMethod.query()
        .where('hotel_id', hotelId)
        .where('method_type', PaymentMethodType.CITY_LEDGER)
        .where('is_active', true)

      const cityLedgerPaymentMethodIds = cityLedgerPaymentMethods.map(pm => pm.id)

      if (cityLedgerPaymentMethodIds.length === 0) {
        return {
          openingBalance: { today: 0, ptd: 0, ytd: 0 },
          paymentReceived: { today: 0, ptd: 0, ytd: 0 },
          chargesRaised: { today: 0, ptd: 0, ytd: 0 },
          outstandingCommission: { today: 0, ptd: 0, ytd: 0 },
          closingBalance: { today: 0, ptd: 0, ytd: 0 }
        }
      }

      // Calculate opening balance (transactions before each period)
      const openingBalanceToday = await FolioTransaction.query()
        .where('hotel_id', hotelId)
        .whereIn('payment_method_id', cityLedgerPaymentMethodIds)
        .where('transaction_date', '<', [reportDate.startOf('day').toFormat('yyyy-MM-dd'), reportDate.endOf('day').toFormat('yyyy-MM-dd')])
        .where('is_voided', false)
        .sum('amount as total')

      const openingBalancePTD = await FolioTransaction.query()
        .where('hotel_id', hotelId)
        .whereIn('payment_method_id', cityLedgerPaymentMethodIds)
        .where('transaction_date', '<', ptdStartDate.toFormat('yyyy-MM-dd'))
        .where('is_voided', false)
        .sum('amount as total')

      const openingBalanceYTD = await FolioTransaction.query()
        .where('hotel_id', hotelId)
        .whereIn('payment_method_id', cityLedgerPaymentMethodIds)
        .where('transaction_date', '<', ytdStartDate.toFormat('yyyy-MM-dd'))
        .where('is_voided', false)
        .sum('amount as total')

      // Calculate payments received (credit transactions)
      const paymentsToday = await FolioTransaction.query()
        .where('hotel_id', hotelId)
        .whereIn('payment_method_id', cityLedgerPaymentMethodIds)
        .where('transaction_type', TransactionType.PAYMENT)
        .whereBetween('transaction_date', [reportDate.startOf('day').toFormat('yyyy-MM-dd'), reportDate.endOf('day').toFormat('yyyy-MM-dd')])
        .where('is_voided', false)
        .sum('amount as total')

      const paymentsPTD = await FolioTransaction.query()
        .where('hotel_id', hotelId)
        .whereIn('payment_method_id', cityLedgerPaymentMethodIds)
        .where('transaction_type', TransactionType.PAYMENT)
        .whereBetween('transaction_date', [ptdStartDate.toFormat('yyyy-MM-dd'), reportDate.endOf('day').toFormat('yyyy-MM-dd')])
        .where('is_voided', false)
        .sum('amount as total')

      const paymentsYTD = await FolioTransaction.query()
        .where('hotel_id', hotelId)
        .whereIn('payment_method_id', cityLedgerPaymentMethodIds)
        .where('transaction_type', TransactionType.PAYMENT)
        .whereBetween('transaction_date', [ytdStartDate.toFormat('yyyy-MM-dd'), reportDate.endOf('day').toFormat('yyyy-MM-dd')])
        .where('is_voided', false)
        .sum('amount as total')

      // Calculate charges raised (debit transactions)
      const chargesToday = await FolioTransaction.query()
        .where('hotel_id', hotelId)
        .whereIn('payment_method_id', cityLedgerPaymentMethodIds)
        .where('transaction_type', TransactionType.CHARGE)
        .whereBetween('transaction_date', [reportDate.startOf('day').toFormat('yyyy-MM-dd'), reportDate.endOf('day').toFormat('yyyy-MM-dd')])
        .where('is_voided', false)
        .sum('amount as total')

      const chargesPTD = await FolioTransaction.query()
        .where('hotel_id', hotelId)
        .whereIn('payment_method_id', cityLedgerPaymentMethodIds)
        .where('transaction_type', TransactionType.CHARGE)
        .whereBetween('transaction_date', [ptdStartDate.toFormat('yyyy-MM-dd'), reportDate.endOf('day').toFormat('yyyy-MM-dd')])
        .where('is_voided', false)
        .sum('amount as total')

      const chargesYTD = await FolioTransaction.query()
        .where('hotel_id', hotelId)
        .whereIn('payment_method_id', cityLedgerPaymentMethodIds)
        .where('transaction_type', TransactionType.CHARGE)
        .whereBetween('transaction_date', [ytdStartDate.toFormat('yyyy-MM-dd'), reportDate.endOf('day').toFormat('yyyy-MM-dd')])
        .where('is_voided', false)
        .sum('amount as total')

      // Calculate outstanding commission (commission amounts not yet paid)
      const commissionToday = await FolioTransaction.query()
        .where('hotel_id', hotelId)
        .whereIn('payment_method_id', cityLedgerPaymentMethodIds)
        .where('is_commissionable', true)
        .whereBetween('transaction_date', [reportDate.startOf('day').toFormat('yyyy-MM-dd'), reportDate.endOf('day').toFormat('yyyy-MM-dd')])
        .where('is_voided', false)
        .sum('commission_amount as total')

      const commissionPTD = await FolioTransaction.query()
        .where('hotel_id', hotelId)
        .whereIn('payment_method_id', cityLedgerPaymentMethodIds)
        .where('is_commissionable', true)
        .whereBetween('transaction_date', [ptdStartDate.toFormat('yyyy-MM-dd'), reportDate.endOf('day').toFormat('yyyy-MM-dd')])
        .where('is_voided', false)
        .sum('commission_amount as total')

      const commissionYTD = await FolioTransaction.query()
        .where('hotel_id', hotelId)
        .whereIn('payment_method_id', cityLedgerPaymentMethodIds)
        .where('is_commissionable', true)
        .whereBetween('transaction_date', [ytdStartDate.toFormat('yyyy-MM-dd'), reportDate.endOf('day').toFormat('yyyy-MM-dd')])
        .where('is_voided', false)
        .sum('commission_amount as total')

      // Calculate closing balance
      const closingBalanceToday = (openingBalanceToday[0]?.$extras?.total || 0) +
        (chargesToday[0]?.$extras?.total || 0) -
        Math.abs(paymentsToday[0]?.$extras?.total || 0)

      const closingBalancePTD = (openingBalancePTD[0]?.$extras?.total || 0) +
        (chargesPTD[0]?.$extras?.total || 0) -
        Math.abs(paymentsPTD[0]?.$extras?.total || 0)

      const closingBalanceYTD = (openingBalanceYTD[0]?.$extras?.total || 0) +
        (chargesYTD[0]?.$extras?.total || 0) -
        Math.abs(paymentsYTD[0]?.$extras?.total || 0)

      return {
        openingBalance: {
          today: openingBalanceToday[0]?.$extras?.total || 0,
          ptd: openingBalancePTD[0]?.$extras?.total || 0,
          ytd: openingBalanceYTD[0]?.$extras?.total || 0
        },
        paymentReceived: {
          today: Math.abs(paymentsToday[0]?.$extras?.total || 0),
          ptd: Math.abs(paymentsPTD[0]?.$extras?.total || 0),
          ytd: Math.abs(paymentsYTD[0]?.$extras?.total || 0)
        },
        chargesRaised: {
          today: chargesToday[0]?.$extras?.total || 0,
          ptd: chargesPTD[0]?.$extras?.total || 0,
          ytd: chargesYTD[0]?.$extras?.total || 0
        },
        outstandingCommission: {
          today: commissionToday[0]?.$extras?.total || 0,
          ptd: commissionPTD[0]?.$extras?.total || 0,
          ytd: commissionYTD[0]?.$extras?.total || 0
        },
        closingBalance: {
          today: closingBalanceToday,
          ptd: closingBalancePTD,
          ytd: closingBalanceYTD
        }
      }
    } catch (error) {
      console.error('Error in getManagementCityLedgerData:', error)
      return {
        openingBalance: { today: 0, ptd: 0, ytd: 0 },
        paymentReceived: { today: 0, ptd: 0, ytd: 0 },
        chargesRaised: { today: 0, ptd: 0, ytd: 0 },
        outstandingCommission: { today: 0, ptd: 0, ytd: 0 },
        closingBalance: { today: 0, ptd: 0, ytd: 0 }
      }
    }
  }

  private async getManagementAdvanceDepositLedgerData(hotelId: number, reportDate: DateTime, ptdStartDate: DateTime, ytdStartDate: DateTime, currency: string) {
    try {
      const { default: FolioTransaction } = await import('#models/folio_transaction')
      const { default: PaymentMethod } = await import('#models/payment_method')
      const { PaymentMethodType, TransactionType } = await import('#app/enums')

      // Get advance deposit payment methods
      const advanceDepositPaymentMethods = await PaymentMethod.query()
        .where('hotel_id', hotelId)
        .where('method_type', PaymentMethodType.CASH)

      const advanceDepositPaymentMethodIds = advanceDepositPaymentMethods.map(pm => pm.id)

      if (advanceDepositPaymentMethodIds.length === 0) {
        return {
          openingBalance: { today: 0, ptd: 0, ytd: 0 },
          advanceDepositCollected: { today: 0, ptd: 0, ytd: 0 },
          balanceTransferToGuestLedger: { today: 0, ptd: 0, ytd: 0 },
          closingBalance: { today: 0, ptd: 0, ytd: 0 }
        }
      }

      // Calculate opening balance (advance deposit balance before each period)
      const openingBalanceToday = await FolioTransaction.query()
        .where('hotel_id', hotelId)
        .whereIn('payment_method_id', advanceDepositPaymentMethodIds)
        .where('transaction_date', '<', reportDate.startOf('day').toFormat('yyyy-MM-dd'))
        .where('category', TransactionCategory.DEPOSIT)
        .where('is_voided', false)
        .sum('amount as total')

      const openingBalancePTD = await FolioTransaction.query()
        .where('hotel_id', hotelId)
        .whereIn('payment_method_id', advanceDepositPaymentMethodIds)
        .where('transaction_date', '<', ptdStartDate.toFormat('yyyy-MM-dd'))
        .where('is_voided', false)
        .sum('amount as total')

      const openingBalanceYTD = await FolioTransaction.query()
        .where('hotel_id', hotelId)
        .whereIn('payment_method_id', advanceDepositPaymentMethodIds)
        .where('transaction_date', '<', ytdStartDate.toFormat('yyyy-MM-dd'))
        .where('is_voided', false)
        .sum('amount as total')

      // Calculate advance deposits collected (new deposits received)
      const depositsToday = await FolioTransaction.query()
        .where('hotel_id', hotelId)
        .whereIn('payment_method_id', advanceDepositPaymentMethodIds)
        .where('transaction_type', TransactionType.PAYMENT)
        .where('is_advance_deposit', true)
        .whereBetween('transaction_date', [reportDate.startOf('day').toFormat('yyyy-MM-dd'), reportDate.endOf('day').toFormat('yyyy-MM-dd')])
        .where('is_voided', false)
        .sum('amount as total')

      const depositsPTD = await FolioTransaction.query()
        .where('hotel_id', hotelId)
        .whereIn('payment_method_id', advanceDepositPaymentMethodIds)
        .where('transaction_type', TransactionType.PAYMENT)
        .where('is_advance_deposit', true)
        .whereBetween('transaction_date', [ptdStartDate.toFormat('yyyy-MM-dd'), reportDate.endOf('day').toFormat('yyyy-MM-dd')])
        .where('is_voided', false)
        .sum('amount as total')

      const depositsYTD = await FolioTransaction.query()
        .where('hotel_id', hotelId)
        .whereIn('payment_method_id', advanceDepositPaymentMethodIds)
        .where('transaction_type', TransactionType.PAYMENT)
        .where('is_advance_deposit', true)
        .whereBetween('transaction_date', [ytdStartDate, reportDate.endOf('day')])
        .where('is_voided', false)
        .sum('amount as total')

      // Calculate balance transfers to guest ledger (advance deposits used for charges)
      const transfersToday = await FolioTransaction.query()
        .where('hotel_id', hotelId)
        .whereIn('payment_method_id', advanceDepositPaymentMethodIds)
        .where('transaction_type', TransactionType.TRANSFER)
        .where('is_transfer_from_advance_deposit', true)
        .whereBetween('transaction_date', [reportDate.startOf('day').toFormat('yyyy-MM-dd'), reportDate.endOf('day').toFormat('yyyy-MM-dd')])
        .where('is_voided', false)
        .sum('amount as total')

      const transfersPTD = await FolioTransaction.query()
        .where('hotel_id', hotelId)
        .whereIn('payment_method_id', advanceDepositPaymentMethodIds)
        .where('transaction_type', TransactionType.TRANSFER)
        .where('is_transfer_from_advance_deposit', true)
        .whereBetween('transaction_date', [ptdStartDate.toFormat('yyyy-MM-dd'), reportDate.endOf('day').toFormat('yyyy-MM-dd')])
        .where('is_voided', false)
        .sum('amount as total')

      const transfersYTD = await FolioTransaction.query()
        .where('hotel_id', hotelId)
        .whereIn('payment_method_id', advanceDepositPaymentMethodIds)
        .where('transaction_type', TransactionType.TRANSFER)
        .where('is_transfer_from_advance_deposit', true)
        .whereBetween('transaction_date', [ytdStartDate, reportDate.endOf('day')])
        .where('is_voided', false)
        .sum('amount as total')

      // Calculate closing balance
      const closingBalanceToday = (openingBalanceToday[0]?.$extras?.total || 0) +
        Math.abs(depositsToday[0]?.$extras?.total || 0) -
        Math.abs(transfersToday[0]?.$extras?.total || 0)

      const closingBalancePTD = (openingBalancePTD[0]?.$extras?.total || 0) +
        Math.abs(depositsPTD[0]?.$extras?.total || 0) -
        Math.abs(transfersPTD[0]?.$extras?.total || 0)

      const closingBalanceYTD = (openingBalanceYTD[0]?.$extras?.total || 0) +
        Math.abs(depositsYTD[0]?.$extras?.total || 0) -
        Math.abs(transfersYTD[0]?.$extras?.total || 0)

      return {
        openingBalance: {
          today: openingBalanceToday[0]?.$extras?.total || 0,
          ptd: openingBalancePTD[0]?.$extras?.total || 0,
          ytd: openingBalanceYTD[0]?.$extras?.total || 0
        },
        advanceDepositCollected: {
          today: Math.abs(depositsToday[0]?.$extras?.total || 0),
          ptd: Math.abs(depositsPTD[0]?.$extras?.total || 0),
          ytd: Math.abs(depositsYTD[0]?.$extras?.total || 0)
        },
        balanceTransferToGuestLedger: {
          today: Math.abs(transfersToday[0]?.$extras?.total || 0),
          ptd: Math.abs(transfersPTD[0]?.$extras?.total || 0),
          ytd: Math.abs(transfersYTD[0]?.$extras?.total || 0)
        },
        closingBalance: {
          today: closingBalanceToday,
          ptd: closingBalancePTD,
          ytd: closingBalanceYTD
        }
      }
    } catch (error) {
      console.error('Error in getManagementAdvanceDepositLedgerData:', error)
      return {
        openingBalance: { today: 0, ptd: 0, ytd: 0 },
        advanceDepositCollected: { today: 0, ptd: 0, ytd: 0 },
        balanceTransferToGuestLedger: { today: 0, ptd: 0, ytd: 0 },
        closingBalance: { today: 0, ptd: 0, ytd: 0 }
      }
    }
  }

  private async getManagementGuestLedgerData(hotelId: number, reportDate: DateTime, ptdStartDate: DateTime, ytdStartDate: DateTime, currency: string) {
    try {
      const { default: FolioTransaction } = await import('#models/folio_transaction')
      const { default: Folio } = await import('#models/folio')
      const { default: PaymentMethod } = await import('#models/payment_method')
      const { PaymentMethodType, TransactionType, FolioType } = await import('#app/enums')

      // Get guest ledger folios (excluding city ledger and advance deposit folios)
      const guestFolios = await Folio.query()
        .where('hotel_id', hotelId)
        .where('folio_type', FolioType.GUEST)

      const guestFolioIds = guestFolios.map(f => f.id)

      if (guestFolioIds.length === 0) {
        return {
          openingBalance: { today: 0, ptd: 0, ytd: 0 },
          carryForwardedAdvanceDeposit: { today: 0, ptd: 0, ytd: 0 },
          chargePostedToGuestLedger: { today: 0, ptd: 0, ytd: 0 },
          settlementByGuest: { today: 0, ptd: 0, ytd: 0 },
          outstandingPaymentOnCharges: { today: 0, ptd: 0, ytd: 0 },
          transferFromAdvanceDeposit: { today: 0, ptd: 0, ytd: 0 },
          closingBalance: { today: 0, ptd: 0, ytd: 0 }
        }
      }

      // Calculate opening balance (guest ledger balance before each period)
      const openingBalanceToday = await FolioTransaction.query()
        .where('hotel_id', hotelId)
        .whereIn('folio_id', guestFolioIds)
        .where('transaction_date', '<', reportDate.startOf('day'))
        .where('is_voided', false)
        .sum('amount as total')

      const openingBalancePTD = await FolioTransaction.query()
        .where('hotel_id', hotelId)
        .whereIn('folio_id', guestFolioIds)
        .where('transaction_date', '<', ptdStartDate)
        .where('is_voided', false)
        .sum('amount as total')

      const openingBalanceYTD = await FolioTransaction.query()
        .where('hotel_id', hotelId)
        .whereIn('folio_id', guestFolioIds)
        .where('transaction_date', '<', ytdStartDate.toFormat('yyyy-MM-dd'))
        .where('is_voided', false)
        .sum('amount as total')

      // Calculate carry forwarded advance deposits (transfers from advance deposit to guest ledger)
      const advanceDepositTransfersToday = await FolioTransaction.query()
        .where('hotel_id', hotelId)
        .whereIn('folio_id', guestFolioIds)
        .where('transaction_type', TransactionType.TRANSFER)
        .where('is_transfer_from_advance_deposit', true)
        .whereBetween('transaction_date', [reportDate.startOf('day').toFormat('yyyy-MM-dd'), reportDate.endOf('day').toFormat('yyyy-MM-dd')])
        .where('is_voided', false)
        .sum('amount as total')

      const advanceDepositTransfersPTD = await FolioTransaction.query()
        .where('hotel_id', hotelId)
        .whereIn('folio_id', guestFolioIds)
        .where('transaction_type', TransactionType.TRANSFER)
        .where('is_transfer_from_advance_deposit', true)
        .whereBetween('transaction_date', [ptdStartDate.toFormat('yyyy-MM-dd'), reportDate.endOf('day').toFormat('yyyy-MM-dd')])
        .where('is_voided', false)
        .sum('amount as total')

      const advanceDepositTransfersYTD = await FolioTransaction.query()
        .where('hotel_id', hotelId)
        .whereIn('folio_id', guestFolioIds)
        .where('transaction_type', TransactionType.TRANSFER)
        .where('is_transfer_from_advance_deposit', true)
        .whereBetween('transaction_date', [ytdStartDate.toFormat('yyyy-MM-dd'), reportDate.endOf('day').toFormat('yyyy-MM-dd')])
        .where('is_voided', false)
        .sum('amount as total')

      // Calculate charges posted to guest ledger
      const chargesToday = await FolioTransaction.query()
        .where('hotel_id', hotelId)
        .whereIn('folio_id', guestFolioIds)
        .where('transaction_type', TransactionType.CHARGE)
        .whereBetween('transaction_date', [reportDate.startOf('day').toFormat('yyyy-MM-dd'), reportDate.endOf('day').toFormat('yyyy-MM-dd')])
        .where('is_voided', false)
        .sum('amount as total')

      const chargesPTD = await FolioTransaction.query()
        .where('hotel_id', hotelId)
        .whereIn('folio_id', guestFolioIds)
        .where('transaction_type', TransactionType.CHARGE)
        .whereBetween('transaction_date', [ptdStartDate.toFormat('yyyy-MM-dd'), reportDate.endOf('day').toFormat('yyyy-MM-dd')])
        .where('is_voided', false)
        .sum('amount as total')

      const chargesYTD = await FolioTransaction.query()
        .where('hotel_id', hotelId)
        .whereIn('folio_id', guestFolioIds)
        .where('transaction_type', TransactionType.CHARGE)
        .whereBetween('transaction_date', [ytdStartDate.toFormat('yyyy-MM-dd'), reportDate.endOf('day').toFormat('yyyy-MM-dd')])
        .where('is_voided', false)
        .sum('amount as total')

      // Calculate settlements by guest (payments made by guests)
      const settlementsToday = await FolioTransaction.query()
        .where('hotel_id', hotelId)
        .whereIn('folio_id', guestFolioIds)
        .where('transaction_type', TransactionType.PAYMENT)
        .where('is_advance_deposit', false)
        .whereBetween('transaction_date', [reportDate.startOf('day').toFormat('yyyy-MM-dd'), reportDate.endOf('day').toFormat('yyyy-MM-dd')])
        .where('is_voided', false)
        .sum('amount as total')

      const settlementsPTD = await FolioTransaction.query()
        .where('hotel_id', hotelId)
        .whereIn('folio_id', guestFolioIds)
        .where('transaction_type', TransactionType.PAYMENT)
        .where('is_advance_deposit', false)
        .whereBetween('transaction_date', [ptdStartDate.toFormat('yyyy-MM-dd'), reportDate.endOf('day').toFormat('yyyy-MM-dd')])
        .where('is_voided', false)
        .sum('amount as total')

      const settlementsYTD = await FolioTransaction.query()
        .where('hotel_id', hotelId)
        .whereIn('folio_id', guestFolioIds)
        .where('transaction_type', TransactionType.PAYMENT)
        .where('is_advance_deposit', false)
        .whereBetween('transaction_date', [ytdStartDate.toFormat('yyyy-MM-dd'), reportDate.endOf('day').toFormat('yyyy-MM-dd')])
        .where('is_voided', false)
        .sum('amount as total')

      // Calculate outstanding payments (current balance on guest folios)
      const outstandingToday = await Folio.query()
        .whereIn('id', guestFolioIds)
        .where('updated_at', '<=', reportDate.endOf('day').toFormat('yyyy-MM-dd'))
        .sum('balance as total')

      const outstandingPTD = await Folio.query()
        .whereIn('id', guestFolioIds)
        .where('updated_at', '<=', reportDate.endOf('day').toFormat('yyyy-MM-dd'))
        .sum('balance as total')

      const outstandingYTD = await Folio.query()
        .whereIn('id', guestFolioIds)
        .where('updated_at', '<=', reportDate.endOf('day').toFormat('yyyy-MM-dd'))
        .sum('balance as total')

      // Calculate closing balance
      const closingBalanceToday = (openingBalanceToday[0]?.$extras?.total || 0) +
        (chargesToday[0]?.$extras?.total || 0) +
        Math.abs(advanceDepositTransfersToday[0]?.$extras?.total || 0) -
        Math.abs(settlementsToday[0]?.$extras?.total || 0)

      const closingBalancePTD = (openingBalancePTD[0]?.$extras?.total || 0) +
        (chargesPTD[0]?.$extras?.total || 0) +
        Math.abs(advanceDepositTransfersPTD[0]?.$extras?.total || 0) -
        Math.abs(settlementsPTD[0]?.$extras?.total || 0)

      const closingBalanceYTD = (openingBalanceYTD[0]?.$extras?.total || 0) +
        (chargesYTD[0]?.$extras?.total || 0) +
        Math.abs(advanceDepositTransfersYTD[0]?.$extras?.total || 0) -
        Math.abs(settlementsYTD[0]?.$extras?.total || 0)

      return {
        openingBalance: {
          today: openingBalanceToday[0]?.$extras?.total || 0,
          ptd: openingBalancePTD[0]?.$extras?.total || 0,
          ytd: openingBalanceYTD[0]?.$extras?.total || 0
        },
        carryForwardedAdvanceDeposit: {
          today: Math.abs(advanceDepositTransfersToday[0]?.$extras?.total || 0),
          ptd: Math.abs(advanceDepositTransfersPTD[0]?.$extras?.total || 0),
          ytd: Math.abs(advanceDepositTransfersYTD[0]?.$extras?.total || 0)
        },
        chargePostedToGuestLedger: {
          today: chargesToday[0]?.$extras?.total || 0,
          ptd: chargesPTD[0]?.$extras?.total || 0,
          ytd: chargesYTD[0]?.$extras?.total || 0
        },
        settlementByGuest: {
          today: Math.abs(settlementsToday[0]?.$extras?.total || 0),
          ptd: Math.abs(settlementsPTD[0]?.$extras?.total || 0),
          ytd: Math.abs(settlementsYTD[0]?.$extras?.total || 0)
        },
        outstandingPaymentOnCharges: {
          today: outstandingToday[0]?.$extras?.total || 0,
          ptd: outstandingPTD[0]?.$extras?.total || 0,
          ytd: outstandingYTD[0]?.$extras?.total || 0
        },
        transferFromAdvanceDeposit: {
          today: Math.abs(advanceDepositTransfersToday[0]?.$extras?.total || 0),
          ptd: Math.abs(advanceDepositTransfersPTD[0]?.$extras?.total || 0),
          ytd: Math.abs(advanceDepositTransfersYTD[0]?.$extras?.total || 0)
        },
        closingBalance: {
          today: closingBalanceToday,
          ptd: closingBalancePTD,
          ytd: closingBalanceYTD
        }
      }
    } catch (error) {
      console.error('Error in getManagementGuestLedgerData:', error)
      return {
        openingBalance: { today: 0, ptd: 0, ytd: 0 },
        carryForwardedAdvanceDeposit: { today: 0, ptd: 0, ytd: 0 },
        chargePostedToGuestLedger: { today: 0, ptd: 0, ytd: 0 },
        settlementByGuest: { today: 0, ptd: 0, ytd: 0 },
        outstandingPaymentOnCharges: { today: 0, ptd: 0, ytd: 0 },
        transferFromAdvanceDeposit: { today: 0, ptd: 0, ytd: 0 },
        closingBalance: { today: 0, ptd: 0, ytd: 0 }
      }
    }
  }

  private async getManagementStatisticsData(hotelId: number, reportDate: DateTime, roomCharges: any, roomSummary: any) {
    try {
      // Extract values from roomSummary
      const totalAvailableRoomNights = roomSummary.totalAvailableRoomNights || { today: 0, ptd: 0, ytd: 0 };
      const soldRooms = roomSummary.soldRoom || { today: 0, ptd: 0, ytd: 0 };

      // Extract values from roomCharges
      const roomRevenue = roomCharges.roomCharges || { today: 0, ptd: 0, ytd: 0 };

      // Calculate Occupancy Rate
      const occupancyRate = {
        today: totalAvailableRoomNights.today > 0 ? (soldRooms.today / totalAvailableRoomNights.today) * 100 : 0,
        ptd: totalAvailableRoomNights.ptd > 0 ? (soldRooms.ptd / totalAvailableRoomNights.ptd) * 100 : 0,
        ytd: totalAvailableRoomNights.ytd > 0 ? (soldRooms.ytd / totalAvailableRoomNights.ytd) * 100 : 0,
      };

      // Calculate Average Daily Rate (ADR)
      const averageDailyRate = {
        today: soldRooms.today > 0 ? roomRevenue.today / soldRooms.today : 0,
        ptd: soldRooms.ptd > 0 ? roomRevenue.ptd / soldRooms.ptd : 0,
        ytd: soldRooms.ytd > 0 ? roomRevenue.ytd / soldRooms.ytd : 0,
      };

      // Calculate Revenue Per Available Room (RevPAR)
      const revenuePerAvailableRoom = {
        today: totalAvailableRoomNights.today > 0 ? roomRevenue.today / totalAvailableRoomNights.today : 0,
        ptd: totalAvailableRoomNights.ptd > 0 ? roomRevenue.ptd / totalAvailableRoomNights.ptd : 0,
        ytd: totalAvailableRoomNights.ytd > 0 ? roomRevenue.ytd / totalAvailableRoomNights.ytd : 0,
      };

      return {
        occupancyRate: {
          today: Math.round(occupancyRate.today * 100) / 100,
          ptd: Math.round(occupancyRate.ptd * 100) / 100,
          ytd: Math.round(occupancyRate.ytd * 100) / 100,
        },
        averageDailyRate: {
          today: Math.round(averageDailyRate.today * 100) / 100,
          ptd: Math.round(averageDailyRate.ptd * 100) / 100,
          ytd: Math.round(averageDailyRate.ytd * 100) / 100,
        },
        revenuePerAvailableRoom: {
          today: Math.round(revenuePerAvailableRoom.today * 100) / 100,
          ptd: Math.round(revenuePerAvailableRoom.ptd * 100) / 100,
          ytd: Math.round(revenuePerAvailableRoom.ytd * 100) / 100,
        },
      };
    } catch (error) {
      console.error('Error in getManagementStatisticsData:', error);
      return {
        occupancyRate: { today: 0, ptd: 0, ytd: 0 },
        averageDailyRate: { today: 0, ptd: 0, ytd: 0 },
        revenuePerAvailableRoom: { today: 0, ptd: 0, ytd: 0 },
      };
    }
  }

  private async getManagementRoomSummaryData(hotelId: number, reportDate: DateTime) {
    try {
      const { default: Room } = await import('#models/room')
      const { default: Reservation } = await import('#models/reservation')
      const { default: ReservationRoom } = await import('#models/reservation_room')
      const { default: RoomBlock } = await import('#models/room_block')

      // Calculate PTD and YTD start dates
      const ptdStartDate = reportDate.startOf('month')
      const ytdStartDate = reportDate.startOf('year')

      // Get total rooms for the hotel
      const totalRooms: any = await Database.from('rooms').where('hotel_id', hotelId).count('* as total')
      logger.info('total room ')
      logger.info(JSON.stringify(totalRooms[0].total))

      // Get blocked rooms for each period
      const blockedRoomsToday = await RoomBlock.query()
        .where('hotel_id', hotelId)
        .where('block_from_date', '<=', reportDate.toFormat('yyyy-MM-dd'))
        .where('block_to_date', '>=', reportDate.toFormat('yyyy-MM-dd'))
        .count('* as total')

      const blockedRoomsPTD = await RoomBlock.query()
        .where('hotel_id', hotelId)
        .whereBetween('block_from_date', [ptdStartDate.toFormat('yyyy-MM-dd'), reportDate.toFormat('yyyy-MM-dd')])
        .count('* as total')

      const blockedRoomsYTD = await RoomBlock.query()
        .where('hotel_id', hotelId)
        .whereBetween('block_from_date', [ytdStartDate.toFormat('yyyy-MM-dd'), reportDate.toFormat('yyyy-MM-dd')])
        .count('* as total')

      // Get guest counts (adults and children) for each period
      const guestCountsToday = await Reservation.query()
        .where('hotel_id', hotelId)
        .whereBetween('arrived_date', [reportDate.startOf('day').toFormat('yyyy-MM-dd'), reportDate.endOf('day').toFormat('yyyy-MM-dd')])
        .whereNotIn('status', ['cancelled', 'no_show', 'voided'])
        .sum('adults as adults')
        .sum('children as children')

      const guestCountsPTD = await Reservation.query()
        .where('hotel_id', hotelId)
        .whereBetween('arrived_date', [ptdStartDate.toFormat('yyyy-MM-dd'), reportDate.endOf('day').toFormat('yyyy-MM-dd')])
        .whereNotIn('status', ['cancelled', 'no_show', 'voided'])
        .sum('adults as adults')
        .sum('children as children')

      const guestCountsYTD = await Reservation.query()
        .where('hotel_id', hotelId)
        .whereBetween('arrived_date', [ytdStartDate.toFormat('yyyy-MM-dd'), reportDate.endOf('day').toFormat('yyyy-MM-dd')])
        .whereNotIn('status', ['cancelled', 'no_show', 'voided'])
        .sum('adults as adults')
        .sum('children as children')

      // Calculate available room nights for each period
      const totalRoomsCount = parseInt(totalRooms[0].total)
      const availableRoomNightsToday = totalRoomsCount - (blockedRoomsToday[0].$extras.total || 0)
      const availableRoomNightsPTD = totalRoomsCount * Math.abs(ptdStartDate.diff(reportDate, 'days').days) - (blockedRoomsPTD[0].$extras.total || 0)
      const availableRoomNightsYTD = totalRoomsCount * Math.abs(ytdStartDate.diff(reportDate, 'days').days) - (blockedRoomsYTD[0].$extras.total || 0)

      // Get sold rooms (occupied rooms) for each period
      const soldRoomsToday = await ReservationRoom.query()
        .whereHas('reservation', (reservationQuery) => {
          reservationQuery.where('hotel_id', hotelId)
            .whereBetween('arrived_date', [reportDate.startOf('day'), reportDate.endOf('day')])
            .whereNotIn('status', ['cancelled', 'no_show', 'voided'])
        })
        .where('status', 'checked_in')
        .count('* as total')

      const soldRoomsPTD = await ReservationRoom.query()
        .whereHas('reservation', (reservationQuery) => {
          reservationQuery.where('hotel_id', hotelId)
            .whereBetween('arrived_date', [ptdStartDate, reportDate.endOf('day')])
            .whereNotIn('status', ['cancelled', 'no_show', 'voided'])
        })
        .where('status', 'checked_in')
        .count('* as total')

      const soldRoomsYTD = await ReservationRoom.query()
        .whereHas('reservation', (reservationQuery) => {
          reservationQuery.where('hotel_id', hotelId)
            .whereBetween('arrived_date', [ytdStartDate, reportDate.endOf('day')])
            .whereNotIn('status', ['cancelled', 'no_show', 'voided'])
        })
        .where('status', 'checked_in')
        .count('* as total')

      // Get day use rooms for each period
      const dayUseRoomsToday = await ReservationRoom.query()
        .whereHas('reservation', (reservationQuery) => {
          reservationQuery.where('hotel_id', hotelId)
            .whereBetween('arrived_date', [reportDate.startOf('day'), reportDate.endOf('day')])
            .where('customer_type', 'day_use')
        })
        .count('* as total')

      const dayUseRoomsPTD = await ReservationRoom.query()
        .whereHas('reservation', (reservationQuery) => {
          reservationQuery.where('hotel_id', hotelId)
            .whereBetween('arrived_date', [ptdStartDate, reportDate.endOf('day')])
            .where('customer_type', 'day_use')
        })
        .count('* as total')

      const dayUseRoomsYTD = await ReservationRoom.query()
        .whereHas('reservation', (reservationQuery) => {
          reservationQuery.where('hotel_id', hotelId)
            .whereBetween('arrived_date', [ytdStartDate, reportDate.endOf('day')])
            .where('customer_type', 'day_use')
        })
        .count('* as total')

      // Get complimentary rooms for each period
      const complimentaryRoomsToday = await Reservation.query()
        .where('hotel_id', hotelId)
        .whereBetween('arrived_date', [reportDate.startOf('day').toFormat('yyyy-MM-dd'), reportDate.endOf('day').toFormat('yyyy-MM-dd')])
        .where('complimentary_room', true)
        .whereNotIn('status', ['cancelled', 'no_show', 'voided'])
        .count('* as total')

      const complimentaryRoomsPTD = await Reservation.query()
        .where('hotel_id', hotelId)
        .whereBetween('arrived_date', [ptdStartDate.toFormat('yyyy-MM-dd'), reportDate.endOf('day').toFormat('yyyy-MM-dd')])
        .where('complimentary_room', true)
        .whereNotIn('status', ['cancelled', 'no_show', 'voided'])
        .count('* as total')

      const complimentaryRoomsYTD = await Reservation.query()
        .where('hotel_id', hotelId)
        .whereBetween('arrived_date', [ytdStartDate.toFormat('yyyy-MM-dd'), reportDate.endOf('day').toFormat('yyyy-MM-dd')])
        .where('complimentary_room', true)
        .whereNotIn('status', ['cancelled', 'no_show', 'voided'])
        .count('* as total')

      // Get no show rooms for each period
      const noShowRoomsToday = await Reservation.query()
        .where('hotel_id', hotelId)
        .whereBetween('arrived_date', [reportDate.startOf('day').toFormat('yyyy-MM-dd'), reportDate.endOf('day').toFormat('yyyy-MM-dd')])
        .where('status', 'no_show')
        .count('* as total')

      const noShowRoomsPTD = await Reservation.query()
        .where('hotel_id', hotelId)
        .whereBetween('arrived_date', [ptdStartDate.toFormat('yyyy-MM-dd'), reportDate.endOf('day').toFormat('yyyy-MM-dd')])
        .where('status', 'no_show')
        .count('* as total')

      const noShowRoomsYTD = await Reservation.query()
        .where('hotel_id', hotelId)
        .whereBetween('arrived_date', [ytdStartDate.toFormat('yyyy-MM-dd'), reportDate.endOf('day').toFormat('yyyy-MM-dd')])
        .where('status', 'no_show')
        .count('* as total')

      // Calculate average guests per room
      const totalGuestsToday = (guestCountsToday[0].$extras.adults || 0) + (guestCountsToday[0].$extras.children || 0)
      const totalGuestsPTD = (guestCountsPTD[0].$extras.adults || 0) + (guestCountsPTD[0].$extras.children || 0)
      const totalGuestsYTD = (guestCountsYTD[0].$extras.adults || 0) + (guestCountsYTD[0].$extras.children || 0)

      const avgGuestsPerRoomToday = (soldRoomsToday[0].$extras.total || 0) > 0 ? totalGuestsToday / (soldRoomsToday[0].$extras.total || 1) : 0
      const avgGuestsPerRoomPTD = (soldRoomsPTD[0].$extras.total || 0) > 0 ? totalGuestsPTD / (soldRoomsPTD[0].$extras.total || 1) : 0
      const avgGuestsPerRoomYTD = (soldRoomsYTD[0].$extras.total || 0) > 0 ? totalGuestsYTD / (soldRoomsYTD[0].$extras.total || 1) : 0

      // Get confirmed reservations for each period
      const confirmedReservationsToday = await Reservation.query()
        .where('hotel_id', hotelId)
        .whereBetween('arrived_date', [reportDate.startOf('day'), reportDate.endOf('day')])
        .where('status', 'confirmed')
        .count('* as total')

      const confirmedReservationsPTD = await Reservation.query()
        .where('hotel_id', hotelId)
        .whereBetween('arrived_date', [ptdStartDate, reportDate.endOf('day')])
        .where('status', 'confirmed')
        .count('* as total')

      const confirmedReservationsYTD = await Reservation.query()
        .where('hotel_id', hotelId)
        .whereBetween('arrived_date', [ytdStartDate, reportDate.endOf('day')])
        .where('status', 'confirmed')
        .count('* as total')

      // Get unconfirmed reservations for each period
      const unconfirmedReservationsToday = await Reservation.query()
        .where('hotel_id', hotelId)
        .whereBetween('arrived_date', [reportDate.startOf('day'), reportDate.endOf('day')])
        .whereIn('status', ['pending', 'waitlist'])
        .count('* as total')

      const unconfirmedReservationsPTD = await Reservation.query()
        .where('hotel_id', hotelId)
        .whereBetween('arrived_date', [ptdStartDate, reportDate.endOf('day')])
        .whereIn('status', ['pending', 'waitlist'])
        .count('* as total')

      const unconfirmedReservationsYTD = await Reservation.query()
        .where('hotel_id', hotelId)
        .whereBetween('arrived_date', [ytdStartDate, reportDate.endOf('day')])
        .whereIn('status', ['pending', 'waitlist'])
        .count('* as total')

      // Get walk-in reservations for each period
      const walkInReservationsToday = await Reservation.query()
        .where('hotel_id', hotelId)
        .whereBetween('arrived_date', [reportDate.startOf('day'), reportDate.endOf('day')])
        .where('customer_type', 'walk_in')
        .whereNotIn('status', ['cancelled', 'no_show', 'voided'])
        .count('* as total')

      const walkInReservationsPTD = await Reservation.query()
        .where('hotel_id', hotelId)
        .whereBetween('arrived_date', [ptdStartDate, reportDate.endOf('day')])
        .where('customer_type', 'walk_in')
        .whereNotIn('status', ['cancelled', 'no_show', 'voided'])
        .count('* as total')

      const walkInReservationsYTD = await Reservation.query()
        .where('hotel_id', hotelId)
        .whereBetween('arrived_date', [ytdStartDate, reportDate.endOf('day')])
        .where('customer_type', 'walk_in')
        .whereNotIn('status', ['cancelled', 'no_show', 'voided'])
        .count('* as total')
      const cancelReservationsYTD = await Reservation.query()
        .where('hotel_id', hotelId)
        .whereBetween('arrived_date', [ytdStartDate, reportDate.endOf('day')])
        .where('status', 'cancelled')
        .count('* as total')

      const cancelReservationsToday = await Reservation.query()
        .where('hotel_id', hotelId)
        .whereBetween('arrived_date', [reportDate.startOf('day'), reportDate.endOf('day')])
        .where('status', 'cancelled')
        .count('* as total')

      const cancelReservationsPTD = await Reservation.query()
        .where('hotel_id', hotelId)
        .whereBetween('arrived_date', [ptdStartDate, reportDate.endOf('day')])
        .where('status', 'cancelled')
        .count('* as total')

      return {
        totalRoom: {
          today: totalRoomsCount,
          ptd: totalRoomsCount,
          ytd: totalRoomsCount
        },
        blockRoom: {
          today: blockedRoomsToday[0].$extras.total || 0,
          ptd: blockedRoomsPTD[0].$extras.total || 0,
          ytd: blockedRoomsYTD[0].$extras.total || 0
        },
        noOfGuestAdult: {
          today: guestCountsToday[0].$extras.adults || 0,
          ptd: guestCountsPTD[0].$extras.adults || 0,
          ytd: guestCountsYTD[0].$extras.adults || 0
        },
        noOfGuestChild: {
          today: guestCountsToday[0].$extras.children || 0,
          ptd: guestCountsPTD[0].$extras.children || 0,
          ytd: guestCountsYTD[0].$extras.children || 0
        },
        totalAvailableRoomNights: {
          today: Math.max(0, availableRoomNightsToday),
          ptd: Math.max(0, availableRoomNightsPTD),
          ytd: Math.max(0, availableRoomNightsYTD)
        },
        soldRoom: {
          today: soldRoomsToday[0].$extras.total || 0,
          ptd: soldRoomsPTD[0].$extras.total || 0,
          ytd: soldRoomsYTD[0].$extras.total || 0
        },
        dayUseRoom: {
          today: dayUseRoomsToday[0].$extras.total || 0,
          ptd: dayUseRoomsPTD[0].$extras.total || 0,
          ytd: dayUseRoomsYTD[0].$extras.total || 0
        },
        complimentaryRoom: {
          today: complimentaryRoomsToday[0].$extras.total || 0,
          ptd: complimentaryRoomsPTD[0].$extras.total || 0,
          ytd: complimentaryRoomsYTD[0].$extras.total || 0
        },
        noShows: {
          today: noShowRoomsToday[0].$extras.total || 0,
          ptd: noShowRoomsPTD[0].$extras.total || 0,
          ytd: noShowRoomsYTD[0].$extras.total || 0
        },
        averageGuestPerRoom: {
          today: Math.round(avgGuestsPerRoomToday * 100) / 100,
          ptd: Math.round(avgGuestsPerRoomPTD * 100) / 100,
          ytd: Math.round(avgGuestsPerRoomYTD * 100) / 100
        },
        noOfReservationsConfirm: {
          today: confirmedReservationsToday[0].$extras.total || 0,
          ptd: confirmedReservationsPTD[0].$extras.total || 0,
          ytd: confirmedReservationsYTD[0].$extras.total || 0
        },
        noOfReservationsUnconfirm: {
          today: unconfirmedReservationsToday[0].$extras.total || 0,
          ptd: unconfirmedReservationsPTD[0].$extras.total || 0,
          ytd: unconfirmedReservationsYTD[0].$extras.total || 0
        },
        noOfWalkins: {
          today: walkInReservationsToday[0].$extras.total || 0,
          ptd: walkInReservationsPTD[0].$extras.total || 0,
          ytd: walkInReservationsYTD[0].$extras.total || 0
        },
        cancellations: {
          today: cancelReservationsToday[0].$extras.total || 0,
          ptd: cancelReservationsPTD[0].$extras.total || 0,
          ytd: cancelReservationsYTD[0].$extras.total || 0
        }
      }
    } catch (error) {
      console.error('Error in getManagementStatisticsData:', error)
      return {
        totalRoom: { today: 0, ptd: 0, ytd: 0 },
        blockRoom: { today: 0, ptd: 0, ytd: 0 },
        noOfGuestAdult: { today: 0, ptd: 0, ytd: 0 },
        noOfGuestChild: { today: 0, ptd: 0, ytd: 0 },
        totalAvailableRoomNights: { today: 0, ptd: 0, ytd: 0 },
        soldRoom: { today: 0, ptd: 0, ytd: 0 },
        dayUseRoom: { today: 0, ptd: 0, ytd: 0 },
        complimentaryRoom: { today: 0, ptd: 0, ytd: 0 },
        noShowRooms: { today: 0, ptd: 0, ytd: 0 },
        averageGuestPerRoom: { today: 0, ptd: 0, ytd: 0 },
        noOfReservationsConfirm: { today: 0, ptd: 0, ytd: 0 },
        noOfReservationsUnconfirm: { today: 0, ptd: 0, ytd: 0 },
        noOfWalkins: { today: 0, ptd: 0, ytd: 0 },
      }
    }
  }

  private async getManagementRevenueSummaryData(roomCharges: any, extraCharges: any,) {
    const roomChargesTotal = roomCharges?.total || { today: 0, ptd: 0, ytd: 0 }
    const extraChargesTotal = extraCharges?.totals || { today: 0, ptd: 0, ytd: 0 }

    return {
      roomRevenue: roomChargesTotal,
      extraRevenue: extraChargesTotal,
      pmsRevenue: {
        today: (roomChargesTotal.today || 0) + (extraChargesTotal.today || 0),
        ptd: (roomChargesTotal.ptd || 0) + (extraChargesTotal.ptd || 0),
        ytd: (roomChargesTotal.ytd || 0) + (extraChargesTotal.ytd || 0)
      },
      today: (roomChargesTotal.today || 0) + (extraChargesTotal.today || 0),
      ptd: (roomChargesTotal.ptd || 0) + (extraChargesTotal.ptd || 0),
      ytd: (roomChargesTotal.ytd || 0) + (extraChargesTotal.ytd || 0)
    }
  }

  /**
   * Get Revenue By Rate Type report data
   */
  async getRevenueByRateType({ request, response }: HttpContext) {
    try {
      const hotelId = parseInt(request.input('hotelId', '1'))
      const asOnDate = request.input('asOnDate', DateTime.now().toFormat('yyyy-MM-dd'))
      const rateTypeId = request.input('rateTypeId') // Optional - if emptd, get all rate types

      const reportDate = DateTime.fromISO(asOnDate)
      const revenueData = await this.getRevenueByRateTypeData(hotelId, reportDate, rateTypeId)

      return response.ok({
        success: true,
        data: revenueData,
        message: 'Revenue by rate type data retrieved successfully'
      })
    } catch (error) {
      logger.error('Error generating revenue by rate type report:', error)
      return response.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Generate Revenue By Rate Type PDF report
   */
  async generateRevenueByRateTypePdf({ request, response, auth }: HttpContext) {
    try {
      const { hotelId, asOnDate, rateTypeId, currency = 'XAF' } = request.only(['hotelId', 'asOnDate', 'rateTypeId', 'currency'])

      const reportDate = DateTime.fromISO(asOnDate)
      const revenueData = await this.getRevenueByRateTypeData(hotelId, reportDate, rateTypeId)

      // Get hotel name
      const { default: Hotel } = await import('#models/hotel')
      const hotel = await Hotel.find(hotelId)
      const hotelName = hotel?.hotelName!

      // Get user info
      const user = auth?.user
      const printedBy = user ? `${user.firstName} ${user.lastName}` : 'System'

      // Generate HTML content
      const htmlContent = this.generateRevenueByRateTypeHtml(hotelName, reportDate, revenueData, printedBy, currency)

      // Generate PDF
      const { default: PdfGenerationService } = await import('#services/pdf_generation_service')
      const pdfBuffer = await PdfGenerationService.generatePdfFromHtml(htmlContent)

      const filename = `revenue-by-rate-type-${reportDate.toFormat('yyyy-MM-dd')}.pdf`

      return response
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(pdfBuffer)

    } catch (error) {
      logger.error('Error generating revenue by rate type PDF:')
      logger.error(error)
      return response.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Get Revenue By Room Type report data
   */
  async getRevenueByRoomType({ request, response }: HttpContext) {
    try {
      const hotelId = parseInt(request.input('hotelId', '1'))
      const asOnDate = request.input('asOnDate', DateTime.now().toFormat('yyyy-MM-dd'))
      const roomTypeId = request.input('roomTypeId') // Optional - if emptd, get all room types

      const reportDate = DateTime.fromISO(asOnDate)
      const revenueData = await this.getRevenueByRoomTypeData(hotelId, reportDate, roomTypeId)

      return response.ok({
        success: true,
        data: revenueData,
        message: 'Revenue by room type data retrieved successfully'
      })
    } catch (error) {
      logger.error('Error generating revenue by room type report:', error)
      return response.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Generate Revenue By Room Type PDF report
   */
  async generateRevenueByRoomTypePdf({ request, response, auth }: HttpContext) {
    try {
      const hotelId = parseInt(request.input('hotelId', '1'))
      const asOnDate = request.input('asOnDate', DateTime.now().toFormat('yyyy-MM-dd'))
      const roomTypeId = request.input('roomTypeId') // Optional - if emptd, get all room types
      const currency = request.input('currency', 'XAF') // Default currency is XAF

      const reportDate = DateTime.fromISO(asOnDate)
      const revenueData = await this.getRevenueByRoomTypeData(hotelId, reportDate, roomTypeId)

      // Get hotel name
      const { default: Hotel } = await import('#models/hotel')
      const hotel = await Hotel.find(hotelId)
      const hotelName = hotel?.hotelName!

      // Get user info
      const user = auth?.user
      const printedBy = user ? `${user.firstName} ${user.lastName}` : 'System'

      // Generate HTML content
      const htmlContent = this.generateRevenueByRoomTypeHtml(hotelName, reportDate, revenueData, printedBy, currency)

      // Generate PDF
      const { default: PdfGenerationService } = await import('#services/pdf_generation_service')
      const pdfBuffer = await PdfGenerationService.generatePdfFromHtml(htmlContent)

      const filename = `revenue-by-room-type-${reportDate.toFormat('yyyy-MM-dd')}.pdf`

      return response
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(pdfBuffer)

    } catch (error) {
      logger.error('Error generating revenue by room type PDF:', error)
      logger.error(error)
      return response.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Get revenue data grouped by rate type
   */
  private async getRevenueByRateTypeData(hotelId: number, reportDate: DateTime, rateTypeId?: string) {
    const { default: FolioTransaction } = await import('#models/folio_transaction')

    let query = FolioTransaction.query()
      .whereHas('folio', (folioQuery) => {
        folioQuery.whereHas('reservation', (reservationQuery) => {
          reservationQuery.where('hotel_id', hotelId)
            .whereHas('reservationRooms', (roomQuery) => {
              roomQuery.whereHas('roomRates', (rateQuery) => {
                if (rateTypeId) {
                  rateQuery.whereHas('rateType', (rateTypeQuery) => {
                    rateTypeQuery.where('id', rateTypeId)
                  })
                }
              })
            })
        })
      })
      .where('transaction_date', reportDate.toFormat('yyyy-MM-dd'))
      .where('category', 'room')
      .where('status', 'posted')
      .distinctOn('folio_transactions.folio_id')
      .preload('folio', (folioQuery) => {
        folioQuery.preload('reservation', (reservationQuery) => {
          reservationQuery.preload('reservationRooms', (roomQuery) => {
            roomQuery.preload('roomRates', (rateQuery) => {
              rateQuery.preload('rateType')
            })
          })
        })
      })

    const transactions = await query

    // Group transactions by rate type
    const revenueByRateType: any = {}
    let totalRevenue = 0

    for (const transaction of transactions) {
      const reservation = transaction.folio.reservation
      for (const reservationRoom of reservation.reservationRooms) {
        const rateType = reservationRoom.roomRates.rateType
        const rateTypeName = rateType?.rateTypeName

        if (!revenueByRateType[rateTypeName]) {
          revenueByRateType[rateTypeName] = {
            rateTypeName,
            rateTypeId: rateType?.id,
            totalRevenue: 0,
            transactionCount: 0,
            averageRate: 0
          }
        }

        const amount = Number(transaction.amount || 0)
        revenueByRateType[rateTypeName].totalRevenue += amount
        revenueByRateType[rateTypeName].transactionCount += 1
        totalRevenue += amount

      }
    }

    // Calculate average rates
    Object.values(revenueByRateType).forEach((rateTypeData: any) => {
      rateTypeData.averageRate = rateTypeData.transactionCount > 0
        ? rateTypeData.totalRevenue / rateTypeData.transactionCount
        : 0
    })

    return {
      reportDate: reportDate.toFormat('yyyy-MM-dd'),
      hotelId,
      rateTypeId: rateTypeId || 'All Rate Types',
      revenueByRateType: Object.values(revenueByRateType),
      totalRevenue,
      summary: {
        totalRateTypes: Object.keys(revenueByRateType).length,
        totalTransactions: transactions.length,
        averageRevenuePerRateType: Object.keys(revenueByRateType).length > 0
          ? totalRevenue / Object.keys(revenueByRateType).length
          : 0
      }
    }
  }

  /**
   * Get revenue data grouped by room type
   */
  private async getRevenueByRoomTypeData(hotelId: number, reportDate: DateTime, roomTypeId?: string) {
    const { default: FolioTransaction } = await import('#models/folio_transaction')

    let query = FolioTransaction.query()
      .whereHas('folio', (folioQuery) => {
        folioQuery.whereHas('reservation', (reservationQuery) => {
          reservationQuery.where('hotel_id', hotelId)
            .whereHas('reservationRooms', (roomQuery) => {
              if (roomTypeId) {
                roomQuery.where('room_type_id', roomTypeId)
              }
            })
        })
      })
      .where('transaction_date', reportDate.toFormat('yyyy-MM-dd'))
      .where('category', 'room')
      .whereNotIn('status', ['cancel', 'void'])
      .distinctOn('folio_transactions.folio_id')
      .preload('folio', (folioQuery) => {
        folioQuery.preload('reservation', (reservationQuery) => {
          reservationQuery.preload('reservationRooms', (roomQuery) => {
            roomQuery.preload('roomType')
          })
        })
      })

    const transactions = await query

    // Group transactions by room type
    const revenueByRoomType: any = {}
    let totalRevenue = 0

    for (const transaction of transactions) {
      const reservation = transaction.folio.reservation
      for (const reservationRoom of reservation.reservationRooms) {
        const roomType = reservationRoom.roomType
        const roomTypeName = roomType?.roomTypeName

        if (!revenueByRoomType[roomTypeName]) {
          revenueByRoomType[roomTypeName] = {
            roomTypeName,
            roomTypeId: roomType?.id,
            totalRevenue: 0,
            transactionCount: 0,
            averageRate: 0,
            roomCount: 0
          }
        }

        const amount = Number(transaction.amount || 0)
        revenueByRoomType[roomTypeName].totalRevenue += amount
        revenueByRoomType[roomTypeName].transactionCount += 1
        revenueByRoomType[roomTypeName].roomCount += 1
        totalRevenue += amount
      }
    }

    // Calculate average rates
    Object.values(revenueByRoomType).forEach((roomTypeData: any) => {
      roomTypeData.averageRate = roomTypeData.transactionCount > 0
        ? roomTypeData.totalRevenue / roomTypeData.transactionCount
        : 0
    })

    return {
      reportDate: reportDate.toFormat('yyyy-MM-dd'),
      hotelId,
      roomTypeId: roomTypeId || 'All Room Types',
      revenueByRoomType: Object.values(revenueByRoomType),
      totalRevenue,
      summary: {
        totalRoomTypes: Object.keys(revenueByRoomType).length,
        totalTransactions: transactions.length,
        averageRevenuePerRoomType: Object.keys(revenueByRoomType).length > 0
          ? totalRevenue / Object.keys(revenueByRoomType).length
          : 0
      }
    }
  }

  /**
   * Generate HTML for Revenue By Rate Type report
   */
  private generateRevenueByRateTypeHtml(
    hotelName: string,
    reportDate: DateTime,
    revenueData: any,
    printedBy: string = 'System',
    currency: string = 'XAF'
  ): string {
    const formatCurrency = (amount: number) => {
      if (amount === null || amount === undefined || isNaN(amount)) {
        return `0.00`
      }
      return `${Number(amount)}`
    }

    return `
     <!DOCTYPE html>
     <html>
     <head>
         <title>Revenue By Rate Type Report</title>
         <style>
             body { font-family: Arial, sans-serif; margin: 20px; }
             .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            padding-bottom: 5px;
            border-bottom: 2px solid black;
        }
        .hotel-name {
            font-size: 18px;
            font-weight: bold;
        }
             .hotel-name { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
             .report-date { font-size: 14px; color: #666; }
             .summary { margin: 0px 0px; padding: 10px px; background-color: #f5f5f5; border-radius: 5px; }
             table { width: 100%; border-collapse: collapse; margin: 20px 0; }
             th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
             th { background-color: #f2f2f2; font-weight: bold; }
             .number { text-align: right; }
             .center { text-align: center; }
             .totals-row { background-color: #f9f9f9; font-weight: bold; }
.footer {
            position: fixed;
            bottom: 15px;
            left: 15px;
            right: 15px;
            padding-top: 10px;
            border-top: 1px solid #333;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 10px;
        }
                         .report-title {
            font-size: 18px;
            font-weight: bold;
            color:orange
        }
        .date-section {
            margin: 15px 0;
            font-size: 14px;
        }
        .horizontal-line {
            border-top: 1px solid #333;
            margin: 5px 0;
        }
         </style>
     </head>
     <body>
     <div class="header">
        <div class="hotel-name">${hotelName}</div>
        <div class="report-title">Revenue By Rate Type Report</div>
    </div>

    <div class="date-section">
       <strong> As on Date:</strong> ${reportDate.toFormat('MMMM dd, yyyy')}
       <strong> Currency:</strong>${currency}
    </div>
    <div class="horizontal-line"></div>
     <h3>Summary</h3>
         <div class="horizontal-line"></div>
         <div class="summary">
             <p><strong>Total Rate Types:</strong> ${revenueData.summary.totalRateTypes}</p>
             <p><strong>Total Transactions:</strong> ${revenueData.summary.totalTransactions}</p>
             <p><strong>Total Revenue:</strong> ${formatCurrency(revenueData.totalRevenue)}</p>
             <p><strong>Average Revenue per Rate Type:</strong> ${formatCurrency(revenueData.summary.averageRevenuePerRateType)}</p>
         </div>
    <div class="horizontal-line"></div>
         <table>
             <thead>
                 <tr>
                     <th>Rate Type</th>
                     <th class="center">Transaction Count</th>
                     <th class="number">Total Revenue</th>
                     <th class="number">Average Rate</th>
                     <th class="number">% of Total Revenue</th>
                 </tr>
             </thead>
             <tbody>
                 ${revenueData.revenueByRateType.map((rateType: any) => `
                 <tr>
                     <td>${rateType.rateTypeName}</td>
                     <td class="center">${rateType.transactionCount}</td>
                     <td class="number">${formatCurrency(rateType.totalRevenue)}</td>
                     <td class="number">${formatCurrency(rateType.averageRate)}</td>
                     <td class="number">${revenueData.totalRevenue > 0 ? ((rateType.totalRevenue / revenueData.totalRevenue) * 100).toFixed(1) : '0.0'}%</td>
                 </tr>
                 `).join('')}
                 <tr class="totals-row">
                     <td><strong>Total:</strong></td>
                     <td class="center"><strong>${revenueData.summary.totalTransactions}</strong></td>
                     <td class="number"><strong>${formatCurrency(revenueData.totalRevenue)}</strong></td>
                     <td class="number"><strong>${formatCurrency(revenueData.summary.averageRevenuePerRateType)}</strong></td>
                     <td class="number"><strong>100.0%</strong></td>
                 </tr>
             </tbody>
         </table>

         <div class="footer">
             <p>Generated on: ${DateTime.now().toFormat('MMMM dd, yyyy HH:mm:ss')}</p>
             <p>Printed by: ${printedBy}</p>
             <p>Page 1 of 1 </p>
         </div>
     </body>
     </html>
     `
  }

  /**
   * Generate HTML for Revenue By Room Type report
   */
  private generateRevenueByRoomTypeHtml(
    hotelName: string,
    reportDate: DateTime,
    revenueData: any,
    printedBy: string = 'System',
    currency: string = 'XAF'
  ): string {
    const formatCurrency = (amount: number) => {
      if (amount === null || amount === undefined || isNaN(amount)) {
        return `0.00`
      }
      return `${Number(amount)}`
    }

    return `
     <!DOCTYPE html>
     <html>
     <head>
         <title>Revenue By Room Type Report</title>
          <style>
             body { font-family: Arial, sans-serif; margin: 20px; }
             .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            padding-bottom: 5px;
            border-bottom: 2px solid black;
        }
        .hotel-name {
            font-size: 18px;
            font-weight: bold;
        }
             .hotel-name { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
             .report-date { font-size: 14px; color: #666; }
             .summary { margin: 0px 0px; padding: 10px px; background-color: #f5f5f5; border-radius: 5px; }
             table { width: 100%; border-collapse: collapse; margin: 20px 0; }
             th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
             th { background-color: #f2f2f2; font-weight: bold; }
             .number { text-align: right; }
             .center { text-align: center; }
             .totals-row { background-color: #f9f9f9; font-weight: bold; }
.footer {
            position: fixed;
            bottom: 15px;
            left: 15px;
            right: 15px;
            padding-top: 10px;
            border-top: 1px solid #333;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 10px;
        }
                         .report-title {
            font-size: 18px;
            font-weight: bold;
            color:orange
        }
        .date-section {
            margin: 15px 0;
            font-size: 14px;
        }
        .horizontal-line {
            border-top: 1px solid #333;
            margin: 5px 0;
        }
         </style>
     </head>
     <body>
     <div class="header">
        <div class="hotel-name">${hotelName}</div>
        <div class="report-title">Revenue By Rate Type Report</div>
    </div>

    <div class="date-section">
       <strong> As on Date:</strong> ${reportDate.toFormat('MMMM dd, yyyy')}
       <strong> Currency:</strong>${currency}
    </div>
    <div class="horizontal-line"></div>
                 <h3>Summary</h3>
    <div class="horizontal-line"></div>

         <div class="summary">
             <p><strong>Total Room Types:</strong> ${revenueData.summary.totalRoomTypes}</p>
             <p><strong>Total Transactions:</strong> ${revenueData.summary.totalTransactions}</p>
             <p><strong>Total Revenue:</strong> ${formatCurrency(revenueData.totalRevenue)}</p>
             <p><strong>Average Revenue per Room Type:</strong> ${formatCurrency(revenueData.summary.averageRevenuePerRoomType)}</p>
         </div>

         <table>
             <thead>
                 <tr>
                     <th>Room Type</th>
                     <th class="center">Transaction Count</th>
                     <th class="center">Room Count</th>
                     <th class="number">Total Revenue</th>
                     <th class="number">Average Rate</th>
                     <th class="number">% of Total Revenue</th>
                 </tr>
             </thead>
             <tbody>
                 ${revenueData.revenueByRoomType.map((roomType: any) => `
                 <tr>
                     <td>${roomType.roomTypeName}</td>
                     <td class="center">${roomType.transactionCount}</td>
                     <td class="center">${roomType.roomCount}</td>
                     <td class="number">${formatCurrency(roomType.totalRevenue)}</td>
                     <td class="number">${formatCurrency(roomType.averageRate)}</td>
                     <td class="number">${revenueData.totalRevenue > 0 ? ((roomType.totalRevenue / revenueData.totalRevenue) * 100).toFixed(1) : '0.0'}%</td>
                 </tr>
                 `).join('')}
                 <tr class="totals-row">
                     <td><strong>Total:</strong></td>
                     <td class="center"><strong>${revenueData.summary.totalTransactions}</strong></td>
                     <td class="center"><strong>-</strong></td>
                     <td class="number"><strong>${formatCurrency(revenueData.totalRevenue)}</strong></td>
                     <td class="number"><strong>${formatCurrency(revenueData.summary.averageRevenuePerRoomType)}</strong></td>
                     <td class="number"><strong>100.0%</strong></td>
                 </tr>
             </tbody>
         </table>

         <div class="footer">
             <p>Print on: ${DateTime.now().toFormat('MMMM dd, yyyy HH:mm:ss')}</p>
             <p>Printed by: ${printedBy}</p>
             <p>Page 1 of 1 </p>
         </div>
     </body>
     </html>
     `
  }

  /**
   * Generate Monthly Revenue PDF report
   */
  async generateMonthlyRevenuePdf({ request, response, auth }: HttpContext) {
    try {
      const { hotelId, month, year } = request.qs()

      if (!hotelId || !month || !year) {
        return response.badRequest({
          success: false,
          message: 'Hotel ID, month, and year are required'
        })
      }

      // Create start and end dates for the month
      const reportDate = DateTime.fromObject({ year: parseInt(year), month: parseInt(month), day: 1 })
      const monthStart = reportDate.startOf('month')
      const monthEnd = reportDate.endOf('month')

      const currency = request.input('currency', 'XAF')

      // Get monthly revenue data
      const revenueData = await this.getMonthlyRevenueData(parseInt(hotelId), monthStart, monthEnd)

      // Get hotel name
      const { default: Hotel } = await import('#models/hotel')
      const hotel = await Hotel.find(parseInt(hotelId))
      const hotelName = hotel?.hotelName!

      // Get user info
      const user = auth?.user
      const printedBy = user ? `${user.firstName} ${user.lastName}` : 'System'

      // Generate HTML content
      const htmlContent = this.generateMonthlyRevenueHtml(hotelName, reportDate, revenueData, printedBy, currency)

      // Generate PDF
      const { default: PdfGenerationService } = await import('#services/pdf_generation_service')
      const pdfBuffer = await PdfGenerationService.generatePdfFromHtml(htmlContent)

      const filename = `monthly-revenue-${reportDate.toFormat('yyyy-MM')}.pdf`

      return response
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(pdfBuffer)

    } catch (error) {
      logger.error('Error generating monthly revenue PDF:', error)
      return response.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Generate Payment Summary PDF report
   */
  async generatePaymentSummaryPdf({ request, response, auth }: HttpContext) {
    try {
      const hotelId = parseInt(request.input('hotelId', '1'))
      const asOnDate = request.input('asOnDate', DateTime.now().toFormat('yyyy-MM-dd'))

      const reportDate = DateTime.fromISO(asOnDate)

      // Get payment summary data (you'll need to implement this method)
      const paymentData = await this.getPaymentSummaryData(hotelId, reportDate)

      // Get hotel name
      const { default: Hotel } = await import('#models/hotel')
      const hotel = await Hotel.find(hotelId)
      const hotelName = hotel?.name || 'Hotel'

      // Get user info
      const user = auth?.user
      const printedBy = user ? `${user.firstName} ${user.lastName}` : 'System'

      // Generate HTML content (you'll need to implement this method)
      const htmlContent = this.generatePaymentSummaryHtml(hotelName, reportDate, paymentData, printedBy)

      // Generate PDF
      const { default: PdfService } = await import('#services/pdf_service')
      const pdfBuffer = await PdfService.generatePdf(htmlContent)

      const filename = `payment-summary-${reportDate.toFormat('yyyy-MM-dd')}.pdf`

      return response
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(pdfBuffer)

    } catch (error) {
      logger.error('Error generating payment summary PDF:', error)
      return response.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Retrieve Daily Operations Summary data (JSON only)
   * Same sections as PDF, grouped by Business Source with row details.
   */
  async getDailyOperationsReport({ request, response }: HttpContext) {
    try {
      const hotelId = parseInt(request.input('hotelId', '1'))
      const asOnDate = request.input('asOnDate') || DateTime.now().toFormat('yyyy-MM-dd')
      const reportDate = DateTime.fromISO(asOnDate)

      const { default: Hotel } = await import('#models/hotel')
      const { default: ReservationRoom } = await import('#models/reservation_room')

      const hotel = await Hotel.find(hotelId)
      if (!hotel) {
        return response.badRequest({ success: false, message: 'Invalid hotelId' })
      }

      const nextDate = reportDate.plus({ days: 1 })
      const dateISO = reportDate.toISODate()
      const nextISO = nextDate.toISODate()

      const basePreload = (q: ReturnType<typeof ReservationRoom.query>) => {
        return q
          .preload('reservation', (resQ) => {
            resQ
              .preload('guest')
              .preload('businessSource')
              .preload('folios')
          })
          .preload('guest')
          .preload('room')
          .preload('roomType')
          .preload('rateType')
      }

      const buildRows = (items: ReservationRoom[]) => {
        return items.map((rr) => {
          const res = rr.reservation
          const guest = res?.guest || rr.guest
          const businessSourceName = res?.businessSource?.name || res?.sourceOfBusiness || 'N/A'
          const roomNumber = rr.room?.roomNumber || '—'
          const roomTypeName = rr.roomType?.roomTypeName || '—'
          const folioNumber = (res?.folios && res.folios[0]?.folioNumber) || '—'
          const rateTypeName = rr.rateType?.rateTypeName || '—'
          const arrival = rr.checkInDate?.toISODate?.() || res?.scheduledArrivalDate?.toISODate?.() || ''
          const departure = rr.checkOutDate?.toISODate?.() || res?.scheduledDepartureDate?.toISODate?.() || ''
          const nights = rr.nights ?? res?.numberOfNights ?? 0
          const roomRate = rr.roomRate ?? res?.roomRate ?? 0
          const total = rr.netAmount ?? rr.totalRoomCharges ?? res?.finalAmount ?? res?.totalAmount ?? 0

          return {
            businessSource: businessSourceName,
            reservationNumber: res?.reservationNumber || res?.confirmationNumber || String(res?.id || rr.reservationId),
            guestName: guest ? `${guest.firstName || ''} ${guest.lastName || ''}`.trim() : '—',
            arrival,
            departure,
            nights,
            room: `${roomNumber} (${roomTypeName})`,
            voucherNumber: res?.confirmationCode || '—',
            rateType: rateTypeName,
            folioNumber,
            roomRate,
            total,
          }
        })
      }

      const sections: Record<string, Map<string, any[]>> = {
        todayConfirmCheckin: new Map(),
        stayoverInHouse: new Map(),
        todayCheckout: new Map(),
        todayNoShow: new Map(),
        todayCancellation: new Map(),
        tomorrowConfirmBooking: new Map(),
        tomorrowCheckout: new Map(),
        stayoverContinuedInHouse: new Map(),
      }

      // Today Confirm Check-in
      {
        const rows = buildRows(
          await basePreload(
            ReservationRoom.query()
              .where('hotelId', hotelId)
              .where('status', ReservationStatus.CHECKED_IN)
              .where('checkInDate', '=', dateISO)
          )
        )
        rows.forEach((r) => {
          const key = r.businessSource
          if (!sections.todayConfirmCheckin.has(key)) sections.todayConfirmCheckin.set(key, [])
          sections.todayConfirmCheckin.get(key)!.push(r)
        })
      }

      // Stayover (In-House Guests)
      {
        const rows = buildRows(
          await basePreload(
            ReservationRoom.query()
              .where('hotelId', hotelId)
              .where('status', 'checked_in')
              .where('checkOutDate', '>', dateISO)
          )
        )
        rows.forEach((r) => {
          const key = r.businessSource
          if (!sections.stayoverInHouse.has(key)) sections.stayoverInHouse.set(key, [])
          sections.stayoverInHouse.get(key)!.push(r)
        })
      }

      // Today Checkout
      {
        const rows = buildRows(
          await basePreload(
            ReservationRoom.query()
              .where('hotelId', hotelId)
              .where('status', 'checked_out')
              .where('checkOutDate', '=', dateISO)
          )
        )
        rows.forEach((r) => {
          const key = r.businessSource
          if (!sections.todayCheckout.has(key)) sections.todayCheckout.set(key, [])
          sections.todayCheckout.get(key)!.push(r)
        })
      }

      // Today No show
      {
        const rows = buildRows(
          await basePreload(
            ReservationRoom.query()
              .where('hotelId', hotelId)
              .where('status', 'no_show')
              .where('checkInDate', '=', dateISO)
          )
        )
        rows.forEach((r) => {
          const key = r.businessSource
          if (!sections.todayNoShow.has(key)) sections.todayNoShow.set(key, [])
          sections.todayNoShow.get(key)!.push(r)
        })
      }

      // Today Cancellation
      {
        const cancelledRooms = await basePreload(
          ReservationRoom.query()
            .where('hotelId', hotelId)
            .where('status', 'cancelled')
          //  .whereRaw('DATE(updatedAt) = ?', [dateISO])
        )
        const rows = buildRows(cancelledRooms)
        rows.forEach((r) => {
          const key = r.businessSource
          if (!sections.todayCancellation.has(key)) sections.todayCancellation.set(key, [])
          sections.todayCancellation.get(key)!.push(r)
        })
      }

      // Tomorrow Confirm Booking
      {
        const rows = buildRows(
          await basePreload(
            ReservationRoom.query()
              .where('hotelId', hotelId)
              .where('status', 'reserved')
              .where('checkInDate', '=', nextISO)
          )
        )
        rows.forEach((r) => {
          const key = r.businessSource
          if (!sections.tomorrowConfirmBooking.has(key)) sections.tomorrowConfirmBooking.set(key, [])
          sections.tomorrowConfirmBooking.get(key)!.push(r)
        })
      }

      // Tomorrow Checkout
      {
        const rows = buildRows(
          await basePreload(
            ReservationRoom.query()
              .where('hotelId', hotelId)
              .where('status', 'checked_in')
              .where('checkOutDate', '=', nextISO)
          )
        )
        rows.forEach((r) => {
          const key = r.businessSource
          if (!sections.tomorrowCheckout.has(key)) sections.tomorrowCheckout.set(key, [])
          sections.tomorrowCheckout.get(key)!.push(r)
        })
      }

      // Stayover (Continued In-House Guests)
      {
        const rows = buildRows(
          await basePreload(
            ReservationRoom.query()
              .where('hotelId', hotelId)
              .where('status', 'checked_in')
              .where('checkOutDate', '>', nextISO)
          )
        )
        rows.forEach((r) => {
          const key = r.businessSource
          if (!sections.stayoverContinuedInHouse.has(key)) sections.stayoverContinuedInHouse.set(key, [])
          sections.stayoverContinuedInHouse.get(key)!.push(r)
        })
      }

      const toGroups = (m: Map<string, any[]>) => Array.from(m, ([businessSource, rows]) => ({ businessSource, rows }))

      return response.ok({
        success: true,
        hotel: { id: hotel.id, name: hotel.hotelName },
        date: reportDate.toISODate(),
        sections: {
          todayConfirmCheckin: toGroups(sections.todayConfirmCheckin),
          stayoverInHouse: toGroups(sections.stayoverInHouse),
          todayCheckout: toGroups(sections.todayCheckout),
          todayNoShow: toGroups(sections.todayNoShow),
          todayCancellation: toGroups(sections.todayCancellation),
          tomorrowConfirmBooking: toGroups(sections.tomorrowConfirmBooking),
          tomorrowCheckout: toGroups(sections.tomorrowCheckout),
          stayoverContinuedInHouse: toGroups(sections.stayoverContinuedInHouse),
        },
      })
    } catch (error) {
      logger.error('Error retrieving daily operations report data:', error)
      return response.status(500).json({
        success: false,
        message: 'Failed to retrieve daily operations report data',
        error: error.message,
      })
    }
  }
  /**
   * Generate Daily Operations Summary PDF
   * Sections: Today Confirm Check-in, Stayover (In-House Guests), Today Checkout,
   * Today No show, Today Cancellation, Tomorrow Confirm Booking,
   * Tomorrow Checkout, Stayover (Continued In-House Guests)
   * Grouped by Business Source with specified columns.
   */
  async generateDailyOperationsReportPdf({ request, response, auth }: HttpContext) {
    try {
      const hotelId = parseInt(request.input('hotelId', '1'))
      const asOnDate = request.input('asOnDate') || DateTime.now().toFormat('yyyy-MM-dd')
      const reportDate = DateTime.fromISO(asOnDate)
  
      // Imports (use dynamic to avoid circular deps)
      const { default: Hotel } = await import('#models/hotel')
      const { default: ReservationRoom } = await import('#models/reservation_room')
  
      const hotel = await Hotel.find(hotelId)
      if (!hotel) {
        return response.badRequest({ success: false, message: 'Invalid hotelId' })
      }
  
      const nextDate = reportDate.plus({ days: 1 })
      const dateISO = reportDate.toISODate()
      const nextISO = nextDate.toISODate()
  
      // Helper to build rows from ReservationRoom with preloaded relations
      const buildRows = (items: ReservationRoom[]) => {
        return items.map((rr) => {
          const res = rr.reservation
          const guest = res?.guest || rr.guest
          const businessSourceName = res?.businessSource?.name || res?.sourceOfBusiness || 'N/A'
          const roomNumber = rr.room?.roomNumber || '—'
          const roomTypeName = rr.roomType?.roomTypeName || '—'
          const folioNumber = (res?.folios && res.folios[0]?.folioNumber) || '—'
          const rateTypeName = rr.rateType?.rateTypeName || '—'
          const arrival = rr.checkInDate?.toISODate?.() || res?.scheduledArrivalDate?.toISODate?.() || ''
          const departure = rr.checkOutDate?.toISODate?.() || res?.scheduledDepartureDate?.toISODate?.() || ''
          const nights = rr.nights ?? res?.numberOfNights ?? 0
          const roomRate = rr.roomRate ?? res?.roomRate ?? 0
          const total = rr.netAmount ?? rr.totalRoomCharges ?? res?.finalAmount ?? res?.totalAmount ?? 0
  
          return {
            businessSource: businessSourceName,
            reservationNumber: res?.reservationNumber || res?.confirmationNumber || String(res?.id || rr.reservationId),
            guestName: guest ? `${guest.firstName || ''} ${guest.lastName || ''}`.trim() : '—',
            arrival,
            departure,
            nights,
            room: `${roomNumber} (${roomTypeName})`,
            voucherNumber: res?.confirmationCode || '—',
            rateType: rateTypeName,
            folioNumber,
            roomRate,
            total,
          }
        })
      }
  
      // Query helper
      const basePreload = (q: ReturnType<typeof ReservationRoom.query>) => {
        return q
          .preload('reservation', (resQ) => {
            resQ
              .preload('guest')
              .preload('businessSource')
              .preload('folios')
          })
          .preload('guest')
          .preload('room')
          .preload('roomType')
          .preload('rateType')
      }
  
      // Define sections with their queries
      const sectionDefinitions = [
        {
          key: 'todayConfirmCheckin',
          title: 'Today Confirm Check-in',
          query: () => basePreload(
            ReservationRoom.query()
              .where('hotelId', hotelId)
              .where('status', 'reserved')
              .where('checkInDate', '=', dateISO)
          )
        },
        {
          key: 'stayoverInHouse',
          title: 'Stayover In House',
          query: () => basePreload(
            ReservationRoom.query()
              .where('hotelId', hotelId)
              .where('status', 'checked_in')
              .where('checkOutDate', '>', dateISO)
          )
        },
        {
          key: 'todayCheckout',
          title: "Today Checkout",
          query: () => basePreload(
            ReservationRoom.query()
              .where('hotelId', hotelId)
              .where('status', 'checked_in')
              .where('checkOutDate', '=', dateISO)
          )
        },
        {
          key: 'todayNoShow',
          title: 'Today No Show',
          query: () => basePreload(
            ReservationRoom.query()
              .where('hotelId', hotelId)
              .where('status', 'no_show')
              .where('checkInDate', '=', dateISO)
          )
        },
        {
          key: 'todayCancellation',
          title: 'Today Cancellation',
          query: () => basePreload(
            ReservationRoom.query()
              .where('hotelId', hotelId)
              .where('status', 'cancelled')
              //.whereRaw('DATE(updatedAt) = ?', [dateISO])
          )
        },
        {
          key: 'tomorrowConfirmBooking',
          title: "Tomorrow Confirm Booking ",
          query: () => basePreload(
            ReservationRoom.query()
              .where('hotelId', hotelId)
              .where('status', 'reserved')
              .where('checkInDate', '=', nextISO)
          )
        },
        {
          key: 'tomorrowCheckout',
          title: "Tomorrow Checkout",
          query: () => basePreload(
            ReservationRoom.query()
              .where('hotelId', hotelId)
              .where('status', 'checked_in')
              .where('checkOutDate', '=', nextISO)
          )
        },
        {
          key: 'stayoverContinuedInHouse',
          title: 'Stayover Continued In House',
          query: () => basePreload(
            ReservationRoom.query()
              .where('hotelId', hotelId)
              .where('status', 'checked_in')
              .where('checkOutDate', '>', nextISO)
          )
        }
      ]
      // Execute queries and organize data by business source
      const sections = []
  
      for (const sectionDef of sectionDefinitions) {
        const items = await sectionDef.query()
        const rows = buildRows(items)
        
        // Group by business source
        const groupsMap = new Map()
        rows.forEach((row) => {
          const key = row.businessSource
          if (!groupsMap.has(key)) {
            groupsMap.set(key, [])
          }
          groupsMap.get(key).push(row)
        })
  
        // Convert Map to array for template
        const groups = Array.from(groupsMap.entries()).map(([sourceName, rows]) => ({
          sourceName,
          rows
        }))
  
        sections.push({
          title: sectionDef.title,
          groups
        })
      }
  
      // Prepare data for template
      const user = auth?.user
      const printedBy = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'System' : 'System'
  
      const reportData = {
        hotel,
        reportDate: reportDate.toFormat('yyyy-MM-dd'),
        printedBy,
        sections,
        currentDateTime: new Date().toLocaleString('fr-FR') // Ajoutez cette ligne
      }
      console.log('reportData', reportData)
  
      // Generate PDF using Edge template
      const { default: edge } = await import('edge.js')
      const path = await import('path')
  
      // Configure Edge with views directory
      edge.mount(path.join(process.cwd(), 'resources/views'))
  
      // Render the template
      const html = await edge.render('reports/daily_operations', reportData)
  
      const { default: PdfGenerationService } = await import('#services/pdf_generation_service')
      const headerTemplate = `
        <div style="font-size:10px; width:100%; padding:6px 20px; border-bottom:1px solid #ddd; display:flex; align-items:center; justify-content:space-between;">
          <div style="font-weight:600; color:#1e40af; font-size:12px;">${hotel.hotelName}</div>
          <div style="font-size:9px; color:#555;">Daily Operations Report - ${reportDate.toFormat('yyyy-MM-dd')}</div>
        </div>`
      const footerTemplate = `
        <div style="font-size:9px; width:100%; padding:6px 20px; border-top:1px solid #ddd; color:#555; display:flex; align-items:center; justify-content:space-between;">
          <div>Report date: ${reportDate.toFormat('yyyy-MM-dd')}</div>
          <div>Printed by: ${printedBy}</div>
          <div>Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>
        </div>`
      const pdfBuffer = await PdfGenerationService.generatePdfFromHtml(html, {
        format: 'A4',
        margin: {
          top: '60px',
          right: '20px',
          bottom: '60px',
          left: '20px'
        },
        displayHeaderFooter: true,
        headerTemplate,
        footerTemplate,
        printBackground: true
      })
  
      const filename = `daily-operations-${hotel.hotelName.replace(/\s+/g, '-')}-${reportDate.toFormat('yyyy-MM-dd')}.pdf`
      return response
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(pdfBuffer)
    } catch (error) {
      logger.error('Error generating daily operations report PDF:', error)
      console.log('Error generating daily operations report PDF:', error)
      return response.status(500).json({
        success: false,
        //message: 'Failed to generate daily operations report PDF',
        error: error
      })
    }
  }
  /**
   * Generate Revenue By Rate Type Summary PDF report
   */
  async generateRevenueByRateTypeSummaryPdf({ request, response, auth }: HttpContext) {
    try {
      const hotelId = parseInt(request.input('hotelId', '1'))
      const asOnDate = request.input('asOnDate', DateTime.now().toFormat('yyyy-MM-dd'))

      const reportDate = DateTime.fromISO(asOnDate)

      // Get revenue by rate type summary data (you'll need to implement this method)
      const summaryData = await this.getRevenueByRateTypeSummaryData(hotelId, reportDate)

      // Get hotel name
      const { default: Hotel } = await import('#models/hotel')
      const hotel = await Hotel.find(hotelId)
      const hotelName = hotel?.name || 'Hotel'

      // Get user info
      const user = auth?.user
      const printedBy = user ? `${user.firstName} ${user.lastName}` : 'System'

      // Generate HTML content (you'll need to implement this method)
      const htmlContent = this.generateRevenueByRateTypeSummaryHtml(hotelName, reportDate, summaryData, printedBy)

      // Generate PDF
      const { default: PdfService } = await import('#services/pdf_service')
      const pdfBuffer = await PdfService.generatePdf(htmlContent)

      const filename = `revenue-by-rate-type-summary-${reportDate.toFormat('yyyy-MM-dd')}.pdf`

      return response
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(pdfBuffer)

    } catch (error) {
      logger.error('Error generating revenue by rate type summary PDF:', error)
      return response.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Generate Statistics By Room Type PDF report
   */
  async generateStatisticsByRoomTypePdf({ request, response, auth }: HttpContext) {
    try {
      const hotelId = parseInt(request.input('hotelId', '1'))
      const asOnDate = request.input('asOnDate', DateTime.now().toFormat('yyyy-MM-dd'))

      const reportDate = DateTime.fromISO(asOnDate)

      // Get statistics by room type data (you'll need to implement this method)
      const statisticsData = await this.getStatisticsByRoomTypeData(hotelId, reportDate)

      // Get hotel name
      const { default: Hotel } = await import('#models/hotel')
      const hotel = await Hotel.find(hotelId)
      const hotelName = hotel?.name || 'Hotel'

      // Get user info
      const user = auth?.user
      const printedBy = user ? `${user.firstName} ${user.lastName}` : 'System'

      // Generate HTML content (you'll need to implement this method)
      const htmlContent = this.generateStatisticsByRoomTypeHtml(hotelName, reportDate, statisticsData, printedBy)

      // Generate PDF
      const { default: PdfService } = await import('#services/pdf_service')
      const pdfBuffer = await PdfService.generatePdf(htmlContent)

      const filename = `statistics-by-room-type-${reportDate.toFormat('yyyy-MM-dd')}.pdf`

      return response
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(pdfBuffer)

    } catch (error) {
      logger.error('Error generating statistics by room type PDF:', error)
      return response.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Get monthly revenue data - daily breakdown for the entire month
   */
  private async getMonthlyRevenueData(hotelId: number, monthStart: DateTime, monthEnd: DateTime) {
    const { default: FolioTransaction } = await import('#models/folio_transaction')

    // Get all transactions for the month
    const transactions = await FolioTransaction.query()
      .whereHas('folio', (folioQuery) => {
        folioQuery.whereHas('reservation', (reservationQuery) => {
          reservationQuery.where('hotel_id', hotelId)
        })
      })
      .whereBetween('transaction_date', [monthStart.toFormat('yyyy-MM-dd'), monthEnd.toFormat('yyyy-MM-dd')])
      .where('category', 'room')
      .where('status', 'posted')
      .preload('folio', (folioQuery) => {
        folioQuery.preload('reservation')
      })

    // Group by day and calculate daily revenue
    const dailyRevenue: { [key: string]: number } = {}
    const daysInMonth = monthEnd.day

    // Initialize all days with 0
    for (let day = 1; day <= daysInMonth; day++) {
      dailyRevenue[day.toString()] = 0
    }

    // Calculate actual revenue for each day
    transactions.forEach(transaction => {
      const transactionDate = DateTime.fromISO(transaction.transactionDate)
      const day = transactionDate.day.toString()
      dailyRevenue[day] += Number(transaction.amount || 0)
    })

    // Calculate total revenue
    const totalRevenue = Object.values(dailyRevenue).reduce((sum, amount) => sum + amount, 0)

    return {
      dailyRevenue,
      totalRevenue,
      monthStart,
      monthEnd,
      daysInMonth
    }
  }

  /**
   * Generate HTML for Monthly Revenue report with chart
   */
  private generateMonthlyRevenueHtml(
    hotelName: string,
    reportDate: DateTime,
    revenueData: any,
    printedBy: string = 'System',
    currency: string = 'XAF'
  ): string {
    const formatCurrency = (amount: number) => {
      if (amount === null || amount === undefined || isNaN(amount)) {
        return `${currency} 0.00`
      }
      return `${currency} ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }

    // Prepare chart data
    const chartData = []
    const maxRevenue = Math.max(...Object.values(revenueData.dailyRevenue) as number[])
    const chartHeight = 300

    for (let day = 1; day <= revenueData.daysInMonth; day++) {
      const revenue = revenueData.dailyRevenue[day.toString()] || 0
      const barHeight = maxRevenue > 0 ? (revenue / maxRevenue) * chartHeight : 0
      chartData.push({
        day,
        revenue,
        barHeight,
        formattedRevenue: formatCurrency(revenue)
      })
    }

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Monthly Revenue Report</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                margin: 20px;
                font-size: 12px;
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
                border-bottom: 2px solid #333;
                padding-bottom: 10px;
            }
            .hotel-name {
                font-size: 18px;
                font-weight: bold;
                margin-bottom: 5px;
            }
            .report-title {
                font-size: 16px;
                color: #d2691e;
                margin-bottom: 10px;
            }
            .chart-container {
                margin: 30px 0;
                text-align: center;
            }
            .chart {
                display: inline-block;
                border: 1px solid #ccc;
                padding: 20px;
                background: #f9f9f9;
            }
            .chart-title {
                margin-bottom: 20px;
                font-weight: bold;
                background-color: #4472c4;
                color: white;
                padding: 5px 10px;
                display: inline-block;
            }
            .chart-area {
                position: relative;
                width: 800px;
                height: 350px;
                border: 1px solid #333;
                background: white;
                margin: 0 auto;
            }
            .y-axis {
                position: absolute;
                left: -40px;
                top: 0;
                height: 100%;
                width: 40px;
            }
            .y-label {
                position: absolute;
                right: 5px;
                font-size: 10px;
                transform: translateY(-50%);
            }
            .x-axis {
                position: absolute;
                bottom: -30px;
                left: 0;
                width: 100%;
                height: 30px;
            }
            .x-label {
                position: absolute;
                bottom: 5px;
                font-size: 10px;
                transform: translateX(-50%);
            }
            .bar {
                position: absolute;
                bottom: 0;
                background-color: #4472c4;
                border: 1px solid #2c5aa0;
                display: flex;
                align-items: flex-end;
                justify-content: center;
                color: #4472c4;
                font-size: 8px;
                font-weight: bold;
            }
            .bar-value {
                position: absolute;
                top: -15px;
                font-size: 8px;
                color: #333;
                white-space: nowrap;
            }
            .footer {
                margin-top: 50px;
                border-top: 1px solid #333;
                padding-top: 10px;
                display: flex;
                justify-content: space-between;
                font-size: 10px;
            }
            .grid-line {
                position: absolute;
                left: 0;
                right: 0;
                height: 1px;
                background: #e0e0e0;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="hotel-name">${hotelName}</div>
            <div class="report-title">Monthly Revenue - ${reportDate.toFormat('MMMM yyyy')}</div>
        </div>

        <div class="chart-container">
            <div class="chart">
                <div class="chart-title"> Revenue (Room Charges, Extra Charges)</div>
                <div class="chart-area">
                    <!-- Y-axis labels -->
                    <div class="y-axis">
                        ${[0, 0.2, 0.4, 0.6, 0.8, 1.0].map(ratio => `
                            <div class="y-label" style="top: ${(1 - ratio) * 100}%">
                                ${formatCurrency(maxRevenue * ratio).replace(currency + ' ', '')}
                            </div>
                        `).join('')}
                    </div>

                    <!-- Grid lines -->
                    ${[0.2, 0.4, 0.6, 0.8].map(ratio => `
                        <div class="grid-line" style="top: ${(1 - ratio) * 100}%"></div>
                    `).join('')}

                    <!-- Bars -->
                    ${chartData.map(data => `
                        <div class="bar"
                             style="left: ${((data.day - 1) / revenueData.daysInMonth) * 100}%;
                                    width: ${(1 / revenueData.daysInMonth) * 100 * 0.8}%;
                                    height: ${data.barHeight}px;
                                    margin-left: ${(1 / revenueData.daysInMonth) * 100 * 0.1}%;">
                            ${data.revenue > 0 ? `<div class="bar-value">${data.formattedRevenue.replace(currency + ' ', '')}</div>` : ''}
                        </div>
                    `).join('')}

                    <!-- X-axis labels -->
                    <div class="x-axis">
                        ${chartData.map(data => `
                            <div class="x-label" style="left: ${(data.day / revenueData.daysInMonth) * 100}%">
                                ${data.day}
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div style="margin-top: 40px; font-weight: bold;">Date</div>
            </div>
        </div>

        <div class="footer">
            <div>Printed On: ${DateTime.now().toFormat('MMMM dd, yyyy HH:mm:ss')}</div>
            <div>Printed By: ${printedBy}</div>
            <div>Page 1 of 1</div>
        </div>
    </body>
    </html>
    `
  }

  /**
   * Get daily revenue data by different revenue types
   */
  public async getDailyRevenueData(hotelId: number, reportDate: DateTime, revenueTypes: string[]) {
    const { default: FolioTransaction } = await import('#models/folio_transaction')

    // Get all transactions for the specific date
    const transactions = await FolioTransaction.query()
      .whereHas('folio', (folioQuery) => {
        folioQuery.whereHas('reservation', (reservationQuery) => {
          reservationQuery.where('hotel_id', hotelId)
        })
      })
      .where('transaction_date', reportDate.toFormat('yyyy-MM-dd'))
      .where('status', 'posted')
      .preload('folio', (folioQuery) => {
        folioQuery.preload('reservation', (reservationQuery) => {
          reservationQuery.preload('guest')
          reservationQuery.preload('reservationRooms', (roomQuery) => {
            roomQuery.preload('room')
            roomQuery.preload('roomRates')
            roomQuery.preload('roomType')
          })
        })
      })

    // Group transactions by revenue type and guest
    const revenueData: any = {
      transactions: [],
      totals: {
        roomCharges: 0,
        discount: 0,
        roundOff: 0,
        taxes: 0,
        net: 0
      }
    }

    const guestTransactions = new Map()

    transactions.forEach(transaction => {
      const reservation = transaction.folio?.reservation
      if (!reservation) return

      const guest = reservation.guest
      const reservationRoom = reservation.reservationRooms?.[0]
      const room = reservationRoom?.room
      const rateType = reservationRoom?.rateType

      // Filter by revenue type if specified
      const transactionCategory = this.mapTransactionToRevenueType(transaction)
      if (revenueTypes.length > 0 && !revenueTypes.includes(transactionCategory)) {
        return
      }

      const guestKey = `${reservation.id}-${guest?.id || 'unknown'}`

      if (!guestTransactions.has(guestKey)) {
        guestTransactions.set(guestKey, {
          guestName: guest ? `${guest.firstName || ''} ${guest.lastName || ''}`.trim() : 'Unknown Guest',
          room: room?.roomNumber || 'N/A',
          rateType: rateType?.name || 'Standard',
          roomCharges: 0,
          discount: 0,
          roundOff: 0,
          taxes: 0,
          net: 0
        })
      }

      const guestData = guestTransactions.get(guestKey)
      const amount = Number(transaction.amount || 0)

      // Categorize transaction amounts
      if (transaction.category === 'room' || transactionCategory === 'room_revenue') {
        guestData.roomCharges += amount
      } else if (transaction.category === 'discount') {
        guestData.discount += Math.abs(amount)
      } else if (transaction.category === 'tax') {
        guestData.taxes += amount
      } else if (transaction.category === 'adjustment') {
        guestData.roundOff += amount
      }

      guestData.net = guestData.roomCharges - guestData.discount + guestData.roundOff + guestData.taxes
    })

    // Convert map to array and calculate totals
    revenueData.transactions = Array.from(guestTransactions.values())

    revenueData.transactions.forEach(transaction => {
      revenueData.totals.roomCharges += transaction.roomCharges
      revenueData.totals.discount += transaction.discount
      revenueData.totals.roundOff += transaction.roundOff
      revenueData.totals.taxes += transaction.taxes
      revenueData.totals.net += transaction.net
    })

    return revenueData
  }

  /**
   * Map transaction to revenue type category
   */
  private mapTransactionToRevenueType(transaction: any): string {
    const description = transaction.description?.toLowerCase() || ''
    const category = transaction.category?.toLowerCase() || ''

    if (description.includes('no show') || category.includes('no_show')) {
      return 'no_show_revenue'
    } else if (description.includes('cancellation') || category.includes('cancellation')) {
      return 'cancellation_revenue'
    } else if (description.includes('day user') || description.includes('dayuser')) {
      return 'dayuser_revenue'
    } else if (description.includes('late check out') || description.includes('late_check_out')) {
      return 'late_check_out_revenue'
    } else {
      return 'room_revenue'
    }
  }

  /**
   * Generate HTML for Daily Revenue report with pagination
   */
  private generateDailyRevenueHtml(
    hotelName: string,
    reportDate: DateTime,
    revenueData: any,
    printedBy: string,
    revenueTypes: string[]
  ): string {
    const formatCurrency = (amount: number) => {
      if (amount === null || amount === undefined || isNaN(amount)) {
        return 'XAF 0.00'
      }
      return `XAF ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }

    const revenueByText = revenueTypes.length > 0 ? revenueTypes.join(', ') : 'All Revenue Types'
    const transactions = revenueData.transactions || []
    const totals = revenueData.totals || {}

    // Calculate pagination - assume 25 rows per page
    const rowsPerPage = 25
    const totalPages = Math.max(1, Math.ceil(transactions.length / rowsPerPage))

    let html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Daily Revenue Report</title>
        <style>
            @page {
                size: A4;
                margin: 20mm;
            }
            body {
                font-family: Arial, sans-serif;
                font-size: 11px;
                line-height: 1.2;
                margin: 0;
                padding: 0;
            }
            .page {
                page-break-after: always;
                min-height: 100vh;
                position: relative;
                padding-bottom: 60px;
            }
            .page:last-child {
                page-break-after: avoid;
            }
            .header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
                padding-bottom: 5px;
                border-bottom: 2px solid #000;
            }
            .hotel-name {
                font-size: 16px;
                font-weight: bold;
            }
            .night-audit {
                font-size: 16px;
                font-weight: bold;
            }
            .report-info {
                margin: 15px 0;
                padding-bottom: 10px;
                border-bottom: 1px solid #000;
            }
            .report-info-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 5px;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 20px;
            }
            th, td {
                border: 1px solid #000;
                padding: 4px 6px;
                text-align: left;
                font-size: 10px;
            }
            th {
                background-color: #f0f0f0;
                font-weight: bold;
                text-align: center;
            }
            .text-right {
                text-align: right;
            }
            .text-center {
                text-align: center;
            }
            .totals-row {
                font-weight: bold;
                background-color: #f9f9f9;
            }
            .footer {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                border-top: 1px solid #000;
                padding-top: 10px;
                display: flex;
                justify-content: space-between;
                font-size: 10px;
            }
        </style>
    </head>
    <body>
    `

    // Generate pages
    for (let page = 0; page < totalPages; page++) {
      const startIndex = page * rowsPerPage
      const endIndex = Math.min(startIndex + rowsPerPage, transactions.length)
      const pageTransactions = transactions.slice(startIndex, endIndex)
      const isLastPage = page === totalPages - 1

      html += `
        <div class="page">
            <!-- Header for each page -->
            <div class="header">
                <div class="hotel-name">${hotelName}</div>
                <div class="night-audit">Night Audit</div>
            </div>

            ${page === 0 ? `
            <!-- Report info only on first page -->
            <div class="report-info">
                <div class="report-info-row">
                    <div><strong>As On Date:</strong> ${reportDate.toFormat('MMMM dd, yyyy')}</div>
                    <div><strong>Daily Revenue by:</strong> ${revenueByText}</div>
                </div>
            </div>
            ` : ''}

            <!-- Table -->
            <table>
                <thead>
                    <tr>
                        <th style="width: 25%">Guest Name</th>
                        <th style="width: 10%">Room</th>
                        <th style="width: 15%">Rate Type</th>
                        <th style="width: 12%">Room Charges</th>
                        <th style="width: 12%">Discount</th>
                        <th style="width: 10%">Round Off</th>
                        <th style="width: 8%">Taxes</th>
                        <th style="width: 8%">Net</th>
                    </tr>
                </thead>
                <tbody>
      `

      // Add transaction rows for this page
      pageTransactions.forEach(transaction => {
        html += `
                    <tr>
                        <td>${transaction.guestName}</td>
                        <td class="text-center">${transaction.room}</td>
                        <td>${transaction.rateType}</td>
                        <td class="text-right">${formatCurrency(transaction.roomCharges)}</td>
                        <td class="text-right">${formatCurrency(transaction.discount)}</td>
                        <td class="text-right">${formatCurrency(transaction.roundOff)}</td>
                        <td class="text-right">${formatCurrency(transaction.taxes)}</td>
                        <td class="text-right">${formatCurrency(transaction.net)}</td>
                    </tr>
        `
      })

      // Add totals row only on last page
      if (isLastPage) {
        html += `
                    <tr class="totals-row">
                        <td colspan="3"><strong>Total for:</strong></td>
                        <td class="text-right"><strong>${formatCurrency(totals.roomCharges || 0)}</strong></td>
                        <td class="text-right"><strong>${formatCurrency(totals.discount || 0)}</strong></td>
                        <td class="text-right"><strong>${formatCurrency(totals.roundOff || 0)}</strong></td>
                        <td class="text-right"><strong>${formatCurrency(totals.taxes || 0)}</strong></td>
                        <td class="text-right"><strong>${formatCurrency(totals.net || 0)}</strong></td>
                    </tr>
        `
      }

      html += `
                </tbody>
            </table>

            <!-- Footer -->
            <div class="footer">
                <div>Printed On: ${DateTime.now().toFormat('MMMM dd, yyyy HH:mm:ss')}</div>
                <div>Printed By: ${printedBy}</div>
                <div>Page ${page + 1} of ${totalPages}</div>
            </div>
        </div>
      `
    }

    html += `
    </body>
    </html>
    `

    return html
  }

  /**
   * Generate Daily Revenue PDF report
   */
  async generateDailyRevenuePdf({ request, response, auth }: HttpContext) {
    try {
      const { hotelId, asOnDate, revenueBy } = request.qs()

      if (!hotelId || !asOnDate) {
        return response.badRequest({
          success: false,
          message: 'Hotel ID and As On Date are required'
        })
      }

      const reportDate = DateTime.fromISO(asOnDate)
      if (!reportDate.isValid) {
        return response.badRequest({
          success: false,
          message: 'Invalid date format. Use YYYY-MM-DD'
        })
      }

      // Default revenue types if not specified
      const revenueTypes = revenueBy ? revenueBy.split(',') : [
        'room_revenue',
        'no_show_revenue',
        'cancellation_revenue',
        'dayuser_revenue',
        'late_check_out_revenue'
      ]

      // Get daily revenue data
      const auditDetails = await NightAuditService.getNightAuditDetails(
        reportDate,
        Number(hotelId)
      )
      let revenueData: any = {};
      if (auditDetails && auditDetails?.dailyRevenueReportData) {
        revenueData = auditDetails?.dailyRevenueReportData || {}
      } else {
        revenueData = await this.getDailyRevenueData(hotelId, reportDate, revenueTypes)
      }

      // Get hotel name
      const { default: Hotel } = await import('#models/hotel')
      const hotel = await Hotel.find(parseInt(hotelId))
      const hotelName = hotel?.hotelName || 'Hotel'

      // Get user info
      const user = auth?.user
      const printedBy = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown User' : 'System'

      // Generate HTML content
      const htmlContent = this.generateDailyRevenueHtml(hotelName, reportDate, revenueData, printedBy, revenueTypes)

      // Generate PDF
      const { default: PdfGenerationService } = await import('#services/pdf_service')
      const pdfBuffer = await PdfGenerationService.generatePdfFromHtml(htmlContent)

      const filename = `daily-revenue-${reportDate.toFormat('yyyy-MM-dd')}.pdf`

      return response
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(pdfBuffer)

    } catch (error) {
      logger.error('Error generating daily revenue PDF:', error)
      logger.error(error)
      return response.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
 * Génère les données du rapport de disponibilité des chambres
 */
  async generateRoomAvailabilityData({ request, response }: HttpContext) {
    try {
      const {
        hotelId,
        dateFrom,
        dateTo,
        roomTypeId,
        floor
      } = request.body()

      // Validation des paramètres requis
      if (!dateFrom || !dateTo) {
        return response.badRequest({
          success: false,
          message: 'Date range is required (dateFrom and dateTo)',
        })
      }

      if (!hotelId) {
        return response.badRequest({
          success: false,
          message: 'Hotel ID is required',
        })
      }

      // Validation de la plage de dates
      const startDate = new Date(dateFrom)
      const endDate = new Date(dateTo)

      if (startDate > endDate) {
        return response.badRequest({
          success: false,
          message: 'Start date must be before or equal to end date',
        })
      }

      // Créer les filtres pour le rapport
      const reportFilters: ReportFilters = {
        hotelId: parseInt(hotelId),
        startDate: dateFrom,
        endDate: dateTo,
        roomTypeId: roomTypeId ? parseInt(roomTypeId) : undefined,

      }

      // Récupérer les données de disponibilité des chambres
      const roomAvailabilityData = await ReportsService.getRoomAvailability(reportFilters)

      // Calculer le résumé
      const totalRooms = roomAvailabilityData.data?.length || 0
      const availableRooms = roomAvailabilityData.data?.filter((room: any) => room.status === 'available').length || 0
      const occupiedRooms = roomAvailabilityData.data?.filter((room: any) => room.status === 'occupied').length || 0
      const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0

      const summary = {
        totalRooms,
        availableRooms,
        occupiedRooms,
        occupancyRate
      }

      return response.ok({
        success: true,
        message: 'Room availability data generated successfully',
        data: {
          data: roomAvailabilityData.data || [],
          summary
        }
      })
    } catch (error) {
      console.error('Error generating room availability data:', error)
      return response.internalServerError({
        success: false,
        message: 'Failed to generate room availability data',
        error: error.message,
      })
    }
  }

  /**
   * Génère un PDF du rapport de disponibilité des chambres
   */
  async generateRoomAvailabilityPdf({ request, response, auth }: HttpContext) {
    try {
      const {
        hotelId,
        dateFrom,
        dateTo,
        roomTypeId,
        floor
      } = request.body()

      // Validation des paramètres requis
      if (!dateFrom || !dateTo) {
        return response.badRequest({
          success: false,
          message: 'Date range is required (dateFrom and dateTo)',
        })
      }

      if (!hotelId) {
        return response.badRequest({
          success: false,
          message: 'Hotel ID is required',
        })
      }

      // Créer les filtres pour le rapport
      const reportFilters: ReportFilters = {
        hotelId: parseInt(hotelId),
        startDate: dateFrom,
        endDate: dateTo,
        roomTypeId: roomTypeId ? parseInt(roomTypeId) : undefined,

      }

      // Récupérer les données de disponibilité des chambres
      const roomAvailabilityData = await ReportsService.getRoomAvailability(reportFilters)

      // Obtenir les informations de l'utilisateur authentifié
      const user = auth.user
      const printedBy = user
        ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown User'
        : 'System'

      // Générer le contenu HTML pour le PDF (version simplifiée)
      const htmlContent = this.generateSimplifiedRoomAvailabilityHtml(
        roomAvailabilityData,
        { dateFrom, dateTo, roomTypeId, floor },
        printedBy
      )

      // Générer le PDF
      const pdfBuffer = await PdfService.generatePdfFromHtml(htmlContent, {
        format: 'A4',
        orientation: 'landscape',
        margin: {
          top: '1cm',
          right: '1cm',
          bottom: '1cm',
          left: '1cm',
        },
      })

      // Générer le nom de fichier
      const timestamp = DateTime.now().toFormat('yyyy-MM-dd_HH-mm-ss')
      const filename = `room_availability_${dateFrom}_to_${dateTo}_${timestamp}.pdf`

      // Définir les en-têtes de réponse
      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', `attachment; filename="${filename}"`)
      response.header('Content-Length', pdfBuffer.length.toString())

      return response.send(pdfBuffer)
    } catch (error) {
      console.error('Error generating room availability PDF:', error)
      return response.internalServerError({
        success: false,
        message: 'Failed to generate room availability PDF',
        error: error.message,
      })
    }
  }



  /**
   * Génère le contenu HTML simplifié pour le PDF
   */
  private generateSimplifiedRoomAvailabilityHtml(
    reportData: any,
    options: {
      dateFrom: string
      dateTo: string
      roomTypeId?: string
      floor?: string
    },
    printedBy: string = 'System'
  ): string {
    const { dateFrom, dateTo, roomTypeId, floor } = options;

    // Calculs des statistiques à partir des données filtrées
    const rooms = reportData.data || [];
    const totalRooms = rooms.length;
    const availableRooms = rooms.filter((room: any) => room.status === 'available').length;
    const occupiedRooms = rooms.filter((room: any) => room.status === 'occupied').length;
    const maintenanceRooms = rooms.filter((room: any) => room.status === 'maintenance').length;
    const occupancyRate = totalRooms > 0 ? ((occupiedRooms / totalRooms) * 100).toFixed(1) : '0.0';

    // Générer les données pour les graphiques
    const weeklyData = this.generateWeeklyData(reportData);

    // Filtres appliqués pour affichage
    const appliedFilters = [];
    if (roomTypeId) appliedFilters.push(`Type: ${this.getRoomTypeName(roomTypeId)}`);
    if (floor) appliedFilters.push(`Étage: ${floor}`);

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rapport de Disponibilité des Chambres</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        @page {
            size: A4;
            margin: 15mm;
        }

        body {
            font-family: 'Arial', sans-serif;
            font-size: 12px;
            line-height: 1.3;
            color: #333;
            background: white;
        }

        .page-container {
            max-width: 100%;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }

        .header {
            background: linear-gradient(135deg, #2c3e50, #34495e);
            color: white;
            padding: 15px;
            text-align: center;
            border-radius: 8px;
            margin-bottom: 15px;
        }

        .header h1 {
            font-size: 20px;
            margin-bottom: 5px;
            font-weight: bold;
        }

        .date-range {
            font-size: 14px;
            opacity: 0.9;
        }

        .filters-info {
            font-size: 12px;
            opacity: 0.8;
            margin-top: 5px;
        }

        .main-content {
            flex: 1;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 15px;
        }

        .left-panel, .right-panel {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }

        .stats-section {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 15px;
            border: 1px solid #e9ecef;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
        }

        .stat-card {
            text-align: center;
            padding: 12px;
            border-radius: 6px;
            border-left: 4px solid var(--accent-color);
            background: white;
        }

        .stat-card.total { --accent-color: #3498db; }
        .stat-card.available { --accent-color: #2ecc71; }
        .stat-card.occupied { --accent-color: #e74c3c; }
        .stat-card.rate { --accent-color: #9b59b6; }

        .stat-number {
            font-size: 24px;
            font-weight: bold;
            color: var(--accent-color);
            display: block;
            margin-bottom: 3px;
        }

        .stat-label {
            font-size: 10px;
            color: #666;
            text-transform: uppercase;
            font-weight: bold;
        }

        .chart-section {
            background: white;
            border-radius: 8px;
            padding: 15px;
            border: 1px solid #e9ecef;
            height: fit-content;
        }

        .chart-title {
            font-size: 14px;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 12px;
            text-align: center;
        }

        /* Graphique en barres */
        .bar-chart {
            display: flex;
            align-items: end;
            justify-content: space-around;
            height: 120px;
            margin-bottom: 10px;
            padding: 0 10px;
        }

        .bar {
            display: flex;
            flex-direction: column;
            align-items: center;
            flex: 1;
            max-width: 25px;
        }

        .bar-value {
            font-size: 9px;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 3px;
        }

        .bar-fill {
            background: linear-gradient(135deg, #3498db, #2980b9);
            width: 100%;
            border-radius: 2px 2px 0 0;
            min-height: 5px;
            margin-bottom: 5px;
        }

        .bar-label {
            font-size: 9px;
            color: #666;
            font-weight: bold;
        }

        /* Grille des chambres simplifiée */
        .rooms-section {
            grid-column: 1 / -1;
            background: white;
            border-radius: 8px;
            padding: 15px;
            border: 1px solid #e9ecef;
        }

        .rooms-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(35px, 1fr));
            gap: 3px;
            margin-top: 10px;
        }

        .room-card {
            aspect-ratio: 1;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 9px;
            text-shadow: 0 1px 1px rgba(0,0,0,0.3);
        }

        .room-card.available { background: #2ecc71; }
        .room-card.occupied { background: #e74c3c; }
        .room-card.maintenance { background: #f39c12; }
        .room-card.out-of-order { background: #95a5a6; }

        .legend-simple {
            display: flex;
            justify-content: center;
            gap: 15px;
            margin-bottom: 15px;
        }

        .legend-item {
            display: flex;
            align-items: center;
            gap: 5px;
            font-size: 11px;
        }

        .legend-color {
            width: 12px;
            height: 12px;
            border-radius: 2px;
        }

        .legend-color.available { background: #2ecc71; }
        .legend-color.occupied { background: #e74c3c; }
        .legend-color.maintenance { background: #f39c12; }

        .footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            border-top: 1px solid #e9ecef;
            font-size: 10px;
            color: #666;
        }

        @media print {
            body { font-size: 11px; }
            .page-container { height: auto; }
            .rooms-grid {
                grid-template-columns: repeat(auto-fill, minmax(30px, 1fr));
                gap: 2px;
            }
        }
    </style>
</head>
<body>
    <div class="page-container">
        <div class="header">
            <h1>📊 Rapport de Disponibilité des Chambres</h1>
            <div class="date-range">Période: ${dateFrom} au ${dateTo}</div>
            ${appliedFilters.length > 0 ? `<div class="filters-info">Filtres: ${appliedFilters.join(' | ')}</div>` : ''}
        </div>

        <div class="main-content">
            <div class="left-panel">
                <div class="stats-section">
                    <h3 class="chart-title">Statistiques</h3>
                    <div class="stats-grid">
                        <div class="stat-card total">
                            <span class="stat-number">${totalRooms}</span>
                            <div class="stat-label">Total</div>
                        </div>
                        <div class="stat-card available">
                            <span class="stat-number">${availableRooms}</span>
                            <div class="stat-label">Disponibles</div>
                        </div>
                        <div class="stat-card occupied">
                            <span class="stat-number">${occupiedRooms}</span>
                            <div class="stat-label">Occupées</div>
                        </div>
                        <div class="stat-card rate">
                            <span class="stat-number">${occupancyRate}%</span>
                            <div class="stat-label">Taux</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="right-panel">
                <div class="chart-section">
                    <h3 class="chart-title">Évolution 7 jours</h3>
                    <div class="bar-chart" id="barChart">
                        <!-- Les barres seront générées par JavaScript -->
                    </div>
                </div>
            </div>
        </div>

        <div class="rooms-section">
            <h3 class="chart-title">Vue des Chambres</h3>
            <div class="legend-simple">
                <div class="legend-item">
                    <div class="legend-color available"></div>
                    <span>Disponible</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color occupied"></div>
                    <span>Occupée</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color maintenance"></div>
                    <span>Maintenance</span>
                </div>
            </div>
            <div id="roomsGrid" class="rooms-grid">
                <!-- Les chambres seront générées par JavaScript -->
            </div>
        </div>

        <div class="footer">
            <div>Généré le ${new Date().toLocaleDateString('fr-FR')} par ${printedBy}</div>
            <div>Hôtel Management System</div>
        </div>
    </div>

    <script>
        // Données du rapport
        const reportData = {
            totalRooms: ${totalRooms},
            availableRooms: ${availableRooms},
            occupiedRooms: ${occupiedRooms},
            maintenanceRooms: ${maintenanceRooms},
            occupancyRate: ${occupancyRate},
            weeklyData: ${JSON.stringify(weeklyData)},
            rooms: ${JSON.stringify(rooms)}
        };

        function initializeReport() {
            createBarChart();
            createRoomsGrid();
        }

        function createBarChart() {
            const container = document.getElementById('barChart');
            if (!container) return;

            const days = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
            const maxValue = Math.max(...reportData.weeklyData);

            container.innerHTML = '';

            days.forEach((day, index) => {
                const value = reportData.weeklyData[index];
                const height = (value / maxValue) * 80;

                const bar = document.createElement('div');
                bar.className = 'bar';
                bar.innerHTML = \`
                    <div class="bar-value">\${value}%</div>
                    <div class="bar-fill" style="height: \${height}px;"></div>
                    <div class="bar-label">\${day}</div>
                \`;
                container.appendChild(bar);
            });
        }

        function createRoomsGrid() {
            const container = document.getElementById('roomsGrid');
            if (!container) return;

            reportData.rooms.forEach(room => {
                const roomElement = document.createElement('div');
                roomElement.className = \`room-card \${room.status}\`;
                roomElement.textContent = room.number || room.roomNumber || 'N/A';
                roomElement.title = \`Chambre \${room.number || room.roomNumber}: \${room.status}\`;
                container.appendChild(roomElement);
            });
        }

        // Initialiser le rapport
        document.addEventListener('DOMContentLoaded', initializeReport);
    </script>
</body>
</html>
  `;
  }

  // Méthode auxiliaire pour générer les données hebdomadaires
  private generateWeeklyData(reportData: any): number[] {
    if (reportData.weeklyOccupancy) {
      return reportData.weeklyOccupancy;
    }

    const baseRate = reportData.data ?
      ((reportData.data.filter((r: any) => r.status === 'occupied').length / reportData.data.length) * 100) :
      70;

    return Array.from({ length: 7 }, (_, i) => {
      const variation = (Math.random() - 0.5) * 20;
      return Math.max(0, Math.min(100, Math.round(baseRate + variation)));
    });
  }

  // Méthode auxiliaire pour obtenir le nom du type de chambre
  private getRoomTypeName(roomTypeId: string): string {
    const types: { [key: string]: string } = {
      'standard': 'Standard',
      'deluxe': 'Deluxe',
      'suite': 'Suite'
    };
    return types[roomTypeId] || roomTypeId;
  }

  /**
   * Get folio list report
   */
  async getFolioListReport({ request, response }: HttpContext) {
    try {
      const {
        dateType = 'transaction',
        dateFrom,
        dateTo,
        status = { paid: true, unpaid: true },
        businessSource = '',
        include = {
          all: true,
          reserved: true,
          cancelled: true,
          noShow: true,
          checkedIn: true,
          checkedOut: true,
          void: true,
          unconfirmedReservation: true
        },
        hotelId
      } = request.only([
        'dateType', 'dateFrom', 'dateTo', 'status', 'businessSource', 'include', 'hotelId'
      ])

      if (!dateFrom || !dateTo) {
        return response.badRequest({
          success: false,
          message: 'Date range is required'
        })
      }

      // Import models
      const Folio = (await import('#models/folio')).default

      // Build query
      let query = Folio.query()
        .preload('guest')
        .preload('reservation', (reservationQuery) => {
          reservationQuery.preload('bookingSource')
        })
        .preload('transactions')

      // Apply hotel filter
      if (hotelId) {
        query = query.where('hotel_id', hotelId)
      }

      // Apply date filter based on dateType
      if (dateType === 'transaction') {
        query = query.whereHas('transactions', (transactionQuery) => {
          transactionQuery.whereBetween('transaction_date', [dateFrom, dateTo])
        })
      } else if (dateType === 'Arrival') {
        query = query.whereHas('reservation', (reservationQuery) => {
          reservationQuery.whereBetween('arrivalDate', [dateFrom, dateTo])

        })
      } else if (dateType === 'Arrival') {
        query = query.whereHas('reservation', (reservationQuery) => {
          reservationQuery.whereBetween('departureDate', [dateFrom, dateTo])

        })
      }

      // Apply business source filter
      if (businessSource) {
        query = query.whereHas('reservation', (reservationQuery) => {
          reservationQuery.whereHas('bookingSource', (sourceQuery) => {
            sourceQuery.where('name', 'like', `%${businessSource}%`)
          })
        })
      }

      // Apply status filters
      const statusFilters = []
      if (status.paid) statusFilters.push('paid')
      if (status.unpaid) statusFilters.push('unpaid', 'partial')

      if (statusFilters.length > 0) {
        //TODO  query = query.whereIn('settlement_status', statusFilters)
      }

      // Apply include filters for reservation status
      const includeFilters: any = []
      if (include.reserved) includeFilters.push('confirmed')
      if (include.cancelled) includeFilters.push('cancelled')
      if (include.noShow) includeFilters.push('no_show')
      if (include.checkedIn) includeFilters.push('checked_in')
      if (include.checkedOut) includeFilters.push('checked-out')
      if (include.void) includeFilters.push('voided')
      if (include.unconfirmedReservation) includeFilters.push('pending')

      if (!include.all && includeFilters.length > 0) {
        query = query.whereHas('reservation', (reservationQuery) => {
          reservationQuery.whereIn('status', includeFilters)
        })
      }

      const folios = await query.exec()

      // Calculate totals
      let totalChargeAmount = 0
      let totalTaxAmount = 0
      let totalCreditAmount = 0
      let totalBalanceAmount = 0

      const folioList = folios.map(folio => {
        const chargeAmount = folio.transactions
          .filter(t => t.category === TransactionCategory.ROOM)
          .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)

        const taxAmount = folio.transactions
          .filter(t => t.category === TransactionCategory.TAX)
          .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)

        const creditAmount = folio.transactions
          .filter(t => t.category === 'payment')
          .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)

        const balanceAmount = chargeAmount + taxAmount - creditAmount

        // Add to totals
        totalChargeAmount += chargeAmount
        totalTaxAmount += taxAmount
        totalCreditAmount += creditAmount
        totalBalanceAmount += balanceAmount

        return {
          folioNo: folio.folioNumber,
          invoiceNo: folio.invoiceNumber || '',
          date: folio.createdAt.toFormat('dd/MM/yyyy'),
          pax: folio.reservation?.adults || 1,
          name: folio.guest ? `${folio.guest.firstName} ${folio.guest.lastName}` : folio.folioName,
          status: folio.status,
          chargeAmount: chargeAmount,
          taxAmount: taxAmount,
          creditAmount: creditAmount,
          balanceAmount: balanceAmount
        }
      })

      return response.ok({
        success: true,
        data: {
          folios: folioList,
          totals: {
            totalFolios: folios.length,
            totalChargeAmount: totalChargeAmount,
            totalTaxAmount: totalTaxAmount,
            totalCreditAmount: totalCreditAmount,
            totalBalance: totalBalanceAmount
          }
        }
      })

    } catch (error) {
      logger.error('Error generating folio list report:', error)
      return response.internalServerError({
        success: false,
        message: 'Error generating folio list report',
        error: error.message
      })
    }
  }

  /**
   * Get audit report
   */
  async getAuditReport({ request, response }: HttpContext) {
    try {
      const {
        from,
        to,
        user = null,
        operation = null,
        hotelId
      } = request.only(['from', 'to', 'user', 'operation', 'hotelId'])

      if (!from || !to) {
        return response.badRequest({
          success: false,
          message: 'Date range is required'
        })
      }

      // Import models
      const ActivityLog = (await import('#models/activity_log')).default

      // Build query
      let query = ActivityLog.query()
        .preload('user')
        .whereBetween('created_at', [from, to])

      // Apply hotel filter
      if (hotelId) {
        //   query = query.where('hotel_id', hotelId)
      }

      // Apply user filter
      if (user) {
        query = query.where('user_id', user)
      }

      // Apply operation filter
      if (operation) {
        const operations = Array.isArray(operation) ? operation : [operation]
        const actionFilters = operations.map(op => {
          switch (op) {
            case 'roomrate_change': return 'ROOM_RATE_CHANGE'
            case 'check_in': return 'CHECK_IN'
            case 'check_out': return 'CHECK_OUT'
            case 'room_assignment': return 'ROOM_ASSIGNMENT'
            case 'payment': return 'PAYMENT'
            default: return op.toUpperCase()
          }
        })
        query = query.whereIn('action', actionFilters)
      }

      const logs = await query.orderBy('created_at', 'desc').exec()

      // Group by operation
      const groupedLogs = logs.reduce((acc: any, log) => {
        const operation: any = log.action
        if (!acc[operation]) {
          acc[operation] = []
        }

        acc[operation].push({
          resNo: log.entityType === 'Reservation' ? log.entityId : '',
          folioNo: log.entityType === 'Folio' ? log.entityId : '',
          guest: log.description || '',
          user: log.user ? `${log.user.firstName} ${log.user.lastName}` : log.username || '',
          date: log.createdAt.toFormat('dd/MM/yyyy'),
          time: log.createdAt.toFormat('HH:mm:ss')
        })

        return acc
      }, {})

      return response.ok({
        success: true,
        data: {
          auditLogs: groupedLogs,
          totalRecords: logs.length
        }
      })

    } catch (error) {
      logger.error('Error generating audit report:', error)
      return response.internalServerError({
        success: false,
        message: 'Error generating audit report',
        error: error.message
      })
    }
  }

  /**
   * Get void charge report
   */
  async getVoidChargeReport({ request, response }: HttpContext) {
    try {
      const {
        from,
        to,
        by = null,
        hotelId
      } = request.only(['from', 'to', 'by', 'hotelId'])

      if (!from || !to) {
        return response.badRequest({
          success: false,
          message: 'Date range is required'
        })
      }

      // Import models
      const FolioTransaction = (await import('#models/folio_transaction')).default

      // Build query for void charges
      let query = FolioTransaction.query()
        .preload('folio', (folioQuery) => {
          folioQuery.preload('guest').preload('reservation')
        })
        .preload('voidedByUser')
        .where('status', 'voided')
        .where('category', TransactionCategory.ROOM)
        .whereBetween('voidedDate', [from, to])


      // Apply hotel filter
      if (hotelId) {
        query = query.whereHas('folio', (folioQuery) => {
          folioQuery.where('hotel_id', hotelId)
        })
      }

      // Apply user filter
      if (by) {
        query = query.where('voided_by_user_id', by)
      }

      const voidTransactions = await query.orderBy('voidedDate', 'desc').exec()

      const voidCharges = voidTransactions.map(transaction => ({
        folioNo: transaction.folio.folioNumber,
        invoiceNo: transaction.folio.invoiceNumber || '',
        guestName: transaction.folio.guest
          ? `${transaction.folio.guest.firstName} ${transaction.folio.guest.lastName}`
          : transaction.folio.folioName,
        resNo: transaction.folio.reservation?.reservationNumber || '',
        chargeDescription: transaction.description,
        amount: transaction.amount,
        voidedBy: transaction.voidedByUser
          ? `${transaction.voidedByUser.firstName} ${transaction.voidedByUser.lastName}`
          : '',
        voidedAt: transaction.voidedAt?.toFormat('dd/MM/yyyy HH:mm:ss') || '',
        reason: transaction.voidReason || ''
      }))

      const totalAmount = voidTransactions.reduce((sum, t) => sum + (t.amount || 0), 0)

      return response.ok({
        success: true,
        data: {
          voidCharges,
          totalRecords: voidTransactions.length,
          totalAmount: totalAmount
        }
      })

    } catch (error) {
      logger.error('Error generating void charge report:', error)
      return response.internalServerError({
        success: false,
        message: 'Error generating void charge report',
        error: error.message
      })
    }
  }

  /**
   * Get void payment report
   */
  async getVoidPaymentReport({ request, response }: HttpContext) {
    try {
      const {
        from,
        to,
        by = null,
        hotelId
      } = request.only(['from', 'to', 'by', 'hotelId'])

      if (!from || !to) {
        return response.badRequest({
          success: false,
          message: 'Date range is required'
        })
      }

      // Import models
      const FolioTransaction = (await import('#models/folio_transaction')).default

      // Build query for void payments
      let query = FolioTransaction.query()
        .preload('folio', (folioQuery) => {
          folioQuery.preload('guest').preload('reservation')
        })
        .preload('voidedByUser')
        .where('status', 'voided')
        .where('category', TransactionCategory.PAYMENT)
        .whereBetween('voidedDate', [from, to])

      // Apply hotel filter
      if (hotelId) {
        query = query.whereHas('folio', (folioQuery) => {
          folioQuery.where('hotel_id', hotelId)
        })
      }

      // Apply user filter
      if (by) {
        query = query.where('voided_by_user_id', by)
      }

      const voidTransactions = await query.orderBy('voidedDate', 'desc').exec()

      const voidPayments = voidTransactions.map(transaction => ({
        folioNo: transaction.folio.folioNumber,
        invoiceNo: transaction.folio.invoiceNumber || '',
        guestName: transaction.folio.guest
          ? `${transaction.folio.guest.firstName} ${transaction.folio.guest.lastName}`
          : transaction.folio.folioName,
        resNo: transaction.folio.reservation?.reservationNumber || '',
        paymentDescription: transaction.description,
        amount: transaction.amount,
        voidedBy: transaction.voidedByUser
          ? `${transaction.voidedByUser.firstName} ${transaction.voidedByUser.lastName}`
          : '',
        voidedAt: transaction.voidedDate?.toFormat('dd/MM/yyyy HH:mm:ss') || '',
        reason: transaction.voidReason || ''
      }))

      const totalAmount = voidTransactions.reduce((sum, t) => sum + (t.amount || 0), 0)

      return response.ok({
        success: true,
        data: {
          voidPayments,
          totalRecords: voidTransactions.length,
          totalAmount: totalAmount
        }
      })

    } catch (error) {
      logger.error('Error generating void payment report:', error)
      return response.internalServerError({
        success: false,
        message: 'Error generating void payment report',
        error: error.message
      })
    }
  }

  /**
   * Get void transaction report
   */
  async getVoidTransactionReport({ request, response }: HttpContext) {
    try {
      const {
        from,
        to,
        by = null,
        hotelId
      } = request.only(['from', 'to', 'by', 'hotelId'])

      if (!from || !to) {
        return response.badRequest({
          success: false,
          message: 'Date range is required'
        })
      }

      // Import models
      const FolioTransaction = (await import('#models/folio_transaction')).default

      // Build query for all void transactions
      let query = FolioTransaction.query()
        .preload('folio', (folioQuery) => {
          folioQuery.preload('guest').preload('reservation')
        })
        .preload('voidedByUser')
        .where('status', 'voided')
        .where('category', TransactionCategory.PAYMENT)
        .whereBetween('voidedDate', [from, to])

      // Apply hotel filter
      if (hotelId) {
        query = query.whereHas('folio', (folioQuery) => {
          folioQuery.where('hotel_id', hotelId)
        })
      }

      // Apply user filter
      if (by) {
        query = query.where('voided_by_user_id', by)
      }

      const voidTransactions = await query.orderBy('voidedDate', 'desc').exec()

      const voidTransactionsList = voidTransactions.map(transaction => ({
        folioNo: transaction.folio.folioNumber,
        invoiceNo: transaction.folio.invoiceNumber || '',
        guestName: transaction.folio.guest
          ? `${transaction.folio.guest.firstName} ${transaction.folio.guest.lastName}`
          : transaction.folio.folioName,
        resNo: transaction.folio.reservation?.reservationNumber || '',
        transactionType: transaction.transactionType,
        description: transaction.description,
        amount: transaction.amount,
        voidedBy: transaction.voidedByUser
          ? `${transaction.voidedByUser.firstName} ${transaction.voidedByUser.lastName}`
          : '',
        voidedAt: transaction.voidedDate?.toFormat('dd/MM/yyyy HH:mm:ss') || '',
        reason: transaction.voidReason || ''
      }))

      const totalAmount = voidTransactions.reduce((sum, t) => sum + (t.amount || 0), 0)

      return response.ok({
        success: true,
        data: {
          voidTransactions: voidTransactionsList,
          totalRecords: voidTransactions.length,
          totalAmount: totalAmount
        }
      })

    } catch (error) {
      logger.error('Error generating void transaction report:', error)
      return response.internalServerError({
        success: false,
        message: 'Error generating void transaction report',
        error: error.message
      })
    }
  }

  /**
   * Generate guest list report
   */
  async getGuestListReport({ request, response }: HttpContext) {
    try {
      const {
        startDate,
        endDate,
        status
      } = request.only(['startDate', 'endDate', 'status'])

      // Validate required parameters
      if (!startDate || !endDate) {
        return response.badRequest({
          success: false,
          message: 'Start date and end date are required'
        })
      }

      // Build query for reservations
      let query = Reservation.query()
        .preload('guest')
        .preload('reservationRooms', (roomQuery) => {
          roomQuery.preload('room')
        })
        .whereBetween('arrivedDate', [startDate, endDate])

      // Apply status filter if provided
      if (status && status !== 'null') {
        if (status === 'check_in') {
          query = query.where('reservationStatus', 'Checked-In')
        } else if (status === 'check_out') {
          query = query.where('reservationStatus', 'Checked-Out')
        }
      }

      const reservations = await query.exec()

      // Format the guest list data
      const guestList = reservations.map(reservation => {
        const primaryRoom = reservation.reservationRooms.find(room => room.isOwner) || reservation.reservationRooms[0]

        return {
          guestName: `${reservation.guest.displayName}`,
          roomNumber: primaryRoom?.room?.roomNumber || 'N/A',
          checkInDate: reservation.arrivedDate?.toFormat('dd/MM/yyyy') || 'N/A',
          checkOutDate: reservation.departDate?.toFormat('dd/MM/yyyy') || 'N/A',
          status: reservation.reservationStatus
        }
      })

      return response.ok({
        success: true,
        data: {
          guestList,
          totalRecords: guestList.length,
          filters: {
            startDate,
            endDate,
            status: status || 'all'
          }
        }
      })

    } catch (error) {
      logger.error('Error generating guest list report:', error)
      return response.internalServerError({
        success: false,
        message: 'Error generating guest list report',
        error: error.message
      })
    }
  }

  // Payment Summary Report
  async getPaymentSummary({ request, response }: HttpContext) {
    try {
      const { hotelId, startDate, endDate } = request.qs()

      const filters: ReportFilters = {
        hotelId: hotelId ? parseInt(hotelId) : undefined,
        startDate,
        endDate
      }

      const data = await ReportsService.getPaymentSummaryReport(filters)

      return response.ok({
        success: true,
        data
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error generating payment summary report',
        error: error.message
      })
    }
  }

  // Revenue by Rate Type Summary
  async getRevenueByRateTypeSummary({ request, response }: HttpContext) {
    try {
      const { hotelId, startDate, endDate } = request.qs()

      const filters: ReportFilters = {
        hotelId: hotelId ? parseInt(hotelId) : undefined,
        startDate,
        endDate
      }

      const data = await ReportsService.getRevenueByRateTypeSummaryReport(filters)

      return response.ok({
        success: true,
        data
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error generating revenue by rate type summary report',
        error: error.message
      })
    }
  }

  async generateRevenueByRateTypeSummaryPdf({ request, response }: HttpContext) {
    try {
      const { hotelId, startDate, endDate } = request.body()

      const filters: ReportFilters = {
        hotelId: hotelId ? parseInt(hotelId) : undefined,
        startDate,
        endDate
      }

      const pdfBuffer = await ReportsService.generateRevenueByRateTypeSummaryPdf(filters)

      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', 'attachment; filename="revenue-by-rate-type-summary.pdf"')

      return response.send(pdfBuffer)
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error generating revenue by rate type summary PDF',
        error: error.message
      })
    }
  }

  // Statistics by Room Type
  async getStatisticsByRoomType({ request, response }: HttpContext) {
    try {
      const { hotelId, startDate, endDate } = request.qs()

      const filters: ReportFilters = {
        hotelId: hotelId ? parseInt(hotelId) : undefined,
        startDate,
        endDate
      }

      const data = await ReportsService.getStatisticsByRoomTypeReport(filters)

      return response.ok({
        success: true,
        data
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error generating statistics by room type report',
        error: error.message
      })
    }
  }

  async generateStatisticsByRoomTypePdf({ request, response }: HttpContext) {
    try {
      const { hotelId, startDate, endDate } = request.body()

      const filters: ReportFilters = {
        hotelId: hotelId ? parseInt(hotelId) : undefined,
        startDate,
        endDate
      }

      const pdfBuffer = await ReportsService.generateStatisticsByRoomTypePdf(filters)

      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', 'attachment; filename="statistics-by-room-type.pdf"')

      return response.send(pdfBuffer)
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error generating statistics by room type PDF',
        error: error.message
      })
    }
  }

  // Business Analysis Report
  async getBusinessAnalysis({ request, response }: HttpContext) {
    try {
      const { hotelId, startDate, endDate } = request.qs()

      const filters: ReportFilters = {
        hotelId: hotelId ? parseInt(hotelId) : undefined,
        startDate,
        endDate
      }

      const data = await ReportsService.getBusinessAnalysisReport(filters)

      return response.ok({
        success: true,
        data
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error generating business analysis report',
        error: error.message
      })
    }
  }

  async generateBusinessAnalysisPdf({ request, response }: HttpContext) {
    try {
      const { hotelId, startDate, endDate } = request.body()

      const filters: ReportFilters = {
        hotelId: hotelId ? parseInt(hotelId) : undefined,
        startDate,
        endDate
      }

      const pdfBuffer = await ReportsService.generateBusinessAnalysisPdf(filters)

      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', 'attachment; filename="business-analysis-report.pdf"')

      return response.send(pdfBuffer)
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error generating business analysis PDF',
        error: error.message
      })
    }
  }

  // Contribution Analysis Report
  async getContributionAnalysisReport({ request, response }: HttpContext) {
    try {
      const { hotelId, startDate, endDate } = request.qs()

      const filters: ReportFilters = {
        hotelId: hotelId ? parseInt(hotelId) : undefined,
        startDate,
        endDate
      }

      const data = await ReportsService.getContributionAnalysisReport(filters)

      return response.ok({
        success: true,
        data
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error generating contribution analysis report',
        error: error.message
      })
    }
  }

  async generateContributionAnalysisReportPdf({ request, response }: HttpContext) {
    try {
      const { hotelId, startDate, endDate } = request.body()

      const filters: ReportFilters = {
        hotelId: hotelId ? parseInt(hotelId) : undefined,
        startDate,
        endDate
      }

      const pdfBuffer = await ReportsService.generateContributionAnalysisReportPdf(filters)

      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', 'attachment; filename="contribution-analysis-report.pdf"')

      return response.send(pdfBuffer)
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error generating contribution analysis PDF',
        error: error.message
      })
    }
  }

  // Monthly Country-wise PAX Analysis
  async getMonthlyCountryWisePaxAnalysis({ request, response }: HttpContext) {
    try {
      const { hotelId, startDate, endDate } = request.qs()

      const filters: ReportFilters = {
        hotelId: hotelId ? parseInt(hotelId) : undefined,
        startDate,
        endDate
      }

      const data = await ReportsService.getMonthlyCountryWisePaxAnalysisReport(filters)

      return response.ok({
        success: true,
        data
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error generating monthly country-wise PAX analysis',
        error: error.message
      })
    }
  }

  async generateMonthlyCountryWisePaxAnalysisPdf({ request, response }: HttpContext) {
    try {
      const { hotelId, startDate, endDate } = request.body()

      const filters: ReportFilters = {
        hotelId: hotelId ? parseInt(hotelId) : undefined,
        startDate,
        endDate
      }

      const pdfBuffer = await ReportsService.generateMonthlyCountryWisePaxAnalysisPdf(filters)

      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', 'attachment; filename="monthly-country-wise-pax-analysis.pdf"')

      return response.send(pdfBuffer)
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error generating monthly country-wise PAX analysis PDF',
        error: error.message
      })
    }
  }

  // Monthly Revenue by Income Stream
  async getMonthlyRevenueByIncomeStream({ request, response }: HttpContext) {
    try {
      const { hotelId, startDate, endDate } = request.qs()

      const filters: ReportFilters = {
        hotelId: hotelId ? parseInt(hotelId) : undefined,
        startDate,
        endDate
      }

      const data = await ReportsService.getMonthlyRevenueByIncomeStreamReport(filters)

      return response.ok({
        success: true,
        data
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error generating monthly revenue by income stream report',
        error: error.message
      })
    }
  }

  async generateMonthlyRevenueByIncomeStreamPdf({ request, response }: HttpContext) {
    try {
      const { hotelId, startDate, endDate } = request.body()

      const filters: ReportFilters = {
        hotelId: hotelId ? parseInt(hotelId) : undefined,
        startDate,
        endDate
      }

      const pdfBuffer = await ReportsService.generateMonthlyRevenueByIncomeStreamPdf(filters)

      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', 'attachment; filename="monthly-revenue-by-income-stream.pdf"')

      return response.send(pdfBuffer)
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error generating monthly revenue by income stream PDF',
        error: error.message
      })
    }
  }

  // Monthly Statistics
  async getMonthlyStatistics({ request, response }: HttpContext) {
    try {
      const { hotelId, startDate, endDate } = request.qs()

      const filters: ReportFilters = {
        hotelId: hotelId ? parseInt(hotelId) : undefined,
        startDate,
        endDate
      }

      const data = await ReportsService.getMonthlyStatisticsReport(filters)

      return response.ok({
        success: true,
        data
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error generating monthly statistics report',
        error: error.message
      })
    }
  }

  async generateMonthlyStatisticsPdf({ request, response }: HttpContext) {
    try {
      const { hotelId, startDate, endDate } = request.body()

      const filters: ReportFilters = {
        hotelId: hotelId ? parseInt(hotelId) : undefined,
        startDate,
        endDate
      }

      const pdfBuffer = await ReportsService.generateMonthlyStatisticsPdf(filters)

      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', 'attachment; filename="monthly-statistics.pdf"')

      return response.send(pdfBuffer)
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error generating monthly statistics PDF',
        error: error.message
      })
    }
  }

  // Monthly Summary
  async getMonthlySummary({ request, response }: HttpContext) {
    try {
      const { hotelId, startDate, endDate } = request.qs()

      const filters: ReportFilters = {
        hotelId: hotelId ? parseInt(hotelId) : undefined,
        startDate,
        endDate
      }

      const data = await ReportsService.getMonthlySummaryReport(filters)

      return response.ok({
        success: true,
        data
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error generating monthly summary report',
        error: error.message
      })
    }
  }

  async generateMonthlySummaryPdf({ request, response }: HttpContext) {
    try {
      const { hotelId, startDate, endDate } = request.body()

      const filters: ReportFilters = {
        hotelId: hotelId ? parseInt(hotelId) : undefined,
        startDate,
        endDate
      }

      const pdfBuffer = await ReportsService.generateMonthlySummaryPdf(filters)

      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', 'attachment; filename="monthly-summary.pdf"')

      return response.send(pdfBuffer)
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error generating monthly summary PDF',
        error: error.message
      })
    }
  }

  // Monthly Tax Report
  async getMonthlyTax({ request, response }: HttpContext) {
    try {
      const { hotelId, startDate, endDate } = request.qs()

      const filters: ReportFilters = {
        hotelId: hotelId ? parseInt(hotelId) : undefined,
        startDate,
        endDate
      }

      const data = await ReportsService.getMonthlyTaxReport(filters)

      return response.ok({
        success: true,
        data
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error generating monthly tax report',
        error: error.message
      })
    }
  }

  async generateMonthlyTaxPdf({ request, response }: HttpContext) {
    try {
      const { hotelId, startDate, endDate } = request.body()

      const filters: ReportFilters = {
        hotelId: hotelId ? parseInt(hotelId) : undefined,
        startDate,
        endDate
      }

      const pdfBuffer = await ReportsService.generateMonthlyTaxPdf(filters)

      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', 'attachment; filename="monthly-tax-report.pdf"')

      return response.send(pdfBuffer)
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error generating monthly tax PDF',
        error: error.message
      })
    }
  }

  // Room Sale Statistics
  async getRoomSaleStatistics({ request, response }: HttpContext) {
    try {
      const { hotelId, startDate, endDate } = request.qs()

      const filters: ReportFilters = {
        hotelId: hotelId ? parseInt(hotelId) : undefined,
        startDate,
        endDate
      }

      const data = await ReportsService.getRoomSaleStatisticsReport(filters)

      return response.ok({
        success: true,
        data
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error generating room sale statistics report',
        error: error.message
      })
    }
  }

  async generateRoomSaleStatisticsPdf({ request, response }: HttpContext) {
    try {
      const { hotelId, startDate, endDate } = request.body()

      const filters: ReportFilters = {
        hotelId: hotelId ? parseInt(hotelId) : undefined,
        startDate,
        endDate
      }

      const pdfBuffer = await ReportsService.generateRoomSaleStatisticsPdf(filters)

      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', 'attachment; filename="room-sale-statistics.pdf"')

      return response.send(pdfBuffer)
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error generating room sale statistics PDF',
        error: error.message
      })
    }
  }

  // Room Statistics
  async getRoomStatistics({ request, response }: HttpContext) {
    try {
      const { hotelId, startDate, endDate } = request.qs()

      const filters: ReportFilters = {
        hotelId: hotelId ? parseInt(hotelId) : undefined,
        startDate,
        endDate
      }

      const data = await ReportsService.getRoomStatisticsReport(filters)

      return response.ok({
        success: true,
        data
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error generating room statistics report',
        error: error.message
      })
    }
  }

  async generateRoomStatisticsPdf({ request, response }: HttpContext) {
    try {
      const { hotelId, startDate, endDate } = request.body()

      const filters: ReportFilters = {
        hotelId: hotelId ? parseInt(hotelId) : undefined,
        startDate,
        endDate
      }

      const pdfBuffer = await ReportsService.generateRoomStatisticsPdf(filters)

      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', 'attachment; filename="room-statistics.pdf"')

      return response.send(pdfBuffer)
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error generating room statistics PDF',
        error: error.message
      })
    }
  }

  // Room on Books
  async getRoomOnBooks({ request, response }: HttpContext) {
    try {
      const { hotelId, startDate, endDate } = request.qs()

      const filters: ReportFilters = {
        hotelId: hotelId ? parseInt(hotelId) : undefined,
        startDate,
        endDate
      }

      const data = await ReportsService.getRoomOnBooksReport(filters)

      return response.ok({
        success: true,
        data
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error generating room on books report',
        error: error.message
      })
    }
  }

  async generateRoomOnBooksPdf({ request, response }: HttpContext) {
    try {
      const { hotelId, startDate, endDate } = request.body()

      const filters: ReportFilters = {
        hotelId: hotelId ? parseInt(hotelId) : undefined,
        startDate,
        endDate
      }

      const pdfBuffer = await ReportsService.generateRoomOnBooksPdf(filters)

      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', 'attachment; filename="room-on-books.pdf"')

      return response.send(pdfBuffer)
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error generating room on books PDF',
        error: error.message
      })
    }
  }

  // Yearly Statistics
  async getYearlyStatistics({ request, response }: HttpContext) {
    try {
      const { hotelId, startDate, endDate } = request.qs()

      const filters: ReportFilters = {
        hotelId: hotelId ? parseInt(hotelId) : undefined,
        startDate,
        endDate
      }

      const data = await ReportsService.getYearlyStatisticsReport(filters)

      return response.ok({
        success: true,
        data
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error generating yearly statistics report',
        error: error.message
      })
    }
  }

  async generateYearlyStatisticsPdf({ request, response }: HttpContext) {
    try {
      const { hotelId, startDate, endDate } = request.body()

      const filters: ReportFilters = {
        hotelId: hotelId ? parseInt(hotelId) : undefined,
        startDate,
        endDate
      }

      const pdfBuffer = await ReportsService.generateYearlyStatisticsPdf(filters)

      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', 'attachment; filename="yearly-statistics.pdf"')

      return response.send(pdfBuffer)
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error generating yearly statistics PDF',
        error: error.message
      })
    }
  }

  // Performance Analysis Report
  async getPerformanceAnalysisReport({ request, response }: HttpContext) {
    try {
      const { hotelId, startDate, endDate } = request.qs()

      const filters: ReportFilters = {
        hotelId: hotelId ? parseInt(hotelId) : undefined,
        startDate,
        endDate
      }

      const data = await ReportsService.getPerformanceAnalysisReport(filters)

      return response.ok({
        success: true,
        data
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error generating performance analysis report',
        error: error.message
      })
    }
  }

  async generatePerformanceAnalysisReportPdf({ request, response }: HttpContext) {
    try {
      const { hotelId, startDate, endDate } = request.body()

      const filters: ReportFilters = {
        hotelId: hotelId ? parseInt(hotelId) : undefined,
        startDate,
        endDate
      }

      const pdfBuffer = await ReportsService.generatePerformanceAnalysisReportPdf(filters)

      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', 'attachment; filename="performance-analysis-report.pdf"')

      return response.send(pdfBuffer)
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error generating performance analysis PDF',
        error: error.message
      })
    }
  }

  // IP Report
  async getIpReport({ request, response }: HttpContext) {
    try {
      const { hotelId, startDate, endDate } = request.qs()

      const filters: ReportFilters = {
        hotelId: hotelId ? parseInt(hotelId) : undefined,
        startDate,
        endDate
      }

      const data = await ReportsService.getIpReport(filters)

      return response.ok({
        success: true,
        data
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error generating IP report',
        error: error.message
      })
    }
  }

  async generateIpReportPdf({ request, response }: HttpContext) {
    try {
      const { hotelId, startDate, endDate } = request.body()

      const filters: ReportFilters = {
        hotelId: hotelId ? parseInt(hotelId) : undefined,
        startDate,
        endDate
      }

      const pdfBuffer = await ReportsService.generateIpReportPdf(filters)

      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', 'attachment; filename="ip-report.pdf"')

      return response.send(pdfBuffer)
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error generating IP report PDF',
        error: error.message
      })
    }
  }

  // City Ledger Detail
  async getCityLedgerDetail({ request, response }: HttpContext) {
    try {
      const { hotelId, startDate, endDate } = request.qs()

      const filters: ReportFilters = {
        hotelId: hotelId ? parseInt(hotelId) : undefined,
        startDate,
        endDate
      }

      const data = await ReportsService.getCityLedgerDetailReport(filters)

      return response.ok({
        success: true,
        data
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error generating city ledger detail report',
        error: error.message
      })
    }
  }

  async generateCityLedgerDetailPdf({ request, response }: HttpContext) {
    try {
      const { hotelId, startDate, endDate } = request.body()

      const filters: ReportFilters = {
        hotelId: hotelId ? parseInt(hotelId) : undefined,
        startDate,
        endDate
      }

      const pdfBuffer = await ReportsService.generateCityLedgerDetailPdf(filters)

      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', 'attachment; filename="city-ledger-detail.pdf"')

      return response.send(pdfBuffer)
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error generating city ledger detail PDF',
        error: error.message
      })
    }
  }

  // City Ledger Summary
  async getCityLedgerSummary({ request, response }: HttpContext) {
    try {
      const { hotelId, startDate, endDate } = request.qs()

      const filters: ReportFilters = {
        hotelId: hotelId ? parseInt(hotelId) : undefined,
        startDate,
        endDate
      }

      const data = await ReportsService.getCityLedgerSummaryReport(filters)

      return response.ok({
        success: true,
        data
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error generating city ledger summary report',
        error: error.message
      })
    }
  }

  async generateCityLedgerSummaryPdf({ request, response }: HttpContext) {
    try {
      const { hotelId, startDate, endDate } = request.body()

      const filters: ReportFilters = {
        hotelId: hotelId ? parseInt(hotelId) : undefined,
        startDate,
        endDate
      }

      const pdfBuffer = await ReportsService.generateCityLedgerSummaryPdf(filters)

      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', 'attachment; filename="city-ledger-summary.pdf"')

      return response.send(pdfBuffer)
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error generating city ledger summary PDF',
        error: error.message
      })
    }
  }

  async getManagementPosSummaryData(hotelId: number, reportDate: DateTime) {
    return {
      outlets: [
        {
          outlet: "Restaurant Chez Madeleine",
          categories: [
            {
              name: "Category - Boissons",
              today: 0,
              ptd: 0,
              ytd: 0,

            }
          ],
          totalWithTax: {
            today: 0,
            ptd: 0,
            ytd: 0,
          },
          totalWithoutTax: {
            today: 0,
            ptd: 0,
            ytd: 0,
          }
        },
        {
          outlet: "TERRACINA",
          categories: [
            {
              name: "Category - autres",
              today: 0,
              ptd: 0,
              ytd: 0,

            },
            {
              name: "Category - Boissons",
              today: 0,
              ptd: 0,
              ytd: 0,

            }
          ],
          totalWithTax: {
            today: 0,
            ptd: 0,
            ytd: 0,
          },
          totalWithoutTax: {
            today: 0,
            ptd: 0,
            ytd: 0,
          }
        },

      ], totalWithTax: {
        today: 0,
        ptd: 0,
        ytd: 0,
      },
      totalWithoutTax: {
        today: 0,
        ptd: 0,
        ytd: 0,
      }
    }
  }

  async getManagementPosPaymentSummaryData(hotelId: number, reportDate: DateTime) {
    return {
      outlets: [
        {
          outlet: "Restaurant Chez Madeleine",
          payments: [
            {
              name: "Payment - Espèce",
              today: 0,
              ptd: 0,
              ytd: 0,
            }
          ],
          total: {
            today: 0,
            ptd: 0,
            ytd: 0,
          }
        }
      ],
      total: {
        today: 0,
        ptd: 0,
        ytd: 0,
      }
    }

  }

  /**
   * Print receipt for a transaction
   */
  async printReceipt({ params, response, auth }: HttpContext) {
    try {
      const transactionId = parseInt(params.transactionId)

      // Get the transaction with related data
      const transaction = await FolioTransaction.query()
        .where('id', transactionId)
        .preload('folio', (folioQuery) => {
          folioQuery.preload('hotel')
          folioQuery.preload('guest')
          folioQuery.preload('reservationRoom', (reservationRoomQuery: any) => {
            reservationRoomQuery.preload('room', (roomQuery: any) => {
              roomQuery.preload('roomType')
            })
          })
        })

        .preload('paymentMethod')
        .first()

      if (!transaction) {
        return response.notFound({
          success: false,
          message: 'Transaction not found'
        })
      }
      console.log('transaction.totalAmount', transaction.totalAmount)
      const totalAmountNumber = parseFloat(transaction.totalAmount?.toString() || '0')
      const amountInWords = this.calculateAmountInWords(totalAmountNumber)

      // Prepare data for the receipt template
      const receiptData = {
        transaction,
        amountInWords,
        hotel: transaction.folio.hotel,
        guest: transaction.folio.guest,
        folio: transaction.folio,
        reservations: transaction.folio.reservationRoom,
        room: transaction.folio.reservationRoom?.room,
        roomType: transaction.folio.reservationRoom?.room.roomType,
        paymentMethod: transaction.paymentMethod,
        printedBy: auth.user?.fullName || 'System',
        printedAt: DateTime.now()
      }
      console.log(receiptData)
      // Generate PDF using Edge template
      const { default: edge } = await import('edge.js')
      const path = await import('path')

      // Configure Edge with views directory
      edge.mount(path.join(process.cwd(), 'resources/views'))

      // Render the template
      const html = await edge.render('reports/receipt', receiptData)

      const pdfBuffer = await PdfService.generatePdfFromHtml(html, {
        format: 'A4',
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px'
        }
      })

      // Set response headers for PDF
      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', `inline; filename="receipt-${transaction.transactionNumber}.pdf"`)

      return response.send(pdfBuffer)

    } catch (error) {
      logger.error('Error generating receipt PDF:', error)
      
      console.log('Error generating receipt PDF:', error)
      return response.internalServerError({
        success: false,
        error: error
      })
    }
  }
  async printInvoice({ params, response, auth }: HttpContext) {
    try {
      const transactionId = parseInt(params.transactionId)

      // Get the transaction with related data
      const transaction = await FolioTransaction.query()
        .where('id', transactionId)
        .preload('folio', (folioQuery: any) => {
          folioQuery.preload('hotel')
          folioQuery.preload('guest')
          folioQuery.preload('reservationRoom', (reservationRoomQuery: any) => {
            reservationRoomQuery.preload('room', (roomQuery: any) => {
              roomQuery.preload('roomType')
            })
          })
        })

        .preload('paymentMethod')
        .first()

      if (!transaction) {
        return response.notFound({
          success: false,
          message: 'Transaction not found'
        })
      }

      // Prepare data for the receipt template
      const receiptData = {
        transaction,
        hotel: transaction.folio.hotel,
        guest: transaction.folio.guest,
        folio: transaction.folio,
        room: transaction.folio.reservationRoom?.room,
        roomType: transaction.folio.reservationRoom?.room.roomType,
        paymentMethod: transaction.paymentMethod,
        printedBy: auth.user?.fullName || 'System',
        printedAt: DateTime.now()
      }
      console.log('invoiceData.receipt', receiptData)
      // Generate PDF using Edge template
      const { default: edge } = await import('edge.js')
      const path = await import('path')

      // Configure Edge with views directory
      edge.mount(path.join(process.cwd(), 'resources/views'))

      // Render the template
      const html = await edge.render('reports/invoice', receiptData)

      const pdfBuffer = await PdfService.generatePdfFromHtml(html, {
        format: 'A4',
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px'
        }
      })

      // Set response headers for PDF
      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', `inline; filename="invoice-${transaction.transactionNumber}.pdf"`)

      return response.send(pdfBuffer)

    } catch (error) {
      logger.error('Error generating receipt PDF:', error)
      return response.internalServerError({
        success: false,
        message: 'Error generating receipt PDF',
        error: error.message
      })
    }
  }

  async printPosReceipt({ request, response }: HttpContext) {
    try {
      const { transactionId } = request.params()

      if (!transactionId) {
        return response.badRequest({
          success: false,
          message: 'Transaction ID is required'
        })
      }

      // Get transaction with all related data
      const transaction = await FolioTransaction.query()
        .where('id', transactionId)
        .preload('folio', (folioQuery: any) => {
          folioQuery.preload('hotel')
          folioQuery.preload('guest')
          folioQuery.preload('reservationRoom', (reservationRoomQuery: any) => {
            reservationRoomQuery.preload('room', (roomQuery: any) => {
              roomQuery.preload('roomType')
            })
          })
        })
        .preload('paymentMethod')
        .first()

      if (!transaction) {
        return response.notFound({
          success: false,
          message: 'Transaction not found'
        })
      }

      // Prepare receipt data for the template
      const receiptData = {
        transaction,
        folio: transaction.folio,
        hotel: transaction.folio.hotel,
        guest: transaction.folio.guest,
        room: transaction.folio.reservationRoom?.room,
        roomType: transaction.folio.reservationRoom?.room?.roomType,
        paymentMethod: transaction.paymentMethod,
        currentDate: DateTime.now().toFormat('dd/MM/yyyy HH:mm:ss'),
        formattedAmount: transaction.amount,
        currency: 'XAF'
      }
      const { default: edge } = await import('edge.js')
      const path = await import('path')
      // Configure Edge with views directory
      edge.mount(path.join(process.cwd(), 'resources/views'))

      // Render the POS receipt template
      const html = await edge.render('reports/pos-receipt', receiptData)

      const pdfBuffer = await PdfService.generatePdfFromHtml(html, {
        format: 'A4',
        margin: {
          top: '10px',
          right: '10px',
          bottom: '10px',
          left: '10px'
        }
      })

      // Set response headers for PDF
      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', `inline; filename="pos-receipt-${transaction.transactionNumber}.pdf"`)

      return response.send(pdfBuffer)

    } catch (error) {
      logger.error('Error generating POS receipt PDF:')
      logger.info(error)
      return response.internalServerError({
        success: false,
        message: 'Error generating POS receipt PDF',
        error: error.message
      })
    }
  }
  private calculateAmountInWords(amount: Float16Array | number) {
    // Vérifier que le montant est un nombre
    if (typeof amount !== 'number' || Number.isNaN(amount)) {
      throw new Error('Le montant doit être un nombre');
    }

    // Gérer les montants négatifs
    const isNegative = amount < 0
    const absoluteAmount = Math.abs(amount)

    // Séparer les parties entière et décimale (arrondies à 2 décimales)
    const integerPart = Math.floor(absoluteAmount)
    const fractionalPart = Math.round((absoluteAmount - integerPart) * 100) // 0..99

    let words = numberToWords.toWords(integerPart)

    // Ajouter la partie décimale si présente, au format XX/100
    if (fractionalPart > 0) {
      words = `${words} and ${fractionalPart.toString().padStart(2, '0')}/100`
    }

    if (isNegative) {
      words = `minus ${words}`
    }

    // Mettre une majuscule initiale pour une meilleure présentation
    return words.charAt(0).toUpperCase() + words.slice(1)
  }
}
