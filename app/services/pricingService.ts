import { DateTime } from 'luxon'
import RoomRate from '#models/room_rate'

export class PricingService {
  constructor() {}

  /**
   * Calcule le prix total et le prix par nuit pour un séjour
   */
  public async calculateStayPrice(
    hotelId: number,
    roomTypeId: number,
    rateTypeId: number,
    startDate: Date,
    endDate: Date,
    adults: number,
    children: number
  ): Promise<{
    totalAmount: number
    basePrice: number
    averageNightlyRate: number
    baseAmount: number
    taxAmount: number
    feesAmount: number
    discountAmount: number
    currency: string
  }> {
    // Nombre de nuits
    const nights = Math.ceil(
      DateTime.fromJSDate(endDate).diff(DateTime.fromJSDate(startDate), 'days').days
    )

    // Récupérer le RoomRate correspondant
    const roomRate = await RoomRate.query()
      .where('hotel_id', hotelId)
      .andWhere('room_type_id', roomTypeId)
      .andWhere('rate_type_id', rateTypeId)
      .preload('hotel')
      .firstOrFail()

    // Prix de base
    const basePrice = Number(roomRate.baseRate) || 0
    let taxRate = roomRate.hotel?.taxRate ?? 0
    if (taxRate>0) taxRate = taxRate / 100
    const taxAmount = basePrice + (basePrice * taxRate)
    const feesAmount = 0 // frais supplémentaires
    const discountAmount = 0 // réduction éventuelle

    const totalAmount = (basePrice + taxAmount + feesAmount - discountAmount) * nights
    const averageNightlyRate = totalAmount / nights

    return {
      totalAmount,
      averageNightlyRate,
      basePrice: basePrice,
      baseAmount: basePrice * nights,
      taxAmount: taxAmount * nights,
      feesAmount: feesAmount * nights,
      discountAmount: discountAmount * nights,
      currency:  'XAF',
    }
  }
}
