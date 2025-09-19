export enum ReservationProductStatus {
  PENDING = 'pending',
  CHECKED_IN = 'checked-in',
  CHECKED_OUT = 'checked-out',
  CANCELLED = 'cancelled',
}

export enum ReservationStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CHECKED_IN = 'checked-in',
  CHECKED_OUT = 'checked-out',
  CANCELLED = 'cancelled',
  NOSHOW = 'no_show',
  VOIDED = 'voided',
  PARTIALLY_NOSHOW = 'partially_no_show'
}

export enum RoomStatus {
  AVAILAIBLE = "available",
  BOOKED = "booked",
  DIRTY = 'dirty',
  MAINTENANCE = "maintenance",
  OUT_OF_SERVICE = "out_of_service",
  OUT_OF_ORDER = "out_of_order"
}

export enum FolioType {
  GUEST = 'guest',
  MASTER = 'master',
  GROUP = 'group',
  HOUSE = 'house',
  CITY_LEDGER = 'city_ledger',
  ADVANCE_DEPOSIT = 'advance_deposit',
  VOICE_INCIDENTAL='voice_incidental',
  COMPANY = 'company'
}

export enum FolioStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  TRANSFERRED = 'transferred',
  VOIDED = 'voided',
  DISPUTED = 'disputed'
}

export enum SettlementStatus {
  PENDING = 'pending',
  PARTIAL = 'partial',
  SETTLED = 'settled',
  OVERDUE = 'overdue',
  DISPUTED = 'disputed'
}

export enum WorkflowStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  REVIEW = 'review',
  APPROVED = 'approved',
  FINALIZED = 'finalized',
  CLOSED = 'closed'
}

export enum TransactionType {
  CHARGE = 'charge',
  PAYMENT = 'payment',
  ADJUSTMENT = 'adjustment',
  TAX = 'tax',
  DISCOUNT = 'discount',
  REFUND = 'refund',
  TRANSFER = 'transfer',
  VOID = 'void',
  CORRECTION = 'correction',
  ROOM_POSTING = 'room_posting',
}

export enum TransactionCategory {
  POSTING = 'posting',
  TRANSFER_OUT = 'transfer_out',
  TRANSFER_IN = 'transfer_in',
  ROOM = 'room',
  FOOD_BEVERAGE = 'food_beverage',
  TELEPHONE = 'telephone',
  LAUNDRY = 'laundry',
  MINIBAR = 'minibar',
  SPA = 'spa',
  BUSINESS_CENTER = 'business_center',
  PARKING = 'parking',
  INTERNET = 'internet',
  MISCELLANEOUS = 'miscellaneous',
  PACKAGE = 'package',
  INCIDENTAL = 'incidental',
  TAX = 'tax',
  SERVICE_CHARGE = 'service_charge',
  DEPOSIT = 'deposit',
  PAYMENT = 'payment',
  ADJUSTMENT = 'adjustment',
  NO_SHOW_FEE = 'no_show_fee',
  CANCELLATION_FEE = 'cancellation_fee',
  EARLY_DEPARTURE_FEE = 'early_departure_fee',
  LATE_CHECKOUT_FEE = 'late_checkout_fee',
  EXTRA_BED = 'extra_bed',
  CITY_TAX = 'city_tax',
  RESORT_FEE = 'resort_fee',
  VOID = 'void',
  REFUND = 'refund',
  EXTRACT_CHARGE = 'extract_charge'
}

export enum TransactionStatus {
  PENDING = 'pending',
  POSTED = 'posted',
  VOIDED = 'voided',
  TRANSFERRED = 'transferred',
  DISPUTED = 'disputed',
  REFUNDED = 'refunded',
  WRITE_OFF = 'write_off',
  CORRECTION = 'correction',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'

}

export enum PaymentMethodType {
  CASH = 'cash',
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  BANK_TRANSFER = 'bank_transfer',
  CHECK = 'check',
  DIGITAL_WALLET = 'digital_wallet',
  CRYPTOCURRENCY = 'cryptocurrency',
  VOUCHER = 'voucher',
  LOYALTY_POINTS = 'loyalty_points',
  COMP = 'comp',
  HOUSE_ACCOUNT = 'house_account',
  CITY_LEDGER = 'city_ledger',
  OTHER = 'other'
}
