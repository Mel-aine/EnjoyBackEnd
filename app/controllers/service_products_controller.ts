import type { HttpContext } from '@adonisjs/core/http'

import ServiceProduct from '#models/service_product'
import ReservationServiceProduct from '#models/reservation_service_product'
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'
import Service from '#models/service'
import { DateTime } from 'luxon'
import vine from '@vinejs/vine'
import LoggerService from '#services/logger_service'

const serviceProductService = new CrudService(ServiceProduct)

export default class ServiceProductsController extends CrudController<typeof ServiceProduct> {
  constructor() {
    super(serviceProductService)
  }

   /**
   * Recherche les chambres disponibles pour un type, un service et une période donnés.
   * @param {HttpContext} ctx - Le contexte HTTP
   * @returns {Promise<any>}
   *
   * @example
   * GET /available-rooms?serviceId=1&roomTypeId=1&arrivalDate=2024-12-20&departureDate=2024-12-25
   */

  public async findAvailableRooms({ request, response }: HttpContext) {
    const validator = vine.compile(
      vine.object({
        serviceId: vine.number(),
        roomTypeId: vine.number(),
        arrivalDate: vine.date(),
        departureDate: vine.date(),
      })
    )

    try {
      const { serviceId, roomTypeId, arrivalDate, departureDate } = await request.validateUsing(validator, {
        data: request.qs(), // Valider les paramètres de la query string
      })

      // `arrivalDate` and `departureDate` are now JS Date objects.
      // We must use fromJSDate to convert them to Luxon DateTime objects.
      const startDate = DateTime.fromJSDate(arrivalDate)
      const endDate = DateTime.fromJSDate(departureDate)

      if (endDate <= startDate) {
        return response.badRequest({ message: "La date de départ doit être après la date d'arrivée." })
      }

      const availableRooms = await ServiceProduct.query()
        .where('service_id', serviceId)
        .where('product_type_id', roomTypeId)
        .whereIn('status', ['available','booked','dirty']) // On ne cherche que parmi les chambres marquées comme disponibles
        .whereDoesntHave('reservationServiceProducts', (query) => {
          //ajouter pour que si la reservation est annulee ,que la chambre pendant cette periode apparaisse dans la liste
          query.whereNot('status', 'cancelled')
          // Exclure les chambres qui ont une réservation qui chevauche la période demandée.
          // La condition de chevauchement est : (débutRéservation < finDemande) ET (finRéservation > débutDemande)
          query.where('end_date', '>', startDate.toSQLDate()??'').andWhere('start_date', '<', endDate.toSQLDate()??"")
        })

      return response.ok(availableRooms)
    } catch (error) {
      if (error.messages) {
        // Erreur de validation de Vine
        return response.badRequest({ errors: error.messages })
      }
      console.error('Erreur lors de la recherche de chambres disponibles :', error)
      return response.internalServerError({ message: 'Une erreur est survenue lors de la recherche des chambres disponibles.' })
    }
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

    const query = ServiceProduct.query().preload('options', (optionQuery) => {
      optionQuery.preload('option', (opt) => {
        opt.select(['id', 'option_name'])
      })
    })

    if (serviceId) {
      query.where('service_id', serviceId)
    }

    const serviceProducts = await query
    const formatted = serviceProducts.map((product) => {
      return {
        ...product.serialize(),
        options: product.options.map((opt) => ({
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

  public async updateStatus(ctx: HttpContext)  {
    const { params, request, response, auth } = ctx
  const {
    status,
    force = false,
    reason,
    startDate,
    endDate,
    notes,
  } = request.only([
    'status',
    'force',
    'reason',
    'startDate',
    'endDate',
    'notes',
  ])

  const room = await ServiceProduct.findOrFail(params.id)

  if (room.status === status) {
    return response.ok({
      success: true,
      message: `La chambre est déjà dans l'état "${status}".`,
      data: room,
    })
  }

  const isSettingUnavailable = ['maintenance', 'out_of_service', 'out_of_order'].includes(status)

  const ongoingReservation = await ReservationServiceProduct
    .query()
    .where('service_product_id', room.id)
    .whereNull('check_out_date')
    .first()

  if (isSettingUnavailable && ongoingReservation && !force) {
    return response.forbidden({
      success: false,
      message: "La chambre est actuellement occupée. Voulez-vous forcer le changement de statut ?",
    })
  }
   const oldRoomData = room.serialize()
  // Met à jour le statut
  room.status = status

  if (status === 'maintenance') {
    // Ajoute les infos de maintenance si fournies
    room.maintenance = {
      reason: reason || '',
      startDate: startDate || '',
      endDate: endDate || '',
      notes: notes || '',
    }
  } else {
    // Nettoie les infos de maintenance si on sort de maintenance
    room.maintenance = null
  }

  await room.save()

   await LoggerService.log({
    actorId: auth.user!.id,
    action: 'UPDATE',
    entityType: 'ServiceProduct',
    entityId: room.id,
    description: `Change of room status #${room.id} : "${oldRoomData.status}" → "${status}".`,
    changes: LoggerService.extractChanges(oldRoomData, room.serialize()),
    ctx,
  })

  return response.ok({
    success: true,
    message: `Room updated with status "${status}".`,
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
      const accomOption = product.options.find(
        (opt) => opt.option?.option_name === 'Accommodation Type'
      )
      const accomType = accomOption?.value || 'Unknown'

      // Create a signature for the set of options (excluding Accommodation Type)
      const optionSignature =
        product.options
          .filter((opt) => opt.option?.option_name !== 'Accommodation Type')
          .map((opt) => `${opt.option?.option_name}:${opt.value}`)
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
            .filter((opt) => opt.option?.option_name !== 'Accommodation Type')
            .map((opt) => ({
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

            const commonWords = inputWords.filter((word) => serviceWords.includes(word))
            const score = commonWords.length

            if (score > 0) {
              console.log(
                `[4] Match trouvé pour ID ${service.id}, score: ${score}, mots communs:`,
                commonWords
              )
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

      const matchingServiceIds = serviceWithMatchCount.map((item) => item.service.id)
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
            .whereRaw(
              "production_options.value ~ '^[0-9]+$' AND CAST(production_options.value AS INTEGER) >= ?",
              [guestCount]
            )
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
            .whereRaw(
              "production_options.value ~ '^[0-9]+$' AND CAST(production_options.value AS INTEGER) >= ?",
              [guestCount]
            )
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
            relevanceScore:
              serviceWithMatchCount.find((s) => s.service.id === serviceId)?.score || 0,
          })
        }

        const { service: _, ...productData } = product.serialize()

        hotelsMap.get(serviceId).rooms.push({
          ...productData,
          options: product.options.map((opt) => ({
            optionId: opt.option_id,
            optionName: opt.option?.option_name,
            value: opt.value,
          })),
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
            relevanceScore:
              serviceWithMatchCount.find((s) => s.service.id === serviceId)?.score || 0,
          })
        }

        hotelsMap.get(serviceId).partiallyAvailable.push({
          serviceProductId: product.id,
          availableFrom,
        })
      }

      const hotelsFormatted = Array.from(hotelsMap.values())
        .filter((hotel) => hotel.rooms.length > 0 || hotel.partiallyAvailable.length > 0)
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
      .normalize('NFD') // Décompose les caractères accentués
      .replace(/[\u0300-\u036f]/g, '') // Supprime les diacritiques (accents)
      .toLowerCase() // Met tout en minuscule
      .replace(/[^a-z0-9\s]/g, '') // Supprime ponctuation spéciale
      .replace(/\s+/g, ' ') // Remplace les multiples espaces
      .trim()
  }

  // ✅ Fonction pour extraire les mots significatifs d’une adresse
  normalizeToWords(text: string): string[] {
    const ignoredWords = new Set(['cm', 'cmr', 'cameroun']) // Mots à ignorer

    const cleaned = this.removeAccents(text)

    return cleaned
      .split(/\s|,/)
      .map((word) => word.trim())
      .filter((word) => word.length > 1 && !ignoredWords.has(word))
  }

  //delete room

 public async destroyed({ params, response }: HttpContext) {
  const serviceProduct = await ServiceProduct.find(params.id)

  if (!serviceProduct) {
    return response.status(404).json({ message: 'Room not found.' })
  }

  await serviceProduct.load('reservationServiceProducts', (query) => {
    query.preload('reservation')
  })

  const now = DateTime.now()
  const activeStatuses = ['confirmed', 'checked_in']

  const hasActiveReservations = serviceProduct.reservationServiceProducts.some((rsp) => {
    const reservation = rsp.reservation

    return (
      reservation &&
      activeStatuses.includes(reservation.status) &&
      reservation.depart_date &&
      reservation.depart_date >= now
    )
  })

  if (hasActiveReservations) {
    return response.status(400).json({
      message: `Cannot delete room "${serviceProduct.room_number}" because it has active or upcoming reservations.`,
    })
  }

  await serviceProduct.delete()

  return response.status(200).json({ message: 'Room successfully deleted.' })
}

async showWithReservations({ params, response }: HttpContext) {
    const serviceProductId = params.id

    const serviceProduct = await ServiceProduct.query()
      .where('id', serviceProductId)
      .preload('availableOptions', (query) => {
        query.pivotColumns(['value'])
      })
      .preload('productType') // 🏷️ Précharge le type de chambre (roomType)
      .preload('reservationServiceProducts', (query) => {
        query.preload('reservation').preload('creator')
      })
      .first()

    if (!serviceProduct) {
      return response.notFound({ message: 'Chambre non trouvée' })
    }

    // 🎯 Mapping des options
    const options: Record<string, string | boolean> = {}
    for (const option of serviceProduct.availableOptions) {
      const key = `option_${option.id}`
      const value = option.$extras.pivot_value

      options[key] = value === 'true' ? true : value === 'false' ? false : value
    }
    const reservations = serviceProduct.reservationServiceProducts.map((rsp) => {
      return {
        id: rsp.id,
        checkIn: rsp.check_in_date?.toISODate() ?? rsp.start_date.toISODate(),
        checkOut: rsp.check_out_date?.toISODate() ?? rsp.end_date.toISODate(),
        guest: rsp.creator ? `${rsp.creator.first_name} ${rsp.creator.last_name}` : null,
        status: rsp.status ?? 'unknown',
      }
    })
    return response.ok({
      id: serviceProduct.id,
      name: serviceProduct.product_name,
      roomType: serviceProduct.productType?.name ?? null,
      capacity: serviceProduct.capacity,
      floor: serviceProduct.floor,
      room_number: serviceProduct.room_number,
      price: serviceProduct.price,
      status: serviceProduct.status,
      updatedAt: serviceProduct.updatedAt,
      maintenance:serviceProduct.maintenance,
      options,
      reservations,
    })
  }

public async getServiceProductsWithDetails({ params, response }: HttpContext) {
  const { serviceId } = params

  try {
    const serviceProducts = await ServiceProduct.query()
      .where('service_id', serviceId)
      .preload('options')
      .preload('reservationServiceProducts', (query) => {
        query
          .preload('reservation', (reservationQuery) => {
            reservationQuery.select(['id', 'status', 'depart_date'])
          })
          .preload('creator', (creatorQuery) => {
            creatorQuery.select(['id', 'first_name', 'last_name'])
          })
      })

    const detailedProducts = serviceProducts.map((product) => {
      const options = product.options
      const reservations = product.reservationServiceProducts

      const reservationData = reservations.map((rsvp) => ({
        reservation: rsvp.reservation,
        creator: rsvp.creator,
        status: rsvp.status,
      }))

      const checkedInReservation = reservationData.find(
        (r) => r.reservation.status === 'checked-in' || r.reservation.status === 'checked_in'
      )

      const guestName = checkedInReservation?.creator
        ? `${checkedInReservation.creator.first_name || ''} ${checkedInReservation.creator.last_name || ''}`.trim() || null
        : null

     const reservationsWithDepart = reservationData
  .filter((r) => r.reservation.depart_date != null)
  .sort((a, b) => {
    const dateAString = a.reservation.depart_date
      ? typeof a.reservation.depart_date === 'string'
        ? a.reservation.depart_date
        : a.reservation.depart_date.toString()
      : ''

    const dateBString = b.reservation.depart_date
      ? typeof b.reservation.depart_date === 'string'
        ? b.reservation.depart_date
        : b.reservation.depart_date.toString()
      : ''

    const dateA = DateTime.fromISO(dateAString)
    const dateB = DateTime.fromISO(dateBString)

    return dateB.toMillis() - dateA.toMillis()
  })


      const latestDeparture = reservationsWithDepart[0]

      const nextAvailable = latestDeparture?.reservation.depart_date
        ? (typeof latestDeparture.reservation.depart_date === 'string'
            ? latestDeparture.reservation.depart_date
            : latestDeparture.reservation.depart_date.toString())
        : null

      const checkOutTime = nextAvailable

      return {
        ...product.serialize(),
        maintenanceInfo: product.maintenance,
        options: options.map((opt) => opt.serialize()),
        reservations: reservationData,
        guestName,
        nextAvailable,
        checkOutTime,
        status: product.status || 'available',
      }
    })

    return response.ok(detailedProducts)
  } catch (err) {
    console.error('Erreur getServiceProductsWithDetails:', err)
    return response.status(500).json({
      error: 'Erreur serveur',
      message: err instanceof Error ? err.message : 'Erreur inconnue'
    })
  }
}

public async filter({ request, response, params }: HttpContext) {
  try {
    const {
      searchText,
      roomType,
      status,
      floor,
      equipment = []
    } = request.body()

    const service_id = params.id

    const query = ServiceProduct.query()
      .preload('availableOptions')
      .preload('productType')

    if (service_id) {
      query.where('service_id', service_id)
    }

    if (searchText) {
      query.whereRaw('CAST(room_number AS TEXT) ILIKE ?', [`%${searchText}%`])
    }

    if (roomType) {
      query.where('product_type_id', roomType)
    }

    if (floor) {
      query.where('floor', floor)
    }

    if (status) {
      query.where('status', status)
    }

    if (Array.isArray(equipment) && equipment.length > 0) {
      for (const item of equipment) {
        if (!item.label || !item.value) continue

        const [optionName] = item.label.split(':').map((s:any) => s.trim())
        const value = item.value

        query.whereHas('availableOptions', (optionQuery) => {
          optionQuery
            .where('option_name', optionName)
            .wherePivot('value', value)
        })
      }
    }

    const rooms = await query
    return response.ok(rooms)

  } catch (error) {
    console.error('❌ Error filtering rooms:', error)
    return response.status(500).json({
      message: 'Server error',
      error: error.message
    })
  }
}


}
