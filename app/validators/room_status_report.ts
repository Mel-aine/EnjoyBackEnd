import vine from '@vinejs/vine'

/**
 * Validator for creating pickup/dropoff guest report
 */
export const createRoomStatusReportValidator = vine.compile(
  vine.object({
    date: vine.string().trim(),
    hotelId: vine.number().optional(),
  })
)
