import mail from '@adonisjs/mail/services/main'

type Recipient = string | { address: string; name?: string }

type Attachment = {
  filename: string
  content?: Buffer
  contentType?: string
  path?: string
}

type SendOptions = {
  to: Recipient
  subject: string
  text?: string
  html?: string
}

type SendWithAttachmentsOptions = {
  to: Recipient | Recipient[]
  subject: string
  text?: string
  html?: string
  cc?: Recipient[]
  bcc?: Recipient[]
  attachments?: Attachment[]
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

  static async sendWithAttachments(options: SendWithAttachmentsOptions) {
    const { to, subject, text, html, cc = [], bcc = [], attachments = [] } = options
    await mail.send((message) => {
      const addRecipient = (recip: Recipient, fn: (address: string, name?: string) => void) => {
        if (typeof recip === 'string') {
          fn(recip)
        } else {
          fn(recip.address, recip.name)
        }
      }

      const tos = Array.isArray(to) ? to : [to]
      tos.forEach((r) => addRecipient(r, message.to.bind(message)))
      cc.forEach((r) => addRecipient(r, message.cc.bind(message)))
      bcc.forEach((r) => addRecipient(r, message.bcc.bind(message)))

      message.subject(subject)
      if (text) message.text(text)
      if (html) message.html(html)

      attachments.forEach((att) => {
        // Ensure a sensible filename and content type for providers that rely on headers
        const filename = att.filename || 'attachment.pdf'
        const contentType = att.contentType || (filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : undefined)

        if (att.content) {
          message.attachData(att.content, {
            filename,
            contentType,
            contentDisposition: 'attachment',
          })
        } else if (att.path) {
          message.attach(att.path, {
            filename,
            contentType,
            contentDisposition: 'attachment',
          })
        }
      })
    })
  }
}