# Guide d'Implémentation du Mode Hors Ligne (Offline) - Enjoy PMS API

## 📋 Table des Matières

1. [Présentation & Contexte](#1-présentation--contexte)
2. [Analyse de l'Architecture Actuelle](#2-analyse-de-larchitecture-actuelle)
3. [Stratégie Générale pour le Mode Hors Ligne](#3-stratégie-générale-pour-le-mode-hors-ligne)
4. [Architecture de Synchronisation (Backend)](#4-architecture-de-synchronisation-backend)
5. [API de Synchronisation à Implémenter](#5-api-de-synchronisation-à-implémenter)
6. [Gestion des Conflits](#6-gestion-des-conflits)
7. [Service Worker & Cache API (Backend)](#7-service-worker--cache-api-backend)
8. [Endpoints API Détaillés](#8-endpoints-api-détaillés)
9. [Cas d'Usage Spécifiques PMS](#9-cas-dusage-spécifiques-pms)
10. [Sécurité & Validation](#10-sécurité--validation)
11. [Plan d'Implémentation par Phases](#11-plan-dimplémentation-par-phases)

---

## 1. Présentation & Contexte

### 1.1 L'application Enjoy PMS

**Enjoy PMS** est un système de gestion hôtelière (Property Management System) complet composé :

- **Backend API** : AdonisJS 6 (TypeScript) avec PostgreSQL
- **Frontend** : Application Vue.js avec PWA déjà configurée mais sous-utilisée
- **Intégrations** : Channex (channel manager), WhatsApp, Mailjet, POS

### 1.2 Pourquoi le mode hors ligne est critique

- **Contexte hôtelier** : La réception doit fonctionner même si internet est instable
- **Check-in / Check-out** : Opérations critiques qui ne peuvent pas attendre
- **Saisie de transactions** : Facturation en continu pendant les heures d'affluence
- **Utilisateurs mobiles** : Personnel d'étage, housekeeping, maintenance en zones sans WiFi

### 1.3 État actuel du PWA Frontend

Le frontend Vue.js dispose déjà d'un PWA (manifest, service worker) mais :
- Les appels API ne sont pas mis en cache
- Aucune file d'attente pour les requêtes hors ligne
- Aucune synchronisation des données locales
- Pas de stratégie de gestion de conflits

### 1.4 Objectifs

- Permettre les opérations critiques sans connexion internet
- Synchroniser automatiquement les données quand la connexion revient
- Assurer l'intégrité des données financières
- Offrir une expérience utilisateur transparente

---

## 2. Analyse de l'Architecture Actuelle

### 2.1 Stack Technique

| Couche | Technologie |
|--------|------------|
| **Framework Backend** | AdonisJS 6 avec TypeScript |
| **Base de données** | PostgreSQL (via @adonisjs/lucid ORM) |
| **Authentification** | JWT Access Tokens (tokensGuard) |
| **Temps réel** | Server-Sent Events (SSE) |
| **Cache** | In-memory (CurrencyCacheService) |
| **Tâches planifiées** | node-cron |
| **Stockage fichiers** | Supabase (images) |
| **PDF** | Puppeteer / html-pdf-node |
| **Email** | Mailjet |

### 2.2 Arborescence Backend

```
app/
├── controllers/    ~80 contrôleurs (API REST)
├── services/       ~55 services (logique métier)
├── models/         ~85 modèles (Lucid ORM)
├── middleware/     ~9 middlewares (auth, permissions, IP, etc.)
├── events/        Événements (night_audit, check-out)
├── listeners/     Écouteurs d'événements
├── hooks/         Hooks de modèles (reservation, room_type, transaction)
├── validators/    ~50 validateurs
├── enums.ts       Énumérations de l'application
└── types/         Définitions TypeScript

start/
├── routes.ts      Routes principales (~200 endpoints)
├── routes/
│   ├── external.ts Routes API publique
│   ├── pos.ts     Routes POS
│   └── reports.ts Routes rapports
├── kernel.ts      Middleware global
├── app.ts         Configuration Cron
├── scheduler.ts   Tâches planifiées
├── env.ts         Variables d'environnement
└── events.ts      Enregistrement événements

database/
└── migrations/    ~200 migrations PostgreSQL
```

### 2.3 Structure des Données Principales

```
┌───────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│     Hotel         │──────▶│    Room Type      │──────▶│      Room        │
├───────────────────┤       ├──────────────────┤       ├──────────────────┤
│ hotel_name        │       │ name             │       │ room_number      │
│ hotel_code        │       │ base_price       │       │ status           │
│ timezone          │       │ max_occupancy    │       │ housekeeping_st  │
│ currency_code     │       │ amenities        │       │ floor            │
└───────────────────┘       └──────────────────┘       └──────────────────┘
         │                                                       │
         ▼                                                       ▼
┌───────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│   Reservation     │──────▶│ ReservationRoom   │◀──────│    Room Block    │
├───────────────────┤       ├──────────────────┤       ├──────────────────┤
│ reservation_status│       │ check_in_date    │       │ start_date       │
│ scheduled_arrival │       │ check_out_date   │       │ end_date         │
│ guest_id          │       │ room_id          │       │ block_reason     │
└───────────────────┘       └──────────────────┘       └──────────────────┘
         │                                                       │
         ▼                                                       ▼
┌───────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│      Guest        │       │      Folio        │       │ ReservationGuest │
├───────────────────┤       ├──────────────────┤       ├──────────────────┤
│ first_name        │       │ folio_number      │       │ guest_type       │
│ last_name         │       │ balance           │       │ is_primary       │
│ email             │       │ status            │       │ room_assignment  │
│ phone             │       │ total_charges     │       └──────────────────┘
└───────────────────┘       │ total_payments    │
                             └──────────────────┘
                                      │
                                      ▼
                             ┌──────────────────┐
                             │FolioTransaction   │
                             ├──────────────────┤
                             │ transaction_number│
                             │ amount            │
                             │ category          │
                             │ transaction_date  │
                             └──────────────────┘
```

### 2.4 Flux des Requêtes Typique

```
Client ──▶ Middleware Stack ──▶ Route ──▶ Controller ──▶ Service ──▶ Model/DB
  ▲              │                │            │              │
  │              │                │            │              │
  │              ▼                ▼            ▼              ▼
  └─────── Response ◀───── JSON ◀───── Result ◀───── Data ◀───┘
```

**Middleware stack (kernel.ts)** :
1. `container_bindings_middleware` - Conteneur IoC
2. `force_json_response_middleware` - Force JSON
3. `cors_middleware` - CORS
4. `check_maintenance_middleware` - Cache de maintenance (10s TTL)
5. `initialize_auth_middleware` - Auth init
6. `bodyparser_middleware` - Body parser

**Named middleware** :
- `auth` - Authentification JWT
- `checkPermission` - Vérification permissions
- `apiKey` - Clé API externe
- `ipRestriction` - Restriction IP par hôtel
- `checkSubscription` - Vérification abonnement
- `permission` - Permissions ACL

### 2.5 Cache Existant

L'application dispose déjà d'un mécanisme de cache simple :

```typescript
// CurrencyCacheService - Cache in-memory avec TTL
export default class CurrencyCacheService {
  private static cache: Map<number, { payload: any; expiresAt: number }> = new Map()
  // TTL configurable via env CURRENCY_CACHE_TTL_SECONDS (default 7 jours)
}
```

Ce pattern peut être étendu pour le mode hors ligne.

### 2.6 Temps Réel

```typescript
// RealtimeNotifier - SSE (Server-Sent Events)
class RealtimeNotifier {
  private clients = new Map<number, Set<Client>>()
  
  subscribe(userId: number, res: ServerResponse) { /* SSE handshake */ }
  notify(notification: Notification) { /* push event to connected clients */ }
  unsubscribe(userId: number, client: Client) { /* cleanup */ }
}
```

Le SSE peut être utilisé pour notifier le frontend des changements à synchroniser.

---

## 3. Stratégie Générale pour le Mode Hors Ligne

### 3.1 Principe : "Offline-First avec Sync en Arrière-Plan"

```
┌─────────────────────────────────────────────────────────────────────┐
│                      FRONTEND (PWA + Vue.js)                       │
│                                                                     │
│  ┌──────────────┐  ┌────────────────┐  ┌────────────────────────┐  │
│  │  IndexedDB    │  │  Service Worker │  │  Sync Queue           │  │
│  │  (Données     │  │  (Cache API)   │  │  (Opérations en       │  │
│  │   locales)    │  │                │  │   attente)            │  │
│  └──────────────┘  └────────────────┘  └────────────────────────┘  │
│           │                 │                       │               │
│           ▼                 ▼                       ▼               │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                 Sync Manager                                  │   │
│  │  - Détection connexion (online/offline)                       │   │
│  │  - File d'attente FIFO                                       │   │
│  │  - Résolution de conflits                                    │   │
│  │  - Priorisation des opérations                               │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                    HTTPS (Sync API)
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       BACKEND (AdonisJS API)                        │
│                                                                     │
│  ┌────────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │  Sync Endpoints │  │  Conflict    │  │  Pending Operations   │  │
│  │  (Nouveaux)     │  │  Resolution  │  │  (Table sync_queue)   │  │
│  └────────────────┘  └──────────────┘  └────────────────────────┘  │
│           │                 │                       │               │
│           ▼                 ▼                       ▼               │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                 PostgreSQL                                    │   │
│  │  - Tables principales                                        │   │
│  │  - Table sync_operations (nouveau)                           │   │
│  │  - Table sync_conflicts (nouveau)                            │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Types d'Opérations Hors Ligne

| Type | Priorité | Stratégie | Exemples |
|------|----------|-----------|----------|
| **Lecture consultation** | Haute | Cache local + Stale-while-revalidate | Liste réservations, planning |
| **Écriture critique** | Très haute | Queue prioritaire + sync immédiate | Check-in, check-out, paiement |
| **Écriture normale** | Normale | Queue FIFO | Réservation, création client |
| **Écriture différée** | Basse | Sync en arrière-plan | Notes, préférences |
| **Configuration** | Haute | Cache longue durée (7j+) | Tarifs, types de chambres |

### 3.3 Principe de Fonctionnement

1. ✅ **En ligne (connecté)** : Appels API normaux, mise à jour du cache local
2. 📡 **Hors ligne (déconnecté)** : Utilisation du cache local, mise en file d'attente des écritures
3. 🔄 **Reconnexion** : Synchronisation automatique par ordre de priorité
4. ⚠️ **Conflit** : Résolution automatique ou manuelle selon le type de conflit

---

## 4. Architecture de Synchronisation (Backend)

### 4.1 Nouvelles Tables PostgreSQL

```sql
-- ============================================
-- Table: sync_operations
-- File d'attente des opérations hors ligne
-- ============================================
CREATE TABLE sync_operations (
  id              SERIAL PRIMARY KEY,
  hotel_id        INTEGER NOT NULL REFERENCES hotels(id),
  user_id         INTEGER NOT NULL REFERENCES users(id),
  operation_id    VARCHAR(64) NOT NULL UNIQUE,  -- UUID généré par le client
  operation_type  VARCHAR(32) NOT NULL,  -- 'create', 'update', 'delete'
  resource_type   VARCHAR(64) NOT NULL,  -- 'reservation', 'folio', etc.
  resource_id     INTEGER,               -- ID local du client (nullable)
  payload         JSONB NOT NULL,        -- Données de l'opération
  status          VARCHAR(16) NOT NULL DEFAULT 'pending',
  -- pending, processing, completed, conflicted, failed
  priority        INTEGER NOT NULL DEFAULT 0,
  client_timestamp TIMESTAMPTZ NOT NULL,  -- Horodatage côté client
  server_timestamp  TIMESTAMPTZ DEFAULT NOW(),
  conflict_data   JSONB,                  -- Détails en cas de conflit
  error_message   TEXT,
  retry_count     INTEGER DEFAULT 0,
  max_retries     INTEGER DEFAULT 3,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les requêtes de sync
CREATE INDEX idx_sync_ops_hotel_user ON sync_operations(hotel_id, user_id);
CREATE INDEX idx_sync_ops_status ON sync_operations(status);
CREATE INDEX idx_sync_ops_created ON sync_operations(created_at);

-- ============================================
-- Table: sync_conflicts
-- Historique des conflits de synchronisation
-- ============================================
CREATE TABLE sync_conflicts (
  id              SERIAL PRIMARY KEY,
  sync_operation_id INTEGER REFERENCES sync_operations(id),
  hotel_id        INTEGER NOT NULL REFERENCES hotels(id),
  resource_type   VARCHAR(64) NOT NULL,
  resource_id     INTEGER NOT NULL,
  client_version  INTEGER NOT NULL,       -- Version du côté client
  server_version  INTEGER NOT NULL,       -- Version actuelle côté serveur
  client_data     JSONB NOT NULL,         -- Données envoyées par le client
  server_data     JSONB NOT NULL,         -- Données actuelles sur le serveur
  resolution      VARCHAR(16) DEFAULT 'pending',
  -- pending, client_wins, server_wins, merged, manual
  resolved_by     INTEGER REFERENCES users(id),
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Table: sync_checkpoints
-- Suivi de l'état de synchronisation par client
-- ============================================
CREATE TABLE sync_checkpoints (
  id              SERIAL PRIMARY KEY,
  hotel_id        INTEGER NOT NULL REFERENCES hotels(id),
  user_id         INTEGER NOT NULL REFERENCES users(id),
  device_id       VARCHAR(64) NOT NULL,    -- Identifiant unique du device
  resource_type   VARCHAR(64) NOT NULL,    -- Type de ressource
  last_sync_at    TIMESTAMPTZ,             -- Dernière synchronisation
  last_version    BIGINT DEFAULT 0,        -- Dernier numéro de version reçu
  UNIQUE(hotel_id, user_id, device_id, resource_type)
);

-- ============================================
-- Colonnes à ajouter aux tables principales
-- ============================================

-- Version pour la gestion des conflits
-- (À ajouter à chaque table importante)
-- version INTEGER NOT NULL DEFAULT 1

-- Exemple pour reservations:
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE folios ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE folio_transactions ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Horodatage de dernière modification (si pas déjà présent)
-- updated_at existe déjà sur la plupart des tables via Lucid ORM

-- Index sur updated_at pour les requêtes incrementales
CREATE INDEX IF NOT EXISTS idx_reservations_updated ON reservations(updated_at);
CREATE INDEX IF NOT EXISTS idx_folios_updated ON folios(updated_at);
CREATE INDEX IF NOT EXISTS idx_folio_transactions_updated ON folio_transactions(updated_at);
CREATE INDEX IF NOT EXISTS idx_guests_updated ON guests(updated_at);
```

### 4.2 Migration AdonisJS

```typescript
// database/migrations/XXXXXXXXXXXXXX_create_sync_tables.ts

import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // Table sync_operations
    this.schema.createTable('sync_operations', (table) => {
      table.increments('id')
      table.integer('hotel_id').unsigned().notNullable().references('id').inTable('hotels')
      table.integer('user_id').unsigned().notNullable().references('id').inTable('users')
      table.string('operation_id', 64).notNullable().unique()
      table.string('operation_type', 32).notNullable()
      table.string('resource_type', 64).notNullable()
      table.integer('resource_id').nullable()
      table.jsonb('payload').notNullable()
      table.string('status', 16).notNullable().defaultTo('pending')
      table.integer('priority').notNullable().defaultTo(0)
      table.timestamp('client_timestamp').notNullable()
      table.timestamp('server_timestamp').defaultTo(this.now())
      table.jsonb('conflict_data').nullable()
      table.text('error_message').nullable()
      table.integer('retry_count').defaultTo(0)
      table.integer('max_retries').defaultTo(3)
      table.timestamp('created_at').defaultTo(this.now())
      table.timestamp('updated_at').defaultTo(this.now())
    })

    // Index
    this.schema.raw(`
      CREATE INDEX idx_sync_ops_hotel_user ON sync_operations(hotel_id, user_id);
      CREATE INDEX idx_sync_ops_status ON sync_operations(status);
      CREATE INDEX idx_sync_ops_created ON sync_operations(created_at);
    `)

    // Table sync_conflicts
    this.schema.createTable('sync_conflicts', (table) => {
      table.increments('id')
      table.integer('sync_operation_id').unsigned().references('id').inTable('sync_operations')
      table.integer('hotel_id').unsigned().notNullable().references('id').inTable('hotels')
      table.string('resource_type', 64).notNullable()
      table.integer('resource_id').notNullable()
      table.integer('client_version').notNullable()
      table.integer('server_version').notNullable()
      table.jsonb('client_data').notNullable()
      table.jsonb('server_data').notNullable()
      table.string('resolution', 16).defaultTo('pending')
      table.integer('resolved_by').unsigned().references('id').inTable('users')
      table.timestamp('resolved_at').nullable()
      table.timestamp('created_at').defaultTo(this.now())
    })

    // Table sync_checkpoints
    this.schema.createTable('sync_checkpoints', (table) => {
      table.increments('id')
      table.integer('hotel_id').unsigned().notNullable().references('id').inTable('hotels')
      table.integer('user_id').unsigned().notNullable().references('id').inTable('users')
      table.string('device_id', 64).notNullable()
      table.string('resource_type', 64).notNullable()
      table.timestamp('last_sync_at').nullable()
      table.bigInteger('last_version').defaultTo(0)
      table.unique(['hotel_id', 'user_id', 'device_id', 'resource_type'])
    })
  }

  async down() {
    this.schema.dropTable('sync_conflicts')
    this.schema.dropTable('sync_operations')
    this.schema.dropTable('sync_checkpoints')
  }
}
```

### 4.3 Modèles Backend

```typescript
// app/models/sync_operation.ts
import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Hotel from './hotel.js'
import User from './user.js'

export default class SyncOperation extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hotelId: number

  @column()
  declare userId: number

  @column()
  declare operationId: string

  @column()
  declare operationType: 'create' | 'update' | 'delete'

  @column()
  declare resourceType: string

  @column()
  declare resourceId: number | null

  @column()
  declare payload: Record<string, any>

  @column()
  declare status: 'pending' | 'processing' | 'completed' | 'conflicted' | 'failed'

  @column()
  declare priority: number

  @column.dateTime()
  declare clientTimestamp: DateTime

  @column.dateTime()
  declare serverTimestamp: DateTime

  @column()
  declare conflictData: Record<string, any> | null

  @column()
  declare errorMessage: string | null

  @column()
  declare retryCount: number

  @column()
  declare maxRetries: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relations
  @belongsTo(() => Hotel)
  declare hotel: BelongsTo<typeof Hotel>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
```

### 4.4 Service de Synchronisation

```typescript
// app/services/sync_service.ts

import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import SyncOperation from '#models/sync_operation'
import SyncConflict from '#models/sync_conflict'
import SyncCheckpoint from '#models/sync_checkpoint'
import Hotel from '#models/hotel'
import User from '#models/user'

interface SyncBatchRequest {
  hotelId: number
  userId: number
  deviceId: string
  lastSyncVersion: number
  operations: SyncOperationInput[]
}

interface SyncOperationInput {
  operationId: string
  operationType: 'create' | 'update' | 'delete'
  resourceType: string
  resourceId?: number
  payload: Record<string, any>
  clientTimestamp: string
  priority?: number
}

interface SyncBatchResponse {
  processed: SyncResult[]
  conflicts: SyncConflictResult[]
  errors: SyncError[]
  serverTime: string
  newCheckpoint: number
}

interface SyncResult {
  operationId: string
  status: 'completed'
  serverId: number  // ID attribué par le serveur
  version: number
}

interface SyncConflictResult {
  operationId: string
  resourceType: string
  resourceId: number
  clientVersion: number
  serverVersion: number
  clientData: Record<string, any>
  serverData: Record<string, any>
  resolution: 'server_wins' | 'client_wins' | 'manual'
}

interface SyncError {
  operationId: string
  error: string
  retryable: boolean
}

interface PullRequest {
  hotelId: number
  userId: number
  deviceId: string
  lastSyncVersion: number
  resourceTypes: string[]
}

interface PullResponse {
  changes: {
    [resourceType: string]: {
      created: any[]
      updated: any[]
      deleted: { id: number; deletedAt: string }[]
    }
  }
  serverTime: string
  checkpoint: number
}

// Service principal
export default class SyncService {
  /**
   * Version unique globale pour le suivi des changements
   * Utilise une séquence PostgreSQL
   */
  static async nextVersion(): Promise<number> {
    const result = await db.rawQuery("SELECT nextval('sync_version_seq') as version")
    return Number(result.rows[0].version)
  }

  /**
   * Traite un lot d'opérations hors ligne
   */
  static async processBatch(input: SyncBatchRequest): Promise<SyncBatchResponse> {
    const results: SyncResult[] = []
    const conflicts: SyncConflictResult[] = []
    const errors: SyncError[] = []

    // Trier par priorité (décroissante) puis par timestamp (croissant)
    const sortedOps = [...input.operations].sort((a, b) => {
      const priorityDiff = (b.priority || 0) - (a.priority || 0)
      if (priorityDiff !== 0) return priorityDiff
      return new Date(a.clientTimestamp).getTime() - new Date(b.clientTimestamp).getTime()
    })

    for (const op of sortedOps) {
      try {
        // Vérifier si déjà traité (idempotence)
        const existing = await SyncOperation.findBy('operation_id', op.operationId)
        if (existing) {
          if (existing.status === 'completed') {
            results.push({
              operationId: op.operationId,
              status: 'completed',
              serverId: existing.resourceId!,
              version: 0,
            })
            continue
          }
          if (existing.status === 'failed') {
            errors.push({ operationId: op.operationId, error: existing.errorMessage || 'Previous operation failed', retryable: false })
            continue
          }
        }

        // Enregistrer l'opération
        const syncOp = await SyncOperation.create({
          hotelId: input.hotelId,
          userId: input.userId,
          operationId: op.operationId,
          operationType: op.operationType,
          resourceType: op.resourceType,
          resourceId: op.resourceId || null,
          payload: op.payload,
          status: 'processing',
          priority: op.priority || 0,
          clientTimestamp: DateTime.fromISO(op.clientTimestamp),
        })

        // Exécuter l'opération selon le type
        const result = await this.executeOperation(op, input.hotelId, input.userId)

        // Marquer comme complété
        syncOp.status = 'completed'
        syncOp.resourceId = result.serverId
        syncOp.serverTimestamp = DateTime.now()
        await syncOp.save()

        results.push({
          operationId: op.operationId,
          status: 'completed',
          serverId: result.serverId,
          version: result.version,
        })
      } catch (error: any) {
        if (this.isConflictError(error)) {
          // Conflit de version
          const conflict = await this.createConflict(op, error, input.hotelId)
          conflicts.push({
            operationId: op.operationId,
            resourceType: op.resourceType,
            resourceId: op.resourceId || 0,
            clientVersion: op.payload?.version || 1,
            serverVersion: error.serverVersion,
            clientData: op.payload,
            serverData: error.serverData,
            resolution: 'server_wins',
          })
        } else {
          errors.push({
            operationId: op.operationId,
            error: error.message || 'Unknown error',
            retryable: this.isRetryable(error),
          })
          
          // Marquer comme échoué
          const syncOp = await SyncOperation.findBy('operation_id', op.operationId)
          if (syncOp) {
            syncOp.status = 'failed'
            syncOp.errorMessage = error.message
            syncOp.retryCount = (syncOp.retryCount || 0) + 1
            await syncOp.save()
          }
        }
      }
    }

    // Mettre à jour le checkpoint
    const version = await this.nextVersion()
    await SyncCheckpoint.updateOrCreate(
      { hotelId: input.hotelId, userId: input.userId, deviceId: input.deviceId, resourceType: '*' },
      { lastSyncAt: DateTime.now(), lastVersion: version }
    )

    return {
      processed: results,
      conflicts,
      errors,
      serverTime: DateTime.now().toISO()!,
      newCheckpoint: version,
    }
  }

  /**
   * Exécute une opération individuelle
   */
  private static async executeOperation(
    op: SyncOperationInput,
    hotelId: number,
    userId: number
  ): Promise<{ serverId: number; version: number }> {
    // Selon le type de ressource, appeler le service approprié
    switch (op.resourceType) {
      case 'reservation':
        return this.executeReservationOperation(op, hotelId, userId)
      case 'guest':
        return this.executeGuestOperation(op, hotelId, userId)
      case 'folio_transaction':
        return this.executeFolioTransactionOperation(op, hotelId, userId)
      case 'room':
        return this.executeRoomOperation(op, hotelId, userId)
      // ... ajouter d'autres types
      default:
        throw new Error(`Unsupported resource type: ${op.resourceType}`)
    }
  }

  /**
   * Pull des changements depuis le serveur
   */
  static async pullChanges(input: PullRequest): Promise<PullResponse> {
    const changes: PullResponse['changes'] = {}
    const fromVersion = input.lastSyncVersion

    for (const resourceType of input.resourceTypes) {
      changes[resourceType] = await this.getChanges(resourceType, fromVersion, input.hotelId)
    }

    const newVersion = await this.nextVersion()

    // Mettre à jour le checkpoint
    await SyncCheckpoint.updateOrCreate(
      { hotelId: input.hotelId, userId: input.userId, deviceId: input.deviceId, resourceType: '*' },
      { lastSyncAt: DateTime.now(), lastVersion: newVersion }
    )

    return {
      changes,
      serverTime: DateTime.now().toISO()!,
      checkpoint: newVersion,
    }
  }

  /**
   * Récupère les changements d'un type de ressource depuis une version donnée
   */
  private static async getChanges(
    resourceType: string,
    fromVersion: number,
    hotelId: number
  ): Promise<{ created: any[]; updated: any[]; deleted: { id: number; deletedAt: string }[] }> {
    const tableMap: Record<string, string> = {
      reservation: 'reservations',
      guest: 'guests',
      room: 'rooms',
      folio: 'folios',
      folio_transaction: 'folio_transactions',
      room_type: 'room_types',
      rate: 'room_rates',
      // ... mapper les autres types
    }

    const table = tableMap[resourceType]
    if (!table) return { created: [], updated: [], deleted: [] }

    // Récupérer les enregistrements modifiés depuis la dernière version
    const records = await db.rawQuery(`
      SELECT * FROM ${table}
      WHERE hotel_id = ? AND updated_at > (
        SELECT COALESCE(last_sync_at, '1970-01-01') FROM sync_checkpoints
        WHERE hotel_id = ? AND resource_type = ?
      )
      ORDER BY updated_at ASC
    `, [hotelId, hotelId, resourceType])

    const created: any[] = []
    const updated: any[] = []
    const deleted: { id: number; deletedAt: string }[] = []

    for (const row of records.rows) {
      if (row.is_deleted || row.status === 'deleted') {
        deleted.push({ id: row.id, deletedAt: row.updated_at || row.deleted_at })
      } else if (row.created_at === row.updated_at) {
        created.push(row)
      } else {
        updated.push(row)
      }
    }

    return { created, updated, deleted }
  }

  // Méthodes d'exécution par type de ressource
  private static async executeReservationOperation(
    op: SyncOperationInput, 
    hotelId: number, 
    userId: number
  ): Promise<{ serverId: number; version: number }> {
    // Importer le service de réservation
    const { default: ReservationService } = await import('#services/reservation_service')
    
    switch (op.operationType) {
      case 'create':
        const reservation = await ReservationService.createReservation(op.payload, userId, hotelId)
        return { serverId: reservation.id, version: reservation.version || 1 }
      
      case 'update':
        await this.checkVersionConflict('reservations', op.resourceId!, op.payload?.version)
        const updated = await ReservationService.updateReservation(op.resourceId!, op.payload, userId)
        return { serverId: updated.id, version: updated.version || (updated as any).version }
      
      case 'delete':
        await ReservationService.cancelReservation(op.resourceId!, userId)
        return { serverId: op.resourceId!, version: 0 }
      
      default:
        throw new Error(`Unknown operation type: ${op.operationType}`)
    }
  }

  private static async executeGuestOperation(
    op: SyncOperationInput,
    hotelId: number,
    userId: number
  ): Promise<{ serverId: number; version: number }> {
    switch (op.operationType) {
      case 'create':
        const { default: Guest } = await import('#models/guest')
        const guest = await Guest.create({
          ...op.payload,
          hotelId,
          createdBy: userId,
        })
        return { serverId: guest.id, version: 1 }
      
      case 'update':
        await this.checkVersionConflict('guests', op.resourceId!, op.payload?.version)
        const { default: GuestModel } = await import('#models/guest')
        const existingGuest = await GuestModel.findOrFail(op.resourceId!)
        existingGuest.merge({ ...op.payload, lastModifiedBy: userId })
        await existingGuest.save()
        return { serverId: existingGuest.id, version: (existingGuest as any).version || 1 }
      
      default:
        throw new Error(`Unknown operation type: ${op.operationType}`)
    }
  }

  private static async executeFolioTransactionOperation(
    op: SyncOperationInput,
    hotelId: number,
    userId: number
  ): Promise<{ serverId: number; version: number }> {
    const { default: FolioService } = await import('#services/folio_service')
    
    switch (op.operationType) {
      case 'create':
        const transaction = await FolioService.postTransaction({
          folioId: op.payload.folioId,
          transactionType: op.payload.transactionType,
          category: op.payload.category,
          description: op.payload.description,
          amount: op.payload.amount,
          paymentMethodId: op.payload.paymentMethodId,
          postedBy: userId,
          transactionDate: op.payload.transactionDate ? DateTime.fromISO(op.payload.transactionDate) : undefined,
        })
        return { serverId: transaction.id, version: (transaction as any).version || 1 }
      
      default:
        throw new Error(`Unknown operation type for folio_transaction: ${op.operationType}`)
    }
  }

  private static async executeRoomOperation(
    op: SyncOperationInput,
    hotelId: number,
    userId: number
  ): Promise<{ serverId: number; version: number }> {
    switch (op.operationType) {
      case 'update':
        if (op.payload.status) {
          // Changement de statut de chambre (housekeeping)
          const { default: Room } = await import('#models/room')
          const room = await Room.findOrFail(op.resourceId!)
          room.merge({
            status: op.payload.status,
            housekeepingStatus: op.payload.housekeepingStatus,
            lastModifiedBy: userId,
          })
          await room.save()
          return { serverId: room.id, version: (room as any).version || 1 }
        }
        throw new Error('No valid fields to update on room')
      
      default:
        throw new Error(`Unknown operation type for room: ${op.operationType}`)
    }
  }

  /**
   * Vérifie les conflits de version
   */
  private static async checkVersionConflict(
    table: string, 
    resourceId: number, 
    clientVersion?: number
  ): Promise<void> {
    if (!clientVersion) return // Pas de version = pas de vérification

    const result = await db.rawQuery(
      `SELECT version FROM ${table} WHERE id = ?`,
      [resourceId]
    )

    if (result.rows.length === 0) {
      throw new Error(`Resource not found: ${table}:${resourceId}`)
    }

    const serverVersion = result.rows[0].version
    if (serverVersion > clientVersion) {
      // Conflit détecté
      const serverData = await db.rawQuery(
        `SELECT * FROM ${table} WHERE id = ?`, 
        [resourceId]
      )
      const conflict = new Error('Version conflict detected') as any
      conflict.serverVersion = serverVersion
      conflict.serverData = serverData.rows[0]
      conflict.code = 'VERSION_CONFLICT'
      throw conflict
    }
  }

  /**
   * Détecte si une erreur est un conflit de version
   */
  private static isConflictError(error: any): boolean {
    return error.code === 'VERSION_CONFLICT'
  }

  /**
   * Détermine si une erreur est réessayable
   */
  private static isRetryable(error: any): boolean {
    const nonRetryable = [
      'VALIDATION_ERROR',
      'AUTHORIZATION_ERROR',
      'NOT_FOUND',
      'INVALID_STATE',
    ]
    return !nonRetryable.includes(error.code) && error.status !== 400 && error.status !== 404
  }

  /**
   * Crée un enregistrement de conflit
   */
  private static async createConflict(
    op: SyncOperationInput,
    error: any,
    hotelId: number
  ): Promise<SyncConflict> {
    const syncOp = await SyncOperation.findBy('operation_id', op.operationId)
    
    return SyncConflict.create({
      syncOperationId: syncOp?.id,
      hotelId,
      resourceType: op.resourceType,
      resourceId: op.resourceId || 0,
      clientVersion: op.payload?.version || 1,
      serverVersion: error.serverVersion,
      clientData: op.payload,
      serverData: error.serverData,
      resolution: 'pending',
    })
  }

  /**
   * Résout un conflit (appelé par l'admin ou automatiquement)
   */
  static async resolveConflict(
    conflictId: number,
    resolution: 'client_wins' | 'server_wins' | 'merged',
    resolvedBy: number
  ): Promise<void> {
    const conflict = await SyncConflict.findOrFail(conflictId)
    
    if (resolution === 'client_wins') {
      // Appliquer les données du client
      await db.rawQuery(
        `UPDATE ${this.getTableName(conflict.resourceType)} 
         SET data = ?::jsonb, version = version + 1, updated_at = NOW()
         WHERE id = ?`,
        [JSON.stringify(conflict.clientData), conflict.resourceId]
      )
    }
    // Si 'server_wins', ne rien faire (les données serveur sont conservées)

    conflict.resolution = resolution
    conflict.resolvedBy = resolvedBy
    conflict.resolvedAt = DateTime.now()
    await conflict.save()
  }

  private static getTableName(resourceType: string): string {
    const map: Record<string, string> = {
      reservation: 'reservations',
      guest: 'guests',
      room: 'rooms',
      folio: 'folios',
      folio_transaction: 'folio_transactions',
    }
    return map[resourceType] || resourceType + 's'
  }
}
```

### 4.5 Contrôleur de Synchronisation

```typescript
// app/controllers/sync_controller.ts

import type { HttpContext } from '@adonisjs/core/http'
import SyncService from '#services/sync_service'
import SyncOperation from '#models/sync_operation'
import SyncCheckpoint from '#models/sync_checkpoint'

export default class SyncController {
  /**
   * POST /api/sync/push
   * Envoie un lot d'opérations hors ligne au serveur
   */
  async push({ request, response, auth }: HttpContext) {
    const user = auth.user!
    const { hotelId, deviceId, lastSyncVersion, operations } = request.body()

    const result = await SyncService.processBatch({
      hotelId,
      userId: user.id,
      deviceId,
      lastSyncVersion: lastSyncVersion || 0,
      operations,
    })

    return response.ok(result)
  }

  /**
   * POST /api/sync/pull
   * Récupère les changements depuis le serveur
   */
  async pull({ request, response, auth }: HttpContext) {
    const user = auth.user!
    const { hotelId, deviceId, lastSyncVersion, resourceTypes } = request.body()

    const result = await SyncService.pullChanges({
      hotelId,
      userId: user.id,
      deviceId,
      lastSyncVersion: lastSyncVersion || 0,
      resourceTypes: resourceTypes || ['*'],
    })

    return response.ok(result)
  }

  /**
   * GET /api/sync/status
   * État de la synchronisation
   */
  async status({ request, response, auth }: HttpContext) {
    const user = auth.user!
    const hotelId = request.input('hotelId')

    const pendingCount = await SyncOperation.query()
      .where('hotelId', hotelId)
      .where('userId', user.id)
      .whereIn('status', ['pending', 'processing', 'failed'])
      .count('* as total')

    const lastCheckpoint = await SyncCheckpoint.query()
      .where('hotelId', hotelId)
      .where('userId', user.id)
      .first()

    return response.ok({
      pending: Number(pendingCount[0].$extras.total || 0),
      lastSyncAt: lastCheckpoint?.lastSyncAt,
      lastVersion: lastCheckpoint?.lastVersion || 0,
      serverTime: new Date().toISOString(),
    })
  }

  /**
   * GET /api/sync/conflicts
   * Liste les conflits non résolus
   */
  async conflicts({ request, response, auth }: HttpContext) {
    const user = auth.user!
    const hotelId = request.input('hotelId')

    const { default: SyncConflict } = await import('#models/sync_conflict')
    
    const conflicts = await SyncConflict.query()
      .where('hotelId', hotelId)
      .where('resolution', 'pending')

    return response.ok({ data: conflicts })
  }

  /**
   * POST /api/sync/conflicts/:id/resolve
   * Résout un conflit
   */
  async resolveConflict({ params, request, response, auth }: HttpContext) {
    const user = auth.user!
    const { resolution } = request.body()

    await SyncService.resolveConflict(params.id, resolution, user.id)

    return response.ok({ message: 'Conflict resolved' })
  }

  /**
   * POST /api/sync/initial-load
   * Charge initiale complète pour un nouveau device
   */
  async initialLoad({ request, response, auth }: HttpContext) {
    const user = auth.user!
    const { hotelId, deviceId } = request.body()

    // Charger les données de référence (configuration)
    const { default: Hotel } = await import('#models/hotel')
    const { default: RoomType } = await import('#models/room_type')
    const { default: Room } = await import('#models/room')
    const { default: RateType } = await import('#models/rate_type')
    const { default: RoomRate } = await import('#models/room_rate')
    const { default: ExtraCharge } = await import('#models/extra_charge')
    const { default: TaxRate } = await import('#models/tax_rate')
    const { default: Discount } = await import('#models/discount')
    const { default: PaymentMethod } = await import('#models/payment_method')
    const { default: Guest } = await import('#models/guest')

    const hotel = await Hotel.query()
      .where('id', hotelId)
      .preload('roomTypes', (q) => q.preload('rooms'))
      .preload('paymentMethods')
      .firstOrFail()

    // Récupérer les données récentes (30 derniers jours + futurs)
    const thirtyDaysAgo = DateTime.now().minus({ days: 30 }).toSQL()
    
    const { default: Reservation } = await import('#models/reservation')
    const recentReservations = await Reservation.query()
      .where('hotelId', hotelId)
      .where((q) => {
        q.where('scheduled_arrival_date', '>=', thirtyDaysAgo)
          .orWhere('scheduled_departure_date', '>=', thirtyDaysAgo)
      })
      .preload('guest')
      .preload('reservationRooms', (q) => q.preload('room'))
      .preload('folios', (q) => q.preload('transactions'))

    const guests = await Guest.query()
      .where('hotelId', hotelId)
      .limit(500)
      .orderBy('updated_at', 'desc')

    const rates = await RoomRate.query()
      .whereIn('room_type_id', hotel.roomTypes.map(rt => rt.id))
      .where('date', '>=', thirtyDaysAgo)
      .limit(1000)

    // Créer le checkpoint initial
    const version = await SyncService.nextVersion()
    await SyncCheckpoint.updateOrCreate(
      { hotelId, userId: user.id, deviceId, resourceType: '*' },
      { lastSyncAt: DateTime.now(), lastVersion: version }
    )

    return response.ok({
      data: {
        hotel: hotel.serialize(),
        roomTypes: hotel.roomTypes.map(rt => rt.serialize()),
        rooms: hotel.roomTypes.flatMap(rt => 
          (rt as any).$preloaded?.rooms?.map((r: any) => r.serialize()) || []
        ),
        paymentMethods: hotel.paymentMethods.map(pm => pm.serialize()),
        rateTypes: await RateType.query().where('hotel_id', hotelId),
        rates,
        taxRates: await TaxRate.query().where('hotel_id', hotelId),
        extraCharges: await ExtraCharge.query().where('hotel_id', hotelId),
        discounts: await Discount.query().where('hotel_id', hotelId),
        reservations: recentReservations.map(r => r.serialize()),
        guests: guests.map(g => g.serialize()),
      },
      checkpoint: version,
    })
  }
}
```

### 4.6 Routes de Synchronisation

```typescript
// Dans start/routes.ts ou un fichier dédié
// start/routes/sync.ts

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import SyncController from '#controllers/sync_controller'

const syncController = new SyncController()

router
  .group(() => {
    router.post('/push', syncController.push.bind(syncController))
    router.post('/pull', syncController.pull.bind(syncController))
    router.post('/initial-load', syncController.initialLoad.bind(syncController))
    router.get('/status', syncController.status.bind(syncController))
    router.get('/conflicts', syncController.conflicts.bind(syncController))
    router.post('/conflicts/:id/resolve', syncController.resolveConflict.bind(syncController))
  })
  .prefix('/api/sync')
  .use(middleware.auth({ guards: ['api'] }))
  .use(middleware.checkSubscription('pms'))
```

---

## 5. API de Synchronisation - Endpoints

### 5.1 Endpoints Nouveaux

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/api/sync/push` | Envoyer les opérations hors ligne |
| `POST` | `/api/sync/pull` | Récupérer les changements |
| `POST` | `/api/sync/initial-load` | Chargement initial complet |
| `GET` | `/api/sync/status` | État de la synchronisation |
| `GET` | `/api/sync/conflicts` | Liste des conflits |
| `POST` | `/api/sync/conflicts/:id/resolve` | Résoudre un conflit |

### 5.2 Endpoints Existants à Adapter

Ces endpoints doivent retourner des informations de version supplémentaires :

| Endpoint | Modification |
|----------|--------------|
| `POST /api/reservation/create` | Retourner `version` + `updated_at` |
| `POST /api/reservation/:id/checkin` | Retourner `version` |
| `POST /api/folios/transactions` | Retourner `version` + `balance_after` |
| `GET /api/hotels/:id` | Ajouter `ETag` header |
| `GET /api/configuration/hotels/:id/rooms` | Ajouter `Last-Modified` header |

### 5.3 En-têtes HTTP de Caching

```typescript
// Middleware pour ajouter des headers de cache
// app/middleware/cache_headers_middleware.ts

import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class CacheHeadersMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const response = await next()
    
    // Ajouter des headers de cache aux réponses GET
    if (ctx.request.method() === 'GET') {
      const etag = ctx.response.getHeader('ETag')
      if (!etag) {
        const content = JSON.stringify(response)
        const crypto = await import('node:crypto')
        const hash = crypto.createHash('md5').update(content).digest('hex')
        ctx.response.header('ETag', `"${hash}"`)
      }
      ctx.response.header('Cache-Control', 'private, max-age=0, must-revalidate')
    }
    
    return response
  }
}
```

---

## 6. Gestion des Conflits

### 6.1 Stratégie par Type de Ressource

| Type de Ressource | Stratégie de Conflit | Raison |
|-------------------|---------------------|--------|
| **Réservation** | **Last-Write-Wins** | Opérations séquentielles, faible risque |
| **FolioTransaction** | **Server-Wins** | Intégrité financière critique |
| **Guest** | **Merge manuel** | Données client importantes |
| **Room (status)** | **Last-Write-Wins** | Statut en temps réel |
| **Configuration** | **Server-Wins** | Source de vérité : serveur |

### 6.2 Détection des Conflits

```
Client (version 3)                Serveur (version 5)
      │                                 │
      ├── PUT /reservation/123 ────────▶│
      │   { version: 3 }               │
      │                                 │
      │                                 ├── Vérification :
      │                                 │   Server version (5) > Client version (3)
      │                                 │   → CONFLICT DÉTECTÉ
      │                                 │
      │◀── 409 Conflict ───────────────┤
      │   {                            │
      │     serverVersion: 5,          │
      │     serverData: {...},         │
      │     resolution: 'server_wins'  │
      │   }                            │
      │                                 │
      ├── Décision automatique ────────▶│
      │   (ou manuelle via UI)          │
      │                                 │
```

### 6.3 Résolution Automatique

```typescript
// Logique de résolution automatique côté backend

function autoResolve(
  resourceType: string,
  clientData: any,
  serverData: any
): 'client_wins' | 'server_wins' | 'manual' {
  switch (resourceType) {
    case 'reservation':
      // Last-Write-Wins basé sur le timestamp
      return clientData.updatedAt > serverData.updatedAt ? 'client_wins' : 'server_wins'
    
    case 'folio_transaction':
      // Server-Wins pour l'intégrité financière
      return 'server_wins'
    
    case 'room':
      if (clientData.status !== serverData.status) {
        // Si le client vient de changer le statut, c'est probablement intentionnel
        return 'client_wins'
      }
      return 'server_wins'
    
    case 'guest':
      // Merge des champs non conflictuels
      return 'manual'
    
    default:
      return 'server_wins'
  }
}
```

### 6.4 Notification des Conflits

```typescript
// Dans SyncService, après détection de conflit
import notifier from '#services/realtime_notifier'

// Notifier l'utilisateur via SSE
notifier.notifyToUser(userId, {
  type: 'SYNC_CONFLICT',
  data: {
    resourceType: 'reservation',
    resourceId: 123,
    summary: `Conflit sur la réservation #123`,
    conflictId: conflict.id,
  },
})
```

---

## 7. Service Worker & Cache API (Côté Frontend)

### 7.1 Architecture du Service Worker

```javascript
// service-worker.js (côté frontend)

const CACHE_NAME = 'enjoy-pms-cache-v1'
const API_CACHE = 'enjoy-api-cache-v1'
const STATIC_CACHE = 'enjoy-static-v1'

// URLs à mettre en cache statiquement
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  // Assets build
]

// Stratégies de cache par type de requête
const STRATEGIES = {
  // Configuration hôtel - Cache First
  'configuration': cacheFirst,
  // Réservations récentes - Network First avec fallback cache
  'reservation': networkFirst,
  // Données temps réel (disponibilité) - Network Only
  'availability': networkOnly,
  // Requêtes POST (écritures) - Queue offline
  'mutations': offlineQueue,
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS)
    })
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    })
  )
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  
  // Ne pas intercepter les requêtes non-API
  if (!url.pathname.startsWith('/api/')) return
  
  // Appliquer la stratégie selon le pattern URL
  const strategy = getStrategy(url.pathname)
  
  event.respondWith(strategy(event.request))
})

