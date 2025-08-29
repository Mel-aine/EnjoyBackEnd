import vine from '@vinejs/vine'

/**
 * Validator pour la création d'un template d'email
 */
export const createEmailTemplateValidator = vine.compile(
  vine.object({
    templateName: vine.string().trim().minLength(1).maxLength(255),
    subject: vine.string().trim().minLength(1).maxLength(500),
    bodyHtml: vine.string().trim().minLength(1)
  })
)

/**
 * Validator pour la mise à jour d'un template d'email
 */
export const updateEmailTemplateValidator = vine.compile(
  vine.object({
    templateName: vine.string().trim().minLength(1).maxLength(255).optional(),
    subject: vine.string().trim().minLength(1).maxLength(500).optional(),
    bodyHtml: vine.string().trim().minLength(1).optional()
  })
)