import vine from '@vinejs/vine'

/**
 * Validator to validate the payload when creating
 * a new room type.
 */
export const createRoomTypeValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive(),
    name: vine.string().trim().minLength(1).maxLength(100),
    code: vine.string().trim().minLength(1).maxLength(20),
    description: vine.string().trim().maxLength(1000).optional(),
    category: vine.enum(['standard', 'deluxe', 'suite', 'presidential', 'penthouse', 'villa', 'apartment', 'studio']).optional(),
    baseRate: vine.number().min(0),
    maxAdults: vine.number().min(1).max(10),
    maxChildren: vine.number().min(0).max(10),
    maxOccupancy: vine.number().min(1).max(20),
    maxInfants: vine.number().min(0).max(5),
    bedType: vine.enum(['single', 'double', 'queen', 'king', 'twin', 'sofa_bed', 'murphy_bed', 'bunk_bed']).optional(),
    bedCount: vine.number().min(1).max(10),
    bathroomCount: vine.number().min(1).max(5),
    size: vine.number().min(1).optional(),
    sizeUnit: vine.enum(['sqft', 'sqm']).optional(),
    floor: vine.number().min(0).optional(),
    view: vine.enum(['ocean', 'city', 'garden', 'pool', 'mountain', 'courtyard', 'interior']).optional(),
    smokingAllowed: vine.boolean().optional(),
    petFriendly: vine.boolean().optional(),
    accessible: vine.boolean().optional(),
    connectingRooms: vine.boolean().optional(),
    balcony: vine.boolean().optional(),
    terrace: vine.boolean().optional(),
    kitchenette: vine.boolean().optional(),
    livingRoom: vine.boolean().optional(),
    diningArea: vine.boolean().optional(),
    workDesk: vine.boolean().optional(),
    amenities: vine.array(vine.string().trim().maxLength(100)).optional(),
    features: vine.array(vine.string().trim().maxLength(100)).optional(),
    technology: vine.array(vine.string().trim().maxLength(100)).optional(),
    bathroom: vine.array(vine.string().trim().maxLength(100)).optional(),
    entertainment: vine.array(vine.string().trim().maxLength(100)).optional(),
    comfort: vine.array(vine.string().trim().maxLength(100)).optional(),
    safety: vine.array(vine.string().trim().maxLength(100)).optional(),
    business: vine.array(vine.string().trim().maxLength(100)).optional(),
    family: vine.array(vine.string().trim().maxLength(100)).optional(),
    luxury: vine.array(vine.string().trim().maxLength(100)).optional(),
    images: vine.array(
      vine.object({
        url: vine.string().url(),
        caption: vine.string().trim().maxLength(255).optional(),
        isPrimary: vine.boolean().optional(),
        sortOrder: vine.number().min(0).optional()
      })
    ).optional(),
    floorPlan: vine.string().url().optional(),
    virtualTour: vine.string().url().optional(),
    policies: vine.object({
      checkIn: vine.string().trim().maxLength(500).optional(),
      checkOut: vine.string().trim().maxLength(500).optional(),
      cancellation: vine.string().trim().maxLength(500).optional(),
      smoking: vine.string().trim().maxLength(500).optional(),
      pets: vine.string().trim().maxLength(500).optional(),
      children: vine.string().trim().maxLength(500).optional(),
      extraBed: vine.string().trim().maxLength(500).optional(),
      damage: vine.string().trim().maxLength(500).optional()
    }).optional(),
    pricing: vine.object({
      weekdayRate: vine.number().min(0).optional(),
      weekendRate: vine.number().min(0).optional(),
      seasonalRates: vine.array(
        vine.object({
          name: vine.string().trim().maxLength(100),
          startDate: vine.date(),
          endDate: vine.date(),
          rate: vine.number().min(0)
        })
      ).optional(),
      extraAdultFee: vine.number().min(0).optional(),
      extraChildFee: vine.number().min(0).optional(),
      extraBedFee: vine.number().min(0).optional(),
      petFee: vine.number().min(0).optional(),
      cleaningFee: vine.number().min(0).optional(),
      resortFee: vine.number().min(0).optional(),
      serviceFee: vine.number().min(0).optional(),
      taxRate: vine.number().min(0).max(100).optional()
    }).optional(),
    availability: vine.object({
      totalRooms: vine.number().min(0).optional(),
      availableRooms: vine.number().min(0).optional(),
      blockedRooms: vine.number().min(0).optional(),
      maintenanceRooms: vine.number().min(0).optional(),
      outOfOrderRooms: vine.number().min(0).optional()
    }).optional(),
    restrictions: vine.object({
      minStay: vine.number().min(1).optional(),
      maxStay: vine.number().min(1).optional(),
      minAdvanceBooking: vine.number().min(0).optional(),
      maxAdvanceBooking: vine.number().min(1).optional(),
      blackoutDates: vine.array(vine.date()).optional(),
      restrictedDates: vine.array(vine.date()).optional()
    }).optional(),
    packages: vine.array(
      vine.object({
        name: vine.string().trim().maxLength(100),
        description: vine.string().trim().maxLength(500).optional(),
        inclusions: vine.array(vine.string().trim().maxLength(100)),
        additionalFee: vine.number().min(0).optional(),
        isActive: vine.boolean().optional()
      })
    ).optional(),
    promotions: vine.array(
      vine.object({
        name: vine.string().trim().maxLength(100),
        description: vine.string().trim().maxLength(500).optional(),
        discountType: vine.enum(['percentage', 'fixed']),
        discountValue: vine.number().min(0),
        startDate: vine.date(),
        endDate: vine.date(),
        isActive: vine.boolean().optional()
      })
    ).optional(),
    housekeeping: vine.object({
      cleaningTime: vine.number().min(15).optional(),
      inspectionRequired: vine.boolean().optional(),
      specialInstructions: vine.string().trim().maxLength(1000).optional(),
      supplies: vine.array(vine.string().trim().maxLength(100)).optional()
    }).optional(),
    maintenance: vine.object({
      lastMaintenance: vine.date().optional(),
      nextMaintenance: vine.date().optional(),
      maintenanceSchedule: vine.enum(['weekly', 'monthly', 'quarterly', 'annually']).optional(),
      specialRequirements: vine.string().trim().maxLength(1000).optional()
    }).optional(),
    marketing: vine.object({
      marketingName: vine.string().trim().maxLength(100).optional(),
      shortDescription: vine.string().trim().maxLength(200).optional(),
      longDescription: vine.string().trim().maxLength(1000).optional(),
      highlights: vine.array(vine.string().trim().maxLength(100)).optional(),
      targetMarket: vine.array(vine.string().trim().maxLength(50)).optional(),
      keywords: vine.array(vine.string().trim().maxLength(50)).optional()
    }).optional(),
    analytics: vine.object({
      averageOccupancy: vine.number().min(0).max(100).optional(),
      averageDailyRate: vine.number().min(0).optional(),
      revenuePerAvailableRoom: vine.number().min(0).optional(),
      averageStayLength: vine.number().min(0).optional(),
      guestSatisfactionScore: vine.number().min(1).max(10).optional(),
      repeatGuestPercentage: vine.number().min(0).max(100).optional()
    }).optional(),
    isActive: vine.boolean().optional(),
    isBookable: vine.boolean().optional(),
    isFeatured: vine.boolean().optional(),
    isPromoted: vine.boolean().optional(),
    sortOrder: vine.number().min(0).optional(),
    createdBy: vine.number().positive().optional(),
    lastModifiedBy: vine.number().positive().optional()
  })
)

