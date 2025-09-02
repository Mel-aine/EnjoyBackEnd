import LostFound from '#models/lost_found'
import Room from '#models/room'
import { DateTime } from 'luxon'
import LoggerService from '#services/logger_service'

interface GetAllOptions {
  page: number
  limit: number
  status?: string
  search?: string
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

interface PaginationOptions {
  page: number
  limit: number
}

interface MarkAsFoundData {
  foundOn?: string
  foundLocation?: string
  whoFound?: string
  currentLocation?: string
}

export default class LostFoundService {
  /**
   * Get all lost and found items with filtering and pagination
   */
  async getAll(options: GetAllOptions) {
    const { page, limit, status, search, sortBy, sortOrder } = options

    let query = LostFound.query().preload('room')

    // Filter by status
    if (status) {
      query = query.where('status', status)
    }

    // Search functionality
    if (search) {
      query = query.where((builder) => {
        builder
          .whereILike('item_name', `%${search}%`)
          .orWhereILike('item_color', `%${search}%`)
          .orWhereILike('complainant_name', `%${search}%`)
          .orWhereILike('found_location', `%${search}%`)
          .orWhereILike('lost_location', `%${search}%`)
          .orWhereILike('current_location', `%${search}%`)
          .orWhereILike('who_found', `%${search}%`)
      })
    }

    // Sorting
    query = query.orderBy(sortBy, sortOrder)

    const result = await query.paginate(page, limit)

    return {
      data: result.all(),
      meta: {
        total: result.total,
        perPage: result.perPage,
        currentPage: result.currentPage,
        lastPage: result.lastPage,
        firstPage: result.firstPage,
        nextPageUrl: result.getNextPageUrl(),
        previousPageUrl: result.getPreviousPageUrl(),
      },
    }
  }

  /**
   * Get lost and found item by ID
   */
  async getById(id: string | number) {
    return await LostFound.query().where('id', id).preload('room').first()
  }

  /**
   * Create new lost and found item
   */
  async create(data: any, userId?: number) {
    // Validate room exists if roomId is provided
    if (data.roomId) {
      const room = await Room.find(data.roomId)
      if (!room) {
        throw new Error('Room not found')
      }
    }

    // Set default status if not provided
    if (!data.status) {
      data.status = data.foundOn ? 'found' : 'lost'
    }

    // Convert date strings to DateTime objects if needed
    if (data.lostOn && typeof data.lostOn === 'string') {
      data.lostOn = DateTime.fromISO(data.lostOn)
    }
    if (data.foundOn && typeof data.foundOn === 'string') {
      data.foundOn = DateTime.fromISO(data.foundOn)
    }

    const lostFoundItem = await LostFound.create(data)
    await lostFoundItem.load('room')
    
    // Log the creation if userId is provided
    if (userId) {
      await LoggerService.logActivity({
        userId: userId,
        action: 'CREATE',
        resourceType: 'LostFound',
        resourceId: lostFoundItem.id,
        hotelId: data.hotelId,
        details: {
          itemDescription: data.itemDescription,
          status: lostFoundItem.status,
          roomId: data.roomId,
          complainantName: data.complainantName,
          complainantPhone: data.complainantPhone
        }
      })
    }
    
    return lostFoundItem
  }

  /**
   * Update lost and found item
   */
  async update(id: string | number, data: any) {
    const lostFoundItem = await LostFound.find(id)
    if (!lostFoundItem) {
      return null
    }

    // Validate room exists if roomId is being updated
    if (data.roomId && data.roomId !== lostFoundItem.roomId) {
      const room = await Room.find(data.roomId)
      if (!room) {
        throw new Error('Room not found')
      }
    }

    // Convert date strings to DateTime objects if needed
    if (data.lostOn && typeof data.lostOn === 'string') {
      data.lostOn = DateTime.fromISO(data.lostOn)
    }
    if (data.foundOn && typeof data.foundOn === 'string') {
      data.foundOn = DateTime.fromISO(data.foundOn)
    }

    lostFoundItem.merge(data)
    await lostFoundItem.save()
    await lostFoundItem.load('room')
    return lostFoundItem
  }

  /**
   * Delete lost and found item
   */
  async delete(id: string | number, userId?: number) {
    const lostFoundItem = await LostFound.find(id)
    if (!lostFoundItem) {
      return false
    }

    // Log the deletion if userId is provided
    if (userId) {
      await LoggerService.logActivity({
        userId: userId,
        action: 'DELETE',
        resourceType: 'LostFound',
        resourceId: lostFoundItem.id,
        hotelId: lostFoundItem.hotelId,
        details: {
          itemDescription: lostFoundItem.itemDescription,
          status: lostFoundItem.status,
          complainantName: lostFoundItem.complainantName,
          complainantPhone: lostFoundItem.complainantPhone
        }
      })
    }

    await lostFoundItem.delete()
    return true
  }

