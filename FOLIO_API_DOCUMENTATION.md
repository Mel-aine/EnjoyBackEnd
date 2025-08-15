# Folio API Documentation

This document provides comprehensive documentation for all folio-related API endpoints, including request examples and response formats.

## Base URL
All endpoints are prefixed with `/api/folios` and require authentication.

## Authentication
All requests require a valid Bearer token in the Authorization header:
```
Authorization: Bearer <your-token>
```

---

## 1. Basic CRUD Operations

### 1.1 Get All Folios
**GET** `/api/folios`

Retrieve a paginated list of folios with optional filtering.

**Query Parameters:**
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 10)
- `search` (string, optional): Search by folio number, guest name, or email
- `hotel_id` (number, optional): Filter by hotel ID
- `guest_id` (number, optional): Filter by guest ID
- `reservation_id` (number, optional): Filter by reservation ID
- `folio_type` (string, optional): Filter by folio type
- `status` (string, optional): Filter by status
- `has_balance` (boolean, optional): Filter folios with/without balance
- `is_overdue` (boolean, optional): Filter overdue folios
- `date_from` (date, optional): Filter from date
- `date_to` (date, optional): Filter to date

**Example Request:**
```bash
curl -X GET "http://localhost:3333/api/folios?page=1&limit=10&hotel_id=1&status=open" \
  -H "Authorization: Bearer <token>"
```

**Example Response:**
```json
{
  "message": "Folios retrieved successfully",
  "data": {
    "data": [
      {
        "id": 1,
        "folio_number": "F001-2024-001",
        "hotel_id": 1,
        "guest_id": 1,
        "reservation_id": 1,
        "folio_type": "guest",
        "status": "open",
        "balance": 250.00,
        "opened_date": "2024-01-15T10:00:00.000Z",
        "hotel": {
          "id": 1,
          "name": "Grand Hotel"
        },
        "guest": {
          "id": 1,
          "first_name": "John",
          "last_name": "Doe",
          "email": "john.doe@example.com"
        }
      }
    ],
    "meta": {
      "total": 50,
      "per_page": 10,
      "current_page": 1,
      "last_page": 5
    }
  }
}
```

### 1.2 Create New Folio
**POST** `/api/folios`

Create a new folio using the service layer.

**Request Body:**
```json
{
  "hotelId": 1,
  "guestId": 1,
  "reservationId": 1,
  "folioType": "guest",
  "creditLimit": 1000.00,
  "notes": "VIP guest folio"
}
```

**Example Request:**
```bash
curl -X POST "http://localhost:3333/api/folios" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "hotelId": 1,
    "guestId": 1,
    "reservationId": 1,
    "folioType": "guest",
    "creditLimit": 1000.00,
    "notes": "VIP guest folio"
  }'
```

**Example Response:**
```json
{
  "message": "Folio created successfully",
  "data": {
    "id": 1,
    "folio_number": "F001-2024-001",
    "hotel_id": 1,
    "guest_id": 1,
    "reservation_id": 1,
    "folio_type": "guest",
    "status": "open",
    "settlement_status": "pending",
    "workflow_status": "active",
    "opened_date": "2024-01-15T10:00:00.000Z",
    "credit_limit": 1000.00,
    "balance": 0.00,
    "notes": "VIP guest folio"
  }
}
```

### 1.3 Get Specific Folio
**GET** `/api/folios/:id`

Retrieve detailed information about a specific folio including transactions.

**Example Request:**
```bash
curl -X GET "http://localhost:3333/api/folios/1" \
  -H "Authorization: Bearer <token>"
```

**Example Response:**
```json
{
  "message": "Folio retrieved successfully",
  "data": {
    "id": 1,
    "folio_number": "F001-2024-001",
    "hotel_id": 1,
    "guest_id": 1,
    "reservation_id": 1,
    "folio_type": "guest",
    "status": "open",
    "balance": 250.00,
    "total_charges": 300.00,
    "total_payments": 50.00,
    "opened_date": "2024-01-15T10:00:00.000Z",
    "hotel": {
      "id": 1,
      "name": "Grand Hotel"
    },
    "guest": {
      "id": 1,
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@example.com"
    },
    "transactions": [
      {
        "id": 1,
        "transaction_type": "charge",
        "category": "Room",
        "description": "Room charge - Deluxe Suite",
        "amount": 200.00,
        "transaction_date": "2024-01-15T14:00:00.000Z"
      }
    ]
  }
}
```

