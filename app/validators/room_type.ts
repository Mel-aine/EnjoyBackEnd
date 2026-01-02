import vine from '@vinejs/vine'

/**
 * Validator to validate the payload when creating
 * a new room type.
 */
export const createRoomTypeValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive(),
    shortCode: vine.string().trim().minLength(1).maxLength(10),
    roomTypeName: vine.string().trim().minLength(1).maxLength(100),
    baseAdult: vine.number().min(1).max(10),
    baseChild: vine.number().min(0).max(10),
    maxAdult: vine.number().min(1).max(20),
    maxChild: vine.number().min(0).max(20),
    publishToWebsite: vine.boolean().optional(),
    roomAmenities: vine.array(vine.number().positive()).optional(),
    color: vine.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    defaultWebInventory: vine.number().min(0).optional(),
    sortOrder: vine.number().min(0).optional(),
    isPaymaster: vine.boolean().optional(),
  })
)

/**
 * Validator to validate the payload when updating
 * an existing room type.
 */
export const updateRoomTypeValidator = vine.compile(
  vine.object({
    shortCode: vine.string().trim().minLength(1).maxLength(10).optional(),
    roomTypeName: vine.string().trim().minLength(1).maxLength(100).optional(),
    baseAdult: vine.number().min(1).max(10).optional(),
    baseChild: vine.number().min(0).max(10).optional(),
    maxAdult: vine.number().min(1).max(100000).optional(),
    maxChild: vine.number().min(0).max(100000).optional(),
    publishToWebsite: vine.boolean().optional(),
    roomAmenities: vine.array(vine.number().positive()).optional(),
    color: vine.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    defaultWebInventory: vine.number().min(0).optional(),
    sortOrder: vine.number().min(0).optional(),
    isPaymaster: vine.boolean().optional(),
  })
)

/**
 * Validator to validate the payload when updating
 * sort order for multiple room types.
 */
export const updateSortOrderValidator = vine.compile(
  vine.array(
    vine.object({
      id: vine.number().positive(),
      sortOrder: vine.number().min(0)
    })
  ).minLength(1)
)