  /**
   * Get lost and found items by status
   */
  async getByStatus(status: string, options: PaginationOptions) {
    const { page, limit } = options

    const result = await LostFound.query()
      .where('status', status)
      .preload('room')
      .orderBy('created_at', 'desc')
      .paginate(page, limit)

    return {
      data: result.all(),
      meta: {
        total: result.total,
        perPage: result.perPage,
        currentPage: result.currentPage,
        lastPage: result.lastPage,
        firstPage: result.firstPage,
        nextPageUrl: result.getNextPageUrl(),
        previousPageUrl: result.getPreviousPageUrl(),
      },
    }
  }

  /**
   * Get lost and found items by room
   */
  async getByRoom(roomId: string | number, options: PaginationOptions) {
    const { page, limit } = options

    const result = await LostFound.query()
      .where('room_id', roomId)
      .preload('room')
      .orderBy('created_at', 'desc')
      .paginate(page, limit)

    return {
      data: result.all(),
      meta: {
        total: result.total,
        perPage: result.perPage,
        currentPage: result.currentPage,
        lastPage: result.lastPage,
        firstPage: result.firstPage,
        nextPageUrl: result.getNextPageUrl(),
        previousPageUrl: result.getPreviousPageUrl(),
      },
    }
  }

  /**
   * Mark item as found
   */
  async markAsFound(id: string | number, data: MarkAsFoundData) {
    const lostFoundItem = await LostFound.find(id)
    if (!lostFoundItem) {
      return null
    }

    // Convert foundOn to DateTime if it's a string
    let foundOn = data.foundOn
    lostFoundItem.merge({
      foundOn,
      foundLocation: data.foundLocation || lostFoundItem.foundLocation,
      whoFound: data.whoFound || lostFoundItem.whoFound,
      currentLocation: data.currentLocation || lostFoundItem.currentLocation,
      status: 'found',
    })

    await lostFoundItem.save()
    await lostFoundItem.load('room')
    return lostFoundItem
  }

  /**
   * Mark item as returned to owner
   */
  async markAsReturned(id: string | number) {
    const lostFoundItem = await LostFound.find(id)
    if (!lostFoundItem) {
      return null
    }

    lostFoundItem.merge({
      status: 'returned',
    })

    await lostFoundItem.save()
    await lostFoundItem.load('room')
    return lostFoundItem
  }

  /**
   * Get statistics for lost and found items
   */
  async getStatistics() {
    const totalItems = await LostFound.query().count('* as total')
    const lostItems = await LostFound.query().where('status', 'lost').count('* as total')
    const foundItems = await LostFound.query().where('status', 'found').count('* as total')
    const returnedItems = await LostFound.query().where('status', 'returned').count('* as total')
    const disposedItems = await LostFound.query().where('status', 'disposed').count('* as total')

    return {
      total: totalItems[0].$extras.total,
      lost: lostItems[0].$extras.total,
      found: foundItems[0].$extras.total,
      returned: returnedItems[0].$extras.total,
      disposed: disposedItems[0].$extras.total,
    }
  }

  /**
   * Get recent lost and found items
   */
  async getRecentItems(limit: number = 10) {
    return await LostFound.query()
      .preload('room')
      .orderBy('created_at', 'desc')
      .limit(limit)
  }

  /**
   * Search items by complainant information
   */
  async searchByComplainant(searchTerm: string, options: PaginationOptions) {
    const { page, limit } = options

    const result = await LostFound.query()
      .where((builder) => {
        builder
          .whereILike('complainant_name', `%${searchTerm}%`)
          .orWhereILike('phone', `%${searchTerm}%`)
          .orWhereILike('address', `%${searchTerm}%`)
          .orWhereILike('city', `%${searchTerm}%`)
      })
      .preload('room')
      .orderBy('created_at', 'desc')
      .paginate(page, limit)

    return {
      data: result.all(),
      meta: {
        total: result.total,
        perPage: result.perPage,
        currentPage: result.currentPage,
        lastPage: result.lastPage,
        firstPage: result.firstPage,
        nextPageUrl: result.getNextPageUrl(),
        previousPageUrl: result.getPreviousPageUrl(),
      },
    }
  }
}