import vine from '@vinejs/vine'

/**
 * Validator to validate the payload when creating
 * a new email account.
 */
export const createEmailAccountValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive(),
    title: vine.string().trim().minLength(1).maxLength(255),
    emailAddress: vine.string().email().maxLength(255),
    displayName: vine.string().trim().minLength(1).maxLength(255),
    signature: vine.string().optional(),
    isActive: vine.boolean().optional()
  })
)

/**
 * Validator to validate the payload when updating
 * an existing email account.
 */
export const updateEmailAccountValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).maxLength(255).optional(),
    emailAddress: vine.string().email().maxLength(255).optional(),
    displayName: vine.string().trim().minLength(1).maxLength(255).optional(),
    signature: vine.string().optional(),
    isActive: vine.boolean().optional()
  })
)

/**
 * Validator for query parameters
 */
export const emailAccountQueryValidator = vine.compile(
  vine.object({
    page: vine.number().positive().optional(),
    limit: vine.number().positive().max(100).optional(),
    hotelId: vine.number().positive()
  })
)