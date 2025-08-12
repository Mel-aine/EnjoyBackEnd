import vine from '@vinejs/vine'

/**
 * Validator to validate the payload when creating
 * a new transportation mode.
 */
export const createTransportationModeValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive(),
    name: vine.string().trim().minLength(1).maxLength(255),
    description: vine.string().trim().optional()
  })
)

/**
 * Validator to validate the payload when updating
 * an existing transportation mode.
 */
export const updateTransportationModeValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive().optional(),
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    description: vine.string().trim().optional()
  })
)