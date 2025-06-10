import type { HttpContext } from '@adonisjs/core/http'

import ServiceProduct from '#models/service_product'
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'
import Service from '#models/service'




const serviceProductService = new CrudService(ServiceProduct)

export default class ServiceProductsController extends CrudController<typeof ServiceProduct> {
  constructor() {
    super(serviceProductService)
  }
  public async getServiceProductAllWithOptions({ request, response }: HttpContext) {
    const serviceId = request.qs().serviceId

    const query = ServiceProduct.query().preload('options')


    if (serviceId) {
      query.where('service_id', serviceId)
    }

    const serviceProducts = await query
    return response.ok(serviceProducts)
  }

public async getAllWithOptions({ request, response }: HttpContext) {
  const serviceId = request.qs().serviceId

  const query = ServiceProduct.query()
    .preload('options', (optionQuery) => {
      optionQuery.preload('option', (opt) => {
        opt.select(['id', 'option_name'])
      })
    })

  if (serviceId) {
    query.where('service_id', serviceId)
  }

  const serviceProducts = await query
  const formatted = serviceProducts.map(product => {
    return {
      ...product.serialize(),
      options: product.options.map(opt => ({
        optionId: opt.option_id,
        optionName: opt.option?.option_name,
        value: opt.value,
      })),
    }
  })

  return response.ok(formatted)
}




  public async adminIndex({ request, response }: HttpContext) {
    const { status, search } = request.qs()

    const query = ServiceProduct.query()

    if (status) {
      query.where('status', status)
    }

    if (search) {
      query.whereILike('product_name', `%${search}%`)
    }

    const rooms = await query.orderBy('id', 'desc')

    return response.ok({ success: true, data: rooms })
  }

  public async setAvailable({ params, response }: HttpContext) {
    const serviceProduct = await ServiceProduct.find(params.id)

    if (!serviceProduct) {
      return response.notFound({ message: 'Service product not found' })
    }

    serviceProduct.status = 'available'
    await serviceProduct.save()

    return response.ok({ success: true, message: 'Room status set to available' })

  }


  public async updateStatus({ params, request, response }: HttpContext) {
    const { status } = request.only(['status'])

    const room = await ServiceProduct.findOrFail(params.id)
    room.status = status
    await room.save()

    return response.ok({
      success: true,
      message: 'Statut mis à jour avec succès',
      data: room,
    })
  }

