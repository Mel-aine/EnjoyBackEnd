# API Externe EnjoyBackEnd — Consommée par Directus

> **Architecture :** Directus (via son extension `directus-endpoint-reservations`) appelle les API REST d'EnjoyBackEnd  
> **Objectif :** Remplacer Odoo 15 par EnjoyBackEnd comme backend PMS  
> **Projet :** [mellow/majeo-backend] ← appelle → [EnjoyBackEnd]

---

## 1. Architecture Cible

```
┌────────────────────────────────────────────────────┐
│                  Directus                          │
│  (Headless CMS + Extension reservations)           │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  directus-endpoint-reservations (extension)  │   │
│  │                                                     │
│  │  Endpoints exposés dans Directus :                 │
│  │  • POST /reservations/submit  (→ API Enjoy)       │
│  │  • Webhooks ← reçus de EnjoyBackEnd               │
│  │  • GET /enjoy/...  (données depuis Enjoy)          │
│  │  • PDF reports (générés localement)               │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Collections Directus :                             │
│  • reservations, chambres, disponibilites           │
│  • indisponibilites_planifiees                      │
└──────────────────────┬─────────────────────────────┘
                       │
                       │ Appels HTTP (REST API)
                       ▼
┌────────────────────────────────────────────────────┐
│              EnjoyBackEnd API                       │
│  (AdonisJS 6 - PMS complet)                       │
│                                                     │
│  Endpoints REST exposés :                          │
│  • /external/*      → API dédiées pour Directus     │
│  • /api/auth*       → Authentification             │
│  • /reservation/*   → Gestion réservations         │
│  • /guests/*        → Gestion clients               │
│  • /hotels/*        → Données hôtels               │
│  • /folios/*        → Facturation                  │
│  • Webhooks → notifications vers Directus          │
└────────────────────────────────────────────────────┘
```

**Principe :** L'extension Directus `directus-endpoint-reservations` **remplace ses appels à Odoo** par des appels aux API REST d'EnjoyBackEnd. EnjoyBackEnd devient le PMS backend unique.

---

## 2. API REST Exposées par EnjoyBackEnd

Tous les endpoints de ce document sont **authentifiés** via la clé POS de l’hôtel : `pos_api_key`.

**Base URL :** `https://enjoy-api.render.com` (ou votre instance)

**Swagger External API :**
- UI: `/swagger/external`
- JSON: `/swagger/external/json`

### 2.1 Authentification

Le client doit envoyer la clé dans l’en-tête HTTP :

```http
x-pos-api-key: <pos_api_key>
```

Cette clé est rattachée à un hôtel (champ `hotels.pos_api_key`) et permet d’authentifier l’intégration sans login/password.

Pour les endpoints `/external/*`, l’hôtel utilisé par le backend est déduit de `x-pos-api-key`. Quand l’URL contient `{hotelId}`, il doit correspondre à l’hôtel de la clé. Sur `POST /external/reservation/create`, un éventuel `hotelId`/`hotel_id` dans le body peut être envoyé, mais la valeur réellement utilisée reste celle portée par la clé API.

Pour les endpoints qui **créent/modifient** des données, il faut aussi fournir l’utilisateur “système” (celui qui sera utilisé pour les champs `created_by`, logs, etc.) :

```http
x-user-id: <userId>
```

Pour les endpoints d’écriture, `created_by` ou `createdBy` dans le body peut aussi être accepté comme fallback, mais `x-user-id` reste la forme recommandée.

Exemple :

```http
GET /external/configuration/hotels/47
x-pos-api-key: <pos_api_key>
```

---

### 2.2 Synchronisation des Hôtels / Configuration

#### GET la configuration complète d'un hôtel
```http
GET /external/configuration/hotels/{hotelId}
x-pos-api-key: <pos_api_key>

Response: {
  "id": 1,
  "hotelName": "Majeo",
  "hotelCode": "MJ001",
  "currencyCode": "XAF",
  "timezone": "Africa/Douala",
  "checkInTime": "14:00",
  "checkOutTime": "12:00",
  "totalRooms": 20,
  "totalFloors": 3,
  "status": "active",
  ...
}
```

#### GET les types de chambres
```http
GET /external/configuration/hotels/{hotelId}/room_types
x-pos-api-key: <pos_api_key>

Response: [
  {
    "id": 1,
    "roomTypeName": "Chambre Standard",
    "roomTypeCode": "STD",
    "maxOccupancy": 2,
    "description": "Chambre standard avec lit double",
    "baseRate": 50000,
    "status": "active",
    "totalRooms": 10
  },
  ...
]
```