### 1.4 Update Folio
**PUT** `/api/folios/:id`

Update folio information.

**Request Body:**
```json
{
  "credit_limit": 1500.00,
  "notes": "Updated VIP guest folio",
  "guest_name": "John Smith"
}
```

**Example Request:**
```bash
curl -X PUT "http://localhost:3333/api/folios/1" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "credit_limit": 1500.00,
    "notes": "Updated VIP guest folio"
  }'
```

### 1.5 Delete Folio
**DELETE** `/api/folios/:id`

Delete a folio (only if no transactions exist).

**Example Request:**
```bash
curl -X DELETE "http://localhost:3333/api/folios/1" \
  -H "Authorization: Bearer <token>"
```

---

## 2. Folio Operations

### 2.1 Close Folio
**POST** `/api/folios/:id/close`

Close a folio for checkout.

**Request Body:**
```json
{
  "notes": "Guest checked out"
}
```

**Example Request:**
```bash
curl -X POST "http://localhost:3333/api/folios/1/close" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"notes": "Guest checked out"}'
```

### 2.2 Reopen Folio
**POST** `/api/folios/:id/reopen`

Reopen a closed folio.

**Request Body:**
```json
{
  "reason": "Guest returned, need to post additional charges"
}
```

**Example Request:**
```bash
curl -X POST "http://localhost:3333/api/folios/1/reopen" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Guest returned, need to post additional charges"}'
```

### 2.3 Transfer Charges
**POST** `/api/folios/:id/transfer`

Transfer charges between folios.

**Request Body:**
```json
{
  "to_folio_id": 2,
  "amount": 100.00,
  "description": "Transfer room charges to master folio"
}
```

**Example Request:**
```bash
curl -X POST "http://localhost:3333/api/folios/1/transfer" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "to_folio_id": 2,
    "amount": 100.00,
    "description": "Transfer room charges to master folio"
  }'
```

---

## 3. Service-Based Operations

### 3.1 Post Transaction
**POST** `/api/folios/transactions`

Post a transaction to a folio using the service layer.

**Request Body:**
```json
{
  "folioId": 1,
  "transactionType": "charge",
  "category": "Room",
  "description": "Room charge - Deluxe Suite",
  "amount": 200.00,
  "quantity": 1,
  "unitPrice": 200.00,
  "taxAmount": 20.00,
  "departmentId": 1,
  "reference": "ROOM-001",
  "notes": "Nightly room charge"
}
```

**Example Request:**
```bash
curl -X POST "http://localhost:3333/api/folios/transactions" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "folioId": 1,
    "transactionType": "charge",
    "category": "Room",
    "description": "Room charge - Deluxe Suite",
    "amount": 200.00,
    "taxAmount": 20.00
  }'
```

### 3.2 Settle Folio
**POST** `/api/folios/settle`

Settle folio payment using the service layer.

**Request Body:**
```json
{
  "folioId": 1,
  "paymentMethodId": 1,
  "amount": 250.00,
  "reference": "CC-1234",
  "notes": "Credit card payment"
}
```

**Example Request:**
```bash
curl -X POST "http://localhost:3333/api/folios/settle" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "folioId": 1,
    "paymentMethodId": 1,
    "amount": 250.00,
    "reference": "CC-1234"
  }'
```

### 3.3 Transfer Charges Between Folios
**POST** `/api/folios/transfer-charges`

Transfer charges between folios using the service layer.

**Request Body:**
```json
{
  "fromFolioId": 1,
  "toFolioId": 2,
  "amount": 100.00,
  "description": "Transfer to master folio",
  "reference": "TRANSFER-001"
}
```

**Example Request:**
```bash
curl -X POST "http://localhost:3333/api/folios/transfer-charges" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "fromFolioId": 1,
    "toFolioId": 2,
    "amount": 100.00,
    "description": "Transfer to master folio"
  }'
```

### 3.4 Close Folio with Service
**POST** `/api/folios/:id/close-service`

Close folio using the service layer.

**Example Request:**
```bash
curl -X POST "http://localhost:3333/api/folios/1/close-service" \
  -H "Authorization: Bearer <token>"
```

### 3.5 Reopen Folio with Service
**POST** `/api/folios/:id/reopen-service`

Reopen folio using the service layer.

**Example Request:**
```bash
curl -X POST "http://localhost:3333/api/folios/1/reopen-service" \
  -H "Authorization: Bearer <token>"
```

