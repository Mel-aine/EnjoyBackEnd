# POS API Documentation

This document provides comprehensive information on how to use the Point of Sale (POS) API endpoints for hotel management system integration.

## Base URL

All POS API endpoints are prefixed with `/pos`.

## Authentication

All POS endpoints require API key authentication. Include the API key in the request headers:

```
x-api-key: <your_api_key>
```

or

```
api-key: <your_api_key>
```

**Valid API Keys:**
- `POS_API_KEY` (from environment variables)
- `MASTER_API_KEY` (from environment variables)

## Error Responses

All endpoints return standardized error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error information"
}
```

**Common HTTP Status Codes:**
- `400` - Bad Request (missing or invalid parameters)
- `401` - Unauthorized (missing or invalid API key)
- `404` - Not Found (resource not found)
- `500` - Internal Server Error

## Endpoints

### 1. Get Hotel Information

Retrieve basic hotel information by hotel ID.

**Endpoint:** `GET /pos/hotels/:hotelId`

**Parameters:**
- `hotelId` (path parameter, required): The unique identifier of the hotel

**Example Request:**
```bash
curl -X GET "https://api.example.com/pos/hotels/123" \
  -H "x-api-key: your_api_key_here"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "hotelName": "Grand Hotel Example",
    "address": "123 Main Street",
    "city": "New York",
    "state": "NY",
    "country": "USA",
    "zipCode": "10001",
    "phone": "+1-555-0123",
    "email": "info@grandhotel.com",
    "website": "https://grandhotel.com",
    "currency": "USD",
    "timezone": "America/New_York",
    "checkInTime": "15:00",
    "checkOutTime": "11:00",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### 2. Get In-House Reservations

Retrieve all currently checked-in guests (in-house reservations) for a specific hotel.

**Endpoint:** `GET /pos/hotels/:hotelId/inhouse`

**Parameters:**
- `hotelId` (path parameter, required): The unique identifier of the hotel

**Example Request:**
```bash
curl -X GET "https://api.example.com/pos/hotels/123/inhouse" \
  -H "x-api-key: your_api_key_here"
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "guestName": "John Doe",
      "roomId": 101,
      "reservationRoomId": 456,
      "checkinDate": "2024-01-15",
      "checkoutDate": "2024-01-18",
      "hotelId": 123,
      "hotelNumber": "101A",
      "folioId": 789
    },
    {
      "guestName": "Jane Smith",
      "roomId": 102,
      "reservationRoomId": 457,
      "checkinDate": "2024-01-16",
      "checkoutDate": "2024-01-19",
      "hotelId": 123,
      "hotelNumber": "102B",
      "folioId": 790
    }
  ],
  "count": 2
}
```

**Response Fields:**
- `guestName`: Full name of the guest
- `roomId`: Unique identifier of the room
- `reservationRoomId`: Unique identifier of the reservation room record
- `checkinDate`: Check-in date (ISO date format)
- `checkoutDate`: Check-out date (ISO date format)
- `hotelId`: Hotel identifier
- `hotelNumber`: Room number/identifier
- `folioId`: Associated folio identifier

### 3. Post Room Transaction

Create a new transaction and post it to a guest's folio. This is typically used for POS charges like restaurant bills, spa services, etc.

**Endpoint:** `POST /pos/hotels/:hotelId/roomposting`

**Parameters:**
- `hotelId` (path parameter, required): The unique identifier of the hotel

**Request Body (JSON):**
```json
{
  "folioId": 789,
  "reservationRoomId": 456,
  "roomId": 101,
  "amount": 45.50,
  "description": "Restaurant - Dinner",
  "userName": "pos_user",
  "transactionDate": "2024-01-16T19:30:00Z"
}
```

**Required Fields:**
- `folioId` (number): The folio ID to post the transaction to
- `reservationRoomId` (number): The reservation room ID
- `roomId` (number): The room ID
- `amount` (number): Transaction amount (positive for charges)
- `description` (string): Description of the transaction
- `userName` (string): Username of the person creating the transaction

**Optional Fields:**
- `transactionDate` (string): ISO datetime string (defaults to current time)

**Example Request:**
```bash
curl -X POST "https://api.example.com/pos/hotels/123/roomposting" \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_api_key_here" \
  -d '{
    "folioId": 789,
    "reservationRoomId": 456,
    "roomId": 101,
    "amount": 45.50,
    "description": "Restaurant - Dinner",
    "userName": "pos_user",
    "transactionDate": "2024-01-16T19:30:00Z"
  }'
```