#### GET les chambres
```http
GET /external/configuration/hotels/{hotelId}/rooms
x-pos-api-key: <pos_api_key>

Response: [
  {
    "id": 1,
    "roomNumber": "101",
    "floorNumber": 1,
    "roomTypeId": 1,
    "status": "available",
    "housekeepingStatus": "clean",
    "maxOccupancy": 2,
    "bedTypeId": 1,
    "shortCode": "101"
  },
  ...
]
```

#### GET les types de lits
```http
GET /external/configuration/hotels/{hotelId}/bed_types
x-pos-api-key: <pos_api_key>
```

#### GET les tarifs
```http
GET /external/configuration/hotels/{hotelId}/room_rates
x-pos-api-key: <pos_api_key>
```

#### GET les saisons
```http
GET /external/configuration/hotels/{hotelId}/seasons
x-pos-api-key: <pos_api_key>
```

#### GET les types de tarifs
```http
GET /external/configuration/hotels/{hotelId}/rate_types
x-pos-api-key: <pos_api_key>
```

#### GET les suppléments (extra charges)
```http
GET /external/configuration/hotels/{hotelId}/extra_charges
x-pos-api-key: <pos_api_key>
```

---

### 2.3 Synchronisation des Clients (Guests)

#### Rechercher un client
```http
GET /external/guests?search=Jean
x-pos-api-key: <pos_api_key>

Response: {
  "data": [
    {
      "id": 1,
      "firstName": "Jean",
      "lastName": "Dupont",
      "email": "jean@email.com",
      "phonePrimary": "+237600000001",
      "nationality": "CM",
      ...
    }
  ],
  "meta": { "total": 1 }
}
```

#### Créer un client
```http
POST /external/guests
x-pos-api-key: <pos_api_key>
x-user-id: <userId>
Content-Type: application/json

{
  "firstName": "Jean",
  "lastName": "Dupont",
  "email": "jean@email.com",
  "phonePrimary": "+237600000001",
  "nationality": "CM",
  "gender": "male",
  "idType": "passport",
  "idNumber": "CM123456"
}

Response: {
  "id": 1,
  "guestCode": "GST-00001",
  ...
}
```

#### Obtenir les détails d'un client
```http
GET /external/guests/{id}
x-pos-api-key: <pos_api_key>
```

---

### 2.4 Gestion des Disponibilités

#### Disponibilités (tous les types)
```http
GET /external/configuration/hotels/{hotelId}/rooms/availability-by-room-type?date_from=2026-06-25&date_to=2026-06-28
x-pos-api-key: <pos_api_key>

Response: {
  "success": true,
  "hotelId": 47,
  "date_from": "2026-06-25",
  "date_to": "2026-06-28",
  "data": [
    { "roomTypeId": 1, "roomTypeName": "Chambre Standard", "totalRooms": 10, "unavailableRooms": 3, "availableRooms": 7 }
  ]
}
```

#### Vérifier la disponibilité par type de chambre
```http
GET /external/configuration/hotels/{hotelId}/rooms/available-by-room-type/{roomTypeId}?date_from=2026-06-25&date_to=2026-06-28
x-pos-api-key: <pos_api_key>

Response: {
  "roomTypeId": 1,
  "roomTypeName": "Chambre Standard",
  "totalRooms": 10,
  "availableRooms": 7,
  "occupiedRooms": 3,
  "blockedRooms": 0,
  "dates": [
    { "date": "2026-06-25", "available": 8 },
    { "date": "2026-06-26", "available": 7 },
    { "date": "2026-06-27", "available": 7 }
  ]
}
```

#### Vérifier la disponibilité d'une chambre spécifique
```http
GET /external/configuration/hotels/{hotelId}/rooms/{roomId}/availability?date_from=2026-06-25&date_to=2026-06-28
x-pos-api-key: <pos_api_key>

Response: {
  "roomId": 1,
  "roomNumber": "101",
  "available": true,
  "conflictingReservations": []
}
```

#### Voir le statut housekeeping des chambres
```http
GET /external/configuration/hotels/{hotelId}/rooms/house-status
x-pos-api-key: <pos_api_key>
```

---

### 2.5 Création et Gestion des Réservations

