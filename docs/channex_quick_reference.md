# Channex Integration Quick Reference

A quick reference guide for developers working with Channex channel management integration.

## Quick Start

### 1. Environment Setup

```bash
# Add to .env file
CHANNEX_API_KEY=your_api_key_here
CHANNEX_BASE_URL=https://api.channex.io/v1
```

### 2. Basic Migration

```bash
# Migrate entire hotel
curl -X POST http://localhost:3333/api/channex/migrate/123 \
  -H "Authorization: Bearer your-jwt-token"

# Check migration status
curl -X GET http://localhost:3333/api/channex/migrate/123/status \
  -H "Authorization: Bearer your-jwt-token"
```

### 3. Component-Specific Migration

```bash
# Migrate only property details
POST /api/channex/migrate/123/property

# Migrate only room types
POST /api/channex/migrate/123/room_types

# Migrate only rate plans
POST /api/channex/migrate/123/rate_plans
```

## Common Code Patterns

### Service Usage

```typescript
// Import and use ChannexService
import ChannexService from 'App/Services/ChannexService'

const channexService = new ChannexService()

// Create property
const property = await channexService.createProperty({
  name: 'Hotel Name',
  address: { city: 'City', country: 'US' }
})

// Update rates
const rates = await channexService.updateRates(propertyId, {
  date: '2024-01-15',
  rate: 150.00,
  currency: 'USD'
})
```

### Error Handling Pattern

```typescript
try {
  const result = await channexService.createProperty(data)
  
  // Log success
  await LoggerService.log({
    actorId: userId,
    action: 'CHANNEX_PROPERTY_CREATED',
    entityType: 'hotel',
    entityId: hotelId,
    description: 'Property created successfully',
    hotelId: parseInt(hotelId)
  })
  
  return { success: true, data: result }
} catch (error) {
  console.error('Channex operation failed:', error)
  
  // Log failure
  await LoggerService.log({
    actorId: userId,
    action: 'CHANNEX_PROPERTY_FAILED',
    entityType: 'hotel',
    entityId: hotelId,
    description: 'Property creation failed',
    meta: { error: error.message },
    hotelId: parseInt(hotelId)
  })
  
  throw error
}
```

### Bulk Logging Pattern

```typescript
const logEntries = []

// Add log entries during operations
logEntries.push({
  actorId: userId,
  action: 'CHANNEX_OPERATION_START',
  entityType: 'hotel',
  entityId: hotelId,
  description: 'Started Channex operation',
  hotelId: parseInt(hotelId),
  ctx: { operation: 'migration' }
})

// ... perform operations ...

// Log all at once
await LoggerService.bulkLog(logEntries)
```

## API Endpoints Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/channex/migrate/:hotelId` | Full hotel migration |
| `POST` | `/api/channex/migrate/:hotelId/:component` | Component migration |
| `GET` | `/api/channex/migrate/:hotelId/status` | Migration status |
| `GET` | `/api/channex/migrate/:hotelId/history` | Migration history |
| `POST` | `/api/channex/sync/:hotelId` | Sync from Channex |
| `GET` | `/api/channex/test-connection` | Test API connection |

## Data Transformation Examples

### Hotel to Property

```typescript
// Local hotel data
const hotel = {
  name: 'Grand Hotel',
  address: '123 Main St',
  city: 'New York',
  country: 'US',
  phone: '+1-555-0123',
  email: 'info@grandhotel.com'
}

// Transformed for Channex
const property = {
  name: hotel.name,
  address: {
    street: hotel.address,
    city: hotel.city,
    country: hotel.country
  },
  contact: {
    phone: hotel.phone,
    email: hotel.email
  }
}
```

### Room Type to Channex

```typescript
// Local room type
const roomType = {
  name: 'Deluxe Suite',
  maxOccupancy: 4,
  bedType: 'king',
  size: 45,
  totalRooms: 10
}

// Transformed for Channex
const channexRoomType = {
  name: roomType.name,
  max_occupancy: roomType.maxOccupancy,
  bed_type: roomType.bedType,
  room_size: roomType.size,
  count: roomType.totalRooms
}
```

## Response Formats

### Success Response

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    "hotelId": "123",
    "status": "completed",
    "totalMigrated": 25,
    "totalErrors": 0
  }
}
```

### Error Response

```json
{
  "success": false,
  "message": "Operation failed",
  "error": "Detailed error message",
  "data": {
    "hotelId": "123",
    "status": "failed",
    "totalErrors": 1
  }
}
```

## Common Troubleshooting

### Authentication Issues

```bash
# Check if API key is valid
curl -H "Authorization: Bearer $CHANNEX_API_KEY" \
     https://api.channex.io/v1/properties

