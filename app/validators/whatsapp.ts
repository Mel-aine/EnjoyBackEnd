import vine from '@vinejs/vine'

export const testWhatsAppValidator = vine.compile(
  vine.object({
    recipientPhoneNumber: vine.string().trim().minLength(6).maxLength(30).optional(),
    message: vine.string().trim().minLength(1).maxLength(1000).optional(),
    config: vine
      .object({
        provider: vine.string().trim().maxLength(80).optional(),
        accessToken: vine.string().trim().maxLength(4000).optional(),
        token: vine.string().trim().maxLength(4000).optional(),
        bearerToken: vine.string().trim().maxLength(4000).optional(),
        phoneNumberId: vine.string().trim().maxLength(255).optional(),
        businessAccountId: vine.string().trim().maxLength(255).optional(),
        apiBaseUrl: vine.string().trim().maxLength(1000).optional(),
        apiVersion: vine.string().trim().maxLength(50).optional(),
        endpointUrl: vine.string().trim().maxLength(2000).optional(),
        recipientPhoneNumber: vine.string().trim().minLength(6).maxLength(30).optional(),
        senderName: vine.string().trim().maxLength(255).optional(),
      })
      .optional(),
  })
)
