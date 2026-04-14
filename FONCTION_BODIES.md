# ReportsController - Documentation Postman

## 🔗 Base URL
```
http://localhost:3333/api/reports
```

---

## 📋 Endpoints Organisation

## 1️⃣ GENERAL ENDPOINTS

### GET / - Get All Available Report Types
```
GET /api/reports
```
**Authentification:** ✅ Requise (middleware.auth())
**Description:** Retourne la liste de tous les types de rapports disponibles

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "occupancyReport",
      "name": "Occupancy Report",
      "category": "Statistical"
    }
  ]
}
```

---

### POST /generate - Generate Any Report
```
POST /api/reports/generate
```
**Authentification:** ✅ Requise
**Content-Type:** `application/json`

**Request Body:**
```json
{
  "reportType": "arrivalList",
  "filters": {
    "hotelId": 1,
    "startDate": "2026-01-01",
    "endDate": "2026-12-31",
    "roomTypeId": 1,
    "guestId": null,
    "userId": null,
    "status": "confirmed",
    "departmentId": null,
    "bookingSourceId": null,
    "ratePlanId": null,
    "company": null,
    "travelAgent": null,
    "businessSource": null,
    "market": null,
    "rateFrom": null,
    "rateTo": null,
    "reservationType": null,
    "showAmount": "rent_per_night",
    "taxInclusive": false,
    "selectedColumns": ["roomNumber", "guestName", "checkIn", "checkOut"],
    "arrivalFrom": "2026-01-01",
    "arrivalTo": "2026-12-31",
    "roomType": null,
    "rateType": null,
    "user": null,
    "checkin": null
  }
}
```

**reportType Options:**
- `arrivalList` - Arrivées prévues
- `departureList` - Départs prévus
- `confirmedReservations` - Réservations confirmées
- `cancelledReservations` - Réservations annulées
- `noShowReservations` - No-show
- `reservationForecast` - Prévisions de réservation
- `voidReservations` - Réservations annulées
- `guestCheckedIn` - Clients enregistrés
- `guestCheckedOut` - Clients partis
- `roomAvailability` - Disponibilité des chambres
- `roomStatus` - Statut des chambres
- `taskList` - Liste des tâches
- `revenueReport` - Rapport de revenu
- `expenseReport` - Rapport des frais
- `cashierReport` - Rapport caissier
- `userActivityLog` - Journaux d'activité
- `occupancyReport` - Rapport d'occupation
- `adrReport` - Rapport ADR
- `revparReport` - Rapport RevPAR
- `marketSegmentAnalysis` - Analyse segments marché
- `sourceOfBusinessReport` - Rapport source d'affaires

**Response (200):**
```json
{
  "success": true,
  "data": {
    "title": "Arrival List",
    "generatedAt": "2026-03-01T10:30:00Z",
    "totalRecords": 25,
    "data": [
      {
        "roomNumber": "101",
        "guestName": "John Doe",
        "checkIn": "2026-03-01",
        "checkOut": "2026-03-05"
      }
    ]
  }
}
```

---

### POST /export - Export Report
```
POST /api/reports/export
```
**Authentification:** ✅ Requise
**Content-Type:** `application/json`

**Request Body:**
```json
{
  "reportType": "arrivalList",
  "format": "csv",
  "filters": {
    "hotelId": 1,
    "startDate": "2026-01-01",
    "endDate": "2026-12-31"
  }
}
```

**format Options:** `csv` | `pdf` | `excel`

**Response (200):**
- Fichier téléchargeable (CSV, PDF ou Excel)

---

### POST /custom - Generate Custom Report
```
POST /api/reports/custom
```
**Authentification:** ✅ Requise

**Request Body:**
```json
{
  "tableName": "reservations",
  "selectedFields": ["id", "confirmation_code", "guest_id", "total_estimated_revenue"],
  "filters": {
    "hotelId": 1
  },
  "joins": [
    {
      "table": "guests",
      "on": "reservations.guest_id = guests.id"
    }
  ],
  "groupBy": ["reservation_status"],
  "orderBy": [
    {
      "field": "created_at",
      "direction": "desc"
    }
  ]
}
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "confirmation_code": "CONF001",
      "guest": "John Doe",
      "totalRevenue": 500000
    }
  ]
}
```

---

### GET /templates - Get Report Templates
```
GET /api/reports/templates
```
**Authentification:** ✅ Requise

**Response (200):**
```json
{
  "success": true,
  "data": {
    "availableTables": [
      {
        "name": "reservations",
        "label": "Réservations"
      }
    ],
    "commonFields": {
      "reservations": ["id", "confirmation_code", "reservation_status"]
    },
    "joinOptions": [
      {
        "table": "guests",
        "on": "reservations.guest_id = guests.id"
      }
    ]
  }
}
```

---

### GET /stats - Get Report Statistics
```
GET /api/reports/stats?hotelId=1
```
**Authentification:** ✅ Requise
**Query Params:**
- `hotelId` (number) - Hotel ID

**Response (200):**
```json
{
  "success": true,
  "data": {
    "occupancy": {
      "current": 72.5,
      "max": 95.0,
      "min": 45.0
    },
    "revenue": {
      "total": 5000000,
      "average": 166666,
      "reservations": 30
    },
    "arrivals": {
      "today": 5,
      "totalRevenue": 1500000,
      "totalNights": 25
    }
  }
}
```

---

## 2️⃣ RESERVATION REPORTS

### POST /reservations/arrival-list
```
POST /api/reports/reservations/arrival-list
```
**Authentification:** ✅ Requise

**Request Body:**
```json
{
  "filters": {
    "hotelId": 1,
    "startDate": "2026-03-01",
    "endDate": "2026-03-31"
  }
}
```

**Response:** Arrival list data

---

### POST /reservations/departure-list
```
POST /api/reports/reservations/departure-list
```

---

### POST /reservations/confirmed
```
POST /api/reports/reservations/confirmed
```

---

### POST /reservations/cancelled
```
POST /api/reports/reservations/cancelled
```

---

### POST /reservations/no-show
```
POST /api/reports/reservations/no-show
```

---

### POST /reservations/forecast
```
POST /api/reports/reservations/forecast
```

---

### POST /reservations/void
```
POST /api/reports/reservations/void
```

---

### POST /reservation/arrivals
```
POST /api/reports/reservation/arrivals
```

---

### POST /reservation/departures
```
POST /api/reports/reservation/departures
```

---

### POST /reservation/arrivals-pdf
```
POST /api/reports/reservation/arrivals-pdf
```
**Download:** PDF file

---

### POST /reservation/departures-pdf
```
POST /api/reports/reservation/departures-pdf
```

---

### POST /reservation/cancelled-pdf
```
POST /api/reports/reservation/cancelled-pdf
```

---

### POST /reservation/void-pdf
```
POST /api/reports/reservation/void-pdf
```

---

## 3️⃣ EXPORT ENDPOINTS

### POST /exports/arrival-list
```
POST /api/reports/exports/arrival-list
```

---

### POST /exports/departure-list
```
POST /api/reports/exports/departure-list
```

---

### POST /exports/guest-checked-in
```
POST /api/reports/exports/guest-checked-in
```

---

### POST /exports/guest-checked-out
```
POST /api/reports/exports/guest-checked-out
```

---

### POST /exports/confirmed
```
POST /api/reports/exports/confirmed
```

---

### POST /exports/cancelled
```
POST /api/reports/exports/cancelled
```

---

### POST /exports/no-show
```
POST /api/reports/exports/no-show
```

---

### POST /exports/forecast
```
POST /api/reports/exports/forecast
```

---

### POST /exports/void
```
POST /api/reports/exports/void
```

---

## 4️⃣ FRONT OFFICE REPORTS

### POST /front-office/checked-in
```
POST /api/reports/front-office/checked-in
```
**Description:** Clients enregistrés

---

### POST /front-office/checked-out
```
POST /api/reports/front-office/checked-out
```
**Description:** Clients partis

---

### POST /front-office/room-availabilitys
```
POST /api/reports/front-office/room-availabilitys
```
**Description:** Disponibilité des chambres

---

### POST /front-office/room-status
```
POST /api/reports/front-office/room-status
```
**Description:** Statut des chambres

---

### POST /front-office/tasks
```
POST /api/reports/front-office/tasks
```
**Description:** Liste des tâches

---

### POST /front-office/room-availability
```
POST /api/reports/front-office/room-availability
```
**Returns:** JSON data

---

### POST /front-office/room-availability-pdf
```
POST /api/reports/front-office/room-availability-pdf
```
**Download:** PDF file

---

### POST /front-office/rooms-status
```
POST /api/reports/front-office/rooms-status
```

---

### POST /front-office/rooms-status-pdf
```
POST /api/reports/front-office/rooms-status-pdf
```

---

### GET /front-office/inhouse-guests
```
GET /api/reports/front-office/inhouse-guests
```
**Description:** Clients actuellement à l'hôtel

**Response:**
```json
{
  "data": [
    {
      "roomId": 1,
      "roomNumber": "101",
      "guestName": "John Doe",
      "checkInDate": "2026-02-25",
      "checkOutDate": "2026-03-05"
    }
  ]
}
```

---

### GET /front-office/occupied-rooms
```
GET /api/reports/front-office/occupied-rooms
```
**Description:** Chambres occupées avec type de tarif

---

## 5️⃣ BACK OFFICE REPORTS

### POST /back-office/revenue
```
POST /api/reports/back-office/revenue
```
**Description:** Rapport de revenu

---

### POST /back-office/expenses
```
POST /api/reports/back-office/expenses
```
**Description:** Rapport des frais

---

### POST /back-office/cashier
```
POST /api/reports/back-office/cashier
```
**Description:** Rapport caissier

---

## 6️⃣ AUDIT REPORTS

### POST /audit/user-activity
```
POST /api/reports/audit/user-activity
```
**Description:** Journaux d'activité utilisateur

---

## 7️⃣ STATISTICAL REPORTS

### POST /statistics/occupancy
```
POST /api/reports/statistics/occupancy
```
**Description:** Rapport d'occupation

---

### POST /statistics/adr
```
POST /api/reports/statistics/adr
```
**Description:** Average Daily Rate

---

### POST /statistics/revpar
```
POST /api/reports/statistics/revpar
```
**Description:** Revenue Per Available Room

---

### POST /statistics/market-segments
```
POST /api/reports/statistics/market-segments
```
**Description:** Analyse par segments de marché

---

### POST /statistics/business-sources
```
POST /api/reports/statistics/business-sources
```
**Description:** Rapport source d'affaires

---

### GET /statistics/monthly-occupancy-pdf?hotelId=1&month=3&year=2026
```
GET /api/reports/statistics/monthly-occupancy-pdf
```
**Query Params:**
- `hotelId` (number) - required
- `month` (number) - 1-12
- `year` (number) - required

**Download:** PDF file - Monthly occupancy chart

---

### POST /statistics/room-status-report-pdf
```
POST /api/reports/statistics/room-status-report-pdf
```
**Request Body:**
```json
{
  "hotelId": 1,
  "asOnDate": "2026-03-01"
}
```
**Download:** PDF file

---

### POST /statistics/night-audit-report-pdf
```
POST /api/reports/statistics/night-audit-report-pdf
```
**Request Body:**
```json
{
  "hotelId": 1,
  "asOnDate": "2026-03-01",
  "currency": "XAF"
}
```
**Download:** PDF file - Detailed night audit report

---

### POST /statistics/management-report-pdf
```
POST /api/reports/statistics/management-report-pdf
```
**Request Body:**
```json
{
  "hotelId": 1,
  "asOnDate": "2026-03-01",
  "currency": "XAF"
}
```
**Download:** PDF file - Comprehensive management report

---

### POST /statistics/MealPlan-report-pdf
```
POST /api/reports/statistics/MealPlan-report-pdf
```
**Description:** Rapport du plan repas

---

### GET /statistics/revenue-by-rate-type
```
GET /api/reports/statistics/revenue-by-rate-type
```
**Query Params:**
- `hotelId` (number)
- `date` (date) - optional

---

### POST /statistics/revenue-by-rate-type-pdf
```
POST /api/reports/statistics/revenue-by-rate-type-pdf
```
**Request Body:**
```json
{
  "hotelId": 1,
  "date": "2026-03-01",
  "currency": "XAF"
}
```

---

### GET /statistics/revenue-by-room-type
```
GET /api/reports/statistics/revenue-by-room-type
```

---

### POST /statistics/revenue-by-room-type-pdf
```
POST /api/reports/statistics/revenue-by-room-type-pdf
```

---

### GET /statistics/monthly-revenue-pdf?hotelId=1&month=3&year=2026
```
GET /api/reports/statistics/monthly-revenue-pdf
```

---

### POST /statistics/payment-summary-pdf
```
POST /api/reports/statistics/payment-summary-pdf
```

---

### POST /statistics/revenue-by-rate-type-summary-pdf
```
POST /api/reports/statistics/revenue-by-rate-type-summary-pdf
```

---

### POST /statistics/statistics-by-room-type-pdf
```
POST /api/reports/statistics/statistics-by-room-type-pdf
```

---

### GET /statistics/business-analysis
```
GET /api/reports/statistics/business-analysis
```

---

### POST /statistics/business-analysis-pdf
```
POST /api/reports/statistics/business-analysis-pdf
```

---

### GET /statistics/contribution-analysis-report
```
GET /api/reports/statistics/contribution-analysis-report
```

---

### POST /statistics/contribution-analysis-report-pdf
```
POST /api/reports/statistics/contribution-analysis-report-pdf
```

---

### GET /statistics/monthly-country-wise-pax-analysis
```
GET /api/reports/statistics/monthly-country-wise-pax-analysis
```

---

### POST /statistics/monthly-country-wise-pax-analysis-pdf
```
POST /api/reports/statistics/monthly-country-wise-pax-analysis-pdf
```

---

### GET /statistics/monthly-revenue-by-income-stream
```
GET /api/reports/statistics/monthly-revenue-by-income-stream
```

---

### POST /statistics/monthly-revenue-by-income-stream-pdf
```
POST /api/reports/statistics/monthly-revenue-by-income-stream-pdf
```

---

### GET /statistics/monthly-statistics
```
GET /api/reports/statistics/monthly-statistics
```

---

### POST /statistics/monthly-statistics-pdf
```
POST /api/reports/statistics/monthly-statistics-pdf
```

---

### GET /statistics/monthly-summary
```
GET /api/reports/statistics/monthly-summary
```

---

### POST /statistics/monthly-summary-pdf
```
POST /api/reports/statistics/monthly-summary-pdf
```

---

### GET /statistics/monthly-tax
```
GET /api/reports/statistics/monthly-tax
```

---

### POST /statistics/monthly-tax-pdf
```
POST /api/reports/statistics/monthly-tax-pdf
```

---

### GET /statistics/room-sale-statistics
```
GET /api/reports/statistics/room-sale-statistics
```

---

### POST /statistics/room-sale-statistics-pdf
```
POST /api/reports/statistics/room-sale-statistics-pdf
```

---

### GET /statistics/room-statistics
```
GET /api/reports/statistics/room-statistics
```

---

### POST /statistics/room-statistics-pdf
```
POST /api/reports/statistics/room-statistics-pdf
```

---

### GET /statistics/room-on-books
```
GET /api/reports/statistics/room-on-books
```

---

### POST /statistics/room-on-books-pdf
```
POST /api/reports/statistics/room-on-books-pdf
```

---

### GET /statistics/yearly-statistics
```
GET /api/reports/statistics/yearly-statistics
```

---

### POST /statistics/yearly-statistics-pdf
```
POST /api/reports/statistics/yearly-statistics-pdf
```

---

### GET /statistics/performance-analysis-report
```
GET /api/reports/statistics/performance-analysis-report
```

---

### POST /statistics/performance-analysis-report-pdf
```
POST /api/reports/statistics/performance-analysis-report-pdf
```

---

### GET /statistics/ip-report
```
GET /api/reports/statistics/ip-report
```

---

### POST /statistics/ip-report-pdf
```
POST /api/reports/statistics/ip-report-pdf
```

---

### GET /statistics/city-ledger-detail
```
GET /api/reports/statistics/city-ledger-detail
```

---

### POST /statistics/city-ledger-detail-pdf
```
POST /api/reports/statistics/city-ledger-detail-pdf
```

---

### GET /statistics/city-ledger-summary
```
GET /api/reports/statistics/city-ledger-summary
```

---

### POST /statistics/city-ledger-summary-pdf
```
POST /api/reports/statistics/city-ledger-summary-pdf
```

---

### GET /statistics/payment-summary
```
GET /api/reports/statistics/payment-summary
```

---

### GET /statistics/daily-revenue-pdf
```
GET /api/reports/statistics/daily-revenue-pdf
```

---

### GET /statistics/daily-operations-report
```
GET /api/reports/statistics/daily-operations-report
```

---

### POST /statistics/daily-operations-report-pdf
```
POST /api/reports/statistics/daily-operations-report-pdf
```

---

### POST /statistics/folio-list
```
POST /api/reports/statistics/folio-list
```

---

### POST /statistics/audit
```
POST /api/reports/statistics/audit
```

---

### POST /statistics/guest-list
```
POST /api/reports/statistics/guest-list
```

---

### POST /statistics/void-charge
```
POST /api/reports/statistics/void-charge
```

---

### POST /statistics/void-payment
```
POST /api/reports/statistics/void-payment
```

---

### POST /statistics/void-transaction
```
POST /api/reports/statistics/void-transaction
```

---

## 8️⃣ PICKUP/DROPOFF & GUEST CHECKOUT

### POST /statistics/pickup-dropoff
```
POST /api/reports/statistics/pickup-dropoff
```

---

### POST /statistics/guest-checkout
```
POST /api/reports/statistics/guest-checkout
```

---

## 9️⃣ DAILY RECEIPT REPORTS

### POST /statistics/daily-receipt-summary
```
POST /api/reports/statistics/daily-receipt-summary
```

---

### POST /statistics/daily-receipt-refund-detail
```
POST /api/reports/statistics/daily-receipt-refund-detail
```

---

### POST /statistics/daily-receipt-detail
```
POST /api/reports/statistics/daily-receipt-detail
```

---

### POST /statistics/daily-receipt-summary-pdf
```
POST /api/reports/statistics/daily-receipt-summary-pdf
```

---

### POST /statistics/daily-receipt-detail-pdf
```
POST /api/reports/statistics/daily-receipt-detail-pdf
```

---

### POST /statistics/daily-receipt-refund-detail-pdf
```
POST /api/reports/statistics/daily-receipt-refund-detail-pdf
```

---

### POST /statistics/daily-receipt-revenue
```
POST /api/reports/statistics/daily-receipt-revenue
```

---

### POST /statistics/daily-receipt-revenue-pdf
```
POST /api/reports/statistics/daily-receipt-revenue-pdf
```

---

## 🔟 WORK ORDERS

### GET /work-orders
```
GET /api/reports/work-orders
```

---

### POST /work-orders/generate
```
POST /api/reports/work-orders/generate
```

---

### POST /work-orders/by-status
```
POST /api/reports/work-orders/by-status
```

---

### POST /work-orders/by-priority
```
POST /api/reports/work-orders/by-priority
```

---

### POST /work-orders/by-department
```
POST /api/reports/work-orders/by-department
```

---

### POST /work-orders/by-assignee
```
POST /api/reports/work-orders/by-assignee
```

---

### POST /work-orders/overdue
```
POST /api/reports/work-orders/overdue
```

---

### POST /work-orders/completed
```
POST /api/reports/work-orders/completed
```

---

### POST /work-orders/summary
```
POST /api/reports/work-orders/summary
```

---

## 1️⃣1️⃣ HOTEL HISTORIES

### GET /hotel-histories
```
GET /api/reports/hotel-histories
```

---

## 1️⃣2️⃣ RECEIPTS & INVOICES

### GET /receipt/:transactionId
```
GET /api/reports/receipt/:transactionId
```
**Params:**
- `transactionId` (number) - Transaction ID

**Download:** PDF receipt

---

### GET /invoice/:transactionId
```
GET /api/reports/invoice/:transactionId
```

---

### GET /company-receipt/:transactionId
```
GET /api/reports/company-receipt/:transactionId
```

---

### GET /company-voucher/:companyId
```
GET /api/reports/company-voucher/:companyId
```
**Params:**
- `companyId` (number) - Company ID

---

### POST /incidental-invoice
```
POST /api/reports/incidental-invoice
```
**Request Body:**
```json
{
  "folioId": 1,
  "chargeDetails": []
}
```

---

## 🔐 AUTHENTICATION
Tous les endpoints requièrent l'authentification sauf quelques GET publics.

**Headers requises:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

---

## 📊 COMMON FILTERS OBJECT

```json
{
  "hotelId": 1,
  "startDate": "2026-01-01",
  "endDate": "2026-12-31",
  "roomTypeId": 1,
  "guestId": null,
  "userId": null,
  "status": "confirmed",
  "departmentId": null,
  "bookingSourceId": null,
  "ratePlanId": null,
  "company": null,
  "travelAgent": null,
  "businessSource": null,
  "market": null,
  "rateFrom": null,
  "rateTo": null,
  "reservationType": null,
  "showAmount": "rent_per_night",
  "taxInclusive": false,
  "selectedColumns": ["roomNumber", "guestName"],
  "arrivalFrom": "2026-01-01",
  "arrivalTo": "2026-12-31"
}
```

---

## 📈 COMMON RESPONSE FORMAT

**Success (200):**
```json
{
  "success": true,
  "data": {}
}
```

**Error (400/500):**
```json
{
  "success": false,
  "message": "Error description",
  "error": "Error details"
}
```

---

## ⚙️ STATUS CODES
- `200` - Success
- `400` - Bad Request
- `401` - Unauthorized
- `500` - Internal Server Error
