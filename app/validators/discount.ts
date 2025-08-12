import vine from '@vinejs/vine'

/**
 * Validator to validate the payload when creating
 * a new discount.
 */
export const createDiscountValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive(),
    shortCode: vine.string().trim().minLength(1).maxLength(50),
    name: vine.string().trim().minLength(1).maxLength(255),
    type: vine.enum(['percentage', 'flat']),
    openDiscount: vine.boolean().optional(),
    value: vine.number().positive(),
    applyOn: vine.enum(['room_charge', 'extra_charge']),
    status: vine.enum(['active', 'inactive']).optional()
  })
)

/**
 * Validator to validate the payload when updating
 * an existing discount.
 */
export const updateDiscountValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive().optional(),
    shortCode: vine.string().trim().minLength(1).maxLength(50).optional(),
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    type: vine.enum(['percentage', 'flat']).optional(),
    openDiscount: vine.boolean().optional(),
    value: vine.number().positive().optional(),
    applyOn: vine.enum(['room_charge', 'extra_charge']).optional(),
    status: vine.enum(['active', 'inactive']).optional()
  })
)