#### Créer une réservation
```http
POST /external/reservation/create
x-pos-api-key: <pos_api_key>
x-user-id: <userId>
Content-Type: application/json

{
  "guestId": 1,
  "scheduledArrivalDate": "2026-06-25",
  "scheduledDepartureDate": "2026-06-28",
  "primaryRoomTypeId": 1,
  "numAdultsTotal": 2,
  "numChildrenTotal": 0,
  "bookingSourceId": 1,
  "rateTypeId": 1,
  "reservationStatus": "confirmed",
  "otaReservationCode": "DIR-20260625-0001",
  "otaName": "Directus",
  "specialNotes": "Client VIP"
}
```

**Ce qui a changé :**
- Le body accepte maintenant **camelCase** et **snake_case**.
- `ota_reservation_code` / `otaReservationCode` alimente **`reservation_number`** si `reservation_number` n’est pas déjà fourni.
- Si aucun `room_id` n’est envoyé, l’affectation de chambre utilise la même logique de service que la synchro Channex.
- Si une réservation existe déjà avec le même `reservation_number` dans le même hôtel, l’API retourne `409 Conflict`.
- `hotelId`/`hotel_id` dans le body n’est plus la source de vérité: l’hôtel vient de `x-pos-api-key`.

**Champs importants :**
- `x-pos-api-key` : obligatoire
- `x-user-id` : obligatoire pour cet endpoint
- `scheduledArrivalDate` / `arrived_date` : obligatoire
- `scheduledDepartureDate` / `depart_date` : obligatoire
- `guestId` / `guest_id` ou les champs guest (`firstName`, `lastName`, etc.) : nécessaire pour rattacher ou créer le client
- `primaryRoomTypeId` ou `rooms[].roomTypeId` : nécessaire pour créer la réservation et permettre l’auto-attribution

**Aliases acceptés les plus utiles :**

| Métier | camelCase accepté | snake_case accepté |
|---|---|---|
| Guest existant | `guestId` | `guest_id` |
| Date arrivée | `scheduledArrivalDate` | `arrived_date` |
| Date départ | `scheduledDepartureDate` | `depart_date` |
| Heure arrivée | `arrivedTime` | `arrived_time`, `check_in_time` |
| Heure départ | `departTime` | `depart_time`, `check_out_time` |
| Type de chambre principal | `primaryRoomTypeId` | `primary_room_type_id` |
| Source réservation | `bookingSourceId` | `booking_source` |
| Type de tarif | `rateTypeId`, `ratePlanId` | `rate_type_id`, `rate_plan_id` |
| Statut | `reservationStatus` | `reservation_status` |
| Référence OTA | `otaReservationCode` | `ota_reservation_code` |
| Notes | `specialNotes` | `special_requests` |

**Réponse en succès :**

```json
{
  "success": true,
  "message": "Reservation created successfully",
  "data": {
    "success": true,
    "message": "Reservation created successfully",
    "reservation": {
      "id": 123,
      "reservationNumber": "DIR-20260625-0001",
      "status": "confirmed"
    }
  }
}
```

**Réponse en doublon (`409 Conflict`) :**

```json
{
  "success": false,
  "message": "Reservation already exists: DIR-20260625-0001",
  "data": {
    "id": 123,
    "reservation_number": "DIR-20260625-0001",
    "status": "confirmed"
  }
}
```

#### Exemple complet avec tous les champs utiles
```http
POST /external/reservation/create
x-pos-api-key: <pos_api_key>
x-user-id: <userId>
Content-Type: application/json

{
  "guestId": 1,
  "scheduledArrivalDate": "2026-06-25",
  "scheduledDepartureDate": "2026-06-28",
  "arrivedTime": "14:00",
  "departTime": "12:00",
  "bookingSourceId": 1,
  "businessSourceId": 2,
  "reservationStatus": "confirmed",
  "confirmationNumber": "CONF-20260625-0001",
  "otaName": "Directus",
  "otaReservationCode": "DIR-20260625-0001",
  "specialNotes": "Late arrival",
  "guestNotes": "Allergic to peanuts",
  "whatsappNumber": "+237600000001",
  "whatsappNotificationEnable": true,
  "paymentMethodId": 1,
  "paymentType": "cash",
  "billTo": "guest",
  "marketCodeId": 3,
  "tax_amount": 1500,
  "paid_amount": 10000,
  "final_amount": 46500,
  "bookingDate": "2026-06-20T09:30:00.000Z",
  "rooms": [
    {
      "roomTypeId": 1,
      "rateTypeId": 1,
      "mealPlanId": 2,
      "roomId": 101,
      "roomRate": 15000,
      "roomRateId": 55,
      "adultCount": 2,
      "childCount": 0,
      "taxIncludes": true,
      "mealPlanRateInclude": false,
      "taxes": 1500,
      "arrivingTo": "Douala",
      "goingTo": "Yaounde",
      "meansOfTransport": "car"
    }
  ]
}
```