### 3.6 Get Statement with Service
**GET** `/api/folios/:id/statement-service`

Get folio statement using the service layer.

**Example Request:**
```bash
curl -X GET "http://localhost:3333/api/folios/1/statement-service" \
  -H "Authorization: Bearer <token>"
```

---

## 4. Folio Creation for Different Scenarios

### 4.1 Create Folio for Reservation
**POST** `/api/folios/reservation`

Create folio for an existing reservation.

**Request Body:**
```json
{
  "reservationId": 1,
  "folioType": "guest",
  "creditLimit": 1000.00,
  "notes": "Reservation folio"
}
```

**Example Request:**
```bash
curl -X POST "http://localhost:3333/api/folios/reservation" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "reservationId": 1,
    "folioType": "guest",
    "creditLimit": 1000.00
  }'
```

### 4.2 Create Folio for Walk-in Guest
**POST** `/api/folios/walk-in`

Create folio for a walk-in guest.

**Request Body:**
```json
{
  "hotelId": 1,
  "guestId": 1,
  "folioType": "guest",
  "creditLimit": 500.00,
  "notes": "Walk-in guest folio"
}
```

**Example Request:**
```bash
curl -X POST "http://localhost:3333/api/folios/walk-in" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "hotelId": 1,
    "guestId": 1,
    "folioType": "guest"
  }'
```

### 4.3 Create Folios for Group
**POST** `/api/folios/group`

Create multiple folios for a group reservation.

**Request Body:**
```json
{
  "reservationId": 1,
  "guestIds": [1, 2, 3, 4]
}
```

**Example Request:**
```bash
curl -X POST "http://localhost:3333/api/folios/group" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "reservationId": 1,
    "guestIds": [1, 2, 3, 4]
  }'
```

---

## 5. Automated Posting

### 5.1 Post Room Charges
**POST** `/api/folios/post-room-charges`

Automatically post room charges for a reservation.

**Request Body:**
```json
{
  "reservationId": 1
}
```

**Example Request:**
```bash
curl -X POST "http://localhost:3333/api/folios/post-room-charges" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"reservationId": 1}'
```

### 5.2 Post Taxes and Fees
**POST** `/api/folios/post-taxes-fees`

Automatically post taxes and fees for a reservation.

**Request Body:**
```json
{
  "reservationId": 1
}
```

**Example Request:**
```bash
curl -X POST "http://localhost:3333/api/folios/post-taxes-fees" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"reservationId": 1}'
```

---

## 6. Reservation Folio Management

### 6.1 Get Reservation Folios
**GET** `/api/folios/reservation/:reservationId`

Get all folios for a specific reservation.

**Example Request:**
```bash
curl -X GET "http://localhost:3333/api/folios/reservation/1" \
  -H "Authorization: Bearer <token>"
```

**Example Response:**
```json
{
  "message": "Reservation folios retrieved successfully",
  "data": [
    {
      "id": 1,
      "folio_number": "F001-2024-001",
      "folio_type": "guest",
      "status": "open",
      "balance": 250.00,
      "guest": {
        "id": 1,
        "first_name": "John",
        "last_name": "Doe"
      }
    }
  ]
}
```

---

## 7. Checkout and Settlement

### 7.1 Get Settlement Summary
**GET** `/api/folios/:id/settlement-summary`

Get settlement summary for a folio.

**Example Request:**
```bash
curl -X GET "http://localhost:3333/api/folios/1/settlement-summary" \
  -H "Authorization: Bearer <token>"
```

**Example Response:**
```json
{
  "message": "Settlement summary retrieved successfully",
  "data": {
    "folio_id": 1,
    "total_charges": 300.00,
    "total_payments": 50.00,
    "balance_due": 250.00,
    "taxes": 30.00,
    "service_charges": 20.00,
    "breakdown": {
      "room_charges": 200.00,
      "food_beverage": 50.00,
      "other_charges": 50.00
    }
  }
}
```

### 7.2 Get Checkout Summary
**GET** `/api/folios/:id/checkout-summary`

Get checkout summary for a folio.

**Example Request:**
```bash
curl -X GET "http://localhost:3333/api/folios/1/checkout-summary" \
  -H "Authorization: Bearer <token>"
```

### 7.3 Process Checkout
**POST** `/api/folios/checkout`

Process folio checkout.

**Request Body:**
```json
{
  "folioId": 1,
  "paymentMethodId": 1,
  "paymentAmount": 250.00,
  "paymentReference": "CC-1234",
  "notes": "Checkout payment"
}
```

