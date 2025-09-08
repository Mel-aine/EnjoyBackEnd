# Channex Service Implementation Guide

This document provides detailed technical guidance on implementing and extending the Channex service for channel management operations.

## Service Architecture

### Core Components

1. **ChannexService**: Main service class for Channex API interactions
2. **ChannexMigrationController**: HTTP controller for migration endpoints
3. **LoggerService**: Activity logging and audit trails
4. **Authentication**: User authentication and authorization
5. **Error Handling**: Comprehensive error management

### File Structure

```
app/
├── Controllers/Http/
│   └── ChannexMigrationController.ts
├── Services/
│   ├── ChannexService.ts
│   └── LoggerService.ts
├── Models/
│   ├── Hotel.ts
│   ├── RoomType.ts
│   ├── RatePlan.ts
│   └── ActivityLog.ts
├── Routes/
│   └── channex.ts
└── Config/
    └── channex.ts
```

## ChannexService Implementation

### Basic Service Structure

```typescript
// app/Services/ChannexService.ts
import { HttpClientContract } from '@ioc:Adonis/Core/HttpClient'
import Env from '@ioc:Adonis/Core/Env'

export default class ChannexService {
  private httpClient: HttpClientContract
  private baseUrl: string
  private apiKey: string

  constructor(httpClient: HttpClientContract) {
    this.httpClient = httpClient
    this.baseUrl = Env.get('CHANNEX_BASE_URL', 'https://api.channex.io/v1')
    this.apiKey = Env.get('CHANNEX_API_KEY')
  }

  /**
   * Get default headers for Channex API requests
   */
  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  }

  /**
   * Make authenticated request to Channex API
   */
  private async makeRequest(method: string, endpoint: string, data?: any) {
    const url = `${this.baseUrl}${endpoint}`
    
    try {
      const response = await this.httpClient.request(url, {
        method,
        headers: this.getHeaders(),
        json: data,
        timeout: 30000 // 30 seconds timeout
      })

      return response.body()
    } catch (error) {
      console.error(`Channex API Error [${method} ${endpoint}]:`, error)
      throw new Error(`Channex API request failed: ${error.message}`)
    }
  }

  // Property Management Methods
  async createProperty(propertyData: any) {
    return this.makeRequest('POST', '/properties', propertyData)
  }

  async updateProperty(propertyId: string, propertyData: any) {
    return this.makeRequest('PUT', `/properties/${propertyId}`, propertyData)
  }

  async getProperty(propertyId: string) {
    return this.makeRequest('GET', `/properties/${propertyId}`)
  }

  // Room Type Management Methods
  async createRoomType(propertyId: string, roomTypeData: any) {
    return this.makeRequest('POST', `/properties/${propertyId}/room_types`, roomTypeData)
  }

  async updateRoomType(propertyId: string, roomTypeId: string, roomTypeData: any) {
    return this.makeRequest('PUT', `/properties/${propertyId}/room_types/${roomTypeId}`, roomTypeData)
  }

  async getRoomTypes(propertyId: string) {
    return this.makeRequest('GET', `/properties/${propertyId}/room_types`)
  }

  // Rate Plan Management Methods
  async createRatePlan(propertyId: string, ratePlanData: any) {
    return this.makeRequest('POST', `/properties/${propertyId}/rate_plans`, ratePlanData)
  }

  async updateRatePlan(propertyId: string, ratePlanId: string, ratePlanData: any) {
    return this.makeRequest('PUT', `/properties/${propertyId}/rate_plans/${ratePlanId}`, ratePlanData)
  }

  async getRatePlans(propertyId: string) {
    return this.makeRequest('GET', `/properties/${propertyId}/rate_plans`)
  }

  // Rates Management Methods
  async updateRates(propertyId: string, ratesData: any) {
    return this.makeRequest('POST', `/properties/${propertyId}/rates`, ratesData)
  }

  async getRates(propertyId: string, params?: any) {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : ''
    return this.makeRequest('GET', `/properties/${propertyId}/rates${queryString}`)
  }

  // Availability Management Methods
  async updateAvailability(propertyId: string, availabilityData: any) {
    return this.makeRequest('POST', `/properties/${propertyId}/availability`, availabilityData)
  }

  async getAvailability(propertyId: string, params?: any) {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : ''
    return this.makeRequest('GET', `/properties/${propertyId}/availability${queryString}`)
  }

  // Booking Management Methods
  async getBookings(propertyId: string, params?: any) {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : ''
    return this.makeRequest('GET', `/properties/${propertyId}/bookings${queryString}`)
  }

  async updateBooking(propertyId: string, bookingId: string, bookingData: any) {
    return this.makeRequest('PUT', `/properties/${propertyId}/bookings/${bookingId}`, bookingData)
  }

  // Utility Methods
  async testConnection() {
    try {
      await this.makeRequest('GET', '/properties')
      return { success: true, message: 'Connection successful' }
    } catch (error) {
      return { success: false, message: error.message }
    }
  }
}
```

