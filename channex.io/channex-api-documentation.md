# Channex.io API Documentation

Base URL: `https://docs.channex.io/`

Channex.io provides a comprehensive REST API for property management systems (PMS), channel managers, and online travel agencies (OTAs). This documentation covers all available API endpoints and their usage.

## Authentication

Channex.io uses API key authentication. Include your API key in the request headers:

```
user-api-key: YOUR_API_KEY
Content-Type: application/json
```

## API Reference

### [API Reference](https://docs.channex.io/api-v.1-documentation/api-reference)

**Purpose**: Core API documentation with authentication, error handling, pagination, and filtering guidelines.

**Key Features**:
- REST-based HTTP JSON API
- Supports GET, POST, PUT, DELETE operations
- Standard HTTP response codes (2xx success, 4xx client errors, 5xx server errors)
- Pagination support with `pagination[page]` and `pagination[limit]` parameters
- Filtering with comparison operators (gt, gte, lt, lte, eq, not)
- Order support with `order[field]=direction` parameters

**Usage**: Foundation for all API interactions, authentication setup, and error handling.

---

### [API Rate Limits](https://docs.channex.io/api-v.1-documentation/rate-limits)

**Purpose**: Information about API request rate limiting and throttling policies.

**Key Features**:
- Request rate limitations per API key
- Throttling mechanisms to prevent abuse
- Best practices for handling rate limit responses

**Usage**: Ensure your application respects rate limits to maintain API access.

---

### [Property Size Limits](https://docs.channex.io/api-v.1-documentation/property-size-limits)

**Purpose**: Maximum limits for rooms, rates, and other property-related resources.

**Key Features**:
- Maximum number of rooms per property
- Rate plan limitations
- Inventory constraints
- Retention period policies

**Usage**: Plan your property setup within the specified limits.

---

### [Properties Collection](https://docs.channex.io/api-v.1-documentation/hotels-collection)

**Purpose**: Manage hotel properties and their basic information.

**Key Features**:
- Create, read, update, delete properties
- Property details management (name, address, contact info)
- Property settings and configurations
- Multi-property support

**Common Endpoints**:
- `GET /api/v1/properties` - List all properties
- `GET /api/v1/properties/:id` - Get specific property
- `POST /api/v1/properties` - Create new property
- `PUT /api/v1/properties/:id` - Update property
- `DELETE /api/v1/properties/:id` - Delete property

**Usage**: Foundation for setting up and managing hotel properties in the system.

---

### [Property Users Collection](https://docs.channex.io/api-v.1-documentation/property-users-collection)

**Purpose**: Manage users associated with specific properties.

**Key Features**:
- User access control per property
- Role-based permissions
- User invitation and management
- Property-specific user settings

**Usage**: Control who has access to manage specific properties and their permission levels.

---

### [Groups Collection](https://docs.channex.io/api-v.1-documentation/groups-collection)

**Purpose**: Organize properties into groups for easier management.

**Key Features**:
- Property grouping and organization
- Group-level settings and configurations
- Bulk operations across property groups
- Hierarchical property management

**Usage**: Organize multiple properties under groups for streamlined management.

---

### [Group Users Collection](https://docs.channex.io/api-v.1-documentation/group-users-collection)

**Purpose**: Manage users at the group level with access to multiple properties.

**Key Features**:
- Group-level user management
- Multi-property access control
- Group administrator roles
- Inherited permissions

**Usage**: Manage users who need access to multiple properties within a group.

---

### [Room Types Collection](https://docs.channex.io/api-v.1-documentation/room-types-collection)

**Purpose**: Define and manage different types of accommodations (rooms, dorms, villas).

**Key Features**:
- Room type creation and management
- Occupancy settings (adults, children, infants)
- Room facilities and amenities
- Photo and description management
- Inventory count per room type

**Common Endpoints**:
- `GET /api/v1/room_types` - List room types
- `GET /api/v1/room_types/:id` - Get specific room type
- `POST /api/v1/room_types` - Create room type
- `PUT /api/v1/room_types/:id` - Update room type

**Request Example**:
```json
{
  "room_type": {
    "property_id": "716305c4-561a-4561-a187-7f5b8aeb5920",
    "title": "Standard Room",
    "count_of_rooms": 20,
    "occ_adults": 3,
    "occ_children": 0,
    "occ_infants": 0,
    "default_occupancy": 2,
    "room_kind": "room"
  }
}
```

