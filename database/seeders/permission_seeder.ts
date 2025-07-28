import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Permission from '#models/permission'

export default class PermissionSeeder extends BaseSeeder {
  public async run() {
    const permissions = [
      { name: 'dashboard_view', label: 'Dashboard', icon: 'layout-dashboard', category: 'Général' },
      {
        name: 'bookings_view',
        label: 'Réservations',
        icon: 'calendar-check',
        category: 'Réservations',
      },
      {
        name: 'bookings_read',
        label: 'Voir toutes les réservations',
        icon: 'calendar-check',
        category: 'Réservations',
      },
      {
        name: 'bookings_create',
        label: 'Ajouter une réservation',
        icon: 'calendar-check',
        category: 'Réservations',
      },
      { name: 'rooms_view', label: 'Chambres', icon: 'bed-double', category: 'Chambres' },
      {
        name: 'rooms_read',
        label: 'Voir toutes les chambres',
        icon: 'bed-double',
        category: 'Chambres',
      },
      {
        name: 'rooms_manage',
        label: 'Gérer les types de chambres',
        icon: 'bed-double',
        category: 'Chambres',
      },
      {
        name: 'rooms_occupancy_view',
        label: 'Voir l’occupation',
        icon: 'bed-double',
        category: 'Chambres',
      },
      {
        name: 'calendar_view',
        label: 'Voir le calendrier',
        icon: 'calendar-days',
        category: 'Général',
      },
      {
        name: 'departments_view',
        label: 'Voir les départements',
        icon: 'building',
        category: 'Services Hôteliers',
      },
      {
        name: 'reports_view',
        label: 'Voir les rapports',
        icon: 'clipboard-plus',
        category: 'Rapports',
      },
      {
        name: 'inventory_view',
        label: 'Voir la gestion des stocks',
        icon: 'clipboard-plus',
        category: 'Inventaire',
      },
      {
        name: 'inventory_read',
        label: 'Voir les produits',
        icon: 'clipboard-plus',
        category: 'Inventaire',
      },
      {
        name: 'inventory_history_view',
        label: 'Voir les mouvements de stock',
        icon: 'clipboard-plus',
        category: 'Inventaire',
      },
      {
        name: 'inventory_category_view',
        label: 'Voir les catégories de stock',
        icon: 'clipboard-plus',
        category: 'Inventaire',
      },
      {
        name: 'suppliers_view',
        label: 'Voir les fournisseurs',
        icon: 'clipboard-plus',
        category: 'Inventaire',
      },
      {
        name: 'expenses_view',
        label: 'Voir les dépenses',
        icon: 'clipboard-plus',
        category: 'Comptabilité',
      },
      {
        name: 'customers_view',
        label: 'Voir les clients',
        icon: 'users-round',
        category: 'Clients',
      },
      {
        name: 'billing_manage',
        label: 'Gérer la facturation',
        icon: 'banknote',
        category: 'Paiement',
      },
      {
        name: 'staff_view',
        label: 'Voir la gestion du personnel',
        icon: 'user-circle',
        category: 'RH',
      },
      {
        name: 'staff_dashboard_view',
        label: 'Voir le dashboard du personnel',
        icon: 'user-circle',
        category: 'RH',
      },
      { name: 'staff_manage', label: 'Gérer le personnel', icon: 'user-circle', category: 'RH' },
      {
        name: 'permissions_manage',
        label: 'Gérer les permissions',
        icon: 'user-circle',
        category: 'RH',
      },
      { name: 'task_manage', label: 'Gérer les tâches', icon: 'user-circle', category: 'RH' },
      {
        name: 'schedule_manage',
        label: 'Gérer les plannings',
        icon: 'user-circle',
        category: 'RH',
      },
      {
        name: 'staff_history_view',
        label: 'Voir l’historique du personnel',
        icon: 'user-circle',
        category: 'RH',
      },
      {
        name: 'settings_manage',
        label: 'Gérer les paramètres',
        icon: 'settings',
        category: 'Configuration',
      },
    ]

    for (const permission of permissions) {
      await Permission.updateOrCreate(
        { name: permission.name },
        {
          label: permission.label,
          icon: permission.icon,
          category: permission.category,
        }
      )
    }
  }
}
