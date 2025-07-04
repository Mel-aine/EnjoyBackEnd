
import Permission from '#models/permission';
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'


 const permissionService = new CrudService(Permission)



export default class PermissionsController extends CrudController<typeof Permission> {
  constructor() {
    super(permissionService)
  }
}
