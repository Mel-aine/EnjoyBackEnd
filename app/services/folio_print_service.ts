import { DateTime } from 'luxon'
import Folio from '#models/folio'
import Reservation from '#models/reservation'
import Hotel from '#models/hotel'
import Guest from '#models/guest'
import FolioTransaction from '#models/folio_transaction'
import Currency from '#models/currency'
import User from '#models/user'
import TaxRate from '#models/tax_rate'
import { TransactionCategory } from '../enums.js'
import logger from '@adonisjs/core/services/logger'

export interface FolioPrintData {
  hotel: Hotel
  reservation: Reservation
  folio: {
    id: number
    folioNumber: string
    folioName: string
    status: string
    openedDate: DateTime
    closedDate?: DateTime
    currencyCode: string
    exchangeRate: number
  }
  transactions: Array<{
    id: number
    transactionNumber: string
    date: DateTime
    description: string
    category: string
    amount: number
    taxAmount: number
    serviceChargeAmount: number
    discountAmount: number
    netAmount: number
    status: string
  }>
  totals: {
    grandTotal: number
    totalTax: number
    totalPaid: number
    balance: number
    totalCharges: number
    totalPayments: number
    totalAdjustments: number
    totalDiscounts: number
    totalServiceCharges: number
  }
  taxRates: Array<{
    id: number
    name: string
    shortName: string
    percentage: number | null
    amount: number | null
    postingType: string
    appliesToRoomRate: boolean
    appliesToFnb: boolean
    appliesToOtherServices: boolean
  }>
  billingAddress: {
    name?: string
    address?: string
    city?: string
    state?: string
    country?: string
    postalCode?: string
    phone?: string
    email?: string
    taxId?: string
  }
  currency: {
    code: string
    symbol: string
    name: string
  }
  printInfo: {
    printedDate: DateTime
    printedBy: string
    printCount: number
  }
}

