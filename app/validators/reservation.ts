import vine from '@vinejs/vine'

export const createReservationValidator = vine.compile(
  vine.object({
    // Basic Information
    hotel_id: vine.number().positive(),
    guest_id: vine.number().positive(),
    reservation_number: vine.string().optional(),
    confirmation_number: vine.string().optional(),
    
    // Booking Details
    booking_source_id: vine.number().positive().optional(),
    booking_channel: vine.string().optional(),
    booking_reference: vine.string().optional(),
    booking_agent: vine.string().optional(),
    booking_agent_commission: vine.number().min(0).optional(),
    
    // Dates
    check_in_date: vine.date(),
    check_out_date: vine.date(),
    arrival_time: vine.string().optional(),
    departure_time: vine.string().optional(),
    
    // Guest Information
    number_of_adults: vine.number().min(1).max(20),
    number_of_children: vine.number().min(0).max(20),
    number_of_infants: vine.number().min(0).max(20),
    total_guests: vine.number().min(1).max(60),
    
    // Room Details
    room_type_id: vine.number().positive().optional(),
    number_of_rooms: vine.number().min(1).max(50),
    room_preference: vine.string().optional(),
    bed_type_preference: vine.string().optional(),
    floor_preference: vine.string().optional(),
    view_preference: vine.string().optional(),
    
    // Rates and Pricing
    rate_plan_id: vine.number().positive().optional(),
    rate_code: vine.string().optional(),
    room_rate: vine.number().min(0).optional(),
    total_amount: vine.number().min(0).optional(),
    currency: vine.string().fixedLength(3).optional(),
    
    // Taxes and Fees
    tax_amount: vine.number().min(0).optional(),
    service_charge: vine.number().min(0).optional(),
    resort_fee: vine.number().min(0).optional(),
    city_tax: vine.number().min(0).optional(),
    cleaning_fee: vine.number().min(0).optional(),
    
    // Discounts and Packages
    discount_id: vine.number().positive().optional(),
    discount_amount: vine.number().min(0).optional(),
    discount_percentage: vine.number().min(0).max(100).optional(),
    package_id: vine.number().positive().optional(),
    package_amount: vine.number().min(0).optional(),
    
    // Status
    status: vine.enum(['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show']),
    reservation_status: vine.string().optional(),
    payment_status: vine.enum(['pending', 'partial', 'paid', 'refunded', 'failed']).optional(),
    
    // Cancellation
    cancellation_policy_id: vine.number().positive().optional(),
    cancellation_deadline: vine.date().optional(),
    cancellation_fee: vine.number().min(0).optional(),
    cancellation_reason: vine.string().optional(),
    cancelled_at: vine.date().optional(),
    cancelled_by: vine.number().positive().optional(),
    
    // Void Information
    voided_date: vine.date().optional(),
    void_reason: vine.string().optional(),
    void_notes: vine.string().optional(),
    
    // Special Requests
    special_requests: vine.string().optional(),
    dietary_requirements: vine.string().optional(),
    accessibility_needs: vine.string().optional(),
    transportation_needs: vine.string().optional(),
    
    // Guest Preferences
    smoking_preference: vine.boolean().optional(),
    pet_friendly: vine.boolean().optional(),
    quiet_room: vine.boolean().optional(),
    high_floor: vine.boolean().optional(),
    connecting_rooms: vine.boolean().optional(),
    
    // Contact Information
    contact_phone: vine.string().optional(),
    contact_email: vine.string().email().optional(),
    emergency_contact_name: vine.string().optional(),
    emergency_contact_phone: vine.string().optional(),
    
    // Corporate/Group
    is_group_booking: vine.boolean().optional(),
    group_name: vine.string().optional(),
    group_code: vine.string().optional(),
    corporate_id: vine.number().positive().optional(),
    corporate_rate: vine.boolean().optional(),
    
    // Loyalty Program
    loyalty_program_id: vine.number().positive().optional(),
    loyalty_member_number: vine.string().optional(),
    loyalty_tier: vine.string().optional(),
    loyalty_points_earned: vine.number().min(0).optional(),
    loyalty_points_redeemed: vine.number().min(0).optional(),
    
    // Marketing
    marketing_source: vine.string().optional(),
    promotion_code: vine.string().optional(),
    referral_source: vine.string().optional(),
    
    // Payment Information
    payment_method: vine.string().optional(),
    credit_card_last_four: vine.string().fixedLength(4).optional(),
    deposit_amount: vine.number().min(0).optional(),
    deposit_paid: vine.boolean().optional(),
    deposit_due_date: vine.date().optional(),
    
    // Check-in/Check-out
    early_check_in: vine.boolean().optional(),
    early_check_in_fee: vine.number().min(0).optional(),
    late_check_out: vine.boolean().optional(),
    late_check_out_fee: vine.number().min(0).optional(),
    actual_check_in: vine.date().optional(),
    actual_check_out: vine.date().optional(),
    
    // VIP and Upgrades
    is_vip: vine.boolean().optional(),
    vip_level: vine.string().optional(),
    upgrade_requested: vine.boolean().optional(),
    upgrade_approved: vine.boolean().optional(),
    upgrade_fee: vine.number().min(0).optional(),
    
    // Housekeeping
    housekeeping_notes: vine.string().optional(),
    room_setup_instructions: vine.string().optional(),
    amenity_requests: vine.string().optional(),
    
    // Additional Services
    airport_transfer: vine.boolean().optional(),
    airport_transfer_fee: vine.number().min(0).optional(),
    spa_services: vine.boolean().optional(),
    restaurant_reservations: vine.string().optional(),
    
    // Internal Notes
    internal_notes: vine.string().optional(),
    staff_notes: vine.string().optional(),
    guest_history_notes: vine.string().optional(),
    
    // Billing
    billing_address: vine.string().optional(),
    billing_city: vine.string().optional(),
    billing_state: vine.string().optional(),
    billing_country: vine.string().optional(),
    billing_postal_code: vine.string().optional(),
    
    // Operational
    created_by: vine.number().positive().optional(),
    modified_by: vine.number().positive().optional(),
    assigned_to: vine.number().positive().optional(),
    priority: vine.enum(['low', 'normal', 'high', 'urgent']).optional(),
    
    // Flags
    is_confirmed: vine.boolean().optional(),
    is_guaranteed: vine.boolean().optional(),
    is_walk_in: vine.boolean().optional(),
    is_repeat_guest: vine.boolean().optional(),
    requires_approval: vine.boolean().optional(),
    
    // Analytics
    lead_time: vine.number().min(0).optional(),
    length_of_stay: vine.number().min(1).optional(),
    revenue_per_night: vine.number().min(0).optional(),
    total_revenue: vine.number().min(0).optional(),
    
    // External Integration
    external_id: vine.string().optional(),
    external_system: vine.string().optional(),
    sync_status: vine.enum(['pending', 'synced', 'failed']).optional(),
    last_sync_at: vine.date().optional(),
    
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

export const updateReservationValidator = vine.compile(
  vine.object({
    // Basic Information
    hotel_id: vine.number().positive().optional(),
    guest_id: vine.number().positive().optional(),
    reservation_number: vine.string().optional(),
    confirmation_number: vine.string().optional(),
    
    // Booking Details
    booking_source_id: vine.number().positive().optional(),
    booking_channel: vine.string().optional(),
    booking_reference: vine.string().optional(),
    booking_agent: vine.string().optional(),
    booking_agent_commission: vine.number().min(0).optional(),
    
    // Dates
    check_in_date: vine.date().optional(),
    check_out_date: vine.date().optional(),
    arrival_time: vine.string().optional(),
    departure_time: vine.string().optional(),
    
    // Guest Information
    number_of_adults: vine.number().min(1).max(20).optional(),
    number_of_children: vine.number().min(0).max(20).optional(),
    number_of_infants: vine.number().min(0).max(20).optional(),
    total_guests: vine.number().min(1).max(60).optional(),
    
    // Room Details
    room_type_id: vine.number().positive().optional(),
    number_of_rooms: vine.number().min(1).max(50).optional(),
    room_preference: vine.string().optional(),
    bed_type_preference: vine.string().optional(),
    floor_preference: vine.string().optional(),
    view_preference: vine.string().optional(),
    
    // Rates and Pricing
    rate_plan_id: vine.number().positive().optional(),
    rate_code: vine.string().optional(),
    room_rate: vine.number().min(0).optional(),
    total_amount: vine.number().min(0).optional(),
    currency: vine.string().fixedLength(3).optional(),
    
    // Taxes and Fees
    tax_amount: vine.number().min(0).optional(),
    service_charge: vine.number().min(0).optional(),
    resort_fee: vine.number().min(0).optional(),
    city_tax: vine.number().min(0).optional(),
    cleaning_fee: vine.number().min(0).optional(),
    
    // Discounts and Packages
    discount_id: vine.number().positive().optional(),
    discount_amount: vine.number().min(0).optional(),
    discount_percentage: vine.number().min(0).max(100).optional(),
    package_id: vine.number().positive().optional(),
    package_amount: vine.number().min(0).optional(),
    
    // Status
    status: vine.enum(['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show']).optional(),
    reservation_status: vine.string().optional(),
    payment_status: vine.enum(['pending', 'partial', 'paid', 'refunded', 'failed']).optional(),
    
    // Cancellation
    cancellation_policy_id: vine.number().positive().optional(),
    cancellation_deadline: vine.date().optional(),
    cancellation_fee: vine.number().min(0).optional(),
    cancellation_reason: vine.string().optional(),
    cancelled_at: vine.date().optional(),
    cancelled_by: vine.number().positive().optional(),
    
    // Void Information
    voided_date: vine.date().optional(),
    void_reason: vine.string().optional(),
    void_notes: vine.string().optional(),
    
    // Special Requests
    special_requests: vine.string().optional(),
    dietary_requirements: vine.string().optional(),
    accessibility_needs: vine.string().optional(),
    transportation_needs: vine.string().optional(),
    
    // Guest Preferences
    smoking_preference: vine.boolean().optional(),
    pet_friendly: vine.boolean().optional(),
    quiet_room: vine.boolean().optional(),
    high_floor: vine.boolean().optional(),
    connecting_rooms: vine.boolean().optional(),
    
    // Contact Information
    contact_phone: vine.string().optional(),
    contact_email: vine.string().email().optional(),
    emergency_contact_name: vine.string().optional(),
    emergency_contact_phone: vine.string().optional(),
    
    // Corporate/Group
    is_group_booking: vine.boolean().optional(),
    group_name: vine.string().optional(),
    group_code: vine.string().optional(),
    corporate_id: vine.number().positive().optional(),
    corporate_rate: vine.boolean().optional(),
    
    // Loyalty Program
    loyalty_program_id: vine.number().positive().optional(),
    loyalty_member_number: vine.string().optional(),
    loyalty_tier: vine.string().optional(),
    loyalty_points_earned: vine.number().min(0).optional(),
    loyalty_points_redeemed: vine.number().min(0).optional(),
    
    // Marketing
    marketing_source: vine.string().optional(),
    promotion_code: vine.string().optional(),
    referral_source: vine.string().optional(),
    
    // Payment Information
    payment_method: vine.string().optional(),
    credit_card_last_four: vine.string().fixedLength(4).optional(),
    deposit_amount: vine.number().min(0).optional(),
    deposit_paid: vine.boolean().optional(),
    deposit_due_date: vine.date().optional(),
    
    // Check-in/Check-out
    early_check_in: vine.boolean().optional(),
    early_check_in_fee: vine.number().min(0).optional(),
    late_check_out: vine.boolean().optional(),
    late_check_out_fee: vine.number().min(0).optional(),
    actual_check_in: vine.date().optional(),
    actual_check_out: vine.date().optional(),
    
    // VIP and Upgrades
    is_vip: vine.boolean().optional(),
    vip_level: vine.string().optional(),
    upgrade_requested: vine.boolean().optional(),
    upgrade_approved: vine.boolean().optional(),
    upgrade_fee: vine.number().min(0).optional(),
    
    // Housekeeping
    housekeeping_notes: vine.string().optional(),
    room_setup_instructions: vine.string().optional(),
    amenity_requests: vine.string().optional(),
    
    // Additional Services
    airport_transfer: vine.boolean().optional(),
    airport_transfer_fee: vine.number().min(0).optional(),
    spa_services: vine.boolean().optional(),
    restaurant_reservations: vine.string().optional(),
    
    // Internal Notes
    internal_notes: vine.string().optional(),
    staff_notes: vine.string().optional(),
    guest_history_notes: vine.string().optional(),
    
    // Billing
    billing_address: vine.string().optional(),
    billing_city: vine.string().optional(),
    billing_state: vine.string().optional(),
    billing_country: vine.string().optional(),
    billing_postal_code: vine.string().optional(),
    
    // Operational
    created_by: vine.number().positive().optional(),
    modified_by: vine.number().positive().optional(),
    assigned_to: vine.number().positive().optional(),
    priority: vine.enum(['low', 'normal', 'high', 'urgent']).optional(),
    
    // Flags
    is_confirmed: vine.boolean().optional(),
    is_guaranteed: vine.boolean().optional(),
    is_walk_in: vine.boolean().optional(),
    is_repeat_guest: vine.boolean().optional(),
    requires_approval: vine.boolean().optional(),
    
    // Analytics
    lead_time: vine.number().min(0).optional(),
    length_of_stay: vine.number().min(1).optional(),
    revenue_per_night: vine.number().min(0).optional(),
    total_revenue: vine.number().min(0).optional(),
    
    // External Integration
    external_id: vine.string().optional(),
    external_system: vine.string().optional(),
    sync_status: vine.enum(['pending', 'synced', 'failed']).optional(),
    last_sync_at: vine.date().optional(),
    
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