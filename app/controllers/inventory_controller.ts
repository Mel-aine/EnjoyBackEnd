import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Inventory from '#models/inventory'
import { createInventoryValidator, updateInventoryValidator } from '#validators/inventory'

export default class InventoryController {
  /**
   * Display a list of inventory items
   */
  async index({ params, request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const search = request.input('search')
      const hotelId = params.hotelId
      const category = request.input('category')
      const subcategory = request.input('subcategory')
      const status = request.input('status')
      const condition = request.input('condition')
      const isLowStock = request.input('is_low_stock')
      const isExpired = request.input('is_expired')
      const needsReorder = request.input('needs_reorder')
      const storageLocation = request.input('storage_location')

      if (!hotelId) {
        return response.badRequest({ success: false, message: 'hotelId is required' })
      }

      const query = Inventory.query()

      query.where('hotel_id', Number(hotelId))

      if (search) {
        query.where((builder) => {
          builder
            .where('item_code', 'ILIKE', `%${search}%`)
            .orWhere('item_name', 'ILIKE', `%${search}%`)
            .orWhere('description', 'ILIKE', `%${search}%`)
            .orWhere('brand', 'ILIKE', `%${search}%`)
            .orWhere('model', 'ILIKE', `%${search}%`)
            .orWhere('sku', 'ILIKE', `%${search}%`)
            .orWhere('barcode', 'ILIKE', `%${search}%`)
        })
      }

      if (category) {
        query.where('category', category)
      }

      if (subcategory) {
        query.where('subcategory', subcategory)
      }

      if (status) {
        query.where('status', status)
      }

      if (condition) {
        query.where('condition', condition)
      }

      if (storageLocation) {
        query.where('storage_location', 'ILIKE', `%${storageLocation}%`)
      }

      if (isLowStock === 'true') {
        query.whereRaw('current_stock <= minimum_stock')
      }

      if (isExpired === 'true') {
        query.where('expiry_date', '<', new Date())
      }

      if (needsReorder === 'true') {
        query.whereRaw('current_stock <= reorder_point')
      }

      const inventory = await query
        .preload('hotel')
        .orderBy('item_name', 'asc')
        .paginate(page, limit)

      return response.ok({
        message: 'Inventory items retrieved successfully',
        data: inventory
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Failed to retrieve inventory items',
        error: error.message
      })
    }
  }