**Usage**: Set up accommodation inventory and define room characteristics.

---

### [Rate Plans Collection](https://docs.channex.io/api-v.1-documentation/rate-plans-collection)

**Purpose**: Create and manage pricing strategies and rate plans.

**Key Features**:
- Rate plan creation and configuration
- Pricing models (per room, per person)
- Rate restrictions and policies
- Seasonal and promotional rates
- Currency management

**Usage**: Define pricing strategies and rate structures for different market segments.

---

### [Availability and Rates (ARI)](https://docs.channex.io/api-v.1-documentation/ari)

**Purpose**: Manage real-time availability, rates, and inventory restrictions.

**Key Features**:
- Real-time availability updates
- Dynamic pricing management
- Inventory restrictions (stop sell, minimum stay)
- Bulk ARI updates
- Date range operations

**Usage**: Core functionality for revenue management and inventory control.

---

### [Webhook Collection](https://docs.channex.io/api-v.1-documentation/webhook-collection)

**Purpose**: Set up real-time notifications for property and booking changes.

**Key Features**:
- Real-time push notifications
- Multiple event types (ARI changes, bookings, cancellations)
- Custom callback URLs
- Event filtering and masking
- Webhook management UI

**Supported Events**:
- `ari` - Availability, rates, and inventory changes
- `booking` - All booking changes
- `booking_new` - New bookings only
- `booking_modification` - Booking modifications
- `booking_cancellation` - Booking cancellations
- `message` - Real-time messaging
- `review` - New reviews

**Request Example**:
```json
{
  "webhook": {
    "property_id": "716305c4-561a-4561-a187-7f5b8aeb5920",
    "callback_url": "https://YOUR-WEBSITE.COM/api/push_message",
    "event_mask": "*",
    "is_active": true
  }
}
```

**Usage**: Receive real-time updates about property changes and booking activities.

---

### [Bookings Collection](https://docs.channex.io/api-v.1-documentation/bookings-collection)

**Purpose**: Retrieve and manage booking information from all connected channels.

**Key Features**:
- Booking retrieval and management
- Booking revision feed for real-time updates
- Guest information and preferences
- Payment and guarantee details
- Room and service breakdown
- Multi-channel booking consolidation

**Booking Structure**:
- Customer details and occupancy
- Room assignments and rates
- Payment information and guarantees
- Services and add-ons
- Arrival/departure information
- OTA-specific metadata

**Usage**: Central hub for managing all bookings from connected distribution channels.

---

### [Booking CRS API](https://docs.channex.io/api-v.1-documentation/booking-crs-api)

**Purpose**: Central Reservation System integration for direct bookings.

**Key Features**:
- Direct booking creation
- Reservation management
- Guest profile integration
- Payment processing integration
- Booking engine connectivity

**Usage**: Handle direct bookings and integrate with central reservation systems.

---

### [Channel API](https://docs.channex.io/api-v.1-documentation/channel-api)

**Purpose**: Manage connections to various distribution channels and OTAs.

**Key Features**:
- Channel connection management
- Mapping configuration
- Channel-specific settings
- Connection status monitoring
- Error handling and reporting

**Usage**: Set up and manage connections to booking platforms and OTAs.

---

### [Photos Collection](https://docs.channex.io/api-v.1-documentation/photos-collection)

**Purpose**: Manage property and room photos across all channels.

**Key Features**:
- Photo upload and management
- Multi-resolution support
- Photo categorization (room, amenity, exterior)
- Bulk photo operations
- Channel-specific photo distribution

**Usage**: Maintain visual content for properties and distribute to connected channels.

---

### [Hotel Policy Collection](https://docs.channex.io/api-v.1-documentation/hotel-policy-collection)

**Purpose**: Define and manage property policies and restrictions.

**Key Features**:
- Cancellation policies
- Check-in/check-out policies
- Age restrictions and requirements
- Pet policies
- Payment policies

**Usage**: Set up property-specific policies that apply across all distribution channels.

---

### [Facilities Collection](https://docs.channex.io/api-v.1-documentation/facilities-collection)

**Purpose**: Manage property and room amenities and facilities.

**Key Features**:
- Facility categorization
- Property-level amenities
- Room-level facilities
- Facility mapping to channels
- Custom facility creation

**Usage**: Define and manage amenities that enhance property appeal and guest experience.

---

### [Taxes and Tax Sets](https://docs.channex.io/api-v.1-documentation/taxes-and-tax-sets)

