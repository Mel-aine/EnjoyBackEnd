import { test } from '@japa/runner'
import { createCompanyAccountValidator, updateCompanyAccountValidator, searchCompanyAccountValidator } from '#validators/company_account'

test.group('Company Account Validators', () => {
  test('createCompanyAccountValidator validates correct data', async ({ assert }) => {
    const validData = {
      hotel_id: 1,
      company_name: 'Acme Corporation',
      account_type: 'Corporate',
      current_balance: 0,
      account_status: 'Active',
      credit_status: 'Good',
      created_by: 1
    }

    const result = await createCompanyAccountValidator.validate(validData)
    assert.deepEqual(result, validData)
  })

  test('createCompanyAccountValidator validates all fields', async ({ assert }) => {
    const validData = {
      hotel_id: 1,
      company_name: 'Acme Corporation',
      company_code: 'ACME001',
      account_type: 'Corporate',
      contact_person_name: 'John Doe',
      contact_person_title: 'CEO',
      primary_email: 'john.doe@acme.com',
      secondary_email: 'info@acme.com',
      primary_phone: '+1234567890',
      secondary_phone: '+0987654321',
      fax_number: '+1122334455',
      website: 'https://acme.com',
      billing_address_line: '123 Main St',
      billing_address_line2: 'Suite 100',
      billing_city: 'New York',
      billing_state_province: 'NY',
      billing_postal_code: '10001',
      billing_country: 'USA',
      tax_id: 'TAX123456',
      credit_limit: 10000,
      current_balance: 0,
      payment_terms: 'Net 30',
      discount_percentage: 10,
      commission_percentage: 5,
      account_status: 'Active',
      credit_status: 'Good',
      last_activity_date: new Date(),
      preferred_currency: 'USD',
      billing_cycle: 'Monthly',
      auto_billing_enabled: true,
      special_instructions: 'Special handling required',
      notes: 'Important client',
      created_by: 1,
      addToBusinessSource: true,
      doNotCountAsCityLedger: false
    }

    const result = await createCompanyAccountValidator.validate(validData)
    assert.deepEqual(result, validData)
  })

  test('createCompanyAccountValidator rejects invalid data', async ({ assert }) => {
    const invalidData = {
      // Missing required fields
      company_name: 'Acme Corporation'
    }

    try {
      await createCompanyAccountValidator.validate(invalidData)
      assert.fail('Validation should have failed')
    } catch (error) {
      assert.exists(error.messages)
    }
  })

  test('updateCompanyAccountValidator validates partial data', async ({ assert }) => {
    const validUpdateData = {
      company_name: 'Updated Corporation',
      account_status: 'Inactive'
    }

    const result = await updateCompanyAccountValidator.validate(validUpdateData)
    assert.deepEqual(result, validUpdateData)
  })

  test('searchCompanyAccountValidator validates search parameters', async ({ assert }) => {
    const validSearchData = {
      page: 1,
      limit: 20,
      account_status: 'Active',
      account_type: 'Corporate',
      search: 'Acme',
      sortBy: 'company_name',
      sortOrder: 'asc',
      hotel_id: 1
    }

    const result = await searchCompanyAccountValidator.validate(validSearchData)
    assert.deepEqual(result, validSearchData)
  })
})