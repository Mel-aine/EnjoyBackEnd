import vine from '@vinejs/vine'

export const createFolioTransactionValidator = vine.compile(
  vine.object({
    // Basic Information
    hotelId: vine.number().positive(),
    folioId: vine.number().positive(),
    transactionNumber: vine.string().optional(),
    
    // Transaction Details
    transactionType: vine.enum(['charge', 'payment', 'adjustment', 'tax', 'refund', 'transfer']),
    transactionCategory: vine.string().optional(),
    transactionCode: vine.string().optional(),
    
    // Financial Information
    amount: vine.number(),
    currency: vine.string().fixedLength(3).optional(),
    exchangeRate: vine.number().min(0).optional(),
    localAmount: vine.number().optional(),
    
    // Description and Reference
    description: vine.string(),
    reference: vine.string().optional(),
    externalReference: vine.string().optional(),
    
    // Dates
    transactionDate: vine.date(),
    postingDate: vine.date().optional(),
    businessDate: vine.date().optional(),
    
    // Status
    status: vine.enum(['pending', 'posted', 'voided', 'refunded']),
    
    // Room Information
    roomId: vine.number().positive().optional(),
    roomNumber: vine.string().optional(),
    
    // Guest Information
    guestId: vine.number().positive().optional(),
    guestName: vine.string().optional(),
    
    // Revenue Information
    revenueCenter: vine.string().optional(),
    departmentCode: vine.string().optional(),
    accountCode: vine.string().optional(),
    glAccount: vine.string().optional(),
    
    // Tax Information
    taxInclusive: vine.boolean().optional(),
    taxRate: vine.number().min(0).max(100).optional(),
    taxAmount: vine.number().min(0).optional(),
    taxCode: vine.string().optional(),
    
    // Service Charge
    serviceChargeRate: vine.number().min(0).max(100).optional(),
    serviceChargeAmount: vine.number().min(0).optional(),
    
    // Package Information
    packageId: vine.number().positive().optional(),
    packageCode: vine.string().optional(),
    packageItem: vine.string().optional(),
    
    // Quantity and Rate
    quantity: vine.number().min(0).optional(),
    unitPrice: vine.number().min(0).optional(),
    rateCode: vine.string().optional(),
    
    // Payment Information
    paymentMethodId: vine.number().positive().optional(),
    paymentMethod: vine.string().optional(),
    creditCardType: vine.string().optional(),
    creditCardLastFour: vine.string().fixedLength(4).optional(),
    authorizationCode: vine.string().optional(),
    
    // Transfer Information
    transferFromFolioId: vine.number().positive().optional(),
    transferToFolioId: vine.number().positive().optional(),
    transferReference: vine.string().optional(),
    
    // Adjustment Information
    adjustmentReason: vine.string().optional(),
    adjustmentType: vine.string().optional(),
    originalTransactionId: vine.number().positive().optional(),
    
    // Void Information
    voidReason: vine.string().optional(),
    voidedBy: vine.number().positive().optional(),
    voidedAt: vine.date().optional(),
    
    // Refund Information
    refundReason: vine.string().optional(),
    refundMethod: vine.string().optional(),
    refundedBy: vine.number().positive().optional(),
    refundedAt: vine.date().optional(),
    
    // Commission Information
    commissionRate: vine.number().min(0).max(100).optional(),
    commissionAmount: vine.number().min(0).optional(),
    commissionCode: vine.string().optional(),
    
    // Comp Information
    compType: vine.string().optional(),
    compReason: vine.string().optional(),
    compAuthorizedBy: vine.number().positive().optional(),
    
    // Market Information
    marketCode: vine.string().optional(),
    sourceCode: vine.string().optional(),
    
    // Group Information
    groupId: vine.number().positive().optional(),
    groupCode: vine.string().optional(),
    
    // Corporate Information
    corporateId: vine.number().positive().optional(),
    corporateCode: vine.string().optional(),
    
    // Routing Information
    routingCode: vine.string().optional(),
    routingInstructions: vine.string().optional(),
    
    // Settlement Information
    settlementDate: vine.date().optional(),
    settlementMethod: vine.string().optional(),
    settlementReference: vine.string().optional(),
    
    // Operational Information
    cashierId: vine.number().positive().optional(),
    shiftId: vine.number().positive().optional(),
    workstationId: vine.string().optional(),
    terminalId: vine.string().optional(),
    
    // Audit Information
    createdBy: vine.number().positive().optional(),
    modifiedBy: vine.number().positive().optional(),
    postedBy: vine.number().positive().optional(),
    
    // External Integration
    externalTransactionId: vine.string().optional(),
    externalSystem: vine.string().optional(),
    syncStatus: vine.enum(['pending', 'synced', 'failed']).optional(),
    lastSyncAt: vine.date().optional(),
    
    // Batch Information
    batchId: vine.string().optional(),
    batchSequence: vine.number().positive().optional(),
    
    // Notes and Comments
    notes: vine.string().optional(),
    internalNotes: vine.string().optional(),
    guestComments: vine.string().optional(),
    
    // Flags
    isManual: vine.boolean().optional(),
    isAutomatic: vine.boolean().optional(),
    isRecurring: vine.boolean().optional(),
    isDisputed: vine.boolean().optional(),
    requiresApproval: vine.boolean().optional(),
    
    // Analytics
    profitCenter: vine.string().optional(),
    costCenter: vine.string().optional(),
    
    // Custom Fields
    customField1: vine.string().optional(),
    customField2: vine.string().optional(),
    customField3: vine.string().optional(),
    customField4: vine.string().optional(),
    customField5: vine.string().optional(),
    
    // Tags and Categories
    tags: vine.array(vine.string()).optional(),
    category: vine.string().optional(),
    subcategory: vine.string().optional(),
  })
)

