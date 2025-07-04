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
      return { 
        currentRate: 0, 
        previousRate: 0, 
        difference: 0, 
        variationPercentage: 0
      }
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
    
    // Calcul correct du pourcentage de variation
    let variationPercentage = 0
    
    if (previousRate === 0) {
      // Si la période précédente était à 0%, toute occupation actuelle est une amélioration
      if (currentRate > 0) {
        variationPercentage = 100 // Amélioration de 100% depuis 0
      }
    } else {
      // Calcul classique du pourcentage de variation
      variationPercentage = Math.round(((currentRate - previousRate) / previousRate) * 10000) / 100
    }
    
    return { 
      currentRate, 
      previousRate, 
      difference, 
      variationPercentage
    }
  }
  public static async getMonthlyOccupancyRates(serviceId: number) {
    const now = DateTime.now()
    const year = now.year

    // Nombre total de chambres
    const totalRoomsResult = await ServiceProduct
      .query()
      .where('service_id', serviceId)
      .count('* as total')
    const totalRooms = Number(totalRoomsResult[0].$extras.total || '0')

    if (totalRooms === 0) {
      throw new Error('Aucune chambre trouvée pour ce service')
    }

    const results = []

    for (let month = 1; month <= 12; month++) {
      const start = DateTime.local(year, month, 1).startOf('month')
      const end = start.endOf('month')
      const daysInMonth = start.daysInMonth!
      const totalPossibleNights = totalRooms * daysInMonth

      const reservations = await Reservation
        .query()
        .where('service_id', serviceId)
        .whereBetween('arrived_date', [start.toFormat('yyyy-MM-dd'), end.toFormat('yyyy-MM-dd')])

      const occupiedNights = reservations.reduce((sum, res) => {
        if (!res.arrived_date || !res.depart_date) return sum

        const arrived = res.arrived_date instanceof Date
          ? DateTime.fromJSDate(res.arrived_date)
          : DateTime.fromISO(res.arrived_date.toString())

        const depart = res.depart_date instanceof Date
          ? DateTime.fromJSDate(res.depart_date)
          : DateTime.fromISO(res.depart_date.toString())

        const actualStart = arrived < start ? start : arrived
        const actualEnd = depart > end ? end : depart

        const nights = actualEnd.diff(actualStart, 'days').days
        return sum + (nights > 0 ? nights : 0)
      }, 0)

      const occupancyRate = totalPossibleNights > 0
        ? Math.round((occupiedNights / totalPossibleNights) * 10000) / 100
        : 0

      results.push({
        month: start.toFormat('MMM'),
        occupancyRate,
      })
    }

    return results
  }
 