#### Exemple complet si le guest n’existe pas encore
```http
POST /external/reservation/create
x-pos-api-key: <pos_api_key>
x-user-id: <userId>
Content-Type: application/json

{
  "firstName": "Jean",
  "lastName": "Dupont",
  "email": "jean@email.com",
  "phonePrimary": "+237600000001",
  "addressLine": "Rue 123",
  "city": "Douala",
  "country": "CM",
  "postalCode": "BP 1234",
  "language": "fr",
  "idType": "passport",
  "idNumber": "CM123456",
  "passportNumber": "P1234567",
  "companyName": "ACME SARL",
  "scheduledArrivalDate": "2026-06-25",
  "scheduledDepartureDate": "2026-06-28",
  "numAdultsTotal": 2,
  "numChildrenTotal": 1,
  "primaryRoomTypeId": 1,
  "otaReservationCode": "DIR-20260625-0002"
}
```

#### Créer une réservation avec auto-attribution de chambre
```http
POST /external/reservation/create
x-pos-api-key: <pos_api_key>
x-user-id: <userId>
Content-Type: application/json

{
  "guestId": 1,
  "scheduledArrivalDate": "2026-06-25",
  "scheduledDepartureDate": "2026-06-28",
  "primaryRoomTypeId": 1,
  "rateTypeId": 1,
  "otaReservationCode": "DIR-20260625-0003"
}
```

#### Obtenir les détails d'une réservation
```http
GET /external/reservation/{reservationId}/details
x-pos-api-key: <pos_api_key>

Response: {
  "id": 123,
  "reservationNumber": "RES-20260625-XXXXX",
  "confirmationCode": "CONF-12345",
  "status": "confirmed",
  "guest": { "id": 1, "firstName": "Jean", "lastName": "Dupont" },
  "rooms": [
    {
      "id": 1,
      "roomNumber": "101",
      "roomType": "Chambre Standard",
      "checkInDate": "2026-06-25",
      "checkOutDate": "2026-06-28",
      "status": "confirmed"
    }
  ],
  "folios": [
    {
      "id": 1,
      "folioNumber": "F-1-00000001",
      "balance": 150000,
      "totalCharges": 150000,
      "totalPayments": 0
    }
  ]
}
```

#### Obtenir les réservations pour une période
```http
GET /external/hotels/{hotelId}/reservation/search?date_from=2026-06-25&date_to=2026-06-28&status=confirmed
x-pos-api-key: <pos_api_key>
```

#### Obtenir les arrivées du jour
```http
GET /external/hotels/{hotelId}/reservation/arrivals?date=2026-06-25
x-pos-api-key: <pos_api_key>
```

#### Obtenir les départs du jour
```http
GET /external/hotels/{hotelId}/reservation/departures?date=2026-06-25
x-pos-api-key: <pos_api_key>
```

#### Effectuer un check-in
```http
POST /external/reservation/{reservationId}/checkin
x-pos-api-key: <pos_api_key>
x-user-id: <userId>
Content-Type: application/json

{
  "roomId": 101
}
```

#### Effectuer un check-out
```http
POST /external/reservation/{reservationId}/check-out
x-pos-api-key: <pos_api_key>
x-user-id: <userId>
```

#### Ajouter un paiement sur une réservation
```http
POST /external/reservation/{reservationId}/payment
x-pos-api-key: <pos_api_key>
x-user-id: <userId>
Content-Type: application/json

{
  "amount": 10000,
  "paymentMethodId": 1,
  "reference": "CASH-001",
  "description": "Paiement espece",
  "currencyCode": "XAF"
}
```

Notes :
- Le client externe n’a pas besoin de connaître le `folioId`.
- Le backend retrouve la réservation, récupère un folio ouvert ou en crée un automatiquement si nécessaire.
- Le paiement est ensuite posté comme transaction de type `payment` sur ce folio.

#### Annuler une réservation
```http
POST /external/reservation/{reservationId}/cancel
x-pos-api-key: <pos_api_key>
x-user-id: <userId>
Content-Type: application/json

{
  "reason": "Annulé par le client",
  "cancellationFee": 0
}
```

