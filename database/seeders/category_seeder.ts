import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Category from '#models/category'

export default class extends BaseSeeder {
  async run() {
    const categories = [
      { category_name: 'Restaurants', description: 'Restaurants', icon: 'fa-solid fa-utensils' },
      { category_name: 'Nightlife', description: 'Nightlife', icon: 'fa-solid fa-glass-cheers' },
      { category_name: 'Shopping', description: 'Shopping', icon: 'fa-solid fa-shopping-bag' },
      { category_name: 'Sports & Leisure Activities', description: 'Sports & Leisure Activities', icon: 'fa-solid fa-football-ball' },
      { category_name: 'Beauty Salons & Spas', description: 'Beauty Salons & Spas', icon: 'fa-solid fa-spa' },
      { category_name: 'Automobile', description: 'Automobile', icon: 'fa-solid fa-bus' },
      { category_name: 'Houses & Works', description: 'Houses & Works', icon: 'fa-solid fa-home' },
      { category_name: 'Power Supplies', description: 'Power Supplies', icon: 'fa-solid fa-apple-alt' },
      { category_name: 'Art & Leisure', description: 'Art & Leisure', icon: 'fa-solid fa-palette' },
      { category_name: 'Health & Medical', description: 'Health & Medical', icon: 'fa-solid fa-briefcase-medical' },
      { category_name: 'Services for Professionals', description: 'Services for Professionals', icon: 'fa-solid fa-shield-alt' },
      { category_name: 'Pets', description: 'Pets', icon: 'fa-solid fa-paw' },
      { category_name: 'Real Estate', description: 'Real Estate', icon: 'fa-solid fa-building' },
      { category_name: 'Hotels & Stays', description: 'Hotels & Stays', icon: 'fa-solid fa-hotel' },
      { category_name: 'Local Services', description: 'Local Services', icon: 'fa-solid fa-map-marker-alt' },
      { category_name: 'Event Organization', description: 'Event Organization', icon: 'fa-solid fa-calendar-alt' },
      { category_name: 'Public Services & Government', description: 'Public Services & Government', icon: 'fa-solid fa-landmark' },
      { category_name: 'Financial Services', description: 'Financial Services', icon: 'fa-solid fa-chart-line' },
      { category_name: 'Training & Teaching', description: 'Training & Teaching', icon: 'fa-solid fa-pencil-alt' },
      { category_name: 'Religious Organization', description: 'Religious Organization', icon: 'fa-solid fa-church' },
      { category_name: 'Travel', description: 'Travel', icon: 'fa-solid fa-bus' },
      { category_name: 'Media', description: 'Media', icon: 'fa-solid fa-newspaper' },
      { category_name: 'Coffees & Teas', description: 'Coffees & Teas', icon: 'fa-solid fa-coffee' }
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
