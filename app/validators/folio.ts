import vine from '@vinejs/vine'

// Validator for posting transactions
export const postTransactionValidator = vine.compile(
  vine.object({
    folioId: vine.number().positive(),
    transactionType: vine.enum(['charge', 'payment', 'adjustment', 'transfer', 'refund', 'void']),
    category: vine.string().minLength(1),
    description: vine.string().minLength(1),
    amount: vine.number(),
    quantity: vine.number().positive().optional(),
    unitPrice: vine.number().optional(),
    taxAmount: vine.number().min(0).optional(),
    serviceChargeAmount: vine.number().min(0).optional(),
    discountAmount: vine.number().min(0).optional(),
    departmentId: vine.number().positive().optional(),
    revenueCenterId: vine.number().positive().optional(),
    costCenterId: vine.number().positive().optional(),
    glAccountCode: vine.string().optional(),
    paymentMethodId: vine.number().positive().optional(),
    reference: vine.string().optional(),
    notes: vine.string().optional()
  })
)

// Validator for folio settlement
export const settleFolioValidator = vine.compile(
  vine.object({
    folioId: vine.number().positive(),
    paymentMethodId: vine.number().positive(),
    amount: vine.number().positive(),
    reference: vine.string().optional(),
    notes: vine.string().optional()
  })
)

// Validator for charge transfers
export const transferChargesValidator = vine.compile(
  vine.object({
    fromFolioId: vine.number().positive(),
    toFolioId: vine.number().positive(),
    amount: vine.number().positive(),
    description: vine.string().minLength(1),
    reference: vine.string().optional()
  })
)

// Validator for creating folio with service
export const createFolioServiceValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive(),
    guestId: vine.number().positive(),
    reservationId: vine.number().positive().optional(),
    groupId: vine.number().positive().optional(),
    companyId: vine.number().positive().optional(),
    folioType: vine.enum(['guest', 'master', 'group', 'company']).optional(),
    creditLimit: vine.number().min(0).optional(),
    notes: vine.string().maxLength(500).optional(),
    createdBy: vine.number().positive()
  })
)

export const createReservationFolioValidator = vine.compile(
  vine.object({
    reservationId: vine.number().positive(),
    folioType: vine.enum(['guest', 'master', 'group', 'company']).optional(),
    creditLimit: vine.number().min(0).optional(),
    notes: vine.string().maxLength(500).optional(),
    createdBy: vine.number().positive()
  })
)

export const createWalkInFolioValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive(),
    guestId: vine.number().positive(),
    folioType: vine.enum(['guest', 'master']).optional(),
    creditLimit: vine.number().min(0).optional(),
    notes: vine.string().maxLength(500).optional(),
    createdBy: vine.number().positive()
  })
)

export const createGroupFoliosValidator = vine.compile(
  vine.object({
    reservationId: vine.number().positive(),
    guestIds: vine.array(vine.number().positive()).minLength(1),
    createdBy: vine.number().positive()
  })
)

export const postRoomChargesValidator = vine.compile(
  vine.object({
    reservationId: vine.number().positive(),
    postedBy: vine.number().positive()
  })
)

export const postTaxesAndFeesValidator = vine.compile(
  vine.object({
    reservationId: vine.number().positive(),
    postedBy: vine.number().positive()
  })
)

export const checkoutValidator = vine.compile(
  vine.object({
    folioId: vine.number().positive(),
    paymentMethodId: vine.number().positive(),
    paymentAmount: vine.number().min(0).optional(),
    paymentReference: vine.string().maxLength(100).optional(),
    notes: vine.string().maxLength(500).optional(),
    processedBy: vine.number().positive()
  })
)

export const reservationCheckoutValidator = vine.compile(
  vine.object({
    reservationId: vine.number().positive(),
    payments: vine.array(
      vine.object({
        paymentMethodId: vine.number().positive(),
        paymentAmount: vine.number().min(0).optional(),
        paymentReference: vine.string().maxLength(100).optional(),
        notes: vine.string().maxLength(500).optional()
      })
    ).minLength(1),
    processedBy: vine.number().positive()
  })
)

export const forceCloseValidator = vine.compile(
  vine.object({
    folioId: vine.number().positive(),
    reason: vine.string().minLength(10).maxLength(500),
    authorizedBy: vine.number().positive(),
    processedBy: vine.number().positive()
  })
)

