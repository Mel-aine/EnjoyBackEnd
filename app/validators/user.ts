
import vine from '@vinejs/vine'

export const createUserValidator = vine.compile(
  vine.object({
    lastName: vine.string().trim().minLength(2),
    firstName: vine.string().trim().minLength(2),
    username: vine.string().trim().optional(),
    email: vine.string().email().trim().unique(async (db, value) => {
      const user = await db.from('users').where('email', value).first()
      return !user
    }),
    roleId: vine.number().optional(),
    isActive: vine.boolean().optional(),
  })
)

export const updateUserValidator = vine.compile(
  vine.object({
    lastName: vine.string().trim().minLength(2),
    firstName: vine.string().trim().minLength(2),
    username: vine.string().trim().optional(),
    email: vine.string().email().trim(),
    roleId: vine.number().optional(),
    isActive: vine.boolean().optional(),
  })
)
