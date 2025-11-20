import env from '#start/env'
import axios, { AxiosRequestHeaders } from 'axios'

export default class MailjetService {
  private static getBaseUrlV3() {
    return env.get('MAILJET_API_BASE_URL_V3')
  }
  private static getBaseUrlV31() {
    return env.get('MAILJET_API_BASE_URL_V31')
  }

  private static getAuthHeader(): AxiosRequestHeaders {
    const apiKey = env.get('MAILJET_API_KEY')
    const apiSecret = env.get('MAILJET_API_SECRET')
    if (!apiKey || !apiSecret) {
      throw new Error('Missing MAILJET_API_KEY or MAILJET_API_SECRET')
    }
    const token = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')
    return { Authorization: `Basic ${token}` }
  }

  /**
   * Ensure a sender is registered and validation is triggered per Mailjet guidelines.
   * https://dev.mailjet.com/email/guides/senders-and-domains/
   */
  static async ensureSender(email: string, name?: string) {
    if (!email) return
    const headers: AxiosRequestHeaders = {
      'Content-Type': 'application/json',
      ...this.getAuthHeader(),
    }

    // Check if sender exists
    let sender: any = null
    try {
      const res = await axios.get(`${this.getBaseUrlV3()}/REST/sender`, { headers, params: { Email: email } })
      sender = res.data?.Data?.[0] || null
    } catch {}

    // Create sender if missing
    if (!sender) {
      try {
        const createRes = await axios.post(
          `${this.getBaseUrlV3()}/REST/sender`,
          {
            Email: email,
            Name: name || undefined,
            EmailType: 'transactional',
            IsDefaultSender: false,
          },
          { headers }
        )
        sender = createRes.data?.Data?.[0] || null
      } catch (err) {
        // If creation fails due to existing, fall through to validation
      }
    }

    // Ensure existing sender has desired settings
    try {
      const id = sender?.ID
      if (id && (sender.EmailType !== 'transactional' || sender.IsDefaultSender !== false)) {
        await axios.put(
          `${this.getBaseUrlV3()}/REST/sender/${id}`,
          { EmailType: 'transactional', IsDefaultSender: false },
          { headers }
        )
      }
    } catch {}

    // Trigger validation email (resends if already sent)
    try {
      await axios.post(`${this.getBaseUrlV3()}/REST/sender/validate`, { Email: email }, { headers })
    } catch {
      // Some accounts may require domain validation; in such case, manual DNS setup is needed.
    }

    return sender
  }

  /**
   * Fetch sender by email from Mailjet.
   */
  static async getSenderByEmail(email: string): Promise<any | null> {
    if (!email) return null
    const headers: AxiosRequestHeaders = {
      'Content-Type': 'application/json',
      ...this.getAuthHeader(),
    }
    try {
      const res = await axios.get(`${this.getBaseUrlV3()}/REST/sender`, { headers, params: { Email: email } })
      return res.data?.Data?.[0] || null
    } catch {
      return null
    }
  }

  /**
   * Check if a sender is active in Mailjet.
   */
  static async isSenderActive(email: string): Promise<boolean> {
    const sender = await this.getSenderByEmail(email)
    const status = sender?.Status || sender?.status
    return status === 'Active'
  }

  /**
   * Create or update a contact in Mailjet. Optionally, add to a contacts list.
   */
  static async createOrUpdateContact(email: string, name?: string) {
    if (!email) return
    const headers: AxiosRequestHeaders = {
      'Content-Type': 'application/json',
      ...this.getAuthHeader(),
    }

    // Try to create the contact
    try {
      await axios.post(`${this.getBaseUrlV3()}/REST/contact`, { Email: email, Name: name || undefined }, { headers })
    } catch (err: any) {
      // If already exists, update name
      try {
        const findRes = await axios.get(`${this.getBaseUrlV3()}/REST/contact`, {
          headers,
          params: { Email: email },
        })
        const id = findRes.data?.Data?.[0]?.ID
        if (id) {
          await axios.put(`${this.getBaseUrlV3()}/REST/contact/${id}`, { Name: name || undefined }, { headers })
        }
      } catch {}
    }

    // Optionally add to contacts list
    const listId = env.get('MAILJET_CONTACT_LIST_ID')
    if (listId) {
      await axios.post(`${this.getBaseUrlV3()}/REST/contactslist/${listId}/managecontact`, { Email: email, Action: 'addnoforce' }, { headers })
    }
  }

  /**
   * Delete a sender in Mailjet by email.
   */
  static async deleteSender(email: string) {
    if (!email) return
    const headers: AxiosRequestHeaders = {
      'Content-Type': 'application/json',
      ...this.getAuthHeader(),
    }

    try {
      const res = await axios.get(`${this.getBaseUrlV3()}/REST/sender`, { headers, params: { Email: email } })
      const sender = res.data?.Data?.[0]
      if (sender?.ID) {
        await axios.delete(`${this.getBaseUrlV3()}/REST/sender/${sender.ID}`, { headers })
      }
    } catch (error) {
      // Swallow errors to avoid blocking local deletion; optionally log elsewhere.
    }
  }

  /**
   * Send verification email via Mailjet using template.
   * Requires MAILJET_VERIFICATION_TEMPLATE_ID and sender settings.
   */
  static async sendVerification(email: string, variables: Record<string, any> = {}) {
    if (!email) return
    const templateId = env.get('MAILJET_VERIFICATION_TEMPLATE_ID')
    const fromEmail = env.get('MAILJET_SENDER_EMAIL') || env.get('MAIL_FROM_ADDRESS') || 'no-reply@example.com'
    const fromName = env.get('MAIL_FROM_NAME') || 'Enjoy PMS'

    if (!templateId) {
      // Fallback: send a simple email if no template ID is defined
      return this.sendBasicEmail(email, 'Email Verification', 'Please verify your email address.', variables)
    }

    const headers: AxiosRequestHeaders = {
      'Content-Type': 'application/json',
      ...this.getAuthHeader(),
    }

    const body = {
      Messages: [
        {
          From: { Email: fromEmail, Name: fromName },
          To: [{ Email: email }],
          TemplateID: templateId,
          TemplateLanguage: true,
          Subject: 'Verify your email',
          Variables: { email, ...variables },
        },
      ],
    }

    await axios.post(`${this.getBaseUrlV31()}/send`, body, { headers })
  }

  /**
   * Lightweight plain email sender via v3.1 for fallback scenarios.
   */
  private static async sendBasicEmail(toEmail: string, subject: string, text: string, variables: Record<string, any> = {}) {
    const headers: AxiosRequestHeaders = {
      'Content-Type': 'application/json',
      ...this.getAuthHeader(),
    }
    const fromEmail = env.get('MAILJET_SENDER_EMAIL') || env.get('MAIL_FROM_ADDRESS') || 'no-reply@example.com'
    const fromName = env.get('MAIL_FROM_NAME') || 'Enjoy PMS'

    const body = {
      Messages: [
        {
          From: { Email: fromEmail, Name: fromName },
          To: [{ Email: toEmail }],
          Subject: subject,
          TextPart: text,
          CustomID: variables?.customId || 'email_verification',
        },
      ],
    }
    await axios.post(`${this.getBaseUrlV31()}/send`, body, { headers })
  }
}