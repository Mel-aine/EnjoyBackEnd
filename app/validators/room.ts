import vine from '@vinejs/vine'
import { DateTime } from 'luxon'

/**
 * Validator to validate the payload when creating
 * a new room.
 */
export const createRoomValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive(),
    roomTypeId: vine.number().positive(),
    bedTypeId: vine.number().positive().optional(),
    phoneExtension: vine.string().trim().maxLength(20).optional(),
    sortKey: vine.number().optional(),
    keyCardAlias: vine.string().trim().maxLength(50).optional(),
    roomNumber: vine.string().trim().minLength(1).maxLength(100),
    building: vine.string().trim().maxLength(50).optional(),
    wing: vine.string().trim().maxLength(50).optional(),
    section: vine.string().trim().maxLength(50).optional(),
    status: vine.enum(['available', 'occupied', 'out_of_order', 'maintenance', 'blocked']).optional(),
    housekeepingStatus: vine.enum(['clean', 'dirty', 'inspected', 'out_of_order']).optional(),
    maintenanceStatus: vine.enum(['operational', 'maintenance', 'repair', 'renovation']).optional(),
    condition: vine.enum(['excellent', 'good', 'fair', 'poor', 'needs_attention']).optional(),
    lastCleaned: vine.date().transform((value) => value ? DateTime.fromJSDate(value) : value).optional(),
    lastInspected: vine.date().transform((value) => value ? DateTime.fromJSDate(value) : value).optional(),
    lastMaintenance: vine.date().transform((value) => value ? DateTime.fromJSDate(value) : value).optional(),
    nextMaintenance: vine.date().transform((value) => value ? DateTime.fromJSDate(value) : value).optional(),
    view: vine.enum(['ocean', 'city', 'garden', 'pool', 'mountain', 'courtyard', 'interior']).optional(),
    smokingAllowed: vine.boolean().optional(),
    petFriendly: vine.boolean().optional(),
    accessible: vine.boolean().optional(),
    connectingRooms: vine.array(vine.number().positive()).optional(),
    adjacentRooms: vine.array(vine.number().positive()).optional(),
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
    inventory: vine.array(
      vine.object({
        itemName: vine.string().trim().maxLength(100),
        quantity: vine.number().min(0),
        condition: vine.enum(['excellent', 'good', 'fair', 'poor', 'missing']),
        lastChecked: vine.date().transform((value) => value ? DateTime.fromJSDate(value) : value).optional(),
        notes: vine.string().trim().maxLength(500).optional()
      })
    ).optional(),
    keyCards: vine.object({
      total: vine.number().min(0).optional(),
      active: vine.number().min(0).optional(),
      issued: vine.number().min(0).optional(),
      returned: vine.number().min(0).optional(),
      lost: vine.number().min(0).optional(),
      damaged: vine.number().min(0).optional()
    }).optional(),
    access: vine.object({
      keyType: vine.enum(['physical', 'card', 'digital', 'biometric']).optional(),
      accessCode: vine.string().trim().maxLength(20).optional(),
      lastAccess: vine.date().optional(),
      accessLog: vine.array(
        vine.object({
          timestamp: vine.date(),
          userId: vine.number().positive(),
          action: vine.enum(['entry', 'exit', 'maintenance', 'housekeeping']),
          method: vine.enum(['key', 'card', 'code', 'master'])
        })
      ).optional()
    }).optional(),
    housekeeping: vine.object({
      assignedTo: vine.number().positive().optional(),
      estimatedTime: vine.number().min(15).optional(),
      actualTime: vine.number().min(0).optional(),
      startTime: vine.date().optional(),
      endTime: vine.date().optional(),
      checklist: vine.array(
        vine.object({
          task: vine.string().trim().maxLength(100),
          completed: vine.boolean(),
          notes: vine.string().trim().maxLength(500).optional()
        })
      ).optional(),
      supplies: vine.array(
        vine.object({
          item: vine.string().trim().maxLength(100),
          quantity: vine.number().min(0),
          used: vine.number().min(0).optional()
        })
      ).optional(),
      issues: vine.array(
        vine.object({
          description: vine.string().trim().maxLength(500),
          severity: vine.enum(['low', 'medium', 'high', 'critical']),
          reported: vine.date(),
          resolved: vine.date().optional()
        })
      ).optional(),
      notes: vine.string().trim().maxLength(1000).optional()
    }).optional(),
    maintenance: vine.object({
      assignedTo: vine.number().positive().optional(),
      priority: vine.enum(['low', 'medium', 'high', 'urgent']).optional(),
      category: vine.enum(['plumbing', 'electrical', 'hvac', 'furniture', 'appliances', 'general']).optional(),
      description: vine.string().trim().maxLength(1000).optional(),
      scheduledDate: vine.date().optional(),
      completedDate: vine.date().optional(),
      estimatedCost: vine.number().min(0).optional(),
      actualCost: vine.number().min(0).optional(),
      warranty: vine.object({
        provider: vine.string().trim().maxLength(100).optional(),
        expiryDate: vine.date().optional(),
        coverage: vine.string().trim().maxLength(500).optional()
      }).optional(),
      history: vine.array(
        vine.object({
          date: vine.date(),
          type: vine.enum(['repair', 'replacement', 'upgrade', 'inspection']),
          description: vine.string().trim().maxLength(500),
          cost: vine.number().min(0).optional(),
          technician: vine.string().trim().maxLength(100).optional()
        })
      ).optional(),
      notes: vine.string().trim().maxLength(1000).optional()
    }).optional(),
    energy: vine.object({
      thermostatSettings: vine.object({
        temperature: vine.number().min(10).max(35).optional(),
        mode: vine.enum(['heat', 'cool', 'auto', 'off']).optional(),
        schedule: vine.array(
          vine.object({
            time: vine.string().trim(),
            temperature: vine.number().min(10).max(35),
            days: vine.array(vine.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']))
          })
        ).optional()
      }).optional(),
      lighting: vine.object({
        autoMode: vine.boolean().optional(),
        brightness: vine.number().min(0).max(100).optional(),
        schedule: vine.array(
          vine.object({
            time: vine.string().trim(),
            action: vine.enum(['on', 'off', 'dim']),
            brightness: vine.number().min(0).max(100).optional()
          })
        ).optional()
      }).optional(),
      consumption: vine.object({
        daily: vine.number().min(0).optional(),
        monthly: vine.number().min(0).optional(),
        lastReading: vine.date().optional()
      }).optional()
    }).optional(),
    security: vine.object({
      cameras: vine.array(
        vine.object({
          location: vine.string().trim().maxLength(100),
          type: vine.enum(['indoor', 'outdoor', 'doorbell', 'hidden']),
          status: vine.enum(['active', 'inactive', 'maintenance']),
          lastMaintenance: vine.date().optional()
        })
      ).optional(),
      alarms: vine.array(
        vine.object({
          type: vine.enum(['smoke', 'carbon_monoxide', 'burglar', 'panic']),
          status: vine.enum(['active', 'inactive', 'triggered', 'maintenance']),
          lastTest: vine.date().optional(),
          batteryLevel: vine.number().min(0).max(100).optional()
        })
      ).optional(),
      locks: vine.array(
        vine.object({
          location: vine.string().trim().maxLength(100),
          type: vine.enum(['mechanical', 'electronic', 'smart', 'biometric']),
          status: vine.enum(['locked', 'unlocked', 'maintenance']),
          batteryLevel: vine.number().min(0).max(100).optional()
        })
      ).optional(),
      incidents: vine.array(
        vine.object({
          date: vine.date(),
          type: vine.enum(['break_in', 'alarm', 'damage', 'theft', 'other']),
          description: vine.string().trim().maxLength(1000),
          severity: vine.enum(['low', 'medium', 'high', 'critical']),
          resolved: vine.boolean().optional(),
          reportedBy: vine.number().positive().optional()
        })
      ).optional()
    }).optional(),
    pricing: vine.object({
      baseRate: vine.number().min(0).optional(),
      currentRate: vine.number().min(0).optional(),
      seasonalMultiplier: vine.number().min(0.1).max(10).optional(),
      dynamicPricing: vine.boolean().optional(),
      lastRateUpdate: vine.date().optional()
    }).optional(),
    occupancy: vine.object({
      currentGuests: vine.number().min(0).optional(),
      maxOccupancy: vine.number().min(1).optional(),
      checkInDate: vine.date().optional(),
      checkOutDate: vine.date().optional(),
      reservationId: vine.number().positive().optional(),
      guestId: vine.number().positive().optional()
    }).optional(),
    analytics: vine.object({
      occupancyRate: vine.number().min(0).max(100).optional(),
      averageDailyRate: vine.number().min(0).optional(),
      revenuePerAvailableRoom: vine.number().min(0).optional(),
      averageStayLength: vine.number().min(0).optional(),
      guestSatisfactionScore: vine.number().min(1).max(10).optional(),
      maintenanceCosts: vine.number().min(0).optional(),
      energyCosts: vine.number().min(0).optional(),
      totalRevenue: vine.number().min(0).optional()
    }).optional(),
    images: vine.array(
      vine.object({
        url: vine.string().url(),
        caption: vine.string().trim().maxLength(255).optional(),
        type: vine.enum(['room', 'bathroom', 'view', 'amenity']).optional(),
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
    notes: vine.string().trim().maxLength(2000).optional(),
    internalNotes: vine.string().trim().maxLength(2000).optional(),
    tags: vine.array(vine.string().trim().maxLength(50)).optional(),
    customFields: vine.object({}).optional(),
    isActive: vine.boolean().optional(),
    isBookable: vine.boolean().optional(),
    isFeatured: vine.boolean().optional(),
    sortOrder: vine.number().min(0).optional(),
    createdBy: vine.number().positive().optional(),
    lastModifiedBy: vine.number().positive().optional(),
    isDeleted: vine.boolean().optional(),
    deletedAt: vine.date().transform((value) => value ? DateTime.fromJSDate(value) : value).optional(),
    shortCode: vine.string().trim().maxLength(50).optional(),
    taxRateIds: vine.array(vine.number().positive()).optional()
  })
)

/**
 * Validator to validate the payload when updating
 * an existing room.
 */
export const updateRoomValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive().optional(),
    roomTypeId: vine.number().positive().optional(),
    bedTypeId: vine.number().positive().optional(),
    phoneExtension: vine.string().trim().maxLength(20).optional(),
    sortKey: vine.number().optional(),
    keyCardAlias: vine.string().trim().maxLength(50).optional(),
    roomNumber: vine.string().trim().minLength(1).maxLength(100).optional(),
    building: vine.string().trim().maxLength(50).optional(),
    wing: vine.string().trim().maxLength(50).optional(),
    section: vine.string().trim().maxLength(50).optional(),
    status: vine.enum(['available', 'occupied', 'out_of_order', 'maintenance', 'blocked']).optional(),
    housekeepingStatus: vine.enum(['clean', 'dirty', 'inspected', 'out_of_order']).optional(),
    maintenanceStatus: vine.enum(['operational', 'maintenance', 'repair', 'renovation']).optional(),
    condition: vine.enum(['excellent', 'good', 'fair', 'poor', 'needs_attention']).optional(),
    lastCleaned: vine.date().transform((value) => value ? DateTime.fromJSDate(value) : value).optional(),
    lastInspected: vine.date().transform((value) => value ? DateTime.fromJSDate(value) : value).optional(),
    lastMaintenance: vine.date().transform((value) => value ? DateTime.fromJSDate(value) : value).optional(),
    nextMaintenance: vine.date().transform((value) => value ? DateTime.fromJSDate(value) : value).optional(),
    view: vine.enum(['ocean', 'city', 'garden', 'pool', 'mountain', 'courtyard', 'interior']).optional(),
    smokingAllowed: vine.boolean().optional(),
    petFriendly: vine.boolean().optional(),
    accessible: vine.boolean().optional(),
    connectingRooms: vine.array(vine.number().positive()).optional(),
    adjacentRooms: vine.array(vine.number().positive()).optional(),
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
    inventory: vine.array(
      vine.object({
        itemName: vine.string().trim().maxLength(100),
        quantity: vine.number().min(0),
        condition: vine.enum(['excellent', 'good', 'fair', 'poor', 'missing']),
        lastChecked: vine.date().transform((value) => value ? DateTime.fromJSDate(value) : value).optional(),
        notes: vine.string().trim().maxLength(500).optional()
      })
    ).optional(),
    keyCards: vine.object({
      total: vine.number().min(0).optional(),
      active: vine.number().min(0).optional(),
      issued: vine.number().min(0).optional(),
      returned: vine.number().min(0).optional(),
      lost: vine.number().min(0).optional(),
      damaged: vine.number().min(0).optional()
    }).optional(),
    access: vine.object({
      keyType: vine.enum(['physical', 'card', 'digital', 'biometric']).optional(),
      accessCode: vine.string().trim().maxLength(20).optional(),
      lastAccess: vine.date().optional(),
      accessLog: vine.array(
        vine.object({
          timestamp: vine.date(),
          userId: vine.number().positive(),
          action: vine.enum(['entry', 'exit', 'maintenance', 'housekeeping']),
          method: vine.enum(['key', 'card', 'code', 'master'])
        })
      ).optional()
    }).optional(),
    housekeeping: vine.object({
      assignedTo: vine.number().positive().optional(),
      estimatedTime: vine.number().min(15).optional(),
      actualTime: vine.number().min(0).optional(),
      startTime: vine.date().optional(),
      endTime: vine.date().optional(),
      checklist: vine.array(
        vine.object({
          task: vine.string().trim().maxLength(100),
          completed: vine.boolean(),
          notes: vine.string().trim().maxLength(500).optional()
        })
      ).optional(),
      supplies: vine.array(
        vine.object({
          item: vine.string().trim().maxLength(100),
          quantity: vine.number().min(0),
          used: vine.number().min(0).optional()
        })
      ).optional(),
      issues: vine.array(
        vine.object({
          description: vine.string().trim().maxLength(500),
          severity: vine.enum(['low', 'medium', 'high', 'critical']),
          reported: vine.date(),
          resolved: vine.date().optional()
        })
      ).optional(),
      notes: vine.string().trim().maxLength(1000).optional()
    }).optional(),
    maintenance: vine.object({
      assignedTo: vine.number().positive().optional(),
      priority: vine.enum(['low', 'medium', 'high', 'urgent']).optional(),
      category: vine.enum(['plumbing', 'electrical', 'hvac', 'furniture', 'appliances', 'general']).optional(),
      description: vine.string().trim().maxLength(1000).optional(),
      scheduledDate: vine.date().optional(),
      completedDate: vine.date().optional(),
      estimatedCost: vine.number().min(0).optional(),
      actualCost: vine.number().min(0).optional(),
      warranty: vine.object({
        provider: vine.string().trim().maxLength(100).optional(),
        expiryDate: vine.date().optional(),
        coverage: vine.string().trim().maxLength(500).optional()
      }).optional(),
      history: vine.array(
        vine.object({
          date: vine.date(),
          type: vine.enum(['repair', 'replacement', 'upgrade', 'inspection']),
          description: vine.string().trim().maxLength(500),
          cost: vine.number().min(0).optional(),
          technician: vine.string().trim().maxLength(100).optional()
        })
      ).optional(),
      notes: vine.string().trim().maxLength(1000).optional()
    }).optional(),
    energy: vine.object({
      thermostatSettings: vine.object({
        temperature: vine.number().min(10).max(35).optional(),
        mode: vine.enum(['heat', 'cool', 'auto', 'off']).optional(),
        schedule: vine.array(
          vine.object({
            time: vine.string().trim(),
            temperature: vine.number().min(10).max(35),
            days: vine.array(vine.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']))
          })
        ).optional()
      }).optional(),
      lighting: vine.object({
        autoMode: vine.boolean().optional(),
        brightness: vine.number().min(0).max(100).optional(),
        schedule: vine.array(
          vine.object({
            time: vine.string().trim(),
            action: vine.enum(['on', 'off', 'dim']),
            brightness: vine.number().min(0).max(100).optional()
          })
        ).optional()
      }).optional(),
      consumption: vine.object({
        daily: vine.number().min(0).optional(),
        monthly: vine.number().min(0).optional(),
        lastReading: vine.date().optional()
      }).optional()
    }).optional(),
    security: vine.object({
      cameras: vine.array(
        vine.object({
          location: vine.string().trim().maxLength(100),
          type: vine.enum(['indoor', 'outdoor', 'doorbell', 'hidden']),
          status: vine.enum(['active', 'inactive', 'maintenance']),
          lastMaintenance: vine.date().optional()
        })
      ).optional(),
      alarms: vine.array(
        vine.object({
          type: vine.enum(['smoke', 'carbon_monoxide', 'burglar', 'panic']),
          status: vine.enum(['active', 'inactive', 'triggered', 'maintenance']),
          lastTest: vine.date().optional(),
          batteryLevel: vine.number().min(0).max(100).optional()
        })
      ).optional(),
      locks: vine.array(
        vine.object({
          location: vine.string().trim().maxLength(100),
          type: vine.enum(['mechanical', 'electronic', 'smart', 'biometric']),
          status: vine.enum(['locked', 'unlocked', 'maintenance']),
          batteryLevel: vine.number().min(0).max(100).optional()
        })
      ).optional(),
      incidents: vine.array(
        vine.object({
          date: vine.date(),
          type: vine.enum(['break_in', 'alarm', 'damage', 'theft', 'other']),
          description: vine.string().trim().maxLength(1000),
          severity: vine.enum(['low', 'medium', 'high', 'critical']),
          resolved: vine.boolean().optional(),
          reportedBy: vine.number().positive().optional()
        })
      ).optional()
    }).optional(),
    pricing: vine.object({
      baseRate: vine.number().min(0).optional(),
      currentRate: vine.number().min(0).optional(),
      seasonalMultiplier: vine.number().min(0.1).max(10).optional(),
      dynamicPricing: vine.boolean().optional(),
      lastRateUpdate: vine.date().optional()
    }).optional(),
    occupancy: vine.object({
      currentGuests: vine.number().min(0).optional(),
      maxOccupancy: vine.number().min(1).optional(),
      checkInDate: vine.date().optional(),
      checkOutDate: vine.date().optional(),
      reservationId: vine.number().positive().optional(),
      guestId: vine.number().positive().optional()
    }).optional(),
    analytics: vine.object({
      occupancyRate: vine.number().min(0).max(100).optional(),
      averageDailyRate: vine.number().min(0).optional(),
      revenuePerAvailableRoom: vine.number().min(0).optional(),
      averageStayLength: vine.number().min(0).optional(),
      guestSatisfactionScore: vine.number().min(1).max(10).optional(),
      maintenanceCosts: vine.number().min(0).optional(),
      energyCosts: vine.number().min(0).optional(),
      totalRevenue: vine.number().min(0).optional()
    }).optional(),
    images: vine.array(
      vine.object({
        url: vine.string().url(),
        caption: vine.string().trim().maxLength(255).optional(),
        type: vine.enum(['room', 'bathroom', 'view', 'amenity']).optional(),
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
    notes: vine.string().trim().maxLength(2000).optional(),
    internalNotes: vine.string().trim().maxLength(2000).optional(),
    tags: vine.array(vine.string().trim().maxLength(50)).optional(),
    customFields: vine.object({}).optional(),
    isActive: vine.boolean().optional(),
    isBookable: vine.boolean().optional(),
    isFeatured: vine.boolean().optional(),
    sortOrder: vine.number().min(0).optional(),
    createdBy: vine.number().positive().optional(),
    lastModifiedBy: vine.number().positive().optional(),
    isDeleted: vine.boolean().optional(),
    deletedAt: vine.date().transform((value) => value ? DateTime.fromJSDate(value) : value).optional(),
    shortCode: vine.string().trim().maxLength(50).optional(),
    taxRateIds: vine.array(vine.number().positive()).optional()
  })
)