export class FolioPrintService {
  /**
   * Generate folio print data with complete invoice details
   * @param folioId - The folio ID to print
   * @param reservationId - The reservation ID
   * @param currencyId - The currency ID for display
   * @returns Complete folio print data
   */
  public async generateFolioPrintData(
    folioId: number,
    reservationId: number,
    currencyId?: number
  ): Promise<FolioPrintData> {
    // Load folio with all relationships
    const folio = await Folio.query()
      .where('id', folioId)
      .preload('hotel')
      .preload('guest')
      .preload('reservation', (reservationQuery) => {
        reservationQuery
         // .preload('hotel')
          .preload('guest')
          .preload('roomType')
          .preload('reservationRooms', (roomQuery) => {
            roomQuery.preload('room', (roomSubQuery) => {
              roomSubQuery.preload('taxRates')
            }).preload('roomType')
          })
          //.preload('creator')
          //.preload('checkedOutByUser')
        //  .preload('reservedByUser')
      })
      .preload('transactions', (transactionQuery) => {
        transactionQuery
          .where('isVoided', false)
          .preload('paymentMethod')
          .orderBy('transactionDate', 'asc')
          .orderBy('createdAt', 'asc')
      })
      .firstOrFail()



    // Load reservation separately if needed
    const reservation = await Reservation.query()
      .where('id', reservationId)
      //.preload('hotel')
      .preload('guest')
      .preload('roomType')
      //.preload('checkedInByUser')
      //.preload('checkedOutByUser')
     // .preload('reservedByUser')
      .firstOrFail()

    // Load currency information
    let currency = {
      code: folio.currencyCode || 'USD',
      symbol: '$',
      name: 'US Dollar'
    }

    if (currencyId) {
      const currencyModel = await Currency.find(currencyId)
      if (currencyModel) {
        currency = {
          code: currencyModel.currencyCode,
          symbol: currencyModel.sign,
          name: currencyModel.name
        }
      }
    }

    // Collect tax rates from rooms
    const taxRates = this.collectTaxRatesFromRooms(reservation)

    // Calculate totals with room-specific tax rates
    const totals = this.calculateTotals(folio, folio.transactions, taxRates)

    // Prepare hotel information
    const hotel = {
      id: folio.hotel.id,
      name: folio.hotel.hotelName,
      address: folio.hotel.address || '',
      city: folio.hotel.city || '',
      state: folio.hotel.stateProvince || '',
      country: folio.hotel.country || '',
      postalCode: folio.hotel.postalCode || '',
      phone: folio.hotel.phoneNumber || '',
      email: folio.hotel.email || '',
      website: folio.hotel.website || '',
      logo: folio.hotel.logoUrl || undefined,
      registrationNumber:folio.hotel.registrationNo1,
      rcNumber:folio.hotel.registrationNo2
    }

    // Prepare reservation information
    const reservationData = {
      guest:reservation.guest,
      id: reservation.id,
      confirmationCode: reservation.confirmationCode,
      guestName: reservation.guest?.firstName + ' ' + reservation.guest?.lastName || 'Guest',
      checkInDate: reservation.checkInDate || reservation.scheduledArrivalDate,
      checkOutDate: reservation.checkOutDate || reservation.scheduledDepartureDate,
      numberOfNights: reservation.numberOfNights || 1,
      roomType: reservation.roomType?.roomTypeName || 'Standard Room',
      adults: reservation.adults || reservation.numAdultsTotal || 1,
      children: reservation.children || reservation.numChildrenTotal || 0,
      status: reservation.status || reservation.reservationStatus,
      checkedInBy: reservation.checkedInByUser?.firstName + ' ' + reservation.checkedInByUser?.lastName,
      checkedOutBy: reservation.checkedOutByUser?.firstName + ' ' + reservation.checkedOutByUser?.lastName,
      reservedBy: reservation.reservedByUser?.firstName + ' ' + reservation.reservedByUser?.lastName
    }

    // Prepare folio information
    const folioData = {
      id: folio.id,
      folioNumber: folio.folioNumber,
      folioName: folio.folioName,
      status: folio.status,
      openedDate: folio.openedDate,
      closedDate: folio.closedDate || undefined,
      currencyCode: folio.currencyCode,
      exchangeRate: folio.exchangeRate || 1
    }

    // Prepare transactions
    const transactions = folio.transactions.map(transaction => ({
      id: transaction.id,
      transactionNumber: transaction.transactionNumber,
      date: transaction.transactionDate,
      description: transaction.description,
      category: transaction.category,
      amount: transaction.amount,
      taxAmount: transaction.taxAmount || 0,
      serviceChargeAmount: transaction.serviceChargeAmount || 0,
      discountAmount: transaction.discountAmount || 0,
      netAmount: transaction.netAmount || transaction.amount,
      status: transaction.status
    }))

    // Prepare billing address
    const billingAddress = {
      name: folio.guest?.firstName + ' ' + folio.guest?.lastName || undefined,
      address: (folio.billingAddress as any)?.address || folio.guest?.address || undefined,
      city: (folio.billingAddress as any)?.city || folio.guest?.city || undefined,
      state: (folio.billingAddress as any)?.state || folio.guest?.displayName || undefined,
      country: (folio.billingAddress as any)?.country || folio.guest?.country || undefined,
      postalCode: (folio.billingAddress as any)?.postalCode || folio.guest?.postalCode || undefined,
      phone: (folio.billingAddress as any)?.phone || folio.guest?.phonePrimary || undefined,
      email: (folio.billingAddress as any)?.email || folio.guest?.email || undefined,
    }

    // Prepare print information
    const printInfo = {
      printedDate: DateTime.now(),
      printedBy: 'System', // This should be set to current user
      printCount: (folio.printCount || 0) + 1
    }

    // Update folio print count
    await folio.merge({
      printCount: printInfo.printCount,
      lastPrintDate: printInfo.printedDate
    }).save()

    return {
      hotel,
      reservation: reservationData,
      folio: folioData,
      transactions,
      totals,
      taxRates,
      billingAddress,
      currency,
      printInfo
    }
  }
  /**
   * Generate booking confirmation print data (without folio or currency)
   * @param reservationId - The reservation ID
   * @returns Booking confirmation print data
   */
  public async generateBookingPrintData(
    reservationId: number
  ): Promise<Omit<FolioPrintData, 'folio' | 'transactions'>> {
    // Load reservation with necessary relationships
    const reservation = await Reservation.query()
      .where('id', reservationId)
      .preload('hotel')
      .preload('guest')
      .preload('roomType')
      .preload('folios', (folioQuery) => {
        folioQuery.preload('transactions')
      })
      .preload('reservationRooms', (roomQuery) => {
        roomQuery.preload('room', (roomSubQuery) => {
          roomSubQuery.preload('taxRates')
        }).preload('roomType').preload('roomRates', (rateQuery) => {
          rateQuery.preload('rateType')
        })
      })
      // .preload('checkedInByUser')
      // .preload('checkedOutByUser')
      // .preload('reservedByUser')
      .firstOrFail()

    if (!reservation.hotel) {
      throw new Error('Hotel not found for this reservation')
    }

    // Collect tax rates from rooms
    const taxRates = this.collectTaxRatesFromRooms(reservation)

    // Calculate estimated totals for booking
    const totals = this.calculateBalanceSummary(reservation.folios)
    logger.info(totals)

    // Prepare hotel information - EN CAMELCASE
    const hotelData = reservation.hotel

    // Prepare reservation information - EN CAMELCASE
    const reservationData = reservation

    // Prepare billing address from guest - EN CAMELCASE
    const billingAddress = {
      name: reservation.guest ? 
        `${reservation.guest.firstName} ${reservation.guest.lastName}` : undefined,
      address: reservation.guest?.address || undefined,
      city: reservation.guest?.city || undefined,
      state: reservation.guest?.stateProvince || undefined,
      country: reservation.guest?.country || undefined,
      postalCode: reservation.guest?.postalCode || undefined,
      phone: reservation.guest?.phonePrimary || undefined,
      email: reservation.guest?.email || undefined,
      taxId: reservation.guest?.taxId || undefined
    }

    const currency = {
      code: reservation.hotel.currencyCode || 'USD',
      symbol: reservation.hotel.currencySymbol || '$',
      name: reservation.hotel.currencyName || 'US Dollar'
    }



    // Prepare print information
    const printInfo = {
      printedDate: DateTime.now(),
      printedBy: 'System',
      printCount: 1
    }

    return {
      hotel: hotelData,
      reservation: reservationData,
      totals,
      taxRates,
      billingAddress,
      currency,
      printInfo
    }
  }

