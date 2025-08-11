import vine from '@vinejs/vine'

/**
 * Validator to validate the payload when creating
 * a new amenity.
 */
export const createAmenityValidator = vine.compile(
  vine.object({
    amenityName: vine.string().trim().minLength(1).maxLength(255),
    amenityType: vine.string().trim().minLength(1).maxLength(100),
    sortKey: vine.number().min(0).optional(),
    hotelId: vine.number().min(1)
  })
)

/**
 * Validator to validate the payload when updating
 * an existing amenity.
 */
export const updateAmenityValidator = vine.compile(
  vine.object({
    amenityName: vine.string().trim().minLength(1).maxLength(255).optional(),
    amenityType: vine.string().trim().minLength(1).maxLength(100).optional(),
    sortKey: vine.number().min(0).optional(),
    hotelId: vine.number().min(1).optional()
  })
)

/**
 * Validator for updating sort order
 */
export const updateSortOrderValidator = vine.compile(
  vine.object({
    amenities: vine.array(
      vine.object({
        id: vine.number().min(1),
        sort_key: vine.number().min(0)
      })
    ).minLength(1)
  })
)