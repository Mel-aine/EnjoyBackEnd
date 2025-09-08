import vine from '@vinejs/vine'

/**
 * Validator to validate the payload when creating
 * a new department.
 */
export const createDepartmentValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(2).maxLength(100),
    description: vine.string().trim().maxLength(500).optional(),
    hotel_id: vine.number().positive(),
    responsible_user_id: vine.number().positive().exists(async (db, value) => {
      const user = await db.from('users').where('id', value).first()
      return !!user
    }).optional(),
    number_employees: vine.number().min(0).max(1000).optional(),
    status: vine.enum(['active', 'inactive']).optional()
  })
)

/**
 * Validator to validate the payload when updating
 * an existing department.
 */
export const updateDepartmentValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(2).maxLength(100).optional(),
    description: vine.string().trim().maxLength(500).optional(),
    responsible_user_id: vine.number().positive().exists(async (db, value) => {
      const user = await db.from('users').where('id', value).first()
      return !!user
    }).optional(),
    number_employees: vine.number().min(0).max(1000).optional(),
    status: vine.enum(['active', 'inactive']).optional()
  })
)

/**
 * Validator for assigning staff to department
 */
export const assignStaffValidator = vine.compile(
  vine.object({
    userIds: vine.array(vine.number().positive())
  })
)
