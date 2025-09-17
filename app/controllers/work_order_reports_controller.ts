import type { HttpContext } from '@adonisjs/core/http'
import WorkOrder from '#models/work_order'
import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import PdfService from '#services/pdf_service'
import vine from '@vinejs/vine'

export default class WorkOrderReportsController {
  /**
   * Get all available work order report types
   */
  async index({ response }: HttpContext) {
    try {
      const availableReports = [
        {
          id: 'workOrdersByStatus',
          name: 'Work Orders by Status',
          description: 'Report showing work orders grouped by their current status',
          category: 'Operations'
        },
        {
          id: 'workOrdersByPriority',
          name: 'Work Orders by Priority',
          description: 'Report showing work orders grouped by priority level',
          category: 'Operations'
        },
        {
          id: 'workOrdersByDepartment',
          name: 'Work Orders by Department',
          description: 'Report showing work orders assigned to different departments',
          category: 'Operations'
        },
        {
          id: 'workOrdersByAssignee',
          name: 'Work Orders by Assignee',
          description: 'Report showing work orders assigned to specific users',
          category: 'Operations'
        },
        {
          id: 'workOrdersOverdue',
          name: 'Overdue Work Orders',
          description: 'Report showing work orders that are past their due date',
          category: 'Operations'
        },
        {
          id: 'workOrdersCompleted',
          name: 'Completed Work Orders',
          description: 'Report showing completed work orders within a date range',
          category: 'Operations'
        },
        {
          id: 'workOrdersSummary',
          name: 'Work Orders Summary',
          description: 'Summary report with key metrics and statistics',
          category: 'Analytics'
        }
      ]

      return response.ok({
        success: true,
        data: availableReports
      })
    } catch (error) {
      logger.error('Error getting work order report types:', error)
      return response.internalServerError({
        success: false,
        message: 'Error retrieving work order report types',
        error: error.message
      })
    }
  }

  /**
   * Generate a specific work order report
   */
  async generate({ request, response }: HttpContext) {
    try {
      const { reportType, filters = {}, format = 'json' } = request.only(['reportType', 'filters', 'format'])

      if (!reportType) {
        return response.badRequest({
          success: false,
          message: 'Report type is required'
        })
      }

      // Validate filters
      const reportFilters = await this.validateFilters(filters)

      let reportData

      switch (reportType) {
        case 'workOrdersByStatus':
          reportData = await this.getWorkOrdersByStatus(reportFilters)
          break
        case 'workOrdersByPriority':
          reportData = await this.getWorkOrdersByPriority(reportFilters)
          break
        case 'workOrdersByDepartment':
          reportData = await this.getWorkOrdersByDepartment(reportFilters)
          break
        case 'workOrdersByAssignee':
          reportData = await this.getWorkOrdersByAssignee(reportFilters)
          break
        case 'workOrdersOverdue':
          reportData = await this.getOverdueWorkOrders(reportFilters)
          break
        case 'workOrdersCompleted':
          reportData = await this.getCompletedWorkOrders(reportFilters)
          break
        case 'workOrdersSummary':
          reportData = await this.getWorkOrdersSummary(reportFilters)
          break
        default:
          return response.badRequest({
            success: false,
            message: `Unknown report type: ${reportType}`
          })
      }

      // Handle different output formats
      if (format === 'pdf') {
        const pdfBuffer = await this.generatePdfReport(reportType, reportData)
        return response.header('Content-Type', 'application/pdf').send(pdfBuffer)
      }

      return response.ok({
        success: true,
        data: reportData,
        reportType,
        generatedAt: DateTime.now().toISO(),
        filters: reportFilters
      })

    } catch (error) {
      logger.error('Error generating work order report:', error)
      return response.internalServerError({
        success: false,
        message: 'Error generating work order report',
        error: error.message
      })
    }
  }

