import vine from '@vinejs/vine'
import { DateTime } from 'luxon'

/**
 * Validator to validate the payload when creating
 * a new company account.
 */
export const createCompanyAccountValidator = vine.compile(
  vine.object({
    hotel_id: vine.number().positive(),
    company_name: vine.string().trim().minLength(1).maxLength(255),
    company_code: vine.string().trim().maxLength(50).optional(),
    account_type: vine.enum(['Corporate', 'TravelAgency', 'Government', 'Airline', 'Other']),
    contact_person_name: vine.string().trim().maxLength(255).optional(),
    contact_person_title: vine.string().trim().maxLength(100).optional(),
    primary_email: vine.string().trim().email().maxLength(255).optional(),
    secondary_email: vine.string().trim().email().maxLength(255).optional(),
    primary_phone: vine.string().trim().maxLength(20).optional(),
    secondary_phone: vine.string().trim().maxLength(20).optional(),
    fax_number: vine.string().trim().maxLength(20).optional(),
    website: vine.string().trim().maxLength(255).optional(),
    billing_address_line: vine.string().trim().maxLength(255).optional(),
    billing_address_line2: vine.string().trim().maxLength(255).optional(),
    billing_city: vine.string().trim().maxLength(100).optional(),
    billing_state_province: vine.string().trim().maxLength(100).optional(),
    billing_postal_code: vine.string().trim().maxLength(20).optional(),
    billing_country: vine.string().trim().maxLength(100).optional(),
    tax_id: vine.string().trim().maxLength(50).optional(),
    registration_number: vine.string().trim().maxLength(50).optional(),
    credit_limit: vine.number().min(0).optional(),
    current_balance: vine.number().min(0),
    payment_terms: vine.string().trim().maxLength(100).optional(),
    discount_percentage: vine.number().min(0).max(100).optional(),
    commission_percentage: vine.number().min(0).max(100).optional(),
    account_status: vine.enum(['Active', 'Inactive', 'Suspended', 'Closed']),
    credit_status: vine.enum(['Good', 'Warning', 'Hold', 'Blocked']),
    last_activity_date: vine.date().transform((value) => value ? DateTime.fromJSDate(value) : value).optional(),
    preferred_currency: vine.string().trim().maxLength(3).optional(),
    billing_cycle: vine.enum(['Weekly', 'BiWeekly', 'Monthly', 'Quarterly', 'Custom']).optional(),
    auto_billing_enabled: vine.boolean().optional(),
    special_instructions: vine.string().trim().maxLength(1000).optional(),
    notes: vine.string().trim().maxLength(1000).optional(),
    add_to_business_source: vine.boolean().optional(),
    do_not_count_as_city_ledger: vine.boolean().optional(),
  })
)

/**
 * Validator to validate the payload when updating
 * an existing company account.
 */
export const updateCompanyAccountValidator = vine.compile(
  vine.object({
    hotel_id: vine.number().positive().optional(),
    company_name: vine.string().trim().minLength(1).maxLength(255).optional(),
    company_code: vine.string().trim().maxLength(50).optional(),
    account_type: vine.enum(['Corporate', 'TravelAgency', 'Government', 'Airline', 'Other']).optional(),
    contact_person_name: vine.string().trim().maxLength(255).optional(),
    contact_person_title: vine.string().trim().maxLength(100).optional(),
    primary_email: vine.string().trim().email().maxLength(255).optional(),
    secondary_email: vine.string().trim().email().maxLength(255).optional(),
    primary_phone: vine.string().trim().maxLength(20).optional(),
    secondary_phone: vine.string().trim().maxLength(20).optional(),
    fax_number: vine.string().trim().maxLength(20).optional(),
    website: vine.string().trim().maxLength(255).optional(),
    billing_address_line: vine.string().trim().maxLength(255).optional(),
    billing_address_line2: vine.string().trim().maxLength(255).optional(),
    billing_city: vine.string().trim().maxLength(100).optional(),
    billing_state_province: vine.string().trim().maxLength(100).optional(),
    billing_postal_code: vine.string().trim().maxLength(20).optional(),
    billing_country: vine.string().trim().maxLength(100).optional(),
    tax_id: vine.string().trim().maxLength(50).optional(),
    registration_number: vine.string().trim().maxLength(50).optional(),
    credit_limit: vine.number().min(0).optional(),
    current_balance: vine.number().min(0).optional(),
    payment_terms: vine.string().trim().maxLength(100).optional(),
    discount_percentage: vine.number().min(0).max(100).optional(),
    commission_percentage: vine.number().min(0).max(100).optional(),
    account_status: vine.enum(['Active', 'Inactive', 'Suspended', 'Closed']).optional(),
    credit_status: vine.enum(['Good', 'Warning', 'Hold', 'Blocked']).optional(),
    last_activity_date: vine.date().transform((value) => value ? DateTime.fromJSDate(value) : value).optional(),
    preferred_currency: vine.string().trim().maxLength(3).optional(),
    billing_cycle: vine.enum(['Weekly', 'BiWeekly', 'Monthly', 'Quarterly', 'Custom']).optional(),
    auto_billing_enabled: vine.boolean().optional(),
    special_instructions: vine.string().trim().maxLength(1000).optional(),
    notes: vine.string().trim().maxLength(1000).optional(),
    add_to_business_source: vine.boolean().optional(),
    do_not_count_as_city_ledger: vine.boolean().optional(),
    last_modified_by: vine.number().positive().optional()
  })
)

/**
 * Validator for search parameters
 */
export const searchCompanyAccountValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
    account_status: vine.enum(['Active', 'Inactive', 'Suspended', 'Closed']).optional(),
    account_type: vine.enum(['Corporate', 'TravelAgency', 'Government', 'Airline', 'Other']).optional(),
    credit_status: vine.enum(['Good', 'Warning', 'Hold', 'Blocked']).optional(),
    search: vine.string().trim().maxLength(255).optional(),
    sortBy: vine.enum([
      'created_at',
      'updated_at',
      'company_name',
      'account_type',
      'account_status',
      'credit_status',
      'current_balance'
    ]).optional(),
    sortOrder: vine.enum(['asc', 'desc']).optional(),
    hotel_id: vine.number().positive().optional()
  })
)