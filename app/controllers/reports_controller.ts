import type { HttpContext } from '@adonisjs/core/http'
import ReportsService, {
  ReportFilters
} from '#services/reports_service'
import { DateTime } from 'luxon'

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
      let reportData
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
  private exportToPDF(response: any, reportData: any, filename: string) {
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
  }

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
    const chartData = reservationData.map((data: any) => {
      const reservationCount = data.reservationCount || 0
      return {
        day: data.day,
        reservationCount,
        height: Math.max(10, reservationCount * 20) // Scale to chart height (20px per reservation)
      }
    })

    const maxReservations = Math.max(...chartData.map(d => d.reservationCount), 1)
    const totalReservations = chartData.reduce((sum, d) => sum + d.reservationCount, 0)
    const avgReservations = chartData.length > 0 
      ? (totalReservations / chartData.length).toFixed(1)
      : '0.0'

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Monthly Reservations - ${monthName}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0px;
            background-color: #f5f5f5;
        }
        .container {
            background-color: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 0px 0px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 3px solid #e74c3c;
            padding-bottom: 20px;
        }
        .title {
            background-color: #e74c3c;
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            display: inline-block;
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .chart-container {
            margin: 30px 0;
            position: relative;
            height: 450px;
            border: 1px solid #ddd;
            background-color: #fafafa;
            padding: 20px;
        }
        .chart-area {
            position: relative;
            height: 350px;
            margin-left: 60px;
            margin-bottom: 40px;
            border-left: 2px solid #333;
            border-bottom: 2px solid #333;
        }
        .chart {
            display: flex;
            align-items: flex-end;
            height: 100%;
            padding: 0 10px;
            gap: 3px;
        }
        .bar {
            background-color: #e74c3c;
            min-height: 2px;
            flex: 1;
            position: relative;
            border-radius: 2px 2px 0 0;
            border: 1px solid #c0392b;
        }
        .bar-value {
            position: absolute;
            top: -18px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 9px;
            color: #333;
            font-weight: bold;
            white-space: nowrap;
        }
        .x-axis {
            position: absolute;
            bottom: -5px;
            left: 60px;
            right: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .x-label {
            font-size: 10px;
            color: #666;
            text-align: center;
            flex: 1;
        }
        .y-axis {
            position: absolute;
            left: 1px;
            top: 20px;
            height: 350px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            align-items: flex-end;
        }
        .y-label {
            font-size: 10px;
            color: #666;
            margin-right: 10px;
            line-height: 1;
        }
        .legend {
            display: flex;
            justify-content: space-between;
            margin-top: 20px;
            padding: 15px;
            background-color: #f8f9fa;
            border-radius: 5px;
        }
        .legend-item {
            text-align: center;
        }
        .legend-value {
            font-size: 18px;
            font-weight: bold;
            color: #2c3e50;
        }
        .legend-label {
            font-size: 12px;
            color: #7f8c8d;
            margin-top: 5px;
        }
        .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 10px;
            color: #95a5a6;
            border-top: 1px solid #ecf0f1;
            padding-top: 15px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="title">Monthly Reservations - ${monthName}</div>
            <div style="display: flex; justify-content: flex-end; align-items: center; margin-top: 10px;">
                <div style="background-color: #e74c3c; color: white; padding: 5px 10px; border-radius: 3px; font-size: 12px;">
                    ■ Daily Reservations
                </div>
            </div>
        </div>
        
        <div class="chart-container">
            <div class="y-axis">
                <div class="y-label">${Math.ceil(maxReservations)}</div>
                <div class="y-label">${Math.ceil(maxReservations * 0.75)}</div>
                <div class="y-label">${Math.ceil(maxReservations * 0.5)}</div>
                <div class="y-label">${Math.ceil(maxReservations * 0.25)}</div>
                <div class="y-label">0</div>
            </div>
            
            <div class="chart-area">
                <div class="chart">
                    ${chartData.map(data => `
                        <div class="bar" style="height: ${data.height}px;">
                            <div class="bar-value">${data.reservationCount}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="x-axis">
                ${chartData.map(data => `
                    <div class="x-label">${data.day}</div>
                `).join('')}
            </div>
        </div>
        
        <div class="legend">
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