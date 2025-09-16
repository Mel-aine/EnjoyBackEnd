import type { HttpContext } from '@adonisjs/core/http'
import ReportsService, { ReportFilters } from '#services/reports_service'
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
        data: availableReports,
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la récupération des types de rapports',
        error: error.message,
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
          message: 'Le type de rapport est requis',
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
            message: `Type de rapport non reconnu: ${reportType}`,
          })
      }

      return response.ok({
        success: true,
        data: reportData,
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la génération du rapport',
        error: error.message,
      })
    }
  }

  /**
   * Export report to different formats (CSV, PDF, Excel)
   */
  async export({ request, response }: HttpContext) {
    try {
      const {
        reportType,
        format = 'csv',
        filters = {},
      } = request.only(['reportType', 'format', 'filters'])

      if (!reportType) {
        return response.badRequest({
          success: false,
          message: 'Le type de rapport est requis',
        })
      }

      if (!['csv', 'pdf', 'excel'].includes(format)) {
        return response.badRequest({
          success: false,
          message: 'Format non supporté. Utilisez: csv, pdf, ou excel',
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
        ratePlanId: filters.ratePlanId ? parseInt(filters.ratePlanId) : undefined,
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
            message: `Type de rapport non reconnu: ${reportType}`,
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
            message: "Format d'export non supporté",
          })
      }
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: "Erreur lors de l'export du rapport",
        error: error.message,
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
          left: '1cm',
        },
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
        orderBy = [],
      } = request.only(['tableName', 'selectedFields', 'filters', 'joins', 'groupBy', 'orderBy'])

      if (!tableName) {
        return response.badRequest({
          success: false,
          message: 'Le nom de la table est requis',
        })
      }

      const reportFilters: ReportFilters = {
        hotelId: filters.hotelId ? parseInt(filters.hotelId) : undefined,
        startDate: filters.startDate,
        endDate: filters.endDate,
        status: filters.status,
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
        data: reportData,
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la génération du rapport personnalisé',
        error: error.message,
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
          { name: 'activity_logs', label: "Journaux d'Activité" },
        ],
        commonFields: {
          reservations: [
            'id',
            'confirmation_code',
            'reservation_status',
            'scheduled_arrival_date',
            'scheduled_departure_date',
            'num_adults_total',
            'num_children_total',
            'total_estimated_revenue',
            'special_notes',
            'created_at',
            'updated_at',
          ],
          guests: [
            'id',
            'firstName',
            'lastName',
            'email',
            'phoneNumber',
            'dateOfBirth',
            'nationality',
            'created_at',
            'updated_at',
          ],
          rooms: [
            'id',
            'room_number',
            'room_name',
            'floor_number',
            'max_occupancy_adults',
            'room_status',
            'housekeeping_status',
            'maintenance_status',
          ],
          payments: [
            'id',
            'amount',
            'payment_date',
            'payment_status',
            'payment_method',
            'transaction_reference',
            'created_at',
          ],
        },
        joinOptions: [
          { table: 'guests', on: 'reservations.guest_id' },
          { table: 'hotels', on: 'reservations.hotel_id' },
          { table: 'room_types', on: 'reservations.primary_room_type_id' },
          { table: 'booking_sources', on: 'reservations.booking_source_id' },
          { table: 'rate_plans', on: 'reservations.rate_plan_id' },
        ],
      }

      return response.ok({
        success: true,
        data: templates,
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la récupération des modèles',
        error: error.message,
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
          message: 'Aucune donnée à exporter',
        })
      }

      // Get headers from first data row
      const headers = Object.keys(reportData.data[0])

      // Create CSV content
      let csvContent = headers.join(',') + '\n'

      reportData.data.forEach((row: any) => {
        const values = headers.map((header) => {
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
        message: "Erreur lors de l'export CSV",
        error: error.message,
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
          filename: filename,
        },
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: "Erreur lors de l'export Excel",
        error: error.message,
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
          message: 'Hotel ID, month, and year are required',
        })
      }

      // Create start and end dates for the month
      const startDate = DateTime.fromObject({
        year: parseInt(year),
        month: parseInt(month),
        day: 1,
      })
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
      const printedBy = user
        ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown User'
        : 'System'

      // Generate HTML content
      const htmlContent = this.generateMonthlyOccupancyHtml(
        dailyReservationCounts,
        startDate,
        printedBy
      )

      // Import PDF generation service
      const { default: PdfGenerationService } = await import('#services/pdf_generation_service')

      // Generate PDF
      const pdfBuffer = await PdfGenerationService.generatePdfFromHtml(htmlContent)

      // Set response headers
      response.header('Content-Type', 'application/pdf')
      response.header(
        'Content-Disposition',
        `attachment; filename="monthly-reservations-${year}-${month}.pdf"`
      )

      return response.send(pdfBuffer)
    } catch (error) {
      console.error('Error generating monthly reservations PDF:', error)
      return response.internalServerError({
        success: false,
        message: 'Failed to generate monthly reservations PDF',
        error: error.message,
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
        reservationCount: parseInt(reservationCount[0].$extras.total) || 0,
      })
    }

    return dailyCounts
  }

  private generateMonthlyOccupancyHtml(
    reservationData: any[],
    startDate: DateTime,
    printedBy: string = 'System'
  ): string {
    const monthName = startDate.toFormat('MMMM yyyy')

    // Calculate chart data
    const maxReservations = Math.max(...reservationData.map((d) => d.reservationCount), 1)
    const totalReservations = reservationData.reduce((sum, d) => sum + d.reservationCount, 0)
    const avgReservations =
      reservationData.length > 0 ? (totalReservations / reservationData.length).toFixed(1) : '0.0'

    // Set a fixed y-axis max for better visualization
    const yAxisMax = Math.max(maxReservations, 10)
    const maxChartHeight = 350

    const chartData = reservationData.map((data) => ({
      day: data.day,
      reservationCount: data.reservationCount,
      height: Math.max((data.reservationCount / yAxisMax) * maxChartHeight, 2),
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
                    ${chartData
                      .map(
                        (data) => `
                        <div class="bar" style="height: ${data.height}px;">
                            <div class="bar-value">${data.reservationCount}</div>
                        </div>
                    `
                      )
                      .join('')}
                </div>
                <div class="x-axis">
                    ${chartData.map((data) => `<div class="x-label">${data.day}</div>`).join('')}
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
        endDate: DateTime.now().endOf('month').toISO(),
      }

      // Get key statistics for dashboard
      const [occupancyData, revenueData, arrivalData] = await Promise.all([
        ReportsService.getOccupancyReport(filters),
        ReportsService.getRevenueReport(filters),
        ReportsService.getArrivalList(filters),
      ])

      const stats = {
        occupancy: {
          current: occupancyData.summary?.averageOccupancyRate || 0,
          max: occupancyData.summary?.maxOccupancyRate || 0,
          min: occupancyData.summary?.minOccupancyRate || 0,
        },
        revenue: {
          total: revenueData.summary?.totalRevenue || 0,
          average: revenueData.summary?.averageDailyRevenue || 0,
          reservations: revenueData.summary?.totalReservations || 0,
        },
        arrivals: {
          today: arrivalData.totalRecords || 0,
          totalRevenue: arrivalData.summary?.totalRevenue || 0,
          totalNights: arrivalData.summary?.totalNights || 0,
        },
      }

      return response.ok({
        success: true,
        data: stats,
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la récupération des statistiques',
        error: error.message,
      })
    }
  }

  /**
   * Generate room availability PDF report
   */
  async generateRoomAvailabilityPdf({ request, response, auth }: HttpContext) {
    try {
      const {
        hotelId,
        dateFrom,
        dateTo,
        roomTypeId,
        floor,
        includeSummary = true,
        includeCharts = true,
        includeDetails = true,
        groupByFloor = false,
      } = request.qs()

      if (!dateFrom || !dateTo) {
        return response.badRequest({
          success: false,
          message: 'Date range is required (dateFrom and dateTo)',
        })
      }

      // Create filters for the report
      const reportFilters: ReportFilters = {
        hotelId: hotelId ? parseInt(hotelId) : undefined,
        startDate: dateFrom,
        endDate: dateTo,
        roomTypeId: roomTypeId ? parseInt(roomTypeId) : undefined,
      }

      // Get room availability data
      const roomAvailabilityData = await ReportsService.getRoomAvailability(reportFilters)

      // Get authenticated user information
      const user = auth.user
      const printedBy = user
        ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown User'
        : 'System'

      // Generate HTML content for PDF
      const htmlContent = this.generateRoomAvailabilityHtml(
        roomAvailabilityData,
        {
          dateFrom,
          dateTo,
          floor,
          roomTypeId,
          includeSummary,
          includeCharts,
          includeDetails,
          groupByFloor,
        },
        printedBy
      )

      // Generate PDF
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

      // Generate filename
      const timestamp = DateTime.now().toFormat('yyyy-MM-dd_HH-mm-ss')
      const filename = `room_availability_${dateFrom}_to_${dateTo}_${timestamp}.pdf`

      // Set response headers
      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', `attachment; filename="${filename}"`)

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
   * Generate HTML content for room availability PDF report
   */
  private generateRoomAvailabilityHtml(
    reportData: any,
    options: {
      dateFrom: string
      dateTo: string
      floor?: string
      roomTypeId?: string
      includeSummary: boolean
      includeCharts: boolean
      includeDetails: boolean
      groupByFloor: boolean
    },
    printedBy: string = 'System'
  ): string {
    const { dateFrom, dateTo, floor, includeSummary, includeCharts, includeDetails, groupByFloor } = options
  
    // Calculate summary statistics
    const totalRooms = reportData.data?.length || 0
    const availableRooms = reportData.data?.filter((room: any) => room.status === 'available').length || 0
    const occupiedRooms = reportData.data?.filter((room: any) => room.status === 'occupied').length || 0
    const maintenanceRooms = reportData.data?.filter((room: any) => room.status === 'maintenance').length || 0
    const cleaningRooms = reportData.data?.filter((room: any) => room.status === 'cleaning').length || 0
    const occupancyRate = totalRooms > 0 ? ((occupiedRooms / totalRooms) * 100).toFixed(1) : '0.0'
  
    // Calculate percentages for donut chart
    const availablePercent = totalRooms > 0 ? (availableRooms / totalRooms) * 100 : 0
    const occupiedPercent = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0
    const maintenancePercent = totalRooms > 0 ? (maintenanceRooms / totalRooms) * 100 : 0
    const cleaningPercent = totalRooms > 0 ? (cleaningRooms / totalRooms) * 100 : 0
  
    // Create donut chart segments
    const createDonutSegment = (percentage: number, color: string, startAngle: number) => {
      if (percentage === 0) return { path: '', endAngle: startAngle }
      
      const angle = (percentage / 100) * 360
      const endAngle = startAngle + angle
      
      const startAngleRad = (startAngle * Math.PI) / 180
      const endAngleRad = (endAngle * Math.PI) / 180
      
      const radius = 90
      const innerRadius = 50
      const centerX = 140
      const centerY = 140
      
      const x1 = centerX + radius * Math.cos(startAngleRad)
      const y1 = centerY + radius * Math.sin(startAngleRad)
      const x2 = centerX + radius * Math.cos(endAngleRad)
      const y2 = centerY + radius * Math.sin(endAngleRad)
      const x3 = centerX + innerRadius * Math.cos(endAngleRad)
      const y3 = centerY + innerRadius * Math.sin(endAngleRad)
      const x4 = centerX + innerRadius * Math.cos(startAngleRad)
      const y4 = centerY + innerRadius * Math.sin(startAngleRad)
      
      const largeArcFlag = angle > 180 ? 1 : 0
      
      const path = `
        <path d="M ${x1} ${y1} 
                 A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}
                 L ${x3} ${y3}
                 A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x4} ${y4} Z" 
              fill="${color}" 
              stroke="white" 
              stroke-width="3"
              class="donut-segment"
              style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));">
        </path>
      `
      
      return { path, endAngle }
    }
  
    // Generate chart segments
    let currentAngle = 0
    const availableSegment = createDonutSegment(availablePercent, '#10b981', currentAngle)
    currentAngle = availableSegment.endAngle
    const occupiedSegment = createDonutSegment(occupiedPercent, '#ef4444', currentAngle)
    currentAngle = occupiedSegment.endAngle
    const maintenanceSegment = createDonutSegment(maintenancePercent, '#f59e0b', currentAngle)
    currentAngle = maintenanceSegment.endAngle
    const cleaningSegment = createDonutSegment(cleaningPercent, '#3b82f6', currentAngle)
  
    return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Room Availability Report</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
      <style>
          * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
          }
          
          body {
              font-family: 'Inter', sans-serif;
              background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
              color: #1e293b;
              line-height: 1.6;
              height: 100vh;
              overflow: hidden;
          }
          
          .report-container {
              height: 100vh;
              background: white;
              display: flex;
              flex-direction: column;
          }
          
          .header {
              background:  #8b5cf6;
              color: white;
              padding: 2rem;
              text-align: center;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          
          .header h1 {
              font-size: 2.2rem;
              font-weight: 700;
              margin-bottom: 0.5rem;
              text-shadow: 0 2px 4px rgba(0,0,0,0.2);
          }
          
          .header .subtitle {
              font-size: 1rem;
              opacity: 0.9;
              font-weight: 300;
          }
          
          .report-meta {
              display: flex;
              justify-content: space-between;
              margin-top: 1rem;
              font-size: 0.85rem;
              opacity: 0.8;
          }
          
          .content {
              flex: 1;
              display: grid;
              grid-template-columns: 1fr 1fr;
              padding: 2rem;
              gap: 2rem;
              overflow: hidden;
          }
          
          .chart-section {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
          }
          
          .chart-title {
              font-size: 1.3rem;
              font-weight: 600;
              color: #1e293b;
              margin-bottom: 1.5rem;
              text-align: center;
          }
          
          .donut-container {
              position: relative;
              width: 280px;
              height: 280px;
              margin-bottom: 1rem;
          }
          
          .donut-chart {
              width: 100%;
              height: 100%;
          }
          
          .donut-center {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              text-align: center;
              background: white;
              border-radius: 50%;
              width: 100px;
              height: 100px;
              display: flex;
              flex-direction: column;
              justify-content: center;
              box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          }
          
          .donut-total {
              font-size: 2rem;
              font-weight: 700;
              color: #1e293b;
              line-height: 1;
          }
          
          .donut-label {
              font-size: 0.7rem;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-top: 2px;
          }
          
          .stats-section {
              display: flex;
              flex-direction: column;
              gap: 1rem;
          }
          
          .stats-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 1rem;
              margin-bottom: 1.5rem;
          }
          
          .stat-card {
              background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              padding: 1.5rem;
              text-align: center;
              transition: transform 0.2s ease;
          }
          
          .stat-card:hover {
              transform: translateY(-2px);
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          }
          
          .stat-value {
              font-size: 2rem;
              font-weight: 700;
              margin-bottom: 0.5rem;
          }
          
          .stat-label {
              font-size: 0.8rem;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              font-weight: 500;
          }
          
          .available { color: #10b981; }
          .occupied { color: #ef4444; }
          .maintenance { color: #f59e0b; }
          .cleaning { color: #3b82f6; }
          .occupancy { color: #8b5cf6; }
          
          .legend {
              display: grid;
              grid-template-columns: 1fr;
              gap: 0.75rem;
          }
          
          .legend-item {
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 0.75rem 1rem;
              background: #f8fafc;
              border-radius: 8px;
              border-left: 4px solid;
              transition: all 0.2s ease;
          }
          
          .legend-item:hover {
              background: #f1f5f9;
              transform: translateX(4px);
          }
          
          .legend-info {
              display: flex;
              align-items: center;
              gap: 0.75rem;
          }
          
          .legend-color {
              width: 12px;
              height: 12px;
              border-radius: 3px;
          }
          
          .legend-text {
              font-size: 0.85rem;
              font-weight: 500;
              color: #374151;
          }
          
          .legend-stats {
              display: flex;
              align-items: center;
              gap: 0.5rem;
          }
          
          .legend-value {
              font-size: 1rem;
              font-weight: 600;
              color: #1e293b;
          }
          
          .legend-percentage {
              font-size: 0.75rem;
              color: #64748b;
              background: #e2e8f0;
              padding: 0.2rem 0.4rem;
              border-radius: 4px;
          }
          
          .legend-item.available { border-left-color: #10b981; }
          .legend-item.occupied { border-left-color: #ef4444; }
          .legend-item.maintenance { border-left-color: #f59e0b; }
          .legend-item.cleaning { border-left-color: #3b82f6; }
          
          .footer {
              padding: 1rem 2rem;
              border-top: 1px solid #e2e8f0;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 0.75rem;
              color: #64748b;
              background: #f8fafc;
          }
          
          @media print {
              body { background: white; }
              .report-container { height: auto; }
              .content { page-break-inside: avoid; }
          }
      </style>
  </head>
  <body>
      <div class="report-container">
          <div class="header">
              <h1>Room Availability Report</h1>
              <p class="subtitle">Real-time room status and occupancy analysis</p>
              <div class="report-meta">
                  <span>Period: ${dateFrom} to ${dateTo}</span>
                  <span>Generated: ${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR')}</span>
                  <span>Total Rooms: ${totalRooms}</span>
              </div>
          </div>
          
          <div class="content">
              <!-- Chart Section -->
              <div class="chart-section">
                  <h3 class="chart-title">Room Status Distribution</h3>
                  <div class="donut-container">
                      <svg class="donut-chart" viewBox="0 0 280 280">
                          ${availableSegment.path}
                          ${occupiedSegment.path}
                          ${maintenanceSegment.path}
                          ${cleaningSegment.path}
                      </svg>
                      <div class="donut-center">
                          <div class="donut-total">${totalRooms}</div>
                          <div class="donut-label">Rooms</div>
                      </div>
                  </div>
              </div>
              
              <!-- Stats Section -->
              <div class="stats-section">
                  <div class="stats-grid">
                      <div class="stat-card">
                          <div class="stat-value occupancy">${occupancyRate}%</div>
                          <div class="stat-label">Occupancy Rate</div>
                      </div>
                      <div class="stat-card">
                          <div class="stat-value">${totalRooms}</div>
                          <div class="stat-label">Total Rooms</div>
                      </div>
                  </div>
                  
                  <div class="legend">
                      ${availableRooms > 0 ? `
                      <div class="legend-item available">
                          <div class="legend-info">
                              <div class="legend-color" style="background-color: #10b981;"></div>
                              <span class="legend-text">Available</span>
                          </div>
                          <div class="legend-stats">
                              <span class="legend-value">${availableRooms}</span>
                              <span class="legend-percentage">${availablePercent.toFixed(1)}%</span>
                          </div>
                      </div>
                      ` : ''}
                      
                      ${occupiedRooms > 0 ? `
                      <div class="legend-item occupied">
                          <div class="legend-info">
                              <div class="legend-color" style="background-color: #ef4444;"></div>
                              <span class="legend-text">Occupied</span>
                          </div>
                          <div class="legend-stats">
                              <span class="legend-value">${occupiedRooms}</span>
                              <span class="legend-percentage">${occupiedPercent.toFixed(1)}%</span>
                          </div>
                      </div>
                      ` : ''}
                      
                      ${maintenanceRooms > 0 ? `
                      <div class="legend-item maintenance">
                          <div class="legend-info">
                              <div class="legend-color" style="background-color: #f59e0b;"></div>
                              <span class="legend-text">Maintenance</span>
                          </div>
                          <div class="legend-stats">
                              <span class="legend-value">${maintenanceRooms}</span>
                              <span class="legend-percentage">${maintenancePercent.toFixed(1)}%</span>
                          </div>
                      </div>
                      ` : ''}
                      
                      ${cleaningRooms > 0 ? `
                      <div class="legend-item cleaning">
                          <div class="legend-info">
                              <div class="legend-color" style="background-color: #3b82f6;"></div>
                              <span class="legend-text">Cleaning</span>
                          </div>
                          <div class="legend-stats">
                              <span class="legend-value">${cleaningRooms}</span>
                              <span class="legend-percentage">${cleaningPercent.toFixed(1)}%</span>
                          </div>
                      </div>
                      ` : ''}
                  </div>
              </div>
          </div>
          
          <div class="footer">
              <div>Generated: ${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR')}</div>
              <div>Report by: ${printedBy}</div>
          </div>
      </div>
  </body>
  </html>
    `
  }
}