// Stratégie: Cache First
async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  
  try {
    const response = await fetch(request)
    const cache = await caches.open(API_CACHE)
    cache.put(request, response.clone())
    return response
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

// Stratégie: Network First
async function networkFirst(request) {
  try {
    const response = await fetch(request)
    const cache = await caches.open(API_CACHE)
    cache.put(request, response.clone())
    return response
  } catch (error) {
    const cached = await caches.match(request)
    if (cached) return cached
    
    return new Response(JSON.stringify({ error: 'Offline', cached: false }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

// Stratégie: Network Only
async function networkOnly(request) {
  return fetch(request).catch(() => {
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  })
}
```

### 7.2 File d'Attente Hors Ligne (Frontend)

```javascript
// offline-queue.js (côté frontend)

class OfflineQueue {
  constructor() {
    this.dbName = 'enjoy-offline-queue'
    this.storeName = 'operations'
    this.db = null
  }

  async init() {
    return new Promise((resolve) => {
      const request = indexedDB.open(this.dbName, 1)
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, {
            keyPath: 'id',
            autoIncrement: true,
          })
          store.createIndex('status', 'status', { unique: false })
          store.createIndex('priority', 'priority', { unique: false })
          store.createIndex('createdAt', 'createdAt', { unique: false })
        }
      }
      
      request.onsuccess = (event) => {
        this.db = event.target.result
        resolve()
      }
    })
  }

  async enqueue(operation) {
    const tx = this.db.transaction(this.storeName, 'readwrite')
    const store = tx.objectStore(this.storeName)
    
    return store.add({
      operationId: crypto.randomUUID(),
      operationType: operation.type, // 'create' | 'update' | 'delete'
      resourceType: operation.resource,
      resourceId: operation.id || null,
      payload: operation.data,
      priority: operation.priority || 0,
      status: 'pending',
      createdAt: new Date().toISOString(),
      retryCount: 0,
    })
  }

  async getPending() {
    const tx = this.db.transaction(this.storeName, 'readonly')
    const store = tx.objectStore(this.storeName)
    const index = store.index('status')
    
    return new Promise((resolve) => {
      const request = index.getAll('pending')
      request.onsuccess = () => {
        const items = request.result
        // Trier par priorité puis date
        items.sort((a, b) => {
          if (b.priority !== a.priority) return b.priority - a.priority
          return new Date(a.createdAt) - new Date(b.createdAt)
        })
        resolve(items)
      }
    })
  }

  async markCompleted(id, serverResponse) {
    const tx = this.db.transaction(this.storeName, 'readwrite')
    const store = tx.objectStore(this.storeName)
    
    const item = await this.get(id)
    item.status = 'completed'
    item.serverResponse = serverResponse
    store.put(item)
  }

  async markFailed(id, error) {
    const tx = this.db.transaction(this.storeName, 'readwrite')
    const store = tx.objectStore(this.storeName)
    
    const item = await this.get(id)
    item.retryCount++
    if (item.retryCount >= 3) {
      item.status = 'failed'
    }
    item.lastError = error
    store.put(item)
  }

  async get(id) {
    const tx = this.db.transaction(this.storeName, 'readonly')
    const store = tx.objectStore(this.storeName)
    return new Promise((resolve) => {
      const request = store.get(id)
      request.onsuccess = () => resolve(request.result)
    })
  }

  async clear() {
    const tx = this.db.transaction(this.storeName, 'readwrite')
    const store = tx.objectStore(this.storeName)
    store.clear()
  }

  // Synchroniser avec le serveur
  async syncWithServer(apiBaseUrl, authToken) {
    const pending = await this.getPending()
    if (pending.length === 0) return { synced: 0, conflicts: [] }
    
    const batch = {
      operations: pending.map(op => ({
        operationId: op.operationId,
        operationType: op.operationType,
        resourceType: op.resourceType,
        resourceId: op.resourceId,
        payload: op.payload,
        clientTimestamp: op.createdAt,
        priority: op.priority,
      })),
    }
    
    try {
      const response = await fetch(`${apiBaseUrl}/api/sync/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(batch),
      })
      
      const result = await response.json()
      
      for (const processed of result.processed) {
        const item = pending.find(p => p.operationId === processed.operationId)
        if (item) await this.markCompleted(item.id, processed)
      }
      
      for (const conflict of result.conflicts) {
        const item = pending.find(p => p.operationId === conflict.operationId)
        if (item) {
          await this.markFailed(item.id, `Conflict: ${conflict.resolution}`)
        }
      }
      
      for (const error of result.errors) {
        const item = pending.find(p => p.operationId === error.operationId)
        if (item && !error.retryable) {
          await this.markFailed(item.id, error.error)
        }
      }
      
      return {
        synced: result.processed.length,
        conflicts: result.conflicts,
        errors: result.errors,
      }
    } catch (error) {
      console.error('Sync failed:', error)
      return { synced: 0, conflicts: [], errors: [{ error: error.message }] }
    }
  }
}

export default new OfflineQueue()
```

---

## 8. Endpoints API Détaillés

### 8.1 `POST /api/sync/push`

**Description** : Soumet un lot d'opérations effectuées hors ligne.

**Headers** :
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body** :
```json
{
  "hotelId": 1,
  "deviceId": "device-uuid-123",
  "lastSyncVersion": 42,
  "operations": [
    {
      "operationId": "uuid-v4-1",
      "operationType": "create",
      "resourceType": "guest",
      "payload": {
        "firstName": "Jean",
        "lastName": "Dupont",
        "email": "jean@example.com",
        "phonePrimary": "+237600000000"
      },
      "clientTimestamp": "2025-06-29T10:30:00.000Z",
      "priority": 1
    },
    {
      "operationId": "uuid-v4-2",
      "operationType": "update",
      "resourceType": "room",
      "resourceId": 42,
      "payload": {
        "status": "occupied",
        "version": 5
      },
      "clientTimestamp": "2025-06-29T10:31:00.000Z",
      "priority": 5
    }
  ]
}
```

**Response 200** :
```json
{
  "processed": [
    {
      "operationId": "uuid-v4-1",
      "status": "completed",
      "serverId": 1523,
      "version": 1
    },
    {
      "operationId": "uuid-v4-2",
      "status": "completed",
      "serverId": 42,
      "version": 6
    }
  ],
  "conflicts": [],
  "errors": [],
  "serverTime": "2025-06-29T10:31:05.000Z",
  "newCheckpoint": 43
}
```

### 8.2 `POST /api/sync/pull`

**Description** : Récupère les changements depuis le serveur depuis le dernier checkpoint.

**Body** :
```json
{
  "hotelId": 1,
  "deviceId": "device-uuid-123",
  "lastSyncVersion": 42,
  "resourceTypes": ["reservation", "guest", "room"]
}
```

**Response 200** :
```json
{
  "changes": {
    "reservation": {
      "created": [
        {
          "id": 456,
          "hotelId": 1,
          "guestId": 1523,
          "reservationStatus": "confirmed",
          "scheduledArrivalDate": "2025-07-01",
          "scheduledDepartureDate": "2025-07-03",
          "version": 1,
          "updatedAt": "2025-06-29T10:30:00.000Z"
        }
      ],
      "updated": [
        {
          "id": 123,
          "reservationStatus": "checked-in",
          "version": 4,
          "updatedAt": "2025-06-29T10:25:00.000Z"
        }
      ],
      "deleted": [
        {
          "id": 100,
          "deletedAt": "2025-06-29T10:20:00.000Z"
        }
      ]
    },
    "guest": {
      "created": [],
      "updated": [],
      "deleted": []
    },
    "room": {
      "created": [],
      "updated": [
        {
          "id": 42,
          "status": "dirty",
          "version": 7,
          "updatedAt": "2025-06-29T10:15:00.000Z"
        }
      ],
      "deleted": []
    }
  },
  "serverTime": "2025-06-29T10:31:05.000Z",
  "checkpoint": 43
}
```

### 8.3 `POST /api/sync/initial-load`

**Description** : Chargement initial complet pour un nouveau device (configuration + données récentes).

**Body** :
```json
{
  "hotelId": 1,
  "deviceId": "device-uuid-123"
}
```

**Response 200** :
```json
{
  "data": {
    "hotel": { ... },
    "roomTypes": [ ... ],
    "rooms": [ ... ],
    "paymentMethods": [ ... ],
    "rateTypes": [ ... ],
    "rates": [ ... ],
    "taxRates": [ ... ],
    "extraCharges": [ ... ],
    "discounts": [ ... ],
    "reservations": [ ... ],
    "guests": [ ... ]
  },
  "checkpoint": 100
}
```

---

## 9. Cas d'Usage Spécifiques PMS

### 9.1 Check-in Hors Ligne

```
1. Utilisateur clique "Check-in" sur une réservation
2. ✅ En ligne → Appel API POST /api/reservation/:id/checkin
3. 📡 Hors ligne →
   a. Mise à jour locale (IndexedDB) : réservation → statut "checked-in"
   b. Création du folio en local (avec ID temporaire)
   c. Ajout à la file d'attente : { type: "update", resource: "reservation", id: 123, data: { status: "checked-in" } }
   d. Ajout à la file d'attente : { type: "create", resource: "folio", data: { ... } }
4. 🔄 Reconnexion →
   a. Envoi du batch au serveur
   b. Le serveur traite le check-in (génère le vrai folio, met à jour les statuts)
   c. Le client reçoit le vrai serverId du folio
   d. Mise à jour du cache local
```

### 9.2 Transaction Financière Hors Ligne

```
1. Utilisateur ajoute un paiement sur un folio
2. 📡 Hors ligne →
   a. Ajout de la transaction dans IndexedDB avec statut "pending"
   b. Mise à jour du solde local (optimiste)
   c. File d'attente : { type: "create", resource: "folio_transaction", data: { folioId: 50, amount: -50000, ... } }
3. 🔄 Reconnexion →
   a. Envoi au serveur
   b. Le serveur vérifie l'intégrité :
      - Vérifie que le folio existe toujours
      - Vérifie qu'aucune transaction conflictuelle n'a eu lieu
      - Applique la transaction
      - Recalcule le solde du folio
   c. Retourne le solde mis à jour
   d. Le client corrige son cache local avec les données serveur
```

### 9.3 Changement de Statut de Chambre

```
1. Personnel d'étage marque une chambre comme "clean"
2. 📡 Hors ligne →
   a. Mise à jour locale : room.status = "available", room.housekeepingStatus = "clean"
   b. File d'attente priorité haute
3. 🔄 Reconnexion →
   a. Envoi immédiat (priorité haute)
   b. Le serveur met à jour, version +1
   c. Notification SSE aux autres clients connectés
```

### 9.4 Création de Réservation (Défi Important)

```
⚠️ DÉFI : La création de réservation génère des numéros uniques (confirmation_code, reservation_number)

Solutions :
1. **Pré-allocation de numéros** :
   - Le client demande un bloc de numéros : GET /api/sync/preallocate-numbers?count=10
   - Le serveur alloue N numéros dans une table `number_pool`
   - Le client peut créer N réservations hors ligne avec ces numéros
   
2. **Numéros temporaires côté client** :
   - Le client génère un UUID comme identifiant temporaire
   - Lors de la sync, le serveur remplace par un vrai numéro
   - Le client met à jour l'affichage

3. **Format hybride** :
   - Numéro local : "TMP-{hotelId}-{deviceId}-{timestamp}"
   - Le serveur remplace lors de la sync
   - Interface utilisateur informée du changement
```

---

## 10. Sécurité & Validation

### 10.1 Sécurité des Opérations Hors Ligne

| Risque | Mitigation |
|--------|------------|
| **Replay attack** | `operationId` unique, dédoublonnage côté serveur |
| **Opérations périmées** | Vérification du `clientTimestamp` (max 24h) |
| **Conflits financiers** | Server-Wins pour folio/transactions |
| **Données invalides** | Validation des payloads côté serveur (VineJS) |
| **Accès non autorisé** | Vérification auth + permissions + hotelId |
| **DoS via sync massive** | Rate limiting : max 100 operations/batch, max 10 batches/min |

### 10.2 Validation des Données

```typescript
// app/validators/sync.ts
import vine from '@vinejs/vine'

export const syncPushValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive(),
    deviceId: vine.string().uuid(),
    lastSyncVersion: vine.number().min(0),
    operations: vine.array(
      vine.object({
        operationId: vine.string().uuid(),
        operationType: vine.enum(['create', 'update', 'delete']),
        resourceType: vine.enum([
          'reservation', 'guest', 'room', 'folio', 'folio_transaction',
          'room_type', 'rate_type', 'room_rate', 'extra_charge',
        ]),
        resourceId: vine.number().positive().optional(),
        payload: vine.object({}).allowUnknownProperties(),
        clientTimestamp: vine.string().regex(/^\d{4}-\d{2}-\d{2}T/),
        priority: vine.number().min(0).max(10).optional(),
      })
    ).maxLength(100), // max 100 ops par batch
  })
)
```

### 10.3 Rate Limiting

```typescript
// app/middleware/sync_rate_limit_middleware.ts
// Limiter à 10 push/min par utilisateur + device

import { RateLimiter } from '@adonisjs/core/limiter'

export default class SyncRateLimitMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const key = `sync:${ctx.auth.user!.id}:${ctx.request.input('deviceId')}`
    
    const limiter = new RateLimiter(ctx)
    const canProceed = await limiter.points(key, {
      points: 10,  // 10 requests
      duration: 60, // par minute
    })
    
    if (!canProceed) {
      return ctx.response.tooManyRequests({
        message: 'Too many sync requests. Please wait before syncing again.',
        retryAfter: 60,
      })
    }
    
    return next()
  }
}
```

---

## 11. Plan d'Implémentation par Phases

### Phase 1 : Fondation (Semaine 1-2)

| Tâche | Description | Fichiers |
|-------|-------------|----------|
| **1.1** | Migration DB : tables sync + colonnes version | `database/migrations/*_create_sync_tables.ts` |
| **1.2** | Modèles : SyncOperation, SyncConflict, SyncCheckpoint | `app/models/sync_*.ts` |
| **1.3** | Service SyncService (base) | `app/services/sync_service.ts` |
| **1.4** | Controlleur SyncController (push/pull) | `app/controllers/sync_controller.ts` |
| **1.5** | Routes de sync | `start/routes/sync.ts` |
| **1.6** | Validateur sync | `app/validators/sync.ts` |

### Phase 2 : Cache Local & Service Worker (Semaine 3-4)

| Tâche | Description |
|-------|-------------|
| **2.1** | Service Worker avec stratégies de cache |
| **2.2** | IndexedDB pour les données locales (Dexie.js recommandé) |
| **2.3** | File d'attente hors ligne |
| **2.4** | Détection online/offline (navigator.onLine + événements) |
| **2.5** | Sync automatique à la reconnexion |

### Phase 3 : Gestion des Conflits (Semaine 5)

| Tâche | Description |
|-------|-------------|
| **3.1** | Détection des conflits de version |
| **3.2** | Résolution automatique par type |
| **3.3** | UI de résolution manuelle des conflits |
| **3.4** | Notifications de conflits via SSE |

### Phase 4 : Opérations Critiques Hors Ligne (Semaine 6-8)

| Tâche | Description | Priorité |
|-------|-------------|----------|
| **4.1** | Check-in / Check-out hors ligne | 🔴 Critique |
| **4.2** | Transactions financières hors ligne | 🔴 Critique |
| **4.3** | Changement statut chambre hors ligne | 🟡 Haute |
| **4.4** | Création de clients hors ligne | 🟡 Haute |
| **4.5** | Réservations hors ligne (avec préallocation numéros) | 🟡 Haute |
| **4.6** | Consultation planning hors ligne | 🟢 Normale |

### Phase 5 : Optimisation (Semaine 9-10)

| Tâche | Description |
|-------|-------------|
| **5.1** | Compression des données de sync (gzip) |
| **5.2** | Sync différentielle (seulement les champs modifiés) |
| **5.3** | Cache warming prédictif |
| **5.4** | Monitoring des conflits (logs + dashboard) |
| **5.5** | Tests de charge et stress test |

---

## Annexe A : Dépendances Requises (Côté Frontend)

```json
{
  "dependencies": {
    "dexie": "^4.0.0",           // IndexedDB wrapper
    "idb": "^8.0.0",            // IndexedDB lightweight
    "workbox-webpack-plugin": "^7.0.0",  // Service Worker
    "uuid": "^9.0.0"            // Génération d'UUID
  }
}
```

## Annexe B : État Initial du Service Worker (PWA Existant)

Le frontend Vue.js dispose déjà d'un PWA de base (probablement via `@vue/cli-plugin-pwa` ou `vite-plugin-pwa`). Les modifications suivantes sont nécessaires :

1. **workbox** : Ajouter des stratégies de cache pour les appels API
2. **Synchronisation** : Intégrer le `OfflineQueue` dans le cycle de vie du SW
3. **Notification** : Notifier l'utilisateur des changements de statut connecté/déconnecté

---

## Annexe C : Tests Recommandés

### Tests Unitaires
```typescript
// tests/unit/sync_service.spec.ts
- Test de détection de conflit
- Test de résolution automatique
- Test de validation des opérations
- Test de génération de version
```

### Tests d'Intégration
```typescript
// tests/functional/sync_push.spec.ts
- Test push d'opérations
- Test pull des changements
- Test initial-load
- Test conflit serveur-gagnant
- Test conflit client-gagnant
```

### Tests de Scénario
- Création de réservation hors ligne → sync → vérification
- Check-in hors ligne → sync → vérification statut
- Transaction financière hors ligne → sync → vérification solde
- Conflit de version → résolution automatique → vérification

---

> **Note** : Ce guide est un document d'architecture. Chaque phase doit être validée avec l'équipe avant implémentation. Les noms de fichiers et chemins sont basés sur la structure actuelle du projet Enjoy Backend.
