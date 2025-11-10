import vine from '@vinejs/vine'

export const createBookingSourceValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive(),
    sourceName: vine.string().trim().minLength(1).maxLength(255),
    sourceCode: vine.string().trim().minLength(1).maxLength(50),
    sourceType: vine.string().trim().minLength(1).maxLength(50).optional(),
    description: vine.string().trim().optional(),
    commissionRate: vine.number().min(0).max(100).optional(),
    contactPerson: vine.string().trim().optional(),
    contactEmail: vine.string().email().optional(),
    contactPhone: vine.string().trim().optional(),
    address: vine.string().trim().optional(),
    city: vine.string().trim().optional(),
    country: vine.string().trim().optional(),
    website: vine.string().url().optional(),
    apiEndpoint: vine.string().url().optional(),
    apiCredentials: vine.object({}).optional(),
    contractDetails: vine.object({}).optional(),
    contractStartDate: vine.date().optional(),
    contractEndDate: vine.date().optional(),
    paymentTerms: vine.string().trim().optional(),
    cancellationPolicy: vine.string().trim().optional(),
    priority: vine.number().positive().optional(),
    notes: vine.string().trim().optional(),
    color:vine.string().trim().optional()
  })
)

export const updateBookingSourceValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive().optional(),
    sourceName: vine.string().trim().minLength(1).maxLength(255).optional(),
    sourceCode: vine.string().trim().minLength(1).maxLength(50).optional(),
    sourceType: vine.string().trim().minLength(1).maxLength(50).optional(),
    description: vine.string().trim().optional(),
    commissionRate: vine.number().min(0).max(100).optional(),
    contactPerson: vine.string().trim().optional(),
    contactEmail: vine.string().email().optional(),
    contactPhone: vine.string().trim().optional(),
    address: vine.string().trim().optional(),
    city: vine.string().trim().optional(),
    country: vine.string().trim().optional(),
    website: vine.string().url().optional(),
    apiEndpoint: vine.string().url().optional(),
    apiCredentials: vine.object({}).optional(),
    contractDetails: vine.object({}).optional(),
    contractStartDate: vine.date().optional(),
    contractEndDate: vine.date().optional(),
    paymentTerms: vine.string().trim().optional(),
    cancellationPolicy: vine.string().trim().optional(),
    isActive: vine.boolean().optional(),
    priority: vine.number().positive().optional(),
    notes: vine.string().trim().optional(),
  })
)
