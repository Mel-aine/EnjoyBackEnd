import vine from '@vinejs/vine'

/**
 * Validator to validate the payload when creating
 * a new hotel.
 */
export const createHotelValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(2).maxLength(255),
    description: vine.string().trim().maxLength(1000).optional(),
    address: vine.string().trim().maxLength(500),
    city: vine.string().trim().maxLength(100),
    state: vine.string().trim().maxLength(100).optional(),
    country: vine.string().trim().maxLength(100),
    postalCode: vine.string().trim().maxLength(20).optional(),
    phone: vine.string().trim().maxLength(20).optional(),
    email: vine.string().trim().email().maxLength(255).optional(),
    fax: vine.string().trim().email().maxLength(255).optional(),
    website: vine.string().trim().url().maxLength(255).optional(),
    starRating: vine.number().min(1).max(5).optional(),
    checkInTime: vine.string().trim().maxLength(10).optional(),
    checkOutTime: vine.string().trim().maxLength(10).optional(),
    currency: vine.string().fixedLength(3).optional(),
    timezone: vine.string().trim().maxLength(50).optional(),
    taxRate: vine.number().min(0).max(100).optional(),
    serviceFeeRate: vine.number().min(0).max(100).optional(),
    cancellationPolicy: vine.string().trim().maxLength(1000).optional(),
    policies: vine.string().trim().maxLength(2000).optional(),
    amenities: vine.array(vine.string()).optional(),
    facilities: vine.array(vine.string()).optional(),
    languages: vine.array(vine.string()).optional(),
    paymentMethods: vine.array(vine.string()).optional(),
    coordinates: vine.object({
      latitude: vine.number().min(-90).max(90),
      longitude: vine.number().min(-180).max(180)
    }).optional(),
    socialMedia: vine.object({
      facebook: vine.string().url().optional(),
      twitter: vine.string().url().optional(),
      instagram: vine.string().url().optional(),
      linkedin: vine.string().url().optional()
    }).optional(),
    contactPerson: vine.object({
      name: vine.string().trim().maxLength(255),
      title: vine.string().trim().maxLength(100).optional(),
      phone: vine.string().trim().maxLength(20).optional(),
      email: vine.string().email().maxLength(255).optional()
    }).optional(),
    emergencyContact: vine.object({
      name: vine.string().trim().maxLength(255),
      phone: vine.string().trim().maxLength(20),
      relationship: vine.string().trim().maxLength(100).optional()
    }).optional(),
    administrator: vine.object({
      firstName: vine.string().trim().minLength(2).maxLength(100),
      lastName: vine.string().trim().minLength(2).maxLength(100),
      email: vine.string().email().maxLength(255),
      phoneNumber: vine.string().trim().maxLength(20).optional()
    }).optional(),
    businessLicense: vine.string().trim().maxLength(100).optional(),
    taxId: vine.string().trim().maxLength(50).optional(),
    insurancePolicy: vine.string().trim().maxLength(100).optional(),
    managementCompany: vine.string().trim().maxLength(255).optional(),
    brandAffiliation: vine.string().trim().maxLength(255).optional(),
    yearEstablished: vine.number().min(1800).max(new Date().getFullYear()).optional(),
    totalRooms: vine.number().min(1).optional(),
    totalFloors: vine.number().min(1).optional(),
    parkingSpaces: vine.number().min(0).optional(),
    meetingRooms: vine.number().min(0).optional(),
    restaurants: vine.number().min(0).optional(),
    bars: vine.number().min(0).optional(),
    pools: vine.number().min(0).optional(),
    spas: vine.number().min(0).optional(),
    gyms: vine.number().min(0).optional(),
    businessCenters: vine.number().min(0).optional(),
    isActive: vine.boolean().optional(),
    isVerified: vine.boolean().optional(),
    isFeatured: vine.boolean().optional(),
    allowOnlineBooking: vine.boolean().optional(),
    allowWalkIn: vine.boolean().optional(),
    requireCreditCard: vine.boolean().optional(),
    allowPets: vine.boolean().optional(),
    allowSmoking: vine.boolean().optional(),
    is24HourFrontDesk: vine.boolean().optional(),
    hasRoomService: vine.boolean().optional(),
    hasConcierge: vine.boolean().optional(),
    hasValet: vine.boolean().optional(),
    hasShuttle: vine.boolean().optional(),
    hasWifi: vine.boolean().optional(),
    hasParking: vine.boolean().optional(),
    hasPool: vine.boolean().optional(),
    hasSpa: vine.boolean().optional(),
    hasGym: vine.boolean().optional(),
    hasRestaurant: vine.boolean().optional(),
    hasBar: vine.boolean().optional(),
    hasMeetingRooms: vine.boolean().optional(),
    hasBusinessCenter: vine.boolean().optional(),
    hasLaundry: vine.boolean().optional(),
    hasAirConditioning: vine.boolean().optional(),
    hasHeating: vine.boolean().optional(),
    hasElevator: vine.boolean().optional(),
    hasAccessibility: vine.boolean().optional(),
    hasSecurity: vine.boolean().optional(),
    hasCCTV: vine.boolean().optional(),
    hasFireSafety: vine.boolean().optional(),
    hasFirstAid: vine.boolean().optional(),
    settings: vine.object({
      autoConfirmReservations: vine.boolean().optional(),
      allowOverbooking: vine.boolean().optional(),
      overbookingPercentage: vine.number().min(0).max(50).optional(),
      defaultCancellationHours: vine.number().min(0).optional(),
      defaultDepositPercentage: vine.number().min(0).max(100).optional(),
      maxAdvanceBookingDays: vine.number().min(1).optional(),
      minAdvanceBookingHours: vine.number().min(0).optional(),
      defaultRoomAssignmentTime: vine.string().optional(),
      housekeepingStartTime: vine.string().optional(),
      housekeepingEndTime: vine.string().optional(),
      maintenanceStartTime: vine.string().optional(),
      maintenanceEndTime: vine.string().optional(),
      quietHoursStart: vine.string().optional(),
      quietHoursEnd: vine.string().optional()
    }).optional(),
    operatingHours: vine.object({
      monday: vine.object({
        isOpen: vine.boolean(),
        openTime: vine.string().optional(),
        closeTime: vine.string().optional()
      }).optional(),
      tuesday: vine.object({
        isOpen: vine.boolean(),
        openTime: vine.string().optional(),
        closeTime: vine.string().optional()
      }).optional(),
      wednesday: vine.object({
        isOpen: vine.boolean(),
        openTime: vine.string().optional(),
        closeTime: vine.string().optional()
      }).optional(),
      thursday: vine.object({
        isOpen: vine.boolean(),
        openTime: vine.string().optional(),
        closeTime: vine.string().optional()
      }).optional(),
      friday: vine.object({
        isOpen: vine.boolean(),
        openTime: vine.string().optional(),
        closeTime: vine.string().optional()
      }).optional(),
      saturday: vine.object({
        isOpen: vine.boolean(),
        openTime: vine.string().optional(),
        closeTime: vine.string().optional()
      }).optional(),
      sunday: vine.object({
        isOpen: vine.boolean(),
        openTime: vine.string().optional(),
        closeTime: vine.string().optional()
      }).optional()
    }).optional(),
    seasonalRates: vine.array(
      vine.object({
        name: vine.string().trim().maxLength(100),
        startDate: vine.date(),
        endDate: vine.date(),
        multiplier: vine.number().min(0.1).max(10)
      })
    ).optional(),
    images: vine.array(
      vine.object({
        url: vine.string().url(),
        caption: vine.string().trim().maxLength(255).optional(),
        isPrimary: vine.boolean().optional(),
        sortOrder: vine.number().min(0).optional()
      })
    ).optional(),
    documents: vine.array(
      vine.object({
        name: vine.string().trim().maxLength(255),
        type: vine.string().trim().maxLength(50),
        url: vine.string().url(),
        uploadedAt: vine.date().optional()
      })
    ).optional(),
    notices: vine.object({}).optional(),
    formulaSetting: vine.object({}).optional(),
    documentNumberingSetting: vine.object({}).optional(),
    printEmailSettings: vine.object({}).optional(),
    checkinReservationSettings: vine.object({}).optional(),
    displaySettings: vine.object({}).optional(),
    registrationSettings: vine.object({}).optional(),
    housekeepingStatusColors: vine.object({}).optional(),
    adminFirstName: vine.string().maxLength(255).optional(),
    adminLastName: vine.string().maxLength(255),
    adminEmail: vine.string().maxLength(255),
    adminPhoneNumber: vine.string().maxLength(255),
  })
)

