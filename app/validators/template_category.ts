import vine from '@vinejs/vine'

export const createTemplateCategoryValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive(),
    category: vine.string().trim().minLength(1).maxLength(255),
  })
)

export const updateTemplateCategoryValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive().optional(),
    category: vine.string().trim().minLength(1).maxLength(255).optional(),
  })
)