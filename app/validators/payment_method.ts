import vine from '@vinejs/vine'
import { PaymentMethodType } from '#app/enums'

export const createPaymentMethodValidator = vine.compile(
  vine.object({
    // Basic Information
    hotelId: vine.number().positive(),
    methodName: vine.string().minLength(1).maxLength(100),
    methodCode: vine.string().minLength(1).maxLength(20),
    shortCode: vine.string().minLength(1).maxLength(10),
    methodType: vine.enum(Object.values(PaymentMethodType)),
    type: vine.enum(['CASH', 'BANK']),
    cardProcessing: vine.boolean().optional(),
    
    // Status
    isActive: vine.boolean().optional(),
    isDefault: vine.boolean().optional(),
    
    // Display Information
    displayName: vine.string().optional(),
    description: vine.string().optional(),
    icon: vine.string().optional(),
    color: vine.string().optional(),
    
    // Processing Information
    requiresAuthorization: vine.boolean().optional(),
    requiresSignature: vine.boolean().optional(),
    requiresPin: vine.boolean().optional(),
    requiresIdVerification: vine.boolean().optional(),
    
    // Credit Card Specific
    acceptedCardTypes: vine.string().optional(), // JSON array of accepted card types
    minAmount: vine.number().min(0).optional(),
    maxAmount: vine.number().min(0).optional(),
    
    // Processing Configuration
    processorName: vine.string().optional(),
    processorConfig: vine.string().optional(), // JSON configuration
    merchantId: vine.string().optional(),
    terminalId: vine.string().optional(),
    
    // Fees and Charges
    processingFeeType: vine.enum(['fixed', 'percentage', 'tiered']).optional(),
    processingFeeAmount: vine.number().min(0).optional(),
    processingFeePercentage: vine.number().min(0).max(100).optional(),
    
    // Currency Support
    supportedCurrencies: vine.string().optional(), // JSON array of currency codes
    defaultCurrency: vine.string().fixedLength(3).optional(),
    
    // Settlement Information
    settlementType: vine.enum(['immediate', 'daily', 'weekly', 'monthly']).optional(),
    settlementAccount: vine.string().optional(),
    settlementDelayDays: vine.number().min(0).optional(),
    
    // Security
    encryptionRequired: vine.boolean().optional(),
    tokenizationSupported: vine.boolean().optional(),
    pciCompliant: vine.boolean().optional(),
    
    // Limits
    dailyLimit: vine.number().min(0).optional(),
    monthlyLimit: vine.number().min(0).optional(),
    transactionLimit: vine.number().min(0).optional(),
    
    // Refund Configuration
    supportsRefunds: vine.boolean().optional(),
    refundPolicy: vine.string().optional(),
    refundFee: vine.number().min(0).optional(),
    
    // Chargeback Configuration
    supportsChargebacks: vine.boolean().optional(),
    chargebackFee: vine.number().min(0).optional(),
    
    // Reporting
    reportingCode: vine.string().optional(),
    glAccount: vine.string().optional(),
    revenueCenter: vine.string().optional(),
    
    // Integration
    apiEndpoint: vine.string().optional(),
    apiKey: vine.string().optional(),
    webhookUrl: vine.string().optional(),
    
    // Mobile Payment Specific
    mobileAppId: vine.string().optional(),
    qrCodeSupported: vine.boolean().optional(),
    nfcSupported: vine.boolean().optional(),
    
    // Gift Card Specific
    giftCardProvider: vine.string().optional(),
    giftCardValidationUrl: vine.string().optional(),
    
    // Loyalty Points Specific
    loyaltyProgramId: vine.number().positive().optional(),
    pointsConversionRate: vine.number().min(0).optional(),
    
    // Voucher Specific
    voucherValidationRequired: vine.boolean().optional(),
    voucherExpiryCheck: vine.boolean().optional(),
    
    // Check Specific
    checkVerificationRequired: vine.boolean().optional(),
    checkGuaranteeRequired: vine.boolean().optional(),
    
    // Bank Transfer Specific
    bankAccountRequired: vine.boolean().optional(),
    routingNumberRequired: vine.boolean().optional(),
    
    // House Account Specific
    creditLimitRequired: vine.boolean().optional(),
    approvalRequired: vine.boolean().optional(),
    
    // Operational
    sortOrder: vine.number().min(0).optional(),
    departmentRestrictions: vine.string().optional(), // JSON array of department codes
    userRoleRestrictions: vine.string().optional(), // JSON array of role IDs
    
    // Audit Information
    createdBy: vine.number().positive().optional(),
    modifiedBy: vine.number().positive().optional(),
    
    // External Integration
    externalId: vine.string().optional(),
    externalSystem: vine.string().optional(),
    syncStatus: vine.enum(['pending', 'synced', 'failed']).optional(),
    lastSyncAt: vine.date().optional(),
    
    // Testing
    testMode: vine.boolean().optional(),
    testCredentials: vine.string().optional(),
    
    // Surcharge Settings
    surchargeEnabled: vine.boolean().optional(),
    surchargeType: vine.enum(['amount', 'percent']).optional(),
    surchargeValue: vine.number().min(0).optional(),
    extraChargeId: vine.number().positive().optional(),
    
    // Receipt Settings
    receiptNoSetting: vine.enum(['auto_general', 'auto_private', 'manual']).optional(),
    
    // Notes and Comments
    notes: vine.string().optional(),
    internalNotes: vine.string().optional(),
    setupInstructions: vine.string().optional(),
    
    // Flags
    requiresTraining: vine.boolean().optional(),
    isDeprecated: vine.boolean().optional(),
    maintenanceMode: vine.boolean().optional(),
    
    // Analytics
    usageTracking: vine.boolean().optional(),
    performanceMonitoring: vine.boolean().optional(),
    
    // Custom Fields
    customField1: vine.string().optional(),
    customField2: vine.string().optional(),
    customField3: vine.string().optional(),
    customField4: vine.string().optional(),
    customField5: vine.string().optional(),
    
    // Tags and Categories
    category: vine.string().optional(),
    subcategory: vine.string().optional(),
    tags: vine.string().optional(), // JSON array of tags
    
    // Type-specific Icons
    typeIcon: vine.string().optional(),
  })
)