    private normalize(text: string) {
    return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  }

// public async getAvailable({ request, response }: HttpContext) {
//     const rawAddress = request.qs().address
//     const startDate = request.qs().start_date
//     const endDate = request.qs().end_date
//     const guestCount = Number(request.qs().guest_count || 1)

//     console.log('Address:', rawAddress)
//     console.log('Start date:', startDate)
//     console.log('End date:', endDate)
//     console.log('Guest count:', guestCount)

//     if (!startDate || !endDate || !rawAddress) {
//       return response.badRequest({ message: 'start_date, end_date and address are required' })
//     }

//     const address = this.normalize(rawAddress)

//     try {
//       // 1. Filter services with category_id = 14 (Hotels)
//       const allServices = await Service.query().where('category_id', 14)

//       console.log('Total services in category 14:', allServices.length)

//       const matchingServiceIds = allServices
//         .filter((service:any) => {
//           try {
//             const parsed = JSON.parse(service.address_service)
//             const serviceAddress = this.normalize(parsed.text || '')
//             return serviceAddress.includes(address)
//           } catch {
//             return false
//           }
//         })
//         .map((s) => s.id)

//       console.log('Matching service IDs:', matchingServiceIds)

//       if (matchingServiceIds.length === 0) {
//         return response.ok({ count: 0, serviceProducts: [] })
//       }

//       const serviceProducts = await ServiceProduct.query()
//         .whereIn('service_id', matchingServiceIds)
//         .where('availability', true)
//         .whereHas('availableOptions', (builder) => {
//           builder
//             .where('option_name', 'Maximum Occupancy')
//           .whereRaw("production_options.value ~ '^[0-9]+$' AND CAST(production_options.value AS INTEGER) >= ?", [guestCount])

//         })
//         .whereNotExists((subquery) => {
//           subquery
//             .from('reservation_service_products')
//             .whereRaw('reservation_service_products.service_product_id = service_products.id')
//             .whereRaw('? <= reservation_service_products.end_date', [endDate])
//             .whereRaw('? >= reservation_service_products.start_date', [startDate])
//         })
//         .preload('service')

//       const filtered = serviceProducts.filter(p => p.service !== null)

//       console.log('Filtered products count:', filtered.length)

//       return response.ok({
//         count: filtered.length,
//         serviceProducts: filtered,
//       })
//     } catch (error) {
//       console.error('Query error:', error)
//       return response.status(500).send({ message: 'Internal Server Error', error: error.message })
//     }
//   }


//la fonction get available
// public async getAvailable({ request, response }: HttpContext) {
//   const rawAddress = request.qs().address
//   const startDate = request.qs().start_date
//   const endDate = request.qs().end_date
//   const guestCount = Number(request.qs().guest_count || 1)

//   console.log('Address:', rawAddress)
//   console.log('Start date:', startDate)
//   console.log('End date:', endDate)
//   console.log('Guest count:', guestCount)

//   if (!startDate || !endDate || !rawAddress) {
//     return response.badRequest({ message: 'start_date, end_date and address are required' })
//   }

//   const address = this.normalize(rawAddress)

//   try {
//     const allServices = await Service.query().where('category_id', 14)

//     console.log('Total services in category 14:', allServices.length)

//     const matchingServiceIds = allServices
//       .filter((service: any) => {
//         try {
//           const parsed = JSON.parse(service.address_service)
//           const serviceAddress = this.normalize(parsed.text || '')
//           return serviceAddress.includes(address)
//         } catch {
//           return false
//         }
//       })
//       .map((s) => s.id)

//     console.log('Matching service IDs:', matchingServiceIds)

//     if (matchingServiceIds.length === 0) {
//       return response.ok({ count: 0, serviceProducts: [] })
//     }

//     const serviceProducts = await ServiceProduct.query()
//       .whereIn('service_id', matchingServiceIds)
//       .whereHas('availableOptions', (builder) => {
//         builder
//           .where('option_name', 'Maximum Occupancy')
//           .whereRaw("production_options.value ~ '^[0-9]+$' AND CAST(production_options.value AS INTEGER) >= ?", [guestCount])
//       })
//       .whereNotExists((subquery) => {
//         subquery
//           .from('reservation_service_products')
//           .whereRaw('reservation_service_products.service_product_id = service_products.id')
//           .whereRaw('? <= reservation_service_products.end_date', [endDate])
//           .whereRaw('? >= reservation_service_products.start_date', [startDate])
//       })
//       .preload('service')
//       .preload('options', (optionQuery) => {
//         optionQuery.preload('option', (opt) => {
//           opt.select(['id', 'option_name'])
//         })
//       })

//     const filtered = serviceProducts.filter(p => p.service !== null)

//     const formatted = filtered.map(product => {
//       return {
//         ...product.serialize(),
//         options: product.options.map(opt => ({
//           optionId: opt.option_id,
//           optionName: opt.option?.option_name,
//           value: opt.value,
//         })),
//       }
//     })

//     return response.ok({
//       count: formatted.length,
//       serviceProducts: formatted,
//     })
//   } catch (error) {
//     console.error('Query error:', error)
//     return response.status(500).send({ message: 'Internal Server Error', error: error.message })
//   }
// }


private toJSDateSafe(dateValue: any): Date | null {
  if (!dateValue) return null

  if (typeof dateValue === 'string') {
    const parsed = new Date(dateValue + 'T00:00:00Z')
    return isNaN(parsed.getTime()) ? null : parsed
  }

  if (typeof dateValue.toJSDate === 'function') {
    return dateValue.toJSDate()
  }

  if (dateValue instanceof Date) {
    return dateValue
  }

  return null
}



public async getAvailable({ request, response }: HttpContext) {
  const rawAddress = request.qs().address
  const startDate = request.qs().start_date
  const endDate = request.qs().end_date
  const guestCount = Number(request.qs().guest_count || 1)

  if (!startDate || !endDate || !rawAddress) {
    return response.badRequest({ message: 'start_date, end_date and address are required' })
  }

  const address = this.normalize(rawAddress)

  try {
    // 1. Récupérer les services hôtels correspondant à l'adresse
    const allServices = await Service.query().where('category_id', 14)
    const matchingServiceIds = allServices
      .filter((service: any) => {
        try {
          const parsed = JSON.parse(service.address_service)
          const serviceAddress = this.normalize(parsed.text || '')
          return serviceAddress.includes(address)
        } catch {
          return false
        }
      })
      .map((s) => s.id)

    if (matchingServiceIds.length === 0) {
      return response.ok({ count: 0, serviceProducts: [], partiallyAvailable: [] })
    }

    // 2. Chambres totalement disponibles (pas de réservation qui chevauche la période)
    const serviceProducts = await ServiceProduct.query()
      .whereIn('service_id', matchingServiceIds)
      .whereHas('availableOptions', (builder) => {
        builder
          .where('option_name', 'Maximum Occupancy')
          .whereRaw("production_options.value ~ '^[0-9]+$' AND CAST(production_options.value AS INTEGER) >= ?", [guestCount])
      })
      .whereNotExists((subquery) => {
        subquery
          .from('reservation_service_products')
          .whereRaw('reservation_service_products.service_product_id = service_products.id')
          // Condition corrigée pour exclure les réservations qui chevauchent la période
          .whereRaw('NOT (end_date < ? OR start_date > ?)', [startDate, endDate])
      })
      .preload('service')
      .preload('options', (optionQuery) => {
        optionQuery.preload('option', (opt) => {
          opt.select(['id', 'option_name'])
        })
      })

    const availableFormatted = serviceProducts
      .filter(p => p.service !== null)
      .map(product => ({
        ...product.serialize(),
        options: product.options.map(opt => ({
          optionId: opt.option_id,
          optionName: opt.option?.option_name,
          value: opt.value,
        })),
      }))

    // 3. Chambres occupées partiellement (avec réservation chevauchant la période)
    const partiallyOccupied = await ServiceProduct.query()
      .whereIn('service_id', matchingServiceIds)
      .whereHas('availableOptions', (builder) => {
        builder
          .where('option_name', 'Maximum Occupancy')
          .whereRaw("production_options.value ~ '^[0-9]+$' AND CAST(production_options.value AS INTEGER) >= ?", [guestCount])
      })
      .whereExists((subquery) => {
        subquery
          .from('reservation_service_products')
          .whereRaw('reservation_service_products.service_product_id = service_products.id')

          .whereRaw('NOT (end_date < ? OR start_date > ?)', [startDate, endDate])
      })
      .preload('service')
      .preload('reservations', (resQuery) => {
        resQuery
          .whereRaw('NOT (end_date < ? OR start_date > ?)', [startDate, endDate])
          .orderBy('end_date', 'desc')
          .limit(1)
      })

      const partiallyAvailable = partiallyOccupied.map(product => {
        const lastRes = product.reservations[0]

        let availableFrom: string | null = null

        const jsDate = this.toJSDateSafe(lastRes?.arrived_date)

        if (jsDate) {
          const nextDay = new Date(jsDate.getTime() + 24 * 60 * 60 * 1000)
          availableFrom = nextDay.toISOString().split('T')[0]
        }

        return {
          serviceProductId: product.id,
          availableFrom,
          service: product.service?.serialize(),
        }
      })



    return response.ok({
      count: availableFormatted.length,
      serviceProducts: availableFormatted,
      partiallyAvailable,
    })
  } catch (error) {
    console.error('Query error:', error)
    return response.status(500).send({ message: 'Internal Server Error', error: error.message })
  }
}




}


