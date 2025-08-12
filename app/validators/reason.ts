import vine from '@vinejs/vine'

/**
 * Validator to validate the payload when creating
 * a new reason.
 */
export const createReasonValidator = vine.compile(
  vine.object({
    category: vine.string().minLength(1).maxLength(100),
    reasonName: vine.string().minLength(1).maxLength(255),
    status: vine.enum(['active', 'inactive']).optional(),
    hotelId: vine.number().positive(),
  })
)

/**
 * Validator to validate the payload when updating
 * an existing reason.
 */
export const updateReasonValidator = vine.compile(
  vine.object({
    category: vine.string().minLength(1).maxLength(100).optional(),
    reasonName: vine.string().minLength(1).maxLength(255).optional(),
    status: vine.enum(['active', 'inactive']).optional(),
    hotelId: vine.number().positive().optional(),
  })
)