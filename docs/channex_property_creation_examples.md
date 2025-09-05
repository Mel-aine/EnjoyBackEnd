# Channex Property Creation Examples

This document provides comprehensive examples for creating properties using the Channex API integration.

## Basic Property Creation

### Method 1: Using createProperty (Recommended)

```typescript
import { ChannexService } from '../app/services/channex_service'

const channexService = new ChannexService()

// Create a property with all available fields
const propertyResult = await channexService.createProperty({
  // Required fields
  title: "Demo Hotel",
  currency: "GBP",
  
  // Optional basic information
  email: "hotel@channex.io",
  phone: "01267237037",
  zip_code: "SA23 2JH",
  country: "GB",
  state: "Demo State",
  city: "Demo Town",
  address: "Demo Street",
  longitude: "-0.2416781",
  latitude: "51.5285582",
  timezone: "Europe/London",
  facilities: [], // Array of facility IDs
  property_type: "hotel",
  group_id: "f5338935-7fe0-40eb-9d7e-4dbf7ecc52c7",
  
  // Settings configuration
  settings: {
    allow_availability_autoupdate_on_confirmation: true,
    allow_availability_autoupdate_on_modification: false,
    allow_availability_autoupdate_on_cancellation: false,
    min_stay_type: "both",
    min_price: null,
    max_price: null,
    state_length: 500,
    cut_off_time: "00:00:00",
    cut_off_days: 0,
    max_day_advance: null
  },
  
  // Content and media
  content: {
    description: "Some Property Description Text",
    photos: [{
      url: "https://img.channex.io/af08bc1d-8074-476c-bdb7-cec931edaf6a/",
      position: 0,
      author: "Author Name",
      kind: "photo",
      description: "Room View"
    }],
    important_information: "Some important notes about property"
  },
  
  logo_url: "https://hotel.domain/logo.png",
  website: "https://some-hotel-website.com"
})

console.log('Property created:', propertyResult)
```

### Method 2: Using createPropertyFromDemo (Alternative)

```typescript
// This method provides the same functionality with a cleaner interface
const propertyResult = await channexService.createPropertyFromDemo({
  title: "Demo Hotel",
  currency: "GBP",
  email: "hotel@channex.io",
  phone: "01267237037",
  zip_code: "SA23 2JH",
  country: "GB",
  state: "Demo State",
  city: "Demo Town",
  address: "Demo Street",
  longitude: "-0.2416781",
  latitude: "51.5285582",
  timezone: "Europe/London",
  facilities: [],
  property_type: "hotel",
  group_id: "f5338935-7fe0-40eb-9d7e-4dbf7ecc52c7",
  settings: {
    allow_availability_autoupdate_on_confirmation: true,
    allow_availability_autoupdate_on_modification: false,
    allow_availability_autoupdate_on_cancellation: false,
    min_stay_type: "both",
    min_price: null,
    max_price: null,
    state_length: 500,
    cut_off_time: "00:00:00",
    cut_off_days: 0,
    max_day_advance: null
  },
  content: {
    description: "Some Property Description Text",
    photos: [{
      url: "https://img.channex.io/af08bc1d-8074-476c-bdb7-cec931edaf6a/",
      position: 0,
      author: "Author Name",
      kind: "photo",
      description: "Room View"
    }],
    important_information: "Some important notes about property"
  },
  logo_url: "https://hotel.domain/logo.png",
  website: "https://some-hotel-website.com"
})
```

## Minimal Property Creation

```typescript
// Create a property with only required fields
const minimalProperty = await channexService.createProperty({
  title: "My Hotel",
  currency: "USD"
})
```

## Property Creation with Partial Data

```typescript
// Create a property with some optional fields
const partialProperty = await channexService.createProperty({
  title: "Boutique Hotel",
  currency: "EUR",
  email: "info@boutiquehotel.com",
  phone: "+33123456789",
  country: "FR",
  city: "Paris",
  timezone: "Europe/Paris",
  property_type: "hotel",
  content: {
    description: "A charming boutique hotel in the heart of Paris"
  }
})
```

## Error Handling