**Example Request:**
```bash
curl -X POST "http://localhost:3333/api/folios/checkout" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "folioId": 1,
    "paymentMethodId": 1,
    "paymentAmount": 250.00,
    "paymentReference": "CC-1234"
  }'
```

### 7.4 Process Reservation Checkout
**POST** `/api/folios/reservation-checkout`

Process checkout for all folios in a reservation.

**Request Body:**
```json
{
  "reservationId": 1,
  "payments": [
    {
      "paymentMethodId": 1,
      "paymentAmount": 500.00,
      "paymentReference": "CC-1234"
    }
  ]
}
```

**Example Request:**
```bash
curl -X POST "http://localhost:3333/api/folios/reservation-checkout" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "reservationId": 1,
    "payments": [
      {
        "paymentMethodId": 1,
        "paymentAmount": 500.00,
        "paymentReference": "CC-1234"
      }
    ]
  }'
```

### 7.5 Force Close Folio
**POST** `/api/folios/force-close`

Force close a folio (administrative action).

**Request Body:**
```json
{
  "folioId": 1,
  "reason": "Guest dispute resolved, closing folio",
  "authorizedBy": 1
}
```

**Example Request:**
```bash
curl -X POST "http://localhost:3333/api/folios/force-close" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "folioId": 1,
    "reason": "Guest dispute resolved, closing folio",
    "authorizedBy": 1
  }'
```

### 7.6 Validate Checkout
**GET** `/api/folios/:id/validate-checkout`

Validate if a folio is eligible for checkout.

**Example Request:**
```bash
curl -X GET "http://localhost:3333/api/folios/1/validate-checkout" \
  -H "Authorization: Bearer <token>"
```

**Example Response:**
```json
{
  "message": "Checkout validation completed",
  "data": {
    "eligible": true,
    "balance_due": 250.00,
    "warnings": [],
    "errors": []
  }
}
```

---

## 8. Folio Inquiry and Views

### 8.1 Get Guest View
**GET** `/api/folios/:id/guest-view`

Get limited folio view for guests.

**Query Parameters:**
- `include_sensitive` (boolean, optional): Include sensitive information

**Example Request:**
```bash
curl -X GET "http://localhost:3333/api/folios/1/guest-view" \
  -H "Authorization: Bearer <token>"
```

### 8.2 Get Staff View
**GET** `/api/folios/:id/staff-view`

Get comprehensive folio view for staff.

**Example Request:**
```bash
curl -X GET "http://localhost:3333/api/folios/1/staff-view" \
  -H "Authorization: Bearer <token>"
```

### 8.3 Search Folios
**GET** `/api/folios/search`

Advanced folio search with multiple filters.

**Query Parameters:**
- `query` (string): Search term
- `hotel_id` (number): Hotel filter
- `date_from` (date): Date range start
- `date_to` (date): Date range end
- `status` (string): Status filter
- `folio_type` (string): Type filter
- `has_balance` (boolean): Balance filter
- `guest_name` (string): Guest name filter
- `folio_number` (string): Folio number filter

**Example Request:**
```bash
curl -X GET "http://localhost:3333/api/folios/search?query=john&hotel_id=1&status=open" \
  -H "Authorization: Bearer <token>"
```

### 8.4 Search Transactions
**GET** `/api/folios/transactions/search`

Search folio transactions.

**Query Parameters:**
- `folio_id` (number): Folio filter
- `transaction_type` (string): Transaction type filter
- `category` (string): Category filter
- `date_from` (date): Date range start
- `date_to` (date): Date range end
- `amount_min` (number): Minimum amount
- `amount_max` (number): Maximum amount

**Example Request:**
```bash
curl -X GET "http://localhost:3333/api/folios/transactions/search?folio_id=1&transaction_type=charge" \
  -H "Authorization: Bearer <token>"
```

### 8.5 Get Timeline
**GET** `/api/folios/:id/timeline`

Get folio activity timeline.

**Example Request:**
```bash
curl -X GET "http://localhost:3333/api/folios/1/timeline" \
  -H "Authorization: Bearer <token>"
```

