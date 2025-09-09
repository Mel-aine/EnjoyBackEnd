import vine from '@vinejs/vine'

/**
 * Validator pour créer un Role
 */
export const createRoleValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(2).maxLength(100),
    description: vine.string().trim().maxLength(500).optional(),
    hotelId: vine.number().positive().optional(),
    createdBy: vine.number().positive().optional(),

  })
)

/**
 * Validator pour mettre à jour un Role
 */
export const updateRoleValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(2).maxLength(100),
    description: vine.string().trim().maxLength(500).optional(),
    hotelId: vine.number().positive().optional(),
    lastModifiedBy: vine.number().positive().optional(),
  })
)

/**
 * Validator pour assigner des permissions à un rôle
 */
export const assignPermissionsValidator = vine.compile(
  vine.object({
    permissionIds: vine.array(vine.number().positive()).minLength(1),
    serviceId: vine.number().positive().optional()
  })
)

/**
 * Validator pour retirer des permissions d'un rôle
 */
export const removePermissionsValidator = vine.compile(
  vine.object({
    permissionIds: vine.array(vine.number().positive()).minLength(1),
    serviceId: vine.number().positive().optional()
  })
)

/**
 * Validator pour cloner un rôle
 */
export const cloneRoleValidator = vine.compile(
  vine.object({
    newRoleName: vine.string().trim().minLength(2).maxLength(100)
  })
)

/**
 * Validator pour les paramètres de recherche/pagination
 */
export const roleSearchValidator = vine.compile(
  vine.object({
    page: vine.number().positive().optional(),
    limit: vine.number().positive().max(100).optional(),
    search: vine.string().trim().maxLength(255).optional(),
    hotelId: vine.number().positive().optional(),
    categoryId: vine.number().positive().optional()
  })
)
