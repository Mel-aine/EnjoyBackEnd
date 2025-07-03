import { DateTime } from 'luxon'
import Reservation from '#models/reservation'
import ServiceProduct from '#models/service_product'

type PeriodType = 'monthly' | 'quarterly' | 'semester' | 'yearly'

export class HotelAnalyticsService {
  public static async getAverageOccupancyRate(serviceId: number, period: PeriodType) {
    // Validation du paramètre period
    const validPeriods: PeriodType[] = ['monthly', 'quarterly', 'semester', 'yearly']
    if (!validPeriods.includes(period)) {
      throw new Error(`Invalid period: ${period}. Valid periods are: ${validPeriods.join(', ')}`)
    }
    
    const now = DateTime.now()
    
    // Calcul des périodes selon le type
    const periods = {
      monthly: { current: now.startOf('month'), duration: now.daysInMonth },
      quarterly: { current: now.startOf('quarter'), duration: Math.ceil(now.daysInYear / 4) },
      semester: { 
        current: DateTime.fromObject({ year: now.year, month: now.month <= 6 ? 1 : 7 }),
        duration: 183
      },
      yearly: { current: now.startOf('year'), duration: now.daysInYear }
    }
    
    const periodConfig = periods[period]
    if (!periodConfig) {
      throw new Error(`Invalid period type: ${period}. Valid types are: ${Object.keys(periods).join(', ')}`)
    }
    
    const { current, duration } = periodConfig
    const previous = current.minus({
      months: period === 'monthly' ? 1 : period === 'quarterly' ? 3 : period === 'semester' ? 6 : 0,
      years: period === 'yearly' ? 1 : 0
    })
    
    // Nombre total de chambres
    const totalRoomsResult = await ServiceProduct.query().where('service_id', serviceId).count('* as total')
    const totalRooms = Number(totalRoomsResult[0].$extras.total || '0')
    
    if (totalRooms === 0) {
      return { currentRate: 0, previousRate: 0, difference: 0 }
    }
    
    // Calcul des dates de fin
    const currentEnd = current.plus({ days: duration })
    const previousEnd = previous.plus({ days: duration })
    
    // Récupération des réservations
    const [currentReservations, previousReservations] = await Promise.all([
      Reservation.query()
        .where('service_id', serviceId)
        .whereBetween('arrived_date', [current.toFormat('yyyy-MM-dd'), currentEnd.toFormat('yyyy-MM-dd')]),
      Reservation.query()
        .where('service_id', serviceId)
        .whereBetween('arrived_date', [previous.toFormat('yyyy-MM-dd'), previousEnd.toFormat('yyyy-MM-dd')])
    ])
    
    // Calcul des nuits occupées
    const calculateNights = (reservations: Reservation[], start: DateTime, end: DateTime) => {
      return reservations.reduce((total, res) => {
        // Vérification et conversion des dates
        if (!res.arrived_date || !res.depart_date) {
          return total // Ignorer les réservations sans dates complètes
        }
        
        let arrivalDate: DateTime
        let departDate: DateTime
        
        // Conversion sécurisée des dates
        if (res.arrived_date instanceof Date) {
          arrivalDate = DateTime.fromJSDate(res.arrived_date)
        } else if (typeof res.arrived_date === 'string') {
          arrivalDate = DateTime.fromISO(res.arrived_date)
        } else {
          // Si c'est déjà un DateTime de Luxon
          arrivalDate = res.arrived_date as DateTime
        }
        
        if (res.depart_date instanceof Date) {
          departDate = DateTime.fromJSDate(res.depart_date)
        } else if (typeof res.depart_date === 'string') {
          departDate = DateTime.fromISO(res.depart_date)
        } else {
          // Si c'est déjà un DateTime de Luxon
          departDate = res.depart_date as DateTime
        }
        
        // Vérification de la validité des dates
        if (!arrivalDate.isValid || !departDate.isValid) {
          return total // Ignorer les dates invalides
        }
        
        const actualStart = arrivalDate < start ? start : arrivalDate
        const actualEnd = departDate > end ? end : departDate
        const nights = actualEnd.diff(actualStart, 'days').days
        
        return total + (nights > 0 ? nights : 0)
      }, 0)
    }
    
    const totalPossibleNights = totalRooms * duration
    const currentNights = calculateNights(currentReservations, current, currentEnd)
    const previousNights = calculateNights(previousReservations, previous, previousEnd)
    
    const currentRate = Math.round((currentNights / totalPossibleNights) * 10000) / 100
    const previousRate = Math.round((previousNights / totalPossibleNights) * 10000) / 100
    const difference = Math.round((currentRate - previousRate) * 100) / 100
    
    return { currentRate, previousRate, difference }
  }
}