**Example Response:**
```json
{
  "message": "Folio timeline retrieved successfully",
  "data": [
    {
      "timestamp": "2024-01-15T10:00:00.000Z",
      "event": "folio_created",
      "description": "Folio created for reservation",
      "user": "John Staff",
      "details": {
        "folio_number": "F001-2024-001"
      }
    },
    {
      "timestamp": "2024-01-15T14:00:00.000Z",
      "event": "transaction_posted",
      "description": "Room charge posted",
      "user": "System",
      "details": {
        "amount": 200.00,
        "category": "Room"
      }
    }
  ]
}
```

### 8.6 Get Advanced Statistics
**GET** `/api/folios/statistics-advanced`

Get advanced folio statistics.

**Query Parameters:**
- `hotel_id` (number): Hotel filter
- `date_from` (date): Date range start
- `date_to` (date): Date range end
- `group_by` (string): Grouping option

**Example Request:**
```bash
curl -X GET "http://localhost:3333/api/folios/statistics-advanced?hotel_id=1&date_from=2024-01-01&date_to=2024-01-31" \
  -H "Authorization: Bearer <token>"
```

---

## 9. Reports

### 9.1 Get Folio Balance
**GET** `/api/folios/:id/balance`

Get current folio balance.

**Example Request:**
```bash
curl -X GET "http://localhost:3333/api/folios/1/balance" \
  -H "Authorization: Bearer <token>"
```

**Example Response:**
```json
{
  "message": "Folio balance retrieved successfully",
  "data": {
    "folio_id": 1,
    "current_balance": 250.00,
    "total_charges": 300.00,
    "total_payments": 50.00,
    "total_adjustments": 0.00,
    "last_updated": "2024-01-15T16:30:00.000Z"
  }
}
```

### 9.2 Get Folio Statement
**GET** `/api/folios/:id/statement`

Get detailed folio statement.

**Example Request:**
```bash
curl -X GET "http://localhost:3333/api/folios/1/statement" \
  -H "Authorization: Bearer <token>"
```

**Example Response:**
```json
{
  "message": "Folio statement retrieved successfully",
  "data": {
    "folio": {
      "id": 1,
      "folio_number": "F001-2024-001",
      "guest_name": "John Doe",
      "check_in_date": "2024-01-15",
      "check_out_date": "2024-01-17"
    },
    "transactions": [
      {
        "date": "2024-01-15",
        "description": "Room charge - Deluxe Suite",
        "charges": 200.00,
        "payments": 0.00,
        "balance": 200.00
      },
      {
        "date": "2024-01-16",
        "description": "Restaurant charge",
        "charges": 50.00,
        "payments": 0.00,
        "balance": 250.00
      }
    ],
    "summary": {
      "total_charges": 300.00,
      "total_payments": 50.00,
      "balance_due": 250.00
    }
  }
}
```

### 9.3 Get Statistics
**GET** `/api/folios/statistics`

Get folio statistics.

**Query Parameters:**
- `hotel_id` (number): Hotel filter
- `date_from` (date): Date range start
- `date_to` (date): Date range end

**Example Request:**
```bash
curl -X GET "http://localhost:3333/api/folios/statistics?hotel_id=1" \
  -H "Authorization: Bearer <token>"
```

**Example Response:**
```json
{
  "message": "Folio statistics retrieved successfully",
  "data": {
    "total_folios": 150,
    "open_folios": 45,
    "closed_folios": 105,
    "total_revenue": 45000.00,
    "outstanding_balance": 2500.00,
    "average_folio_value": 300.00,
    "by_type": {
      "guest": 120,
      "master": 20,
      "group": 10
    }
  }
}
```

---

## 10. Folio Transaction Management

All folio transaction endpoints are prefixed with `/api/folio-transactions`.

### 10.1 Get All Transactions
**GET** `/api/folio-transactions`

Retrieve all folio transactions with filtering.

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page
- `folio_id` (number): Filter by folio
- `transaction_type` (string): Filter by type
- `category` (string): Filter by category
- `date_from` (date): Date range start
- `date_to` (date): Date range end

**Example Request:**
```bash
curl -X GET "http://localhost:3333/api/folio-transactions?folio_id=1&transaction_type=charge" \
  -H "Authorization: Bearer <token>"
```

### 10.2 Create Transaction
**POST** `/api/folio-transactions`

Create a new folio transaction.

**Request Body:**
```json
{
  "folio_id": 1,
  "transaction_type": "charge",
  "category": "Food & Beverage",
  "description": "Restaurant dinner",
  "amount": 75.50,
  "quantity": 2,
  "unit_price": 37.75,
  "tax_amount": 7.55,
  "department_id": 2,
  "reference": "REST-001"
}
```

