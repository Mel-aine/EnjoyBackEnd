# Channex Migration API Documentation

This document provides detailed information on how to call and implement the Channex migration API endpoints.

## Overview

The Channex Migration API allows you to migrate hotel data from your local system to Channex channel manager. It handles the migration of:
- Hotel properties
- Room types
- Rate plans
- Rates and pricing
- Availability data

## Authentication

### Requirements
- Valid user authentication (JWT token)
- Proper authorization headers
- User must be logged in to the system

### Headers
```http
Authorization: Bearer <your-jwt-token>
Content-Type: application/json
```

## Environment Configuration

Before using the API, ensure these environment variables are set in your `.env` file:

```env
CHANNEX_API_KEY=your_channex_api_key_here
CHANNEX_BASE_URL=https://api.channex.io/v1
```

## API Endpoints

### 1. Migrate Hotel Data

**Endpoint:** `POST /api/channex/migrate/:hotelId`

**Description:** Migrates all hotel data (property, room types, rate plans, rates, and availability) to Channex.

#### Request

**URL Parameters:**
- `hotelId` (required): The ID of the hotel to migrate

**Example Request:**
```http
POST /api/channex/migrate/123
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

#### Response

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Hotel migration completed successfully",
  "data": {
    "hotelId": "123",
    "status": "completed",
    "startTime": "2024-01-15T10:30:00.000Z",
    "endTime": "2024-01-15T10:35:00.000Z",
    "totalMigrated": 25,
    "totalErrors": 0,
    "details": {
      "property": {
        "success": true,
        "error": null
      },
      "roomTypes": {
        "success": true,
        "error": null,
        "count": 5
      },
      "ratePlans": {
        "success": true,
        "error": null,
        "count": 8
      },
      "rates": {
        "success": true,
        "error": null,
        "count": 10
      },
      "availability": {
        "success": true,
        "error": null,
        "count": 2
      }
    }
  }
}
```

**Error Response (400 Bad Request):**
```json
{
  "success": false,
  "message": "Hotel ID is required",
  "error": "Missing required parameter: hotelId"
}
```

**Error Response (401 Unauthorized):**
```json
{
  "success": false,
  "message": "Authentication required",
  "error": "User not authenticated"
}
```

**Error Response (500 Internal Server Error):**
```json
{
  "success": false,
  "message": "Hotel migration failed",
  "error": "Connection timeout to Channex API",
  "data": {
    "hotelId": "123",
    "status": "failed",
    "startTime": "2024-01-15T10:30:00.000Z",
    "endTime": "2024-01-15T10:31:00.000Z",
    "totalMigrated": 0,
    "totalErrors": 1,
    "details": {
      "property": {
        "success": false,
        "error": "Connection timeout to Channex API"
      }
    }
  }
}
```

### 2. Get Migration Status

**Endpoint:** `GET /api/channex/migrate/:hotelId/status`

**Description:** Retrieves the current migration status for a hotel.

#### Request

**URL Parameters:**
- `hotelId` (required): The ID of the hotel

**Example Request:**
```http
GET /api/channex/migrate/123/status
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Response

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "hotelId": "123",
    "status": "completed",
    "lastMigration": "2024-01-15T10:35:00.000Z",
    "channexPropertyId": "prop_abc123",
    "migratedComponents": {
      "property": true,
      "roomTypes": true,
      "ratePlans": true,
      "rates": true,
      "availability": true
    }
  }
}
```

## Implementation Examples

### JavaScript/TypeScript (Frontend)

```typescript
interface MigrationResponse {
  success: boolean;
  message: string;
  data?: {
    hotelId: string;
    status: 'completed' | 'failed' | 'in_progress';
    startTime: string;
    endTime: string | null;
    totalMigrated: number;
    totalErrors: number;
    details: {
      property: { success: boolean; error: string | null };
      roomTypes: { success: boolean; error: string | null; count: number };
      ratePlans: { success: boolean; error: string | null; count: number };
      rates: { success: boolean; error: string | null; count: number };
      availability: { success: boolean; error: string | null; count: number };
    };
  };
  error?: string;
}

class ChannexMigrationAPI {
  private baseUrl: string;
  private authToken: string;

  constructor(baseUrl: string, authToken: string) {
    this.baseUrl = baseUrl;
    this.authToken = authToken;
  }

  async migrateHotel(hotelId: string): Promise<MigrationResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/channex/migrate/${hotelId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        }
      });

      const data: MigrationResponse = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Migration failed');
      }

      return data;
    } catch (error) {
      console.error('Migration error:', error);
      throw error;
    }
  }

  async getMigrationStatus(hotelId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/channex/migrate/${hotelId}/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to get migration status');
      }

      return data;
    } catch (error) {
      console.error('Status check error:', error);
      throw error;
    }
  }
}

// Usage Example
const api = new ChannexMigrationAPI('http://localhost:3333', 'your-jwt-token');

// Migrate hotel
api.migrateHotel('123')
  .then(result => {
    console.log('Migration completed:', result);
  })
  .catch(error => {
    console.error('Migration failed:', error);
  });

// Check status
api.getMigrationStatus('123')
  .then(status => {
    console.log('Migration status:', status);
  })
  .catch(error => {
    console.error('Status check failed:', error);
  });
```

