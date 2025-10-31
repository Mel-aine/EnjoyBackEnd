import { test } from '@japa/runner'

// A consolidated smoke test ensuring protected API endpoints require auth (401)
// This covers most controller route groups defined under the '/api' prefix.

// Protected GET endpoints actually defined under the '/api' prefix
// Only include routes inside the global '/api' group or '/api/reports'
const protectedGetEndpoints: string[] = [
  // Global '/api' group
  '/api/audit-trail',
  '/api/work_orders',
  // Channex endpoints under '/api/channex'
  '/api/channex/booking',
  '/api/channex/booking-revisions/feed',
  '/api/channex/properties/1/availability',
  '/api/channex/migration-status/1',
  '/api/channex/iframe/hotel/1',
  // Reports endpoints protected by auth
  '/api/reports',
  '/api/reports/templates',
  '/api/reports/stats',
  // Front-office report endpoints
  '/api/reports/front-office/inhouse-guests',
  '/api/reports/front-office/occupied-rooms',
  // Statistical report endpoints
  '/api/reports/statistics/monthly-occupancy-pdf',
  '/api/reports/statistics/revenue-by-rate-type',
  '/api/reports/statistics/revenue-by-room-type',
  '/api/reports/statistics/monthly-revenue-pdf',
  '/api/reports/statistics/business-analysis',
  '/api/reports/statistics/contribution-analysis-report',
  '/api/reports/statistics/monthly-country-wise-pax-analysis',
  '/api/reports/statistics/monthly-revenue-by-income-stream',
  '/api/reports/statistics/monthly-statistics',
  '/api/reports/statistics/monthly-summary',
  '/api/reports/statistics/monthly-tax',
  '/api/reports/statistics/room-sale-statistics',
  '/api/reports/statistics/room-statistics',
  '/api/reports/statistics/room-on-books',
  '/api/reports/statistics/yearly-statistics',
  '/api/reports/statistics/performance-analysis-report',
  '/api/reports/statistics/ip-report',
  '/api/reports/statistics/city-ledger-detail',
  '/api/reports/statistics/city-ledger-summary',
  '/api/reports/statistics/payment-summary',
  '/api/reports/statistics/daily-revenue-pdf',
  '/api/reports/statistics/daily-operations-report',
]

test.group('API auth required (GET index)', () => {
  for (const url of protectedGetEndpoints) {
    test(`GET ${url} without token returns 401`, async ({ client, assert }) => {
      const response = await client.get(url)
      // All endpoints under '/api' must be protected by the 'api' guard
      assert.equal(
        response.status(),
        401,
        `Expected 401 Unauthorized for ${url}, got ${response.status()}`
      )
    })
  }
})