```typescript
try {
  const property = await channexService.createProperty({
    title: "Test Hotel",
    currency: "GBP",
    email: "test@hotel.com"
  })
  
  console.log('Property created successfully:', property)
} catch (error) {
  console.error('Failed to create property:', error.message)
  
  // Handle specific error cases
  if (error.message.includes('401')) {
    console.error('Authentication failed - check API key')
  } else if (error.message.includes('400')) {
    console.error('Invalid property data provided')
  }
}
```

## Field Validation Notes

### Required Fields
- **title**: String - The property name
- **currency**: String - 3-character currency code (e.g., "GBP", "USD", "EUR")

### Optional Fields
- **email**: String - Contact email
- **phone**: String - Contact phone number
- **zip_code**: String - Postal code
- **country**: String - 2-character country code (e.g., "GB", "US", "FR")
- **state**: String - State or region
- **city**: String - City name
- **address**: String - Street address
- **longitude**: String - Decimal longitude coordinate
- **latitude**: String - Decimal latitude coordinate
- **timezone**: String - IANA timezone (e.g., "Europe/London")
- **facilities**: Array - List of facility IDs
- **property_type**: String - Type of property (e.g., "hotel", "apartment")
- **group_id**: String - UUID of property group
- **settings**: Object - Property configuration settings
- **content**: Object - Property description and media
- **logo_url**: String - URL to property logo
- **website**: String - Property website URL

## API Response Format

The API will return a response in the following format:

```json
{
  "data": {
    "id": "property-uuid",
    "type": "property",
    "attributes": {
      "title": "Demo Hotel",
      "currency": "GBP",
      "email": "hotel@channex.io",
      "phone": "01267237037",
      "zip_code": "SA23 2JH",
      "country": "GB",
      "state": "Demo State",
      "city": "Demo Town",
      "address": "Demo Street",
      "longitude": "-0.2416781",
      "latitude": "51.5285582",
      "timezone": "Europe/London",
      "facilities": [],
      "property_type": "hotel",
      "group_id": "f5338935-7fe0-40eb-9d7e-4dbf7ecc52c7",
      "settings": { ... },
      "content": { ... },
      "logo_url": "https://hotel.domain/logo.png",
      "website": "https://some-hotel-website.com",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  }
}
```

## Integration with Migration Controller

```typescript
// Example usage in migration controller
import { ChannexService } from '../services/channex_service'
import Hotel from '../models/hotel'

class ChannexMigrationController {
  private channexService = new ChannexService()
  
  async migrateHotelProperty(hotelId: string) {
    try {
      // Get hotel data from local database
      const hotel = await Hotel.find(hotelId)
      
      // Transform local hotel data to Channex format
      const propertyData = {
        title: hotel.name,
        currency: hotel.currency || 'USD',
        email: hotel.email,
        phone: hotel.phone,
        zip_code: hotel.zipCode,
        country: hotel.countryCode,
        state: hotel.state,
        city: hotel.city,
        address: hotel.address,
        longitude: hotel.longitude?.toString(),
        latitude: hotel.latitude?.toString(),
        timezone: hotel.timezone || 'UTC',
        property_type: 'hotel',
        content: {
          description: hotel.description,
          important_information: hotel.policies
        },
        website: hotel.website
      }
      
      // Create property in Channex
      const result = await this.channexService.createProperty(propertyData)
      
      // Store Channex property ID in local database
      hotel.channexPropertyId = result.data.id
      await hotel.save()
      
      return {
        success: true,
        channexPropertyId: result.data.id,
        message: 'Property migrated successfully'
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }
}
```

## Best Practices

1. **Always validate required fields** before calling the API
2. **Use proper error handling** to catch and handle API errors
3. **Store the returned property ID** for future operations
4. **Validate currency codes** (must be 3 characters)
5. **Validate country codes** (must be 2 characters)
6. **Use proper timezone identifiers** (IANA format)
7. **Ensure coordinates are strings** if provided
8. **Test with minimal data first** before adding complex structures

## Common Errors

- **401 Unauthorized**: Invalid or missing API key
- **400 Bad Request**: Invalid property data (check required fields)
- **422 Unprocessable Entity**: Validation errors (check field formats)
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Channex server error