//   public async getAvailableServiceProducts({ request, response }: HttpContext) {
//   const {
//     address,
//     start_date: startDate,
//     end_date: endDate,
//     guest_count: guestCount = 1,
//   } = request.qs()

//   // Validation des paramètres obligatoires
//   if (!startDate || !endDate || (!address && (!latitude || !longitude))) {
//     return response.badRequest({
//       message: 'start_date, end_date, and (address or coordinates) are required',
//     })
//   }

//   try {
//     // 1. Construction de la requête principale avec filtres
//     let query = ServiceProduct.query()
//       .where('availability', true)
//       .where('status', 'active')

//     // 2. Filtre par capacité d'invités
//     const serviceProductIds = await Database
//       .from('production_options')
//       .join('options', 'production_options.option_id', '=', 'options.id')
//       .where('options.name', 'guest_count')
//       .andWhereRaw('CAST(production_options.value AS INTEGER) >= ?', [Number(guestCount)])
//       .select('production_options.service_product_id')

//     const matchingIds = serviceProductIds.map(row => row.service_product_id)

//     if (matchingIds.length === 0) {
//       return response.ok({
//         count: 0,
//         totalPages: 0,
//         currentPage: page,
//         serviceProducts: [],
//         filters: this.getAvailableFilters()
//       })
//     }

