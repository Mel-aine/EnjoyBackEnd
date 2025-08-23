# Audit Trail Service Documentation

## Purpose and Functionality

The `AuditTrailService` provides a centralized way to query and retrieve activity logs from the system. It allows administrators and authorized users to track actions performed within the application, providing an audit trail for compliance, security, and troubleshooting purposes.

The service offers flexible querying capabilities, allowing users to filter logs by various criteria such as hotel, entity type, date range, user, and specific actions. This makes it easy to investigate specific activities or generate comprehensive reports.

## API Reference

### `getAuditTrail(options: AuditTrailQueryOptions)`

Retrieves activity logs based on the provided query options.

#### Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `hotelId` | number | The ID of the hotel to retrieve logs for. This is a mandatory parameter. |

#### Optional Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `entityIds` | number[] | Array of entity IDs to filter logs by. Only logs related to these entities will be returned. |
| `entityType` | string | Filter logs by entity type (e.g., 'Reservation', 'Guest', 'Room'). |
| `startDate` | string | Start date for filtering logs (inclusive). Must be a valid date string. |
| `endDate` | string | End date for filtering logs (inclusive). Must be a valid date string. |
| `userId` | number | Filter logs by the user who performed the action. |
| `action` | string | Filter logs by action type (e.g., 'CREATE', 'UPDATE', 'DELETE'). |
| `page` | number | Page number for pagination. Must be a positive number. |
| `perPage` | number | Number of records per page. Must be a positive number. |
| `sortBy` | string | Field to sort results by. Defaults to 'createdAt'. |
| `order` | 'asc' \| 'desc' | Sort order. Defaults to 'desc' (newest first). |

#### Return Value

The method returns a Promise that resolves to either:

- A paginated result object if pagination parameters are provided
- A query result with all matching activity logs if no pagination is specified

The returned activity logs include preloaded relationships for `user`, `creator`, and `hotel` to provide complete context for each log entry.

#### Example Response Structure

```json
{
  "data": [
    {
      "id": 123,
      "userId": 456,
      "username": "john.doe",
      "action": "UPDATE",
      "entityType": "Reservation",
      "entityId": 789,
      "description": "Updated reservation status to confirmed",
      "HotelId": 1,
      "changes": { "status": { "old": "pending", "new": "confirmed" } },
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "createdAt": "2023-06-15T14:30:45.123Z",
      "user": { /* User details */ },
      "creator": { /* Creator details */ },
      "hotel": { /* Hotel details */ }
    },
    // Additional log entries...
  ],
  "meta": {
    "total": 150,
    "per_page": 15,
    "current_page": 1,
    "last_page": 10,
    "first_page": 1,
    "first_page_url": "/?page=1",
    "last_page_url": "/?page=10",
    "next_page_url": "/?page=2",
    "previous_page_url": null
  }
}
```

## Error Handling

The `AuditTrailService` performs thorough validation of all input parameters and throws descriptive error messages when validation fails. Here are the possible error scenarios:

| Error Message | Cause |
|---------------|-------|
| "Hotel ID is required" | The `hotelId` parameter was not provided. |
| "Hotel ID must be a positive number" | The `hotelId` parameter is not a positive number. |
| "Entity IDs must be an array" | The `entityIds` parameter is provided but is not an array. |
| "All entity IDs must be positive numbers" | One or more values in the `entityIds` array are not positive numbers. |
| "Start date must be a valid date string" | The `startDate` parameter is not a valid date string. |
| "End date must be a valid date string" | The `endDate` parameter is not a valid date string. |
| "Page must be a positive number" | The `page` parameter is not a positive number. |
| "Per page must be a positive number" | The `perPage` parameter is not a positive number. |

When an error occurs, the service will throw an Error with the appropriate message. It's recommended to handle these errors in your application code using try-catch blocks.

## Example Usage Scenarios

### Basic Usage - Get All Logs for a Hotel

```typescript
import AuditTrailService from '#services/audit_trail_service'

async function getHotelLogs(hotelId: number) {
  try {
    const logs = await AuditTrailService.getAuditTrail({ hotelId })
    console.log(`Retrieved ${logs.length} logs for hotel ${hotelId}`)
    return logs
  } catch (error) {
    console.error('Error retrieving hotel logs:', error.message)
    throw error
  }
}
```

### Filtering by Entity Type and Date Range

```typescript
import AuditTrailService from '#services/audit_trail_service'

async function getReservationLogsForPeriod(hotelId: number, startDate: string, endDate: string) {
  try {
    const logs = await AuditTrailService.getAuditTrail({
      hotelId,
      entityType: 'Reservation',
      startDate,
      endDate
    })
    console.log(`Retrieved ${logs.length} reservation logs between ${startDate} and ${endDate}`)
    return logs
  } catch (error) {
    console.error('Error retrieving reservation logs:', error.message)
    throw error
  }
}
```

### Paginated Results with Sorting

```typescript
import AuditTrailService from '#services/audit_trail_service'

async function getUserActivityPaginated(hotelId: number, userId: number, page: number = 1, perPage: number = 20) {
  try {
    const paginatedLogs = await AuditTrailService.getAuditTrail({
      hotelId,
      userId,
      page,
      perPage,
      sortBy: 'createdAt',
      order: 'desc'
    })
    
    console.log(`Retrieved page ${page} of user ${userId} activity logs`)
    console.log(`Showing ${paginatedLogs.data.length} of ${paginatedLogs.meta.total} total logs`)
    
    return paginatedLogs
  } catch (error) {
    console.error('Error retrieving paginated user logs:', error.message)
    throw error
  }
}
```

### Tracking Changes to Specific Entities

```typescript
import AuditTrailService from '#services/audit_trail_service'

async function trackEntityChanges(hotelId: number, entityType: string, entityIds: number[]) {
  try {
    const logs = await AuditTrailService.getAuditTrail({
      hotelId,
      entityType,
      entityIds,
      action: 'UPDATE',
      sortBy: 'createdAt',
      order: 'asc'
    })
    
    console.log(`Retrieved ${logs.length} change logs for ${entityType} entities`)
    
    // Process the changes
    const changeHistory = logs.map(log => ({
      entityId: log.entityId,
      timestamp: log.createdAt,
      user: log.username,
      changes: log.changes
    }))
    
    return changeHistory
  } catch (error) {
    console.error(`Error tracking ${entityType} changes:`, error.message)
    throw error
  }
}
```

## Best Practices

1. **Always provide a valid `hotelId`**: This is a required parameter and ensures that logs are properly scoped to a specific hotel.

2. **Use pagination for large result sets**: When retrieving logs over a wide date range or for busy hotels, use the pagination parameters to avoid performance issues.

3. **Be specific with filters**: The more specific your filters, the faster the query will execute. Use entity types, entity IDs, and date ranges whenever possible.

4. **Handle errors gracefully**: Always wrap service calls in try-catch blocks to handle validation errors and provide meaningful feedback to users.

5. **Consider data sensitivity**: Activity logs may contain sensitive information. Ensure that only authorized users can access the audit trail data.

6. **Use preloaded relationships**: The service automatically preloads user, creator, and hotel relationships. Use this data instead of making additional queries.

## Integration with Other Services

The `AuditTrailService` works well with the existing `LoggerService` which is responsible for creating activity log entries. While `LoggerService` writes logs, `AuditTrailService` reads and queries them.

For a complete audit trail solution, ensure that all important actions in your application use the `LoggerService.log` or `LoggerService.logActivity` methods to record activities.