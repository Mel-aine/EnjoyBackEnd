import env from '#start/env'
import { defineConfig, transports } from '@adonisjs/mail'

const mailConfig = defineConfig({
  default: 'smtp',

   /**
    * The mailers object can be used to configure multiple mailers
    * each using a different transport or same transport with different
    * options.
   */
  mailers: {
   smtp: transports.smtp({
    host: env.get('SMTP_HOST', 'smtp.gmail.com'),
    port: Number(env.get('SMTP_PORT', '587')),
    secure: env.get('SMTP_SECURE', 'false') === 'true',
    auth: {
      type: 'login',
      user: env.get('SMTP_USERNAME', ''),
      pass: env.get('SMTP_PASSWORD', ''),
    },
  })


  },
})

export default mailConfig

declare module '@adonisjs/mail/types' {
  export interface MailersList extends InferMailers<typeof mailConfig> {}
}
