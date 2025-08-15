export interface GuestData {
  first_name: string
  last_name: string
  email: string
  phone_primary?: string
  title?: string
  company_name?: string
  address_line?: string
  country?: string
  state?: string
  city?: string
  zipcode?: string
  is_primary?: boolean
  guest_type?: 'adult' | 'child' | 'infant'
  room_assignment?: number
  special_requests?: string
  dietary_restrictions?: string
  accessibility?: string
  emergency_contact?: string
  emergency_phone?: string
  notes?: string
}

export interface ReservationData {
  // Primary guest information (for backward compatibility)
  first_name: string
  last_name: string
  email: string
  phone_primary?: string
  title?: string
  company_name?: string
  group_name?: string
  address_line?: string
  country?: string
  state?: string
  city?: string
  zipcode?: string
  
  // Multiple guests support
  guests?: GuestData[]

  // Reservation details
  hotel_id: number
  reservation_type: string
  booking_source: string
  business_source?: string
  reservation_status?:any
  status?:any,
  room_rate?:any,

  // Dates and guests
  arrived_date: string
  arrived_time: string
  depart_date: string
  depart_time: string
  number_of_nights: number

  // Room configurations
  rooms: Array<{
    room_type_id: number
    rate_type_id?: number
    room_id: number | null
    room_rate: number
    adult_count: number
    child_count: number
  }>

  // Financial
  total_amount: number
  tax_amount: number
  final_amount: number
  paid_amount?: number
  remaining_amount: number

  // Additional info
  is_complementary?: boolean
  bill_to?: string
  payment_mode?: string
  credit_type?: string
  tax_exempt?: boolean

  // Communication preferences
  email_booking_vouchers?: boolean
  voucher_email?: string
  send_email_at_checkout?: boolean
  email_template?: string
  access_to_guest_portal?: boolean

  // User info
  created_by: number
  special_requests?: string
  guest_notes?: string
}