export const createFolioValidator = vine.compile(
  vine.object({
    // Basic Information
    hotel_id: vine.number().positive(),
    guest_id: vine.number().positive().optional(),
    reservation_id: vine.number().positive().optional(),
    folio_number: vine.string().optional(),
    folio_type: vine.enum(['guest', 'master', 'group', 'house', 'city_ledger', 'ar']),
    
    // Status
    status: vine.enum(['open', 'closed', 'transferred', 'voided', 'disputed']),
    
    // Dates
    folio_date: vine.date(),
    check_in_date: vine.date().optional(),
    check_out_date: vine.date().optional(),
    posting_date: vine.date().optional(),
    closed_date: vine.date().optional(),
    
    // Financial Information
    currency: vine.string().fixedLength(3).optional(),
    exchange_rate: vine.number().min(0).optional(),
    
    // Balances
    total_charges: vine.number().min(0).optional(),
    total_payments: vine.number().min(0).optional(),
    total_adjustments: vine.number().min(0).optional(),
    balance: vine.number().optional(),
    
    // Room Information
    room_id: vine.number().positive().optional(),
    room_number: vine.string().optional(),
    room_type: vine.string().optional(),
    rate_code: vine.string().optional(),
    
    // Guest Information
    guest_name: vine.string().optional(),
    guest_company: vine.string().optional(),
    guest_address: vine.string().optional(),
    guest_city: vine.string().optional(),
    guest_state: vine.string().optional(),
    guest_country: vine.string().optional(),
    guest_postal_code: vine.string().optional(),
    guest_phone: vine.string().optional(),
    guest_email: vine.string().email().optional(),
    
    // Billing Information
    billing_name: vine.string().optional(),
    billing_company: vine.string().optional(),
    billing_address: vine.string().optional(),
    billing_city: vine.string().optional(),
    billing_state: vine.string().optional(),
    billing_country: vine.string().optional(),
    billing_postal_code: vine.string().optional(),
    billing_phone: vine.string().optional(),
    billing_email: vine.string().email().optional(),
    
    // Tax Information
    tax_exempt: vine.boolean().optional(),
    tax_exempt_number: vine.string().optional(),
    tax_rate: vine.number().min(0).max(100).optional(),
    total_tax: vine.number().min(0).optional(),
    
    // Group Information
    group_id: vine.number().positive().optional(),
    group_name: vine.string().optional(),
    group_code: vine.string().optional(),
    master_folio_id: vine.number().positive().optional(),
    
    // Corporate Information
    corporate_id: vine.number().positive().optional(),
    corporate_name: vine.string().optional(),
    corporate_rate: vine.boolean().optional(),
    
    // Payment Information
    payment_terms: vine.string().optional(),
    credit_limit: vine.number().min(0).optional(),
    payment_method: vine.string().optional(),
    credit_card_type: vine.string().optional(),
    credit_card_last_four: vine.string().fixedLength(4).optional(),
    credit_card_expiry: vine.string().optional(),
    
    // Routing Information
    routing_instructions: vine.string().optional(),
    auto_routing: vine.boolean().optional(),
    routing_code: vine.string().optional(),
    
    // Settlement Information
    settlement_method: vine.string().optional(),
    settlement_date: vine.date().optional(),
    settlement_reference: vine.string().optional(),
    
    // Printing and Communication
    print_rate: vine.boolean().optional(),
    suppress_rate: vine.boolean().optional(),
    no_post: vine.boolean().optional(),
    email_folio: vine.boolean().optional(),
    
    // Market Information
    market_code: vine.string().optional(),
    source_code: vine.string().optional(),
    origin_code: vine.string().optional(),
    
    // Package Information
    package_code: vine.string().optional(),
    package_amount: vine.number().min(0).optional(),
    package_description: vine.string().optional(),
    
    // Comp and Discount
    comp_type: vine.string().optional(),
    comp_reason: vine.string().optional(),
    comp_authorized_by: vine.number().positive().optional(),
    discount_reason: vine.string().optional(),
    discount_authorized_by: vine.number().positive().optional(),
    
    // VIP Information
    vip_status: vine.string().optional(),
    vip_code: vine.string().optional(),
    special_attention: vine.string().optional(),
    
    // Membership Information
    membership_type: vine.string().optional(),
    membership_number: vine.string().optional(),
    membership_level: vine.string().optional(),
    
    // Commission Information
    commission_code: vine.string().optional(),
    commission_rate: vine.number().min(0).max(100).optional(),
    commission_amount: vine.number().min(0).optional(),
    
    // Deposit Information
    deposit_required: vine.boolean().optional(),
    deposit_amount: vine.number().min(0).optional(),
    deposit_paid: vine.boolean().optional(),
    deposit_date: vine.date().optional(),
    
    // Credit Information
    credit_check_required: vine.boolean().optional(),
    credit_approved: vine.boolean().optional(),
    credit_approved_by: vine.number().positive().optional(),
    credit_approved_date: vine.date().optional(),
    
    // Operational Information
    cashier_id: vine.number().positive().optional(),
    shift_id: vine.number().positive().optional(),
    workstation_id: vine.string().optional(),
    
    // Audit Information
    created_by: vine.number().positive().optional(),
    modified_by: vine.number().positive().optional(),
    posted_by: vine.number().positive().optional(),
    closed_by: vine.number().positive().optional(),
    
    // External Integration
    external_folio_id: vine.string().optional(),
    external_system: vine.string().optional(),
    sync_status: vine.enum(['pending', 'synced', 'failed']).optional(),
    last_sync_at: vine.date().optional(),
    
    // Notes and Comments
    notes: vine.string().optional(),
    internal_notes: vine.string().optional(),
    guest_comments: vine.string().optional(),
    special_instructions: vine.string().optional(),
    
    // Flags
    is_master: vine.boolean().optional(),
    is_shared: vine.boolean().optional(),
    is_locked: vine.boolean().optional(),
    is_disputed: vine.boolean().optional(),
    requires_approval: vine.boolean().optional(),
    
    // Analytics
    revenue_center: vine.string().optional(),
    profit_center: vine.string().optional(),
    cost_center: vine.string().optional(),
    
    // Custom Fields
    custom_field_1: vine.string().optional(),
    custom_field_2: vine.string().optional(),
    custom_field_3: vine.string().optional(),
    custom_field_4: vine.string().optional(),
    custom_field_5: vine.string().optional(),
    
    // Tags and Categories
    tags: vine.string().optional(),
    category: vine.string().optional(),
    subcategory: vine.string().optional(),
  })
)

