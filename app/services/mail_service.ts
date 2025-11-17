import mail from '@adonisjs/mail/services/main'

type SendOptions = {
  to: string | { address: string; name?: string }
  subject: string
  text?: string
  html?: string
}

export default class MailService {
  static async send(options: SendOptions) {
    const { to, subject, text, html } = options
    await mail.send((message) => {
      if (typeof to === 'string') {
        message.to(to)
      } else {
        message.to(to.address, to.name)
      }
      message.subject(subject)
      if (text) message.text(text)
      if (html) message.html(html)
    })
  }
}