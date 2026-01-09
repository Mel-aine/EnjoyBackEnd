import vine from '@vinejs/vine'

/**
 * Validator to validate the payload when creating
 * a new guest.
 */
export const createGuestValidator = vine.compile(
  vine.object({
    hotelId: vine.number().min(0).optional(),
    firstName: vine.string().trim().minLength(1).maxLength(100),
    lastName: vine.string().trim().minLength(1).maxLength(100).optional(),
    contactType: vine.string().trim().minLength(1).maxLength(100).optional(),
    whatsappContact: vine.string().trim().minLength(1).maxLength(100).optional(),
    facebookContact: vine.string().trim().minLength(1).maxLength(100).optional(),
    maidenName: vine.string().trim().minLength(1).maxLength(100).optional(),
    placeOfBirth: vine.string().trim().minLength(1).maxLength(100).optional(),
    profession: vine.string().trim().minLength(1).maxLength(100).optional(),
    middleName: vine.string().trim().maxLength(100).optional(),
    title: vine.enum(['Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Sir', 'Madam','Miss']).optional(),
    gender: vine.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
    dateOfBirth: vine.date().optional(),
    nationality: vine.string().trim().maxLength(100).optional(),
    email: vine.string().trim().email().maxLength(255).optional(),
    emailSecondary: vine.string().trim().email().maxLength(255).optional(),
    phonePrimary: vine.string().trim().maxLength(20).optional(),
    contactTypeValue: vine.string().trim().maxLength(20).optional(),
    phoneSecondary: vine.string().trim().maxLength(20).optional(),
    fax: vine.string().trim().maxLength(20).optional(),
    alternatePhone: vine.string().trim().maxLength(20).optional(),
    address: vine.string().trim().maxLength(500).optional(),
    city: vine.string().trim().maxLength(100).optional(),
    state: vine.string().trim().maxLength(100).optional(),
    stateProvince: vine.string().trim().maxLength(100).optional(),
    country: vine.string().trim().maxLength(100).optional(),
    issuingCountry: vine.string().trim().maxLength(100).optional(),
    issuingCity: vine.string().trim().maxLength(100).optional(),
    idPhoto: vine.string().trim().maxLength(200).optional(),
    profilePhoto: vine.string().trim().maxLength(200).optional(),
    postalCode: vine.string().trim().maxLength(20).optional(),
    passportNumber: vine.string().trim().maxLength(50).optional(),
    registrationNumber: vine.string().trim().maxLength(50).optional(),
    passportCountry: vine.string().trim().maxLength(100).optional(),
    passportExpiry: vine.date().optional(),
    visaExpiry: vine.date().optional(),
    idType: vine.string().trim().maxLength(50).optional(),
    idNumber: vine.string().trim().maxLength(50).optional(),
    idCountry: vine.string().trim().maxLength(100).optional(),
    idExpiryDate: vine.date().optional(),
    emergencyContactName: vine.string().trim().maxLength(255).optional(),
    emergencyContactPhone: vine.string().trim().maxLength(20).optional(),
    emergencyContactRelationship: vine.string().trim().maxLength(100).optional(),
    companyName: vine.string().trim().maxLength(255).optional(),
    companyId: vine.number().positive().optional(),
    jobTitle: vine.string().trim().maxLength(100).optional(),
    industry: vine.string().trim().maxLength(100).optional(),
    annualIncome: vine.number().min(0).optional(),
    maritalStatus: vine
      .enum(['single', 'married', 'divorced', 'widowed', 'separated', 'other'])
      .optional(),
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
    viewPreference: vine
      .enum(['ocean', 'city', 'garden', 'pool', 'mountain', 'courtyard', 'no_preference'])
      .optional(),
    specialRequests: vine.string().trim().maxLength(1000).optional(),
    preferences: vine.string().trim().maxLength(1000).optional(),
    loyaltyPrograms: vine
      .array(
        vine.object({
          programName: vine.string().trim().maxLength(100),
          membershipNumber: vine.string().trim().maxLength(50),
          tier: vine.string().trim().maxLength(50).optional(),
          points: vine.number().min(0).optional(),
        })
      )
      .optional(),
    creditCards: vine
      .array(
        vine.object({
          type: vine.enum(['visa', 'mastercard', 'amex', 'discover', 'other']),
          lastFourDigits: vine.string().fixedLength(4),
          expiryMonth: vine.number().min(1).max(12),
          expiryYear: vine.number().min(new Date().getFullYear()),
          holderName: vine.string().trim().maxLength(255),
          isDefault: vine.boolean().optional(),
        })
      )
      .optional(),
    vipStatusId:vine.number().min(0).optional(),
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
    source: vine
      .enum(['website', 'phone', 'email', 'walk_in', 'referral', 'agent', 'corporate', 'other'])
      .optional(),
    referralSource: vine.string().trim().maxLength(255).optional(),
    notes: vine.string().trim().maxLength(2000).optional(),
    internalNotes: vine.string().trim().maxLength(2000).optional(),
    tags: vine.array(vine.string().trim().maxLength(50)).optional(),
    customFields: vine.object({}).optional(),
    socialMedia: vine
      .object({
        facebook: vine.string().url().optional(),
        twitter: vine.string().url().optional(),
        instagram: vine.string().url().optional(),
        linkedin: vine.string().url().optional(),
      })
      .optional(),
    profileImage: vine.string().url().optional(),
    documents: vine
      .array(
        vine.object({
          type: vine.string().trim().maxLength(50),
          name: vine.string().trim().maxLength(255),
          url: vine.string().url(),
          uploadedAt: vine.date().optional(),
        })
      )
      .optional(),
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
    lastModifiedBy: vine.number().positive().optional(),
    guestType: vine.string().trim().maxLength(255).optional(),
    addressLine: vine.string().trim().maxLength(500).optional(),
  })
)