---

### 2.6 Attribution de Chambre

#### Assigner une chambre à une réservation
```http
POST /external/reservation/{reservationId}/assign-room
x-pos-api-key: <pos_api_key>
x-user-id: <userId>
Content-Type: application/json

{
  "roomId": 101,
  "roomTypeId": 1,
  "checkInDate": "2026-06-25",
  "checkOutDate": "2026-06-28"
}
```

#### Désassigner une chambre
```http
POST /external/reservation/{reservationId}/unassign-room
x-pos-api-key: <pos_api_key>
x-user-id: <userId>
Content-Type: application/json

{
  "reservationRoomId": 5
}
```

---

### 2.7 Blocs de Chambres (Room Blocks)

#### Créer un bloc (maintenance, indisponibilité)
```http
POST /external/room-blocks
x-pos-api-key: <pos_api_key>
x-user-id: <userId>
Content-Type: application/json

{
  "hotelId": 1,
  "roomId": 101,
  "blockFromDate": "2026-07-01",
  "blockToDate": "2026-07-03",
  "reason": "Maintenance",
  "status": "active"
}
```

#### Lever un bloc
```http
DELETE /external/room-blocks/{id}
x-pos-api-key: <pos_api_key>
x-user-id: <userId>
```

#### Liste des blocs
```http
GET /external/room-blocks/{hotelId}
x-pos-api-key: <pos_api_key>
```

---

### 2.8 Facturation (Folios)

#### Créer un folio pour une réservation
```http
POST /external/folios/reservation
x-pos-api-key: <pos_api_key>
x-user-id: <userId>
Content-Type: application/json

{
  "reservationId": 123,
  "hotelId": 1,
  "folioType": "guest",
  "createdBy": 1
}
```

#### Ajouter une transaction
```http
POST /external/folios/transactions
x-pos-api-key: <pos_api_key>
x-user-id: <userId>
Content-Type: application/json

{
  "folioId": 1,
  "transactionType": "payment",
  "category": "payment",
  "description": "Paiement espece",
  "amount": 10000,
  "paymentMethodId": 1,
  "reference": "CASH-001"
}
```

Utiliser cet endpoint seulement si l’intégrateur connaît déjà le `folioId`. Sinon, préférer `POST /external/reservation/{reservationId}/payment`.

#### Obtenir le relevé d'un folio
```http
GET /external/folios/{folioId}/statement
x-pos-api-key: <pos_api_key>
```

---

### 2.9 Génération de Documents

#### Générer un PDF de confirmation de réservation
```http
POST /external/folio-print/print_confirm_booking-pdf
x-pos-api-key: <pos_api_key>
Content-Type: application/json

{
  "reservationId": 123,
  "hotelId": 1
}

Response: binary (PDF)
```

#### Générer une facture PDF
```http
POST /external/folio-print/print-pdf
x-pos-api-key: <pos_api_key>
Content-Type: application/json

{
  "folioId": 1,
  "hotelId": 1
}

Response: binary (PDF)
```

#### Envoyer la facture par email
```http
POST /external/folio-print/send-invoice-email
x-pos-api-key: <pos_api_key>
Content-Type: application/json

{
  "folioId": 1,
  "email": "client@email.com"
}
```

#### Générer le rapport de gestion (Manager Report) PDF
```http
POST /external/reports/statistics/management-report-pdf
x-pos-api-key: <pos_api_key>
x-user-id: <userId>
Content-Type: application/json

{
  "hotelId": 1,
  "auditDate": "2026-06-25",
  "currencyCode": "XAF"
}

Response: binary (PDF)
```

#### Générer le rapport d'audit de nuit PDF
```http
POST /external/reports/statistics/night-audit-report-pdf
x-pos-api-key: <pos_api_key>
x-user-id: <userId>
Content-Type: application/json

{
  "hotelId": 1,
  "auditDate": "2026-06-25"
}
```

---

### 2.10 Données pour Google Hotel Feed

#### Données complètes pour le feed Google
```http
GET /external/configuration/hotels/{hotelId}/rooms/views/details
x-pos-api-key: <pos_api_key>

Response: Liste des chambres avec leurs types et caractéristiques
```

```http
GET /external/configuration/hotels/{hotelId}/room_rates?date_from=...&date_to=...
x-pos-api-key: <pos_api_key>

Response: Tarifs par chambre et par date
```

