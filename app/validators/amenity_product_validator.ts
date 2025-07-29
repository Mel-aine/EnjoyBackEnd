import vine from '@vinejs/vine'

export const createAmenityProductValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(2),
    price: vine.number().positive(),
    description: vine.string().trim().optional(),
    status: vine.enum(['active', 'inactive', 'archived']).optional(),
    amenities_category_id: vine.number().positive(),
    service_id: vine.number().positive(),
  })
)

export const updateAmenityProductValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(2).optional(),
    price: vine.number().positive().optional(),
    description: vine.string().trim().optional(),
    status: vine.enum(['active', 'inactive', 'archived']).optional(),
    amenities_category_id: vine.number().positive().optional(),
    service_id: vine.number().positive().optional(),
  })
)
