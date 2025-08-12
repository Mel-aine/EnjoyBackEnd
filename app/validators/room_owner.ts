import vine from '@vinejs/vine'

/**
 * Validator to validate the payload when creating
 * a new room owner.
 */
export const createRoomOwnerValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255),
    businessName: vine.string().trim().maxLength(255).optional(),
    address: vine.string().trim().maxLength(1000).optional(),
    country: vine.string().trim().maxLength(100).optional(),
    state: vine.string().trim().maxLength(100).optional(),
    city: vine.string().trim().maxLength(100).optional(),
    zip: vine.string().trim().maxLength(20).optional(),
    phone: vine.string().trim().maxLength(20).optional(),
    fax: vine.string().trim().maxLength(20).optional(),
    mobile: vine.string().trim().maxLength(20).optional(),
    email: vine.string().trim().email().maxLength(255).optional(),
    commissionPlan: vine.enum(['percentage_all_nights', 'fixed_per_night', 'fixed_per_stay']).optional(),
    commissionValue: vine.number().min(0).optional(),
    rateType: vine.enum(['regular', 'special', 'allocated']).optional(),
    roomInventoryType: vine.enum(['regular', 'allocated']).optional(),
    openingBalance: vine.number().optional(),
    createUser: vine.boolean().optional(),
    roomIds: vine.array(vine.number()).optional(),
  })
)

/**
 * Validator to validate the payload when updating
 * an existing room owner.
 */
export const updateRoomOwnerValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    businessName: vine.string().trim().maxLength(255).optional(),
    address: vine.string().trim().maxLength(1000).optional(),
    country: vine.string().trim().maxLength(100).optional(),
    state: vine.string().trim().maxLength(100).optional(),
    city: vine.string().trim().maxLength(100).optional(),
    zip: vine.string().trim().maxLength(20).optional(),
    phone: vine.string().trim().maxLength(20).optional(),
    fax: vine.string().trim().maxLength(20).optional(),
    mobile: vine.string().trim().maxLength(20).optional(),
    email: vine.string().trim().email().maxLength(255).optional(),
    commissionPlan: vine.enum(['percentage_all_nights', 'fixed_per_night', 'fixed_per_stay']).optional(),
    commissionValue: vine.number().min(0).optional(),
    rateType: vine.enum(['regular', 'special', 'allocated']).optional(),
    roomInventoryType: vine.enum(['regular', 'allocated']).optional(),
    openingBalance: vine.number().optional(),
    createUser: vine.boolean().optional(),
    roomIds: vine.array(vine.number()).optional(),
  })
)

/**
 * Validator to validate room assignment payload
 */
export const assignRoomsValidator = vine.compile(
  vine.object({
    roomIds: vine.array(vine.number()).minLength(1),
  })
)