```http
GET /external/dashboard/availability/{serviceId}
x-pos-api-key: <pos_api_key>

Response: Disponibilités et taux d'occupation
```

---

## 3. Modification de l'Extension Directus

### 3.1 Configuration

Dans l'extension Directus `directus-endpoint-reservations`, remplacer les variables Odoo par EnjoyBackEnd :

```javascript
// AVANT (Odoo)
const ODOO_URL = process.env.ODOO_URL
const ODOO_DB = process.env.ODOO_DB
const ODOO_API_KEY = process.env.ODOO_API_KEY

// APRÈS (EnjoyBackEnd)
const ENJOY_API_URL = process.env.ENJOY_API_URL || 'https://enjoy-api.render.com'
const ENJOY_POS_API_KEY = process.env.ENJOY_POS_API_KEY
```

Dans le `docker-compose.yml` (ou `.env`) du projet mellow :

```env
# Remplacer les variables Odoo
# ODOO_URL=http://odoo:8069
# ODOO_DB=majeo
# ODOO_API_KEY=xxxx

# Par les variables EnjoyBackEnd
ENJOY_API_URL=https://enjoy-api.render.com
ENJOY_POS_API_KEY=pos_xxxxx
```

### 3.2 Client API EnjoyBackEnd pour l'extension

```javascript
// enjoy-client.js — À ajouter dans l'extension Directus
class EnjoyApiClient {
  constructor(baseUrl, posApiKey) {
    this.baseUrl = baseUrl
    this.posApiKey = posApiKey
    this.defaultHeaders = {
      'x-pos-api-key': this.posApiKey,
      'Content-Type': 'application/json'
    }
  }

  async request(method, path, body = null, extraHeaders = {}) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        ...this.defaultHeaders,
        ...extraHeaders
      },
      body: body ? JSON.stringify(body) : undefined
    })
    if (!response.ok) {
      const err = await response.text().catch(() => 'Unknown error')
      throw new Error(`EnjoyAPI Error ${response.status}: ${err}`)
    }
    const contentType = response.headers.get('content-type')
    if (contentType && contentType.includes('application/json')) {
      return response.json()
    }
    return response  // Pour les PDFs
  }

  // === RÉSERVATIONS ===
  async checkAvailability(hotelId, roomTypeId, dateFrom, dateTo) {
    return this.request('GET',
      `/configuration/hotels/${hotelId}/rooms/available-by-room-type/${roomTypeId}` +
      `?date_from=${dateFrom}&date_to=${dateTo}`
    )
  }

  async createReservation(data, actorUserId) {
    return this.request('POST', '/reservation/create', data, {
      'x-user-id': String(actorUserId)
    })
  }

  async getReservationDetails(reservationId) {
    return this.request('GET', `/reservation/${reservationId}/details`)
  }

  async getArrivals(hotelId, date) {
    return this.request('GET', `/hotels/${hotelId}/reservation/arrivals?date=${date}`)
  }

  async getDepartures(hotelId, date) {
    return this.request('GET', `/hotels/${hotelId}/reservation/departures?date=${date}`)
  }

  async cancelReservation(reservationId, reason) {
    return this.request('POST', `/reservation/${reservationId}/cancel`, { reason })
  }

  async checkIn(reservationId, roomId) {
    return this.request('POST', `/reservation/${reservationId}/checkin`, { roomId })
  }

  async checkOut(reservationId) {
    return this.request('POST', `/reservation/${reservationId}/check-out`)
  }

  // === GUESTS ===
  async searchGuests(query, hotelId) {
    return this.request('GET', `/guests?search=${encodeURIComponent(query)}&hotelId=${hotelId}`)
  }

  async createGuest(data, actorUserId) {
    return this.request('POST', '/guests', data, {
      'x-user-id': String(actorUserId)
    })
  }

  async getGuest(id) {
    return this.request('GET', `/guests/${id}`)
  }

  // === HÔTEL ===
  async getRooms(hotelId) {
    return this.request('GET', `/configuration/hotels/${hotelId}/rooms`)
  }

  async getRoomTypes(hotelId) {
    return this.request('GET', `/configuration/hotels/${hotelId}/room_types`)
  }

  async getRoomRates(hotelId, dateFrom, dateTo) {
    return this.request('GET',
      `/configuration/hotels/${hotelId}/room_rates/date-range?date_from=${dateFrom}&date_to=${dateTo}`
    )
  }

  // === FOLIOS ===
  async createFolio(data) {
    return this.request('POST', '/folios/reservation', data)
  }

  async getFolioStatement(folioId) {
    return this.request('GET', `/folios/${folioId}/statement`)
  }

  // === DOCUMENTS ===
  async generateBookingPdf(reservationId, hotelId) {
    return this.request('POST', '/folio-print/print_confirm_booking-pdf', {
      reservationId, hotelId
    })
  }

  async generateInvoicePdf(folioId, hotelId) {
    return this.request('POST', '/folio-print/print-pdf', {
      folioId, hotelId
    })
  }

  async generateManagerReport(hotelId, auditDate, currencyCode) {
    return this.request('POST', '/api/reports/statistics/management-report-pdf', {
      hotelId, auditDate, currencyCode
    })
  }

  // === BLOCS ===
  async blockRoom(hotelId, roomId, fromDate, toDate, reason) {
    return this.request('POST', '/room-blocks', {
      hotelId, roomId,
      blockFromDate: fromDate,
      blockToDate: toDate,
      reason,
      status: 'active'
    })
  }

  async unblockRoom(blockId) {
    return this.request('DELETE', `/room-blocks/${blockId}`)
  }
}

module.exports = EnjoyApiClient
```