  /**
 * Generate folio print data for Suita Hotel template
 * This method only requires reservationId as it focuses on booking confirmation
 */
  public async generateHotelFolioPrintData(
    reservationId: number
  ): Promise<Omit<FolioPrintData, 'folio' | 'transactions'>> {
    try {
      // Load reservation with necessary relationships
      const reservation = await Reservation.query()
        .where('id', reservationId)
        .preload('hotel')
        .preload('guest')
        .preload('roomType')
        .preload('reservationRooms', (roomQuery) => {
          roomQuery
            .preload('room', (roomSubQuery) => {
              roomSubQuery.preload('taxRates')
            }).preload('roomType')
        })
        // .preload('checkedInByUser')
        // .preload('checkedOutByUser')
        // .preload('reservedByUser')
        .firstOrFail()

            // Charger le folio associé à cette réservation
      const folio = await Folio.query()
          .where('reservationId', reservationId)
          .preload('transactions', (transactionQuery) => {
            transactionQuery
              .where('isVoided', false)
              .orderBy('transactionDate', 'asc')
              .orderBy('createdAt', 'asc')
          })
          .first()
        
        if (!folio) {
          throw new Error('No folio found for this reservation')
        }
        

      if (!reservation.hotel) {
        throw new Error('Hotel not found for this reservation')
      }

      // Collect tax rates from rooms
      const taxRates = this.collectTaxRatesFromRooms(reservation)

      // Calculate estimated totals for booking
      const totals = this.calculateBookingTotals(reservation, taxRates)

      // Prepare hotel information
      const hotel = {
        id: reservation.hotel.id,
        name: reservation.hotel.hotelName,
        address: reservation.hotel.address || '',
        city: reservation.hotel.city || '',
        state: reservation.hotel.stateProvince || '',
        country: reservation.hotel.country || '',
        postalCode: reservation.hotel.postalCode || '',
        phone: reservation.hotel.phoneNumber || '',
        email: reservation.hotel.email || '',
        website: reservation.hotel.website || '',
        logo: reservation.hotel.logoUrl || undefined,
        registrationNumber: reservation.hotel.registrationNo1,
        rcNumber: reservation.hotel.registrationNo2
      }
      const transactions = folio.transactions.map(transaction => ({
        id: transaction.id,
        transactionNumber: transaction.transactionNumber,
        date: transaction.transactionDate,
        description: transaction.description,
        category: transaction.category,
        amount: transaction.amount,
        taxAmount: transaction.taxAmount || 0,
        serviceChargeAmount: transaction.serviceChargeAmount || 0,
        discountAmount: transaction.discountAmount || 0,
        netAmount: transaction.netAmount || transaction.amount,
        status: transaction.status
      }))
      // Prepare reservation information
      const reservationData = {
        guest: reservation.guest,
        id: reservation.id,
        confirmationCode: reservation.confirmationCode,
        guestName: reservation.guest ? 
          `${reservation.guest.firstName || ''} ${reservation.guest.lastName || ''}`.trim() : 
          'Guest',
        checkInDate: reservation.checkInDate || reservation.scheduledArrivalDate,
        checkOutDate: reservation.checkOutDate || reservation.scheduledDepartureDate,
        numberOfNights: reservation.numberOfNights || 1,
        roomType: reservation.roomType?.roomTypeName || 'Standard Room',
        adults: reservation.adults || 1,
        children: reservation.children || 0,
        status: reservation.status || 'Confirmed',
        checkedInBy: reservation.checkedInByUser ? 
          `${reservation.checkedInByUser.firstName} ${reservation.checkedInByUser.lastName}` : undefined,
        checkedOutBy: reservation.checkedOutByUser ? 
          `${reservation.checkedInByUser.firstName} ${reservation.checkedInByUser.lastName}` : undefined,
        reservedBy: reservation.reservedByUser ? 
          `${reservation.reservedByUser.firstName} ${reservation.reservedByUser.lastName}` : undefined,
        roomCharge: reservation.roomRate || 0,
        actualArrivalDatetime: reservation.actualArrivalDatetime
      }

          // Prepare folio information
      const folioData = {
        id: folio.id,
        folioNumber: folio.folioNumber,
        folioName: folio.folioName,
        status: folio.status,
        openedDate: folio.openedDate,
        closedDate: folio.closedDate || undefined,
        currencyCode: folio.currencyCode,
        exchangeRate: folio.exchangeRate || 1
      }

      // Prepare billing address from guest
      const billingAddress = {
        name: reservation.guest ? 
          `${reservation.guest.firstName} ${reservation.guest.lastName}` : undefined,
        address: reservation.guest?.address || undefined,
        city: reservation.guest?.city || undefined,
        state: reservation.guest?.stateProvince || undefined,
        country: reservation.guest?.country || undefined,
        postalCode: reservation.guest?.postalCode || undefined,
        phone: reservation.guest?.phonePrimary || undefined,
        email: reservation.guest?.email || undefined,
        taxId: reservation.guest?.taxId || undefined
      }

      // Prepare currency information
      const currency = {
        code: reservation.hotel.currencyCode || 'XAF',
        symbol: reservation.hotel.currencySymbol || 'FCFA',
        name: reservation.hotel.currencyName || 'Central African CFA Franc'
      }

      // Prepare print information
      const printInfo = {
        printedDate: DateTime.now(),
        printedBy: 'System',
        printCount: 1
      }

      return {
        hotel,
        reservation: reservationData,
        folio: folioData,
        transactions,
        totals,
        taxRates,
        billingAddress,
        currency,
        printInfo
      }
    } catch (error) {
      throw new Error(`Failed to generate Suita Hotel print data: ${error.message}`)
    }
  }


