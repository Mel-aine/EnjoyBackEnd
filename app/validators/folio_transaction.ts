import vine from '@vinejs/vine'

export const createFolioTransactionValidator = vine.compile(
  vine.object({
    // Basic Information
    hotel_id: vine.number().positive(),
    folio_id: vine.number().positive(),
    transaction_number: vine.string().optional(),
    
    // Transaction Details
    transaction_type: vine.enum(['charge', 'payment', 'adjustment', 'tax', 'refund', 'transfer']),
    transaction_category: vine.string().optional(),
    transaction_code: vine.string().optional(),
    
    // Financial Information
    amount: vine.number(),
    currency: vine.string().fixedLength(3).optional(),
    exchange_rate: vine.number().min(0).optional(),
    local_amount: vine.number().optional(),
    
    // Description and Reference
    description: vine.string(),
    reference: vine.string().optional(),
    external_reference: vine.string().optional(),
    
    // Dates
    transaction_date: vine.date(),
    posting_date: vine.date().optional(),
    business_date: vine.date().optional(),
    
    // Status
    status: vine.enum(['pending', 'posted', 'voided', 'refunded']),
    
    // Room Information
    room_id: vine.number().positive().optional(),
    room_number: vine.string().optional(),
    
    // Guest Information
    guest_id: vine.number().positive().optional(),
    guest_name: vine.string().optional(),
    
    // Revenue Information
    revenue_center: vine.string().optional(),
    department_code: vine.string().optional(),
    account_code: vine.string().optional(),
    gl_account: vine.string().optional(),
    
    // Tax Information
    tax_inclusive: vine.boolean().optional(),
    tax_rate: vine.number().min(0).max(100).optional(),
    tax_amount: vine.number().min(0).optional(),
    tax_code: vine.string().optional(),
    
    // Service Charge
    service_charge_rate: vine.number().min(0).max(100).optional(),
    service_charge_amount: vine.number().min(0).optional(),
    
    // Package Information
    package_id: vine.number().positive().optional(),
    package_code: vine.string().optional(),
    package_item: vine.string().optional(),
    
    // Quantity and Rate
    quantity: vine.number().min(0).optional(),
    unit_price: vine.number().min(0).optional(),
    rate_code: vine.string().optional(),
    
    // Payment Information
    payment_method_id: vine.number().positive().optional(),
    payment_method: vine.string().optional(),
    credit_card_type: vine.string().optional(),
    credit_card_last_four: vine.string().fixedLength(4).optional(),
    authorization_code: vine.string().optional(),
    
    // Transfer Information
    transfer_from_folio_id: vine.number().positive().optional(),
    transfer_to_folio_id: vine.number().positive().optional(),
    transfer_reference: vine.string().optional(),
    
    // Adjustment Information
    adjustment_reason: vine.string().optional(),
    adjustment_type: vine.string().optional(),
    original_transaction_id: vine.number().positive().optional(),
    
    // Void Information
    void_reason: vine.string().optional(),
    voided_by: vine.number().positive().optional(),
    voided_at: vine.date().optional(),
    
    // Refund Information
    refund_reason: vine.string().optional(),
    refund_method: vine.string().optional(),
    refunded_by: vine.number().positive().optional(),
    refunded_at: vine.date().optional(),
    
    // Commission Information
    commission_rate: vine.number().min(0).max(100).optional(),
    commission_amount: vine.number().min(0).optional(),
    commission_code: vine.string().optional(),
    
    // Comp Information
    comp_type: vine.string().optional(),
    comp_reason: vine.string().optional(),
    comp_authorized_by: vine.number().positive().optional(),
    
    // Market Information
    market_code: vine.string().optional(),
    source_code: vine.string().optional(),
    
    // Group Information
    group_id: vine.number().positive().optional(),
    group_code: vine.string().optional(),
    
    // Corporate Information
    corporate_id: vine.number().positive().optional(),
    corporate_code: vine.string().optional(),
    
    // Routing Information
    routing_code: vine.string().optional(),
    routing_instructions: vine.string().optional(),
    
    // Settlement Information
    settlement_date: vine.date().optional(),
    settlement_method: vine.string().optional(),
    settlement_reference: vine.string().optional(),
    
    // Operational Information
    cashier_id: vine.number().positive().optional(),
    shift_id: vine.number().positive().optional(),
    workstation_id: vine.string().optional(),
    terminal_id: vine.string().optional(),
    
    // Audit Information
    created_by: vine.number().positive().optional(),
    modified_by: vine.number().positive().optional(),
    posted_by: vine.number().positive().optional(),
    
    // External Integration
    external_transaction_id: vine.string().optional(),
    external_system: vine.string().optional(),
    sync_status: vine.enum(['pending', 'synced', 'failed']).optional(),
    last_sync_at: vine.date().optional(),
    
    // Batch Information
    batch_id: vine.string().optional(),
    batch_sequence: vine.number().positive().optional(),
    
    // Notes and Comments
    notes: vine.string().optional(),
    internal_notes: vine.string().optional(),
    guest_comments: vine.string().optional(),
    
    // Flags
    is_manual: vine.boolean().optional(),
    is_automatic: vine.boolean().optional(),
    is_recurring: vine.boolean().optional(),
    is_disputed: vine.boolean().optional(),
    requires_approval: vine.boolean().optional(),
    
    // Analytics
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

export const updateFolioTransactionValidator = vine.compile(
  vine.object({
    // Basic Information
    hotel_id: vine.number().positive().optional(),
    folio_id: vine.number().positive().optional(),
    transaction_number: vine.string().optional(),
    
    // Transaction Details
    transaction_type: vine.enum(['charge', 'payment', 'adjustment', 'tax', 'refund', 'transfer']).optional(),
    transaction_category: vine.string().optional(),
    transaction_code: vine.string().optional(),
    
    // Financial Information
    amount: vine.number().optional(),
    currency: vine.string().fixedLength(3).optional(),
    exchange_rate: vine.number().min(0).optional(),
    local_amount: vine.number().optional(),
    
    // Description and Reference
    description: vine.string().optional(),
    reference: vine.string().optional(),
    external_reference: vine.string().optional(),
    
    // Dates
    transaction_date: vine.date().optional(),
    posting_date: vine.date().optional(),
    business_date: vine.date().optional(),
    
    // Status
    status: vine.enum(['pending', 'posted', 'voided', 'refunded']).optional(),
    
    // Room Information
    room_id: vine.number().positive().optional(),
    room_number: vine.string().optional(),
    
    // Guest Information
    guest_id: vine.number().positive().optional(),
    guest_name: vine.string().optional(),
    
    // Revenue Information
    revenue_center: vine.string().optional(),
    department_code: vine.string().optional(),
    account_code: vine.string().optional(),
    gl_account: vine.string().optional(),
    
    // Tax Information
    tax_inclusive: vine.boolean().optional(),
    tax_rate: vine.number().min(0).max(100).optional(),
    tax_amount: vine.number().min(0).optional(),
    tax_code: vine.string().optional(),
    
    // Service Charge
    service_charge_rate: vine.number().min(0).max(100).optional(),
    service_charge_amount: vine.number().min(0).optional(),
    
    // Package Information
    package_id: vine.number().positive().optional(),
    package_code: vine.string().optional(),
    package_item: vine.string().optional(),
    
    // Quantity and Rate
    quantity: vine.number().min(0).optional(),
    unit_price: vine.number().min(0).optional(),
    rate_code: vine.string().optional(),
    
    // Payment Information
    payment_method_id: vine.number().positive().optional(),
    payment_method: vine.string().optional(),
    credit_card_type: vine.string().optional(),
    credit_card_last_four: vine.string().fixedLength(4).optional(),
    authorization_code: vine.string().optional(),
    
    // Transfer Information
    transfer_from_folio_id: vine.number().positive().optional(),
    transfer_to_folio_id: vine.number().positive().optional(),
    transfer_reference: vine.string().optional(),
    
    // Adjustment Information
    adjustment_reason: vine.string().optional(),
    adjustment_type: vine.string().optional(),
    original_transaction_id: vine.number().positive().optional(),
    
    // Void Information
    void_reason: vine.string().optional(),
    voided_by: vine.number().positive().optional(),
    voided_at: vine.date().optional(),
    
    // Refund Information
    refund_reason: vine.string().optional(),
    refund_method: vine.string().optional(),
    refunded_by: vine.number().positive().optional(),
    refunded_at: vine.date().optional(),
    
    // Commission Information
    commission_rate: vine.number().min(0).max(100).optional(),
    commission_amount: vine.number().min(0).optional(),
    commission_code: vine.string().optional(),
    
    // Comp Information
    comp_type: vine.string().optional(),
    comp_reason: vine.string().optional(),
    comp_authorized_by: vine.number().positive().optional(),
    
    // Market Information
    market_code: vine.string().optional(),
    source_code: vine.string().optional(),
    
    // Group Information
    group_id: vine.number().positive().optional(),
    group_code: vine.string().optional(),
    
    // Corporate Information
    corporate_id: vine.number().positive().optional(),
    corporate_code: vine.string().optional(),
    
    // Routing Information
    routing_code: vine.string().optional(),
    routing_instructions: vine.string().optional(),
    
    // Settlement Information
    settlement_date: vine.date().optional(),
    settlement_method: vine.string().optional(),
    settlement_reference: vine.string().optional(),
    
    // Operational Information
    cashier_id: vine.number().positive().optional(),
    shift_id: vine.number().positive().optional(),
    workstation_id: vine.string().optional(),
    terminal_id: vine.string().optional(),
    
    // Audit Information
    created_by: vine.number().positive().optional(),
    modified_by: vine.number().positive().optional(),
    posted_by: vine.number().positive().optional(),
    
    // External Integration
    external_transaction_id: vine.string().optional(),
    external_system: vine.string().optional(),
    sync_status: vine.enum(['pending', 'synced', 'failed']).optional(),
    last_sync_at: vine.date().optional(),
    
    // Batch Information
    batch_id: vine.string().optional(),
    batch_sequence: vine.number().positive().optional(),
    
    // Notes and Comments
    notes: vine.string().optional(),
    internal_notes: vine.string().optional(),
    guest_comments: vine.string().optional(),
    
    // Flags
    is_manual: vine.boolean().optional(),
    is_automatic: vine.boolean().optional(),
    is_recurring: vine.boolean().optional(),
    is_disputed: vine.boolean().optional(),
    requires_approval: vine.boolean().optional(),
    
    // Analytics
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