  /**
   * Create a new inventory item
   */
  async store({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createInventoryValidator)
      
      const inventoryData: any = {
        ...payload,
        createdBy: auth.user?.id
      }
      
      const inventory = await Inventory.create(inventoryData)

      await inventory.load('hotel')

      return response.created({
        message: 'Inventory item created successfully',
        data: inventory
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to create inventory item',
        error: error.message
      })
    }
  }

  /**
   * Show a specific inventory item
   */
  async show({ params, response }: HttpContext) {
    try {
      const inventory = await Inventory.query()
        .where('id', params.id)
        .preload('hotel')
        .firstOrFail()

      return response.ok({
        message: 'Inventory item retrieved successfully',
        data: inventory
      })
    } catch (error) {
      return response.notFound({
        message: 'Inventory item not found',
        error: error.message
      })
    }
  }

  /**
   * Update an inventory item
   */
  async update({ params, request, response, auth }: HttpContext) {
    try {
      const inventory = await Inventory.findOrFail(params.id)
      const payload = await request.validateUsing(updateInventoryValidator)

      const updateData: any = {
        ...payload,
        lastModifiedBy: auth.user?.id
      }
      
      inventory.merge(updateData)

      await inventory.save()
      await inventory.load('hotel')

      return response.ok({
        message: 'Inventory item updated successfully',
        data: inventory
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to update inventory item',
        error: error.message
      })
    }
  }

  /**
   * Delete an inventory item
   */
  async destroy({ params, response }: HttpContext) {
    try {
      const inventory = await Inventory.findOrFail(params.id)
      await inventory.delete()

      return response.ok({
        message: 'Inventory item deleted successfully'
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to delete inventory item',
        error: error.message
      })
    }
  }

  /**
   * Update stock levels
   */
  async updateStock({ params, request, response, auth }: HttpContext) {
    try {
      const inventory = await Inventory.findOrFail(params.id)
      const { quantity, type } = request.only(['quantity', 'type'])
      
      if (!quantity || !type) {
        return response.badRequest({
          message: 'Quantity and type are required'
        })
      }

      const oldStock = inventory.currentStock
      
      if (type === 'add') {
        inventory.currentStock += quantity
      } else if (type === 'subtract') {
        if (inventory.currentStock < quantity) {
          return response.badRequest({
            message: 'Insufficient stock'
          })
        }
        inventory.currentStock -= quantity
      } else if (type === 'set') {
        inventory.currentStock = quantity
      }

      inventory.lastInventoryDate = DateTime.now()
      inventory.lastInventoryCount = inventory.currentStock
      inventory.inventoryVariance = inventory.currentStock - oldStock
      inventory.lastModifiedBy = auth.user?.id || 0
      
      await inventory.save()

      return response.ok({
        message: 'Stock updated successfully',
        data: {
          inventory,
          oldStock,
          newStock: inventory.currentStock,
          change: inventory.currentStock - oldStock
        }
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to update stock',
        error: error.message
      })
    }
  }

  /**
   * Get low stock items
   */
  async lowStock({ request, response }: HttpContext) {
    try {
      const { hotelId } = request.only(['hotelId'])
      
      const query = Inventory.query()
        .whereRaw('current_stock <= minimum_stock')
        .where('is_active', true)
      
      if (hotelId) {
        query.where('hotel_id', hotelId)
      }

      const lowStockItems = await query
        .preload('hotel')
        .orderBy('current_stock', 'asc')

      return response.ok({
        message: 'Low stock items retrieved successfully',
        data: lowStockItems
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve low stock items',
        error: error.message
      })
    }
  }

  /**
   * Get items that need reordering
   */
  async reorderList({ request, response }: HttpContext) {
    try {
      const { hotelId } = request.only(['hotelId'])
      
      const query = Inventory.query()
        .whereRaw('current_stock <= reorder_point')
        .where('is_active', true)
        .where('auto_reorder', true)
      
      if (hotelId) {
        query.where('hotel_id', hotelId)
      }

      const reorderItems = await query
        .preload('hotel')
        .orderBy('current_stock', 'asc')

      return response.ok({
        message: 'Reorder list retrieved successfully',
        data: reorderItems
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve reorder list',
        error: error.message
      })
    }
  }

  /**
   * Get expired items
   */
  async expired({ request, response }: HttpContext) {
    try {
      const { hotelId } = request.only(['hotelId'])
      
      const query = Inventory.query()
        .where('expiry_date', '<', new Date())
        .where('is_active', true)
      
      if (hotelId) {
        query.where('hotel_id', hotelId)
      }

      const expiredItems = await query
        .preload('hotel')
        .orderBy('expiry_date', 'asc')

      return response.ok({
        message: 'Expired items retrieved successfully',
        data: expiredItems
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve expired items',
        error: error.message
      })
    }
  }

  /**
   * Get items expiring soon
   */
  async expiringSoon({ request, response }: HttpContext) {
    try {
      const { hotelId, days = 30 } = request.only(['hotelId', 'days'])
      
      const expiryDate = new Date()
      expiryDate.setDate(expiryDate.getDate() + days)
      
      const query = Inventory.query()
        .where('expiry_date', '>', new Date())
        .where('expiry_date', '<=', expiryDate)
        .where('is_active', true)
      
      if (hotelId) {
        query.where('hotel_id', hotelId)
      }

      const expiringSoonItems = await query
        .preload('hotel')
        .orderBy('expiry_date', 'asc')

      return response.ok({
        message: 'Items expiring soon retrieved successfully',
        data: expiringSoonItems
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve items expiring soon',
        error: error.message
      })
    }
  }

  /**
   * Get inventory statistics
   */
  async stats({ request, response }: HttpContext) {
    try {
      const { hotelId } = request.only(['hotelId'])
      
      const query = Inventory.query()
      if (hotelId) {
        query.where('hotel_id', hotelId)
      }

      const totalItems = await query.clone().count('* as total')
      const activeItems = await query.clone().where('is_active', true).count('* as total')
      const lowStockItems = await query.clone().whereRaw('current_stock <= minimum_stock').count('* as total')
      const outOfStockItems = await query.clone().where('current_stock', 0).count('* as total')
      const expiredItems = await query.clone().where('expiry_date', '<', new Date()).count('* as total')
      const reorderItems = await query.clone().whereRaw('current_stock <= reorder_point').count('* as total')
      
      const totalValue = await query.clone().sum('total_value as value')
      const averageValue = await query.clone().avg('total_value as value')

      const stats = {
        totalItems: totalItems[0].$extras.total,
        activeItems: activeItems[0].$extras.total,
        lowStockItems: lowStockItems[0].$extras.total,
        outOfStockItems: outOfStockItems[0].$extras.total,
        expiredItems: expiredItems[0].$extras.total,
        reorderItems: reorderItems[0].$extras.total,
        totalValue: totalValue[0].$extras.value || 0,
        averageValue: averageValue[0].$extras.value || 0
      }

      return response.ok({
        message: 'Inventory statistics retrieved successfully',
        data: stats
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve statistics',
        error: error.message
      })
    }
  }

  /**
   * Get inventory by category
   */
  async byCategory({ request, response }: HttpContext) {
    try {
      const { hotelId } = request.only(['hotelId'])
      
      const query = Inventory.query()
        .select('category')
        .count('* as count')
        .sum('total_value as value')
        .groupBy('category')
      
      if (hotelId) {
        query.where('hotel_id', hotelId)
      }

      const categoryStats = await query

      return response.ok({
        message: 'Inventory by category retrieved successfully',
        data: categoryStats
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve inventory by category',
        error: error.message
      })
    }
  }

  /**
   * Perform inventory count
   */
  async performCount({ params, request, response, auth }: HttpContext) {
    try {
      const inventory = await Inventory.findOrFail(params.id)
      const { actualCount, notes } = request.only(['actualCount', 'notes'])
      
      if (actualCount === undefined) {
        return response.badRequest({
          message: 'Actual count is required'
        })
      }

      const variance = actualCount - inventory.currentStock
      
      inventory.currentStock = actualCount
      inventory.lastInventoryDate = DateTime.now()
      inventory.lastInventoryCount = actualCount
      inventory.inventoryVariance = variance
      inventory.internalNotes = notes
      inventory.lastModifiedBy = auth.user?.id || 0
      
      await inventory.save()

      return response.ok({
        message: 'Inventory count performed successfully',
        data: {
          inventory,
          variance,
          notes
        }
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to perform inventory count',
        error: error.message
      })
    }
  }
}