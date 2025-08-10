import vine from '@vinejs/vine'

export const createPaymentMethodValidator = vine.compile(
  vine.object({
    // Basic Information
    hotel_id: vine.number().positive(),
    name: vine.string().minLength(1).maxLength(100),
    code: vine.string().minLength(1).maxLength(20),
    type: vine.enum(['cash', 'credit_card', 'debit_card', 'bank_transfer', 'check', 'voucher', 'comp', 'house_account', 'mobile_payment', 'cryptocurrency', 'gift_card', 'loyalty_points']),
    
    // Status
    is_active: vine.boolean().optional(),
    is_default: vine.boolean().optional(),
    
    // Display Information
    display_name: vine.string().optional(),
    description: vine.string().optional(),
    icon: vine.string().optional(),
    color: vine.string().optional(),
    
    // Processing Information
    requires_authorization: vine.boolean().optional(),
    requires_signature: vine.boolean().optional(),
    requires_pin: vine.boolean().optional(),
    requires_id_verification: vine.boolean().optional(),
    
    // Credit Card Specific
    accepted_card_types: vine.string().optional(), // JSON array of accepted card types
    min_amount: vine.number().min(0).optional(),
    max_amount: vine.number().min(0).optional(),
    
    // Processing Configuration
    processor_name: vine.string().optional(),
    processor_config: vine.string().optional(), // JSON configuration
    merchant_id: vine.string().optional(),
    terminal_id: vine.string().optional(),
    
    // Fees and Charges
    processing_fee_type: vine.enum(['fixed', 'percentage', 'tiered']).optional(),
    processing_fee_amount: vine.number().min(0).optional(),
    processing_fee_percentage: vine.number().min(0).max(100).optional(),
    
    // Currency Support
    supported_currencies: vine.string().optional(), // JSON array of currency codes
    default_currency: vine.string().fixedLength(3).optional(),
    
    // Settlement Information
    settlement_type: vine.enum(['immediate', 'daily', 'weekly', 'monthly']).optional(),
    settlement_account: vine.string().optional(),
    settlement_delay_days: vine.number().min(0).optional(),
    
    // Security
    encryption_required: vine.boolean().optional(),
    tokenization_supported: vine.boolean().optional(),
    pci_compliant: vine.boolean().optional(),
    
    // Limits
    daily_limit: vine.number().min(0).optional(),
    monthly_limit: vine.number().min(0).optional(),
    transaction_limit: vine.number().min(0).optional(),
    
    // Refund Configuration
    supports_refunds: vine.boolean().optional(),
    refund_policy: vine.string().optional(),
    refund_fee: vine.number().min(0).optional(),
    
    // Chargeback Configuration
    supports_chargebacks: vine.boolean().optional(),
    chargeback_fee: vine.number().min(0).optional(),
    
    // Reporting
    reporting_code: vine.string().optional(),
    gl_account: vine.string().optional(),
    revenue_center: vine.string().optional(),
    
    // Integration
    api_endpoint: vine.string().optional(),
    api_key: vine.string().optional(),
    webhook_url: vine.string().optional(),
    
    // Mobile Payment Specific
    mobile_app_id: vine.string().optional(),
    qr_code_supported: vine.boolean().optional(),
    nfc_supported: vine.boolean().optional(),
    
    // Gift Card Specific
    gift_card_provider: vine.string().optional(),
    gift_card_validation_url: vine.string().optional(),
    
    // Loyalty Points Specific
    loyalty_program_id: vine.number().positive().optional(),
    points_conversion_rate: vine.number().min(0).optional(),
    
    // Voucher Specific
    voucher_validation_required: vine.boolean().optional(),
    voucher_expiry_check: vine.boolean().optional(),
    
    // Check Specific
    check_verification_required: vine.boolean().optional(),
    check_guarantee_required: vine.boolean().optional(),
    
    // Bank Transfer Specific
    bank_account_required: vine.boolean().optional(),
    routing_number_required: vine.boolean().optional(),
    
    // House Account Specific
    credit_limit_required: vine.boolean().optional(),
    approval_required: vine.boolean().optional(),
    
    // Operational
    sort_order: vine.number().min(0).optional(),
    department_restrictions: vine.string().optional(), // JSON array of department codes
    user_role_restrictions: vine.string().optional(), // JSON array of role IDs
    
    // Audit Information
    created_by: vine.number().positive().optional(),
    modified_by: vine.number().positive().optional(),
    
    // External Integration
    external_id: vine.string().optional(),
    external_system: vine.string().optional(),
    sync_status: vine.enum(['pending', 'synced', 'failed']).optional(),
    last_sync_at: vine.date().optional(),
    
    // Testing
    test_mode: vine.boolean().optional(),
    test_credentials: vine.string().optional(),
    
    // Notes and Comments
    notes: vine.string().optional(),
    internal_notes: vine.string().optional(),
    setup_instructions: vine.string().optional(),
    
    // Flags
    requires_training: vine.boolean().optional(),
    is_deprecated: vine.boolean().optional(),
    maintenance_mode: vine.boolean().optional(),
    
    // Analytics
    usage_tracking: vine.boolean().optional(),
    performance_monitoring: vine.boolean().optional(),
    
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

export const updatePaymentMethodValidator = vine.compile(
  vine.object({
    // Basic Information
    hotel_id: vine.number().positive().optional(),
    name: vine.string().minLength(1).maxLength(100).optional(),
    code: vine.string().minLength(1).maxLength(20).optional(),
    type: vine.enum(['cash', 'credit_card', 'debit_card', 'bank_transfer', 'check', 'voucher', 'comp', 'house_account', 'mobile_payment', 'cryptocurrency', 'gift_card', 'loyalty_points']).optional(),
    
    // Status
    is_active: vine.boolean().optional(),
    is_default: vine.boolean().optional(),
    
    // Display Information
    display_name: vine.string().optional(),
    description: vine.string().optional(),
    icon: vine.string().optional(),
    color: vine.string().optional(),
    
    // Processing Information
    requires_authorization: vine.boolean().optional(),
    requires_signature: vine.boolean().optional(),
    requires_pin: vine.boolean().optional(),
    requires_id_verification: vine.boolean().optional(),
    
    // Credit Card Specific
    accepted_card_types: vine.string().optional(),
    min_amount: vine.number().min(0).optional(),
    max_amount: vine.number().min(0).optional(),
    
    // Processing Configuration
    processor_name: vine.string().optional(),
    processor_config: vine.string().optional(),
    merchant_id: vine.string().optional(),
    terminal_id: vine.string().optional(),
    
    // Fees and Charges
    processing_fee_type: vine.enum(['fixed', 'percentage', 'tiered']).optional(),
    processing_fee_amount: vine.number().min(0).optional(),
    processing_fee_percentage: vine.number().min(0).max(100).optional(),
    
    // Currency Support
    supported_currencies: vine.string().optional(),
    default_currency: vine.string().fixedLength(3).optional(),
    
    // Settlement Information
    settlement_type: vine.enum(['immediate', 'daily', 'weekly', 'monthly']).optional(),
    settlement_account: vine.string().optional(),
    settlement_delay_days: vine.number().min(0).optional(),
    
    // Security
    encryption_required: vine.boolean().optional(),
    tokenization_supported: vine.boolean().optional(),
    pci_compliant: vine.boolean().optional(),
    
    // Limits
    daily_limit: vine.number().min(0).optional(),
    monthly_limit: vine.number().min(0).optional(),
    transaction_limit: vine.number().min(0).optional(),
    
    // Refund Configuration
    supports_refunds: vine.boolean().optional(),
    refund_policy: vine.string().optional(),
    refund_fee: vine.number().min(0).optional(),
    
    // Chargeback Configuration
    supports_chargebacks: vine.boolean().optional(),
    chargeback_fee: vine.number().min(0).optional(),
    
    // Reporting
    reporting_code: vine.string().optional(),
    gl_account: vine.string().optional(),
    revenue_center: vine.string().optional(),
    
    // Integration
    api_endpoint: vine.string().optional(),
    api_key: vine.string().optional(),
    webhook_url: vine.string().optional(),
    
    // Mobile Payment Specific
    mobile_app_id: vine.string().optional(),
    qr_code_supported: vine.boolean().optional(),
    nfc_supported: vine.boolean().optional(),
    
    // Gift Card Specific
    gift_card_provider: vine.string().optional(),
    gift_card_validation_url: vine.string().optional(),
    
    // Loyalty Points Specific
    loyalty_program_id: vine.number().positive().optional(),
    points_conversion_rate: vine.number().min(0).optional(),
    
    // Voucher Specific
    voucher_validation_required: vine.boolean().optional(),
    voucher_expiry_check: vine.boolean().optional(),
    
    // Check Specific
    check_verification_required: vine.boolean().optional(),
    check_guarantee_required: vine.boolean().optional(),
    
    // Bank Transfer Specific
    bank_account_required: vine.boolean().optional(),
    routing_number_required: vine.boolean().optional(),
    
    // House Account Specific
    credit_limit_required: vine.boolean().optional(),
    approval_required: vine.boolean().optional(),
    
    // Operational
    sort_order: vine.number().min(0).optional(),
    department_restrictions: vine.string().optional(),
    user_role_restrictions: vine.string().optional(),
    
    // Audit Information
    created_by: vine.number().positive().optional(),
    modified_by: vine.number().positive().optional(),
    
    // External Integration
    external_id: vine.string().optional(),
    external_system: vine.string().optional(),
    sync_status: vine.enum(['pending', 'synced', 'failed']).optional(),
    last_sync_at: vine.date().optional(),
    
    // Testing
    test_mode: vine.boolean().optional(),
    test_credentials: vine.string().optional(),
    
    // Notes and Comments
    notes: vine.string().optional(),
    internal_notes: vine.string().optional(),
    setup_instructions: vine.string().optional(),
    
    // Flags
    requires_training: vine.boolean().optional(),
    is_deprecated: vine.boolean().optional(),
    maintenance_mode: vine.boolean().optional(),
    
    // Analytics
    usage_tracking: vine.boolean().optional(),
    performance_monitoring: vine.boolean().optional(),
    
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