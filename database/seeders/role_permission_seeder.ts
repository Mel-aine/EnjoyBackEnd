import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Role from '#models/role'
import Permission from '#models/permission'
import RolePermission from '#models/role_permission'
import Hotel from '../../app/models/hotel.js'

export default class extends BaseSeeder {
  public async run() {
    const serviceId = 5974

    // Vérifier que le service existe
    const service = await Hotel.find(serviceId)
    if (!service) {
      console.error(`❌ Service avec ID ${serviceId} introuvable.`)
      return
    }

    // Trouver ou créer le rôle admin
    const adminRole = await Role.firstOrCreate({ roleName: 'admin' })

    // Récupérer toutes les permissions existantes
    const allPermissions = await Permission.all()

    for (const permission of allPermissions) {
      // Vérifier si l'association existe déjà
      const exists = await RolePermission.query()
        .where('role_id', adminRole.id)
        .andWhere('permission_id', permission.id)
        .andWhere('service_id', serviceId)
        .first()

      if (!exists) {
        await RolePermission.create({
          role_id: adminRole.id,
          permission_id: permission.id,
          hotel_id: serviceId,
        })
      }
    }

    console.log(`✅ Rôle admin : permissions associées au service ${serviceId}`)
  }
}
