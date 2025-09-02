import CompanyAccount from '#models/company_account'
import BusinessSource from '#models/business_source'
import PaymentMethod from '#models/payment_method'
import { PaymentMethodType } from '#app/enums'
import LoggerService from '#services/logger_service'

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

    // If addToBusinessSource is true, create a business source
    if (companyAccount.addToBusinessSource === true) {
      await this.createBusinessSource(companyAccount, data)
    }

    // If not marked as doNotCountAsCityLedger, create a city ledger payment method
    if (companyAccount.doNotCountAsCityLedger !== true) {
      await this.createCityLedgerPaymentMethod(companyAccount)
    }

    // Log the creation if createdBy is provided
    if (data.createdBy) {
      await LoggerService.logActivity({
        userId: data.createdBy,
        action: 'CREATE',
        resourceType: 'CompanyAccount',
        resourceId: companyAccount.id,
        hotelId: companyAccount.hotelId,
        details: {
          companyName: companyAccount.companyName,
          companyCode: companyAccount.companyCode,
          accountStatus: companyAccount.accountStatus,
          addToBusinessSource: companyAccount.addToBusinessSource,
          doNotCountAsCityLedger: companyAccount.doNotCountAsCityLedger
        }
      })
    }

    // Log the update if lastModifiedBy is provided
    if (data.lastModifiedBy) {
      await LoggerService.logActivity({
        userId: data.lastModifiedBy,
        action: 'UPDATE',
        resourceType: 'CompanyAccount',
        resourceId: companyAccount.id,
        hotelId: companyAccount.hotelId,
        details: {
          companyName: companyAccount.companyName,
          companyCode: companyAccount.companyCode,
          accountStatus: companyAccount.accountStatus,
          changes: LoggerService.extractChanges({}, data)
        }
      })
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
    if (companyAccount.addToBusinessSource === true) {
      // Check if business source already exists for this company
      const existingBusinessSource = await BusinessSource.query()
        .where('hotelId', companyAccount.hotelId)
        .where('name', companyAccount.companyName)
        .first()

      if (!existingBusinessSource) {
        await this.createBusinessSource(companyAccount, data)
      }
    }

    // Handle city ledger payment method
    if (companyAccount.doNotCountAsCityLedger === true) {
      // Disable any existing city ledger payment method for this company
      await PaymentMethod.query()
        .where('hotelId', companyAccount.hotelId)
        .where('name', `City Ledger - ${companyAccount.companyCode}`)
        .where('methodType', PaymentMethodType.CITY_LEDGER)
        .update({ isActive: false })
    } else if (companyAccount.doNotCountAsCityLedger === false) {
      // Check if payment method exists and reactivate or create
      const existingPaymentMethod = await PaymentMethod.query()
        .where('hotelId', companyAccount.hotelId)
        .where('name', `City Ledger - ${companyAccount.companyName}`)
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
  async delete(id: number, deletedBy?: number) {
    const companyAccount = await CompanyAccount.find(id)

    if (!companyAccount) return null

    // Soft delete by updating fields
    companyAccount.accountStatus = 'Closed'
    companyAccount.delete()
    await companyAccount.save()

    // Log the deletion if deletedBy is provided
    if (deletedBy) {
      await LoggerService.logActivity({
        userId: deletedBy,
        action: 'DELETE',
        resourceType: 'CompanyAccount',
        resourceId: companyAccount.id,
        hotelId: companyAccount.hotelId,
        details: {
          companyName: companyAccount.companyName,
          companyCode: companyAccount.companyCode,
          previousStatus: 'Active',
          newStatus: 'Closed'
        }
      })
    }

    return true
  }

  /**
   * Get company accounts by hotel ID
   */
  async getByHotelId(hotelId: number) {
    return await CompanyAccount.query()
      .where('hotel_id', hotelId)
      .andWhereNot('account_status', 'Closed')
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
   * Get city ledger accounts for a hotel (doNotCountAsCityLedger = false)
   */
  async getCityLedgerAccounts(hotelId: number) {
    return await CompanyAccount.query()
      .where('hotel_id', hotelId)
      .where('do_not_count_as_city_ledger', false)
      .andWhereNot('account_status', 'Closed')
      .orderBy('company_name', 'asc')
  }

  /**
   * Create a business source from company account data
   */
  public async createBusinessSource(companyAccount: CompanyAccount, data: any) {
    // Create a short code from the company name
    const shortCode = this.generateShortCode(companyAccount.companyName)

    await BusinessSource.create({
      hotelId: companyAccount.hotelId,
      name: companyAccount.companyName,
      shortCode,
      registrationNumber: data.registrationNumber || null,
      createdByUserId: companyAccount.createdBy,
      updatedByUserId: companyAccount.createdBy,
      isDeleted: false
    })
  }

  /**
   * Create a city ledger payment method for the company account
   */
  public async createCityLedgerPaymentMethod(companyAccount: CompanyAccount) {
    await PaymentMethod.create({
      hotelId: companyAccount.hotelId,
      methodName: `City Ledger - ${companyAccount.companyName}`,
      methodCode: this.generateShortCode(`CL-${companyAccount.companyName}`),
      methodType: PaymentMethodType.CITY_LEDGER,
      isActive: true,
      description: `City ledger payment method for ${companyAccount.companyName}`,
      createdBy: companyAccount.createdBy,
      lastModifiedBy: companyAccount.createdBy
    })
  }

  /**
   * Generate a short code from a name
   */
  public generateShortCode(name: string): string {
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