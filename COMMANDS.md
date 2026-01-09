# Project Commands

This document lists all available Ace commands in the project and how to execute them.

## General Usage

Run commands using:
```bash
node ace <command-name> [arguments] [flags]
```

---

## Commands List

### Automation & Maintenance

#### `auto:release-rooms`
*   **Description:** Libère automatiquement les chambres dont la date de départ est dépassée.
*   **Usage:** `node ace auto:release-rooms`

#### `cleanup:reservations`
*   **Description:** Delete all reservations (and related rooms, folios, transactions) for a hotel.
*   **Usage:** `node ace cleanup:reservations`
    *   *Note:* Currently defaults to Hotel ID 3 (hardcoded).

#### `night:audit:interval`
*   **Description:** Run night audit for a date range without sending reports.
*   **Usage:** `node ace night:audit:interval <hotelId> <startDate> <endDate>`
    *   `hotelId`: Hotel ID
    *   `startDate`: Start Date (YYYY-MM-DD)
    *   `endDate`: End Date (YYYY-MM-DD)

### Data Import & Seeding

#### `company:backfill-payment-methods`
*   **Description:** Create a payment_method for company_accounts missing one (per hotel).
*   **Usage:** `node ace company:backfill-payment-methods [flags]`
    *   `-h, --hotel-id <number>`: Hotel ID
    *   `-d, --dry-run`: Preview changes without writing
    *   `-u, --user-id <number>`: created_by / last_modified_by user id

#### `hotel:backfill-mealplan-extract`
*   **Description:** Backfill missing meal-plan EXTRACT_CHARGE transactions for a hotel.
*   **Usage:** `node ace hotel:backfill-mealplan-extract [flags]`
    *   `-h, --hotel-id <number>`: Hotel ID
    *   `-d, --dry-run`: Preview only (no writes)
    *   `-l, --limit <number>`: Limit reservations scanned
    *   `-u, --posted-by <number>`: User ID for createdBy/lastModifiedBy

#### `import:currencies`
*   **Description:** Import currencies from a JSON file into the database.
*   **Usage:** `node ace import:currencies [flags]`
    *   `--hotelId <number>`: Hotel ID (default: 3)
    *   `--file <string>`: Path to JSON file

#### `import:daily-summary-facts`
*   **Description:** Import Daily Summary Facts (manager report + daily revenue JSON) for a hotel.
*   **Usage:** `node ace import:daily-summary-facts [flags]`
    *   `-h, --hotel-id <number>`: Hotel ID (default: 2)
    *   `-f, --file <string>`: Path to JSON file
    *   `-d, --date <string>`: Audit date (YYYY-MM-DD) if importing a single object

#### `import:email-defaults`
*   **Description:** Seed default template categories and email templates for a specific hotel.
*   **Usage:** `node ace import:email-defaults [flags]`
    *   `-h, --hotel-id <number>`: Hotel Id to seed defaults for

### Configuration & Fixes

#### `currency:set-default`
*   **Description:** Set a hotel currency (by code) as the default.
*   **Usage:** `node ace currency:set-default`
    *   *Note:* Hardcoded for Hotel 5 / XAF.

#### `tax:ensure-audit-columns`
*   **Description:** Ensure tax_rates has audit user columns with NULL defaults.
*   **Usage:** `node ace tax:ensure-audit-columns`

#### `hotel:fix-mealplan-roomcharges`
*   **Description:** For a hotel, link missing mealPlan on reservation_rooms and recompute room_final_* fields.
*   **Usage:** `node ace hotel:fix-mealplan-roomcharges [flags]`
    *   `-h, --hotel-id <number>`: Hotel ID
    *   `-d, --dry-run`: Do not write changes

#### `pos:generate-keys`
*   **Description:** Generate POS API keys for all hotels missing one.
*   **Usage:** `node ace pos:generate-keys`

#### `folio:sync-working-date`
*   **Description:** Update folio_transactions.current_working_date to match transaction_date (date portion) for a hotel.
*   **Usage:** `node ace folio:sync-working-date [flags]`
    *   `-h, --hotel-id <number>`: Hotel ID

#### `tax:reset-audit`
*   **Description:** Set createdByUserId and updatedByUserId to NULL for all tax rates.
*   **Usage:** `node ace tax:reset-audit`

#### `update:folio_taxes`
*   **Description:** Update taxes for MealPlan and Room transactions.
*   **Usage:** `node ace update:folio_taxes [flags]`
    *   `-h, --hotel-id <number>`: Hotel ID
    *   `-d, --dry-run`: Dry run - preview changes without saving

### Reports

#### `reports:send-daily-email`
*   **Description:** Send daily (Today) email report for a hotel.
*   **Usage:** `node ace reports:send-daily-email [flags]`
    *   `-h, --hotel-id <number>`: Hotel ID to send the email for
    *   `-d, --date <string>`: As-of date (YYYY-MM-DD) used in email subject

#### `reports:send-daily-summary`
*   **Description:** Send the Daily Summary email for a selected hotel and date.
*   **Usage:** `node ace reports:send-daily-summary [flags]`
    *   `-h, --hotel-id <number>`: Hotel ID to send summary for
    *   `-d, --date <string>`: Audit date (YYYY-MM-DD). Defaults to latest available

### Services & Utilities (External/Data Processing)

#### `services:enrich`
*   **Description:** Enrichit les services avec des coordonnées géographiques.
*   **Usage:** `node ace services:enrich`
    *   *Input:* `./data/data-administrations.json`

#### `export:grouped`
*   **Description:** Regroupe les données par catégorie logique (ex: bar, snack) et génère un fichier JSON pour chaque.
*   **Usage:** `node ace export:grouped`

#### `filter:service`
*   **Description:** Filtrer les adresses sans lat/lng et sauvegarder dans un fichier.
*   **Usage:** `node ace filter:service`
    *   *Input:* `./data/services_with_coords.json`
    *   *Output:* `./data/address`

#### `inject:coords`
*   **Description:** Injecte les coordonnées dans les services depuis address.json.
*   **Usage:** `node ace inject:coords`
    *   *Inputs:* `./data/services_with_coords.json`, `./data/services_with_address.json`
    *   *Output:* `./data/services_with_coords_updated.json`

#### `upload:images`
*   **Description:** Upload les images locales vers Cloudinary et met à jour les URLs dans le JSON.
*   **Usage:** `node ace upload:images`
    *   *Input:* `./data/data-administrations.json`