  /**
   * Calculate balance summary from folio transactions
   */
  private calculateBalanceSummary(folios: any[]) {
    let totalCharges = 0
    let totalPayments = 0
    let totalAdjustments = 0
    let totalTaxes = 0
    let totalServiceCharges = 0
    let totalDiscounts = 0

    folios.forEach(folio => {
      if (folio.transactions) {
        folio.transactions.forEach((transaction: any) => {
          const amount = parseFloat(transaction.amount) || 0

          switch (transaction.transactionType) {
            case 'charge':
              totalCharges += amount
              break
            case 'payment':
              totalPayments += amount
              break
            case 'adjustment':
              totalAdjustments += amount
              break
            case 'tax':
              totalTaxes += amount
              break
            case 'discount':
              totalDiscounts += Math.abs(amount) // Discounts are typically negative
              break
            case 'refund':
              totalPayments -= amount // Refunds reduce payments
              break
          }

          // Add service charges and taxes from transaction details
          if (transaction.serviceChargeAmount) {
            totalServiceCharges += parseFloat(transaction.serviceChargeAmount) || 0
          }
          if (transaction.taxAmount) {
            totalTaxes += parseFloat(transaction.taxAmount) || 0
          }
        })
      }
    })

    const outstandingBalance = totalCharges + totalTaxes + totalServiceCharges - totalPayments - totalDiscounts + totalAdjustments

    return {
      totalCharges: parseFloat(totalCharges.toFixed(2)),
      totalPayments: parseFloat(totalPayments.toFixed(2)),
      totalAdjustments: parseFloat(totalAdjustments.toFixed(2)),
      totalTaxes: parseFloat(totalTaxes.toFixed(2)),
      totalServiceCharges: parseFloat(totalServiceCharges.toFixed(2)),
      totalDiscounts: parseFloat(totalDiscounts.toFixed(2)),
      outstandingBalance: parseFloat(outstandingBalance.toFixed(2)),
      totalChargesWithTaxes: parseFloat((totalCharges + totalTaxes + totalServiceCharges).toFixed(2)),
      balanceStatus: outstandingBalance > 0 ? 'outstanding' : outstandingBalance < 0 ? 'credit' : 'settled'
    }
  }
/**
 * Calculate estimated totals for booking confirmation
 */
  private calculateBookingTotals(reservation: Reservation, taxRates: any[]) {
    const roomCharge = reservation.roomRate || reservation.baseRate || 0
    const numberOfNights = reservation.numberOfNights || 1
    
    // Calculate base charges
    const totalCharges = roomCharge * numberOfNights
    
    // Calculate estimated taxes
    let totalTax = 0
    taxRates.forEach(taxRate => {
      if (taxRate.appliesToRoomRate) {
        if (taxRate.postingType === 'flat_percentage' && taxRate.percentage) {
          totalTax += (totalCharges * taxRate.percentage) / 100
        } else if (taxRate.postingType === 'flat_amount' && taxRate.amount) {
          totalTax += taxRate.amount * numberOfNights
        }
      }
    })
    
    // For booking confirmation, assume no payments or adjustments yet
    const totalPayments = 0
    const totalAdjustments = 0
    const totalDiscounts = 0
    const totalServiceCharges = 0
    
    const grandTotal = totalCharges + totalTax + totalServiceCharges - totalDiscounts
    const balance = grandTotal - totalPayments - totalAdjustments

    return {
      grandTotal,
      totalTax,
      totalPaid: totalPayments,
      balance,
      totalCharges,
      totalPayments,
      totalAdjustments,
      totalDiscounts,
      totalServiceCharges
    }
  }

