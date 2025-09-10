import vine from '@vinejs/vine'

export const createEmailTemplateValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255),
    templateCategoryId: vine.number().positive(),
    autoSend: vine.enum([
      'Manual',
      'Check-in',
      'Check-out', 
      'Reservation Created',
      'Reservation Modified',
      'Reservation Cancelled',
      'Invoice Generated',
      'Payment Received'
    ]).optional(),
    attachment: vine.string().maxLength(500).optional(),
    emailAccountId: vine.number().positive(),
    scheduleDate: vine.date().optional(),
    subject: vine.string().trim().minLength(1).maxLength(255),
    messageBody: vine.string().trim().minLength(1),
    hotelId: vine.number().positive(),
  })
)

export const updateEmailTemplateValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    templateCategoryId: vine.number().positive().optional(),
    autoSend: vine.enum([
      'Manual',
      'Check-in',
      'Check-out',
      'Reservation Created', 
      'Reservation Modified',
      'Reservation Cancelled',
      'Invoice Generated',
      'Payment Received'
    ]).optional(),
    attachment: vine.string().maxLength(500).optional(),
    emailAccountId: vine.number().positive().optional(),
    scheduleDate: vine.date().optional(),
    subject: vine.string().trim().minLength(1).maxLength(255).optional(),
    messageBody: vine.string().trim().minLength(1).optional(),
    hotelId: vine.number().positive().optional(),
  })
)

export const getEmailTemplatesByHotelValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive(),
  })
)

export const emailTemplateParamsValidator = vine.compile(
  vine.object({
    id: vine.number().positive(),
  })
)