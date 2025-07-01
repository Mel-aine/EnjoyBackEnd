// import { BaseSeeder } from '@adonisjs/lucid/seeders'

// export default class extends BaseSeeder {
//   async run() {
//     // Write your database queries inside the run method
//   }
// }

import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Service from '#models/service'
import User from '#models/user'
import * as fs from 'fs'


const defaultFacilities = ['Piscine', 'Bar', 'Restaurant', 'Parking', 'Wi-Fi gratuit']
const defaultPolicies = 'Garder le calme et le respect des autres clients. Pas d\'animaux domestiques. Respecter les horaires d\'ouverture et de fermeture.'
const openings = "{\"Monday\":{\"opening\":\"09:00\",\"closing\":\"18:00\"},\"Tuesday\":{\"opening\":\"09:00\",\"closing\":\"18:00\"},\"Wednesday\":{\"opening\":\"09:00\",\"closing\":\"18:00\"},\"Thursday\":{\"opening\":\"09:00\",\"closing\":\"18:00\"},\"Friday\":{\"opening\":\"09:00\",\"closing\":\"18:00\"},\"Saturday\":{\"opening\":\"09:00\",\"closing\":\"18:00\"},\"Sunday\":{\"opening\":\"09:00\",\"closing\":\"18:00\"}}"
const defaultCapacity = 100
const defaultPaymentMethods = ['Espèces', 'Mobile Money', 'Carte Bancaire','SmallPay']

export default class extends BaseSeeder {
  public async run() {
    const rawData = fs.readFileSync('./data/data-modes-et-beaute_lat_lon_uploaded.json', 'utf-8')
    const services = JSON.parse(rawData)

    const adminEmail = 'beautyandmodes@monapp.cm'
    let admin = await User.findBy('email', adminEmail)

    if (!admin) {
      admin = await User.create({
        first_name: 'beauty_admin',
        last_name: 'Admin',
        password: 'admin123',
        email: adminEmail,
        phone_number: '000000000',
        address: 'Odza',
        last_login: null,
        two_factor_enabled: false,
        role_id: 2,
        status: 'active',
        created_by: 1,
        last_modified_by: 1,
      })
      console.log('✅ Utilisateur admin créé')
    } else {
      console.log(' Utilisateur admin déjà existant')
    }


    const chunkSize = 100
    for (let i = 0; i < services.length; i += chunkSize) {
      const chunk = services.slice(i, i + chunkSize)
      const serviceRecords = chunk.map((data:any) => ({
        name: data.nom,
        description: data.description,
        category_id: 5,
        email_service: data.email_service || null,
        website: data.website || null,
        openings: openings || null,
        price_range: data.price_range  || null,
        price: data.prix || null,
        facilities: JSON.stringify(defaultFacilities),
        policies: defaultPolicies,
        capacity: defaultCapacity,
        payment_methods: JSON.stringify(defaultPaymentMethods),
        logo: data.cover || null,
        address_service: JSON.stringify(data.address_service),
        phone_number_service: data.phone_number_service || null,
        average_rating: null,
        review_count: null,
        images: JSON.stringify(data.images || []),
        status_service: 'active',
        created_by: admin.id,
        last_modified_by: admin.id,

      }))

      await Service.createMany(serviceRecords)
      console.log(`✅ Importé: ${i + chunk.length} / ${services.length}`)
    }
  }
}