  /**
   * Calculate all totals for the folio
   */
  private collectTaxRatesFromRooms(reservation: Reservation) {
    const taxRatesMap = new Map()

    // Collect unique tax rates from all rooms in the reservation
    reservation.reservationRooms?.forEach(reservationRoom => {
      reservationRoom.room?.taxRates?.forEach(taxRate => {  
        if (taxRate.isActive && !taxRatesMap.has(taxRate.taxRateId)) {
          taxRatesMap.set(taxRate.taxRateId, {
            id: taxRate.taxRateId,
            name: taxRate.taxName,
            shortName: taxRate.shortName,
            percentage: taxRate.percentage,
            amount: taxRate.amount,
            postingType: taxRate.postingType,
            appliesToRoomRate: taxRate.appliesToRoomRate,
            appliesToFnb: taxRate.appliesToFnb,
            appliesToOtherServices: taxRate.appliesToOtherServices
          })
        }
      })
    })
    
    return Array.from(taxRatesMap.values())
  }

  private calculateTaxForTransaction(transaction: FolioTransaction, taxRates: any[]): number {
    let totalTax = 0
    
    // Apply applicable tax rates based on transaction category
    taxRates.forEach(taxRate => {
      let shouldApplyTax = false
      
      // Determine if tax should be applied based on transaction category
      if (transaction.category === 'room' && taxRate.appliesToRoomRate) {
        shouldApplyTax = true
      } else if (transaction.category === TransactionCategory.SERVICE_CHARGE && taxRate.appliesToFnb) {
        shouldApplyTax = true
      } else if (transaction.category !== 'room' && transaction.category !== TransactionCategory.SERVICE_CHARGE && taxRate.appliesToOtherServices) {
        shouldApplyTax = true
      }
      
      if (shouldApplyTax) {
        if (taxRate.postingType === 'flat_percentage' && taxRate.percentage) {
          totalTax += (transaction.amount * taxRate.percentage) / 100
        } else if (taxRate.postingType === 'flat_amount' && taxRate.amount) {
          totalTax += taxRate.amount
        }
      }
    })
    
    return totalTax
  }

