import vine from '@vinejs/vine'

/**
 * Validator for creating a new bed type
 */
export const createBedTypeValidator = vine.compile(
  vine.object({
    shortCode: vine.string().trim().minLength(1).maxLength(10),
    bedTypeName: vine.string().trim().minLength(1).maxLength(100),
    hotelId: vine.number().positive(),
    status: vine.enum(['Active', 'Inactive']).optional(),
  })
)

/**
 * Validator for updating an existing bed type
 */
export const updateBedTypeValidator = vine.compile(
  vine.object({
    shortCode: vine.string().trim().minLength(1).maxLength(10).optional(),
    bedTypeName: vine.string().trim().minLength(1).maxLength(100).optional(),
    hotelId: vine.number().positive().optional(),
    status: vine.enum(['Active', 'Inactive']).optional(),
  })
)