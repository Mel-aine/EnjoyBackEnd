import vine from '@vinejs/vine'

/**
 * Validator to validate the payload when creating
 * a new guest.
 */
export const createGuestValidator = vine.compile(
  vine.object({
    hotelId:vine.number().min(0).optional(),
    firstName: vine.string().trim().minLength(1).maxLength(100),
    lastName: vine.string().trim().minLength(1).maxLength(100),
    middleName: vine.string().trim().maxLength(100).optional(),
    title: vine.enum(['Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Sir', 'Madam']).optional(),
    gender: vine.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
    dateOfBirth: vine.date().optional(),
    nationality: vine.string().trim().maxLength(100).optional(),
    email: vine.string().trim().email().maxLength(255),
    phone: vine.string().trim().maxLength(20).optional(),
    alternatePhone: vine.string().trim().maxLength(20).optional(),
    address: vine.string().trim().maxLength(500).optional(),
    city: vine.string().trim().maxLength(100).optional(),
    state: vine.string().trim().maxLength(100).optional(),
    country: vine.string().trim().maxLength(100).optional(),
    postalCode: vine.string().trim().maxLength(20).optional(),
    passportNumber: vine.string().trim().maxLength(50).optional(),
    passportCountry: vine.string().trim().maxLength(100).optional(),
    passportExpiryDate: vine.date().optional(),
    idType: vine.enum(['passport', 'drivers_license', 'national_id', 'other']).optional(),
    idNumber: vine.string().trim().maxLength(50).optional(),
    idCountry: vine.string().trim().maxLength(100).optional(),
    idExpiryDate: vine.date().optional(),
    emergencyContactName: vine.string().trim().maxLength(255).optional(),
    emergencyContactPhone: vine.string().trim().maxLength(20).optional(),
    emergencyContactRelationship: vine.string().trim().maxLength(100).optional(),
    company: vine.string().trim().maxLength(255).optional(),
    jobTitle: vine.string().trim().maxLength(100).optional(),
    industry: vine.string().trim().maxLength(100).optional(),
    annualIncome: vine.number().min(0).optional(),
    maritalStatus: vine.enum(['single', 'married', 'divorced', 'widowed', 'separated', 'other']).optional(),
    occupation: vine.string().trim().maxLength(100).optional(),
    education: vine.enum(['high_school', 'bachelor', 'master', 'phd', 'other']).optional(),
    language: vine.string().trim().maxLength(50).optional(),
    preferredLanguage: vine.string().trim().maxLength(50).optional(),
    religion: vine.string().trim().maxLength(100).optional(),
    dietaryRestrictions: vine.string().trim().maxLength(500).optional(),
    allergies: vine.string().trim().maxLength(500).optional(),
    medicalConditions: vine.string().trim().maxLength(500).optional(),
    accessibilityNeeds: vine.string().trim().maxLength(500).optional(),
    smokingPreference: vine.enum(['non_smoking', 'smoking', 'no_preference']).optional(),
    roomPreferences: vine.string().trim().maxLength(1000).optional(),
    bedPreference: vine.enum(['single', 'double', 'queen', 'king', 'twin']).optional(),
    floorPreference: vine.enum(['low', 'high', 'specific', 'no_preference']).optional(),
    viewPreference: vine.enum(['ocean', 'city', 'garden', 'pool', 'mountain', 'courtyard', 'no_preference']).optional(),
    specialRequests: vine.string().trim().maxLength(1000).optional(),
    loyaltyPrograms: vine.array(
      vine.object({
        programName: vine.string().trim().maxLength(100),
        membershipNumber: vine.string().trim().maxLength(50),
        tier: vine.string().trim().maxLength(50).optional(),
        points: vine.number().min(0).optional()
      })
    ).optional(),
    creditCards: vine.array(
      vine.object({
        type: vine.enum(['visa', 'mastercard', 'amex', 'discover', 'other']),
        lastFourDigits: vine.string().fixedLength(4),
        expiryMonth: vine.number().min(1).max(12),
        expiryYear: vine.number().min(new Date().getFullYear()),
        holderName: vine.string().trim().maxLength(255),
        isDefault: vine.boolean().optional()
      })
    ).optional(),
    vipStatus: vine.enum(['none', 'bronze', 'silver', 'gold', 'platinum', 'diamond']).optional(),
    vipNotes: vine.string().trim().maxLength(1000).optional(),
    blacklisted: vine.boolean().optional(),
    blacklistReason: vine.string().trim().maxLength(500).optional(),
    blacklistedAt: vine.date().optional(),
    blacklistedBy: vine.number().positive().optional(),
    marketingOptIn: vine.boolean().optional(),
    emailOptIn: vine.boolean().optional(),
    smsOptIn: vine.boolean().optional(),
    phoneOptIn: vine.boolean().optional(),
    communicationPreference: vine.enum(['email', 'sms', 'phone', 'mail', 'none']).optional(),
    preferredContactTime: vine.enum(['morning', 'afternoon', 'evening', 'anytime']).optional(),
    source: vine.enum(['website', 'phone', 'email', 'walk_in', 'referral', 'agent', 'corporate', 'other']).optional(),
    referralSource: vine.string().trim().maxLength(255).optional(),
    notes: vine.string().trim().maxLength(2000).optional(),
    internalNotes: vine.string().trim().maxLength(2000).optional(),
    tags: vine.array(vine.string().trim().maxLength(50)).optional(),
    customFields: vine.object({}).optional(),
    socialMedia: vine.object({
      facebook: vine.string().url().optional(),
      twitter: vine.string().url().optional(),
      instagram: vine.string().url().optional(),
      linkedin: vine.string().url().optional()
    }).optional(),
    profileImage: vine.string().url().optional(),
    documents: vine.array(
      vine.object({
        type: vine.string().trim().maxLength(50),
        name: vine.string().trim().maxLength(255),
        url: vine.string().url(),
        uploadedAt: vine.date().optional()
      })
    ).optional(),
    isActive: vine.boolean().optional(),
    isVerified: vine.boolean().optional(),
    emailVerified: vine.boolean().optional(),
    phoneVerified: vine.boolean().optional(),
    lastLoginAt: vine.date().optional(),
    lastActivityAt: vine.date().optional(),
    totalStays: vine.number().min(0).optional(),
    totalSpent: vine.number().min(0).optional(),
    averageStayLength: vine.number().min(0).optional(),
    averageRoomRate: vine.number().min(0).optional(),
    lastStayDate: vine.date().optional(),
    nextStayDate: vine.date().optional(),
    lifetimeValue: vine.number().min(0).optional(),
    riskScore: vine.number().min(0).max(100).optional(),
    satisfactionScore: vine.number().min(1).max(10).optional(),
    createdBy: vine.number().positive().optional(),
    lastModifiedBy: vine.number().positive().optional()
  })
)

