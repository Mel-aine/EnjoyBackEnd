import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Service from '#models/service'
import ServiceProduct from '#models/service_product'
import Option from '#models/option'
import ProductionOption from '#models/production_option'

// function getRandomArrayElement<T>(arr: T[]): T {
//   return arr[Math.floor(Math.random() * arr.length)]
// }

// export default class extends BaseSeeder {
//   public async run() {
//     function formatRoomNumber(num: number): string {
//       return num.toString().padStart(3, '0')
//     }

//     function getRandomPrice(min: number, max: number, step: number): number {
//       const range = Math.floor((max - min) / step) + 1
//       return min + step * Math.floor(Math.random() * range)
//     }

//     const services = await Service.query().where('category_id', 14)

//     const options = await Option.all()

//     for (const service of services) {
//       // Entre 3 et 5 chambres par hôtel
//       const numberOfRooms = Math.floor(Math.random() * 3) + 3

//       for (let i = 0; i < numberOfRooms; i++) {
//         const roomNumberStr = formatRoomNumber(i + 1)
//         const room = await ServiceProduct.create({
//           service_id: service.id,
//           product_name: `Room ${roomNumberStr}`,
//           product_type: 'room',
//           price: getRandomPrice(10000, 20000, 500),
//           description: `Room number ${i + 1} at hotel ${service.name}`,
//           availability: true,
//           customization_allowed: Math.random() > 0.5,
//           payment_type: 'Deferred',
//           status: 'available',
//           created_by: 134,
//           last_modified_by: null,
//         })

//         for (const option of options) {
//           const possibleValues = option.values

//           const randomValue =
//             possibleValues.length > 0 ? getRandomArrayElement(possibleValues) : 'default'

//           await ProductionOption.create({
//             service_product_id: room.id,
//             option_id: option.id,
//             option_price: getRandomPrice(500, 3000, 100),
//             option_type: option.type,
//             value: randomValue,
//             created_by: 134,
//             last_modified_by: null,
//           })
//         }
//       }
//     }
//   }
// }
export default class extends BaseSeeder {
  public async run() {
    function formatRoomNumber(num: number): string {
      return num.toString().padStart(3, '1')
    }

    function getRandomPrice(min: number, max: number, step: number): number {
      const range = Math.floor((max - min) / step) + 1
      return min + step * Math.floor(Math.random() * range)
    }

    function getRandomArrayElement<T>(arr: T[]): T {
      return arr[Math.floor(Math.random() * arr.length)]
    }

    const services = await Service.query()
      .where('category_id', 14)
      .andWhere('id', '>=', 607)

    const options = await Option.all()

    console.log(`Seeding ${services.length} services (ID >= 607)...`)

    for (const service of services) {
      const numberOfRooms = Math.floor(Math.random() * 3) + 3

      const rooms = await Promise.all(
        Array.from({ length: numberOfRooms }, async (_, i) => {
          const roomNumberStr = formatRoomNumber(i + 1)

          return await ServiceProduct.create({
            service_id: service.id,
            product_name: `Room ${roomNumberStr}`,
            product_type_id: 1,
            price: getRandomPrice(10000, 20000, 500),
            description: `Room number ${i + 1} at hotel ${service.name}`,
            availability: true,
            customization_allowed: Math.random() > 0.5,
            payment_type: 'Deferred',
            status: 'available',
            created_by: 134,
            last_modified_by: null,
          })
        })
      )

      for (const room of rooms) {
        await Promise.all(
          options.map(async (option) => {
            const possibleValues = option.values
            const randomValue =
              possibleValues.length > 0
                ? getRandomArrayElement(possibleValues)
                : 'default'

            await ProductionOption.create({
              service_product_id: room.id,
              option_id: option.id,
              option_price: getRandomPrice(500, 3000, 100),
              option_type: option.type,
              value: randomValue,
              created_by: 134,
              last_modified_by: null,
            })
          })
        )
      }
    }

    console.log('✅ Service products and options seeded with parallel inserts.')
  }
}

