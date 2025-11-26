import { DateTime } from 'luxon'
import { cuid } from '@adonisjs/core/helpers'
import MailService from '#services/mail_service'
import User from '#models/user'

export default class UserEmailService {
  /**
   * Generate a verification token, set expiry, save to user, and send email.
   * Returns the confirmation URL and token metadata.
   */
  static async prepareAndSendVerification(user: User, baseUrl: string) {
    const verificationToken = cuid()
    const expiresAt = DateTime.now().plus({ days: 1 })

    user.emailVerificationToken = verificationToken
    user.emailVerificationExpires = expiresAt
    user.emailVerified = false
    await user.save()

    const confirmUrl = `${baseUrl}/api/confirm-email?token=${encodeURIComponent(verificationToken)}&email=${encodeURIComponent(user.email)}`

    await MailService.send({
      to: user.email,
      subject: 'Confirm your email address',
      text: `Welcome! Please confirm your email to activate your account.\n\nClick the link: ${confirmUrl}\n\nThis link expires in 24 hours.`,
      html: `<p>Welcome! Please confirm your email to activate your account.</p>
             <p><a href="${confirmUrl}" target="_blank">Click here to confirm your email</a></p>
             <p>This link expires in 24 hours.</p>`,
    })

    return { confirmUrl, token: verificationToken, expiresAt }
  }
}
