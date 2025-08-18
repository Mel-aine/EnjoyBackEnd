import type { HttpContext } from '@adonisjs/core/http'

export default class ProductServicesController {
  /**
   * Display a list of resource
   */
  async index({}: HttpContext) {
    // TODO: Implement index method
    return { message: 'ProductServices index method' }
  }

  /**
   * Display the specified resource
   */
  async show({ params }: HttpContext) {
    // TODO: Implement show method
    return { message: `ProductServices show method for ID: ${params.id}` }
  }

  /**
   * Handle form submission for the create action
   */
  async store({ request }: HttpContext) {
    // TODO: Implement store method
    return { message: 'ProductServices store method', data: request.all() }
  }

  /**
   * Handle form submission for the edit action
   */
  async update({ params, request }: HttpContext) {
    // TODO: Implement update method
    return { message: `ProductServices update method for ID: ${params.id}`, data: request.all() }
  }

  /**
   * Delete record
   */
  async destroy({ params }: HttpContext) {
    // TODO: Implement destroy method
    return { message: `ProductServices destroy method for ID: ${params.id}` }
  }
}