export const updateFolioValidator = vine.compile(
  vine.object({
    // Basic Information
    hotel_id: vine.number().positive().optional(),
    guest_id: vine.number().positive().optional(),
    reservation_id: vine.number().positive().optional(),
    folio_number: vine.string().optional(),
    folio_type: vine.enum(['guest', 'master', 'group', 'house', 'city_ledger', 'ar']).optional(),
    
    // Status
    status: vine.enum(['open', 'closed', 'transferred', 'voided', 'disputed']).optional(),
    
    // Dates
    folio_date: vine.date().optional(),
    check_in_date: vine.date().optional(),
    check_out_date: vine.date().optional(),
    posting_date: vine.date().optional(),
    closed_date: vine.date().optional(),
    
    // Financial Information
    currency: vine.string().fixedLength(3).optional(),
    exchange_rate: vine.number().min(0).optional(),
    
    // Balances
    total_charges: vine.number().min(0).optional(),
    total_payments: vine.number().min(0).optional(),
    total_adjustments: vine.number().min(0).optional(),
    balance: vine.number().optional(),
    
    // Room Information
    room_id: vine.number().positive().optional(),
    room_number: vine.string().optional(),
    room_type: vine.string().optional(),
    rate_code: vine.string().optional(),
    
    // Guest Information
    guest_name: vine.string().optional(),
    guest_company: vine.string().optional(),
    guest_address: vine.string().optional(),
    guest_city: vine.string().optional(),
    guest_state: vine.string().optional(),
    guest_country: vine.string().optional(),
    guest_postal_code: vine.string().optional(),
    guest_phone: vine.string().optional(),
    guest_email: vine.string().email().optional(),
    
    // Billing Information
    billing_name: vine.string().optional(),
    billing_company: vine.string().optional(),
    billing_address: vine.string().optional(),
    billing_city: vine.string().optional(),
    billing_state: vine.string().optional(),
    billing_country: vine.string().optional(),
    billing_postal_code: vine.string().optional(),
    billing_phone: vine.string().optional(),
    billing_email: vine.string().email().optional(),
    
    // Tax Information
    tax_exempt: vine.boolean().optional(),
    tax_exempt_number: vine.string().optional(),
    tax_rate: vine.number().min(0).max(100).optional(),
    total_tax: vine.number().min(0).optional(),
    
    // Group Information
    group_id: vine.number().positive().optional(),
    group_name: vine.string().optional(),
    group_code: vine.string().optional(),
    master_folio_id: vine.number().positive().optional(),
    
    // Corporate Information
    corporate_id: vine.number().positive().optional(),
    corporate_name: vine.string().optional(),
    corporate_rate: vine.boolean().optional(),
    
    // Payment Information
    payment_terms: vine.string().optional(),
    credit_limit: vine.number().min(0).optional(),
    payment_method: vine.string().optional(),
    credit_card_type: vine.string().optional(),
    credit_card_last_four: vine.string().fixedLength(4).optional(),
    credit_card_expiry: vine.string().optional(),
    
    // Routing Information
    routing_instructions: vine.string().optional(),
    auto_routing: vine.boolean().optional(),
    routing_code: vine.string().optional(),
    
    // Settlement Information
    settlement_method: vine.string().optional(),
    settlement_date: vine.date().optional(),
    settlement_reference: vine.string().optional(),
    
    // Printing and Communication
    print_rate: vine.boolean().optional(),
    suppress_rate: vine.boolean().optional(),
    no_post: vine.boolean().optional(),
    email_folio: vine.boolean().optional(),
    
    // Market Information
    market_code: vine.string().optional(),
    source_code: vine.string().optional(),
    origin_code: vine.string().optional(),
    
    // Package Information
    package_code: vine.string().optional(),
    package_amount: vine.number().min(0).optional(),
    package_description: vine.string().optional(),
    
    // Comp and Discount
    comp_type: vine.string().optional(),
    comp_reason: vine.string().optional(),
    comp_authorized_by: vine.number().positive().optional(),
    discount_reason: vine.string().optional(),
    discount_authorized_by: vine.number().positive().optional(),
    
    // VIP Information
    vip_status: vine.string().optional(),
    vip_code: vine.string().optional(),
    special_attention: vine.string().optional(),
    
    // Membership Information
    membership_type: vine.string().optional(),
    membership_number: vine.string().optional(),
    membership_level: vine.string().optional(),
    
    // Commission Information
    commission_code: vine.string().optional(),
    commission_rate: vine.number().min(0).max(100).optional(),
    commission_amount: vine.number().min(0).optional(),
    
    // Deposit Information
    deposit_required: vine.boolean().optional(),
    deposit_amount: vine.number().min(0).optional(),
    deposit_paid: vine.boolean().optional(),
    deposit_date: vine.date().optional(),
    
    // Credit Information
    credit_check_required: vine.boolean().optional(),
    credit_approved: vine.boolean().optional(),
    credit_approved_by: vine.number().positive().optional(),
    credit_approved_date: vine.date().optional(),
    
    // Operational Information
    cashier_id: vine.number().positive().optional(),
    shift_id: vine.number().positive().optional(),
    workstation_id: vine.string().optional(),
    
    // Audit Information
    created_by: vine.number().positive().optional(),
    modified_by: vine.number().positive().optional(),
    posted_by: vine.number().positive().optional(),
    closed_by: vine.number().positive().optional(),
    
    // External Integration
    external_folio_id: vine.string().optional(),
    external_system: vine.string().optional(),
    sync_status: vine.enum(['pending', 'synced', 'failed']).optional(),
    last_sync_at: vine.date().optional(),
    
    // Notes and Comments
    notes: vine.string().optional(),
    internal_notes: vine.string().optional(),
    guest_comments: vine.string().optional(),
    special_instructions: vine.string().optional(),
    
    // Flags
    is_master: vine.boolean().optional(),
    is_shared: vine.boolean().optional(),
    is_locked: vine.boolean().optional(),
    is_disputed: vine.boolean().optional(),
    requires_approval: vine.boolean().optional(),
    
    // Analytics
    revenue_center: vine.string().optional(),
    profit_center: vine.string().optional(),
    cost_center: vine.string().optional(),
    
    // Custom Fields
    custom_field_1: vine.string().optional(),
    custom_field_2: vine.string().optional(),
    custom_field_3: vine.string().optional(),
    custom_field_4: vine.string().optional(),
    custom_field_5: vine.string().optional(),
    
    // Tags and Categories
    tags: vine.string().optional(),
    category: vine.string().optional(),
    subcategory: vine.string().optional(),
  })
)