/**
 * Validator to validate the payload when updating
 * an existing guest.
 */
export const updateGuestValidator = vine.compile(
  vine.object({
    firstName: vine.string().trim().minLength(1).maxLength(100).nullable().optional(),
    lastName: vine.string().trim().minLength(1).maxLength(100).nullable().optional(),
    contactType: vine.string().trim().minLength(1).maxLength(100).nullable().optional(),
    whatsappContact: vine.string().trim().minLength(1).maxLength(100).nullable().optional(),
    facebookContact: vine.string().trim().minLength(1).maxLength(100).nullable().optional(),
    maidenName: vine.string().trim().minLength(1).maxLength(100).nullable().optional(),
    middleName: vine.string().trim().maxLength(100).nullable().optional(),
    title: vine.enum(['Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Sir', 'Madam','Miss']).nullable().optional(),
    gender: vine.enum(['male', 'female', 'other', 'prefer_not_to_say']).nullable().optional(),
    dateOfBirth: vine.date().nullable().optional(),
    nationality: vine.string().trim().maxLength(100).nullable().optional(),
    emailSecondary: vine.string().trim().email().maxLength(255).nullable().optional(),
    email: vine.string().trim().email().maxLength(255).nullable().optional(),
    phonePrimary: vine.string().trim().maxLength(20).nullable().optional(),
    placeOfBirth: vine.string().trim().minLength(1).maxLength(100).nullable().optional(),
    profession: vine.string().trim().minLength(1).maxLength(100).nullable().optional(),
    contactTypeValue: vine.string().trim().maxLength(20).nullable().optional(),
    phoneSecondary: vine.string().trim().maxLength(20).nullable().optional(),
    alternatePhone: vine.string().trim().maxLength(20).nullable().optional(),
    address: vine.string().trim().maxLength(500).nullable().optional(),
    city: vine.string().trim().maxLength(100).nullable().optional(),
    state: vine.string().trim().maxLength(100).nullable().optional(),
    stateProvince: vine.string().trim().maxLength(100).nullable().optional(),
    country: vine.string().trim().maxLength(100).nullable().optional(),
    postalCode: vine.string().trim().maxLength(20).nullable().optional(),
    passportNumber: vine.string().trim().maxLength(50).nullable().optional(),
    passportCountry: vine.string().trim().maxLength(100).nullable().optional(),
    passportExpiry: vine.date().nullable().optional(),
    visaExpiry: vine.date().nullable().optional(),
    issuingCountry: vine.string().trim().maxLength(100).nullable().optional(),
    fax: vine.string().trim().maxLength(20).nullable().optional(),
    issuingCity: vine.string().trim().maxLength(100).nullable().optional(),
    idPhoto: vine.string().trim().maxLength(200).nullable().optional(),
    profilePhoto: vine.string().trim().maxLength(200).nullable().optional(),
    registrationNumber: vine.string().trim().maxLength(50).nullable().optional(),
    idType: vine.string().trim().maxLength(50).nullable().optional(),
    idNumber: vine.string().trim().maxLength(50).nullable().optional(),
    idCountry: vine.string().trim().maxLength(100).nullable().optional(),
    idExpiryDate: vine.date().nullable().optional(),
    emergencyContactName: vine.string().trim().maxLength(255).nullable().optional(),
    emergencyContactPhone: vine.string().trim().maxLength(20).nullable().optional(),
    emergencyContactRelationship: vine.string().trim().maxLength(100).nullable().optional(),
    companyName: vine.string().trim().maxLength(255).nullable().optional(),
    companyId: vine.number().positive().nullable().optional(),
    jobTitle: vine.string().trim().maxLength(100).nullable().optional(),
    industry: vine.string().trim().maxLength(100).nullable().optional(),
    annualIncome: vine.number().min(0).nullable().optional(),
    maritalStatus: vine
      .enum(['single', 'married', 'divorced', 'widowed', 'separated', 'other'])
      .nullable().optional(),
    occupation: vine.string().trim().maxLength(100).nullable().optional(),
    education: vine.enum(['high_school', 'bachelor', 'master', 'phd', 'other']).nullable().optional(),
    language: vine.string().trim().maxLength(50).nullable().optional(),
    preferredLanguage: vine.string().trim().maxLength(50).nullable().optional(),
    preferences: vine.string().trim().maxLength(1000).nullable().optional(),
    religion: vine.string().trim().maxLength(100).nullable().optional(),
    dietaryRestrictions: vine.string().trim().maxLength(500).nullable().optional(),
    allergies: vine.string().trim().maxLength(500).nullable().optional(),
    medicalConditions: vine.string().trim().maxLength(500).nullable().optional(),
    accessibilityNeeds: vine.string().trim().maxLength(500).nullable().optional(),
    smokingPreference: vine.enum(['non_smoking', 'smoking', 'no_preference']).nullable().optional(),
    roomPreferences: vine.string().trim().maxLength(1000).nullable().optional(),
    bedPreference: vine.enum(['single', 'double', 'queen', 'king', 'twin']).nullable().optional(),
    floorPreference: vine.enum(['low', 'high', 'specific', 'no_preference']).nullable().optional(),
    viewPreference: vine
      .enum(['ocean', 'city', 'garden', 'pool', 'mountain', 'courtyard', 'no_preference'])
      .nullable().optional(),
    specialRequests: vine.string().trim().maxLength(1000).nullable().optional(),
    loyaltyPrograms: vine
      .array(
        vine.object({
          programName: vine.string().trim().maxLength(100),
          membershipNumber: vine.string().trim().maxLength(50),
          tier: vine.string().trim().maxLength(50).optional(),
          points: vine.number().min(0).optional(),
        })
      )
      .nullable().optional(),
    creditCards: vine
      .array(
        vine.object({
          type: vine.enum(['visa', 'mastercard', 'amex', 'discover', 'other']),
          lastFourDigits: vine.string().fixedLength(4),
          expiryMonth: vine.number().min(1).max(12),
          expiryYear: vine.number().min(new Date().getFullYear()),
          holderName: vine.string().trim().maxLength(255),
          isDefault: vine.boolean().optional(),
        })
      )
      .nullable().optional(),
    vipStatusId:vine.number().min(0).nullable().optional(),
    vipNotes: vine.string().trim().maxLength(1000).nullable().optional(),
    blacklisted: vine.boolean().nullable().optional(),
    blacklistReason: vine.string().trim().maxLength(500).nullable().optional(),
    blacklistedAt: vine.date().nullable().optional(),
    blacklistedBy: vine.number().positive().nullable().optional(),
    marketingOptIn: vine.boolean().nullable().optional(),
    emailOptIn: vine.boolean().nullable().optional(),
    smsOptIn: vine.boolean().nullable().optional(),
    phoneOptIn: vine.boolean().nullable().optional(),
    communicationPreference: vine.enum(['email', 'sms', 'phone', 'mail', 'none']).nullable().optional(),
    preferredContactTime: vine.enum(['morning', 'afternoon', 'evening', 'anytime']).nullable().optional(),
    source: vine
      .enum(['website', 'phone', 'email', 'walk_in', 'referral', 'agent', 'corporate', 'other'])
      .nullable().optional(),
    referralSource: vine.string().trim().maxLength(255).nullable().optional(),
    notes: vine.string().trim().maxLength(2000).nullable().optional(),
    internalNotes: vine.string().trim().maxLength(2000).nullable().optional(),
    tags: vine.array(vine.string().trim().maxLength(50)).nullable().optional(),
    customFields: vine.object({}).nullable().optional(),
    socialMedia: vine
      .object({
        facebook: vine.string().url().optional(),
        twitter: vine.string().url().optional(),
        instagram: vine.string().url().optional(),
        linkedin: vine.string().url().optional(),
      })
      .nullable().optional(),
    profileImage: vine.string().url().nullable().optional(),
    documents: vine
      .array(
        vine.object({
          type: vine.string().trim().maxLength(50),
          name: vine.string().trim().maxLength(255),
          url: vine.string().url(),
          uploadedAt: vine.date().optional(),
        })
      )
      .nullable().optional(),
    isActive: vine.boolean().nullable().optional(),
    isVerified: vine.boolean().nullable().optional(),
    emailVerified: vine.boolean().nullable().optional(),
    phoneVerified: vine.boolean().nullable().optional(),
    lastLoginAt: vine.date().nullable().optional(),
    lastActivityAt: vine.date().nullable().optional(),
    totalStays: vine.number().min(0).nullable().optional(),
    totalSpent: vine.number().min(0).nullable().optional(),
    averageStayLength: vine.number().min(0).nullable().optional(),
    averageRoomRate: vine.number().min(0).nullable().optional(),
    lastStayDate: vine.date().nullable().optional(),
    nextStayDate: vine.date().nullable().optional(),
    lifetimeValue: vine.number().min(0).nullable().optional(),
    riskScore: vine.number().min(0).max(100).nullable().optional(),
    satisfactionScore: vine.number().min(1).max(10).nullable().optional(),
    createdBy: vine.number().positive().nullable().optional(),
    lastModifiedBy: vine.number().positive().nullable().optional(),
    guestType: vine.string().trim().maxLength(255).nullable().optional(),
    addressLine: vine.string().trim().maxLength(500).nullable().optional(),
  })
)
