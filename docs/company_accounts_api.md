# Company Accounts API Documentation

This document provides information on how to use the Company Accounts API endpoints.

## Base URL

All API endpoints are prefixed with `/api/configuration/company_accounts`.

## Authentication

All endpoints require authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer <your_token>
```

## Endpoints

### List Company Accounts

```
GET /api/configuration/company_accounts
```

**Query Parameters:**

- `filters`: JSON object for filtering results (optional)
- `page`: Page number for pagination (default: 1)
- `perPage`: Number of items per page (default: 20)
- `sortBy`: Field to sort by (default: 'id')
- `order`: Sort order, 'asc' or 'desc' (default: 'asc')

**Example Request:**

```
GET /api/configuration/company_accounts?page=1&perPage=10&sortBy=company_name&order=asc
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "meta": {
      "total": 25,
      "per_page": 10,
      "current_page": 1,
      "last_page": 3,
      "first_page": 1,
      "first_page_url": "/?page=1",
      "last_page_url": "/?page=3",
      "next_page_url": "/?page=2",
      "previous_page_url": null
    },
    "data": [
      {
        "id": 1,
        "hotel_id": 1,
        "company_name": "Acme Corporation",
        "company_code": "ACME",
        "account_type": "Corporate",
        "contact_person_name": "John Doe",
        "primary_email": "john.doe@acme.com",
        "primary_phone": "+1234567890",
        "address_line1": "123 Main St",
        "city": "New York",
        "state": "NY",
        "country": "USA",
        "postal_code": "10001",
        "tax_id": "TAX123456",
        "credit_limit": 10000,
        "current_balance": 0,
        "account_status": "Active",
        "credit_status": "Good",
        "preferred_currency": "USD",
        "created_at": "2023-01-01T00:00:00.000Z",
        "updated_at": "2023-01-01T00:00:00.000Z"
      },
      // More company accounts...
    ]
  }
}
```

### Create Company Account

```
POST /api/configuration/company_accounts
```

**Request Body:**

```json
{
  "hotel_id": 1,
  "company_name": "New Company Ltd",
  "company_code": "NEWCO",
  "account_type": "Corporate",
  "contact_person_name": "Jane Smith",
  "primary_email": "jane.smith@newcompany.com",
  "primary_phone": "+9876543210",
  "address_line1": "456 Business Ave",
  "city": "Chicago",
  "state": "IL",
  "country": "USA",
  "postal_code": "60601",
  "tax_id": "TAX654321",
  "credit_limit": 5000,
  "preferred_currency": "USD",
  "addToBusinessSource": true,
  "doNotCountAsCityLedger": false
}
```

**Special Fields:**

- `addToBusinessSource`: If set to `true`, a new business source will be created with the company's details.
- `doNotCountAsCityLedger`: If set to `false` (default), a city ledger payment method will be created for this company.

**Example Response:**

```json
{
  "success": true,
  "data": {
    "id": 2,
    "hotel_id": 1,
    "company_name": "New Company Ltd",
    "company_code": "NEWCO",
    // Other fields...
    "created_at": "2023-01-02T00:00:00.000Z",
    "updated_at": "2023-01-02T00:00:00.000Z"
  }
}
```

### Get Company Account Details

```
GET /api/configuration/company_accounts/:id
```

**Example Request:**

```
GET /api/configuration/company_accounts/1
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "hotel_id": 1,
    "company_name": "Acme Corporation",
    // Other fields...
    "created_at": "2023-01-01T00:00:00.000Z",
    "updated_at": "2023-01-01T00:00:00.000Z",
    "hotel": {
      "id": 1,
      "name": "Grand Hotel",
      // Hotel details...
    },
    "creator": {
      "id": 1,
      "name": "Admin User",
      // Creator details...
    },
    "modifier": {
      "id": 1,
      "name": "Admin User",
      // Modifier details...
    }
  }
}
```

### Update Company Account

```
PUT /api/configuration/company_accounts/:id
```

**Request Body:**

```json
{
  "company_name": "Updated Company Name",
  "primary_email": "new.email@company.com",
  "credit_limit": 7500,
  "addToBusinessSource": true,
  "doNotCountAsCityLedger": false
}
```

**Special Fields Behavior:**

- `addToBusinessSource`: If set to `true` and no business source exists for this company, a new one will be created.
- `doNotCountAsCityLedger`: 
  - If set to `true`, any existing city ledger payment method for this company will be deactivated.
  - If set to `false`, an existing city ledger payment method will be reactivated or a new one will be created if none exists.

**Example Response:**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "company_name": "Updated Company Name",
    "primary_email": "new.email@company.com",
    "credit_limit": 7500,
    // Other fields...
    "updated_at": "2023-01-03T00:00:00.000Z"
  }
}
```

### Delete Company Account

```
DELETE /api/configuration/company_accounts/:id
```

**Example Request:**

```
DELETE /api/configuration/company_accounts/1
```

**Example Response:**

```json
{
  "success": true,
  "message": "Company account deleted successfully"
}
```

**Note:** This performs a soft delete by setting the account status to "Closed".

### Get Company Accounts by Hotel

```
GET /api/configuration/company_accounts/hotel/:hotelId
```

**Example Request:**

```
GET /api/configuration/company_accounts/hotel/1
```

**Example Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "hotel_id": 1,
      "company_name": "Acme Corporation",
      // Other fields...
    },
    {
      "id": 2,
      "hotel_id": 1,
      "company_name": "New Company Ltd",
      // Other fields...
    }
    // More company accounts for this hotel...
  ]
}
```

### Get Active Company Accounts

```
GET /api/configuration/company_accounts/active
```

**Query Parameters:**

- `hotelId`: Filter by hotel ID (optional)

**Example Request:**

```
GET /api/configuration/company_accounts/active?hotelId=1
```

**Example Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "hotel_id": 1,
      "company_name": "Acme Corporation",
      "account_status": "Active",
      // Other fields...
    },
    // More active company accounts...
  ]
}
```

## Error Responses

### Not Found (404)

```json
{
  "success": false,
  "message": "Company account not found"
}
```

### Internal Server Error (500)

```json
{
  "success": false,
  "message": "Error fetching company accounts",
  "error": "Error details"
}
```

### Validation Error (422)

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "company_name": ["The company name field is required"]
  }
}
```