# Response should not be 401 Unauthorized
```

### Connection Testing

```typescript
// Test Channex connection
const channexService = new ChannexService()
const result = await channexService.testConnection()

if (!result.success) {
  console.error('Channex connection failed:', result.message)
}
```

### Rate Limiting

```typescript
// Implement retry with exponential backoff
const retryWithBackoff = async (operation, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation()
    } catch (error) {
      if (error.message.includes('rate limit') && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000 // 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      throw error
    }
  }
}
```

### Data Validation

```typescript
// Validate required fields before migration
const validateHotelData = (hotel) => {
  const required = ['name', 'address', 'city', 'country']
  const missing = required.filter(field => !hotel[field])
  
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`)
  }
}
```

## Environment Variables

```bash
# Required
CHANNEX_API_KEY=your_api_key
CHANNEX_BASE_URL=https://api.channex.io/v1

# Optional
CHANNEX_TIMEOUT=30000
CHANNEX_RETRY_ATTEMPTS=3
CHANNEX_DEBUG=false
CHANNEX_WEBHOOK_SECRET=webhook_secret
```

## Logging Actions

### Migration Actions
- `CHANNEX_MIGRATION_START`
- `CHANNEX_MIGRATION_COMPLETE`
- `CHANNEX_MIGRATION_FAILED`

### Component Actions
- `CHANNEX_PROPERTY_MIGRATION_SUCCESS`
- `CHANNEX_PROPERTY_MIGRATION_FAILED`
- `CHANNEX_ROOMTYPES_MIGRATION_SUCCESS`
- `CHANNEX_ROOMTYPES_MIGRATION_FAILED`
- `CHANNEX_RATEPLANS_MIGRATION_SUCCESS`
- `CHANNEX_RATEPLANS_MIGRATION_FAILED`
- `CHANNEX_RATES_MIGRATION_SUCCESS`
- `CHANNEX_RATES_MIGRATION_FAILED`
- `CHANNEX_AVAILABILITY_MIGRATION_SUCCESS`
- `CHANNEX_AVAILABILITY_MIGRATION_FAILED`

### Sync Actions
- `CHANNEX_SYNC_SUCCESS`
- `CHANNEX_SYNC_FAILED`

## Performance Tips

1. **Batch Operations**: Use bulk APIs when available
2. **Rate Limiting**: Implement proper rate limiting
3. **Caching**: Cache frequently accessed data
4. **Async Processing**: Use queues for large migrations
5. **Error Recovery**: Implement retry mechanisms

## Security Checklist

- [ ] API keys stored in environment variables
- [ ] HTTPS used for all API calls
- [ ] Webhook signatures verified
- [ ] User authentication required
- [ ] Input validation implemented
- [ ] Error messages don't expose sensitive data

## Testing Commands

```bash
# Test migration endpoint
curl -X POST http://localhost:3333/api/channex/migrate/1 \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json"

# Test specific component
curl -X POST http://localhost:3333/api/channex/migrate/1/property \
  -H "Authorization: Bearer token"

# Check status
curl -X GET http://localhost:3333/api/channex/migrate/1/status \
  -H "Authorization: Bearer token"

# Get history
curl -X GET http://localhost:3333/api/channex/migrate/1/history \
  -H "Authorization: Bearer token"
```

## Useful Queries

### Get Migration Logs

```sql
SELECT * FROM activity_logs 
WHERE action LIKE 'CHANNEX_%' 
  AND entity_type = 'hotel' 
  AND entity_id = '123'
ORDER BY created_at DESC;
```

### Check Hotel Channex Status

```sql
SELECT id, name, channex_property_id, 
       CASE WHEN channex_property_id IS NOT NULL 
            THEN 'Linked' 
            ELSE 'Not Linked' 
       END as channex_status
FROM hotels;
```

## Quick Debugging

### Enable Debug Mode

```bash
# Add to .env
CHANNEX_DEBUG=true
LOG_LEVEL=debug
```

### Check Logs

```bash
# View recent logs
tail -f tmp/logs/adonis.log | grep CHANNEX

# Search for errors
grep -i "channex.*error" tmp/logs/adonis.log
```

### Monitor Performance

```bash
# Watch for slow requests
tail -f tmp/logs/adonis.log | grep "took.*ms" | grep -E "[0-9]{4,}ms"
```

## Support Resources

- **API Documentation**: Created comprehensive docs in `/docs/channex_migration_api.md`
- **Implementation Guide**: Detailed guide in `/docs/channex_service_implementation.md`
- **Activity Logs**: Check `activity_logs` table for migration history
- **Server Logs**: Check application logs for detailed error information
- **Channex API Docs**: https://api.channex.io/docs

---

*This quick reference covers the most common operations and troubleshooting scenarios for Channex integration. For detailed implementation guidance, refer to the full documentation files.*