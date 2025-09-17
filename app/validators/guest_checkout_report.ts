import vine from '@vinejs/vine'

/**
 * Validator for creating guest checkout report
 */
export const createGuestCheckoutReportValidator = vine.compile(
  vine.object({
    fromDate: vine.string().trim(),
    toDate: vine.string().trim(),
    hotelId: vine.number()
  })
)