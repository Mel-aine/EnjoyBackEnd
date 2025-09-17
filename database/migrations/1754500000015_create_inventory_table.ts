import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'inventory'

  async up() {
    // Check if table exists first
    const hasTable = await this.schema.hasTable(this.tableName)
    
    if (!hasTable) {
      this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('hotel_id').unsigned().notNullable()
      table.string('item_code', 50).notNullable()
      table.string('item_name', 200).notNullable()
      table.text('description').nullable()
      table.enum('category', [
        'linens', 'towels', 'amenities', 'cleaning_supplies', 'maintenance_supplies',
        'office_supplies', 'kitchen_supplies', 'bar_supplies', 'furniture',
        'electronics', 'safety_equipment', 'uniforms', 'marketing_materials',
        'guest_supplies', 'laundry_supplies', 'food_beverage', 'other'
      ]).notNullable()
      table.enum('subcategory', [
        'bed_sheets', 'pillowcases', 'blankets', 'bath_towels', 'hand_towels',
        'shampoo', 'soap', 'toilet_paper', 'cleaning_chemicals', 'tools',
        'stationery', 'computers', 'phones', 'fire_extinguisher', 'first_aid',
        'housekeeping_uniforms', 'front_desk_uniforms', 'brochures', 'key_cards',
        'detergent', 'fabric_softener', 'alcohol', 'mixers', 'snacks', 'other'
      ]).nullable()
      table.string('brand', 100).nullable()
      table.string('model', 100).nullable()
      table.string('sku', 100).nullable()
      table.string('barcode', 100).nullable()
      table.enum('unit_of_measure', [
        'piece', 'set', 'box', 'case', 'bottle', 'liter', 'kilogram',
        'meter', 'roll', 'pack', 'dozen', 'gallon', 'pound', 'other'
      ]).notNullable()
      table.integer('current_stock').defaultTo(0)
      table.integer('minimum_stock').defaultTo(0)
      table.integer('maximum_stock').defaultTo(0)
      table.integer('reorder_point').defaultTo(0)
      table.integer('reorder_quantity').defaultTo(0)
      table.decimal('unit_cost', 10, 2).defaultTo(0)
      table.decimal('total_value', 12, 2).defaultTo(0)
      table.string('supplier_name', 200).nullable()
      table.string('supplier_contact', 200).nullable()
      table.string('supplier_email', 200).nullable()
      table.string('supplier_phone', 50).nullable()
      table.integer('lead_time_days').defaultTo(0)
      table.date('last_order_date').nullable()
      table.date('next_order_date').nullable()
      table.date('expiry_date').nullable()
      table.integer('shelf_life_days').nullable()
      table.string('storage_location', 200).nullable()
      table.enum('storage_requirements', [
        'room_temperature', 'refrigerated', 'frozen', 'dry', 'ventilated',
        'secure', 'hazardous', 'fragile', 'other'
      ]).nullable()
      table.boolean('is_perishable').defaultTo(false)
      table.boolean('is_hazardous').defaultTo(false)
      table.text('safety_instructions').nullable()
      table.boolean('requires_training').defaultTo(false)
      table.text('usage_instructions').nullable()
      table.json('specifications').nullable()
      table.string('warranty_period', 50).nullable()
      table.date('purchase_date').nullable()
      table.date('warranty_expiry').nullable()
      table.string('serial_number', 100).nullable()
      table.enum('condition', [
        'new', 'good', 'fair', 'poor', 'damaged', 'obsolete'
      ]).defaultTo('new')
      table.boolean('is_active').defaultTo(true)
      table.boolean('is_consumable').defaultTo(true)
      table.integer('average_monthly_usage').defaultTo(0)
      table.integer('last_month_usage').defaultTo(0)
      table.decimal('monthly_cost', 10, 2).defaultTo(0)
      table.date('last_inventory_date').nullable()
      table.integer('last_inventory_count').nullable()
      table.integer('inventory_variance').defaultTo(0)
      table.text('inventory_notes').nullable()
      table.boolean('auto_reorder').defaultTo(false)
      table.json('usage_tracking').nullable()
      table.json('maintenance_schedule').nullable()
      table.date('last_maintenance_date').nullable()
      table.date('next_maintenance_date').nullable()
      table.string('image_url', 500).nullable()
      table.json('documents').nullable()
      table.text('internal_notes').nullable()
      table.enum('status', ['active', 'inactive', 'discontinued', 'out_of_stock']).defaultTo('active')
      
      // Audit fields
      table.integer('created_by').unsigned().nullable()
      table.integer('last_modified_by').unsigned().nullable()
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
      
      // Foreign key constraints
      table.foreign('hotel_id').references('id').inTable('hotels').onDelete('CASCADE')
      table.foreign('created_by').references('id').inTable('users').onDelete('SET NULL')
      table.foreign('last_modified_by').references('id').inTable('users').onDelete('SET NULL')
      
      // Unique constraint
      table.unique(['hotel_id', 'item_code'])
      
      // Indexes
      table.index(['category'])
      table.index(['current_stock'])
      table.index(['reorder_point'])
      table.index(['expiry_date'])
      table.index(['is_active'])
      table.index(['supplier_name'])
    })
    }
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}