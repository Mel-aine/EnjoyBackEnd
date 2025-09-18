# PMS Reports Documentation

This document provides detailed explanations for all PMS (Property Management System) reports available in the EnjoyBackEnd system.

## Report Categories

### 1. Financial Reports

#### Payment Summary Report
**Endpoint:** `GET /api/reports/payment-summary`
**Purpose:** Provides a comprehensive overview of all payment transactions within a specified date range.
**Data Includes:**
- Total payments received by payment method (cash, credit card, bank transfer, etc.)
- Payment breakdowns by date
- Outstanding balances
- Refunds and adjustments
- Payment trends analysis

#### Revenue by Rate Type Summary Report
**Endpoint:** `GET /api/reports/revenue-by-rate-type-summary` | `POST /api/reports/revenue-by-rate-type-summary-pdf`
**Purpose:** Analyzes revenue generation based on different room rate types and pricing strategies.
**Data Includes:**
- Revenue breakdown by rate type (standard, corporate, government, promotional)
- Average daily rate (ADR) by rate type
- Occupancy rates per rate category
- Revenue optimization insights
- Seasonal rate performance

#### Monthly Tax Report
**Endpoint:** `GET /api/reports/monthly-tax` | `POST /api/reports/monthly-tax-pdf`
**Purpose:** Comprehensive tax reporting for compliance and accounting purposes.
**Data Includes:**
- VAT/GST collected by month
- Tax breakdown by service type (room, food & beverage, services)
- Tax exemptions and adjustments
- Compliance reporting data
- Year-to-date tax summaries

### 2. Operational Analysis Reports

#### Business Analysis Report
**Endpoint:** `GET /api/reports/business-analysis` | `POST /api/reports/business-analysis-pdf`
**Purpose:** High-level business performance analysis for strategic decision making.
**Data Includes:**
- Key performance indicators (KPIs)
- Revenue per available room (RevPAR)
- Profit margins analysis
- Market segment performance
- Competitive positioning metrics
- Business trend analysis

#### Contribution Analysis Report
**Endpoint:** `GET /api/reports/contribution-analysis-report` | `POST /api/reports/contribution-analysis-report-pdf`
**Purpose:** Analyzes the contribution of different revenue streams to overall profitability.
**Data Includes:**
- Revenue contribution by department
- Profit margin analysis by service type
- Cost center performance
- Break-even analysis
- ROI calculations for different business segments

#### Performance Analysis Report
**Endpoint:** `GET /api/reports/performance-analysis-report` | `POST /api/reports/performance-analysis-report-pdf`
**Purpose:** Detailed performance metrics across all hotel operations.
**Data Includes:**
- Operational efficiency metrics
- Staff productivity analysis
- Service quality indicators
- Guest satisfaction correlation with performance
- Benchmark comparisons

### 3. Statistical Reports

#### Statistics by Room Type Report
**Endpoint:** `GET /api/reports/statistics-by-room-type` | `POST /api/reports/statistics-by-room-type-pdf`
**Purpose:** Detailed statistical analysis of room performance by type.
**Data Includes:**
- Occupancy rates by room type
- Average length of stay by room category
- Revenue per room type
- Booking patterns and trends
- Seasonal variations by room type

#### Monthly Statistics Report
**Endpoint:** `GET /api/reports/monthly-statistics` | `POST /api/reports/monthly-statistics-pdf`
**Purpose:** Comprehensive monthly operational statistics.
**Data Includes:**
- Monthly occupancy trends
- Revenue growth patterns
- Guest demographics
- Booking source analysis
- Cancellation and no-show rates

#### Yearly Statistics Report
**Endpoint:** `GET /api/reports/yearly-statistics` | `POST /api/reports/yearly-statistics-pdf`
**Purpose:** Annual performance overview and year-over-year comparisons.
**Data Includes:**
- Annual revenue summaries
- Yearly occupancy trends
- Seasonal performance patterns
- Growth metrics and projections
- Historical performance comparisons

#### Room Sale Statistics Report
**Endpoint:** `GET /api/reports/room-sale-statistics` | `POST /api/reports/room-sale-statistics-pdf`
**Purpose:** Detailed analysis of room sales performance and trends.
**Data Includes:**
- Room sales by channel (direct, OTA, corporate)
- Conversion rates by booking source
- Lead time analysis
- Pricing effectiveness
- Sales team performance metrics