### Service Registration

```typescript
// providers/AppProvider.ts
import { ApplicationContract } from '@ioc:Adonis/Core/Application'
import ChannexService from 'App/Services/ChannexService'

export default class AppProvider {
  public static needsApplication = true

  constructor(protected app: ApplicationContract) {}

  public register() {
    this.app.container.singleton('App/Services/ChannexService', () => {
      const HttpClient = this.app.container.resolveBinding('Adonis/Core/HttpClient')
      return new ChannexService(HttpClient)
    })
  }
}
```

## Data Transformation Layer

### Hotel to Channex Property Mapping

```typescript
// app/Services/ChannexTransformService.ts
export default class ChannexTransformService {
  /**
   * Transform local hotel data to Channex property format
   */
  static transformHotelToProperty(hotel: any) {
    return {
      name: hotel.name,
      description: hotel.description,
      address: {
        street: hotel.address,
        city: hotel.city,
        state: hotel.state,
        country: hotel.country,
        postal_code: hotel.postalCode
      },
      contact: {
        phone: hotel.phone,
        email: hotel.email,
        website: hotel.website
      },
      coordinates: {
        latitude: hotel.latitude,
        longitude: hotel.longitude
      },
      amenities: hotel.amenities || [],
      policies: {
        check_in_time: hotel.checkInTime || '15:00',
        check_out_time: hotel.checkOutTime || '11:00',
        cancellation_policy: hotel.cancellationPolicy
      },
      currency: hotel.currency || 'USD',
      timezone: hotel.timezone || 'UTC'
    }
  }

  /**
   * Transform local room type to Channex room type format
   */
  static transformRoomTypeToChannex(roomType: any) {
    return {
      name: roomType.name,
      description: roomType.description,
      max_occupancy: roomType.maxOccupancy,
      bed_type: roomType.bedType,
      room_size: roomType.size,
      amenities: roomType.amenities || [],
      photos: roomType.photos || [],
      count: roomType.totalRooms
    }
  }

  /**
   * Transform local rate plan to Channex rate plan format
   */
  static transformRatePlanToChannex(ratePlan: any) {
    return {
      name: ratePlan.name,
      description: ratePlan.description,
      meal_plan: ratePlan.mealPlan || 'room_only',
      cancellation_policy: ratePlan.cancellationPolicy,
      payment_policy: ratePlan.paymentPolicy,
      restrictions: {
        min_stay: ratePlan.minStay || 1,
        max_stay: ratePlan.maxStay,
        advance_booking: ratePlan.advanceBooking,
        closed_to_arrival: ratePlan.closedToArrival || false,
        closed_to_departure: ratePlan.closedToDeparture || false
      }
    }
  }

  /**
   * Transform local rates to Channex rates format
   */
  static transformRatesToChannex(rates: any[]) {
    return rates.map(rate => ({
      date: rate.date,
      rate_plan_id: rate.ratePlanId,
      room_type_id: rate.roomTypeId,
      rate: rate.amount,
      currency: rate.currency || 'USD',
      occupancy: rate.occupancy || 1
    }))
  }

  /**
   * Transform local availability to Channex availability format
   */
  static transformAvailabilityToChannex(availability: any[]) {
    return availability.map(avail => ({
      date: avail.date,
      room_type_id: avail.roomTypeId,
      available_rooms: avail.availableRooms,
      restrictions: {
        closed_to_arrival: avail.closedToArrival || false,
        closed_to_departure: avail.closedToDeparture || false,
        min_stay: avail.minStay,
        max_stay: avail.maxStay
      }
    }))
  }
}
```