export const updatePaymentMethodValidator = vine.compile(
  vine.object({
    // Basic Information
    hotelId: vine.number().positive().optional(),
    methodName: vine.string().minLength(1).maxLength(100).optional(),
    methodCode: vine.string().minLength(1).maxLength(20).optional(),
    shortCode: vine.string().minLength(1).maxLength(10).optional(),
    methodType: vine.enum(Object.values(PaymentMethodType)).optional(),
    type: vine.enum(['CASH', 'BANK']).optional(),
    cardProcessing: vine.boolean().optional(),
    
    // Status
    isActive: vine.boolean().optional(),
    isDefault: vine.boolean().optional(),
    
    // Display Information
    displayName: vine.string().optional(),
    description: vine.string().optional(),
    icon: vine.string().optional(),
    color: vine.string().optional(),
    
    // Processing Information
    requiresAuthorization: vine.boolean().optional(),
    requiresSignature: vine.boolean().optional(),
    requiresPin: vine.boolean().optional(),
    requiresIdVerification: vine.boolean().optional(),
    
    // Credit Card Specific
    acceptedCardTypes: vine.string().optional(),
    minAmount: vine.number().min(0).optional(),
    maxAmount: vine.number().min(0).optional(),
    
    // Processing Configuration
    processorName: vine.string().optional(),
    processorConfig: vine.string().optional(), // JSON configuration
    merchantId: vine.string().optional(),
    terminalId: vine.string().optional(),
    
    // Fees and Charges
    processingFeeType: vine.enum(['fixed', 'percentage', 'tiered']).optional(),
    processingFeeAmount: vine.number().min(0).optional(),
    processingFeePercentage: vine.number().min(0).max(100).optional(),
    
    // Currency Support
    supportedCurrencies: vine.string().optional(), // JSON array of currency codes
    defaultCurrency: vine.string().fixedLength(3).optional(),
    
    // Settlement Information
    settlementType: vine.enum(['immediate', 'daily', 'weekly', 'monthly']).optional(),
    settlementAccount: vine.string().optional(),
    settlementDelayDays: vine.number().min(0).optional(),
    
    // Security
    encryptionRequired: vine.boolean().optional(),
    tokenizationSupported: vine.boolean().optional(),
    pciCompliant: vine.boolean().optional(),
    
    // Limits
    dailyLimit: vine.number().min(0).optional(),
    monthlyLimit: vine.number().min(0).optional(),
    transactionLimit: vine.number().min(0).optional(),
    
    // Refund Configuration
    supportsRefunds: vine.boolean().optional(),
    refundPolicy: vine.string().optional(),
    refundFee: vine.number().min(0).optional(),
    
    // Chargeback Configuration
    supportsChargebacks: vine.boolean().optional(),
    chargebackFee: vine.number().min(0).optional(),
    
    // Reporting
    reportingCode: vine.string().optional(),
    glAccount: vine.string().optional(),
    revenueCenter: vine.string().optional(),
    
    // Integration
    apiEndpoint: vine.string().optional(),
    apiKey: vine.string().optional(),
    webhookUrl: vine.string().optional(),
    
    // Mobile Payment Specific
    mobileAppId: vine.string().optional(),
    qrCodeSupported: vine.boolean().optional(),
    nfcSupported: vine.boolean().optional(),
    
    // Gift Card Specific
    giftCardProvider: vine.string().optional(),
    giftCardValidationUrl: vine.string().optional(),
    
    // Loyalty Points Specific
    loyaltyProgramId: vine.number().positive().optional(),
    pointsConversionRate: vine.number().min(0).optional(),
    
    // Voucher Specific
    voucherValidationRequired: vine.boolean().optional(),
    voucherExpiryCheck: vine.boolean().optional(),
    
    // Check Specific
    checkVerificationRequired: vine.boolean().optional(),
    checkGuaranteeRequired: vine.boolean().optional(),
    
    // Bank Transfer Specific
    bankAccountRequired: vine.boolean().optional(),
    routingNumberRequired: vine.boolean().optional(),
    
    // House Account Specific
    creditLimitRequired: vine.boolean().optional(),
    approvalRequired: vine.boolean().optional(),
    
    // Operational
    sortOrder: vine.number().min(0).optional(),
    departmentRestrictions: vine.string().optional(),
    userRoleRestrictions: vine.string().optional(),
    
    // Audit Information
    createdBy: vine.number().positive().optional(),
    modifiedBy: vine.number().positive().optional(),
    
    // External Integration
    externalId: vine.string().optional(),
    externalSystem: vine.string().optional(),
    syncStatus: vine.enum(['pending', 'synced', 'failed']).optional(),
    lastSyncAt: vine.date().optional(),
    
    // Testing
    testMode: vine.boolean().optional(),
    testCredentials: vine.string().optional(),
    
    // Surcharge Settings
    surchargeEnabled: vine.boolean().optional(),
    surchargeType: vine.enum(['amount', 'percent']).optional(),
    surchargeValue: vine.number().min(0).optional(),
    extraChargeId: vine.number().positive().optional(),
    
    // Receipt Settings
    receiptNoSetting: vine.enum(['auto_general', 'auto_private', 'manual']).optional(),
    
    // Notes and Comments
    notes: vine.string().optional(),
    internalNotes: vine.string().optional(),
    setupInstructions: vine.string().optional(),
    
    // Flags
    requiresTraining: vine.boolean().optional(),
    isDeprecated: vine.boolean().optional(),
    maintenanceMode: vine.boolean().optional(),
    
    // Analytics
    usageTracking: vine.boolean().optional(),
    performanceMonitoring: vine.boolean().optional(),
    
    // Custom Fields
    customField1: vine.string().optional(),
    customField2: vine.string().optional(),
    customField3: vine.string().optional(),
    customField4: vine.string().optional(),
    customField5: vine.string().optional(),
    
    // Tags and Categories
    category: vine.string().optional(),
    subcategory: vine.string().optional(),
    tags: vine.string().optional(), // JSON array of tags
    
    // Type-specific Icons
    typeIcon: vine.string().optional(),
  })
)