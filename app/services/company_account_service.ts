import CompanyAccount from '#models/company_account'
import BusinessSource from '#models/business_source'
import PaymentMethod from '#models/payment_method'
import { PaymentMethodType } from '#app/enums'

export default class CompanyAccountService {
  /**
   * List company accounts with filtering, sorting, and pagination
   */
  async list(filters: any, sortBy: string = 'id', order: 'asc' | 'desc' = 'asc', page: number = 1, perPage: number = 20) {
    let query = CompanyAccount.query()

    // Apply filters
    for (const key in filters) {
      if (Array.isArray(filters[key])) {
        query.whereIn(key, filters[key])
      } else {
        query.where(key, filters[key])
      }
    }

    // Apply relationships
    query.preload('hotel')
    query.preload('creator')
    query.preload('modifier')

    // Apply sorting and pagination
    return await query
      .orderBy(sortBy, order)
      .paginate(page, perPage)
  }

  /**
   * Get a company account by ID
   */
  async getById(id: number) {
    return await CompanyAccount.query()
      .where('id', id)
      .preload('hotel')
      .preload('creator')
      .preload('modifier')
      .first()
  }

  /**
   * Create a new company account
   */
  async create(data: any) {
    // Create the company account
    const companyAccount = await CompanyAccount.create(data)

    // If add_to_business_source is true, create a business source
    if (companyAccount.add_to_business_source === true) {
      await this.createBusinessSource(companyAccount, data)
    }

    // If not marked as do_not_count_as_city_ledger, create a city ledger payment method
    if (companyAccount.do_not_count_as_city_ledger !== true) {
      await this.createCityLedgerPaymentMethod(companyAccount)
    }

    return companyAccount
  }

  /**
   * Update a company account
   */
  async update(id: number, data: any) {
    const companyAccount = await CompanyAccount.find(id)
    if (!companyAccount) return null

    // Update the company account
    companyAccount.merge(data)
    await companyAccount.save()

    // Handle business source creation if requested
    if (companyAccount.add_to_business_source === true) {
      // Check if business source already exists for this company
      const existingBusinessSource = await BusinessSource.query()
        .where('hotelId', companyAccount.hotel_id)
        .where('name', companyAccount.company_name)
        .first()

      if (!existingBusinessSource) {
        await this.createBusinessSource(companyAccount, data)
      }
    }

    // Handle city ledger payment method
    if (companyAccount.do_not_count_as_city_ledger === true) {
      // Disable any existing city ledger payment method for this company
      await PaymentMethod.query()
        .where('hotelId', companyAccount.hotel_id)
        .where('name', `City Ledger - ${companyAccount.company_name}`)
        .where('methodType', PaymentMethodType.CITY_LEDGER)
        .update({ isActive: false })
    } else if (companyAccount.do_not_count_as_city_ledger === false) {
      // Check if payment method exists and reactivate or create
      const existingPaymentMethod = await PaymentMethod.query()
        .where('hotelId', companyAccount.hotel_id)
        .where('name', `City Ledger - ${companyAccount.company_name}`)
        .where('methodType', PaymentMethodType.CITY_LEDGER)
        .first()

      if (existingPaymentMethod) {
        existingPaymentMethod.isActive = true
        await existingPaymentMethod.save()
      } else {
        await this.createCityLedgerPaymentMethod(companyAccount)
      }
    }

    return companyAccount
  }

  /**
   * Delete a company account (soft delete)
   */
  async delete(id: number) {
    const companyAccount = await CompanyAccount.find(id)

    if (!companyAccount) return null

    // Soft delete by updating fields
    companyAccount.account_status = 'Closed'
    companyAccount.delete()
    await companyAccount.save()

    return true
  }

  /**
   * Get company accounts by hotel ID
   */
  async getByHotelId(hotelId: number) {
    return await CompanyAccount.query()
      .where('hotel_id', hotelId)
      .andWhere('account_status', 'Closed')
      .orderBy('company_name', 'asc')
  }

  /**
   * Get active company accounts
   */
  async getActiveAccounts(hotelId?: number) {
    let query = CompanyAccount.query()
      .where('account_status', 'Active')

    if (hotelId) {
      query.where('hotel_id', hotelId)
    }

    return await query.orderBy('company_name', 'asc')
  }

  /**
   * Create a business source from company account data
   */
  private async createBusinessSource(companyAccount: CompanyAccount, data: any) {
    // Create a short code from the company name
    const shortCode = this.generateShortCode(companyAccount.company_name)

    await BusinessSource.create({
      hotelId: companyAccount.hotel_id,
      name: companyAccount.company_name,
      shortCode,
      registrationNumber: data.registrationNumber || null,
      createdByUserId: companyAccount.created_by,
      updatedByUserId: companyAccount.created_by,
      isDeleted: false
    })
  }

  /**
   * Create a city ledger payment method for the company account
   */
  private async createCityLedgerPaymentMethod(companyAccount: CompanyAccount) {
    await PaymentMethod.create({
      hotelId: companyAccount.hotel_id,
      methodName: `City Ledger - ${companyAccount.company_name}`,
      methodCode: this.generateShortCode(`CL-${companyAccount.company_name}`),
      methodType: PaymentMethodType.CITY_LEDGER,
      isActive: true,
      description: `City ledger payment method for ${companyAccount.company_name}`,
      createdBy: companyAccount.created_by,
      lastModifiedBy: companyAccount.created_by
    })
  }

  /**
   * Generate a short code from a name
   */
  private generateShortCode(name: string): string {
    // Remove special characters and spaces, convert to uppercase
    const cleanName = name.replace(/[^a-zA-Z0-9]/g, '')

    // If name is short, use it directly
    if (cleanName.length <= 6) {
      return cleanName.toUpperCase()
    }

    // Otherwise, create an abbreviation using first letters of words
    const words = name.split(/\s+/)
    if (words.length >= 2) {
      const code = words.map(word => word.charAt(0)).join('')
      return code.toUpperCase()
    }

    // If it's a single long word, use first 3 and last 3 characters
    return (cleanName.substring(0, 3) + cleanName.substring(cleanName.length - 3)).toUpperCase()
  }
}