## Advanced Controller Implementation

### Extended Migration Controller

```typescript
// app/Controllers/Http/ChannexMigrationController.ts
import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import ChannexService from 'App/Services/ChannexService'
import ChannexTransformService from 'App/Services/ChannexTransformService'
import LoggerService from 'App/Services/LoggerService'
import Hotel from 'App/Models/Hotel'
import RoomType from 'App/Models/RoomType'
import RatePlan from 'App/Models/RatePlan'

export default class ChannexMigrationController {
  /**
   * Migrate specific hotel component
   */
  public async migrateComponent({ params, auth, response }: HttpContextContract) {
    const { hotelId, component } = params
    const userId = auth.user?.id

    if (!userId) {
      return response.status(401).json({
        success: false,
        message: 'Authentication required'
      })
    }

    const validComponents = ['property', 'room_types', 'rate_plans', 'rates', 'availability']
    if (!validComponents.includes(component)) {
      return response.status(400).json({
        success: false,
        message: 'Invalid component specified'
      })
    }

    try {
      const channexService = new ChannexService()
      let result

      switch (component) {
        case 'property':
          result = await this.migrateProperty(hotelId, channexService)
          break
        case 'room_types':
          result = await this.migrateRoomTypes(hotelId, channexService)
          break
        case 'rate_plans':
          result = await this.migrateRatePlans(hotelId, channexService)
          break
        case 'rates':
          result = await this.migrateRates(hotelId, channexService)
          break
        case 'availability':
          result = await this.migrateAvailability(hotelId, channexService)
          break
      }

      // Log the migration
      await LoggerService.log({
        actorId: userId,
        action: `CHANNEX_${component.toUpperCase()}_MIGRATION_SUCCESS`,
        entityType: 'hotel',
        entityId: hotelId,
        description: `Successfully migrated ${component} for hotel ${hotelId}`,
        hotelId: parseInt(hotelId),
        ctx: { request: 'channex_migration', component }
      })

      return response.json({
        success: true,
        message: `${component} migration completed successfully`,
        data: result
      })
    } catch (error) {
      console.error(`${component} migration failed:`, error)

      // Log the failure
      await LoggerService.log({
        actorId: userId,
        action: `CHANNEX_${component.toUpperCase()}_MIGRATION_FAILED`,
        entityType: 'hotel',
        entityId: hotelId,
        description: `Failed to migrate ${component} for hotel ${hotelId}`,
        meta: { error: error.message },
        hotelId: parseInt(hotelId),
        ctx: { request: 'channex_migration', component }
      })

      return response.status(500).json({
        success: false,
        message: `${component} migration failed`,
        error: error.message
      })
    }
  }

  /**
   * Sync data from Channex back to local system
   */
  public async syncFromChannex({ params, auth, response }: HttpContextContract) {
    const { hotelId } = params
    const userId = auth.user?.id

    if (!userId) {
      return response.status(401).json({
        success: false,
        message: 'Authentication required'
      })
    }

    try {
      const channexService = new ChannexService()
      const hotel = await Hotel.findOrFail(hotelId)
      
      if (!hotel.channexPropertyId) {
        return response.status(400).json({
          success: false,
          message: 'Hotel not linked to Channex property'
        })
      }

      // Sync bookings from Channex
      const bookings = await channexService.getBookings(hotel.channexPropertyId, {
        from: new Date().toISOString().split('T')[0],
        limit: 100
      })

      // Process and save bookings locally
      const syncResults = await this.processChannexBookings(bookings, hotelId)

      // Log the sync
      await LoggerService.log({
        actorId: userId,
        action: 'CHANNEX_SYNC_SUCCESS',
        entityType: 'hotel',
        entityId: hotelId,
        description: `Successfully synced data from Channex for hotel ${hotelId}`,
        meta: { syncedBookings: syncResults.length },
        hotelId: parseInt(hotelId),
        ctx: { request: 'channex_sync' }
      })

      return response.json({
        success: true,
        message: 'Sync completed successfully',
        data: {
          syncedBookings: syncResults.length,
          bookings: syncResults
        }
      })
    } catch (error) {
      console.error('Channex sync failed:', error)

      return response.status(500).json({
        success: false,
        message: 'Sync failed',
        error: error.message
      })
    }
  }

  /**
   * Get migration history for a hotel
   */
  public async getMigrationHistory({ params, response }: HttpContextContract) {
    const { hotelId } = params

    try {
      const history = await LoggerService.getActivityLogs({
        entityType: 'hotel',
        entityId: hotelId,
        actions: [
          'CHANNEX_MIGRATION_START',
          'CHANNEX_MIGRATION_COMPLETE',
          'CHANNEX_MIGRATION_FAILED',
          'CHANNEX_PROPERTY_MIGRATION_SUCCESS',
          'CHANNEX_PROPERTY_MIGRATION_FAILED',
          'CHANNEX_ROOMTYPES_MIGRATION_SUCCESS',
          'CHANNEX_ROOMTYPES_MIGRATION_FAILED',
          'CHANNEX_RATEPLANS_MIGRATION_SUCCESS',
          'CHANNEX_RATEPLANS_MIGRATION_FAILED',
          'CHANNEX_RATES_MIGRATION_SUCCESS',
          'CHANNEX_RATES_MIGRATION_FAILED',
          'CHANNEX_AVAILABILITY_MIGRATION_SUCCESS',
          'CHANNEX_AVAILABILITY_MIGRATION_FAILED'
        ],
        limit: 50
      })

      return response.json({
        success: true,
        data: history
      })
    } catch (error) {
      console.error('Failed to get migration history:', error)

      return response.status(500).json({
        success: false,
        message: 'Failed to get migration history',
        error: error.message
      })
    }
  }

  // Private helper methods
  private async migrateProperty(hotelId: string, channexService: ChannexService) {
    const hotel = await Hotel.findOrFail(hotelId)
    const propertyData = ChannexTransformService.transformHotelToProperty(hotel)
    
    if (hotel.channexPropertyId) {
      return await channexService.updateProperty(hotel.channexPropertyId, propertyData)
    } else {
      const result = await channexService.createProperty(propertyData)
      hotel.channexPropertyId = result.id
      await hotel.save()
      return result
    }
  }

  private async migrateRoomTypes(hotelId: string, channexService: ChannexService) {
    const hotel = await Hotel.findOrFail(hotelId)
    const roomTypes = await RoomType.query().where('hotel_id', hotelId)
    
    const results = []
    for (const roomType of roomTypes) {
      const roomTypeData = ChannexTransformService.transformRoomTypeToChannex(roomType)
      
      if (roomType.channexRoomTypeId) {
        const result = await channexService.updateRoomType(
          hotel.channexPropertyId,
          roomType.channexRoomTypeId,
          roomTypeData
        )
        results.push(result)
      } else {
        const result = await channexService.createRoomType(hotel.channexPropertyId, roomTypeData)
        roomType.channexRoomTypeId = result.id
        await roomType.save()
        results.push(result)
      }
    }
    
    return results
  }

  private async migrateRatePlans(hotelId: string, channexService: ChannexService) {
    const hotel = await Hotel.findOrFail(hotelId)
    const ratePlans = await RatePlan.query().where('hotel_id', hotelId)
    
    const results = []
    for (const ratePlan of ratePlans) {
      const ratePlanData = ChannexTransformService.transformRatePlanToChannex(ratePlan)
      
      if (ratePlan.channexRatePlanId) {
        const result = await channexService.updateRatePlan(
          hotel.channexPropertyId,
          ratePlan.channexRatePlanId,
          ratePlanData
        )
        results.push(result)
      } else {
        const result = await channexService.createRatePlan(hotel.channexPropertyId, ratePlanData)
        ratePlan.channexRatePlanId = result.id
        await ratePlan.save()
        results.push(result)
      }
    }
    
    return results
  }

  private async migrateRates(hotelId: string, channexService: ChannexService) {
    // Implementation for rates migration
    // This would involve getting rate data and transforming it
    return { message: 'Rates migration completed' }
  }

  private async migrateAvailability(hotelId: string, channexService: ChannexService) {
    // Implementation for availability migration
    // This would involve getting availability data and transforming it
    return { message: 'Availability migration completed' }
  }

  private async processChannexBookings(bookings: any[], hotelId: string) {
    // Implementation for processing Channex bookings
    // Transform and save bookings to local database
    return bookings.map(booking => ({
      channexId: booking.id,
      guestName: booking.guest_name,
      checkIn: booking.check_in,
      checkOut: booking.check_out,
      status: booking.status
    }))
  }
}
```