  private calculateTotals(folio: Folio, transactions: FolioTransaction[], taxRates: any[]) {
    let totalCharges = 0
    let totalPayments = 0
    let totalTax = 0
    let totalServiceCharges = 0
    let totalDiscounts = 0
    let totalAdjustments = 0

    transactions.forEach(transaction => {
      if (transaction.transactionType === 'charge') {
        totalCharges += transaction.amount
        
        // Calculate tax based on room tax rates if not already calculated
        if (!transaction.taxAmount && taxRates.length > 0) {
          const calculatedTax = this.calculateTaxForTransaction(transaction, taxRates)
          totalTax += calculatedTax
        } else {
          totalTax += transaction.taxAmount || 0
        }
      } else if (transaction.transactionType === 'payment') {
        totalPayments += Math.abs(transaction.amount)
      } else if (transaction.transactionType === 'adjustment') {
        totalAdjustments += transaction.amount
      } else {
        totalTax += transaction.taxAmount || 0
      }

      totalServiceCharges += transaction.serviceChargeAmount || 0
      totalDiscounts += transaction.discountAmount || 0
    })

    const grandTotal = totalCharges + totalTax + totalServiceCharges - totalDiscounts
    const balance = grandTotal - totalPayments - totalAdjustments

    return {
      grandTotal,
      totalTax,
      totalPaid: totalPayments,
      balance,
      totalCharges,
      totalPayments,
      totalAdjustments,
      totalDiscounts,
      totalServiceCharges
    }
  }
}

export default new FolioPrintService()