import vine from '@vinejs/vine'

/**
 * Validator to validate the payload when creating
 * a new lost and found item
 */
export const createLostFoundValidator = vine.compile(
  vine.object({
    lostOn: vine.date().optional(),
    foundOn: vine.date().optional(),
    foundLocation: vine.string().trim().maxLength(255).optional(),
    lostLocation: vine.string().trim().maxLength(255).optional(),
    currentLocation: vine.string().trim().maxLength(255).optional(),
    itemName: vine.string().trim().minLength(1).maxLength(255),
    itemColor: vine.string().trim().maxLength(100).optional(),
    itemValue: vine.number().min(0).optional(),
    roomId: vine.number().positive().optional(),
    complainantName: vine.string().trim().minLength(1).maxLength(255),
    phone: vine.string().trim().maxLength(20).optional(),
    address: vine.string().trim().maxLength(500).optional(),
    city: vine.string().trim().maxLength(100).optional(),
    state: vine.string().trim().maxLength(100).optional(),
    country: vine.string().trim().maxLength(100).optional(),
    zipCode: vine.string().trim().maxLength(20).optional(),
    status: vine
      .enum(['lost', 'found', 'returned', 'disposed'])
      .optional(),
    additionalNotes: vine.string().trim().maxLength(1000).optional(),
    whoFound: vine.string().trim().maxLength(255).optional(),
  })
)

/**
 * Validator to validate the payload when updating
 * an existing lost and found item
 */
export const updateLostFoundValidator = vine.compile(
  vine.object({
    lostOn: vine.date().optional(),
    foundOn: vine.date().optional(),
    foundLocation: vine.string().trim().maxLength(255).optional(),
    lostLocation: vine.string().trim().maxLength(255).optional(),
    currentLocation: vine.string().trim().maxLength(255).optional(),
    itemName: vine.string().trim().minLength(1).maxLength(255).optional(),
    itemColor: vine.string().trim().maxLength(100).optional(),
    itemValue: vine.number().min(0).optional(),
    roomId: vine.number().positive().optional(),
    complainantName: vine.string().trim().minLength(1).maxLength(255).optional(),
    phone: vine.string().trim().maxLength(20).optional(),
    address: vine.string().trim().maxLength(500).optional(),
    city: vine.string().trim().maxLength(100).optional(),
    state: vine.string().trim().maxLength(100).optional(),
    country: vine.string().trim().maxLength(100).optional(),
    zipCode: vine.string().trim().maxLength(20).optional(),
    status: vine
      .enum(['lost', 'found', 'returned', 'disposed'])
      .optional(),
    additionalNotes: vine.string().trim().maxLength(1000).optional(),
    whoFound: vine.string().trim().maxLength(255).optional(),
  })
)

/**
 * Validator for marking item as found
 */
export const markAsFoundValidator = vine.compile(
  vine.object({
    foundOn: vine.date().optional(),
    foundLocation: vine.string().trim().maxLength(255).optional(),
    whoFound: vine.string().trim().maxLength(255).optional(),
    currentLocation: vine.string().trim().maxLength(255).optional(),
  })
)

/**
 * Validator for search parameters
 */
export const searchLostFoundValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
    status: vine
      .enum(['lost', 'found', 'returned', 'disposed'])
      .optional(),
    search: vine.string().trim().maxLength(255).optional(),
    sortBy: vine
      .enum([
        'created_at',
        'updated_at',
        'lost_on',
        'found_on',
        'item_name',
        'complainant_name',
        'status',
        'item_value',
      ])
      .optional(),
    sortOrder: vine.enum(['asc', 'desc']).optional(),
  })
)

/**
 * Validator for room-based search
 */
export const roomSearchValidator = vine.compile(
  vine.object({
    roomId: vine.number().positive(),
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
  })
)

/**
 * Validator for complainant search
 */
export const complainantSearchValidator = vine.compile(
  vine.object({
    searchTerm: vine.string().trim().minLength(1).maxLength(255),
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
  })
)