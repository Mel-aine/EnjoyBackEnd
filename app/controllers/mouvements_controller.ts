
import Mouvement from '#models/mouvement';
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'

// // import type { HttpContext } from '@adonisjs/core/http'
 const mouvementService = new CrudService(Mouvement)



export default class MouvementsController extends CrudController<typeof Mouvement> {
  constructor() {
    super(mouvementService)
  }
}