/**
 * Validator to validate the payload when updating
 * an existing room type.
 */
export const updateRoomTypeValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive().optional(),
    name: vine.string().trim().minLength(1).maxLength(100).optional(),
    code: vine.string().trim().minLength(1).maxLength(20).optional(),
    description: vine.string().trim().maxLength(1000).optional(),
    category: vine.enum(['standard', 'deluxe', 'suite', 'presidential', 'penthouse', 'villa', 'apartment', 'studio']).optional(),
    baseRate: vine.number().min(0).optional(),
    maxAdults: vine.number().min(1).max(10).optional(),
    maxChildren: vine.number().min(0).max(10).optional(),
    maxOccupancy: vine.number().min(1).max(20).optional(),
    maxInfants: vine.number().min(0).max(5).optional(),
    bedType: vine.enum(['single', 'double', 'queen', 'king', 'twin', 'sofa_bed', 'murphy_bed', 'bunk_bed']).optional(),
    bedCount: vine.number().min(1).max(10).optional(),
    bathroomCount: vine.number().min(1).max(5).optional(),
    size: vine.number().min(1).optional(),
    sizeUnit: vine.enum(['sqft', 'sqm']).optional(),
    floor: vine.number().min(0).optional(),
    view: vine.enum(['ocean', 'city', 'garden', 'pool', 'mountain', 'courtyard', 'interior']).optional(),
    smokingAllowed: vine.boolean().optional(),
    petFriendly: vine.boolean().optional(),
    accessible: vine.boolean().optional(),
    connectingRooms: vine.boolean().optional(),
    balcony: vine.boolean().optional(),
    terrace: vine.boolean().optional(),
    kitchenette: vine.boolean().optional(),
    livingRoom: vine.boolean().optional(),
    diningArea: vine.boolean().optional(),
    workDesk: vine.boolean().optional(),
    amenities: vine.array(vine.string().trim().maxLength(100)).optional(),
    features: vine.array(vine.string().trim().maxLength(100)).optional(),
    technology: vine.array(vine.string().trim().maxLength(100)).optional(),
    bathroom: vine.array(vine.string().trim().maxLength(100)).optional(),
    entertainment: vine.array(vine.string().trim().maxLength(100)).optional(),
    comfort: vine.array(vine.string().trim().maxLength(100)).optional(),
    safety: vine.array(vine.string().trim().maxLength(100)).optional(),
    business: vine.array(vine.string().trim().maxLength(100)).optional(),
    family: vine.array(vine.string().trim().maxLength(100)).optional(),
    luxury: vine.array(vine.string().trim().maxLength(100)).optional(),
    images: vine.array(
      vine.object({
        url: vine.string().url(),
        caption: vine.string().trim().maxLength(255).optional(),
        isPrimary: vine.boolean().optional(),
        sortOrder: vine.number().min(0).optional()
      })
    ).optional(),
    floorPlan: vine.string().url().optional(),
    virtualTour: vine.string().url().optional(),
    policies: vine.object({
      checkIn: vine.string().trim().maxLength(500).optional(),
      checkOut: vine.string().trim().maxLength(500).optional(),
      cancellation: vine.string().trim().maxLength(500).optional(),
      smoking: vine.string().trim().maxLength(500).optional(),
      pets: vine.string().trim().maxLength(500).optional(),
      children: vine.string().trim().maxLength(500).optional(),
      extraBed: vine.string().trim().maxLength(500).optional(),
      damage: vine.string().trim().maxLength(500).optional()
    }).optional(),
    pricing: vine.object({
      weekdayRate: vine.number().min(0).optional(),
      weekendRate: vine.number().min(0).optional(),
      seasonalRates: vine.array(
        vine.object({
          name: vine.string().trim().maxLength(100),
          startDate: vine.date(),
          endDate: vine.date(),
          rate: vine.number().min(0)
        })
      ).optional(),
      extraAdultFee: vine.number().min(0).optional(),
      extraChildFee: vine.number().min(0).optional(),
      extraBedFee: vine.number().min(0).optional(),
      petFee: vine.number().min(0).optional(),
      cleaningFee: vine.number().min(0).optional(),
      resortFee: vine.number().min(0).optional(),
      serviceFee: vine.number().min(0).optional(),
      taxRate: vine.number().min(0).max(100).optional()
    }).optional(),
    availability: vine.object({
      totalRooms: vine.number().min(0).optional(),
      availableRooms: vine.number().min(0).optional(),
      blockedRooms: vine.number().min(0).optional(),
      maintenanceRooms: vine.number().min(0).optional(),
      outOfOrderRooms: vine.number().min(0).optional()
    }).optional(),
    restrictions: vine.object({
      minStay: vine.number().min(1).optional(),
      maxStay: vine.number().min(1).optional(),
      minAdvanceBooking: vine.number().min(0).optional(),
      maxAdvanceBooking: vine.number().min(1).optional(),
      blackoutDates: vine.array(vine.date()).optional(),
      restrictedDates: vine.array(vine.date()).optional()
    }).optional(),
    packages: vine.array(
      vine.object({
        name: vine.string().trim().maxLength(100),
        description: vine.string().trim().maxLength(500).optional(),
        inclusions: vine.array(vine.string().trim().maxLength(100)),
        additionalFee: vine.number().min(0).optional(),
        isActive: vine.boolean().optional()
      })
    ).optional(),
    promotions: vine.array(
      vine.object({
        name: vine.string().trim().maxLength(100),
        description: vine.string().trim().maxLength(500).optional(),
        discountType: vine.enum(['percentage', 'fixed']),
        discountValue: vine.number().min(0),
        startDate: vine.date(),
        endDate: vine.date(),
        isActive: vine.boolean().optional()
      })
    ).optional(),
    housekeeping: vine.object({
      cleaningTime: vine.number().min(15).optional(),
      inspectionRequired: vine.boolean().optional(),
      specialInstructions: vine.string().trim().maxLength(1000).optional(),
      supplies: vine.array(vine.string().trim().maxLength(100)).optional()
    }).optional(),
    maintenance: vine.object({
      lastMaintenance: vine.date().optional(),
      nextMaintenance: vine.date().optional(),
      maintenanceSchedule: vine.enum(['weekly', 'monthly', 'quarterly', 'annually']).optional(),
      specialRequirements: vine.string().trim().maxLength(1000).optional()
    }).optional(),
    marketing: vine.object({
      marketingName: vine.string().trim().maxLength(100).optional(),
      shortDescription: vine.string().trim().maxLength(200).optional(),
      longDescription: vine.string().trim().maxLength(1000).optional(),
      highlights: vine.array(vine.string().trim().maxLength(100)).optional(),
      targetMarket: vine.array(vine.string().trim().maxLength(50)).optional(),
      keywords: vine.array(vine.string().trim().maxLength(50)).optional()
    }).optional(),
    analytics: vine.object({
      averageOccupancy: vine.number().min(0).max(100).optional(),
      averageDailyRate: vine.number().min(0).optional(),
      revenuePerAvailableRoom: vine.number().min(0).optional(),
      averageStayLength: vine.number().min(0).optional(),
      guestSatisfactionScore: vine.number().min(1).max(10).optional(),
      repeatGuestPercentage: vine.number().min(0).max(100).optional()
    }).optional(),
    isActive: vine.boolean().optional(),
    isBookable: vine.boolean().optional(),
    isFeatured: vine.boolean().optional(),
    isPromoted: vine.boolean().optional(),
    sortOrder: vine.number().min(0).optional(),
    createdBy: vine.number().positive().optional(),
    lastModifiedBy: vine.number().positive().optional()
  })
)