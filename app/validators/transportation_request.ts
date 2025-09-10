import vine from '@vinejs/vine'

export const createTransportationRequestValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive().optional(),
    guestId: vine.number().positive(),
    reservationId: vine.number().positive().optional(),
    transportationModeId: vine.number().positive(),
    scheduledDateTime: vine.string(),
    serviceType: vine.enum(['Pickup', 'Dropoff']),
    locationType: vine.enum(['Airport', 'Train Station', 'Hotel', 'Local Address']),
    pickupPoint: vine.string().trim().minLength(1),
    dropoffPoint: vine.string().trim().minLength(1),
    flightTrainNumber: vine.string().trim().optional(),
    airlineTrainCompany: vine.string().trim().optional(),
    numberOfPassengers: vine.number().positive(),
    numberOfLuggage: vine.number().min(0),
    specialRequirements: vine.string().trim().optional(),
    requestedBy: vine.string(),
    externalBookingReference: vine.string().trim().optional(),
    externalVehicleMatriculation: vine.string().trim().optional(),
    externalDriverName: vine.string().trim().optional(),
    externalVehicleColor: vine.string().trim().optional(),
    serviceFee: vine.number().min(0).optional(),
    folioId: vine.number().positive().optional(),
  })
)

export const updateTransportationRequestValidator = vine.compile(
  vine.object({
    scheduledDateTime: vine.date().optional(),
    serviceType: vine.enum(['Pickup', 'Dropoff']).optional(),
    locationType: vine.enum(['Airport', 'Train Station', 'Hotel', 'Local Address']).optional(),
    pickupPoint: vine.string().trim().minLength(1).optional(),
    dropoffPoint: vine.string().trim().minLength(1).optional(),
    flightTrainNumber: vine.string().trim().optional(),
    airlineTrainCompany: vine.string().trim().optional(),
    numberOfPassengers: vine.number().positive().optional(),
    numberOfLuggage: vine.number().min(0).optional(),
    specialRequirements: vine.string().trim().optional(),
    externalBookingReference: vine.string().trim().optional(),
    externalVehicleMatriculation: vine.string().trim().optional(),
    externalDriverName: vine.string().trim().optional(),
    externalVehicleColor: vine.string().trim().optional(),
    serviceFee: vine.number().min(0).optional(),
    status: vine.enum(['Pending', 'Assigned', 'En Route', 'Completed', 'Cancelled']).optional(),
  })
)