## Route Configuration

### Extended Routes

```typescript
// start/routes/channex.ts
import Route from '@ioc:Adonis/Core/Route'

Route.group(() => {
  // Migration routes
  Route.post('/migrate/:hotelId', 'ChannexMigrationController.migrate')
  Route.post('/migrate/:hotelId/:component', 'ChannexMigrationController.migrateComponent')
  Route.get('/migrate/:hotelId/status', 'ChannexMigrationController.getMigrationStatus')
  Route.get('/migrate/:hotelId/history', 'ChannexMigrationController.getMigrationHistory')
  
  // Sync routes
  Route.post('/sync/:hotelId', 'ChannexMigrationController.syncFromChannex')
  
  // Test routes
  Route.get('/test-connection', 'ChannexMigrationController.testConnection')
  
  // Webhook routes for Channex notifications
  Route.post('/webhook/booking', 'ChannexWebhookController.handleBooking')
  Route.post('/webhook/cancellation', 'ChannexWebhookController.handleCancellation')
  Route.post('/webhook/modification', 'ChannexWebhookController.handleModification')
}).prefix('/api/channex').middleware(['auth'])
```

## Configuration

### Environment Variables

```env
# .env
CHANNEX_API_KEY=your_channex_api_key_here
CHANNEX_BASE_URL=https://api.channex.io/v1
CHANNEX_WEBHOOK_SECRET=your_webhook_secret_here
CHANNEX_TIMEOUT=30000
CHANNEX_RETRY_ATTEMPTS=3
```

