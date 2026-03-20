import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Permission from '#models/permission'

export default class AdminConsolePermissionSeeder extends BaseSeeder {
  public async run() {
    const permissions = [
      // ── Dashboard ──
      {
        name: 'console_dashboard_view',
        label: 'Voir le dashboard console',
        icon: 'layout-dashboard',
        category: 'Console - Dashboard',
      },

      // ── Clients ──
      {
        name: 'console_clients_view',
        label: 'Voir les clients',
        icon: 'building-2',
        category: 'Console - Clients',
      },
      {
        name: 'console_clients_create',
        label: 'Créer un client',
        icon: 'building-2',
        category: 'Console - Clients',
      },
      {
        name: 'console_clients_edit',
        label: 'Modifier un client',
        icon: 'building-2',
        category: 'Console - Clients',
      },
      {
        name: 'console_clients_delete',
        label: 'Supprimer un client',
        icon: 'building-2',
        category: 'Console - Clients',
      },

      // ── Produits ──
      {
        name: 'console_products_view',
        label: 'Voir les produits',
        icon: 'package',
        category: 'Console - Produits',
      },
      {
        name: 'console_products_create',
        label: 'Créer un produit',
        icon: 'package',
        category: 'Console - Produits',
      },
      {
        name: 'console_products_edit',
        label: 'Modifier un produit',
        icon: 'package',
        category: 'Console - Produits',
      },
      {
        name: 'console_products_delete',
        label: 'Supprimer un produit',
        icon: 'package',
        category: 'Console - Produits',
      },

      // ── Facturation ──
      {
        name: 'console_billing_view',
        label: 'Voir la facturation',
        icon: 'receipt',
        category: 'Console - Facturation',
      },
      {
        name: 'console_billing_manage',
        label: 'Gérer la facturation',
        icon: 'receipt',
        category: 'Console - Facturation',
      },
      {
        name: 'console_billing_export',
        label: 'Exporter les factures',
        icon: 'receipt',
        category: 'Console - Facturation',
      },

      // ── Démos ──
      {
        name: 'console_demos_view',
        label: 'Voir les démos',
        icon: 'monitor-play',
        category: 'Console - Démos',
      },
      {
        name: 'console_demos_create',
        label: 'Créer une démo',
        icon: 'monitor-play',
        category: 'Console - Démos',
      },
      {
        name: 'console_demos_manage',
        label: 'Gérer les démos',
        icon: 'monitor-play',
        category: 'Console - Démos',
      },

      // ── Annonces ──
      {
        name: 'console_announcements_view',
        label: 'Voir les annonces',
        icon: 'megaphone',
        category: 'Console - Annonces',
      },
      {
        name: 'console_announcements_create',
        label: 'Créer une annonce',
        icon: 'megaphone',
        category: 'Console - Annonces',
      },
      {
        name: 'console_announcements_edit',
        label: 'Modifier une annonce',
        icon: 'megaphone',
        category: 'Console - Annonces',
      },
      {
        name: 'console_announcements_delete',
        label: 'Supprimer une annonce',
        icon: 'megaphone',
        category: 'Console - Annonces',
      },

      // ── Sécurité ──
      {
        name: 'console_security_view',
        label: 'Voir la sécurité',
        icon: 'shield',
        category: 'Console - Sécurité',
      },
      {
        name: 'console_tenants_manage',
        label: 'Gérer les tenants (suspend/restore)',
        icon: 'shield',
        category: 'Console - Sécurité',
      },
      {
        name: 'console_roles_view',
        label: 'Voir les rôles',
        icon: 'shield',
        category: 'Console - Sécurité',
      },
      {
        name: 'console_roles_create',
        label: 'Créer un rôle',
        icon: 'shield',
        category: 'Console - Sécurité',
      },
      {
        name: 'console_roles_edit',
        label: 'Modifier un rôle',
        icon: 'shield',
        category: 'Console - Sécurité',
      },
      {
        name: 'console_roles_delete',
        label: 'Supprimer un rôle',
        icon: 'shield',
        category: 'Console - Sécurité',
      },
      {
        name: 'console_permissions_manage',
        label: 'Attribuer des permissions',
        icon: 'shield',
        category: 'Console - Sécurité',
      },

      // ── Utilisateurs ──
      {
        name: 'console_users_view',
        label: 'Voir les utilisateurs',
        icon: 'users',
        category: 'Console - Utilisateurs',
      },
      {
        name: 'console_users_create',
        label: 'Créer un utilisateur',
        icon: 'users',
        category: 'Console - Utilisateurs',
      },
      {
        name: 'console_users_edit',
        label: 'Modifier un utilisateur',
        icon: 'users',
        category: 'Console - Utilisateurs',
      },
      {
        name: 'console_users_delete',
        label: 'Supprimer un utilisateur',
        icon: 'users',
        category: 'Console - Utilisateurs',
      },
      {
        name: 'console_users_assign_role',
        label: 'Assigner un rôle à un utilisateur',
        icon: 'users',
        category: 'Console - Utilisateurs',
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

    console.log(`${permissions.length} permissions console seedées avec succès`)
  }
}
