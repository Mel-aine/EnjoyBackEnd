import VipStatus from '#models/vip_status'

export default class VipStatusService {
  /**
   * List VIP statuses with filtering, sorting, and pagination
   */
  async list(filters: any, sortBy: string = 'id', order: 'asc' | 'desc' = 'asc', page: number = 1, perPage: number = 20) {
    let query = VipStatus.query()

    // Apply filters
    for (const key in filters) {
      if (Array.isArray(filters[key])) {
        query.whereIn(key, filters[key])
      } else {
        query.where(key, filters[key])
      }
    }

    // Apply relationships
    query.preload('hotel')

    // Apply sorting and pagination
    return await query
      .orderBy(sortBy, order)
      .paginate(page, perPage)
  }

  /**
   * Get a VIP status by ID with HotelId filtering
   */
  async getById(id: number, hotelId: number) {
    return await VipStatus.query()
      .where('id', id)
      .where('hotel_id', hotelId)
      .preload('hotel')
      .first()
  }

  /**
   * Create a new VIP status
   */
  async create(data: any) {
    return await VipStatus.create(data)
  }

  /**
   * Update a VIP status
   */
  async update(id: number, hotelId: number, data: any) {
    const vipStatus = await VipStatus.query()
      .where('id', id)
      .where('hotel_id', hotelId)
      .first()
    
    if (!vipStatus) return null

    vipStatus.merge(data)
    await vipStatus.save()

    return vipStatus
  }

  /**
   * Delete a VIP status (soft delete)
   */
  async delete(id: number, hotelId: number) {
    const vipStatus = await VipStatus.query()
      .where('id', id)
      .where('hotel_id', hotelId)
      .first()

    if (!vipStatus) return null

    await vipStatus.delete()
    return true
  }

  /**
   * Get VIP statuses by hotel ID
   */
  async getByHotelId(hotelId: number) {
    return await VipStatus.query()
      .where('hotel_id', hotelId)
      .orderBy('name', 'asc')
  }

  /**
   * Get active VIP statuses for a hotel
   */
  async getActiveStatuses(hotelId: number) {
    return await VipStatus.query()
      .where('hotel_id', hotelId)
      .orderBy('name', 'asc')
  }

  /**
   * Check if VIP status name exists for a hotel
   */
  async nameExists(name: string, hotelId: number, excludeId?: number) {
    let query = VipStatus.query()
      .where('name', name)
      .where('hotel_id', hotelId)

    if (excludeId) {
      query.whereNot('id', excludeId)
    }

    const existing = await query.first()
    return !!existing
  }

  /**
   * Validate hex color format
   */
  isValidHexColor(color: string): boolean {
    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
    return hexColorRegex.test(color)
  }
}