import vine from '@vinejs/vine'

/**
 * Validator to validate the payload when creating
 * a new incidental invoice.
 */
export const createIncidentalInvoiceValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive(),
    guestId: vine.number().positive(),
    date: vine.string().trim().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
    charges: vine.array(
      vine.object({
        transactionType: vine.string().trim().maxLength(50),
        category: vine.string().trim().maxLength(100),
        description: vine.string().trim().maxLength(500),
        amount: vine.number().positive(),
        quantity: vine.number().positive().withoutDecimals(),
        unitPrice: vine.number().positive(),
        taxAmount: vine.number().min(0).optional(),
        departmentId: vine.string().trim().maxLength(50).optional(),
        reference: vine.string().trim().maxLength(100).optional(),
        extraChargeId: vine.number().positive().optional(),
        notes: vine.string().trim().maxLength(1000).optional(),
        discountId: vine.number().positive().optional()
      })
    ).minLength(1),
    paymentType: vine.enum(['cash', 'credit_card', 'debit_card', 'bank_transfer', 'check', 'other']),
    paymentMethodId: vine.number().positive(),
    description: vine.string().trim().minLength(1).maxLength(500).optional(),
    referenceNumber: vine.string().trim().maxLength(100).optional(),
    notes: vine.string().trim().maxLength(1000).optional(),
    billingName: vine.string().trim().maxLength(200).optional(),
    billingAddress: vine.string().trim().maxLength(500).optional(),
    billingCity: vine.string().trim().maxLength(100).optional(),
    billingState: vine.string().trim().maxLength(100).optional(),
    billingZip: vine.string().trim().maxLength(20).optional(),
    billingCountry: vine.string().trim().maxLength(100).optional(),
    taxRate: vine.number().min(0).max(100).optional(),
    discountRate: vine.number().min(0).max(100).optional(),
    serviceChargeRate: vine.number().min(0).max(100).optional(),
    currencyCode: vine.string().trim().fixedLength(3).optional(),
    exchangeRate: vine.number().positive().optional(),
    specialInstructions: vine.string().trim().maxLength(1000).optional(),
    emailInvoice: vine.boolean().optional(),
    emailAddress: vine.string().email().optional()
  })
)

/**
 * Validator to validate the payload when updating
 * an existing incidental invoice.
 */
export const updateIncidentalInvoiceValidator = vine.compile(
  vine.object({
    description: vine.string().trim().minLength(1).maxLength(500).optional(),
    notes: vine.string().trim().maxLength(1000).optional(),
    billingName: vine.string().trim().maxLength(200).optional(),
    billingAddress: vine.string().trim().maxLength(500).optional(),
    billingCity: vine.string().trim().maxLength(100).optional(),
    billingState: vine.string().trim().maxLength(100).optional(),
    billingZip: vine.string().trim().maxLength(20).optional(),
    billingCountry: vine.string().trim().maxLength(100).optional(),
    specialInstructions: vine.string().trim().maxLength(1000).optional(),
    emailAddress: vine.string().email().optional()
  })
)