import vine from '@vinejs/vine'

/**
 * Validator for work order report generation requests
 */
export const workOrderReportValidator = vine.compile(
  vine.object({
    reportType: vine.string().in([
      'workOrdersByStatus',
      'workOrdersByPriority', 
      'workOrdersByDepartment',
      'workOrdersByAssignee',
      'workOrdersOverdue',
      'workOrdersCompleted',
      'workOrdersSummary'
    ]),
    format: vine.string().in(['json', 'pdf']).optional(),
    filters: vine.object({
      hotelId: vine.number().positive().optional(),
      startDate: vine.string().datetime().optional(),
      endDate: vine.string().datetime().optional(),
      status: vine.string().in([
        'pending',
        'in_progress', 
        'completed',
        'cancelled',
        'on_hold'
      ]).optional(),
      priority: vine.string().in([
        'low',
        'medium',
        'high',
        'urgent'
      ]).optional(),
      departmentId: vine.number().positive().optional(),
      assignedTo: vine.number().positive().optional(),
      createdBy: vine.number().positive().optional(),
      roomId: vine.number().positive().optional(),
      category: vine.string().in([
        'maintenance',
        'housekeeping',
        'engineering',
        'security',
        'guest_services',
        'other'
      ]).optional()
    }).optional()
  })
)

/**
 * Validator for work order report filters only
 */
export const workOrderReportFiltersValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive().optional(),
    startDate: vine.string().datetime().optional(),
    endDate: vine.string().datetime().optional(),
    status: vine.string().in([
      'pending',
      'in_progress',
      'completed', 
      'cancelled',
      'on_hold'
    ]).optional(),
    priority: vine.string().in([
      'low',
      'medium',
      'high',
      'urgent'
    ]).optional(),
    departmentId: vine.number().positive().optional(),
    assignedTo: vine.number().positive().optional(),
    createdBy: vine.number().positive().optional(),
    roomId: vine.number().positive().optional(),
    category: vine.string().in([
      'maintenance',
      'housekeeping',
      'engineering',
      'security',
      'guest_services',
      'other'
    ]).optional()
  })
)

/**
 * Validator for work order report type parameter
 */
export const workOrderReportTypeValidator = vine.compile(
  vine.object({
    reportType: vine.string().in([
      'workOrdersByStatus',
      'workOrdersByPriority',
      'workOrdersByDepartment', 
      'workOrdersByAssignee',
      'workOrdersOverdue',
      'workOrdersCompleted',
      'workOrdersSummary'
    ])
  })
)

/**
 * Validator for date range filters
 */
export const dateRangeValidator = vine.compile(
  vine.object({
    startDate: vine.string().datetime(),
    endDate: vine.string().datetime()
  }).transform((data) => {
    // Ensure end date is after start date
    const start = new Date(data.startDate)
    const end = new Date(data.endDate)
    
    if (end <= start) {
      throw new Error('End date must be after start date')
    }
    
    return data
  })
)

/**
 * Validator for work order status updates in reports
 */
export const workOrderStatusValidator = vine.compile(
  vine.object({
    status: vine.string().in([
      'pending',
      'in_progress',
      'completed',
      'cancelled', 
      'on_hold'
    ]),
    statusReason: vine.string().minLength(3).maxLength(500).optional(),
    completedAt: vine.string().datetime().optional(),
    completedBy: vine.number().positive().optional()
  })
)

/**
 * Validator for work order priority updates in reports
 */
export const workOrderPriorityValidator = vine.compile(
  vine.object({
    priority: vine.string().in([
      'low',
      'medium', 
      'high',
      'urgent'
    ]),
    priorityReason: vine.string().minLength(3).maxLength(500).optional(),
    updatedBy: vine.number().positive().optional()
  })
)

/**
 * Validator for work order assignment updates in reports
 */
export const workOrderAssignmentValidator = vine.compile(
  vine.object({
    assignedTo: vine.number().positive(),
    departmentId: vine.number().positive().optional(),
    assignedBy: vine.number().positive().optional(),
    assignmentNotes: vine.string().maxLength(1000).optional()
  })
)

/**
 * Validator for bulk work order operations in reports
 */
export const bulkWorkOrderValidator = vine.compile(
  vine.object({
    workOrderIds: vine.array(vine.number().positive()).minLength(1).maxLength(100),
    operation: vine.string().in([
      'updateStatus',
      'updatePriority',
      'reassign',
      'addNote',
      'delete'
    ]),
    operationData: vine.object({}).optional()
  })
)

/**
 * Validator for work order report export options
 */
export const workOrderReportExportValidator = vine.compile(
  vine.object({
    format: vine.string().in(['json', 'pdf', 'csv', 'excel']),
    includeDetails: vine.boolean().optional(),
    includeImages: vine.boolean().optional(),
    includeComments: vine.boolean().optional(),
    fileName: vine.string().regex(/^[a-zA-Z0-9_-]+$/).optional()
  })
)

/**
 * Validator for work order report scheduling
 */
export const workOrderReportScheduleValidator = vine.compile(
  vine.object({
    reportType: vine.string().in([
      'workOrdersByStatus',
      'workOrdersByPriority',
      'workOrdersByDepartment',
      'workOrdersByAssignee', 
      'workOrdersOverdue',
      'workOrdersCompleted',
      'workOrdersSummary'
    ]),
    frequency: vine.string().in(['daily', 'weekly', 'monthly', 'quarterly']),
    recipients: vine.array(vine.string().email()).minLength(1),
    filters: vine.object({
      hotelId: vine.number().positive().optional(),
      departmentId: vine.number().positive().optional(),
      priority: vine.string().in(['low', 'medium', 'high', 'urgent']).optional()
    }).optional(),
    isActive: vine.boolean().optional()
  })
)