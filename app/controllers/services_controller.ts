import CrudController from '#controllers/crud_controller'
import CrudService from '#services/crud_service'
import User from '#models/user'
import Service from '#models/service'
import type { HttpContext } from '@adonisjs/core/http'
import ServiceUserAssignment from '#models/service_user_assignment'
import LoggerService from '#services/logger_service'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'

export default class ServicesController extends CrudController<typeof Service> {
  private userService: CrudService<typeof User>
  private serviceService: CrudService<typeof Service>

  constructor() {
    super(new CrudService(Service))
    this.userService = new CrudService(User)
    this.serviceService = new CrudService(Service)
  }

  //recuperer les services avec leurs services product et option
  public async getServicesWithProductsAndOptions({ request, params, response }: HttpContext) {
    try {
      const categoryId = params.categoryId || request.qs().categoryId
      const serviceId = request.qs().serviceId

      const query = Service.query()
        .preload('products', (productQuery: any) => {
          productQuery.preload('options', (optionQuery: any) => {
            optionQuery.preload('option', (opt: any) => {
              opt.select(['id', 'option_name'])
            })
          })
        })

      if (categoryId) {
        const categoryIdNum = parseInt(categoryId, 10)
        if (isNaN(categoryIdNum)) {
          return response.badRequest({ message: 'Invalid categoryId' })
        }
        query.where('category_id', categoryIdNum)
      }

      if (serviceId) {
        query.where('id', serviceId)
      }

      const services = await query

      if (!services || services.length === 0) {
        return response.notFound({ message: 'Aucun service trouvé' })
      }

      const formatted = services.map(service => ({
        ...service.serialize(),
        products: service.products.map(product => ({
          ...product.serialize(),
          options: product.options.map(opt => ({
            optionId: opt.option_id,
            optionName: opt.option?.option_name,
            value: opt.value,
          })),
        }))
      }))

      return response.ok(formatted)

    } catch (error) {
      return response.internalServerError({
        message: 'Erreur lors de la récupération des services',
        error: error.message,
      })
    }
  }



  public async createWithUserAndService(ctx: HttpContext) {
    const { request, response } = ctx
    const data = request.body()

    logger.info('Body' + JSON.stringify(data))
    const trx = await db.transaction()
    try {

      const existingUser = await this.userService.findByEmail(data.email);


      let user
      if (existingUser) {
        user = existingUser
      } else {
        user = await this.userService.create({
          first_name: data.first_name,
          last_name: data.last_name,
          password: data.password,
          email: data.email,
          phone_number: data.phone_number,
          address: data.address || null,
          last_login: data.last_login || null,
          two_factor_enabled: data.two_factor_enabled || null,
          role_id: data.role_id || 2,
          status: 'active',
          created_by: data.created_by || null,
          last_modified_by: data.last_modified_by || null,
        })
        Service
        await LoggerService.log({
          actorId: user.id,
          action: 'CREATE',
          entityType: 'User',
          entityId: user.id.toString(),
          description: `Nouvel utilisateur créé avec l'email ${user.email}`,
          ctx: ctx,
        })
      }
      const services = await Service.findBy('id', parseInt(`${data.id}`));
      let newService;
      if (services && services.id) {
        newService = services;
        newService.name = data.name;
        newService.description = data.description;
        newService.email_service = data.email_service;
        newService.website = data.website;
        newService.openings = data.openings;
        newService.price_range = data.price_range;
        newService.facilities = data.facilities;
        newService.policies = data.policies;
        newService.capacity = data.capacity;
        newService.payment_methods = data.payment_methods;
        newService.logo = data.logo || null;
        newService.address_service = data.address_service;
        newService.phone_number_service = data.phone_number_service || null;
        newService.average_rating = data.average_rating || null;
        newService.review_count = data.review_count || null;
        newService.images = data.images || null;
        newService.status_service = 'active';
        newService.created_by = user.id;
        newService.last_modified_by = user.id;
      } else {
        newService = await this.serviceService.create({
          name: data.name,
          description: data.description,
          category_id: data.category_id,
          email_service: data.email_service,
          website: data.website,
          openings: data.openings,
          price_range: data.price_range,
          facilities: data.facilities,
          policies: data.policies,
          capacity: data.capacity,
          payment_methods: data.payment_methods,
          logo: data.logo || null,
          address_service: data.address_service,
          phone_number_service: data.phone_number_service || null,
          average_rating: data.average_rating || null,
          review_count: data.review_count || null,
          images: data.images || null,
          status_service: data.status_service || 'active',
          created_by: user.id,
          last_modified_by: data.last_modified_by || null,

        })
      }

      await ServiceUserAssignment.create({
        user_id: user.id,
        service_id: newService.id,
        role: 'admin',
      })
      await LoggerService.log({
        actorId: user.id,
        action: 'CREATE',
        entityType: 'Service',
        entityId: newService.id.toString(),
        description: `Service #${newService.id} créé par l'utilisateur ${user.email}`,
        ctx: ctx,
      })

      return response.created({ service: newService, user })
    } catch (error) {
      trx.rollback()
      return response.status(500).send({
        message: 'Error while creating service and/or user',
        error: error.message,
      })
    }
  }

  /**
    * Find all services where the name contains the given text (case-insensitive).
    * Query param: ?q=searchText
    */
  public async searchByName({ request, response }: HttpContext) {
    const searchText = request.input('q') || request.qs().q

    if (!searchText || typeof searchText !== 'string') {
      return response.badRequest({ message: 'Search text (q) is required' })
    }

    try {
      const services = await Service
        .query()
        .whereILike('name', `%${searchText}%`)

      return response.ok(services)
    } catch (error) {
      return response.internalServerError({
        message: 'Erreur lors de la recherche des services',
        error: error.message,
      })
    }
  }

  /*Customer*/
  public async customers({ params }: HttpContext) {
    const serviceId = params.serviceId

    const customers = await User.query().where('role_id', 4)
      .andWhere('created_by', serviceId)

      .preload('reservations', (reservationQuery) => {
        reservationQuery
          .where('service_id', serviceId)
          .orderBy('createdAt', 'desc')
      })
    const result = customers.map(user => {
      const reservations = user.reservations
      const lastReservation = reservations[0] ?? null
      const countReservations = reservations.length

      return {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone_number: user.phone_number,
        lastReservation,
        countReservations,
      }
    })

    return result
  }


}
