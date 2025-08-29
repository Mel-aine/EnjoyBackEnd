import vine from '@vinejs/vine'

/**
 * Validator pour ajouter un email à la file d'attente
 */
export const queueEmailValidator = vine.compile(
  vine.object({
    templateName: vine.string().trim().minLength(1).maxLength(255),
    recipientEmail: vine.string().email().normalizeEmail(),
    dataContext: vine.object({})
  })
)