export const updateFolioTransactionValidator = vine.compile(
  vine.object({
    // Basic Information
    hotelId: vine.number().positive().optional(),
    folioId: vine.number().positive().optional(),
    transactionNumber: vine.string().optional(),
    
    // Transaction Details
    transactionType: vine.enum(['charge', 'payment', 'adjustment', 'tax', 'refund', 'transfer']).optional(),
    transactionCategory: vine.string().optional(),
    transactionCode: vine.string().optional(),
    
    // Financial Information
    amount: vine.number().optional(),
    currency: vine.string().fixedLength(3).optional(),
    exchangeRate: vine.number().min(0).optional(),
    localAmount: vine.number().optional(),
    
    // Description and Reference
    description: vine.string().optional(),
    reference: vine.string().optional(),
    externalReference: vine.string().optional(),
    
    // Dates
    transactionDate: vine.date().optional(),
    postingDate: vine.date().optional(),
    businessDate: vine.date().optional(),
    
    // Status
    status: vine.enum(['pending', 'posted', 'voided', 'refunded']).optional(),
    
    // Room Information
    roomId: vine.number().positive().optional(),
    roomNumber: vine.string().optional(),
    
    // Guest Information
    guestId: vine.number().positive().optional(),
    guestName: vine.string().optional(),
    
    // Revenue Information
    revenueCenter: vine.string().optional(),
    departmentCode: vine.string().optional(),
    accountCode: vine.string().optional(),
    glAccount: vine.string().optional(),
    
    // Tax Information
    taxInclusive: vine.boolean().optional(),
    taxRate: vine.number().min(0).max(100).optional(),
    taxAmount: vine.number().min(0).optional(),
    taxCode: vine.string().optional(),
    
    // Service Charge
    serviceChargeRate: vine.number().min(0).max(100).optional(),
    serviceChargeAmount: vine.number().min(0).optional(),
    
    // Package Information
    packageId: vine.number().positive().optional(),
    packageCode: vine.string().optional(),
    packageItem: vine.string().optional(),
    
    // Quantity and Rate
    quantity: vine.number().min(0).optional(),
    unitPrice: vine.number().min(0).optional(),
    rateCode: vine.string().optional(),
    
    // Payment Information
    paymentMethodId: vine.number().positive().optional(),
    paymentMethod: vine.string().optional(),
    creditCardType: vine.string().optional(),
    creditCardLastFour: vine.string().fixedLength(4).optional(),
    authorizationCode: vine.string().optional(),
    
    // Transfer Information
    transferFromFolioId: vine.number().positive().optional(),
    transferToFolioId: vine.number().positive().optional(),
    transferReference: vine.string().optional(),
    
    // Adjustment Information
    adjustmentReason: vine.string().optional(),
    adjustmentType: vine.string().optional(),
    originalTransactionId: vine.number().positive().optional(),
    
    // Void Information
    voidReason: vine.string().optional(),
    voidedBy: vine.number().positive().optional(),
    voidedAt: vine.date().optional(),
    
    // Refund Information
    refundReason: vine.string().optional(),
    refundMethod: vine.string().optional(),
    refundedBy: vine.number().positive().optional(),
    refundedAt: vine.date().optional(),
    
    // Commission Information
    commissionRate: vine.number().min(0).max(100).optional(),
    commissionAmount: vine.number().min(0).optional(),
    commissionCode: vine.string().optional(),
    
    // Comp Information
    compType: vine.string().optional(),
    compReason: vine.string().optional(),
    compAuthorizedBy: vine.number().positive().optional(),
    
    // Market Information
    marketCode: vine.string().optional(),
    sourceCode: vine.string().optional(),
    
    // Group Information
    groupId: vine.number().positive().optional(),
    groupCode: vine.string().optional(),
    
    // Corporate Information
    corporateId: vine.number().positive().optional(),
    corporateCode: vine.string().optional(),
    
    // Routing Information
    routingCode: vine.string().optional(),
    routingInstructions: vine.string().optional(),
    
    // Settlement Information
    settlementDate: vine.date().optional(),
    settlementMethod: vine.string().optional(),
    settlementReference: vine.string().optional(),
    
    // System Information
    cashierId: vine.number().positive().optional(),
    shiftId: vine.number().positive().optional(),
    workstationId: vine.string().optional(),
    terminalId: vine.string().optional(),
    
    // Audit Information
    createdBy: vine.number().positive().optional(),
    modifiedBy: vine.number().positive().optional(),
    postedBy: vine.number().positive().optional(),
    
    // External Integration
    externalTransactionId: vine.string().optional(),
    externalSystem: vine.string().optional(),
    syncStatus: vine.enum(['pending', 'synced', 'failed']).optional(),
    lastSyncAt: vine.date().optional(),
    
    // Batch Information
    batchId: vine.string().optional(),
    batchSequence: vine.number().positive().optional(),
    
    // Notes and Comments
    notes: vine.string().optional(),
    internalNotes: vine.string().optional(),
    guestComments: vine.string().optional(),
    
    // Flags
    isManual: vine.boolean().optional(),
    isAutomatic: vine.boolean().optional(),
    isRecurring: vine.boolean().optional(),
    isDisputed: vine.boolean().optional(),
    requiresApproval: vine.boolean().optional(),
    
    // Analytics
    profitCenter: vine.string().optional(),
    costCenter: vine.string().optional(),
    
    // Custom Fields
    customField1: vine.string().optional(),
    customField2: vine.string().optional(),
    customField3: vine.string().optional(),
    customField4: vine.string().optional(),
    customField5: vine.string().optional(),
    
    // Tags and Categories
    tags: vine.string().optional(),
    category: vine.string().optional(),
    subcategory: vine.string().optional(),
  })
)