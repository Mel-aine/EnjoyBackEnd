/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']),

  /*
  |----------------------------------------------------------
  | Variables for configuring database connection
  |----------------------------------------------------------
  */
  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_DATABASE: Env.schema.string(),


  /*
    |----------------------------------------------------------
    | Variables for configuring the google api
    |----------------------------------------------------------
    */
  // GOOGLE_MAPS_API_KEY: Env.schema.string()

  /*
  |----------------------------------------------------------
  | Variables for configuring the mail package
  |----------------------------------------------------------
  */
  // SMTP_HOST: Env.schema.string(),
  // SMTP_PORT: Env.schema.string()
  SMTP_HOST: Env.schema.string.optional(),
  SMTP_PORT: Env.schema.number.optional(),
  SMTP_USERNAME: Env.schema.string.optional(),
  SMTP_PASSWORD: Env.schema.string.optional(),
  MAIL_FROM_ADDRESS: Env.schema.string.optional(),
  MAIL_FROM_NAME: Env.schema.string.optional(),
  FRONTEND_URL: Env.schema.string.optional(),
  LIVE_ENPOINT: Env.schema.string.optional(),
  // Comma-separated list of allowed CORS origins
  CORS_ORIGINS: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Variables for configuring Mailjet integration
  |----------------------------------------------------------
  */
  MAILJET_API_KEY: Env.schema.string.optional(),
  MAILJET_API_SECRET: Env.schema.string.optional(),
  MAILJET_VERIFICATION_TEMPLATE_ID: Env.schema.number.optional(),
  MAILJET_CONTACT_LIST_ID: Env.schema.number.optional(),
  MAILJET_SENDER_EMAIL: Env.schema.string.optional(),
  MAILJET_API_BASE_URL_V3: Env.schema.string.optional(),
  MAILJET_API_BASE_URL_V31: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Variables for configuring external POS integration
  |----------------------------------------------------------
  */
  POS_API_BASE_URL: Env.schema.string.optional(),
  POS_API_V2_BASE_URL: Env.schema.string.optional(),
  POS_API_TIMEOUT_MS: Env.schema.number.optional(),

  /*
  |----------------------------------------------------------
  | Variables for configuring the cloudinary package
  |----------------------------------------------------------
  */

  // CLOUDINARY_CLOUD_NAME: Env.schema.string(),
  // CLOUDINARY_API_KEY: Env.schema.string(),
  // CLOUDINARY_API_SECRET: Env.schema.string(),

  // TTL for cached default currency in seconds (optional)
  CURRENCY_CACHE_TTL_SECONDS: Env.schema.number.optional(),
  
  // Auto Process User ID
  AUTOPROCESS_USER_ID: Env.schema.number.optional(),

  // Secret token for triggering cron HTTP endpoints
  CRON_JOB_SECRET: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Hub OTA (connect-hub). Off unless HUB_ENABLED=true: nothing is
  | sent to the hub and existing behaviour is unchanged.
  |----------------------------------------------------------
  */
  HUB_ENABLED: Env.schema.boolean.optional(),
  HUB_BASE_URL: Env.schema.string.optional(),
  HUB_TIMEOUT_MS: Env.schema.number.optional(),
  // Delay used to group changes before pushing availability (ms).
  HUB_PUSH_DEBOUNCE_MS: Env.schema.number.optional(),
  // Days of availability sent by the nightly full resync.
  HUB_RESYNC_DAYS: Env.schema.number.optional(),

  // Read the Channex booking feed every minute for every hotel linked to
  // Channex (start/scheduler.ts). Off by default: enable it only if no
  // external scheduler already calls POST /api/channex/sync/bookings/:hotelId.
  CHANNEX_BOOKING_SYNC_CRON: Env.schema.boolean.optional(),

  // Channex API. CHANNEX_API_KEY is required for any Channex call (there is no
  // key in the code any more). CHANNEX_BASE_URL defaults to the staging API.
  CHANNEX_API_KEY: Env.schema.string.optional(),
  CHANNEX_BASE_URL: Env.schema.string.optional(),
  CHANNEX_URL: Env.schema.string.optional(),

  // Nightly full availability push to Channex (03:15). Off by default: it
  // overwrites values edited by hand in the Channex dashboard.
  CHANNEX_AVAILABILITY_RESYNC: Env.schema.boolean.optional(),
  CHANNEX_RESYNC_DAYS: Env.schema.number.optional(),

  // Enjoy Rental integration API key
  ENJOY_RENTAL_API_KEY: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Variables for configuring WhatsApp integration
  |----------------------------------------------------------
  */
  WHATSAPP_MANAGED_BASE_URL: Env.schema.string.optional(),
  WHATSAPP_MANAGED_VERSION: Env.schema.string.optional(),
  WHATSAPP_MANAGED_PHONE_ID: Env.schema.string.optional(),
  WHATSAPP_MANAGED_WABA_ID: Env.schema.string.optional(),
  WHATSAPP_MANAGED_TOKEN: Env.schema.string.optional(),
  WHATSAPP_MANAGED_SENDER_NAME: Env.schema.string.optional(),
})
