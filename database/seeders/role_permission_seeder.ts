import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Role from '#models/role'
import Permission from '#models/permission'
import RolePermission from '#models/role_permission'

export default class extends BaseSeeder {
  public async run() {
    const rolesPermissions = {
      'admin': {
        dashboard_view: true,
        bookings_view: true,
        rooms_manage: true,
        rooms_occupancy_view: true,
        calendar_view: true,
        departments_view: true,
        inventory_view: true,
        inventory_history_view: true,
        inventory_category_view: true,
        suppliers_view: true,
        expenses_view: true,
        customers_view: true,
        staff_view: true,
        staff_dashboard_view: true,
        staff_manage: true,
        permissions_manage: true,
        task_manage: true,
        schedule_manage: true,
        staff_history_view: true,
      }
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
