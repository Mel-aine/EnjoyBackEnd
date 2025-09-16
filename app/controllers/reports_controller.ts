import type { HttpContext } from '@adonisjs/core/http'
import ReportsService, {
  ReportFilters
} from '#services/reports_service'
import { DateTime } from 'luxon'
import PdfService from '#services/pdf_service'

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
        ratePlanId: filters.ratePlanId ? parseInt(filters.ratePlanId) : undefined
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
            'scheduled_departure_date', 'num_adults_total', 'num_children_total',
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
      ? (totalReservations / reservationData.length).toFixed(1)
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
}