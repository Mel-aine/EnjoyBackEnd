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
  payment: number

  // Multiple guests support
  guests?: GuestData[]

  // Reservation details
  hotel_id: number
  reservation_type_id: number
  booking_source?: number
  business_source?: number
  reservation_status?: any
  status?: any,
  check_in_time?: any,
  check_out_time?: any,
  room_rate?: any,
  complimentary_room?: any,
  idExpiryDate?: any,
  visaExpiry?: any,
  passportExpiry?: any,
  idPhoto?: any,
  issuingCity?: any,
  issuingCountry?: any,
  idNumber?: any,
  visaNumber?: any,
  idType?: any,
  passportNumber?: any,
  profilePhoto?: any

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
    room_rate_id: number,
    taxes: number
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
  payment_mod?: number
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

  isHold: boolean,
  holdReleaseDate: string
  ReleaseTem: number,
  ReleaseRemindGuestbeforeDays: number,
  ReleaseRemindGuestbefore: 'hold_release_date' | 'arrival_date' | null
}

