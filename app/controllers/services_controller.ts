import CrudController from '#controllers/crud_controller'
import CrudService from '#services/crud_service'
import User from '#models/user'
import Service from '#models/service'
import type { HttpContext } from '@adonisjs/core/http'
import ServiceUserAssignment from '#models/service_user_assignment'

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



 public async createWithUserAndService({ request, response }: HttpContext) {
  const data = request.body()

  try {

    const existingUser = await this.userService.findByEmail(data.email)

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
    }


    const newService = await this.serviceService.create({
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
      created_by: user.id ,
      last_modified_by: data.last_modified_by || null,

    })
    await ServiceUserAssignment.create({
      user_id: user.id,
      service_id: newService.id,
      role: 'admin',
    })
    const RESTO_SERVICE_Id = 1

    if (data.category_id === RESTO_SERVICE_Id) {
      await  this.callAron({
        ...data,
        external_id:user.id,
        service_id: newService.id,
        user_id: user.id,
      })
    }

    return response.created({ service: newService, user })
  } catch (error) {
    return response.status(500).send({
      message: 'Error while creating service and/or user',
      error: error.message,
    })
  }
}

private async callAron(data: any) {
  try {
    const url = 'https://account-resto.arouncloud.workers.dev/api/v1/Auth/Register'
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(this.formatService(data)),
    })

    if (!response.ok) {
      throw new Error(`Aron API error: ${response.statusText}`)
    }

    const result = await response.json()
    console.log('Aron API response:', result)
  } catch (error) {
    console.error('Error calling Aron API:', error.message)
  }
}
private formatService(data: any) {
  return {
    "bussiness": {
        "external_id": data.service_id +""|| "", //!
        "name": data.name, //!
        "description": data.description, //!
        "address_service": data.address_service, //!
        "phone_number_service": data.phone_number_service, //!
        "email_service": data.email_service, //!
        "website": data.website, //?
        "logo": data.logo || '', //!
        "images": data.images || [], //?
        "openings": {
            "Monday": {
                "opening": "09:00", "closing": "18:00"
            },
            "Tuesday": {
                "opening": "09:00", "closing": "18:00"
            },
            "Wednesday": {
                "opening": "09:00", "closing": "18:00"
            },
            "Thursday": {
                "opening": "09:00",  "closing": "18:00"
            },
            "Friday": {
                "opening": "09:00", "closing": "18:00"
            }
        },
        "policies": data.policies,
        "facilities": data.facilities,
        "capacity": data.capacity, //?
        "payment_methods": data.payment_methods || [], //?
    },
    "contact": {
        "external_id": data.service_id,
        "first_name": data.first_name, //!
        "last_name": data.last_name,//!
        "phone_number": data.phone_number,//!
        "email": data.email,//! 
        "address": data.address , //!
    },
    "credentials": {
        "username": data.email,//!
        "password": data.password//!
    }
}

}


}