### 3.3 Modification de l'index.js de l'extension

Dans `extensions/directus-endpoint-reservations/dist/index.js` (ou sa source), remplacer les appels Odoo par EnjoyBackEnd :

```javascript
// AVANT (appel Odoo)
const odooRes = await fetch(`${ODOO_URL}/json/2/planning.slot`, {
  method: 'POST',
  body: JSON.stringify({ params: { ... } })
})

// APRÈS (appel EnjoyBackEnd)
const enjoy = new EnjoyApiClient(ENJOY_API_URL, ENJOY_POS_API_KEY)
const availability = await enjoy.checkAvailability(hotelId, roomTypeId, dateFrom, dateTo)
```

Pour la création de réservation :

```javascript
// AVANT (Odoo)
const odooRes = await fetch(`${ODOO_URL}/json/2/reservation`, {
  method: 'POST',
  body: JSON.stringify({ params: { ... } })
})

// APRÈS (EnjoyBackEnd)
const reservation = await enjoy.createReservation({
  guestId: data.guestId,
  primaryRoomTypeId: data.roomTypeId,
  scheduledArrivalDate: data.arrivalDate,
  scheduledDepartureDate: data.departureDate,
  numAdultsTotal: data.adults,
  numChildrenTotal: data.children || 0,
  bookingSourceId: 1,
  rateTypeId: data.rateTypeId,
  reservationStatus: 'confirmed',
  otaReservationCode: data.reservationNumber,
  otaName: 'Directus',
  specialNotes: data.notes || ''
}, SYSTEM_USER_ID)

// Stocker l'ID EnjoyBackEnd dans Directus
await reservationsService.createOne({
  enjoy_reservation_id: reservation.data?.reservation?.id,
  reservation_number: reservation.data?.reservation?.reservationNumber,
  confirmation_code: reservation.data?.reservation?.confirmationNumber,
  status: reservation.data?.reservation?.status,
  guest_name: data.guestName,
  arrival_date: data.arrivalDate,
  departure_date: data.departureDate,
  hotel_id: data.hotelId,
  // ...
})
```

---

## 4. Webhooks (EnjoyBackEnd → Directus)

EnjoyBackEnd peut notifier Directus en temps réel des changements via webhooks.

### 4.1 Webhook de changement de réservation

EnjoyBackEnd envoie une requête POST à Directus quand une réservation est modifiée :

```http
POST {DIRECTUS_URL}/webhooks/enjoy/reservation-update
Content-Type: application/json
X-Enjoy-Signature: hmac_sha256_signature

{
  "event": "reservation.created",
  "data": {
    "id": 123,
    "reservationNumber": "RES-20260625-XXXXX",
    "status": "confirmed",
    "guestId": 1,
    "hotelId": 1,
    "arrivalDate": "2026-06-25",
    "departureDate": "2026-06-28",
    "roomTypeId": 1,
    "roomId": 101
  }
}
```