**Example Request:**
```bash
curl -X POST "http://localhost:3333/api/folio-transactions" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "folio_id": 1,
    "transaction_type": "charge",
    "category": "Food & Beverage",
    "description": "Restaurant dinner",
    "amount": 75.50
  }'
```

### 10.3 Get Transaction Details
**GET** `/api/folio-transactions/:id`

Get specific transaction details.

**Example Request:**
```bash
curl -X GET "http://localhost:3333/api/folio-transactions/1" \
  -H "Authorization: Bearer <token>"
```

### 10.4 Update Transaction
**PUT** `/api/folio-transactions/:id`

Update a transaction.

**Request Body:**
```json
{
  "description": "Updated restaurant dinner",
  "amount": 80.00,
  "notes": "Updated amount after review"
}
```

**Example Request:**
```bash
curl -X PUT "http://localhost:3333/api/folio-transactions/1" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Updated restaurant dinner",
    "amount": 80.00
  }'
```

### 10.5 Delete Transaction
**DELETE** `/api/folio-transactions/:id`

Delete a transaction.

**Example Request:**
```bash
curl -X DELETE "http://localhost:3333/api/folio-transactions/1" \
  -H "Authorization: Bearer <token>"
```

### 10.6 Void Transaction
**POST** `/api/folio-transactions/:id/void`

Void a transaction.

**Request Body:**
```json
{
  "reason": "Customer complaint - meal not delivered",
  "notes": "Voided per manager approval"
}
```

**Example Request:**
```bash
curl -X POST "http://localhost:3333/api/folio-transactions/1/void" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Customer complaint - meal not delivered"
  }'
```

### 10.7 Refund Transaction
**POST** `/api/folio-transactions/:id/refund`

Refund a transaction.

**Request Body:**
```json
{
  "amount": 75.50,
  "reason": "Service issue - partial refund",
  "payment_method_id": 1,
  "notes": "Refunded to original payment method"
}
```

**Example Request:**
```bash
curl -X POST "http://localhost:3333/api/folio-transactions/1/refund" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 75.50,
    "reason": "Service issue - partial refund",
    "payment_method_id": 1
  }'
```

### 10.8 Get Transaction Statistics
**GET** `/api/folio-transactions/statistics`

Get transaction statistics.

**Query Parameters:**
- `hotel_id` (number): Hotel filter
- `date_from` (date): Date range start
- `date_to` (date): Date range end
- `transaction_type` (string): Type filter

**Example Request:**
```bash
curl -X GET "http://localhost:3333/api/folio-transactions/statistics?hotel_id=1&transaction_type=charge" \
  -H "Authorization: Bearer <token>"
```

---

## Error Responses

All endpoints return consistent error responses:

### 400 Bad Request
```json
{
  "message": "Validation failed",
  "errors": [
    {
      "field": "amount",
      "message": "Amount must be a positive number"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "message": "Unauthorized access",
  "error": "Invalid or missing authentication token"
}
```

### 404 Not Found
```json
{
  "message": "Folio not found",
  "error": "No folio found with the provided ID"
}
```

### 500 Internal Server Error
```json
{
  "message": "Internal server error",
  "error": "An unexpected error occurred"
}
```

---

## Common Response Formats

### Success Response
```json
{
  "message": "Operation completed successfully",
  "data": {
    // Response data
  }
}
```

### Paginated Response
```json
{
  "message": "Data retrieved successfully",
  "data": {
    "data": [
      // Array of items
    ],
    "meta": {
      "total": 100,
      "per_page": 10,
      "current_page": 1,
      "last_page": 10,
      "first_page_url": "http://localhost:3333/api/folios?page=1",
      "last_page_url": "http://localhost:3333/api/folios?page=10",
      "next_page_url": "http://localhost:3333/api/folios?page=2",
      "prev_page_url": null
    }
  }
}
```

---

## Notes

1. **Authentication**: All endpoints require valid authentication tokens.
2. **Validation**: Request bodies are validated according to the defined validators.
3. **Transactions**: Most operations that modify data use database transactions for consistency.
4. **Permissions**: Some operations may require specific user permissions.
5. **Rate Limiting**: API calls may be subject to rate limiting.
6. **Timestamps**: All timestamps are in ISO 8601 format (UTC).
7. **Currency**: All monetary amounts are in the hotel's base currency.
8. **Decimal Precision**: Monetary amounts support up to 2 decimal places.

For additional support or questions about the Folio API, please contact the development team.