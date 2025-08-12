import vine from '@vinejs/vine'

/**
 * Validator to validate the payload when creating
 * a new season.
 */
export const createSeasonValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive(),
    shortCode: vine.string().trim().minLength(1).maxLength(50),
    seasonName: vine.string().trim().minLength(1).maxLength(255),
    fromDay: vine.number().min(1).max(31),
    fromMonth: vine.number().min(1).max(12),
    toDay: vine.number().min(1).max(31),
    toMonth: vine.number().min(1).max(12),
    startDate: vine.date(),
    status: vine.enum(['active', 'inactive', 'draft']).optional()
  })
)

/**
 * Validator to validate the payload when updating
 * an existing season.
 */
export const updateSeasonValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive().optional(),
    shortCode: vine.string().trim().minLength(1).maxLength(50).optional(),
    seasonName: vine.string().trim().minLength(1).maxLength(255).optional(),
    fromDay: vine.number().min(1).max(31).optional(),
    fromMonth: vine.number().min(1).max(12).optional(),
    toDay: vine.number().min(1).max(31).optional(),
    toMonth: vine.number().min(1).max(12).optional(),
    startDate: vine.date().optional(),
    status: vine.enum(['active', 'inactive', 'draft']).optional()
  })
)