import vine from '@vinejs/vine'

/**
 * Validator to validate the payload when creating
 * a new rate type.
 */
export const createRateTypeValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive(),
    shortCode: vine.string().trim().minLength(1).maxLength(50),
    rateTypeName: vine.string().trim().minLength(1).maxLength(255),
    nights: vine.number().positive().min(1),
    maxAdult: vine.number().positive().min(1),
    minNight: vine.number().positive().min(1),
    roomTypeId: vine.number().positive().optional(),
    status: vine.enum(['active', 'inactive', 'draft']).optional()
  })
)

/**
 * Validator to validate the payload when updating
 * an existing rate type.
 */
export const updateRateTypeValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive().optional(),
    shortCode: vine.string().trim().minLength(1).maxLength(50).optional(),
    rateTypeName: vine.string().trim().minLength(1).maxLength(255).optional(),
    nights: vine.number().positive().min(1).optional(),
    maxAdult: vine.number().positive().min(1).optional(),
    minNight: vine.number().positive().min(1).optional(),
    roomTypeId: vine.number().positive().optional(),
    status: vine.enum(['active', 'inactive', 'draft']).optional()
  })
)