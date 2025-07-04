import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Permission from '#models/permission'

const permissionLabels: Record<string, { label: string; icon: string; category: string }> = {
  bookings_read: { label: 'Consulter les réservations', icon: 'eye', category: 'Réservations' },
  bookings_create: { label: 'Créer des réservations', icon: 'plus', category: 'Réservations' },
  bookings_update: { label: 'Modifier les réservations', icon: 'edit', category: 'Réservations' },
  bookings_delete: { label: 'Supprimer les réservations', icon: 'trash-2', category: 'Réservations' },

  rooms_read: { label: 'Consulter les chambres', icon: 'bed', category: 'Chambres' },
  rooms_create: { label: 'Créer des chambres', icon: 'plus', category: 'Chambres' },
  rooms_update: { label: 'Modifier les chambres', icon: 'edit', category: 'Chambres' },
  rooms_delete: { label: 'Supprimer les chambres', icon: 'trash-2', category: 'Chambres' },

  users_read: { label: 'Consulter les utilisateurs', icon: 'users', category: 'Utilisateurs' },
  users_create: { label: 'Créer des utilisateurs', icon: 'plus', category: 'Utilisateurs' },
  users_update: { label: 'Modifier les utilisateurs', icon: 'edit', category: 'Utilisateurs' },
  users_delete: { label: 'Supprimer les utilisateurs', icon: 'trash-2', category: 'Utilisateurs' },

  inventory_read: { label: "Consulter l'inventaire", icon: 'shopping-cart', category: 'Inventaire' },
  inventory_update: { label: "Modifier l'inventaire", icon: 'edit', category: 'Inventaire' },

  reports_view: { label: 'Consulter les rapports', icon: 'file-text', category: 'Rapports' },
  reports_export: { label: 'Exporter les rapports', icon: 'download', category: 'Rapports' },

  budget_view: { label: 'Consulter les budgets', icon: 'dollar-sign', category: 'Finance' },
  budget_edit: { label: 'Modifier les budgets', icon: 'edit', category: 'Finance' },
  billing_manage: { label: 'Gérer la facturation', icon: 'dollar-sign', category: 'Finance' },

  maintenance_request_create: { label: 'Créer demande maintenance', icon: 'plus', category: 'Maintenance' },
  maintenance_request_manage: { label: 'Gérer les interventions', icon: 'wrench', category: 'Maintenance' },

  room_service_request: { label: 'Service en chambre', icon: 'utensils', category: 'Services' },

  menu_manage: { label: 'Gérer les menus', icon: 'utensils', category: 'Restauration' },
  menu_view: { label: 'Consulter les menus', icon: 'eye', category: 'Restauration' },

  promotions_manage: { label: 'Gérer les promotions', icon: 'calendar', category: 'Marketing' },

  settings_manage: { label: 'Gérer les paramètres', icon: 'settings', category: 'Administration' },
}

export default class PermissionSeeder extends BaseSeeder {
  public async run () {
    const permissionData = Object.entries(permissionLabels).map(([name, { label, icon, category }]) => ({
      name,
      label,
      icon,
      category,
    }))

    await Permission.updateOrCreateMany('name', permissionData)
  }
}