**Example Response:**
```json
{
  "success": true,
  "message": "Room posting transaction created successfully",
  "data": {
    "id": 1001,
    "folioId": 789,
    "reservationRoomId": 456,
    "roomId": 101,
    "hotelId": 123,
    "amount": 45.50,
    "description": "Restaurant - Dinner",
    "category": "posting",
    "type": "Room Posting",
    "transactionDate": "2024-01-16T19:30:00.000Z",
    "createdBy": "pos_user",
    "status": "completed",
    "createdAt": "2024-01-16T19:35:00.000Z",
    "updatedAt": "2024-01-16T19:35:00.000Z"
  }
}
```

## Integration Examples

### JavaScript/Node.js Example

```javascript
const axios = require('axios');

const API_BASE_URL = 'https://api.example.com/pos';
const API_KEY = 'your_api_key_here';

// Get hotel information
async function getHotelInfo(hotelId) {
  try {
    const response = await axios.get(`${API_BASE_URL}/hotels/${hotelId}`, {
      headers: {
        'x-api-key': API_KEY
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error getting hotel info:', error.response?.data || error.message);
    throw error;
  }
}

// Get in-house guests
async function getInHouseGuests(hotelId) {
  try {
    const response = await axios.get(`${API_BASE_URL}/hotels/${hotelId}/inhouse`, {
      headers: {
        'x-api-key': API_KEY
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error getting in-house guests:', error.response?.data || error.message);
    throw error;
  }
}

// Post room charge
async function postRoomCharge(hotelId, transactionData) {
  try {
    const response = await axios.post(`${API_BASE_URL}/hotels/${hotelId}/roomposting`, transactionData, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error posting room charge:', error.response?.data || error.message);
    throw error;
  }
}

// Usage example
async function main() {
  const hotelId = 123;
  
  // Get hotel info
  const hotelInfo = await getHotelInfo(hotelId);
  console.log('Hotel Info:', hotelInfo);
  
  // Get in-house guests
  const inHouseGuests = await getInHouseGuests(hotelId);
  console.log('In-house guests:', inHouseGuests);
  
  // Post a room charge
  const transactionData = {
    folioId: 789,
    reservationRoomId: 456,
    roomId: 101,
    amount: 25.00,
    description: 'Bar - Cocktails',
    userName: 'bar_pos'
  };
  
  const result = await postRoomCharge(hotelId, transactionData);
  console.log('Transaction posted:', result);
}
```

### Python Example

```python
import requests
import json

API_BASE_URL = 'https://api.example.com/pos'
API_KEY = 'your_api_key_here'

class POSClient:
    def __init__(self, base_url, api_key):
        self.base_url = base_url
        self.headers = {'x-api-key': api_key}
    
    def get_hotel_info(self, hotel_id):
        """Get hotel information"""
        url = f"{self.base_url}/hotels/{hotel_id}"
        response = requests.get(url, headers=self.headers)
        response.raise_for_status()
        return response.json()
    
    def get_inhouse_guests(self, hotel_id):
        """Get in-house guests"""
        url = f"{self.base_url}/hotels/{hotel_id}/inhouse"
        response = requests.get(url, headers=self.headers)
        response.raise_for_status()
        return response.json()
    
    def post_room_charge(self, hotel_id, transaction_data):
        """Post room charge to folio"""
        url = f"{self.base_url}/hotels/{hotel_id}/roomposting"
        headers = {**self.headers, 'Content-Type': 'application/json'}
        response = requests.post(url, headers=headers, json=transaction_data)
        response.raise_for_status()
        return response.json()

# Usage
client = POSClient(API_BASE_URL, API_KEY)

# Get hotel info
hotel_info = client.get_hotel_info(123)
print("Hotel Info:", hotel_info)

# Get in-house guests
guests = client.get_inhouse_guests(123)
print("In-house guests:", guests)

# Post room charge
transaction = {
    "folioId": 789,
    "reservationRoomId": 456,
    "roomId": 101,
    "amount": 35.75,
    "description": "Spa - Massage",
    "userName": "spa_pos"
}

result = client.post_room_charge(123, transaction)
print("Transaction result:", result)
```

## Best Practices

1. **Error Handling**: Always implement proper error handling for API calls
2. **Rate Limiting**: Be mindful of API rate limits (if any)
3. **Data Validation**: Validate all input data before sending requests
4. **Secure API Keys**: Store API keys securely and never expose them in client-side code
5. **Logging**: Log API interactions for debugging and audit purposes
6. **Retry Logic**: Implement retry logic for transient failures


## Changelog

### Version 1.0.0 (Current)
- Initial release with basic POS functionality
- Hotel information retrieval
- In-house guest listing
- Room transaction posting