//     query = query.whereIn('id', matchingIds)

//     // 3. Filtre par disponibilité (pas de réservations conflictuelles)
//     query = query.whereNotExists((subquery) => {
//       subquery
//         .from('reservation_service_products')
//         .whereRaw('reservation_service_products.service_product_id = service_products.id')
//         .where('status', '!=', 'cancelled')
//         .whereRaw('? < reservation_service_products.end_date', [endDate])
//         .whereRaw('? > reservation_service_products.start_date', [startDate])
//     })

//     // 4. Filtre par prix
//     if (min_price) {
//       query = query.where('price', '>=', Number(min_price))
//     }
//     if (max_price) {
//       query = query.where('price', '<=', Number(max_price))
//     }

//     // 5. Filtre par type de service
//     if (service_type) {
//       query = query.whereHas('service', (serviceQuery) => {
//         serviceQuery.where('type', service_type)
//       })
//     }

//     // 6. Filtre par note minimale
//     if (rating_min) {
//       query = query.where('average_rating', '>=', Number(rating_min))
//     }

//     // 7. Filtre par amenities/équipements
//     if (amenities && Array.isArray(amenities)) {
//       query = query.whereHas('availableOptions', (optionQuery) => {
//         optionQuery.whereIn('name', amenities)
//       })
//     }

//     // 8. Filtre géographique
//     if (latitude && longitude) {
//       // Recherche par coordonnées avec rayon
//       query = query.preload('service', (serviceQuery) => {
//         serviceQuery.whereRaw(`
//           ST_DWithin(
//             ST_GeogFromText('POINT(' || address->>'longitude' || ' ' || address->>'latitude' || ')'),
//             ST_GeogFromText('POINT(? ?)'),
//             ?
//           )
//         `, [longitude, latitude, radius * 1000]) // rayon en mètres
//       })
//     } else if (address) {
//       // Recherche par adresse textuelle
//       query = query.preload('service', (serviceQuery) => {
//         serviceQuery.whereRaw(`
//           LOWER(address->>'text') LIKE ? OR
//           LOWER(address->>'city') LIKE ? OR
//           LOWER(address->>'region') LIKE ?
//         `, [
//           `%${address.toLowerCase()}%`,
//           `%${address.toLowerCase()}%`,
//           `%${address.toLowerCase()}%`
//         ])
//       })
//     }

//     // 9. Tri des résultats
//     switch (sort_by) {
//       case 'price_low':
//         query = query.orderBy('price', 'asc')
//         break
//       case 'price_high':
//         query = query.orderBy('price', 'desc')
//         break
//       case 'rating':
//         query = query.orderBy('average_rating', 'desc')
//         break
//       case 'distance':
//         if (latitude && longitude) {
//           query = query.orderByRaw(`
//             ST_Distance(
//               ST_GeogFromText('POINT(' || services.address->>'longitude' || ' ' || services.address->>'latitude' || ')'),
//               ST_GeogFromText('POINT(? ?)')
//             )
//           `, [longitude, latitude])
//         }
//         break
//       case 'newest':
//         query = query.orderBy('created_at', 'desc')
//         break
//       case 'popularity':
//         query = query.orderBy('booking_count', 'desc')
//         break
//       default: // relevance
//         query = query.orderBy([
//           { column: 'is_featured', order: 'desc' },
//           { column: 'average_rating', order: 'desc' },
//           { column: 'booking_count', order: 'desc' }
//         ])
//     }

//     // 10. Préchargement des relations
//     query = query
//       .preload('availableOptions')
//       .preload('images', (imageQuery) => {
//         imageQuery.orderBy('is_main', 'desc').limit(5)
//       })
//       .preload('service', (serviceQuery) => {
//         serviceQuery.select([
//           'id', 'name', 'address', 'type', 'description',
//           'average_rating', 'review_count'
//         ])
//       })
//       .preload('reviews', (reviewQuery) => {
//         reviewQuery
//           .where('status', 'approved')
//           .orderBy('created_at', 'desc')
//           .limit(3)
//           .preload('user', (userQuery) => {
//             userQuery.select(['id', 'name', 'avatar'])
//           })
//       })

