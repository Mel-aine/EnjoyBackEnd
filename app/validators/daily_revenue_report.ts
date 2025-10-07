import vine from '@vinejs/vine'

/**
 * Validator for daily revenue report generation
 * Handles date ranges, hotel selection, and various filtering options
 */
export const createDailyRevenueReportValidator = vine.compile(
  vine.object({
    // Required fields
    fromDate: vine.string().trim(),
    toDate: vine.string().trim(),
    hotelId: vine.number().positive(),

    // Date type (Booking, Stay, Departure) - maintenant requis
    dateType: vine.enum(['booking', 'stay', 'departure']),

    // Optional filters
    roomId: vine.number().positive().optional(),
    businessSourceId: vine.number().positive().optional(),
    paymentMethodId: vine.number().positive().optional(),
    
    // Tax IDs (multiple selection)
    taxIds: vine.array(vine.number().positive()).optional(),
    
    // Extra Charge IDs (multiple selection)
    extraChargeIds: vine.array(vine.number().positive()).optional(),

    // Boolean flags
    showUnassignRooms: vine.boolean().optional(),
    showUnpostedInclusion: vine.boolean().optional(),
    discardUnconfirmedBookings: vine.boolean().optional(),

    // Colonnes conditionnelles
    showMobileNoField: vine.boolean().optional(),
    showEmailField: vine.boolean().optional(),

    // Template optionnel
    reportTemplate: vine.string().optional()
  })
)