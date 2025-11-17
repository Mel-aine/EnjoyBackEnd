import env from '#start/env'
import { defineConfig, transports } from '@adonisjs/mail'

const mailConfig = defineConfig({
  default: 'smtp',
  from: {
    address: env.get('MAIL_FROM_ADDRESS') || 'no-reply@example.com',
    name: env.get('MAIL_FROM_NAME') || 'Enjoy PMS',
  },
  mailers: {
    smtp: transports.smtp({
      host: env.get('SMTP_HOST') || 'in-v3.mailjet.com',
      port: Number(env.get('SMTP_PORT') || 587),
      auth: {
        type: 'login',
        user: env.get('SMTP_USERNAME')!,
        pass: env.get('SMTP_PASSWORD')!,
      },
      secure: false,
    }),
  },
})

export default mailConfig

declare module '@adonisjs/mail/types' {
  export interface MailersList extends InferMailers<typeof mailConfig> {}
}
