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
      message: 'Status update ',
      data: room,
    })
  }



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



  // ...existing code...

  public async getGroupedByAccommodationType({ params, response }: HttpContext) {
    const serviceId = params.serviceId || params.id

    if (!serviceId) {
      return response.badRequest({ message: 'serviceId is required' })
    }

    // Preload options and their details
    const products = await ServiceProduct.query()
      .where('service_id', serviceId)
      .preload('options', (optionQuery) => {
        optionQuery.preload('option', (opt) => {
          opt.select(['id', 'option_name'])
        })
      })
      .preload('service')

    // Grouping logic
    const groups: Record<string, any> = {}

    for (const product of products) {
      // Find accommodation type from options (assuming option_name === 'Accommodation Type')
      const accomOption = product.options.find(opt => opt.option?.option_name === 'Accommodation Type')
      const accomType = accomOption?.value || 'Unknown'

      // Create a signature for the set of options (excluding Accommodation Type)
      const optionSignature = product.options
        .filter(opt => opt.option?.option_name !== 'Accommodation Type')
        .map(opt => `${opt.option?.option_name}:${opt.value}`)
        .sort()
        .join('|') || 'NoOptions'

      // Group by accommodation type first
      if (!groups[accomType]) {
        groups[accomType] = {}
      }
      // Then group by option signature
      if (!groups[accomType][optionSignature]) {
        groups[accomType][optionSignature] = {
          accommodationType: accomType,
          optionSignature,
          options: product.options
            .filter(opt => opt.option?.option_name !== 'Accommodation Type')
            .map(opt => ({
              optionId: opt.option_id,
              optionName: opt.option?.option_name,
              value: opt.value,
            })),
          products: [],
          count: 0,
        }
      }
      groups[accomType][optionSignature].products.push(product.serialize())
      groups[accomType][optionSignature].count += 1
    }

    // Format result as array
    const result = Object.entries(groups).map(([accomType, optionGroups]) => ({
      accommodationType: accomType,
      groups: Object.values(optionGroups),
      count: Object.values(optionGroups).reduce((sum: number, g: any) => sum + g.count, 0),
    }))

    return response.ok(result)
  }

  // ...existing code...


  ///


public async getAvailable({ request, response }: HttpContext) {
  // const rawAddress = request.qs().address
  const rawAddress = Array.isArray(request.qs().address)
  ? request.qs().address.join(' ')
  : request.qs().address

  const startDate = request.qs().start_date
  const endDate = request.qs().end_date
  const guestCount = Number(request.qs().guest_count || 1)

  console.log('[1] Adresse brute :', rawAddress)
  const inputWords = this.normalizeToWords(rawAddress)
  console.log('[2] Mots extraits de l’adresse :', inputWords)

  try {
    const allServices = await Service.query().where('category_id', 14)
    console.log('[3] Total services trouvés:', allServices.length)

    const serviceWithMatchCount = allServices
      .map((service: any) => {
        try {
          const parsed = JSON.parse(service.address_service)
          const serviceWords = this.normalizeToWords(parsed.text || '')

          const commonWords = inputWords.filter(word => serviceWords.includes(word))
          const score = commonWords.length

          if (score > 0) {
            console.log(`[4] Match trouvé pour ID ${service.id}, score: ${score}, mots communs:`, commonWords)
            return { service, score }
          }

          return null
        } catch (err) {
          console.warn(`[4.1] Erreur parsing JSON pour service ID ${service.id}`, err)
          return null
        }
      })
      .filter((item): item is { service: any; score: number } => item !== null)
      .sort((a, b) => b.score - a.score)

    const matchingServiceIds = serviceWithMatchCount.map(item => item.service.id)
    console.log('[5] Services pertinents après filtrage:', matchingServiceIds)

    if (matchingServiceIds.length === 0) {
      console.warn('[5.1] Aucun service pertinent trouvé')
      return response.ok({ count: 0, hotels: [] })
    }

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
          .whereRaw('NOT (end_date < ? OR start_date > ?)', [startDate, endDate])
      })
      .preload('service')
      .preload('options', (optionQuery) => {
        optionQuery.preload('option', (opt) => {
          opt.select(['id', 'option_name'])
        })
      })

    console.log('[6] Produits disponibles:', serviceProducts.length)

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

    console.log('[7] Produits partiellement occupés:', partiallyOccupied.length)

    const hotelsMap = new Map<number, any>()

    for (const product of serviceProducts) {
      const service = product.service!
      const serviceId = service.id

      if (!hotelsMap.has(serviceId)) {
        hotelsMap.set(serviceId, {
          ...service.serialize(),
          rooms: [],
          partiallyAvailable: [],
          relevanceScore: serviceWithMatchCount.find(s => s.service.id === serviceId)?.score || 0
        })
      }

      const { service: _, ...productData } = product.serialize()

      hotelsMap.get(serviceId).rooms.push({
        ...productData,
        options: product.options.map(opt => ({
          optionId: opt.option_id,
          optionName: opt.option?.option_name,
          value: opt.value,
        }))
      })
    }

    for (const product of partiallyOccupied) {
      const service = product.service
      if (!service) continue

      const serviceId = service.id
      const lastRes = product.reservations[0]

      let availableFrom: string | null = null
      const jsDate = this.toJSDateSafe(lastRes?.arrived_date)

      if (jsDate) {
        const nextDay = new Date(jsDate.getTime() + 24 * 60 * 60 * 1000)
        availableFrom = nextDay.toISOString().split('T')[0]
      }

      if (!hotelsMap.has(serviceId)) {
        hotelsMap.set(serviceId, {
          ...product.serialize(),
          rooms: [],
          partiallyAvailable: [],
          relevanceScore: serviceWithMatchCount.find(s => s.service.id === serviceId)?.score || 0
        })
      }

      hotelsMap.get(serviceId).partiallyAvailable.push({
        serviceProductId: product.id,
        availableFrom,
      })
    }

    const hotelsFormatted = Array.from(hotelsMap.values())
      .filter(hotel => hotel.rooms.length > 0 || hotel.partiallyAvailable.length > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)

    console.log('[8] Hôtels formatés (à retourner) :', hotelsFormatted.length)

    return response.ok({
      count: hotelsFormatted.length,
      hotels: hotelsFormatted,
    })
  } catch (error) {
    console.error('[X] ERREUR GÉNÉRALE:', error)
    return response.status(500).send({ message: 'Internal Server Error', error: error.message })
  }
}

// ✅ Fonction pour supprimer les accents et normaliser
removeAccents(text: any): string {
  if (typeof text !== 'string') {
    return ''
  }

  return text
    .normalize('NFD')                    // Décompose les caractères accentués
    .replace(/[\u0300-\u036f]/g, '')     // Supprime les diacritiques (accents)
    .toLowerCase()                       // Met tout en minuscule
    .replace(/[^a-z0-9\s]/g, '')         // Supprime ponctuation spéciale
    .replace(/\s+/g, ' ')                // Remplace les multiples espaces
    .trim()
}

// ✅ Fonction pour extraire les mots significatifs d’une adresse
normalizeToWords(text: string): string[] {
  const ignoredWords = new Set(['cm', 'cmr', 'cameroun']) // Mots à ignorer

  const cleaned = this.removeAccents(text)

  return cleaned
    .split(/\s|,/)
    .map(word => word.trim())
    .filter(word => word.length > 1 && !ignoredWords.has(word))
}



}






