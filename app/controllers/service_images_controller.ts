
import CrudController from '#controllers/crud_controller'
import CrudService from '#services/crud_service'
import ServiceImage from '#models/service_image'
//import type { HttpContext } from '@adonisjs/core/http'

const imageService = new CrudService(ServiceImage)

export default class ServiceImagesController extends CrudController<typeof ServiceImage> {
  constructor() {
    super(imageService)
  }
}
