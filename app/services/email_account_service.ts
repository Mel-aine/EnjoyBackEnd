import EmailAccount from '#models/email_account'
import { Exception } from '@adonisjs/core/exceptions'
import { ModelPaginatorContract } from '@adonisjs/lucid/types/model'

export default class EmailAccountService {
  /**
   * Get all email accounts for a specific hotel with pagination
   */
  async getByHotelId(
    hotelId: number,
    page: number = 1,
    limit: number = 10
  ): Promise<ModelPaginatorContract<EmailAccount>> {
    return await EmailAccount.query()
      .where('hotel_id', hotelId)
      .orderBy('created_at', 'desc')
      .paginate(page, limit)
  }

  /**
   * Get a specific email account by ID
   */
  async getById(id: number): Promise<EmailAccount> {
    const emailAccount = await EmailAccount.find(id)
    if (!emailAccount) {
      throw new Exception('Email account not found', { status: 404 })
    }
    return emailAccount
  }

  /**
   * Create a new email account
   */
  async create(data: {
    hotelId: number
    title: string
    emailAddress: string
    displayName: string
    signature?: string
    isActive?: boolean
    createdBy?: number
  }): Promise<EmailAccount> {
    return await EmailAccount.create({
      hotelId: data.hotelId,
      title: data.title,
      emailAddress: data.emailAddress,
      displayName: data.displayName,
      signature: data.signature || '',
      isActive: data.isActive ?? true,
      createdBy: data.createdBy,
      lastModifiedBy: data.createdBy
    })
  }

  /**
   * Update an existing email account
   */
  async update(
    id: number,
    data: {
      title?: string
      emailAddress?: string
      displayName?: string
      signature?: string
      isActive?: boolean
      lastModifiedBy?: number
    }
  ): Promise<EmailAccount> {
    const emailAccount = await this.getById(id)
    
    emailAccount.merge({
      ...data,
      lastModifiedBy: data.lastModifiedBy
    })
    
    await emailAccount.save()
    return emailAccount
  }

  /**
   * Delete an email account
   */
  async delete(id: number): Promise<void> {
    const emailAccount = await this.getById(id)
    await emailAccount.delete()
  }

  /**
   * Get active email accounts for a hotel
   */
  async getActiveByHotelId(hotelId: number): Promise<EmailAccount[]> {
    return await EmailAccount.query()
      .where('hotel_id', hotelId)
      .where('is_active', true)
      .orderBy('title', 'asc')
  }

  /**
   * Toggle active status of an email account
   */
  async toggleActive(id: number, lastModifiedBy?: number): Promise<EmailAccount> {
    const emailAccount = await this.getById(id)
    emailAccount.isActive = !emailAccount.isActive
    emailAccount.lastModifiedBy = lastModifiedBy
    await emailAccount.save()
    return emailAccount
  }
}