/**
 * Validator to validate the payload when updating
 * an existing hotel.
 */
export const updateHotelValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(2).maxLength(255).optional(),
    description: vine.string().trim().maxLength(1000).optional(),
    address: vine.string().trim().maxLength(500).optional(),
    city: vine.string().trim().maxLength(100).optional(),
    state: vine.string().trim().maxLength(100).optional(),
    country: vine.string().trim().maxLength(100).optional(),
    postalCode: vine.string().trim().maxLength(20).optional(),
    phone: vine.string().trim().maxLength(20).optional(),
    email: vine.string().trim().email().maxLength(255).optional(),
    website: vine.string().trim().url().maxLength(255).optional(),
    starRating: vine.number().min(1).max(5).optional(),
    checkInTime: vine.string().trim().maxLength(10).optional(),
    checkOutTime: vine.string().trim().maxLength(10).optional(),
    currency: vine.string().fixedLength(3).optional(),
    timezone: vine.string().trim().maxLength(50).optional(),
    taxRate: vine.number().min(0).max(100).optional(),
    serviceFeeRate: vine.number().min(0).max(100).optional(),
    cancellationPolicy: vine.string().trim().maxLength(1000).optional(),
    policies: vine.string().trim().maxLength(2000).optional(),
    amenities: vine.array(vine.string()).optional(),
    facilities: vine.array(vine.string()).optional(),
    languages: vine.array(vine.string()).optional(),
    paymentMethods: vine.array(vine.string()).optional(),
    coordinates: vine.object({
      latitude: vine.number().min(-90).max(90),
      longitude: vine.number().min(-180).max(180)
    }).optional(),
    socialMedia: vine.object({
      facebook: vine.string().url().optional(),
      twitter: vine.string().url().optional(),
      instagram: vine.string().url().optional(),
      linkedin: vine.string().url().optional()
    }).optional(),
    contactPerson: vine.object({
      name: vine.string().trim().maxLength(255),
      title: vine.string().trim().maxLength(100).optional(),
      phone: vine.string().trim().maxLength(20).optional(),
      email: vine.string().email().maxLength(255).optional()
    }).optional(),
    emergencyContact: vine.object({
      name: vine.string().trim().maxLength(255),
      phone: vine.string().trim().maxLength(20),
      relationship: vine.string().trim().maxLength(100).optional()
    }).optional(),
    businessLicense: vine.string().trim().maxLength(100).optional(),
    taxId: vine.string().trim().maxLength(50).optional(),
    insurancePolicy: vine.string().trim().maxLength(100).optional(),
    managementCompany: vine.string().trim().maxLength(255).optional(),
    brandAffiliation: vine.string().trim().maxLength(255).optional(),
    yearEstablished: vine.number().min(1800).max(new Date().getFullYear()).optional(),
    totalRooms: vine.number().min(1).optional(),
    totalFloors: vine.number().min(1).optional(),
    parkingSpaces: vine.number().min(0).optional(),
    meetingRooms: vine.number().min(0).optional(),
    restaurants: vine.number().min(0).optional(),
    bars: vine.number().min(0).optional(),
    pools: vine.number().min(0).optional(),
    spas: vine.number().min(0).optional(),
    gyms: vine.number().min(0).optional(),
    businessCenters: vine.number().min(0).optional(),
    isActive: vine.boolean().optional(),
    isVerified: vine.boolean().optional(),
    isFeatured: vine.boolean().optional(),
    allowOnlineBooking: vine.boolean().optional(),
    allowWalkIn: vine.boolean().optional(),
    requireCreditCard: vine.boolean().optional(),
    allowPets: vine.boolean().optional(),
    allowSmoking: vine.boolean().optional(),
    is24HourFrontDesk: vine.boolean().optional(),
    hasRoomService: vine.boolean().optional(),
    hasConcierge: vine.boolean().optional(),
    hasValet: vine.boolean().optional(),
    hasShuttle: vine.boolean().optional(),
    hasWifi: vine.boolean().optional(),
    hasParking: vine.boolean().optional(),
    hasPool: vine.boolean().optional(),
    hasSpa: vine.boolean().optional(),
    hasGym: vine.boolean().optional(),
    hasRestaurant: vine.boolean().optional(),
    hasBar: vine.boolean().optional(),
    hasMeetingRooms: vine.boolean().optional(),
    hasBusinessCenter: vine.boolean().optional(),
    hasLaundry: vine.boolean().optional(),
    hasAirConditioning: vine.boolean().optional(),
    hasHeating: vine.boolean().optional(),
    hasElevator: vine.boolean().optional(),
    hasAccessibility: vine.boolean().optional(),
    hasSecurity: vine.boolean().optional(),
    hasCCTV: vine.boolean().optional(),
    hasFireSafety: vine.boolean().optional(),
    hasFirstAid: vine.boolean().optional(),
    settings: vine.object({
      autoConfirmReservations: vine.boolean().optional(),
      allowOverbooking: vine.boolean().optional(),
      overbookingPercentage: vine.number().min(0).max(50).optional(),
      defaultCancellationHours: vine.number().min(0).optional(),
      defaultDepositPercentage: vine.number().min(0).max(100).optional(),
      maxAdvanceBookingDays: vine.number().min(1).optional(),
      minAdvanceBookingHours: vine.number().min(0).optional(),
      defaultRoomAssignmentTime: vine.string().optional(),
      housekeepingStartTime: vine.string().optional(),
      housekeepingEndTime: vine.string().optional(),
      maintenanceStartTime: vine.string().optional(),
      maintenanceEndTime: vine.string().optional(),
      quietHoursStart: vine.string().optional(),
      quietHoursEnd: vine.string().optional()
    }).optional(),
    operatingHours: vine.object({
      monday: vine.object({
        isOpen: vine.boolean(),
        openTime: vine.string().optional(),
        closeTime: vine.string().optional()
      }).optional(),
      tuesday: vine.object({
        isOpen: vine.boolean(),
        openTime: vine.string().optional(),
        closeTime: vine.string().optional()
      }).optional(),
      wednesday: vine.object({
        isOpen: vine.boolean(),
        openTime: vine.string().optional(),
        closeTime: vine.string().optional()
      }).optional(),
      thursday: vine.object({
        isOpen: vine.boolean(),
        openTime: vine.string().optional(),
        closeTime: vine.string().optional()
      }).optional(),
      friday: vine.object({
        isOpen: vine.boolean(),
        openTime: vine.string().optional(),
        closeTime: vine.string().optional()
      }).optional(),
      saturday: vine.object({
        isOpen: vine.boolean(),
        openTime: vine.string().optional(),
        closeTime: vine.string().optional()
      }).optional(),
      sunday: vine.object({
        isOpen: vine.boolean(),
        openTime: vine.string().optional(),
        closeTime: vine.string().optional()
      }).optional()
    }).optional(),
    seasonalRates: vine.array(
      vine.object({
        name: vine.string().trim().maxLength(100),
        startDate: vine.date(),
        endDate: vine.date(),
        multiplier: vine.number().min(0.1).max(10)
      })
    ).optional(),
    images: vine.array(
      vine.object({
        url: vine.string().url(),
        caption: vine.string().trim().maxLength(255).optional(),
        isPrimary: vine.boolean().optional(),
        sortOrder: vine.number().min(0).optional()
      })
    ).optional(),
    documents: vine.array(
      vine.object({
        name: vine.string().trim().maxLength(255),
        type: vine.string().trim().maxLength(50),
        url: vine.string().url(),
        uploadedAt: vine.date().optional()
      })
    ).optional(),
    notices: vine.object({}).optional(),
    formulaSetting: vine.object({}).optional(),
    documentNumberingSetting: vine.object({}).optional(),
    printEmailSettings: vine.object({}).optional(),
    checkinReservationSettings: vine.object({}).optional(),
    displaySettings: vine.object({}).optional(),
    registrationSettings: vine.object({}).optional(),
    housekeepingStatusColors: vine.object({}).optional()
  })
)