/**
 * Validator to validate the payload when updating
 * an existing guest.
 */
export const updateGuestValidator = vine.compile(
  vine.object({
    firstName: vine.string().trim().minLength(1).maxLength(100).optional(),
    lastName: vine.string().trim().minLength(1).maxLength(100).optional(),
    middleName: vine.string().trim().maxLength(100).optional(),
    title: vine.enum(['Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Sir', 'Madam']).optional(),
    gender: vine.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
    dateOfBirth: vine.date().optional(),
    nationality: vine.string().trim().maxLength(100).optional(),
    email: vine.string().trim().email().maxLength(255).optional(),
    phone: vine.string().trim().maxLength(20).optional(),
    alternatePhone: vine.string().trim().maxLength(20).optional(),
    address: vine.string().trim().maxLength(500).optional(),
    city: vine.string().trim().maxLength(100).optional(),
    state: vine.string().trim().maxLength(100).optional(),
    country: vine.string().trim().maxLength(100).optional(),
    postalCode: vine.string().trim().maxLength(20).optional(),
    passportNumber: vine.string().trim().maxLength(50).optional(),
    passportCountry: vine.string().trim().maxLength(100).optional(),
    passportExpiryDate: vine.date().optional(),
    idType: vine.enum(['passport', 'drivers_license', 'national_id', 'other']).optional(),
    idNumber: vine.string().trim().maxLength(50).optional(),
    idCountry: vine.string().trim().maxLength(100).optional(),
    idExpiryDate: vine.date().optional(),
    emergencyContactName: vine.string().trim().maxLength(255).optional(),
    emergencyContactPhone: vine.string().trim().maxLength(20).optional(),
    emergencyContactRelationship: vine.string().trim().maxLength(100).optional(),
    company: vine.string().trim().maxLength(255).optional(),
    jobTitle: vine.string().trim().maxLength(100).optional(),
    industry: vine.string().trim().maxLength(100).optional(),
    annualIncome: vine.number().min(0).optional(),
    maritalStatus: vine.enum(['single', 'married', 'divorced', 'widowed', 'separated', 'other']).optional(),
    occupation: vine.string().trim().maxLength(100).optional(),
    education: vine.enum(['high_school', 'bachelor', 'master', 'phd', 'other']).optional(),
    language: vine.string().trim().maxLength(50).optional(),
    preferredLanguage: vine.string().trim().maxLength(50).optional(),
    religion: vine.string().trim().maxLength(100).optional(),
    dietaryRestrictions: vine.string().trim().maxLength(500).optional(),
    allergies: vine.string().trim().maxLength(500).optional(),
    medicalConditions: vine.string().trim().maxLength(500).optional(),
    accessibilityNeeds: vine.string().trim().maxLength(500).optional(),
    smokingPreference: vine.enum(['non_smoking', 'smoking', 'no_preference']).optional(),
    roomPreferences: vine.string().trim().maxLength(1000).optional(),
    bedPreference: vine.enum(['single', 'double', 'queen', 'king', 'twin']).optional(),
    floorPreference: vine.enum(['low', 'high', 'specific', 'no_preference']).optional(),
    viewPreference: vine.enum(['ocean', 'city', 'garden', 'pool', 'mountain', 'courtyard', 'no_preference']).optional(),
    specialRequests: vine.string().trim().maxLength(1000).optional(),
    loyaltyPrograms: vine.array(
      vine.object({
        programName: vine.string().trim().maxLength(100),
        membershipNumber: vine.string().trim().maxLength(50),
        tier: vine.string().trim().maxLength(50).optional(),
        points: vine.number().min(0).optional()
      })
    ).optional(),
    creditCards: vine.array(
      vine.object({
        type: vine.enum(['visa', 'mastercard', 'amex', 'discover', 'other']),
        lastFourDigits: vine.string().fixedLength(4),
        expiryMonth: vine.number().min(1).max(12),
        expiryYear: vine.number().min(new Date().getFullYear()),
        holderName: vine.string().trim().maxLength(255),
        isDefault: vine.boolean().optional()
      })
    ).optional(),
    vipStatus: vine.enum(['none', 'bronze', 'silver', 'gold', 'platinum', 'diamond']).optional(),
    vipNotes: vine.string().trim().maxLength(1000).optional(),
    blacklisted: vine.boolean().optional(),
    blacklistReason: vine.string().trim().maxLength(500).optional(),
    blacklistedAt: vine.date().optional(),
    blacklistedBy: vine.number().positive().optional(),
    marketingOptIn: vine.boolean().optional(),
    emailOptIn: vine.boolean().optional(),
    smsOptIn: vine.boolean().optional(),
    phoneOptIn: vine.boolean().optional(),
    communicationPreference: vine.enum(['email', 'sms', 'phone', 'mail', 'none']).optional(),
    preferredContactTime: vine.enum(['morning', 'afternoon', 'evening', 'anytime']).optional(),
    source: vine.enum(['website', 'phone', 'email', 'walk_in', 'referral', 'agent', 'corporate', 'other']).optional(),
    referralSource: vine.string().trim().maxLength(255).optional(),
    notes: vine.string().trim().maxLength(2000).optional(),
    internalNotes: vine.string().trim().maxLength(2000).optional(),
    tags: vine.array(vine.string().trim().maxLength(50)).optional(),
    customFields: vine.object({}).optional(),
    socialMedia: vine.object({
      facebook: vine.string().url().optional(),
      twitter: vine.string().url().optional(),
      instagram: vine.string().url().optional(),
      linkedin: vine.string().url().optional()
    }).optional(),
    profileImage: vine.string().url().optional(),
    documents: vine.array(
      vine.object({
        type: vine.string().trim().maxLength(50),
        name: vine.string().trim().maxLength(255),
        url: vine.string().url(),
        uploadedAt: vine.date().optional()
      })
    ).optional(),
    isActive: vine.boolean().optional(),
    isVerified: vine.boolean().optional(),
    emailVerified: vine.boolean().optional(),
    phoneVerified: vine.boolean().optional(),
    lastLoginAt: vine.date().optional(),
    lastActivityAt: vine.date().optional(),
    totalStays: vine.number().min(0).optional(),
    totalSpent: vine.number().min(0).optional(),
    averageStayLength: vine.number().min(0).optional(),
    averageRoomRate: vine.number().min(0).optional(),
    lastStayDate: vine.date().optional(),
    nextStayDate: vine.date().optional(),
    lifetimeValue: vine.number().min(0).optional(),
    riskScore: vine.number().min(0).max(100).optional(),
    satisfactionScore: vine.number().min(1).max(10).optional(),
    createdBy: vine.number().positive().optional(),
    lastModifiedBy: vine.number().positive().optional()
  })
)
