# Automatic Folio Creation on Reservation Confirmation

## Overview

This document describes the automatic folio creation functionality that occurs when a reservation is confirmed. The system will create individual folios for each guest on the reservation and copy all room charge transactions from the primary guest's folio to each guest's folio.

## Functionality

When a reservation is confirmed (either during creation or by updating an existing reservation), the system will:

1. Create a primary folio for the reservation if one doesn't exist
2. Post room charges to the primary folio
3. Create individual folios for each guest on the reservation
4. Copy all room charge transactions from the primary guest's folio to each guest's folio

## Implementation Details

### Reservation Confirmation

Reservation confirmation can happen in two ways:

1. **Creating a new reservation with status 'confirmed'**
   - When a new reservation is created with status 'confirmed', the system will automatically create folios for all guests
   - This happens in the `saveReservation` method in `ReservationsController`

2. **Updating an existing reservation to status 'confirmed'**
   - When an existing reservation's status is updated to 'confirmed', the system will automatically create folios for all guests
   - This happens in the `update` method in `ReservationsController`

### Folio Creation Process

The folio creation process is handled by the `ReservationFolioService` class:

1. `createFoliosOnConfirmation` - Main method that orchestrates the folio creation process
   - Checks if the reservation is confirmed
   - Creates a primary folio if one doesn't exist
   - Posts room charges to the primary folio
   - Creates individual folios for all guests

2. `createIndividualFoliosForGuests` - Creates individual folios for each guest
   - Finds the primary guest's folio
   - Creates folios for all non-primary guests
   - Copies room charge transactions from the primary folio to each guest's folio

3. `postRoomCharges` - Posts room charges to a folio
   - Calculates room charges based on room rates and stay duration
   - Creates transaction records for each room charge

## API Endpoints

The following API endpoints will trigger automatic folio creation:

1. `POST /reservations` - When creating a new reservation with status 'confirmed'
2. `PUT /reservations/:id` - When updating an existing reservation to status 'confirmed'

## Response Format

When folios are created, the API response will include information about the created folios:

```json
{
  "success": true,
  "reservationId": 123,
  "confirmationNumber": "RES-2024-001",
  "primaryGuest": {
    "id": 1,
    "name": "John Doe",
    "email": "john.doe@example.com"
  },
  "totalGuests": 3,
  "guests": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john.doe@example.com"
    },
    {
      "id": 2,
      "name": "Jane Doe",
      "email": "jane.doe@example.com"
    },
    {
      "id": 3,
      "name": "Bob Smith",
      "email": "bob.smith@example.com"
    }
  ],
  "folios": [
    {
      "id": 1,
      "folioNumber": "F-2024-001",
      "guestId": 1,
      "folioType": "guest"
    },
    {
      "id": 2,
      "folioNumber": "F-2024-002",
      "guestId": 2,
      "folioType": "guest"
    },
    {
      "id": 3,
      "folioNumber": "F-2024-003",
      "guestId": 3,
      "folioType": "guest"
    }
  ],
  "message": "Reservation created successfully with 3 guest(s) and 3 folio(s) with room charges"
}
```

## Error Handling

If folio creation fails during reservation confirmation, the system will:

1. Log the error
2. Continue with the reservation confirmation process
3. Return a success response for the reservation confirmation
4. Include an error message in the response indicating that folio creation failed

This ensures that reservation confirmation is not blocked by folio creation failures.

## Testing

A test script is provided in `test_folio_creation.js` to demonstrate the functionality. This script shows how the system creates individual folios for each guest and copies room charge transactions from the primary guest's folio.