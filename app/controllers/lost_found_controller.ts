import type { HttpContext } from '@adonisjs/core/http'
import { createLostFoundValidator, updateLostFoundValidator } from '#validators/lost_found'
import LostFoundService from '#services/lost_found_service'
import CheckInCheckOutNotificationService from '#services/notification_action_service'
import { DateTime } from 'luxon'

export default class LostFoundController {
  private lostFoundService = new LostFoundService()

  /**
   * Display a list of lost and found items
   */
  async index({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const status = request.input('status')
      const search = request.input('search')
      const sortBy = request.input('sortBy', 'created_at')
      const sortOrder = request.input('sortOrder', 'desc')

      const result = await this.lostFoundService.getAll({
        page,
        limit,
        status,
        search,
        sortBy,
        sortOrder,
      })

      return response.ok({
        success: true,
        data: result.data,
        meta: result.meta,
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to fetch lost and found items',
        error: error.message,
      })
    }
  }

  /**
   * Show form for creating a new lost and found item
   */
  async create({}: HttpContext) {
    // This would typically return a form view in a traditional web app
    // For API, we might return validation rules or form structure
    return {
      success: true,
      message: 'Ready to create new lost and found item',
    }
  }

  /**
   * Handle form submission for the create action
   */
  async store({ request, response }: HttpContext) {
    try {
      const payload = await request.validateUsing(createLostFoundValidator)
      const lostFoundItem = await this.lostFoundService.create(payload)

      // Send Lost & Found notification
      try {
          if (payload.foundOn && payload.foundLocation) {
        await CheckInCheckOutNotificationService.notifyLostAndFound(
          payload.itemName,
          payload.whoFound || 'Unknown',
          payload.foundLocation || 'Unknown Location',
          DateTime.fromJSDate(payload.foundOn) ,


        )}
      } catch (notifError) {
        console.error('Failed to send lost and found notification:', notifError)
      }


      return response.created({
        success: true,
        message: 'Lost and found item created successfully',
        data: lostFoundItem,
      })
    } catch (error) {
      if (error.messages) {
        return response.badRequest({
          success: false,
          message: 'Validation failed',
          errors: error.messages,
        })
      }

      return response.internalServerError({
        success: false,
        message: 'Failed to create lost and found item',
        error: error.message,
      })
    }
  }

  /**
   * Show individual lost and found item
   */
  async show({ params, response }: HttpContext) {
    try {
      const lostFoundItem = await this.lostFoundService.getById(params.id)

      if (!lostFoundItem) {
        return response.notFound({
          success: false,
          message: 'Lost and found item not found',
        })
      }

      return response.ok({
        success: true,
        data: lostFoundItem,
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to fetch lost and found item',
        error: error.message,
      })
    }
  }

  /**
   * Show form for editing lost and found item
   */
  async edit({ params, response }: HttpContext) {
    try {
      const lostFoundItem = await this.lostFoundService.getById(params.id)

      if (!lostFoundItem) {
        return response.notFound({
          success: false,
          message: 'Lost and found item not found',
        })
      }

      return response.ok({
        success: true,
        data: lostFoundItem,
        message: 'Ready to edit lost and found item',
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to fetch lost and found item for editing',
        error: error.message,
      })
    }
  }

  /**
   * Handle form submission for the edit action
   */
  async update({ params, request, response }: HttpContext) {
    try {
      const payload = await request.validateUsing(updateLostFoundValidator)
      const lostFoundItem = await this.lostFoundService.update(params.id, payload)

      if (!lostFoundItem) {
        return response.notFound({
          success: false,
          message: 'Lost and found item not found',
        })
      }

      return response.ok({
        success: true,
        message: 'Lost and found item updated successfully',
        data: lostFoundItem,
      })
    } catch (error) {
      if (error.messages) {
        return response.badRequest({
          success: false,
          message: 'Validation failed',
          errors: error.messages,
        })
      }

      return response.internalServerError({
        success: false,
        message: 'Failed to update lost and found item',
        error: error.message,
      })
    }
  }

  /**
   * Delete lost and found item
   */
  async destroy({ params, response }: HttpContext) {
    try {
      const deleted = await this.lostFoundService.delete(params.id)

      if (!deleted) {
        return response.notFound({
          success: false,
          message: 'Lost and found item not found',
        })
      }

      return response.ok({
        success: true,
        message: 'Lost and found item deleted successfully',
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to delete lost and found item',
        error: error.message,
      })
    }
  }

  /**
   * Get lost and found items by status
   */
  async getByStatus({ params, request, response }: HttpContext) {
    try {
      const { status } = params
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)

      const result = await this.lostFoundService.getByStatus(status, { page, limit })

      return response.ok({
        success: true,
        data: result.data,
        meta: result.meta,
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to fetch lost and found items by status',
        error: error.message,
      })
    }
  }

  /**
   * Get lost and found items by room
   */
  async getByRoom({ params, request, response }: HttpContext) {
    try {
      const { roomId } = params
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)

      const result = await this.lostFoundService.getByRoom(roomId, { page, limit })

      return response.ok({
        success: true,
        data: result.data,
        meta: result.meta,
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to fetch lost and found items by room',
        error: error.message,
      })
    }
  }

  /**
   * Mark item as found
   */
  async markAsFound({ params, request, response }: HttpContext) {
    try {
      const { foundOn, foundLocation, whoFound, currentLocation } = request.only([
        'foundOn',
        'foundLocation',
        'whoFound',
        'currentLocation',
      ])

      const lostFoundItem = await this.lostFoundService.markAsFound(params.id, {
        foundOn,
        foundLocation,
        whoFound,
        currentLocation,
      })

      if (!lostFoundItem) {
        return response.notFound({
          success: false,
          message: 'Lost and found item not found',
        })
      }

      return response.ok({
        success: true,
        message: 'Item marked as found successfully',
        data: lostFoundItem,
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to mark item as found',
        error: error.message,
      })
    }
  }

  /**
   * Mark item as returned to owner
   */
  async markAsReturned({ params, response }: HttpContext) {
    try {
      const lostFoundItem = await this.lostFoundService.markAsReturned(params.id)

      if (!lostFoundItem) {
        return response.notFound({
          success: false,
          message: 'Lost and found item not found',
        })
      }

      return response.ok({
        success: true,
        message: 'Item marked as returned successfully',
        data: lostFoundItem,
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to mark item as returned',
        error: error.message,
      })
    }
  }

  /**
   * Search items by complainant name
   */
  async searchByComplainant({ request, response }: HttpContext) {
    try {
      const complainantName = request.input('complainant_name')
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)

      if (!complainantName) {
        return response.badRequest({
          success: false,
          message: 'Complainant name is required',
        })
      }

      const result = await this.lostFoundService.searchByComplainant(complainantName, {
        page,
        limit,
      })

      return response.ok({
        success: true,
        data: result.data,
        meta: result.meta,
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to search by complainant',
        error: error.message,
      })
    }
  }

  /**
   * Get lost and found statistics
   */
  async getStatistics({ response }: HttpContext) {
    try {
      const statistics = await this.lostFoundService.getStatistics()

      return response.ok({
        success: true,
        data: statistics,
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to get statistics',
        error: error.message,
      })
    }
  }

  /**
   * Get recent lost and found items
   */
  async getRecentItems({ request, response }: HttpContext) {
    try {
      const limit = request.input('limit', 10)
      const items = await this.lostFoundService.getRecentItems(limit)

      return response.ok({
        success: true,
        data: items,
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to get recent items',
        error: error.message,
      })
    }
  }
}