#### Room Statistics Report
**Endpoint:** `GET /api/reports/room-statistics` | `POST /api/reports/room-statistics-pdf`
**Purpose:** Comprehensive room utilization and performance statistics.
**Data Includes:**
- Room utilization rates
- Maintenance and out-of-order statistics
- Room upgrade/downgrade patterns
- Guest preferences by room features
- Room revenue optimization data

### 4. Guest and Market Analysis

#### Monthly Country-wise PAX Analysis Report
**Endpoint:** `GET /api/reports/monthly-country-wise-pax-analysis` | `POST /api/reports/monthly-country-wise-pax-analysis-pdf`
**Purpose:** Analyzes guest demographics and market penetration by country of origin.
**Data Includes:**
- Guest arrivals by country/region
- Average spend per nationality
- Length of stay by market segment
- Seasonal patterns by geography
- Market share analysis

#### IP Report
**Endpoint:** `GET /api/reports/ip-report` | `POST /api/reports/ip-report-pdf`
**Purpose:** In-house guest analysis and service utilization tracking.
**Data Includes:**
- Current in-house guest profiles
- Service utilization patterns
- Ancillary revenue per guest
- Guest satisfaction scores
- Upselling opportunities

### 5. Revenue and Financial Analysis

#### Monthly Revenue by Income Stream Report
**Endpoint:** `GET /api/reports/monthly-revenue-by-income-stream` | `POST /api/reports/monthly-revenue-by-income-stream-pdf`
**Purpose:** Breaks down revenue by different income sources and departments.
**Data Includes:**
- Room revenue analysis
- Food & beverage revenue
- Spa and wellness income
- Conference and events revenue
- Other ancillary services income
- Revenue trend analysis by stream

#### Monthly Summary Report
**Endpoint:** `GET /api/reports/monthly-summary` | `POST /api/reports/monthly-summary-pdf`
**Purpose:** Executive summary of monthly hotel performance.
**Data Includes:**
- Key financial metrics summary
- Operational highlights
- Guest satisfaction overview
- Market position summary
- Action items and recommendations

### 6. Inventory and Capacity Reports

#### Room on Books Report
**Endpoint:** `GET /api/reports/room-on-books` | `POST /api/reports/room-on-books-pdf`
**Purpose:** Current and future room inventory status and booking forecast.
**Data Includes:**
- Current reservations by date
- Future booking patterns
- Available inventory projections
- Overbooking risk analysis
- Revenue forecast based on current bookings

### 7. Financial Ledger Reports

#### City Ledger Detail Report
**Endpoint:** `GET /api/reports/city-ledger-detail` | `POST /api/reports/city-ledger-detail-pdf`
**Purpose:** Detailed accounts receivable tracking for corporate and credit accounts.
**Data Includes:**
- Outstanding balances by account
- Aging analysis of receivables
- Credit limit utilization
- Payment history and patterns
- Collection priority recommendations

#### City Ledger Summary Report
**Endpoint:** `GET /api/reports/city-ledger-summary` | `POST /api/reports/city-ledger-summary-pdf`
**Purpose:** High-level summary of accounts receivable and credit accounts.
**Data Includes:**
- Total outstanding amounts
- Summary by account type
- Collection efficiency metrics
- Bad debt provisions
- Credit risk assessment

## Report Parameters

All reports support the following common parameters:
- `hotelId`: Filter by specific hotel (for multi-property systems)
- `startDate`: Report start date (YYYY-MM-DD format)
- `endDate`: Report end date (YYYY-MM-DD format)

## Report Formats

### Data Reports (GET endpoints)
- Return JSON data suitable for dashboard displays
- Include summary statistics and detailed breakdowns
- Support real-time data visualization
- Optimized for API consumption

### PDF Reports (POST endpoints)
- Generate formatted PDF documents
- Include charts, graphs, and professional layouts
- Suitable for printing and formal presentations
- Include executive summaries and detailed appendices

## Usage Guidelines

1. **Date Ranges**: Use appropriate date ranges for meaningful analysis
2. **Hotel Filtering**: Specify hotelId for multi-property environments
3. **Performance**: PDF generation may take longer for large date ranges
4. **Caching**: Data reports are cached for improved performance
5. **Security**: All reports require appropriate authentication and authorization

## Integration Notes

- All reports integrate with the hotel's PMS data
- Real-time data synchronization ensures accuracy
- Reports can be scheduled for automatic generation
- Export capabilities support various business intelligence tools
- API endpoints follow RESTful conventions for easy integration