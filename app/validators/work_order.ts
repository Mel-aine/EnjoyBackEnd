import vine from '@vinejs/vine'
import { DateTime } from 'luxon'

/**
 * Validator to validate the payload when creating
 * a new work order.
 */
export const createWorkOrderValidator = vine.compile(
  vine.object({
    blockFromDate: vine.date().transform((value) => value ? DateTime.fromJSDate(value) : value).optional(),
    blockToDate: vine.date().transform((value) => value ? DateTime.fromJSDate(value) : value).optional(),
    roomId: vine.number().positive(),
    dueDateTime: vine.date().transform((value) => DateTime.fromJSDate(value)),
    description: vine.string().trim().minLength(1).maxLength(1000),
    category: vine.enum(['clean', 'repair', 'maintenance', 'others']),
    priority: vine.enum(['low', 'medium', 'high']).optional(),
    status: vine.enum(['assigned', 'completed', 'in_progress']).optional(),
    assignedToUserId: vine.number().positive(),
    roomStatus: vine.enum(['dirty', 'clean']).optional(),
    reason: vine.string().trim().maxLength(255).optional(),
    hotelId: vine.number().positive(),
    notes: vine.string().trim().maxLength(5000).optional(),
  })
)

/**
 * Validator to validate the payload when updating
 * an existing work order.
 */
export const updateWorkOrderValidator = vine.compile(
  vine.object({
    blockFromDate: vine.date().transform((value) => value ? DateTime.fromJSDate(value) : value).optional(),
    blockToDate: vine.date().transform((value) => value ? DateTime.fromJSDate(value) : value).optional(),
    roomId: vine.number().positive().optional(),
    dueDateTime: vine.date().transform((value) => DateTime.fromJSDate(value)).optional(),
    description: vine.string().trim().minLength(1).maxLength(1000).optional(),
    category: vine.enum(['clean', 'repair', 'maintenance', 'others']).optional(),
    priority: vine.enum(['low', 'medium', 'high']).optional(),
    status: vine.enum(['assigned', 'completed', 'in_progress']).optional(),
    assignedToUserId: vine.number().positive().optional(),
    roomStatus: vine.enum(['dirty', 'clean']).optional(),
    reason: vine.string().trim().maxLength(255).optional(),
    hotelId: vine.number().positive().optional(),
    notes: vine.string().trim().maxLength(5000).optional(),
  })
)

/**
 * Validator to validate the payload when updating
 * work order status with logging.
 */
export const updateWorkOrderStatusValidator = vine.compile(
  vine.object({
    status: vine.enum(['assigned', 'completed', 'in_progress']),
    notes: vine.string().trim().maxLength(1000).optional(),
  })
)

/**
 * Validator to validate the payload when assigning
 * a work order to a user.
 */
export const assignWorkOrderValidator = vine.compile(
  vine.object({
    assignedToUserId: vine.number().positive(),
    notes: vine.string().trim().maxLength(1000).optional(),
  })
)

/**
 * Validator for work order filtering and search
 */
export const workOrderFilterValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive().optional(),
    roomId: vine.number().positive().optional(),
    category: vine.enum(['clean', 'repair', 'maintenance', 'others']).optional(),
    priority: vine.enum(['low', 'medium', 'high']).optional(),
    status: vine.enum(['assigned', 'completed', 'in_progress']).optional(),
    assignedToUserId: vine.number().positive().optional(),
    fromDate: vine.date().transform((value) => value ? DateTime.fromJSDate(value) : value).optional(),
    toDate: vine.date().transform((value) => value ? DateTime.fromJSDate(value) : value).optional(),
    page: vine.number().positive().optional(),
    limit: vine.number().positive().max(100).optional(),
    sortBy: vine.enum(['id', 'orderNumber', 'dueDateTime', 'priority', 'status', 'createdAt']).optional(),
    sortOrder: vine.enum(['asc', 'desc']).optional(),
  })
)