  /**
   * Validate report filters
   */
  private async validateFilters(filters: any) {
    const schema = vine.object({
      hotelId: vine.number().optional(),
      startDate: vine.string().optional(),
      endDate: vine.string().optional(),
      status: vine.string().optional(),
      priority: vine.string().optional(),
      departmentId: vine.number().optional(),
      assignedTo: vine.number().optional(),
      createdBy: vine.number().optional(),
      roomId: vine.number().optional(),
      category: vine.string().optional()
    })

    return await vine.validate({ schema, data: filters })
  }

  /**
   * Get work orders grouped by status
   */
  private async getWorkOrdersByStatus(filters: any) {
    const query = WorkOrder.query()
      .preload('assignedToUser')
      .preload('createdByUser')
      .preload('room')
      .preload('department')

    this.applyFilters(query, filters)

    const workOrders = await query.exec()

    const groupedByStatus = workOrders.reduce((acc, workOrder) => {
      const status = workOrder.status
      if (!acc[status]) {
        acc[status] = []
      }
      acc[status].push(workOrder)
      return acc
    }, {} as Record<string, any[]>)

    return {
      title: 'Work Orders by Status',
      data: groupedByStatus,
      summary: {
        totalWorkOrders: workOrders.length,
        statusCounts: Object.keys(groupedByStatus).map(status => ({
          status,
          count: groupedByStatus[status].length
        }))
      }
    }
  }

  /**
   * Get work orders grouped by priority
   */
  private async getWorkOrdersByPriority(filters: any) {
    const query = WorkOrder.query()
      .preload('assignedToUser')
      .preload('createdByUser')
      .preload('room')
      .preload('department')

    this.applyFilters(query, filters)

    const workOrders = await query.exec()

    const groupedByPriority = workOrders.reduce((acc, workOrder) => {
      const priority = workOrder.priority
      if (!acc[priority]) {
        acc[priority] = []
      }
      acc[priority].push(workOrder)
      return acc
    }, {} as Record<string, any[]>)

    return {
      title: 'Work Orders by Priority',
      data: groupedByPriority,
      summary: {
        totalWorkOrders: workOrders.length,
        priorityCounts: Object.keys(groupedByPriority).map(priority => ({
          priority,
          count: groupedByPriority[priority].length
        }))
      }
    }
  }

  /**
   * Get work orders grouped by department
   */
  private async getWorkOrdersByDepartment(filters: any) {
    const query = WorkOrder.query()
      .preload('assignedToUser')
      .preload('createdByUser')
      .preload('room')
      .preload('department')

    this.applyFilters(query, filters)

    const workOrders = await query.exec()

    const groupedByDepartment = workOrders.reduce((acc, workOrder) => {
      const departmentName = workOrder.department?.name || 'Unassigned'
      if (!acc[departmentName]) {
        acc[departmentName] = []
      }
      acc[departmentName].push(workOrder)
      return acc
    }, {} as Record<string, any[]>)

    return {
      title: 'Work Orders by Department',
      data: groupedByDepartment,
      summary: {
        totalWorkOrders: workOrders.length,
        departmentCounts: Object.keys(groupedByDepartment).map(department => ({
          department,
          count: groupedByDepartment[department].length
        }))
      }
    }
  }

  /**
   * Get work orders grouped by assignee
   */
  private async getWorkOrdersByAssignee(filters: any) {
    const query = WorkOrder.query()
      .preload('assignedToUser')
      .preload('createdByUser')
      .preload('room')
      .preload('department')

    this.applyFilters(query, filters)

    const workOrders = await query.exec()

    const groupedByAssignee = workOrders.reduce((acc, workOrder) => {
      const assigneeName = workOrder.assignedToUser 
        ? `${workOrder.assignedToUser.firstName} ${workOrder.assignedToUser.lastName}`
        : 'Unassigned'
      if (!acc[assigneeName]) {
        acc[assigneeName] = []
      }
      acc[assigneeName].push(workOrder)
      return acc
    }, {} as Record<string, any[]>)

    return {
      title: 'Work Orders by Assignee',
      data: groupedByAssignee,
      summary: {
        totalWorkOrders: workOrders.length,
        assigneeCounts: Object.keys(groupedByAssignee).map(assignee => ({
          assignee,
          count: groupedByAssignee[assignee].length
        }))
      }
    }
  }

