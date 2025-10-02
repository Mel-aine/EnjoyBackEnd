/* eslint-disable prettier/prettier */
import HouseKeeper from '#models/house_keeper'

interface ListOptions {
  page?: number
  limit?: number
  search?: string
  hotelId?: number
}

export default class HouseKeeperService {
  async list(options: ListOptions = {}) {
    const page = options.page ?? 1
    const limit = options.limit ?? 20

    const query = HouseKeeper.query().preload('hotel')

    if (options.hotelId) {
      query.where('hotel_id', options.hotelId)
    }

    if (options.search) {
      query.where((builder) => {
        builder.whereILike('name', `%${options.search}%`).orWhereILike('phone', `%${options.search}%`)
      })
    }

    query.orderBy('created_at', 'desc')
    return query.paginate(page, limit)
  }

  async findById(id: number) {
    return HouseKeeper.query().where('id', id).preload('hotel').first()
  }

  async create(payload: { hotel_id: number; name: string; phone: string }) {
    return HouseKeeper.create({
      hotelId: payload.hotel_id,
      name: payload.name,
      phone: payload.phone,
    })
  }

  async update(id: number, payload: Partial<{ hotel_id: number; name: string; phone: string }>) {
    const hk = await HouseKeeper.findOrFail(id)
    if (payload.hotel_id !== undefined) hk.hotelId = payload.hotel_id
    if (payload.name !== undefined) hk.name = payload.name
    if (payload.phone !== undefined) hk.phone = payload.phone
    await hk.save()
    await hk.load('hotel')
    return hk
  }

  async delete(id: number) {
    const hk = await HouseKeeper.findOrFail(id)
    await hk.delete()
    return { success: true }
  }
}