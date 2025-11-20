import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Hotel from '#models/hotel'
import Department from '#models/department'
import User from '#models/user'

export default class Employee extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotel_id: number

  @column()
  declare user_id: number

  @column()
  declare employee_number: string

  @column()
  declare department_id: number

  @column()
  declare job_title: string

  @column()
  declare employment_type: 'FullTime' | 'PartTime' | 'Contract' | 'Temporary' | 'Intern'

  @column()
  declare employment_status: 'Active' | 'Inactive' | 'Terminated' | 'OnLeave' | 'Suspended'

  @column.date()
  declare hire_date: DateTime

  @column.date()
  declare termination_date: DateTime | null

  @column()
  declare termination_reason: string | null

  @column()
  declare supervisor_id: number | null

  @column()
  declare hourly_rate: number | null

  @column()
  declare salary: number | null

  @column()
  declare currency_code: string

  @column()
  declare pay_frequency: 'Weekly' | 'BiWeekly' | 'Monthly' | 'Quarterly' | 'Annually' | null

  @column()
  declare overtime_eligible: boolean

  @column()
  declare vacation_days_per_year: number | null

  @column()
  declare sick_days_per_year: number | null

  @column()
  declare personal_days_per_year: number | null

  @column()
  declare vacation_days_used: number

  @column()
  declare sick_days_used: number

  @column()
  declare personal_days_used: number

  @column()
  declare emergency_contact_name: string | null

  @column()
  declare emergency_contact_phone: string | null

  @column()
  declare emergency_contact_relationship: string | null

  @column()
  declare work_location: string | null

  @column()
  declare shift_pattern: string | null

  @column()
  declare access_level: string | null

  @column()
  declare certifications: object | null

  @column()
  declare skills: object | null

  @column()
  declare performance_rating: string | null

  @column.date()
  declare last_performance_review: DateTime | null

  @column.date()
  declare next_performance_review: DateTime | null

  @column()
  declare notes: string | null

  @column()
  declare is_active: boolean

  @column()
  declare created_by: number

  @column()
  declare last_modified_by: number | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  // Relations
  @belongsTo(() => Hotel, { foreignKey: 'hotel_id' })
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => User, { foreignKey: 'user_id' })
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Department, { foreignKey: 'department_id' })
  declare department: BelongsTo<typeof Department>

  @belongsTo(() => Employee, { foreignKey: 'supervisor_id' })
  declare supervisor: BelongsTo<typeof Employee>

  @hasMany(() => Employee, { foreignKey: 'supervisor_id' })
  declare subordinates: HasMany<typeof Employee>

  @belongsTo(() => User, { foreignKey: 'created_by' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'last_modified_by' })
  declare modifier: BelongsTo<typeof User>

  // Computed properties
  get displayName() {
    return `${this.user?.firstName} ${this.user?.lastName} (${this.employee_number})`
  }

  get fullName() {
    return `${this.user?.firstName} ${this.user?.lastName}`
  }

  get isActive() {
    return this.employment_status === 'Active' && this.is_active
  }

  get yearsOfService() {
    const endDate = this.termination_date || DateTime.now()
    return endDate.diff(this.hire_date, 'years').years
  }

  get remainingVacationDays() {
    if (!this.vacation_days_per_year) return 0
    return Math.max(0, this.vacation_days_per_year - this.vacation_days_used)
  }

  get remainingSickDays() {
    if (!this.sick_days_per_year) return 0
    return Math.max(0, this.sick_days_per_year - this.sick_days_used)
  }

  get remainingPersonalDays() {
    if (!this.personal_days_per_year) return 0
    return Math.max(0, this.personal_days_per_year - this.personal_days_used)
  }

  get isPerformanceReviewDue() {
    if (!this.next_performance_review) return false
    return DateTime.now() >= this.next_performance_review
  }
}