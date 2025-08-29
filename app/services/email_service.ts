import mail from '@adonisjs/mail/services/main'
import env from '#start/env'
import EmailTemplate from '#models/email_template'

export interface EmailData {
  [key: string]: any
}

export interface SendEmailOptions {
  to: string
  subject: string
  html: string
  from?: string
  fromName?: string
}

export class EmailService {
  /**
   * Send an email using the configured mail service
   */
  static async sendEmail(options: SendEmailOptions): Promise<{ success: boolean; message: string }> {
    try {
      const fromAddress = options.from || env.get('MAIL_FROM_ADDRESS', 'noreply@yourhotel.com')
      const fromName = options.fromName || env.get('MAIL_FROM_NAME', 'Your Hotel')

      await mail.send((message) => {
        message
          .to(options.to)
          .from(fromAddress, fromName)
          .subject(options.subject)
          .html(options.html)
      })

      return {
        success: true,
        message: 'Email sent successfully'
      }
    } catch (error) {
      console.error('Email sending failed:', error)
      return {
        success: false,
        message: error.message || 'Failed to send email'
      }
    }
  }

  /**
   * Send an email using a template
   */
  static async sendTemplateEmail(
    templateName: string,
    recipientEmail: string,
    data: EmailData
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Get the email template
      const template = await EmailTemplate.findBy('template_name', templateName)
      if (!template) {
        return {
          success: false,
          message: `Template '${templateName}' not found`
        }
      }

      // Generate email content from template
      const subject = this.replaceTemplateVariables(template.subject, data)
      const html = this.replaceTemplateVariables(template.bodyHtml, data)

      // Send the email
      return await this.sendEmail({
        to: recipientEmail,
        subject,
        html
      })
    } catch (error) {
      console.error('Template email sending failed:', error)
      return {
        success: false,
        message: error.message || 'Failed to send template email'
      }
    }
  }

  /**
   * Replace template variables with actual data
   */
  private static replaceTemplateVariables(template: string, data: EmailData): string {
    let result = template
    
    // Replace variables in the format {{variable_name}}
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
      result = result.replace(regex, String(value || ''))
    }
    
    return result
  }

  /**
   * Test email configuration by sending a test email
   */
  static async testEmailConfiguration(testEmail: string): Promise<{ success: boolean; message: string }> {
    const testSubject = 'Test Email Configuration'
    const testHtml = `
      <h2>Email Configuration Test</h2>
      <p>This is a test email to verify that your email configuration is working correctly.</p>
      <p>If you receive this email, your email service is properly configured.</p>
      <p>Sent at: ${new Date().toISOString()}</p>
    `

    return await this.sendEmail({
      to: testEmail,
      subject: testSubject,
      html: testHtml
    })
  }
}