import vine from '@vinejs/vine'

/**
 * Validator for creating daily receipt reports (both summary and detail)
 */
export const createDailyReceiptReportValidator = vine.compile(
  vine.object({
    fromDate: vine.string().trim(),
    toDate: vine.string().trim(),
    hotelId: vine.number(),
    receiptByUserId: vine.number().optional(),
    currencyId: vine.number().optional(),
    paymentMethodId: vine.number().optional()
  })
)