import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Role from '#models/role'
import Permission from '#models/permission'
import RolePermission from '#models/role_permission'

export default class extends BaseSeeder {
  public async run() {
    const rolesPermissions = {
      'admin': {
        bookings_read: true,
        inventory_update: true,
        bookings_create: true,
        room_service_request: true,
        menu_manage: true,
        maintenance_request_create: true,
        rooms_create: true,
        reports_export: true,
        users_update: true,
        rooms_delete: true,
        maintenance_request_manage: true,
        inventory_read: true,
        users_create: true,
        budget_view: true,
        users_read: true,
        rooms_read: true,
        reports_view: true,
        rooms_update: true,
        settings_manage: true,
        budget_edit: true,
        users_delete: true,
        bookings_update: true,
        bookings_delete: true,
        promotions_manage: true,
        billing_manage: true,
        menu_view: true,
      },
      'general manager': {
        users_read: true,
        users_update: true,
        rooms_create: true,
        rooms_read: true,
        rooms_update: true,
        bookings_create: true,
        bookings_read: true,
        bookings_update: true,
        bookings_delete: true,
        reports_view: true,
        inventory_read: true,
        maintenance_request_manage: true,
      },
    }

    for (const [roleName, permissions] of Object.entries(rolesPermissions)) {
      const role = await Role.firstOrCreate({ role_name: roleName })

      for (const [permName, isGranted] of Object.entries(permissions)) {
        if (!isGranted) continue

        const permission = await Permission.firstOrCreate({ name: permName })

        const existing = await RolePermission.query()
          .where('role_id', role.id)
          .andWhere('permission_id', permission.id)
          .first()

        if (!existing) {
          await RolePermission.create({
            role_id: role.id,
            permission_id: permission.id,
          })
        }
      }
    }

    console.log('✅ Rôles et permissions associés avec succès.')
  }
}
