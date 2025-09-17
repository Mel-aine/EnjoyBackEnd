import vine from '@vinejs/vine'

/**
 * Validator for creating pickup/dropoff guest report
 */
export const createPickupDropoffReportValidator = vine.compile(
  vine.object({
    startDate: vine.string().trim(),
    endDate: vine.string().trim(),
    type: vine.enum(['Pickup', 'Dropoff', 'Both']),
    hotelId: vine.number().optional()
  })
)