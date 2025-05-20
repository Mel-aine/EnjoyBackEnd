import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Category from '#models/category'

export default class extends BaseSeeder {
  async run() {
    const categories = [
      { category_name: 'Restaurants', description: 'Restaurants' },
      { category_name: 'Nightlife', description: 'Nightlife' },
      { category_name: 'Shopping', description: 'Shopping' },
      { category_name: 'Sports & Leisure Activities', description: 'Sports & Leisure Activities' },
      { category_name: 'Beauty Salons & Spas', description: 'Beauty Salons & Spas' },
      { category_name: 'Automobile', description: 'Automobile' },
      { category_name: 'Houses & Works', description: 'Houses & Works' },
      { category_name: 'Power Supplies', description: 'Power Supplies' },
      { category_name: 'Art & Leisure', description: 'Art & Leisure' },
      { category_name: 'Health & Medical', description: 'Health & Medical' },
      { category_name: 'Services for Professionals', description: 'Services for Professionals' },
      { category_name: 'Pets', description: 'Pets' },
      { category_name: 'Real Estate', description: 'Real Estate' },
      { category_name: 'Hotels & Stays', description: 'Hotels & Stays' },
      { category_name: 'Local Services', description: 'Local Services' },
      { category_name: 'Event Organization', description: 'Event Organization' },
      { category_name: 'Public Services & Government', description: 'Public Services & Government' },
      { category_name: 'Financial Services', description: 'Financial Services' },
      { category_name: 'Training & Teaching', description: 'Training & Teaching' },
      { category_name: 'Religious Organization', description: 'Religious Organization' },
      { category_name: 'Travel', description: 'Travel' },
      { category_name: 'Media', description: 'Media' },
      { category_name: 'Coffees & Teas', description: 'Coffees & Teas' },
    ]

    for (const category of categories) {
      await Category.create({
        category_name: category.category_name,
        description: category.description,
       // parent_category_id: null,
        status: 'active',
        created_by: null,
        last_modified_by: null,
      })
    }
  }
}
