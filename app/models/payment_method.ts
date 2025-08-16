import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { PaymentMethodType } from '#app/enums'
import Hotel from './hotel.js'
import FolioTransaction from './folio_transaction.js'
import User from './user.js'

export default class PaymentMethod extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotelId: number

  @column()
  declare methodName: string

  @column()
  declare methodCode: string

  @column()
  declare methodType: PaymentMethodType

  @column()
  declare description: string

  @column()
  declare isActive: boolean

  @column()
  declare isDefault: boolean

  @column()
  declare acceptsPartialPayments: boolean

  @column()
  declare requiresAuthorization: boolean

  @column()
  declare requiresSignature: boolean

  @column()
  declare requiresId: boolean

  @column()
  declare minimumAmount: number

  @column()
  declare maximumAmount: number

  @column()
  declare dailyLimit: number

  @column()
  declare monthlyLimit: number

  @column()
  declare processingFee: number

  @column()
  declare processingFeeType: 'fixed' | 'percentage'

  @column()
  declare merchantFee: number

  @column()
  declare merchantFeeType: 'fixed' | 'percentage'

  @column()
  declare settlementTime: number

  @column()
  declare settlementTimeUnit: 'minutes' | 'hours' | 'days'

  @column()
  declare currenciesAccepted: object

  @column()
  declare exchangeRateMarkup: number

  @column()
  declare paymentProcessor: string

  @column()
  declare processorConfig: object

  @column()
  declare merchantId: string

  @column()
  declare terminalId: string

  @column()
  declare gatewayUrl: string

  @column()
  declare apiKey: string

  @column()
  declare secretKey: string

  @column()
  declare webhookUrl: string

  @column()
  declare testMode: boolean

  @column()
  declare supportedCardTypes: object

  @column()
  declare supportedWallets: object

  @column()
  declare supportedCryptocurrencies: object

  @column()
  declare securityFeatures: object

  @column()
  declare fraudProtection: boolean

  @column()
  declare fraudRules: object

  @column()
  declare riskThreshold: number

  @column()
  declare chargebackProtection: boolean

  @column()
  declare disputeHandling: object

  @column()
  declare refundPolicy: object

  @column()
  declare refundTimeframe: number

  @column()
  declare refundFee: number

  @column()
  declare partialRefundsAllowed: boolean

  @column()
  declare voidTimeframe: number

  @column()
  declare voidFee: number

  @column()
  declare recurringPayments: boolean

  @column()
  declare tokenization: boolean

  @column()
  declare tokenStorage: string

  @column()
  declare pciCompliance: boolean

  @column()
  declare encryptionLevel: string

  @column()
  declare complianceStandards: object

  @column()
  declare auditRequirements: object

  @column()
  declare reportingCapabilities: object

  @column()
  declare reconciliationMethod: string

  @column()
  declare reconciliationFrequency: string

  @column()
  declare statementFrequency: string

  @column()
  declare contactInfo: object

  @column()
  declare supportHours: object

  @column()
  declare emergencyContact: object

  @column()
  declare contractDetails: object

  @column.dateTime()
  declare contractStartDate: DateTime

  @column.dateTime()
  declare contractEndDate: DateTime

  @column()
  declare autoRenewal: boolean

  @column()
  declare noticePeriod: number

  @column()
  declare terminationFee: number

  @column()
  declare setupFee: number

  @column()
  declare monthlyFee: number

  @column()
  declare transactionFee: number

  @column()
  declare volumeDiscounts: object

  @column()
  declare loyaltyIntegration: boolean

  @column()
  declare loyaltyPrograms: object

  @column()
  declare pointsConversionRate: number

  @column()
  declare pointsRedemptionRules: object

  @column()
  declare giftCardSupport: boolean

  @column()
  declare giftCardTypes: object

  @column()
  declare voucherSupport: boolean

  @column()
  declare voucherTypes: object

  @column()
  declare installmentPlans: boolean

  @column()
  declare installmentOptions: object

  @column()
  declare buyNowPayLater: boolean

  @column()
  declare bnplProviders: object

  @column()
  declare mobilePayments: boolean

  @column()
  declare contactlessPayments: boolean

  @column()
  declare qrCodePayments: boolean

  @column()
  declare biometricAuth: boolean

  @column()
  declare twoFactorAuth: boolean

  @column()
  declare geolocationVerification: boolean

  @column()
  declare deviceFingerprinting: boolean

  @column()
  declare velocityChecks: boolean

  @column()
  declare blacklistChecking: boolean

  @column()
  declare whitelistSupport: boolean

  @column()
  declare customRules: object

  @column()
  declare integrationNotes: string

  @column()
  declare operationalNotes: string

  @column()
  declare troubleshootingGuide: object

  @column()
  declare lastHealthCheck: DateTime

  @column()
  declare healthStatus: 'healthy' | 'warning' | 'critical' | 'offline'

  @column()
  declare uptime: number

  @column()
  declare responseTime: number

  @column()
  declare errorRate: number

  @column()
  declare successRate: number

  @column()
  declare totalTransactions: number

  @column()
  declare totalVolume: number

  @column()
  declare averageTransactionSize: number

  @column()
  declare peakTransactionTime: string

  @column()
  declare maintenanceSchedule: object

  @column.dateTime()
  declare lastMaintenanceDate: DateTime

  @column.dateTime()
  declare nextMaintenanceDate: DateTime

  @column()
  declare priority: number

  @column()
  declare sortOrder: number

  @column()
  declare displayName: string

  @column()
  declare icon: string

  @column()
  declare color: string

  @column()
  declare isVisible: boolean

  @column()
  declare isAvailableOnline: boolean

  @column()
  declare isAvailableAtProperty: boolean

  @column()
  declare isAvailableMobile: boolean

  @column()
  declare departmentRestrictions: object

  @column()
  declare userRoleRestrictions: object

  @column()
  declare timeRestrictions: object

  @column()
  declare locationRestrictions: object

  @column()
  declare notes: string

  // New fields based on requirements
  @column()
  declare shortCode: string

  @column()
  declare type: 'CASH' | 'BANK'

  @column()
  declare cardProcessing: boolean

  @column()
  declare surchargeEnabled: boolean

  @column()
  declare surchargeType: 'amount' | 'percent' | null

  @column()
  declare surchargeValue: number | null

  @column()
  declare extraChargeId: number | null

  @column()
  declare receiptNoSetting: 'auto_general' | 'auto_private' | 'manual'

  @column()
  declare createdBy: number

  @column()
  declare lastModifiedBy: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relationships
  @belongsTo(() => Hotel)
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => User, { foreignKey: 'createdBy' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'lastModifiedBy' })
  declare modifier: BelongsTo<typeof User>

  @hasMany(() => FolioTransaction)
  declare transactions: HasMany<typeof FolioTransaction>

  // Computed properties
  get isOperational() {
    return this.isActive && this.healthStatus !== 'offline'
  }

  get isCreditCard() {
    return this.methodType === 'credit_card'
  }

  get isDigital() {
    return ['digital_wallet', 'cryptocurrency', 'bank_transfer'].includes(this.methodType)
  }

  get requiresProcessing() {
    return !['cash', 'comp', 'house_account'].includes(this.methodType)
  }

  get hasProcessingFees() {
    return this.processingFee > 0 || this.merchantFee > 0
  }

  get totalProcessingFee() {
    return (this.processingFee || 0) + (this.merchantFee || 0)
  }

  get isHighRisk() {
    return this.errorRate > 5 || this.successRate < 95
  }

  get isUnderMaintenance() {
    return this.healthStatus === 'critical' || this.healthStatus === 'offline'
  }

  get uptimePercentage() {
    return Math.min(100, Math.max(0, this.uptime || 0))
  }

  get settlementTimeHours() {
    switch (this.settlementTimeUnit) {
      case 'minutes': return this.settlementTime / 60
      case 'hours': return this.settlementTime
      case 'days': return this.settlementTime * 24
      default: return this.settlementTime
    }
  }

  get effectiveDisplayName() {
    return this.displayName || this.methodName
  }

  get statusColor() {
    const colors = {
      'healthy': 'green',
      'warning': 'yellow',
      'critical': 'orange',
      'offline': 'red'
    }
    return colors[this.healthStatus] || 'gray'
  }

  get typeIcon() {
    const icons = {
      'cash': '💵',
      'credit_card': '💳',
      'debit_card': '💳',
      'bank_transfer': '🏦',
      'check': '📝',
      'digital_wallet': '📱',
      'cryptocurrency': '₿',
      'voucher': '🎫',
      'loyalty_points': '⭐',
      'comp': '🎁',
      'house_account': '🏨',
      'city_ledger': '📊',
      'other': '💰'
    }
    return icons[this.methodType] || '💰'
  }
}