### Configuration File

```typescript
// config/channex.ts
import Env from '@ioc:Adonis/Core/Env'

export default {
  apiKey: Env.get('CHANNEX_API_KEY'),
  baseUrl: Env.get('CHANNEX_BASE_URL', 'https://api.channex.io/v1'),
  webhookSecret: Env.get('CHANNEX_WEBHOOK_SECRET'),
  timeout: Env.get('CHANNEX_TIMEOUT', 30000),
  retryAttempts: Env.get('CHANNEX_RETRY_ATTEMPTS', 3),
  
  // Rate limiting
  rateLimit: {
    requests: 100,
    window: 60000 // 1 minute
  },
  
  // Batch processing
  batchSize: {
    rates: 100,
    availability: 50,
    bookings: 25
  }
}
```

## Testing

### Unit Tests

```typescript
// tests/unit/channex_service.spec.ts
import test from 'japa'
import ChannexService from 'App/Services/ChannexService'

test.group('ChannexService', () => {
  test('should create property successfully', async (assert) => {
    const channexService = new ChannexService()
    const propertyData = {
      name: 'Test Hotel',
      address: {
        street: '123 Test St',
        city: 'Test City',
        country: 'US'
      }
    }
    
    const result = await channexService.createProperty(propertyData)
    assert.isTrue(result.success)
    assert.exists(result.id)
  })
  
  test('should handle API errors gracefully', async (assert) => {
    const channexService = new ChannexService()
    
    try {
      await channexService.getProperty('invalid-id')
      assert.fail('Should have thrown an error')
    } catch (error) {
      assert.include(error.message, 'Channex API request failed')
    }
  })
})
```

