import vine from '@vinejs/vine'
import { DateTime } from 'luxon'

/**
 * Validator to validate the payload when creating
 * a new room rate.
 */
export const createRoomRateValidator = vine.compile(
  vine.object({
    roomTypeId: vine.number().positive(),
    rateTypeId: vine.number().positive(),
    seasonId: vine.number().positive().optional(),
    sourceId: vine.number().positive().optional(),
    baseRate: vine.number().min(0),
    extraAdultRate: vine.number().min(0).optional(),
    extraChildRate: vine.number().min(0).optional(),
    effectiveFrom: vine.date().transform((value) => value ? DateTime.fromJSDate(value) : value).optional(),
    effectiveTo: vine.date().transform((value) => value ? DateTime.fromJSDate(value) : value).optional(),
    status: vine.enum(['active', 'inactive', 'draft']).optional(),
    
    // Optional fields from existing model
    hotelId: vine.number().positive().optional(),
    ratePlanId: vine.number().positive().optional(),
    rateDate: vine.date().transform((value) => value ? DateTime.fromJSDate(value) : value).optional(),
    extraPersonRate: vine.number().min(0).optional(),
    singleOccupancyRate: vine.number().min(0).optional(),
    doubleOccupancyRate: vine.number().min(0).optional(),
    tripleOccupancyRate: vine.number().min(0).optional(),
    weekendRate: vine.number().min(0).optional(),
    holidayRate: vine.number().min(0).optional(),
    peakSeasonRate: vine.number().min(0).optional(),
    offSeasonRate: vine.number().min(0).optional(),
    minimumNights: vine.number().min(1).optional(),
    maximumNights: vine.number().min(1).optional(),
    closedToArrival: vine.boolean().optional(),
    closedToDeparture: vine.boolean().optional(),
    stopSell: vine.boolean().optional(),
    availableRooms: vine.number().min(0).optional(),
    roomsSold: vine.number().min(0).optional(),
    occupancyPercentage: vine.number().min(0).max(100).optional(),
    dayType: vine.string().maxLength(50).optional(),
    isSpecialEvent: vine.boolean().optional(),
    specialEventName: vine.string().maxLength(255).optional(),
    demandMultiplier: vine.number().min(0).optional(),
    restrictions: vine.object({}).optional(),
    bookingRules: vine.object({}).optional(),
    rateNotes: vine.string().maxLength(1000).optional(),
    isPublished: vine.boolean().optional(),
    lastUpdatedBySystem: vine.boolean().optional(),
    autoCalculated: vine.boolean().optional(),
    calculationSource: vine.string().maxLength(100).optional(),
    competitorRates: vine.object({}).optional(),
    revenueGenerated: vine.number().min(0).optional(),
    bookingsCount: vine.number().min(0).optional(),
    averageDailyRate: vine.number().min(0).optional(),
    revenuePerAvailableRoom: vine.number().min(0).optional(),
    createdBy: vine.number().positive().optional(),
    lastModifiedBy: vine.number().positive().optional()
  })
)

/**
 * Validator to validate the payload when updating
 * an existing room rate.
 */
export const updateRoomRateValidator = vine.compile(
  vine.object({
    roomTypeId: vine.number().positive().optional(),
    rateTypeId: vine.number().positive().optional(),
    seasonId: vine.number().positive().optional(),
    sourceId: vine.number().positive().optional(),
    baseRate: vine.number().min(0).optional(),
    extraAdultRate: vine.number().min(0).optional(),
    extraChildRate: vine.number().min(0).optional(),
    effectiveFrom: vine.date().transform((value) => value ? DateTime.fromJSDate(value) : value).optional(),
    effectiveTo: vine.date().transform((value) => value ? DateTime.fromJSDate(value) : value).optional(),
    status: vine.enum(['active', 'inactive', 'draft']).optional(),
    
    // Optional fields from existing model
    hotelId: vine.number().positive().optional(),
    ratePlanId: vine.number().positive().optional(),
    rateDate: vine.date().transform((value) => value ? DateTime.fromJSDate(value) : value).optional(),
    extraPersonRate: vine.number().min(0).optional(),
    singleOccupancyRate: vine.number().min(0).optional(),
    doubleOccupancyRate: vine.number().min(0).optional(),
    tripleOccupancyRate: vine.number().min(0).optional(),
    weekendRate: vine.number().min(0).optional(),
    holidayRate: vine.number().min(0).optional(),
    peakSeasonRate: vine.number().min(0).optional(),
    offSeasonRate: vine.number().min(0).optional(),
    minimumNights: vine.number().min(1).optional(),
    maximumNights: vine.number().min(1).optional(),
    closedToArrival: vine.boolean().optional(),
    closedToDeparture: vine.boolean().optional(),
    stopSell: vine.boolean().optional(),
    availableRooms: vine.number().min(0).optional(),
    roomsSold: vine.number().min(0).optional(),
    occupancyPercentage: vine.number().min(0).max(100).optional(),
    dayType: vine.string().maxLength(50).optional(),
    isSpecialEvent: vine.boolean().optional(),
    specialEventName: vine.string().maxLength(255).optional(),
    demandMultiplier: vine.number().min(0).optional(),
    restrictions: vine.object({}).optional(),
    bookingRules: vine.object({}).optional(),
    rateNotes: vine.string().maxLength(1000).optional(),
    isPublished: vine.boolean().optional(),
    lastUpdatedBySystem: vine.boolean().optional(),
    autoCalculated: vine.boolean().optional(),
    calculationSource: vine.string().maxLength(100).optional(),
    competitorRates: vine.object({}).optional(),
    revenueGenerated: vine.number().min(0).optional(),
    bookingsCount: vine.number().min(0).optional(),
    averageDailyRate: vine.number().min(0).optional(),
    revenuePerAvailableRoom: vine.number().min(0).optional(),
    createdBy: vine.number().positive().optional(),
    lastModifiedBy: vine.number().positive().optional()
  })
)