### cURL Examples

**Migrate Hotel:**
```bash
curl -X POST \
  http://localhost:3333/api/channex/migrate/123 \
  -H 'Authorization: Bearer your-jwt-token' \
  -H 'Content-Type: application/json'
```

**Get Migration Status:**
```bash
curl -X GET \
  http://localhost:3333/api/channex/migrate/123/status \
  -H 'Authorization: Bearer your-jwt-token' \
  -H 'Content-Type: application/json'
```

### Python Example

```python
import requests
import json

class ChannexMigrationAPI:
    def __init__(self, base_url, auth_token):
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {auth_token}',
            'Content-Type': 'application/json'
        }
    
    def migrate_hotel(self, hotel_id):
        url = f"{self.base_url}/api/channex/migrate/{hotel_id}"
        
        try:
            response = requests.post(url, headers=self.headers)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Migration error: {e}")
            raise
    
    def get_migration_status(self, hotel_id):
        url = f"{self.base_url}/api/channex/migrate/{hotel_id}/status"
        
        try:
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Status check error: {e}")
            raise

# Usage
api = ChannexMigrationAPI('http://localhost:3333', 'your-jwt-token')

# Migrate hotel
try:
    result = api.migrate_hotel('123')
    print('Migration completed:', json.dumps(result, indent=2))
except Exception as e:
    print('Migration failed:', str(e))

# Check status
try:
    status = api.get_migration_status('123')
    print('Migration status:', json.dumps(status, indent=2))
except Exception as e:
    print('Status check failed:', str(e))
```

## Migration Process Flow

1. **Authentication**: Ensure user is logged in and has valid JWT token
2. **Validation**: Validate hotel ID and user permissions
3. **Property Migration**: Create/update hotel property in Channex
4. **Room Types Migration**: Migrate all room types and configurations
5. **Rate Plans Migration**: Create rate plans with policies and restrictions
6. **Rates Migration**: Upload pricing data for different periods
7. **Availability Migration**: Set room availability and restrictions
8. **Logging**: All activities are logged using LoggerService.bulkLog()
9. **Response**: Return comprehensive migration results

## Error Handling

The API implements comprehensive error handling:

- **Validation Errors**: Missing parameters, invalid data
- **Authentication Errors**: Invalid or expired tokens
- **Channex API Errors**: Connection issues, API rate limits
- **Database Errors**: Local data retrieval issues
- **Network Errors**: Timeout, connection failures

Each error includes:
- Error message
- Error code/type
- Detailed context
- Suggested resolution

## Activity Logging

All migration activities are automatically logged with:

- **User Information**: Who initiated the migration
- **Timestamps**: When each step occurred
- **Success/Failure Status**: Detailed results for each component
- **Error Details**: Complete error information for debugging
- **Metadata**: Additional context and statistics

Log entries include:
- `CHANNEX_MIGRATION_START`
- `CHANNEX_PROPERTY_MIGRATION_SUCCESS/FAILED`
- `CHANNEX_ROOMTYPES_MIGRATION_SUCCESS/FAILED`
- `CHANNEX_RATEPLANS_MIGRATION_SUCCESS/FAILED`
- `CHANNEX_RATES_MIGRATION_SUCCESS/FAILED`
- `CHANNEX_AVAILABILITY_MIGRATION_SUCCESS/FAILED`
- `CHANNEX_MIGRATION_COMPLETE/FAILED`

## Best Practices

1. **Always check authentication** before making API calls
2. **Handle errors gracefully** with proper user feedback
3. **Monitor migration progress** using the status endpoint
4. **Implement retry logic** for network failures
5. **Validate data** before initiating migration
6. **Log all activities** for audit trails
7. **Test with small datasets** before full migration
8. **Backup data** before migration

## Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Check JWT token validity
   - Verify user permissions
   - Ensure proper headers

2. **Migration Timeout**
   - Check network connectivity
   - Verify Channex API status
   - Consider smaller batch sizes

3. **Data Validation Errors**
   - Review hotel data completeness
   - Check required fields
   - Validate data formats

4. **Channex API Errors**
   - Verify API credentials
   - Check rate limits
   - Review Channex documentation

### Support

For additional support:
- Check server logs for detailed error information
- Review activity logs for migration history
- Contact system administrator for configuration issues
- Refer to Channex API documentation for external API issues