**Événements disponibles :**
| Événement | Description |
|---|---|
| `reservation.created` | Nouvelle réservation |
| `reservation.updated` | Réservation modifiée (dates, chambre) |
| `reservation.cancelled` | Réservation annulée |
| `reservation.checked_in` | Check-in effectué |
| `reservation.checked_out` | Check-out effectué |
| `reservation.no_show` | No-show marqué |
| `room.status_changed` | Statut chambre modifié |
| `room.blocked` | Chambre bloquée |
| `room.unblocked` | Bloc levé |
| `night_audit.completed` | Audit de nuit terminé |

### 4.2 Configuration du webhook dans EnjoyBackEnd

Configuration à ajouter dans EnjoyBackEnd (par hôtel ou globale) :

```json
{
  "webhookUrl": "https://directus-instance.com/webhooks/enjoy",
  "webhookSecret": "shared-secret-for-hmac",
  "events": ["reservation.*", "room.status_changed"],
  "enabled": true
}
```

---

## 5. Résumé : Ce que Remplacent les API EnjoyBackEnd

| Odoo (actuel) | EnjoyBackEnd API (nouveau) |
|---|---|
| `ODOO_URL/json/2/planning.slot` | `GET /external/configuration/hotels/{id}/rooms/available-by-room-type/{roomTypeId}` |
| `ODOO_URL/json/2/reservation` (create) | `POST /external/reservation/create` |
| `ODOO_URL/json/2/reservation` (read) | `GET /external/reservation/{id}/details` |
| `ODOO_URL/json/2/res.partner` | `POST /external/guests` + `GET /external/guests` |
| `ODOO_URL/json/2/manager-report` | `POST /api/reports/statistics/management-report-pdf` |
| Webhooks Odoo | Webhooks EnjoyBackEnd (même principe HMAC) |
| PDF Odoo | PDF natifs EnjoyBackEnd (Puppeteer) |

---

## 6. Checklist de Mise en Place

- [ ] **Clé API (pos_api_key)** : Récupérer la valeur `hotels.pos_api_key` pour l’hôtel cible
- [ ] **Variables d'env** : Ajouter `ENJOY_API_URL` et `ENJOY_POS_API_KEY` dans le `.env` du projet mellow
- [ ] **Extension Directus** : Ajouter `enjoy-client.js` dans l'extension
- [ ] **Modifier index.js** : Remplacer les appels Odoo par `EnjoyApiClient`
- [ ] **Collections Directus** : Ajouter `enjoy_reservation_id` dans la collection `reservations`
- [ ] **Webhooks** : Configurer EnjoyBackEnd pour envoyer les webhooks vers Directus
- [ ] **Tests** : Vérifier que création, synchro, annulation fonctionnent
- [ ] **Google Feed** : Remplacer les appels Odoo par `enjoyClient.getRooms()` etc.
- [ ] **Odoo** : Arrêter Odoo, supprimer les variables d'env Odoo

---

## 7. Référence Rapide

| Méthode | Endpoint EnjoyBackEnd | Usage Directus |
|---|---|---|
| — | Header `x-pos-api-key: <pos_api_key>` | Authentification |
| GET | `/external/configuration/hotels/{hotelId}/rooms` | Synchroniser les chambres |
| GET | `/external/configuration/hotels/{hotelId}/room_types` | Types de chambres |
| GET | `/external/configuration/hotels/{hotelId}/rooms/available-by-room-type/{roomTypeId}` | Vérifier disponibilité |
| POST | `/external/reservation/create` | Créer une réservation |
| GET | `/external/reservation/{id}/details` | Détails réservation |
| POST | `/external/reservation/{id}/cancel` | Annuler réservation |
| POST | `/external/reservation/{id}/checkin` | Check-in |
| POST | `/external/reservation/{id}/check-out` | Check-out |
| POST | `/external/reservation/{id}/payment` | Ajouter un paiement à partir de la réservation |
| GET | `/external/hotels/{hotelId}/reservation/arrivals` | Arrivées du jour |
| GET | `/external/hotels/{hotelId}/reservation/departures` | Départs du jour |
| POST | `/external/guests` | Créer/Mettre à jour client |
| GET | `/external/guests?search=...` | Rechercher client |
| POST | `/external/room-blocks` | Bloquer chambre |
| DELETE | `/external/room-blocks/{id}` | Débloquer chambre |
| POST | `/external/folios/reservation` | Créer folio |
| POST | `/external/folio-print/print_confirm_booking-pdf` | PDF confirmation |
| POST | `/external/folio-print/print-pdf` | PDF facture |
| POST | `/api/reports/statistics/management-report-pdf` | Rapport de gestion PDF |