### Integration Tests

```typescript
// tests/functional/channex_migration.spec.ts
import test from 'japa'
import supertest from 'supertest'

const BASE_URL = `http://${process.env.HOST}:${process.env.PORT}`

test.group('Channex Migration API', () => {
  test('should migrate hotel successfully', async (assert) => {
    const response = await supertest(BASE_URL)
      .post('/api/channex/migrate/1')
      .set('Authorization', 'Bearer valid-token')
      .expect(200)
    
    assert.isTrue(response.body.success)
    assert.equal(response.body.data.status, 'completed')
  })
  
  test('should require authentication', async (assert) => {
    const response = await supertest(BASE_URL)
      .post('/api/channex/migrate/1')
      .expect(401)
    
    assert.isFalse(response.body.success)
    assert.include(response.body.message, 'Authentication required')
  })
})
```

## Monitoring and Logging

### Performance Monitoring

```typescript
// app/Middleware/ChannexMonitoring.ts
import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

export default class ChannexMonitoring {
  public async handle({ request, response }: HttpContextContract, next: () => Promise<void>) {
    const startTime = Date.now()
    
    await next()
    
    const duration = Date.now() - startTime
    const endpoint = request.url()
    const method = request.method()
    const statusCode = response.getStatus()
    
    // Log performance metrics
    console.log(`[CHANNEX] ${method} ${endpoint} - ${statusCode} - ${duration}ms`)
    
    // Alert on slow requests
    if (duration > 10000) { // 10 seconds
      console.warn(`[CHANNEX] Slow request detected: ${method} ${endpoint} took ${duration}ms`)
    }
  }
}
```

### Error Tracking

```typescript
// app/Services/ChannexErrorTracker.ts
export default class ChannexErrorTracker {
  static async trackError(error: Error, context: any) {
    const errorData = {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      severity: this.determineSeverity(error)
    }
    
    // Log to database
    await this.logToDatabase(errorData)
    
    // Send to external monitoring service
    await this.sendToMonitoring(errorData)
  }
  
  private static determineSeverity(error: Error): string {
    if (error.message.includes('timeout')) return 'medium'
    if (error.message.includes('authentication')) return 'high'
    if (error.message.includes('rate limit')) return 'low'
    return 'medium'
  }
  
  private static async logToDatabase(errorData: any) {
    // Implementation for database logging
  }
  
  private static async sendToMonitoring(errorData: any) {
    // Implementation for external monitoring
  }
}
```

## Best Practices

1. **Error Handling**: Always implement comprehensive error handling
2. **Rate Limiting**: Respect Channex API rate limits
3. **Data Validation**: Validate all data before sending to Channex
4. **Logging**: Log all activities for audit trails
5. **Testing**: Write comprehensive tests for all functionality
6. **Monitoring**: Monitor performance and errors
7. **Security**: Secure API keys and sensitive data
8. **Documentation**: Keep documentation up to date

## Troubleshooting

### Common Issues

1. **Authentication Errors**: Check API key validity
2. **Rate Limiting**: Implement exponential backoff
3. **Data Format Errors**: Validate data transformation
4. **Network Issues**: Implement retry logic
5. **Webhook Failures**: Verify webhook signatures

### Debug Mode

```typescript
// Enable debug logging
if (Env.get('CHANNEX_DEBUG', false)) {
  console.log('Channex Debug Mode Enabled')
  // Additional debug logging
}
```

This implementation guide provides a comprehensive foundation for building and extending Channex integration in your hotel management system.