public static async getAverageDailyRate(serviceId: number, period: PeriodType) {
  const validPeriods: PeriodType[] = ['monthly', 'quarterly', 'semester', 'yearly']
  if (!validPeriods.includes(period)) {
    throw new Error(`Invalid period: ${period}. Valid periods are: ${validPeriods.join(', ')}`)
  }
  
  const now = DateTime.now()
  
  // Configuration des périodes
  const periodConfigs = {
    monthly: { start: now.startOf('month'), subtract: { months: 1 } },
    quarterly: { start: now.startOf('quarter'), subtract: { months: 3 } },
    semester: { 
      start: DateTime.fromObject({ year: now.year, month: now.month <= 6 ? 1 : 7 }),
      subtract: { months: 6 }
    },
    yearly: { start: now.startOf('year'), subtract: { years: 1 } }
  }
  
  const config = periodConfigs[period]
  const current = config.start
  const previous = current.minus(config.subtract)
  const currentEnd = current.plus(config.subtract)
  const previousEnd = previous.plus(config.subtract)
  
  // Vérification des chambres
  const totalRoomsResult = await ServiceProduct.query()
    .where('service_id', serviceId)
    .count('* as total')
  
  if (Number(totalRoomsResult[0].$extras.total || '0') === 0) {
    throw new Error('Aucune chambre trouvée pour ce service')
  }
  
  // Récupération des réservations
  const getReservations = (start: DateTime, end: DateTime) => 
    Reservation.query()
      .where('service_id', serviceId)
      .where('status', 'confirmed')
      .whereBetween('arrived_date', [start.toFormat('yyyy-MM-dd'), end.toFormat('yyyy-MM-dd')])
  
  const [currentReservations, previousReservations] = await Promise.all([
    getReservations(current, currentEnd),
    getReservations(previous, previousEnd)
  ])
  
  // Calcul de l'ADR
  const calculateADR = (reservations: Reservation[], start: DateTime, end: DateTime) => {
    let totalRevenue = 0
    let totalNights = 0
    
    for (const res of reservations) {
      if (!res.arrived_date || !res.depart_date || !res.total_amount) continue
      
      // Normalisation des dates
      const arrivalDate = res.arrived_date instanceof Date 
        ? DateTime.fromJSDate(res.arrived_date)
        : typeof res.arrived_date === 'string' 
          ? DateTime.fromISO(res.arrived_date)
          : res.arrived_date as DateTime
      
      const departDate = res.depart_date instanceof Date 
        ? DateTime.fromJSDate(res.depart_date)
        : typeof res.depart_date === 'string' 
          ? DateTime.fromISO(res.depart_date)
          : res.depart_date as DateTime
      
      if (!arrivalDate.isValid || !departDate.isValid) continue
      
      // Calcul des nuits dans la période
      const actualStart = arrivalDate < start ? start : arrivalDate
      const actualEnd = departDate > end ? end : departDate
      const nights = actualEnd.diff(actualStart, 'days').days
      
      if (nights > 0) {
        const totalStayNights = departDate.diff(arrivalDate, 'days').days
        const proportionalRevenue = totalStayNights > 0 
          ? (Number(res.total_amount) * nights) / totalStayNights 
          : Number(res.total_amount)
        
        totalRevenue += proportionalRevenue
        totalNights += nights
      }
    }
    
    return totalNights > 0 ? Math.round((totalRevenue / totalNights) * 100) / 100 : 0
  }
  
  const currentADR = calculateADR(currentReservations, current, currentEnd)
  const previousADR = calculateADR(previousReservations, previous, previousEnd)
  
  // Calcul de la variation
  const variationPercentage = previousADR === 0 
    ? (currentADR > 0 ? 100 : 0)
    : Math.round(((currentADR - previousADR) / previousADR) * 10000) / 100
  
  return {
    currentADR,
    previousADR,
    variationPercentage
  }
}
// public static async getNationalityStats(): Promise<{ nationality: string, count: number }[]> {
//     // Récupérer toutes les réservations avec les utilisateurs associés
//     const reservations = await Reservation
//       .query()
//       .preload('user') // assure-toi que la relation user existe dans Reservation

//     // Créer un dictionnaire de nationalités
//     const nationalityMap: Record<string, number> = {}

//     for (const reservation of reservations) {
//       const nationality = reservation.user?.nationality || 'Inconnue'

//       if (!nationalityMap[nationality]) {
//         nationalityMap[nationality] = 0
//       }

//       nationalityMap[nationality]++
//     }

//     // Convertir en tableau
//     return Object.entries(nationalityMap).map(([nationality, count]) => ({
//       nationality,
//       count
//     }))
//   }
 public static async getStayDurationDistribution(serviceId: number) {
    const reservations = await Reservation
      .query()
      .where('service_id', serviceId)
      .select('arrived_date', 'depart_date')

    // Compteurs pour chaque catégorie
    let oneToTwo = 0
    let threeToFive = 0
    let sixToTen = 0
    let overTen = 0
    let total = 0

    for (const res of reservations) {
      if (!(res.arrived_date instanceof Date) || !(res.depart_date instanceof Date)) continue

      const start = DateTime.fromJSDate(res.arrived_date)
      const end = DateTime.fromJSDate(res.depart_date)

      if (!start.isValid || !end.isValid) continue

      const nights = end.diff(start, 'days').days

      if (nights <= 0) continue

      total++

      if (nights <= 2) oneToTwo++
      else if (nights <= 5) threeToFive++
      else if (nights <= 10) sixToTen++
      else overTen++
    }

    const toPercentage = (count: number) =>
      total > 0 ? Math.round((count / total) * 10000) / 100 : 0

    return {
      '1-2 nuits': toPercentage(oneToTwo),
      '3-5 nuits': toPercentage(threeToFive),
      '6-10 nuits': toPercentage(sixToTen),
      '10+ nuits': toPercentage(overTen)
    }
  }
}