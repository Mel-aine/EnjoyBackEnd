// import type { HttpContext } from '@adonisjs/core/http'

// import Service from '#models/service'
// import CrudService from '#services/crud_service'
// import CrudController from './crud_controller.js'

// // import type { HttpContext } from '@adonisjs/core/http'
// const serviceService = new CrudService(Service)

// export default class ServicesController extends CrudController<typeof Service> {
//   constructor() {
//     super(serviceService)
//   }
// }



import CrudController from '#controllers/crud_controller'
import CrudService from '#services/crud_service'
import User from '#models/user'
import Service from '#models/service'
import type { HttpContext } from '@adonisjs/core/http'

export default class ServicesController extends CrudController<typeof Service> {
  private userService: CrudService<typeof User>
  private serviceService: CrudService<typeof Service>

  constructor() {
    super(new CrudService(Service))
    this.userService = new CrudService(User)
    this.serviceService = new CrudService(Service)
  }

  public async createWithUserAndService({ request, response }: HttpContext) {
    const data = request.body()

    try {
      //  Créer le service
      const newService = await this.serviceService.create({
        name: data.name,
        description: data.description,
        category_id: data.category_id,
        address: data.address,
        phone_number: data.phone_number,
        email_service: data.email_service,
        website: data.website,
        openings: data.openings,
        price_range: data.price_range,
        facilities: data.facilities,
        policies: data.policies,
        capacity: data.capacity,
        payment_methods: data.payment_methods,
        logo: data.logo || null,
        images: data.images || null,
        status: data.status || 'active',
        created_by: data.created_by || null,
        last_modified_by: data.last_modified_by || null,
      })

      // Créer l'utilisateur avec le service_id du nouveau service
      const user = await this.userService.create({
        first_name: data.first_name,
        last_name: data.last_name,
        password: data.password,
        service_id: newService.id,
        email: data.email,
        phone_number: data.phone_number,
        role_id: data.role_id || 1,
        status: 'active',
        created_by: data.created_by || null,
        last_modified_by: data.last_modified_by || null,
      })

      return response.created({ service: newService, user })
    } catch (error) {
      return response.status(500).send({
        message: 'Error while creating',
        error: error.message,
      })
    }
  }
}
