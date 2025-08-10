import { DateTime } from 'luxon'
import { BaseModel, column, manyToMany, hasMany } from '@adonisjs/lucid/orm'
import type { ManyToMany, HasMany } from '@adonisjs/lucid/types/relations'
import Role from '#models/role'
import RolePermission from '#models/role_permission'

export default class Permission extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare permission_name: string

  @column()
  declare permission_description: string | null

  @column()
  declare module_category: 'FrontOffice' | 'Reservations' | 'BillingPayments' | 'PricingRevenue' | 'HousekeepingMaintenance' | 'OnlineDistribution' | 'ReportsAnalytics' | 'SecurityUser' | 'ThirdPartyIntegrations' | 'TechnicalUX' | 'Administration' | 'AccountingFinance' | 'HumanResources' | 'InventoryPurchasing' | null

  @column()
  declare name: string

  @column()
  declare label: string | null

  @column()
  declare icon: string | null

  @column()
  declare category: string | null

  /**
   * Relations
   */

  @hasMany(() => RolePermission, {
    foreignKey: 'permission_id',
  })
  declare rolePermissions: HasMany<typeof RolePermission>

  @manyToMany(() => Role, {
    pivotTable: 'role_permissions',
    pivotForeignKey: 'permission_id',
    pivotRelatedForeignKey: 'role_id',
  })
  declare roles: ManyToMany<typeof Role>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
