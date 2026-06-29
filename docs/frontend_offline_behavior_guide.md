# Guide Comportement Frontend en Mode Hors Ligne - EnjoyAdmin

## 📋 Table des Matières

1. [État des Lieux Actuel](#1-état-des-lieux-actuel)
2. [Architecture Cible Offline-First](#2-architecture-cible-offline-first)
3. [PWA & Service Worker (État Existant)](#3-pwa--service-worker-état-existant)
4. [Améliorations du Service Worker](#4-améliorations-du-service-worker)
5. [IndexedDB : Base de Données Locale](#5-indexeddb--base-de-données-locale)
6. [Détection de Connexion & États UI](#6-détection-de-connexion--états-ui)
7. [File d'Attente Hors Ligne (Offline Queue)](#7-file-dattente-hors-ligne-offline-queue)
8. [Proxy API Intelligent](#8-proxy-api-intelligent)
9. [Comportement par Module](#9-comportement-par-module)
10. [Synchronisation Automatique](#10-synchronisation-automatique)
11. [Gestion des Conflits (UI)](#11-gestion-des-conflits-ui)
12. [Composables & Stores Offline](#12-composables--stores-offline)
13. [Points d'Intégration dans le Code Existant](#13-points-dintégration-dans-le-code-existant)
14. [Plan d'Implémentation](#14-plan-dimplémentation)

---

## 1. État des Lieux Actuel

### 1.1 Stack Frontend

| Technologie | Version | Usage |
|-------------|---------|-------|
| **Vue 3** | ^3.x | Framework UI |
| **Vite** | ^5.x | Build tool |
| **TypeScript** | ~5.5 | Langage |
| **Pinia** | ^2.x | State management |
| **pinia-plugin-persistedstate** | ^3.x | Persistance localStorage |
| **Axios** | ^1.x | HTTP client |
| **Vue Router** | ^4.x | Routing |
| **VueUse** | ^10.x | Composables utilities |
| **Tailwind CSS** | ^3.x | Styling |
| **vue-toastification** | ^2.x | Notifications |
| **vue-i18n** | ^9.x | Internationalisation |
| **Electron** | ^32.x | Desktop app |
| **vite-plugin-pwa** | ✅ Installé | PWA + Workbox |

### 1.2 Ce Qui Existe DÉJÀ

#### ✅ PWA Existant (Fonctionnel mais Basique)

| Élément | Statut | Détail |
|---------|--------|--------|
| **`vite-plugin-pwa`** | ✅ Installé | Dans `node_modules` |
| **Configuration VitePWA** | ✅ Dans `vite.config.ts` | Auto-update, manifest, Workbox |
| **Icônes PWA** | ✅ `public/icons/` | `icon-192.png`, `icon-512.png`, `icon-512-maskable.png` |
| **`index.html`** | ✅ Partiel | `theme-color`, `apple-touch-icon` |
| **`usePwaUpdate.ts`** | ✅ Dans `src/composables/` | Gestion mise à jour SW |
| **App.vue** | ✅ Appel de `usePwaUpdate()` | + toast de notification |
| **Workbox** | ✅ Configuré | Stratégie NetworkFirst pour `/api/*` |

**Configuration actuelle du Workbox :**
```typescript
workbox: {
  runtimeCaching: [{
    urlPattern: /^https?:\/\/.*\/api\/.*/i,
    handler: 'NetworkFirst',
    options: {
      cacheName: 'api-cache',
      expiration: { maxEntries: 50, maxAgeSeconds: 86400 },
      cacheableResponse: { statuses: [0, 200] },
    },
  }],
}
```

#### ✅ Stores Persistés (Réutilisables pour l'Offline)

| Store | Persistance | Utilité Offline |
|-------|-------------|-----------------|
| `useAuthStore` | ✅ Token JWT | Auth offline |
| `bookingDraftStore` | ✅ Brouillons réservation | Sauvegarde formulaire |
| `currencyStore` | ✅ Devises | Cache config |
| `useBookingStore` | ✅ État partagé | Refresh grid/calendar |

#### ✅ Architecture des Appels API

```
Composant Vue
    ↓
Composable (useReservation, useBooking, etc.)
    ↓
Service API (reservation.ts, foglioApi.ts, guestApi.ts, etc.)
    ↓
apiClient.ts / api.ts (Axios + intercepteurs : auth, hotelId)
    ↓
Backend API (AdonisJS)
```

### 1.3 Ce Qui MANQUE pour l'Offline Complet

| Fonctionnalité | Statut | Priorité |
|----------------|--------|----------|
| **Stratégies de cache fines** | ❌ Un seul pattern global | 🔴 Haute |
| **File d'attente offline** | ❌ Aucune | 🔴 Haute |
| **IndexedDB structuré** | ❌ Aucun | 🔴 Haute |
| **Background Sync** | ❌ Pas configuré | 🔴 Haute |
| **Détection online/offline UI** | ❌ Aucune | 🟡 Haute |
| **Mise à jour optimiste** | ❌ Aucune | 🟡 Haute |
| **Résolution conflits** | ❌ Aucune | 🟡 Haute |
| **Indicateur statut connexion** | ❌ Aucun | 🟢 Normale |
| **Page offline** | ❌ Aucune | 🟢 Normale |

---

## 2. Architecture Cible Offline-First

### 2.1 Vue d'Ensemble

```
                  ┌──────────────────────────────────────┐
                  │         Application Vue 3             │
                  │                                       │
  ┌───────────┐   │  ┌──────────┐  ┌──────────────┐      │
  │ Événements│   │  │Composants │  │ Composables   │      │
  │ online/   │──▶│  │ (Vue SFC) │◀─┤ (useOffline,  │      │
  │ offline   │   │  │           │  │  useSync,     │      │
  │           │   │  │           │  │  useQueue)    │      │
  └───────────┘   │  └─────┬─────┘  └──────┬───────┘      │
                  │        │               │              │
                  │        ▼               ▼              │
                  │  ┌─────────────────────────────────┐  │
                  │  │       OfflineServiceLayer        │  │
                  │  │  offlineAwareApiCall()           │  │
                  │  │  - Online → Axios (API)          │  │
                  │  │  - Offline → IndexedDB + Queue   │  │
                  │  └──────┬──────────────┬───────────┘  │
                  │         │              │              │
                  │         ▼              ▼              │
                  │  ┌───────────┐  ┌─────────────────┐  │
                  │  │ Axios     │  │ IndexedDB        │  │
                  │  │ (API)     │  │ (Dexie.js)       │  │
                  │  │           │  │ cache + queue    │  │
                  │  └─────┬─────┘  └───────┬─────────┘  │
                  │        │                │            │
                  │        ▼                ▼            │
                  │  ┌─────────────────────────────────┐  │
                  │  │     Service Worker (Workbox)     │  │
                  │  │  - Stratégies par pattern URL    │  │
                  │  │  - Background Sync Auto          │  │
                  │  │  - Cache API + Assets            │  │
                  │  └─────────────────────────────────┘  │
                  └──────────────────────────────────────┘
                                  │
                        HTTPS (Online/Offline)
                                  │
                                  ▼
                  ┌──────────────────────────────────────┐
                  │      Backend API (AdonisJS)          │
                  │      endpoints + SyncService          │
                  └──────────────────────────────────────┘
```

### 2.2 Principe de Fonctionnement

```
ÉTAT ONLINE :
  Lecture  → offlineAwareApiCall() → Axios → API → réponse
            → mise à jour cache IndexedDB
  Écriture → offlineAwareApiCall() → Axios → API → confirmation
            → mise à jour cache IndexedDB

ÉTAT OFFLINE :
  Lecture  → offlineAwareApiCall() → IndexedDB (cache) → données
  Écriture → offlineAwareApiCall() → IndexedDB (queue) + cache optimiste
            → UI : "Modifications en attente de synchronisation"

TRANSITION OFFLINE → ONLINE :
  1. Détection navigator.onLine + événement
  2. Notification toast : "Synchronisation en cours..."
  3. PUSH : POST /api/sync/push (opérations en file)
  4. PULL : POST /api/sync/pull (changements distants)
  5. Mise à jour IndexedDB + rafraîchissement UI
  6. Notification : "Synchronisation terminée (X opérations)"
```

### 2.3 Diagramme de Navigation États

```
                    ┌─────────────┐
           ┌───────▶│   ONLINE    │◀────────┐
           │        │             │         │
           │        └──────┬──────┘         │
           │               │                │
      perte connexion  reconnexion      échec sync
           │               │                │
           ▼               ▼                │
     ┌──────────┐     ┌──────────┐          │
     │ OFFLINE  │────▶│ SYNCING  │──────────┘
     │ (lecture │     │ (push +  │
     │  locale) │     │  pull)   │
     └──────────┘     └──────────┘
```

---

## 3. PWA & Service Worker (État Existant)

### 3.1 Configuration Actuelle Complète

```typescript
// vite.config.ts (extrait PWA)
VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
  manifest: {
    name: 'Enjoy Stay',
    short_name: 'EnjoyStay',
    description: 'Property Management System',
    theme_color: '#7c3aed',
    background_color: '#ffffff',
    display: 'standalone',
    scope: '/',
    start_url: '/',
    icons: [
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: 'icons/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  },
  workbox: {
    runtimeCaching: [
      {
        urlPattern: /^https?:\/\/.*\/api\/.*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api-cache',
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 60 * 60 * 24, // 1 jour
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
    ],
  },
})
```

### 3.2 Composable de Mise à Jour Existant

```typescript
// src/composables/usePwaUpdate.ts
import { useRegisterSW } from 'virtual:pwa-register/vue'

export function usePwaUpdate() {
  const {
    offlineReady,
    needRefresh,
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onNeedRefresh() {
      localStorage.setItem('pwa-updated', 'true')
      window.location.reload()
    },
    onOfflineReady() {
      console.log('App ready for offline usage')
    },
    onRegisterError(error) {
      console.error('SW registration error:', error)
    },
  })

  return { needRefresh, offlineReady, updateServiceWorker }
}
```

### 3.3 Intégration dans App.vue (Existant)

```typescript
// Dans App.vue <script setup>
import { usePwaUpdate } from '@/composables/usePwaUpdate'
import { onMounted } from 'vue'
import { useToast } from 'vue-toastification'

const toast = useToast()

usePwaUpdate() // Active le SW + vérification mise à jour

onMounted(() => {
  // Notification mise à jour
  if (localStorage.getItem('pwa-updated') === 'true') {
    localStorage.removeItem('pwa-updated')
    toast.success(t.t('common.appUpdated'))
  }
})
```

### 3.4 Points Faibles de la Config Actuelle

| Problème | Impact |
|----------|--------|
| **Un seul pattern `/api/*`** | Pas de distinction entre GET (cachable) et POST (écriture) |
| **Pas de Background Sync** | Les requêtes POST échouent silencieusement hors ligne |
| **50 entrées max** | Trop peu pour un PMS avec centaines de réservations |
| **1 jour de cache** | Trop peu pour les données de configuration (7j+) |
| **Pas de cache pour les assets statiques** | Fonts, images OTA, etc. non cachés |
| **Pas d'IndexedDB côté app** | Données perdues au rechargement de page |

---

## 4. Améliorations du Service Worker

### 4.1 Nouvelle Configuration VitePWA

```typescript
// vite.config.ts — Configuration améliorée
VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'images/**/*', 'fonts/**/*'],
  manifest: {
    // ... (inchangé)
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2,ttf,eot}'],
    runtimeCaching: [
      // ===== CONFIGURATION (lecture seule, longue durée) =====
      {
        urlPattern: /\/api\/(configuration|hotels\/\d+\/(room_types|rooms|rate_types|extra_charges|payment_methods|taxes|seasons|discounts)).*/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'pms-config',
          expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 }, // 7 jours
          backgroundSync: { name: 'pms-sync' },
        },
      },

      // ===== DONNÉES MÉTIER (lecture/écriture, modérément) =====
      {
        urlPattern: /\/api\/(reservation|guests|folios)(?!.*(checkin|checkout|payment|transaction|create)).*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'pms-data',
          expiration: { maxEntries: 500, maxAgeSeconds: 24 * 60 * 60 }, // 1 jour
          networkTimeoutSeconds: 5,
          backgroundSync: { name: 'pms-sync' },
        },
      },

      // ===== RAPPORTS / STATISTIQUES (lecture seule) =====
      {
        urlPattern: /\/api\/(dashboard|reports|statistics).*/i,
        handler: 'NetworkOnly',
        options: {
          backgroundSync: { name: 'pms-sync' },
        },
      },

      // ===== FONTS =====
      {
        urlPattern: /\.(woff|woff2|ttf|eot)$/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'pms-fonts',
          expiration: { maxAgeSeconds: 30 * 24 * 60 * 60 }, // 30 jours
        },
      },

      // ===== IMAGES (logos OTA, etc.) =====
      {
        urlPattern: /\.(png|jpg|jpeg|svg|webp)$/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'pms-images',
          expiration: { maxEntries: 100, maxAgeSeconds: 14 * 24 * 60 * 60 }, // 14 jours
        },
      },
    ],
  },
})
```

### 4.2 Hook personnalisé pour la mise à jour

```typescript
// src/composables/usePwaUpdate.ts — Version améliorée
import { ref } from 'vue'
import { useRegisterSW } from 'virtual:pwa-register/vue'

export function usePwaUpdate() {
  const needRefresh = ref(false)
  const offlineReady = ref(false)
  const registrationError = ref<string | null>(null)

  const { updateServiceWorker } = useRegisterSW({
    immediate: true,
    onNeedRefresh() {
      needRefresh.value = true
    },
    onOfflineReady() {
      offlineReady.value = true
      localStorage.setItem('pwa-offline-ready', 'true')
      window.dispatchEvent(new CustomEvent('app:offline-ready'))
    },
    onRegisterError(error) {
      registrationError.value = error?.message || 'Erreur inconnue'
      console.error('SW registration error:', error)
    },
  })

  function refreshApp() {
    localStorage.setItem('pwa-updated', 'true')
    updateServiceWorker(true)
  }

  return { needRefresh, offlineReady, registrationError, refreshApp }
}
```

---

## 5. IndexedDB : Base de Données Locale

### 5.1 Installation

```bash
npm install dexie
```

### 5.2 Schéma de la Base Locale

```typescript
// src/services/offline/db.ts
import Dexie, { type Table } from 'dexie'

// =========== Types ===========

export interface OfflineCacheEntry<T = any> {
  id: string           // 'resourceType:resourceId'
  resourceType: string // 'reservation', 'guest', 'room', etc.
  resourceId: number | string
  data: T
  version: number      // Pour détection conflit
  updatedAt: string    // ISO date
  expiresAt: number    // timestamp
  pending?: boolean    // En attente de sync
}

export interface OfflineQueueItem {
  id?: number
  operationId: string       // UUID v4
  operationType: 'create' | 'update' | 'delete'
  resourceType: string
  resourceId?: number
  payload: any
  priority: number          // 0-10
  status: 'pending' | 'processing' | 'failed' | 'completed'
  createdAt: string
  retryCount: number
  lastError?: string
}

export interface OfflineSyncCheckpoint {
  id?: number
  resourceType: string
  lastVersion: number
  lastSyncAt: string
}

export interface OfflineDraft {
  id?: number
  formKey: string          // 'booking', 'guest', etc.
  data: any
  updatedAt: string
}

// =========== Base de Données ===========

export class OfflineDatabase extends Dexie {
  cache!: Table<OfflineCacheEntry, string>
  queue!: Table<OfflineQueueItem, number>
  checkpoints!: Table<OfflineSyncCheckpoint, number>
  drafts!: Table<OfflineDraft, number>

  constructor() {
    super('EnjoyPMSOffline')

    this.version(1).stores({
      cache: 'id, resourceType, resourceId, expiresAt, version',
      queue: '++id, status, priority, createdAt, resourceType',
      checkpoints: '++id, resourceType',
      drafts: '++id, formKey',
    })
  }
}

export const db = new OfflineDatabase()
```

### 5.3 Service de Cache Local

```typescript
// src/services/offline/cacheService.ts
import { db, type OfflineCacheEntry } from './db'

export class OfflineCacheService {
  private static defaultTTL = 30 * 60 * 1000 // 30 minutes

  /**
   * Durées de vie recommandées par type de ressource
   */
  static TTL_CONFIG = 7 * 24 * 60 * 60 * 1000  // 7 jours (tarifs, types chambres)
  static TTL_DATA = 24 * 60 * 60 * 1000          // 1 jour (réservations, clients)
  static TTL_TRANSACTION = 7 * 24 * 60 * 60 * 1000 // 7 jours (transactions)
  static TTL_TEMP = 5 * 60 * 1000                 // 5 minutes (disponibilités)

  /**
   * Mettre en cache
   */
  static async set<T>(
    resourceType: string,
    resourceId: number | string,
    data: T,
    options?: { ttlMs?: number; version?: number; pending?: boolean }
  ) {
    const ttl = options?.ttlMs ?? this.defaultTTL
    await db.cache.put({
      id: `${resourceType}:${resourceId}`,
      resourceType,
      resourceId,
      data,
      version: options?.version ?? data?.version ?? 1,
      updatedAt: new Date().toISOString(),
      expiresAt: Date.now() + ttl,
      pending: options?.pending ?? false,
    })
  }

  /**
   * Récupérer une entrée du cache
   */
  static async get<T = any>(
    resourceType: string,
    resourceId: number | string
  ): Promise<{ data: T; fromCache: boolean } | null> {
    const entry = await db.cache.get(`${resourceType}:${resourceId}`)
    if (!entry) return null
    if (entry.expiresAt < Date.now()) {
      await db.cache.delete(entry.id)
      return null
    }
    return { data: entry.data as T, fromCache: true }
  }

  /**
   * Récupérer toutes les ressources d'un type (ex: toutes les réservations)
   */
  static async getAll<T = any>(
    resourceType: string,
    filter?: (item: T) => boolean
  ): Promise<T[]> {
    let entries = await db.cache
      .where('resourceType')
      .equals(resourceType)
      .filter(e => e.expiresAt > Date.now())
      .toArray()

    let data = entries.map(e => e.data as T)

    if (filter) {
      data = data.filter(filter)
    }

    return data
  }

  /**
   * Invalider le cache
   */
  static async invalidate(resourceType: string, resourceId?: number | string) {
    if (resourceId) {
      await db.cache.delete(`${resourceType}:${resourceId}`)
    } else {
      await db.cache.where('resourceType').equals(resourceType).delete()
    }
  }

  /**
   * Récupérer les éléments en attente de sync
   */
  static async getPendingItems<T = any>(resourceType: string): Promise<T[]> {
    const entries = await db.cache
      .where('resourceType')
      .equals(resourceType)
      .filter(e => e.pending === true)
      .toArray()
    return entries.map(e => e.data as T)
  }

  /**
   * Mettre à jour le cache avec les données serveur (après sync)
   */
  static async syncFromServer<T>(
    resourceType: string,
    resourceId: number | string,
    data: T,
    version: number
  ) {
    const key = `${resourceType}:${resourceId}`
    const existing = await db.cache.get(key)

    if (existing) {
      await db.cache.update(key, {
        data,
        version,
        updatedAt: new Date().toISOString(),
        expiresAt: Date.now() + this.defaultTTL,
        pending: false,
      })
    } else {
      await this.set(resourceType, resourceId, data, { version })
    }
  }

  /**
   * Vider tout le cache quand l'utilisateur change d'hôtel
   */
  static async clearHotelData() {
    const tables = ['reservation', 'guest', 'folio', 'folio_transaction', 'room']
    for (const table of tables) {
      await db.cache.where('resourceType').equals(table).delete()
    }
    await db.checkpoints.clear()
  }
}
```

### 5.4 Gestion des Brouillons (Drafts)

```typescript
// src/services/offline/draftService.ts
import { db } from './db'

/**
 * Service de sauvegarde automatique des formulaires
 * Utilise IndexedDB plutôt que localStorage pour les gros volumes
 */
export class DraftService {
  /**
   * Sauvegarder un brouillon
   */
  static async save(formKey: string, data: any) {
    const existing = await db.drafts.where('formKey').equals(formKey).first()
    if (existing) {
      await db.drafts.update(existing.id!, {
        data,
        updatedAt: new Date().toISOString(),
      })
    } else {
      await db.drafts.add({
        formKey,
        data,
        updatedAt: new Date().toISOString(),
      })
    }
  }

  /**
   * Restaurer un brouillon
   */
  static async restore(formKey: string): Promise<any | null> {
    const draft = await db.drafts.where('formKey').equals(formKey).first()
    return draft?.data ?? null
  }

  /**
   * Supprimer un brouillon
   */
  static async delete(formKey: string) {
    const draft = await db.drafts.where('formKey').equals(formKey).first()
    if (draft?.id) {
      await db.drafts.delete(draft.id)
    }
  }

  /**
   * Lister les brouillons disponibles
   */
  static async list(): Promise<{ formKey: string; updatedAt: string }[]> {
    return db.drafts.toArray().then(drafts =>
      drafts.map(d => ({ formKey: d.formKey, updatedAt: d.updatedAt }))
    )
  }
}
```

---

## 6. Détection de Connexion & États UI

### 6.1 Composable useConnection

```typescript
// src/composables/offline/useConnection.ts
import { ref, onMounted, onUnmounted } from 'vue'

export function useConnection() {
  const isOnline = ref(navigator.onLine)
  const wasOffline = ref(false) // Pour détecter la transition offline→online

  function handleOnline() {
    isOnline.value = true
    if (wasOffline.value) {
      wasOffline.value = false
      // Déclencher la sync automatique
      window.dispatchEvent(new CustomEvent('app:online'))
    }
  }

  function handleOffline() {
    isOnline.value = false
    wasOffline.value = true
    window.dispatchEvent(new CustomEvent('app:offline'))
  }

  onMounted(() => {
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
  })

  onUnmounted(() => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  })

  return { isOnline, wasOffline }
}
```

### 6.2 Store Global d'État Offline

```typescript
// src/composables/offline/offlineStore.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db } from '@/services/offline/db'

export const useOfflineStore = defineStore('offline', () => {
  const isOnline = ref(navigator.onLine)
  const isSyncing = ref(false)
  const lastSyncAt = ref<string | null>(localStorage.getItem('lastSyncAt'))
  const pendingCount = ref(0)
  const conflictsCount = ref(0)

  const syncStatus = computed<'online' | 'offline' | 'syncing' | 'pending'>(() => {
    if (isSyncing.value) return 'syncing'
    if (!isOnline.value) return 'offline'
    if (pendingCount.value > 0) return 'pending'
    return 'online'
  })

  const syncStatusLabel = computed(() => ({
    online: 'En ligne',
    offline: 'Hors ligne',
    syncing: 'Synchronisation...',
    pending: `${pendingCount.value} en attente`,
  })[syncStatus.value])

  const syncStatusColor = computed(() => ({
    online: 'text-green-600 bg-green-50',
    offline: 'text-red-600 bg-red-50',
    syncing: 'text-yellow-600 bg-yellow-50',
    pending: 'text-orange-600 bg-orange-50',
  })[syncStatus.value])

  const needsAttention = computed(() =>
    pendingCount.value > 0 || conflictsCount.value > 0 || !isOnline.value
  )

  async function refreshPendingCount() {
    pendingCount.value = await db.queue
      .where('status')
      .anyOf('pending', 'failed')
      .count()

    const conflicts = await db.cache
      .where('resourceType')
      .equals('conflict')
      .toArray()
    conflictsCount.value = conflicts.length
  }

  function setSyncing(value: boolean) {
    isSyncing.value = value
  }

  function setLastSync(date: string) {
    lastSyncAt.value = date
    localStorage.setItem('lastSyncAt', date)
  }

  return {
    isOnline, isSyncing, lastSyncAt,
    pendingCount, conflictsCount,
    syncStatus, syncStatusLabel, syncStatusColor, needsAttention,
    refreshPendingCount, setSyncing, setLastSync,
  }
})
```

### 6.3 Composant Indicateur de Connexion

```vue
<!-- src/components/common/ConnectionStatus.vue -->
<template>
  <div
    v-if="store.needsAttention"
    class="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg px-4 py-3 shadow-lg transition-all"
    :class="store.syncStatusColor.replace('text-', 'bg-').replace('bg-', 'text-white bg-')"
  >
    <!-- Icône -->
    <component :is="iconComponent" class="h-4 w-4" />

    <!-- Texte -->
    <span class="text-sm font-medium">{{ store.syncStatusLabel }}</span>

    <!-- Bouton de sync manuelle -->
    <button
      v-if="store.syncStatus === 'pending'"
      @click="$emit('sync')"
      class="ml-2 rounded-md bg-white/20 px-2 py-1 text-xs hover:bg-white/30"
    >
      Sync
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useOfflineStore } from '@/composables/offline/offlineStore'
import RefreshIcon from '@/icons/RefreshIcon.vue'
import WarningIcon from '@/icons/WarningIcon.vue'
import InfoIcon from '@/icons/InfoIcon.vue'

defineEmits<{ sync: [] }>()

const store = useOfflineStore()

const iconComponent = computed(() => {
  switch (store.syncStatus) {
    case 'syncing': return RefreshIcon
    case 'offline': return WarningIcon
    case 'pending': return InfoIcon
    default: return InfoIcon
  }
})
</script>
```

### 6.4 Intégration dans le Header

Dans `AppHeader.vue`, ajouter l'indicateur à côté du menu utilisateur :

```vue
<!-- Dans le template du header -->
<div class="flex items-center gap-3">
  <!-- Indicateur de statut -->
  <div
    class="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
    :class="offlineStore.syncStatusColor"
    :title="offlineStore.syncStatus === 'offline' ? 'Mode hors ligne actif' : ''"
  >
    <span
      class="h-1.5 w-1.5 rounded-full"
      :class="offlineStore.syncStatus === 'online' ? '' : 'animate-pulse'"
    ></span>
    {{ offlineStore.syncStatusLabel }}
  </div>

  <!-- Menu utilisateur existant -->
  <UserMenu />
</div>
```

---

## 7. File d'Attente Hors Ligne (Offline Queue)

### 7.1 Service de File d'Attente

```typescript
// src/services/offline/queueService.ts
import { v4 as uuidv4 } from 'uuid'
import { db } from './db'
import { OfflineCacheService } from './cacheService'

export interface EnqueueOptions {
  priority?: number
  resourceId?: number
  optimisticData?: any
}

export class OfflineQueueService {
  // Priorités
  static PRIORITY_CRITICAL = 10  // Check-in/out, paiements
  static PRIORITY_HIGH = 7       // Création réservation, transaction folio
  static PRIORITY_NORMAL = 5     // Mise à jour client, modification réservation
  static PRIORITY_LOW = 2        // Notes, préférences

  /**
   * Ajouter une opération à la file d'attente
   * Stockée dans IndexedDB (survit aux rechargements)
   */
  static async enqueue(
    operationType: 'create' | 'update' | 'delete',
    resourceType: string,
    payload: any,
    options?: EnqueueOptions
  ): Promise<{ operationId: string; id: number }> {
    const operationId = uuidv4()

    const itemId = await db.queue.add({
      operationId,
      operationType,
      resourceType,
      resourceId: options?.resourceId,
      payload,
      priority: options?.priority ?? OfflineQueueService.PRIORITY_NORMAL,
      status: 'pending',
      createdAt: new Date().toISOString(),
      retryCount: 0,
    })

    // Mise à jour optimiste du cache local
    if (options?.optimisticData) {
      const localId = options.resourceId ?? `tmp-${operationId}`
      await OfflineCacheService.set(resourceType, localId, options.optimisticData, {
        ttlMs: 7 * 24 * 60 * 60 * 1000,
        pending: true,
      })
    }

    // Notifier le store
    const { useOfflineStore } = await import('@/composables/offline/offlineStore')
    const store = useOfflineStore()
    await store.refreshPendingCount()

    return { operationId, id: itemId }
  }

  /**
   * Récupérer les opérations en attente
   * Triée par priorité décroissante puis date croissante
   */
  static async getPending(): Promise<OfflineQueueItem[]> {
    const items = await db.queue
      .where('status')
      .anyOf('pending', 'failed')
      .toArray()

    return items.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })
  }

  /**
   * Marquer comme complété
   */
  static async markCompleted(id: number, serverResponse: any) {
    const item = await db.queue.get(id)
    if (!item) return

    await db.queue.update(id, { status: 'completed' })

    // Mettre à jour le cache avec la réponse serveur
    const serverId = serverResponse?.serverId ?? serverResponse?.data?.id
    if (serverId && item.resourceType) {
      // Si c'était une création, remplacer l'ID temporaire
      if (item.operationType === 'create' && item.resourceId) {
        await OfflineCacheService.invalidate(item.resourceType, item.resourceId)
      }
      await OfflineCacheService.syncFromServer(
        item.resourceType,
        serverId,
        serverResponse?.data ?? item.payload,
        serverResponse?.version ?? 1
      )
    }
  }

  /**
   * Marquer comme échoué
   */
  static async markFailed(
    id: number,
    error: string,
    retryable: boolean,
    conflict?: any
  ) {
    const item = await db.queue.get(id)
    if (!item) return

    if (retryable && item.retryCount < 3) {
      // Réessayable : repasser en pending
      await db.queue.update(id, {
        status: 'pending',
        retryCount: item.retryCount + 1,
        lastError: error,
      })
    } else if (conflict) {
      // Conflit : stocker pour résolution manuelle
      await db.queue.update(id, {
        status: 'failed',
        lastError: `Conflit: ${error}`,
      })
      await db.cache.put({
        id: `conflict:${item.operationId}`,
        resourceType: 'conflict',
        resourceId: item.operationId,
        data: { ...conflict, operationId: item.operationId },
        version: 0,
        updatedAt: new Date().toISOString(),
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      })
    } else {
      // Échec définitif
      await db.queue.update(id, {
        status: 'failed',
        lastError: error,
      })
    }

    const { useOfflineStore } = await import('@/composables/offline/offlineStore')
    const store = useOfflineStore()
    await store.refreshPendingCount()
  }

  /**
   * Obtenir le compte des opérations par priorité
   */
  static async getPrioritySummary(): Promise<Record<string, number>> {
    const pending = await this.getPending()
    const summary: Record<string, number> = {
      critical: 0,
      high: 0,
      normal: 0,
      low: 0,
    }
    for (const op of pending) {
      if (op.priority >= 10) summary.critical++
      else if (op.priority >= 7) summary.high++
      else if (op.priority >= 4) summary.normal++
      else summary.low++
    }
    return summary
  }
}
```

---

## 8. Proxy API Intelligent

### 8.1 OfflineAwareApiCall

```typescript
// src/services/offline/apiProxy.ts
import apiClient from '@/services/apiClient'
import { OfflineQueueService } from './queueService'
import { OfflineCacheService } from './cacheService'
import { useOfflineStore } from '@/composables/offline/offlineStore'

type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

interface ApiCallOptions {
  data?: any
  params?: any
  resourceType?: string
  resourceId?: number | string
  queuePriority?: number
  optimisticData?: any
  cacheTTL?: number
}

interface ApiCallResult<T = any> {
  data: T
  fromCache?: boolean
  offlineQueued?: boolean
}

export async function offlineAwareApiCall<T = any>(
  method: ApiMethod,
  url: string,
  options?: ApiCallOptions
): Promise<ApiCallResult<T>> {
  const store = useOfflineStore()

  // Si en ligne → appel API normal
  if (store.isOnline) {
    try {
      const response = await apiClient.request<T>({
        method,
        url,
        data: options?.data,
        params: options?.params,
      })

      // Mettre en cache les GET
      if (method === 'GET' && options?.resourceType) {
        const id = options.resourceId ?? url
        await OfflineCacheService.set(options.resourceType, id, response.data, {
          ttlMs: options.cacheTTL,
        })
      }

      // Mettre à jour le cache après écriture
      if (['POST', 'PUT', 'PATCH'].includes(method) && options?.resourceType && response.data) {
        const id = response.data.id ?? response.data.serverId ?? options.resourceId
        if (id) {
          await OfflineCacheService.set(options.resourceType, id, response.data, {
            ttlMs: options.cacheTTL,
          })
        }
      }

      return { data: response.data }
    } catch (error: any) {
      // Si erreur réseau → fallback offline
      if (isNetworkError(error)) {
        return handleOfflineFallback(method, url, options)
      }
      throw error
    }
  }

  // Si hors ligne → comportement offline
  return handleOfflineFallback(method, url, options)
}

function isNetworkError(error: any): boolean {
  return !error.response
    || error.code === 'ECONNABORTED'
    || error.message === 'Network Error'
    || error.message?.includes('timeout')
}

async function handleOfflineFallback<T>(
  method: ApiMethod,
  url: string,
  options?: ApiCallOptions
): Promise<ApiCallResult<T>> {
  const resourceType = options?.resourceType

  // GET : retourner le cache
  if (method === 'GET' && resourceType) {
    const id = options.resourceId ?? url
    const cached = await OfflineCacheService.get<T>(resourceType, id)
    if (cached) {
      return { data: cached.data, fromCache: true }
    }
    throw new Error('Données non disponibles hors ligne')
  }

  // GET sans cache : chercher dans la liste
  if (method === 'GET' && !options?.resourceId && resourceType) {
    const allData = await OfflineCacheService.getAll<T>(resourceType)
    if (allData.length > 0) {
      return { data: allData as unknown as T, fromCache: true }
    }
    throw new Error('Données non disponibles hors ligne')
  }

  // POST / PUT / PATCH / DELETE : ajouter à la file d'attente
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const { operationId } = await OfflineQueueService.enqueue(
      methodToOperationType(method),
      resourceType || 'unknown',
      options?.data,
      {
        priority: options?.queuePriority,
        resourceId: options?.resourceId,
        optimisticData: options?.optimisticData,
      }
    )

    return {
      data: (options?.optimisticData || {
        _offlineQueued: true,
        _operationId: operationId,
        _message: 'Opération mise en attente de synchronisation',
      }) as T,
      fromCache: false,
      offlineQueued: true,
    }
  }

  throw new Error(`Opération ${method} non supportée hors ligne pour ${resourceType}`)
}

function methodToOperationType(method: ApiMethod): 'create' | 'update' | 'delete' {
  switch (method) {
    case 'POST': return 'create'
    case 'PUT':
    case 'PATCH': return 'update'
    case 'DELETE': return 'delete'
    default: return 'update'
  }
}
```

---

## 9. Comportement par Module

### 9.1 Réservations — Module Critique

| Action | En Ligne | Hors Ligne | Priorité Queue |
|--------|----------|-------------|----------------|
| **Consultation planning** | API → cache | Cache IndexedDB (30j) | — |
| **Check-in** | API → mise à jour cache | Queue + UI optimiste (statut "checked-in" local) | 🔴 10 |
| **Check-out** | API → mise à jour cache | Queue + UI optimiste | 🔴 10 |
| **Création réservation** | API → ID serveur | Queue + ID temporaire `tmp-{uuid}` | 🟠 7 |
| **Modification séjour** | API | Queue | 🟡 5 |
| **Annulation** | API | Queue | 🟠 8 |
| **No-show** | API | Queue | 🟠 8 |
| **Room move** | API | Queue | 🟠 7 |

**Check-in hors ligne — UX :**
```typescript
// Hors ligne, le check-in met immédiatement à jour l'affichage
// Le statut réel sera validé par le serveur à la sync
const result = await offlineAwareApiCall('POST', `/reservation/${id}/checkin`, {
  data: payload,
  resourceType: 'reservation',
  resourceId: id,
  queuePriority: OfflineQueueService.PRIORITY_CRITICAL,
  optimisticData: {
    id,
    reservationStatus: 'Checked-In',
    actualArrivalDatetime: new Date().toISOString(),
    _pending: true,
    _operationId: 'tmp-' + uuidv4(),
  },
})

// Dans l'UI, un badge "🔶 En attente" apparaît sur la réservation
```

### 9.2 Finances & Folios — Module Critique

| Principe | Description |
|----------|-------------|
| **Mise à jour optimiste** | Le solde du folio est calculé localement |
| **Server-wins en cas de conflit** | Le serveur a toujours raison pour les montants |
| **Badge "Provisoire"** | Transactions non synchronisées affichées en orange |

```typescript
// Ajout de paiement hors ligne
async function addPayment(folioId: number, paymentData: any) {
  const cached = await OfflineCacheService.get<any>('folio', folioId)
  const localBalance = (cached?.data?.balance || 0) - paymentData.amount

  const result = await offlineAwareApiCall('POST', '/folios/transactions', {
    data: { folioId, ...paymentData },
    resourceType: 'folio_transaction',
    queuePriority: OfflineQueueService.PRIORITY_CRITICAL,
    optimisticData: {
      id: `tmp-${uuidv4()}`,
      folioId,
      amount: -paymentData.amount,
      balance: localBalance,
      status: 'pending_sync',
      _pending: true,
    },
  })

  return result
}
```

### 9.3 Clients — Module Haute Priorité

| Action | Hors Ligne |
|--------|------------|
| **Création** | Queue + ID temporaire |
| **Modification** | Queue |
| **Recherche** | Cache local IndexedDB |
| **Ajout note** | Queue (priorité basse) |

### 9.4 Housekeeping / Chambres — Temps Réel

```typescript
// Changement de statut : mise à jour locale immédiate + sync
// Priorité haute car multi-utilisateurs

async function updateRoomStatus(roomId: number, status: string) {
  return offlineAwareApiCall('PATCH',
    `/configuration/hotels/${hotelId}/rooms/${roomId}/status`,
    {
      data: { status },
      resourceType: 'room',
      resourceId: roomId,
      queuePriority: OfflineQueueService.PRIORITY_HIGH,
      optimisticData: {
        id: roomId,
        status,
        _pending: true,
      },
    }
  )
}
```

### 9.5 Configuration — Cache Longue Durée

Lecture seule, pas d'écriture hors ligne nécessaire. Cache longue durée :

| Ressource | Durée Cache | TTL |
|-----------|-------------|-----|
| Types de chambres | 7 jours | `StaleWhileRevalidate` |
| Tarifs | 7 jours | `StaleWhileRevalidate` |
| Suppléments | 7 jours | `StaleWhileRevalidate` |
| Méthodes de paiement | 7 jours | `StaleWhileRevalidate` |
| Taxes | 7 jours | `StaleWhileRevalidate` |
| Remises | 7 jours | `StaleWhileRevalidate` |

---

## 10. Synchronisation Automatique

### 10.1 SyncManager

```typescript
// src/composables/offline/useSyncManager.ts
import { ref } from 'vue'
import { useOfflineStore } from './offlineStore'
import { OfflineQueueService } from '@/services/offline/queueService'
import { OfflineCacheService } from '@/services/offline/cacheService'
import apiClient from '@/services/apiClient'
import { db } from '@/services/offline/db'

export function useSyncManager() {
  const store = useOfflineStore()
  const isInitialLoading = ref(false)

  /**
   * Chargement initial : récupère toutes les données pour l'offline
   * À appeler quand l'utilisateur sélectionne un hôtel
   */
  async function initialLoad(hotelId: number) {
    isInitialLoading.value = true
    store.setSyncing(true)

    try {
      const deviceId = getDeviceId()
      const response = await apiClient.post('/api/sync/initial-load', {
        hotelId,
        deviceId,
      })

      const { data, checkpoint } = response.data

      for (const [resourceType, resources] of Object.entries(data)) {
        if (Array.isArray(resources)) {
          for (const resource of resources) {
            await OfflineCacheService.set(resourceType, resource.id, resource, {
              ttlMs: OfflineCacheService.TTL_CONFIG,
            })
          }
        }
      }

      store.setLastSync(new Date().toISOString())
      return { totalItems: Object.values(data).reduce((sum: number, arr: any) =>
        sum + (Array.isArray(arr) ? arr.length : 1), 0
      )}
    } catch (error) {
      console.error('Erreur chargement initial offline:', error)
      throw error
    } finally {
      isInitialLoading.value = false
      store.setSyncing(false)
    }
  }

  /**
   * Synchronisation complète : Push + Pull
   */
  async function sync(hotelId: number) {
    if (!navigator.onLine || store.isSyncing.value) {
      return { synced: 0, message: 'Déjà en cours ou hors ligne' }
    }

    store.setSyncing(true)

    try {
      // ===== ÉTAPE 1 : PUSH =====
      const pending = await OfflineQueueService.getPending()
      let pushedCount = 0
      let conflictCount = 0

      if (pending.length > 0) {
        const pushResponse = await apiClient.post('/api/sync/push', {
          hotelId,
          deviceId: getDeviceId(),
          operations: pending.map(op => ({
            operationId: op.operationId,
            operationType: op.operationType,
            resourceType: op.resourceType,
            resourceId: op.resourceId,
            payload: op.payload,
            clientTimestamp: op.createdAt,
            priority: op.priority,
          })),
        })

        const pushResult = pushResponse.data

        for (const processed of pushResult.processed) {
          const item = pending.find(p => p.operationId === processed.operationId)
          if (item?.id) {
            await OfflineQueueService.markCompleted(item.id, processed)
            pushedCount++
          }
        }

        for (const conflict of pushResult.conflicts) {
          const item = pending.find(p => p.operationId === conflict.operationId)
          if (item?.id) {
            await OfflineQueueService.markFailed(
              item.id,
              `Version conflict: server v${conflict.serverVersion} > client v${conflict.clientVersion}`,
              false,
              conflict
            )
            conflictCount++
          }
        }

        for (const error of pushResult.errors) {
          const item = pending.find(p => p.operationId === error.operationId)
          if (item?.id) {
            await OfflineQueueService.markFailed(
              item.id,
              error.error,
              error.retryable
            )
          }
        }
      }

      // ===== ÉTAPE 2 : PULL =====
      const lastCheckpoint = await db.checkpoints
        .where('resourceType')
        .equals('*')
        .first()

      const pullResponse = await apiClient.post('/api/sync/pull', {
        hotelId,
        deviceId: getDeviceId(),
        lastSyncVersion: lastCheckpoint?.lastVersion || 0,
        resourceTypes: ['reservation', 'guest', 'room', 'folio', 'folio_transaction'],
      })

      const pullResult = pullResponse.data
      let pulledCount = 0

      for (const [resourceType, changes] of Object.entries(pullResult.changes)) {
        const typedChanges = changes as any

        for (const created of typedChanges.created) {
          await OfflineCacheService.syncFromServer(resourceType, created.id, created, created.version)
          pulledCount++
        }
        for (const updated of typedChanges.updated) {
          await OfflineCacheService.syncFromServer(resourceType, updated.id, updated, updated.version)
          pulledCount++
        }
        for (const deleted of typedChanges.deleted) {
          await OfflineCacheService.invalidate(resourceType, deleted.id)
          pulledCount++
        }
      }

      // Mettre à jour le checkpoint
      await db.checkpoints.put({
        resourceType: '*',
        lastVersion: pullResult.checkpoint,
        lastSyncAt: new Date().toISOString(),
      })

      store.setLastSync(new Date().toISOString())
      await store.refreshPendingCount()

      return {
        pushed: pushedCount,
        pulled: pulledCount,
        conflicts: conflictCount,
      }
    } catch (error) {
      console.error('Erreur synchronisation:', error)
      throw error
    } finally {
      store.setSyncing(false)
    }
  }

  return { initialLoad, sync, isInitialLoading }
}

function getDeviceId(): string {
  let deviceId = localStorage.getItem('deviceId')
  if (!deviceId) {
    deviceId = `web-${uuidv4()}`
    localStorage.setItem('deviceId', deviceId)
  }
  return deviceId
}
```

### 10.2 Déclencheurs de Sync

```typescript
// Dans App.vue — à intégrer dans onMounted

// 1. Sync automatique à la reconnexion
window.addEventListener('app:online', async () => {
  const hotelId = serviceStore.serviceId
  if (hotelId) {
    const toast = useToast()
    toast.info('Synchronisation en cours...', { timeout: 2000 })

    try {
      const result = await syncManager.sync(hotelId)
      if (result.pushed > 0 || result.pulled > 0) {
        toast.success(
          `${result.pushed} envoyée(s), ${result.pulled} reçue(s)`
        )
      }
      if (result.conflicts > 0) {
        toast.warning(`${result.conflicts} conflit(s) à résoudre`)
      }
    } catch {
      toast.error('Échec de la synchronisation')
    }
  }
})

// 2. Sync périodique (toutes les 5 minutes si connecté)
let syncInterval: ReturnType<typeof setInterval> | null = null
watch(isOnline, (online) => {
  if (online && serviceStore.serviceId) {
    syncInterval = setInterval(() => {
      syncManager.sync(serviceStore.serviceId).catch(() => {})
    }, 5 * 60 * 1000)
  } else if (syncInterval) {
    clearInterval(syncInterval)
    syncInterval = null
  }
})
```

---

## 11. Gestion des Conflits (UI)

### 11.1 Modal de Résolution de Conflit

```vue
<!-- src/components/offline/ConflictResolutionModal.vue -->
<template>
  <RightSideModal :visible="visible" @close="$emit('close')">
    <template #title>
      <div class="flex items-center gap-2">
        <WarningIcon class="h-5 w-5 text-yellow-500" />
        <span>{{ $t('offline.conflict.title') }}</span>
      </div>
    </template>

    <div class="space-y-4 p-4">
      <p class="text-sm text-gray-600">
        {{ $t('offline.conflict.description') }}
      </p>

      <div class="rounded-lg bg-gray-50 p-3 text-sm">
        <span class="font-medium">{{ conflictLabel }}</span>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <!-- Version locale -->
        <div class="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div class="flex items-center gap-2 font-semibold text-blue-700">
            📱 {{ $t('offline.conflict.local') }}
          </div>
          <pre class="mt-2 max-h-40 overflow-auto rounded bg-white p-2 text-xs">
            {{ formatJSON(conflict?.clientData) }}
          </pre>
          <button
            @click="resolve('client_wins')"
            class="mt-3 w-full rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
          >
            {{ $t('offline.conflict.keepLocal') }}
          </button>
        </div>

        <!-- Version serveur -->
        <div class="rounded-lg border border-green-200 bg-green-50 p-4">
          <div class="flex items-center gap-2 font-semibold text-green-700">
            ☁️ {{ $t('offline.conflict.server') }}
          </div>
          <pre class="mt-2 max-h-40 overflow-auto rounded bg-white p-2 text-xs">
            {{ formatJSON(conflict?.serverData) }}
          </pre>
          <button
            @click="resolve('server_wins')"
            class="mt-3 w-full rounded-lg bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700"
          >
            {{ $t('offline.conflict.keepServer') }}
          </button>
        </div>
      </div>
    </div>
  </RightSideModal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import apiClient from '@/services/apiClient'
import { useOfflineStore } from '@/composables/offline/offlineStore'
import WarningIcon from '@/icons/WarningIcon.vue'

const props = defineProps<{
  visible: boolean
  conflict: any | null
}>()

const emit = defineEmits<{
  close: []
  resolved: []
}>()

const store = useOfflineStore()

const conflictLabel = computed(() => {
  if (!props.conflict) return ''
  const labels: Record<string, string> = {
    reservation: 'Réservation',
    guest: 'Client',
    folio: 'Folio',
    folio_transaction: 'Transaction',
    room: 'Chambre',
  }
  return `${labels[props.conflict.resourceType] || props.conflict.resourceType} #${props.conflict.resourceId}`
})

function formatJSON(data: any): string {
  try {
    return JSON.stringify(data, null, 2)
  } catch {
    return String(data)
  }
}

async function resolve(resolution: 'client_wins' | 'server_wins') {
  if (!props.conflict) return
  try {
    await apiClient.post(`/api/sync/conflicts/${props.conflict.id}/resolve`, { resolution })
    await store.refreshPendingCount()
    emit('resolved')
  } catch (error) {
    console.error('Erreur résolution conflit:', error)
  }
}
</script>
```

### 11.2 Badges dans les Listes

```vue
<!-- Composant badge à intégrer dans les tableaux -->
<template>
  <span
    v-if="pending"
    class="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800"
  >
    <RefreshIcon class="h-3 w-3 animate-spin" />
    {{ $t('offline.pending') }}
  </span>
  <span
  v-else-if="hasConflict"
  class="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 cursor-pointer"
  @click="$emit('showConflict', item)"
>
  <WarningIcon class="h-3 w-3" />
  {{ $t('offline.conflict.badge') }}
</span>
</template>

<script setup lang="ts">
defineProps<{
  pending: boolean
  hasConflict: boolean
  item?: any
}>()
defineEmits<{ showConflict: [item: any] }>()
</script>
```

---

## 12. Composables & Stores Offline

### 12.1 `useOfflineReady` — Vérifier Disponibilité

```typescript
// src/composables/offline/useOfflineReady.ts
import { ref, computed } from 'vue'
import { OfflineCacheService } from '@/services/offline/cacheService'

export function useOfflineReady(resourceType: string, minCount: number) {
  const isReady = ref(false)
  const loadedCount = ref(0)
  const progress = computed(() =>
    minCount > 0 ? Math.min(100, Math.round((loadedCount.value / minCount) * 100)) : 0
  )

  async function check() {
    const items = await OfflineCacheService.getAll(resourceType)
    loadedCount.value = items.length
    isReady.value = items.length >= minCount
  }

  return { isReady, progress, loadedCount, check }
}
```

### 12.2 `useOfflineForm` — Auto-Save Formulaires

```typescript
// src/composables/offline/useOfflineForm.ts
import { ref, watch, onUnmounted } from 'vue'
import { DraftService } from '@/services/offline/draftService'

export function useOfflineForm(formKey: string, formData: any) {
  const savedAt = ref<string | null>(null)
  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

  async function autoSave() {
    await DraftService.save(formKey, JSON.parse(JSON.stringify(formData.value)))
    savedAt.value = new Date().toISOString()
  }

  async function restoreDraft(): Promise<boolean> {
    const draft = await DraftService.restore(formKey)
    if (draft) {
      Object.assign(formData.value, draft)
      savedAt.value = new Date().toISOString()
      return true
    }
    return false
  }

  function clearDraft() {
    DraftService.delete(formKey)
    savedAt.value = null
  }

  // Auto-save 30s après la dernière modification
  watch(formData, () => {
    if (autoSaveTimer) clearTimeout(autoSaveTimer)
    autoSaveTimer = setTimeout(autoSave, 30000)
  }, { deep: true })

  // Sauvegarde immédiate au changement de page
  onUnmounted(() => {
    if (autoSaveTimer) clearTimeout(autoSaveTimer)
  })

  return { savedAt, restoreDraft, clearDraft, autoSave }
}
```

---

## 13. Points d'Intégration dans le Code Existant

### 13.1 Fichiers à Modifier

| Fichier | Modification |
|---------|--------------|
| **`vite.config.ts`** | Améliorer les stratégies Workbox (plusieurs patterns) |
| **`src/main.ts`** | Initialiser la connection + lancer sync |
| **`src/App.vue`** | Ajouter composant `ConnectionStatus`, écouteurs online/offline |
| **`src/composables/usePwaUpdate.ts`** | Ajouter `offlineReady`, améliorer la gestion mise à jour |
| **`src/services/apiClient.ts`** | Ajouter un interceptor pour le fallback offline |
| **`src/components/layout/AppHeader.vue`** | Ajouter indicateur statut connexion |
| **`src/router/index.ts`** | Ajouter guard pour page offline |

### 13.2 Nouveaux Fichiers à Créer

```
src/
├── components/
│   ├── common/
│   │   └── ConnectionStatus.vue
│   └── offline/
│       ├── SyncProgress.vue
│       └── ConflictResolutionModal.vue
├── composables/
│   └── offline/
│       ├── offlineStore.ts
│       ├── useConnection.ts
│       ├── useSyncManager.ts
│       ├── useOfflineReady.ts
│       └── useOfflineForm.ts
├── services/
│   └── offline/
│       ├── db.ts
│       ├── cacheService.ts
│       ├── queueService.ts
│       ├── draftService.ts
│       └── apiProxy.ts
└── views/
    └── Errors/
        └── OfflinePage.vue
```

---

## 14. Plan d'Implémentation

### Phase 1 : Renforcement PWA & IndexedDB (Semaine 1-2)

| # | Tâche | Fichiers |
|---|-------|----------|
| 1.1 | Améliorer stratégies Workbox dans `vite.config.ts` | `vite.config.ts` |
| 1.2 | Installer Dexie.js | `package.json` |
| 1.3 | Créer schéma IndexedDB | `src/services/offline/db.ts` |
| 1.4 | Service de cache local | `src/services/offline/cacheService.ts` |
| 1.5 | Service de brouillons (drafts) | `src/services/offline/draftService.ts` |

### Phase 2 : File d'Attente & Proxy API (Semaine 3-4)

| # | Tâche | Fichiers |
|---|-------|----------|
| 2.1 | Service file d'attente | `src/services/offline/queueService.ts` |
| 2.2 | Proxy API offline-aware | `src/services/offline/apiProxy.ts` |
| 2.3 | Store offline (Pinia) | `src/composables/offline/offlineStore.ts` |
| 2.4 | Composable useConnection | `src/composables/offline/useConnection.ts` |
| 2.5 | Composable useSyncManager | `src/composables/offline/useSyncManager.ts` |

### Phase 3 : UI & Indicateurs (Semaine 5)

| # | Tâche | Composant |
|---|-------|-----------|
| 3.1 | Badge statut dans AppHeader | AppHeader.vue |
| 3.2 | Composant ConnectionStatus flottant | ConnectionStatus.vue |
| 3.3 | Modal résolution conflits | ConflictResolutionModal.vue |
| 3.4 | Page hors ligne | OfflinePage.vue |
| 3.5 | Composable useOfflineForm (auto-save) | useOfflineForm.ts |

### Phase 4 : Intégration Métier (Semaine 6-8)

| # | Module | Priorité |
|---|--------|----------|
| 4.1 | Réservations (check-in/out, création) | 🔴 Critique |
| 4.2 | Folios & Transactions financières | 🔴 Critique |
| 4.3 | Clients (création, modification) | 🟡 Haute |
| 4.4 | Housekeeping (statuts chambres) | 🟡 Haute |
| 4.5 | Configuration (lecture seule) | 🟢 Normale |

### Phase 5 : Tests & Finalisation (Semaine 9-10)

| # | Tâche |
|---|-------|
| 5.1 | Tests unitaires (cache, queue, proxy) |
| 5.2 | Tests fonctionnels offline simulé |
| 5.3 | Validation UX avec utilisateurs |
| 5.4 | Documentation |

---

## Annexe : Nouveaux Packages Requis

```json
{
  "dependencies": {
    "dexie": "^4.0.8"
  },
  "devDependencies": {
    "@types/uuid": "^10.0.0"
  }
}
```

> **Note** : `uuid` est déjà dans le projet (utilisé dans `bookingDraftStore` et autres). `vite-plugin-pwa` est déjà installé.



⚠️ Ce qui manque encore pour un offline complet
- Une seule stratégie Workbox générique :  /api/*  en NetworkFirst avec 50 entrées max
- Pas de différenciation GET/POST : les écritures échouent silencieusement hors ligne
- Pas d'IndexedDB structuré pour le cache applicatif (Dexie.js)
- Pas de file d'attente offline pour les opérations différées
- Pas d'indicateur de connexion visible dans l'UI