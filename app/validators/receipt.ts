import vine from '@vinejs/vine'

/**
 * Validator to validate the payload when creating
 * a new receipt.
 */
export const createReceiptValidator = vine.compile(
  vine.object({
    tenantId: vine.number().positive(),
    hotelId: vine.number().positive(),
    paymentDate: vine.date(),
    paymentMethodId: vine.number().positive(),
    totalAmount: vine.number().min(0),
    description: vine.string().trim().maxLength(500),
    breakdown: vine.object({
      rent: vine.number().optional(),
      tax: vine.number().optional(),
      discount: vine.number().optional(),
      serviceCharge: vine.number().optional(),
      other: vine.number().optional()
    }).optional(),
    createdBy: vine.number().positive(),
    folioTransactionId: vine.number().positive(),
    currency: vine.string().fixedLength(3)
  })
)

/**
 * Validator to validate the payload when updating
 * an existing receipt.
 */
export const updateReceiptValidator = vine.compile(
  vine.object({
    tenantId: vine.number().positive().optional(),
    hotelId: vine.number().positive().optional(),
    paymentDate: vine.date().optional(),
    paymentMethodId: vine.number().positive().optional(),
    totalAmount: vine.number().min(0).optional(),
    description: vine.string().trim().maxLength(500).optional(),
    breakdown: vine.object({
      rent: vine.number().optional(),
      tax: vine.number().optional(),
      discount: vine.number().optional(),
      serviceCharge: vine.number().optional(),
      other: vine.number().optional()
    }).optional(),
    currency: vine.string().fixedLength(3).optional()
  })
)

/**
 * Validator to validate the payload when voiding
 * a receipt.
 */
export const voidReceiptValidator = vine.compile(
  vine.object({
    voidedBy: vine.number().positive(),
    reason: vine.string().trim().maxLength(500).optional()
  })
)

/**
 * Validator for receipt query parameters
 */
export const receiptQueryValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
    hotelId: vine.number().positive().optional(),
    tenantId: vine.number().positive().optional(),
    paymentMethodId: vine.number().positive().optional(),
    createdBy: vine.number().positive().optional(),
    isVoided: vine.boolean().optional(),
    fromDate: vine.date().optional(),
    toDate: vine.date().optional(),
    currency: vine.string().fixedLength(3).optional(),
    search: vine.string().trim().maxLength(255).optional()
  })
)