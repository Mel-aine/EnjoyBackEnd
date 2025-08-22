import { BaseSeeder } from '@adonisjs/lucid/seeders'
import CompanyAccount from '#models/company_account'

export default class CompanyAccountSeeder extends BaseSeeder {
  async run() {
    await CompanyAccount.create({
      hotel_id: 1,
      company_name: 'Test Company',
      account_type: 'Corporate',
      account_status: 'Active',
      credit_status: 'Good',
      current_balance: 0,
      add_to_business_source: true,
      do_not_count_as_city_ledger: false,
      created_by: 1
    })
  }
}