  /**
   * Get overdue work orders
   */
  private async getOverdueWorkOrders(filters: any) {
    const query = WorkOrder.query()
      .preload('assignedToUser')
      .preload('createdByUser')
      .preload('room')
      .preload('department')
      .where('dueDate', '<', DateTime.now().toJSDate())
      .whereNotIn('status', ['completed', 'cancelled'])

    this.applyFilters(query, filters)

    const workOrders = await query.exec()

    return {
      title: 'Overdue Work Orders',
      data: workOrders,
      summary: {
        totalOverdue: workOrders.length,
        averageDaysOverdue: workOrders.length > 0 
          ? workOrders.reduce((sum, wo) => {
              const daysOverdue = DateTime.now().diff(DateTime.fromJSDate(wo.dueDate), 'days').days
              return sum + Math.floor(daysOverdue)
            }, 0) / workOrders.length
          : 0
      }
    }
  }

  /**
   * Get completed work orders
   */
  private async getCompletedWorkOrders(filters: any) {
    const query = WorkOrder.query()
      .preload('assignedToUser')
      .preload('createdByUser')
      .preload('room')
      .preload('department')
      .where('status', 'completed')

    this.applyFilters(query, filters)

    const workOrders = await query.exec()

    return {
      title: 'Completed Work Orders',
      data: workOrders,
      summary: {
        totalCompleted: workOrders.length,
        averageCompletionTime: workOrders.length > 0
          ? workOrders.reduce((sum, wo) => {
              if (wo.completedAt && wo.createdAt) {
                const completionTime = DateTime.fromJSDate(wo.completedAt).diff(DateTime.fromJSDate(wo.createdAt), 'hours').hours
                return sum + completionTime
              }
              return sum
            }, 0) / workOrders.length
          : 0
      }
    }
  }

  /**
   * Get work orders summary with key metrics
   */
  private async getWorkOrdersSummary(filters: any) {
    const baseQuery = WorkOrder.query()
    this.applyFilters(baseQuery, filters)

    const totalWorkOrders = await baseQuery.clone().count('* as total')
    const pendingWorkOrders = await baseQuery.clone().where('status', 'pending').count('* as total')
    const inProgressWorkOrders = await baseQuery.clone().where('status', 'in_progress').count('* as total')
    const completedWorkOrders = await baseQuery.clone().where('status', 'completed').count('* as total')
    const overdueWorkOrders = await baseQuery.clone()
      .where('dueDate', '<', DateTime.now().toJSDate())
      .whereNotIn('status', ['completed', 'cancelled'])
      .count('* as total')

    const highPriorityWorkOrders = await baseQuery.clone().where('priority', 'high').count('* as total')
    const mediumPriorityWorkOrders = await baseQuery.clone().where('priority', 'medium').count('* as total')
    const lowPriorityWorkOrders = await baseQuery.clone().where('priority', 'low').count('* as total')

    return {
      title: 'Work Orders Summary',
      data: {
        statusSummary: {
          total: totalWorkOrders[0].$extras.total,
          pending: pendingWorkOrders[0].$extras.total,
          inProgress: inProgressWorkOrders[0].$extras.total,
          completed: completedWorkOrders[0].$extras.total,
          overdue: overdueWorkOrders[0].$extras.total
        },
        prioritySummary: {
          high: highPriorityWorkOrders[0].$extras.total,
          medium: mediumPriorityWorkOrders[0].$extras.total,
          low: lowPriorityWorkOrders[0].$extras.total
        }
      }
    }
  }

