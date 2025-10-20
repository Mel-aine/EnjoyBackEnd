import vine from '@vinejs/vine'

/**
 * Validator for reservation report generation
 * Handles Arrival List, Departure List, Cancelled and Void Reservations
 */
export const createReservationReportValidator = vine.compile(
  vine.object({
    // Required fields
    startDate: vine.string().trim(),
    endDate: vine.string().trim(),
    hotelId: vine.number().positive(),

    // Optional filter fields
    roomTypeId: vine.number().positive().optional(),
    ratePlanId: vine.number().positive().optional(),
    company: vine.string().trim().optional(),
    travelAgent: vine.string().trim().optional(),
    businessSource: vine.string().trim().optional(),
    market: vine.string().trim().optional(),
    userId: vine.number().positive().optional(),
    
    // Rate range filters
    rateFrom: vine.number().min(0).optional(),
    rateTo: vine.number().min(0).optional(),
    
    // Reservation type and display options
    reservationType: vine.string().trim().optional(),
    showAmount: vine.enum(['rent_per_night', 'total_amount']).optional(),
    taxInclusive: vine.boolean().optional(),
    
    // Additional columns for customization (max 5)
    selectedColumns: vine.array(
      vine.enum([
        'pickUp',
        'dropOff',
        'resType',
        'company',
        'user',
        'deposit',
        'balanceDue',
        'marketCode',
        'businessSource',
        'mealPlan',
        'rateType'
      ])
    ).maxLength(5).optional()
  })
)

/**
 * Validator for export requests
 */
export const exportReservationReportValidator = vine.compile(
  vine.object({
    format: vine.enum(['csv', 'pdf', 'excel']),
    reportType: vine.enum(['arrival', 'departure', 'cancelled', 'void']),
    startDate: vine.string().trim(),
    endDate: vine.string().trim(),
    hotelId: vine.number().positive(),

    // All the same optional filters
    roomTypeId: vine.number().positive().optional(),
    ratePlanId: vine.number().positive().optional(),
    company: vine.string().trim().optional(),
    travelAgent: vine.string().trim().optional(),
    businessSource: vine.string().trim().optional(),
    market: vine.string().trim().optional(),
    userId: vine.number().positive().optional(),
    rateFrom: vine.number().min(0).optional(),
    rateTo: vine.number().min(0).optional(),
    reservationType: vine.string().trim().optional(),
    showAmount: vine.enum(['rent_per_night', 'total_amount']).optional(),
    taxInclusive: vine.boolean().optional(),
    selectedColumns: vine.array(vine.string()).maxLength(5).optional()
  })
)