**Purpose**: Configure tax calculations and tax set management.

**Key Features**:
- Tax rate configuration
- Tax set creation and management
- Location-based tax rules
- Tax calculation methods
- Tax reporting integration

**Usage**: Set up proper tax calculations for different jurisdictions and booking scenarios.

---

### [Applications API](https://docs.channex.io/api-v.1-documentation/applications-api)

**Purpose**: Manage third-party application integrations.

**Key Features**:
- Application registration
- OAuth integration
- Permission management
- API access control
- Integration monitoring

**Usage**: Integrate third-party applications and manage their access permissions.

---

### [Messages Collection](https://docs.channex.io/api-v.1-documentation/messages-collection)

**Purpose**: Handle guest communication and messaging across channels.

**Key Features**:
- Multi-channel messaging
- Guest communication history
- Automated message handling
- Message templates
- Real-time message notifications

**Usage**: Centralize guest communication from all connected channels.

---

### [Reviews Collection](https://docs.channex.io/api-v.1-documentation/reviews-collection)

**Purpose**: Manage guest reviews and feedback from all channels.

**Key Features**:
- Review aggregation from all channels
- Review response management
- Review analytics and reporting
- Review notification system
- Review moderation tools

**Usage**: Monitor and respond to guest feedback across all distribution channels.

---

### [Availability Rules Collection](https://docs.channex.io/api-v.1-documentation/availability-rules-collection)

**Purpose**: Set up complex availability and booking rules.

**Key Features**:
- Minimum/maximum stay requirements
- Advance booking restrictions
- Day-of-week restrictions
- Seasonal availability rules
- Channel-specific rules

**Usage**: Implement sophisticated inventory management and booking restrictions.

---

### [Stripe Tokenization App](https://docs.channex.io/api-v.1-documentation/stripe-tokenization-app)

**Purpose**: Secure payment processing integration with Stripe.

**Key Features**:
- PCI-compliant payment handling
- Credit card tokenization
- Secure payment processing
- Payment method management
- Fraud protection integration

**Usage**: Process payments securely while maintaining PCI compliance.

---

### [Payment Application API](https://docs.channex.io/api-v.1-documentation/payment-application-api)

**Purpose**: General payment processing and financial transaction management.

**Key Features**:
- Multi-gateway payment support
- Payment method configuration
- Transaction monitoring
- Refund and chargeback handling
- Financial reporting integration

**Usage**: Manage various payment methods and financial transactions.

---

### [Channel Codes](https://docs.channex.io/api-v.1-documentation/channel-codes)

**Purpose**: Reference guide for channel identification codes and mappings.

**Key Features**:
- Channel identification codes
- OTA-specific code mappings
- Channel capability references
- Integration requirements per channel

**Usage**: Reference for identifying and working with specific distribution channels.

---

### [Channel IFrame](https://docs.channex.io/api-v.1-documentation/channel-iframe)

**Purpose**: Embed channel management interfaces within your application.

**Key Features**:
- Embeddable channel management UI
- Single sign-on integration
- Customizable interface elements
- Responsive design support

**Usage**: Provide channel management capabilities directly within your PMS interface.

---

### [PMS Certification Tests](https://docs.channex.io/api-v.1-documentation/pms-certification-tests)

**Purpose**: Certification requirements and testing procedures for PMS integrations.

**Key Features**:
- Integration testing requirements
- Certification test cases
- Performance benchmarks
- Compliance verification
- Certification process guidelines

**Usage**: Ensure your PMS integration meets Channex.io standards and requirements.

---

## Getting Started

1. **Sign up** for a staging account at https://staging.channex.io/
2. **Create an API key** in your user profile
3. **Set up a test property** with rooms and rates
4. **Use the Postman collection** for testing: https://documenter.getpostman.com/view/681982/RztkPpne
5. **Follow the PMS Guide** for integration steps
6. **Complete certification tests** when ready for production

## Support

For technical support and questions:
- Email: support@channex.io
- Documentation: https://docs.channex.io/
- Staging Server: https://staging.channex.io/

## Rate Limits and Best Practices

- Respect API rate limits to maintain access
- Use webhooks for real-time updates instead of polling
- Implement proper error handling and retry logic
- Use pagination for large data sets
- Filter requests to minimize data transfer
- Cache frequently accessed data when appropriate

This comprehensive API enables full property management system integration with Channex.io's channel management platform.