  /**
   * Apply filters to query
   */
  private applyFilters(query: any, filters: any) {
    if (filters.hotelId) {
      query.where('hotelId', filters.hotelId)
    }

    if (filters.startDate) {
      query.where('createdAt', '>=', DateTime.fromISO(filters.startDate).toJSDate())
    }

    if (filters.endDate) {
      query.where('createdAt', '<=', DateTime.fromISO(filters.endDate).toJSDate())
    }

    if (filters.status) {
      query.where('status', filters.status)
    }

    if (filters.priority) {
      query.where('priority', filters.priority)
    }

    if (filters.departmentId) {
      query.where('departmentId', filters.departmentId)
    }

    if (filters.assignedTo) {
      query.where('assignedTo', filters.assignedTo)
    }

    if (filters.createdBy) {
      query.where('createdBy', filters.createdBy)
    }

    if (filters.roomId) {
      query.where('roomId', filters.roomId)
    }

    if (filters.category) {
      query.where('category', filters.category)
    }
  }

  /**
   * Generate PDF report
   */
  private async generatePdfReport(reportType: string, reportData: any) {
    const htmlContent = this.generateHtmlReport(reportType, reportData)
    return await PdfService.generatePdf(htmlContent)
  }

  /**
   * Generate HTML content for PDF reports
   */
  private generateHtmlReport(reportType: string, reportData: any): string {
    const title = reportData.title || 'Work Order Report'
    const generatedAt = DateTime.now().toFormat('dd/MM/yyyy HH:mm')

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
          .subtitle { font-size: 14px; color: #666; }
          .summary { background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px; }
          .data-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .data-table th, .data-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          .data-table th { background-color: #f2f2f2; font-weight: bold; }
          .section { margin: 30px 0; }
          .section-title { font-size: 18px; font-weight: bold; margin-bottom: 15px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">${title}</div>
          <div class="subtitle">Generated on ${generatedAt}</div>
        </div>
        
        ${this.renderReportContent(reportType, reportData)}
      </body>
      </html>
    `
  }

  /**
   * Render specific report content based on type
   */
  private renderReportContent(reportType: string, reportData: any): string {
    switch (reportType) {
      case 'workOrdersSummary':
        return this.renderSummaryReport(reportData)
      default:
        return this.renderGenericReport(reportData)
    }
  }

  /**
   * Render summary report content
   */
  private renderSummaryReport(reportData: any): string {
    const { statusSummary, prioritySummary } = reportData.data

    return `
      <div class="section">
        <div class="section-title">Status Summary</div>
        <table class="data-table">
          <tr><th>Status</th><th>Count</th></tr>
          <tr><td>Total</td><td>${statusSummary.total}</td></tr>
          <tr><td>Pending</td><td>${statusSummary.pending}</td></tr>
          <tr><td>In Progress</td><td>${statusSummary.inProgress}</td></tr>
          <tr><td>Completed</td><td>${statusSummary.completed}</td></tr>
          <tr><td>Overdue</td><td>${statusSummary.overdue}</td></tr>
        </table>
      </div>
      
      <div class="section">
        <div class="section-title">Priority Summary</div>
        <table class="data-table">
          <tr><th>Priority</th><th>Count</th></tr>
          <tr><td>High</td><td>${prioritySummary.high}</td></tr>
          <tr><td>Medium</td><td>${prioritySummary.medium}</td></tr>
          <tr><td>Low</td><td>${prioritySummary.low}</td></tr>
        </table>
      </div>
    `
  }

  /**
   * Render generic report content
   */
  private renderGenericReport(reportData: any): string {
    if (reportData.summary) {
      return `
        <div class="summary">
          <strong>Summary:</strong> ${JSON.stringify(reportData.summary, null, 2)}
        </div>
        <div class="section">
          <div class="section-title">Report Data</div>
          <pre>${JSON.stringify(reportData.data, null, 2)}</pre>
        </div>
      `
    }

    return `
      <div class="section">
        <div class="section-title">Report Data</div>
        <pre>${JSON.stringify(reportData, null, 2)}</pre>
      </div>
    `
  }
}