//     // 11. Pagination
//     const offset = (Number(page) - 1) * Number(limit)
//     const totalCount = await query.clone().clearOrder().count('* as total')
//     const total = totalCount[0].$extras.total

//     const serviceProducts = await query
//       .offset(offset)
//       .limit(Number(limit))

//     // 12. Filtrer ceux qui n'ont pas de service valide
//     const validProducts = serviceProducts.filter(sp => sp.service !== null)

//     // 13. Enrichir les données avec des calculs supplémentaires
//     const enrichedProducts = await Promise.all(
//       validProducts.map(async (product) => {
//         // Calculer la distance si coordonnées fournies
//         let distance = null
//         if (latitude && longitude && product.service?.address) {
//           const serviceCoords = product.service.address
//           if (serviceCoords.latitude && serviceCoords.longitude) {
//             distance = this.calculateDistance(
//               Number(latitude), Number(longitude),
//               Number(serviceCoords.latitude), Number(serviceCoords.longitude)
//             )
//           }
//         }

//         // Calculer le prix total pour la période
//         const nights = Math.ceil(
//           (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
//         )
//         const totalPrice = product.price * nights * Number(guestCount)

//         return {
//           ...product.toJSON(),
//           distance,
//           totalPrice,
//           pricePerNight: product.price,
//           nights,
//           availabilityStatus: 'available'
//         }
//       })
//     )

//     // 14. Obtenir les filtres disponibles pour l'interface
//     const availableFilters = await this.getAvailableFilters(matchingIds)

//     return response.ok({
//       count: validProducts.length,
//       total,
//       totalPages: Math.ceil(total / Number(limit)),
//       currentPage: Number(page),
//       hasNextPage: Number(page) * Number(limit) < total,
//       hasPrevPage: Number(page) > 1,
//       serviceProducts: enrichedProducts,
//       filters: availableFilters,
//       searchParams: {
//         address,
//         startDate,
//         endDate,
//         guestCount: Number(guestCount),
//         sortBy: sort_by
//       }
//     })

//   } catch (error) {
//     Logger.error('Error in getAvailableServiceProducts:', error)
//     return response.internalServerError({
//       message: 'An error occurred while searching for services'
//     })
//   }
// }

// Méthode helper pour calculer la distance
// private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
//   const R = 6371 // Rayon de la Terre en km
//   const dLat = this.deg2rad(lat2 - lat1)
//   const dLon = this.deg2rad(lon2 - lon1)
//   const a =
//     Math.sin(dLat/2) * Math.sin(dLat/2) +
//     Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
//     Math.sin(dLon/2) * Math.sin(dLon/2)
//   const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
//   return Math.round(R * c * 10) / 10 // Arrondi à 1 décimale
// }

// private deg2rad(deg: number): number {
//   return deg * (Math.PI/180)
// }

// // Méthode pour obtenir les filtres disponibles
// private async getAvailableFilters(serviceProductIds?: number[]) {
//   const baseQuery = serviceProductIds
//     ? Database.from('service_products').whereIn('id', serviceProductIds)
//     : Database.from('service_products').where('availability', true)

//   const [priceRange, serviceTypes, amenities, ratings] = await Promise.all([
//     // Gamme de prix
//     baseQuery.clone()
//       .min('price as min_price')
//       .max('price as max_price'),

//     // Types de services
//     Database.from('services')
//       .join('service_products', 'services.id', '=', 'service_products.service_id')
//       .whereIn('service_products.id', serviceProductIds || [])
//       .groupBy('services.type')
//       .select('services.type')
//       .count('* as count'),

//     // Équipements disponibles
//     Database.from('options')
//       .join('production_options', 'options.id', '=', 'production_options.option_id')
//       .whereIn('production_options.service_product_id', serviceProductIds || [])
//       .where('options.type', 'amenity')
//       .groupBy('options.name', 'options.display_name')
//       .select('options.name', 'options.display_name')
//       .count('* as count'),

//     // Distribution des notes
//     baseQuery.clone()
//       .whereNotNull('average_rating')
//       .select(
//         Database.raw('FLOOR(average_rating) as rating'),
//         Database.raw('COUNT(*) as count')
//       )
//       .groupBy(Database.raw('FLOOR(average_rating)'))
//   ])

//   return {
//     priceRange: priceRange[0] || { min_price: 0, max_price: 1000 },
//     serviceTypes,
//     amenities,
//     ratings
//   }
// }



