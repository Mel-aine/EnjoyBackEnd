import { defineConfig } from '@adonisjs/cors'
import env from '#start/env'

/**
 * Configuration options to tweak the CORS policy. The following
 * options are documented on the official documentation website.
 *
 * https://docs.adonisjs.com/guides/security/cors
 */
// Allow configuring origins via env: CORS_ORIGINS=origin1,origin2
const defaultOrigins = [
  'https://enjoy-admin-one.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
  'https://e-tikect.vercel.app',
  'http://localhost:5174',
  'https://enjoy-chi.vercel.app',
  'https://enjoybackend-4udk.onrender.com',
  "https://live.enjoy-stay.com/"
]

const envOrigins = env.get('CORS_ORIGINS') as string | undefined
const parsedOrigins = envOrigins
  ? envOrigins
      .split(',')
      .map((o) => o.trim())
      .filter((o) => o.length > 0)
  : defaultOrigins

const corsConfig = defineConfig({
  enabled: true,
  origin: parsedOrigins,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  headers: true,
  exposeHeaders: [],
  credentials: true,
  maxAge: 90,
})

export default corsConfig
