# Guide Complet du Mode Hors Ligne Frontend — Enjoy PMS

**Date :** 7 juillet 2026
**Version :** 1.0
**Contexte :** Projet EnjoyBackEnd (AdonisJS 6) + EnjoyAdmin (Vue 3 + PWA)

---

## Table des Matières

1. [Présentation & Objectifs](#1-présentation--objectifs)
2. [Architecture Générale Offline-First](#2-architecture-générale-offline-first)
3. [Base de Données Locale (IndexedDB) — Structure Complète](#3-base-de-données-locale-indexeddb--structure-complète)
4. [Le Mini-Serveur Offline — Deux Stratégies](#4-le-mini-serveur-offline--deux-stratégies)
5. [Option A : L'Intercepteur Service Worker](#5-option-a--lintercepteur-service-worker)
6. [Option B : L'Abstraction Proxy API (offlineAwareApiCall)](#6-option-b--labstraction-proxy-api-offlineawareapicall)
7. [Simulation des Écritures (Le Défi Principal)](#7-simulation-des-écritures-le-défi-principal)
8. [File d'Attente (Outbox Queue)](#8-file-dattente-outbox-queue)
9. [Synchronisation Automatique au Retour en Ligne](#9-synchronisation-automatique-au-retour-en-ligne)
10. [Comportement par Module Métier](#10-comportement-par-module-métier)
11. [Gestion des Conflits](#11-gestion-des-conflits)
12. [Changements Côté Backend](#12-changements-côté-backend)
13. [Stores Pinia & Composables Offline](#13-stores-pinia--composables-offline)
14. [Plan d'Implémentation Recommandé](#14-plan-dimplémentation-recommandé)

---

## 1. Présentation & Objectifs

### 1.1 Pourquoi ce document

Ce document décrit **l'architecture complète du mode hors ligne côté frontend** pour Enjoy PMS. Il sert de plan directeur pour les développeurs qui implémentent ou maintiennent la fonctionnalité offline.

### 1.2 Rappel du Contexte

| Élément | Statut |
|---------|--------|
| **Backend Sync API** (`/api/sync/*`) | ✅ Implémenté |
| **Tables sync (operations, conflicts, checkpoints)** | ✅ Migrations créées |
| **SyncService** (push/pull/initialLoad) | ✅ Implémenté |
| **SyncController** | ✅ Implémenté |
| **Middleware offline mode** | ✅ Implémenté |
| **IndexedDB (Dexie.js) - db.ts** | ✅ Implémenté (4 tables génériques) |
| **File d'attente offline - queue.ts** | ✅ Implémenté |
| **SyncManager - syncManager.ts** | ✅ Implémenté (partiel) |
| **Détection connexion - connectionState.ts** | ✅ Implémenté |
| **Composable useConnection** | ✅ Implémenté |
| **Badge ConnectionStatus.vue** | ✅ Implémenté |
| **Structure IndexedDB miroir des tables métier** | ❌ À faire |
| **CacheService complet** | ❌ À faire |
| **apiProxy.ts (offlineAwareApiCall)** | ❌ À faire |
| **offlineStore.ts (Pinia)** | ❌ À faire |
| **useOfflineForm (auto-save)** | ❌ À faire |
| **ConflictResolutionModal.vue** | ❌ À faire |
| **Indicateur dans AppHeader.vue** | ❌ À faire |

### 1.3 Objectifs du Mode Hors Ligne

1. ✅ **Consultation** des données critiques (réservations, clients, folios) sans connexion
2. ✅ **Écriture** des opérations métier (check-in, check-out, transactions) hors ligne
3. ✅ **Synchronisation automatique** au retour en ligne
4. ✅ **Gestion des conflits** avec résolution automatique ou manuelle
5. ✅ **Expérience utilisateur transparente** avec indicateurs d'état

---

## 2. Architecture Générale Offline-First

### 2.1 Schéma d'Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                       FRONTEND (EnjoyAdmin - Vue 3 + PWA)                │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    APPLICATION LAYER                              │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐  ┌─────────────┐  │   │
│  │  │Composants│  │  Stores  │  │ Composables   │  │  Services   │  │   │
│  │  │ (Vue)   │  │ (Pinia)  │  │ (useOffline,  │  │  (API)      │  │   │
│  │  └────┬─────┘  └────┬─────┘  │  useSync)     │  └──────┬──────┘  │   │
│  │       │              │        └──────┬────────┘         │         │   │
│  │       └──────────────┴──────────────┴───────────────────┘         │   │
│  │                                  │                                  │   │
│  │  ┌───────────────────────────────▼──────────────────────────────┐  │   │
│  │  │               OFFLINE SERVICE LAYER                           │  │   │
│  │  │  ┌─────────────────────────────────────────────────────────┐  │  │   │
│  │  │  │              offlineAwareApiCall()                       │  │  │   │
│  │  │  │  ┌─────────┐  ┌──────────────┐  ┌───────────────────┐  │  │  │   │
│  │  │  │  │ Online  │  │   Offline    │  │   Cache + Queue   │  │  │  │   │
│  │  │  │  │ → Axios │  │  → IndexedDB │  │   Management      │  │  │  │   │
│  │  │  │  └────┬────┘  └──────┬───────┘  └───────────────────┘  │  │  │   │
│  │  │  └──────────────────────────┬──────────────────────────────┘  │  │   │
│  │  │                             │                                 │  │   │
│  │  │  ┌──────────────────────────▼──────────────────────────────┐  │  │   │
│  │  │  │              INDEXEDDB (Dexie.js)                        │  │  │   │
│  │  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │  │  │   │
│  │  │  │  │ Tables Métier│  │  Sync Queue  │  │  Checkpoints │  │  │  │   │
│  │  │  │  │ (Miroir DB)  │  │ (outbox)     │  │  + Drafts    │  │  │  │   │
│  │  │  │  └──────────────┘  └──────────────┘  └──────────────┘  │  │  │   │
│  │  │  └─────────────────────────────────────────────────────────┘  │  │   │
│  │  └───────────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                   │                                      │
│  ┌───────────────────────────────▼──────────────────────────────────┐   │
│  │              SERVICE WORKER (Workbox)                             │   │
│  │  ┌────────────────┐  ┌────────────────┐  ┌──────────────────┐   │   │
│  │  │ Cache stratégies│  │ Background Sync │  │  Cache API       │   │   │
│  │  │ (NetworkFirst,  │  │ (SyncManager)   │  │  (StaleWhile    │   │   │
│  │  │ CacheFirst)     │  │                 │  │   Revalidate)   │   │   │
│  │  └────────────────┘  └────────────────┘  └──────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
                                    │ HTTPS
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    BACKEND (AdonisJS API)                                 │
│                                                                          │
│  ┌────────────────┐  ┌──────────────┐  ┌────────────────────────────┐  │
│  │  Sync Endpoints │  │  Conflict    │  │  PostgreSQL                │  │
│  │  (push/pull/    │  │  Resolution  │  │  ┌─────────┐ ┌──────────┐│  │
│  │   initial-load) │  │              │  │  │ Tables  │ │Sync      ││  │
│  └────────────────┘  └──────────────┘  │  │ Métier  │ │Tables    ││  │
│                                         │  └─────────┘ └──────────┘│  │
│                                         └────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Principe de Fonctionnement

**État ONLINE :**
```
Appel API → offlineAwareApiCall() → Axios → Backend → Réponse
   ↓
Mise à jour du cache IndexedDB automatiquement
   ↓
UI affiche les données fraîches
```

**État OFFLINE :**
```
Appel API → offlineAwareApiCall()
   ↓
GET  → IndexedDB (cache) → données locales → UI
POST → IndexedDB (queue) + cache optimiste → UI "en attente"
```

**Transition OFFLINE → ONLINE :**
```
1. Détection de la reconnexion (window.addEventListener('online'))
2. Étape 1—PUSH : Envoyer toutes les opérations en file d'attente
   POST /api/sync/push
3. Étape 2—PULL : Récupérer les changements distants
   POST /api/sync/pull
4. Mise à jour de l'IndexedDB avec les réponses du serveur
5. Rafraîchissement de l'UI
6. Notification utilisateur : "Synchronisation terminée"
```

---

## 3. Base de Données Locale (IndexedDB) — Structure Complète

### 3.1 Principe : Miroir de la Base de Données En ligne

La base locale doit refléter **la structure des tables PostgreSQL** pour permettre au frontend de fonctionner comme s'il était connecté. Chaque table métier PostgreSQL a sa correspondance dans IndexedDB.

### 3.2 Schéma Complet IndexedDB

```typescript
// src/services/offline/db.ts — Version complète avec toutes les tables métier

import Dexie, { type Table } from 'dexie'

// ============================================================
// TYPES : Correspondance 1:1 avec les modèles backend
// ============================================================

// ---- Réservations et Séjours ----
export interface OfflineReservation {
  id: number | string          // number (ID serveur) ou string (ID temporaire)
  hotelId: number
  guestId?: number | null
  primaryRoomTypeId?: number
  scheduledArrivalDate: string  // ISO date
  scheduledDepartureDate: string
  actualArrivalDatetime?: string | null
  actualDepartureDatetime?: string | null
  reservationStatus: string
  numAdultsTotal: number
  numChildrenTotal: number
  bookingSourceId?: number
  ratePlanId?: number
  discountId?: number | null
  totalEstimatedRevenue?: number
  specialNotes?: string | null
  confirmationCode?: string
  reservationNumber?: string | null
  customerType?: string | null
  sourceOfBusiness?: string | null
  businessSourceId?: number | null
  marketCodeId?: number | null
  paymentMethodId?: number | null
  totalAmount?: number
  discountAmount?: number
  taxAmount?: number
  finalAmount?: number
  paidAmount?: number
  remainingAmount?: number
  paymentStatus?: string
  currencyCode?: string | null
  groupId?: number | null
  taxExempt?: boolean
  cancellationReason?: string | null
  userId: number
  createdBy?: number | null
  lastModifiedBy?: number | null
  version: number                // Pour détection conflit
  isHold?: boolean
  // Champs étendus
  arrivedDate?: string | null
  departDate?: string | null
  numberOfNights?: number | null
  totalSeats?: number | null
  seatsGroupNames?: string | null
  bookedAt?: string
  reservationDatetime?: string
  // Champs de suivi offline
  _pending?: boolean             // En attente de sync
  _operationId?: string          // ID opération dans la queue
  _tempId?: boolean              // true si ID temporaire (création offline)
  createdAt: string
  updatedAt: string
}

export interface OfflineReservationRoom {
  id: number | string
  reservationId: number | string
  roomId: number
  roomTypeId?: number
  checkInDate?: string
  checkOutDate?: string
  guestCount?: number
  roomRate?: number
  currency?: string
  status?: string
  isPrimary?: boolean
  guestId?: number | null
  version?: number
  _pending?: boolean
  _operationId?: string
  createdAt: string
  updatedAt: string
}

export interface OfflineReservationGuest {
  id: number | string
  reservationId: number | string
  guestId: number
  isPrimary: boolean
  guestType: string
  roomAssignment?: string
  specialRequests?: string | null
  dietaryRestrictions?: string | null
  notes?: string | null
  version?: number
  createdAt: string
  updatedAt: string
}

// ---- Clients ----
export interface OfflineGuest {
  id: number | string
  hotelId: number
  guestCode?: string
  firstName: string
  lastName?: string | null
  middleName?: string
  title?: string
  email?: string | null
  phonePrimary?: string
  phoneSecondary?: string
  phoneWhatsapp?: string | null
  nationality?: string
  placeOfBirth?: string
  dateOfBirth?: string | null
  gender?: string
  idType?: string
  idNumber?: string
  idExpiryDate?: string | null
  passportNumber?: string | null
  passportExpiry?: string | null
  address?: string
  addressLine?: string
  city?: string
  stateProvince?: string
  country?: string
  postalCode?: string
  companyId?: number | null
  companyName?: string
  jobTitle?: string
  vipStatusId?: number | null
  vipStatus?: string
  blacklisted?: boolean
  blacklistReason?: string
  specialRequests?: string
  dietaryRestrictions?: string
  notes?: string
  preferences?: object | null
  communicationPreferences?: object | null
  marketingOptIn?: boolean
  createdBy?: number
  lastModifiedBy?: number
  version: number
  _pending?: boolean
  _operationId?: string
  _tempId?: boolean
  createdAt: string
  updatedAt: string
}

// ---- Folios (Facturation) ----
export interface OfflineFolio {
  id: number | string
  hotelId: number
  guestId?: number | null
  reservationId?: number | null
  reservationRoomId?: number | null
  folioNumber: string
  folioName?: string
  folioType: string
  status: string
  settlementStatus: string
  openedDate: string
  closedDate?: string | null
  openedBy: number
  closedBy?: number | null
  totalCharges: number
  totalPayments: number
  totalTaxes: number
  totalDiscounts: number
  balance: number
  currencyCode?: string
  roomCharges?: number
  foodBeverageCharges?: number
  telephoneCharges?: number
  laundryCharges?: number
  minibarCharges?: number
  spaCharges?: number
  parkingCharges?: number
  miscellaneousCharges?: number
  depositAmount?: number
  advancePayment?: number
  refundAmount?: number
  paymentMethod?: string | null
  invoiceNumber?: string | null
  createdBy?: number
  lastModifiedBy?: number
  version: number
  _pending?: boolean
  _operationId?: string
  _tempId?: boolean
  createdAt: string
  updatedAt: string
}

// ---- Transactions Financières ----
export interface OfflineFolioTransaction {
  id: number | string
  hotelId: number
  folioId: number | string
  transactionNumber?: number
  transactionType: string          // 'charge' | 'payment' | 'adjustment' | 'refund' | 'void'
  category?: string
  description?: string
  amount: number
  totalAmount?: number
  balance?: number
  taxAmount?: number
  netAmount?: number
  transactionDate: string
  paymentMethodId?: number
  paymentReference?: string
  reference?: string
  guestId?: number | null
  reservationId?: number | null
  revenueCenter?: string
  departmentCode?: string
  notes?: string
  isVoided?: boolean
  voidedBy?: number | null
  voidReason?: string | null
  status: string
  extraChargeId?: number | null
  mealPlanId?: number | null
  createdBy?: number
  lastModifiedBy?: number
  version: number
  _pending?: boolean
  _operationId?: string
  _tempId?: boolean
  createdAt: string
  updatedAt: string
}

// ---- Chambres ----
export interface OfflineRoom {
  id: number | string
  hotelId: number
  roomTypeId: number
  roomNumber: string
  floorNumber?: number
  status: string                   // 'available' | 'occupied' | 'out_of_order' | 'out_of_service'
  housekeepingStatus: string       // 'clean' | 'dirty' | 'inspected'
  description?: string
  features?: object | null
  maxOccupancy?: number
  bedTypeId?: number
  sortKey?: number
  viewType?: string
  smokingAllowed?: boolean
  petFriendly?: boolean
  accessible?: boolean
  images?: string[]
  shortCode?: string | null
  createdBy?: number
  lastModifiedBy?: number
  version: number
  _pending?: boolean
  _operationId?: string
  createdAt: string
  updatedAt: string
}

// ---- Types de Chambres ----
export interface OfflineRoomType {
  id: number
  hotelId: number
  roomTypeName: string
  shortCode: string
  baseAdult: number
  baseChild: number
  maxAdult: number
  maxChild: number
  color?: string
  sortOrder?: number
  publishToWebsite?: boolean
  defaultWebInventory?: number
  roomAmenities?: number[] | null
  isDeleted?: boolean
  createdAt: string
  updatedAt: string
  // Pas de _pending — les types de chambres ne sont pas modifiés offline
}

// ---- Tarifs ----
export interface OfflineRoomRate {
  id: number
  roomTypeId: number
  rateTypeId?: number
  rateDate: string
  rateAmount: number
  currency?: string
  minStay?: number
  closedToArrival?: boolean
  closedToDeparture?: boolean
  stopSell?: boolean
  createdAt: string
  updatedAt: string
  // Lecture seule offline
}

export interface OfflineRateType {
  id: number
  hotelId: number
  name: string
  shortCode?: string
  description?: string
  color?: string
  isDefault?: boolean
  sortOrder?: number
  createdAt: string
  updatedAt: string
  // Lecture seule offline
}

// ---- Configuration ----
export interface OfflineBookingSource {
  id: number
  hotelId: number
  name: string
  commission?: number
  isActive?: boolean
  createdAt: string
  updatedAt: string
}

export interface OfflinePaymentMethod {
  id: number
  hotelId: number
  name: string
  code?: string
  isActive: boolean
  sortOrder?: number
  createdAt: string
  updatedAt: string
}

export interface OfflineTaxRate {
  id: number
  hotelId: number
  name: string
  rate: number
  type?: string
  isActive?: boolean
  createdAt: string
  updatedAt: string
}

export interface OfflineExtraCharge {
  id: number
  hotelId: number
  name: string
  amount: number
  type: string                // 'fixed' | 'percentage'
  isActive?: boolean
  isTaxable?: boolean
  createdAt: string
  updatedAt: string
}

export interface OfflineDiscount {
  id: number
  hotelId: number
  name: string
  type: string                // 'percentage' | 'fixed'
  value: number
  applyOn?: string
  isActive?: boolean
  createdAt: string
  updatedAt: string
}

// ---- Autres données de configuration ----
export interface OfflineVipStatus {
  id: number
  hotelId: number
  name: string
  color?: string
  sortOrder?: number
  createdAt: string
  updatedAt: string
}

export interface OfflineBlackListReason {
  id: number
  hotelId: number
  reason: string
  category?: string
  createdAt: string
  updatedAt: string
}

export interface OfflineBusinessSource {
  id: number
  hotelId: number
  name: string
  isActive?: boolean
  createdAt: string
  updatedAt: string
}

export interface OfflineMarketCode {
  id: number
  hotelId: number
  code: string
  description?: string
  isActive?: boolean
  createdAt: string
  updatedAt: string
}

export interface OfflineReservationType {
  id: number
  hotelId: number
  name: string
  shortCode?: string
  isActive?: boolean
  createdAt: string
  updatedAt: string
}

export interface OfflineRoomBlock {
  id: number | string
  hotelId: number
  roomId: number
  startDate: string
  endDate: string
  reason?: string
  isActive?: boolean
  createdBy?: number
  version?: number
  _pending?: boolean
  _operationId?: string
  createdAt: string
  updatedAt: string
}

export interface OfflineWorkOrder {
  id: number | string
  hotelId: number
  roomId?: number
  title: string
  description?: string
  status: string
  priority?: string
  assignedTo?: number | null
  createdBy?: number
  version?: number
  _pending?: boolean
  _operationId?: string
  createdAt: string
  updatedAt: string
}

export interface OfflineAnnouncement {
  id: number
  title: string
  message: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface OfflineNotification {
  id: number
  hotelId: number
  recipientType: string
  recipientId?: number
  title: string
  message: string
  type?: string
  isRead?: boolean
  relatedEntityType?: string
  relatedEntityId?: number
  createdAt: string
  updatedAt: string
}

// ============================================================
// TYPES SYSTÈME (Queue, Checkpoints, Drafts, Conflits)
// ============================================================

export interface OfflineQueueItem {
  id?: number
  operationId: string            // UUID v4
  operationType: 'create' | 'update' | 'delete'
  resourceType: string
  resourceId?: number | string | null
  payload: any
  priority: number               // 0-10
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
  formKey: string                // 'booking', 'guest', 'folio_payment', etc.
  data: any
  updatedAt: string
}

export interface OfflineConflict {
  id?: number
  operationId: string
  resourceType: string
  resourceId: number
  clientVersion: number
  serverVersion: number
  clientData: any
  serverData: any
  resolution: 'pending' | 'client_wins' | 'server_wins'
  createdAt: string
}

// ============================================================
// SCHÉMA INDEXEDDB — Version complète miroir PostgreSQL
// ============================================================

export class OfflineDatabase extends Dexie {
  // === TABLES MÉTIER (Miroir de la base en ligne) ===
  reservations!: Table<OfflineReservation, number | string>
  reservationRooms!: Table<OfflineReservationRoom, number | string>
  reservationGuests!: Table<OfflineReservationGuest, number | string>
  guests!: Table<OfflineGuest, number | string>
  folios!: Table<OfflineFolio, number | string>
  folioTransactions!: Table<OfflineFolioTransaction, number | string>
  rooms!: Table<OfflineRoom, number | string>
  roomTypes!: Table<OfflineRoomType, number>
  roomRates!: Table<OfflineRoomRate, number>
  rateTypes!: Table<OfflineRateType, number>
  bookingSources!: Table<OfflineBookingSource, number>
  paymentMethods!: Table<OfflinePaymentMethod, number>
  taxRates!: Table<OfflineTaxRate, number>
  extraCharges!: Table<OfflineExtraCharge, number>
  discounts!: Table<OfflineDiscount, number>
  vipStatuses!: Table<OfflineVipStatus, number>
  blackListReasons!: Table<OfflineBlackListReason, number>
  businessSources!: Table<OfflineBusinessSource, number>
  marketCodes!: Table<OfflineMarketCode, number>
  reservationTypes!: Table<OfflineReservationType, number>
  roomBlocks!: Table<OfflineRoomBlock, number | string>
  workOrders!: Table<OfflineWorkOrder, number | string>
  announcements!: Table<OfflineAnnouncement, number>
  notifications!: Table<OfflineNotification, number>

  // === TABLES SYSTÈME ===
  queue!: Table<OfflineQueueItem, number>
  checkpoints!: Table<OfflineSyncCheckpoint, number>
  drafts!: Table<OfflineDraft, number>
  conflicts!: Table<OfflineConflict, number>

  constructor() {
    super('EnjoyPMSOffline')

    // Version 2 — Tables métier complètes
    this.version(2).stores({
      // ---- Données métier critiques (lecture/écriture offline) ----
      reservations: 'id, hotelId, reservationStatus, scheduledArrivalDate, guestId, version, _pending, updatedAt',
      reservationRooms: 'id, reservationId, roomId, version, _pending, updatedAt',
      reservationGuests: 'id, reservationId, guestId, isPrimary, createdAt',
      guests: 'id, hotelId, firstName, lastName, email, phonePrimary, version, _pending, updatedAt',
      folios: 'id, hotelId, guestId, reservationId, status, folioType, balance, version, _pending, updatedAt',
      folioTransactions: 'id, hotelId, folioId, transactionType, transactionDate, amount, version, _pending, updatedAt',
      rooms: 'id, hotelId, roomTypeId, status, housekeepingStatus, roomNumber, version, _pending, updatedAt',
      roomBlocks: 'id, hotelId, roomId, startDate, endDate, version, _pending, updatedAt',
      workOrders: 'id, hotelId, roomId, status, version, _pending, updatedAt',

      // ---- Données de configuration (lecture seule offline) ----
      roomTypes: 'id, hotelId, roomTypeName, isDeleted, sortOrder',
      roomRates: 'id, roomTypeId, rateTypeId, rateDate, rateAmount',
      rateTypes: 'id, hotelId, name, isDefault',
      bookingSources: 'id, hotelId, name, isActive',
      paymentMethods: 'id, hotelId, name, isActive',
      taxRates: 'id, hotelId, name, isActive',
      extraCharges: 'id, hotelId, name, type',
      discounts: 'id, hotelId, name, type, isActive',
      vipStatuses: 'id, hotelId, name',
      blackListReasons: 'id, hotelId, reason',
      businessSources: 'id, hotelId, name',
      marketCodes: 'id, hotelId, code',
      reservationTypes: 'id, hotelId, name',
      announcements: 'id, isActive',
      notifications: 'id, hotelId, recipientType, isRead',

      // ---- Tables système ----
      queue: '++id, status, priority, createdAt, resourceType',
      checkpoints: '++id, resourceType, lastVersion',
      drafts: '++id, formKey, updatedAt',
      conflicts: '++id, resourceType, resolution, createdAt',
    })
  }
}

export const db = new OfflineDatabase()
```

### 3.3 Correspondance Tables PostgreSQL ↔ IndexedDB

| Table PostgreSQL | Table IndexedDB | Lecture Offline | Écriture Offline | Sync |
|:----------------|:----------------|:---------------:|:----------------:|:----:|
| `reservations` | `reservations` | ✅ | ✅ | Push/Pull |
| `reservation_rooms` | `reservationRooms` | ✅ | ✅ | Push/Pull |
| `reservation_guests` | `reservationGuests` | ✅ | ✅ | Push/Pull |
| `guests` | `guests` | ✅ | ✅ | Push/Pull |
| `folios` | `folios` | ✅ | ✅ | Push/Pull |
| `folio_transactions` | `folioTransactions` | ✅ | ✅ | Push/Pull |
| `rooms` | `rooms` | ✅ | ✅ | Push/Pull |
| `room_blocks` | `roomBlocks` | ✅ | ✅ | Push/Pull |
| `work_orders` | `workOrders` | ✅ | ✅ | Push/Pull |
| `room_types` | `roomTypes` | ✅ | ❌ (lecture seule) | Pull only |
| `room_rates` | `roomRates` | ✅ | ❌ (lecture seule) | Pull only |
| `rate_types` | `rateTypes` | ✅ | ❌ (lecture seule) | Pull only |
| `booking_sources` | `bookingSources` | ✅ | ❌ | Pull only |
| `payment_methods` | `paymentMethods` | ✅ | ❌ | Pull only |
| `tax_rates` | `taxRates` | ✅ | ❌ | Pull only |
| `extra_charges` | `extraCharges` | ✅ | ❌ | Pull only |
| `discounts` | `discounts` | ✅ | ❌ | Pull only |
| `vip_statuses` | `vipStatuses` | ✅ | ❌ | Pull only |
| `black_list_reasons` | `blackListReasons` | ✅ | ❌ | Pull only |
| `business_sources` | `businessSources` | ✅ | ❌ | Pull only |
| `market_codes` | `marketCodes` | ✅ | ❌ | Pull only |
| `reservation_types` | `reservationTypes` | ✅ | ❌ | Pull only |
| `announcements` | `announcements` | ✅ | ❌ | Pull only |
| `notifications` | `notifications` | ✅ | ❌ (STAFF) | Pull only |

### 3.4 Indexation et Performances

Les index définis dans `stores()` ci-dessus sont choisis pour optimiser les requêtes offline les plus fréquentes :

| Index | Utilité |
|-------|---------|
| `reservations: hotelId, reservationStatus` | Filtrer les réservations par hôtel et statut |
| `reservations: scheduledArrivalDate` | Planning d'arrivées/départs |
| `reservations: guestId` | Rechercher les réservations d'un client |
| `folios: hotelId, guestId, status` | Trouver les folios d'un client |
| `folios: reservationId` | Folios d'une réservation |
| `folioTransactions: folioId` | Transactions d'un folio |
| `rooms: hotelId, status` | Statut des chambres |
| `rooms: roomTypeId` | Chambres par type |
| `guests: firstName, lastName, email` | Recherche clients |

---

## 4. Le Mini-Serveur Offline — Deux Stratégies

Le "mini-serveur" offline est le cœur du système. Il permet à l'application frontend de **continuer à fonctionner comme si le backend était disponible**, en utilisant IndexedDB comme base de données locale et une couche d'abstraction pour intercepter les appels API.

### 4.1 Les Deux Approches

| Aspect | Option A : Service Worker | Option B : Proxy API |
|--------|--------------------------|---------------------|
| **Niveau** | Navigateur (avant l'app) | Application (dans le code) |
| **Mécanisme** | `fetch` event listener | Fonction `offlineAwareApiCall()` |
| **Transparence** | ✅ Transparent pour l'app | ❌ Il faut utiliser la fonction |
| **Flexibilité** | ❌ Limitée (événements fetch) | ✅ Contrôle total |
| **Background Sync** | ✅ `sync` event SW | ❌ Doit être géré manuellement |
| **Cache réseau** | ✅ Cache API natif | ❌ Cache applicatif uniquement |
| **Debugging** | ❌ Complexe | ✅ Simple |
| **Bundle size** | ✅ 0 impact | ❌ Code supplémentaire |

### 4.2 Recommandation : Approche Hybride

La meilleure approche est **combinatoire** :

1. **Service Worker** (Option A) : Pour le **cache réseau** des données de configuration (GET) et les assets statiques
2. **Proxy API** (Option B) : Pour les **écritures** (POST, PUT, PATCH, DELETE) et la logique métier offline

```
Requête GET /api/reservations
   ↓
Service Worker intercepte → NetworkFirst → réponse + mise en cache
   ↓
Proxy API met à jour IndexedDB avec la réponse
   ↓
Les composants Vue lisent depuis le store Pinia (alimenté par IndexedDB)

Requête POST /api/reservations/create (hors ligne)
   ↓
Proxy API (offlineAwareApiCall) détecte offline
   ↓
Stocke dans IndexedDB (table reservations + queue)
   ↓
Retourne un résultat optimiste à l'UI
```

---

## 5. Option A : L'Intercepteur Service Worker

### 5.1 Configuration Workbox Améliorée

```typescript
// vite.config.ts — Configuration PWA Workbox améliorée

VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'fonts/**/*', 'images/**/*'],
  manifest: {
    name: 'Enjoy Stay PMS',
    short_name: 'EnjoyPMS',
    description: 'Property Management System — Offline-capable',
    theme_color: '#7c3aed',
    background_color: '#ffffff',
    display: 'standalone',
    scope: '/',
    start_url: '/',
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2,ttf,eot}'],

    runtimeCaching: [
      // ===== 1. CONFIGURATION HÔTEL (lecture seule, longue durée) =====
      {
        urlPattern: /\/api\/(hotels|configuration|room_types|rooms|rate_types|extra_charges|payment_methods|taxes|seasons|discounts|booking_sources|vip_statuses|black_list_reasons|business_sources|market_codes|reservation_types|amenities|meal_plan).*/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'pms-config',
          expiration: { maxEntries: 300, maxAgeSeconds: 7 * 24 * 60 * 60 }, // 7 jours
          cacheableResponse: { statuses: [0, 200] },
        },
      },

      // ===== 2. DONNÉES MÉTIER (réservations, clients, folios) =====
      {
        urlPattern: /\/api\/(reservation|guests|folios|folio-transactions|reservation-rooms|room-blocks|work-orders).*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'pms-data',
          expiration: { maxEntries: 500, maxAgeSeconds: 24 * 60 * 60 }, // 1 jour
          networkTimeoutSeconds: 5,
          cacheableResponse: { statuses: [0, 200] },
        },
      },

      // ===== 3. RECHERCHE et RAPPORTS (Network Only) =====
      {
        urlPattern: /\/api\/(reports|dashboard|search).*/i,
        handler: 'NetworkOnly',
      },

      // ===== 4. SYNC API (toujours Network Only — géré par le proxy) =====
      {
        urlPattern: /\/api\/sync\/.*/i,
        handler: 'NetworkOnly',
      },

      // ===== 5. FONTS (Cache First longue durée) =====
      {
        urlPattern: /\.(woff|woff2|ttf|eot)$/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'pms-fonts',
          expiration: { maxAgeSeconds: 30 * 24 * 60 * 60 }, // 30 jours
        },
      },

      // ===== 6. IMAGES (Cache First) =====
      {
        urlPattern: /\.(png|jpg|jpeg|svg|webp|ico)$/,
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

### 5.2 Stratégies de Cache par Type de Ressource

| Ressource | Stratégie SW | TTL Cache | Justification |
|-----------|-------------|-----------|---------------|
| **Configuration hôtel** | StaleWhileRevalidate | 7 jours | Change rarement |
| **Types de chambres** | StaleWhileRevalidate | 7 jours | Données de référence |
| **Tarifs** | StaleWhileRevalidate | 7 jours | Tarifs saisonniers |
| **Réservations récentes** | NetworkFirst | 1 jour | Données critiques, doit être fraîche |
| **Clients** | NetworkFirst | 1 jour | Recherche fréquente |
| **Folios** | NetworkFirst | 1 jour | Soldes en temps réel |
| **Transactions** | NetworkFirst | 1 jour | Intégrité financière |
| **Rapports** | NetworkOnly | — | Toujours en ligne |
| **Recherche** | NetworkOnly | — | Résultats dynamiques |
| **Fonts / Images** | CacheFirst | 30j / 14j | Assets statiques |

### 5.3 Code du Service Worker Personnalisé (Hors Workbox)

Si vous avez besoin d'un contrôle plus fin, vous pouvez étendre le service worker avec un fichier `sw.ts` personnalisé :

```typescript
// src/sw.ts — Service Worker personnalisé (si besoin hors Workbox)

/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst, CacheFirst, StaleWhileRevalidate, NetworkOnly } from 'workbox-strategies'

declare const self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)

// Stratégies de cache (détaillées ci-dessus)
// ...

// Background Sync — Tentative de rejeu des mutations en arrière-plan
self.addEventListener('sync', (event) => {
  if (event.tag === 'pms-sync') {
    event.waitUntil(processQueue())
  }
})

async function processQueue() {
  // Déléguer à l'application via postMessage
  const clients = await self.clients.matchAll()
  for (const client of clients) {
    client.postMessage({ type: 'SYNC_TRIGGERED' })
  }
}
```

---

## 6. Option B : L'Abstraction Proxy API (offlineAwareApiCall)

### 6.1 Principe

Au lieu de passer par Axios directement, tous les appels API passent par la fonction `offlineAwareApiCall()` qui décide :

```
offlineAwareApiCall(method, url, options)
   │
   ├── En ligne ? → Axios → Backend → Mise à jour cache → Réponse
   │
   └── Hors ligne ?
       ├── GET → IndexedDB (cache local)
       └── POST/PUT/PATCH/DELETE → IndexedDB (queue) + cache optimiste
```

### 6.2 Implémentation Complète

```typescript
// src/services/offline/apiProxy.ts

import apiClient from '@/services/apiClient'
import { OfflineQueueService } from './queueService'
import { OfflineCacheService } from './cacheService'
import { useOfflineStore } from '@/composables/offline/offlineStore'
import { db } from './db'

type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

interface ApiCallOptions {
  data?: any
  params?: any
  resourceType?: string
  resourceId?: number | string
  queuePriority?: number
  optimisticData?: any
  cacheTTL?: number
  useCache?: boolean       // false pour forcer l'appel réseau
  isConfig?: boolean       // true pour les données de configuration
}

interface ApiCallResult<T = any> {
  data: T
  fromCache?: boolean
  offlineQueued?: boolean
  operationId?: string
  status?: number
}

/**
 * Proxy API intelligent — offline-aware
 * Remplace les appels Axios directs dans les services API
 */
export async function offlineAwareApiCall<T = any>(
  method: ApiMethod,
  url: string,
  options?: ApiCallOptions
): Promise<ApiCallResult<T>> {
  const store = useOfflineStore()
  const resourceType = options?.resourceType

  // ── ÉTAT ONLINE ──────────────────────────────────────────────
  if (store.isOnline && options?.useCache !== false) {
    try {
      const response = await apiClient.request<T>({
        method,
        url,
        data: options?.data,
        params: options?.params,
        timeout: 10000, // 10s timeout
      })

      // Mettre à jour le cache IndexedDB après un GET réussi
      if (method === 'GET' && resourceType) {
        const id = extractIdFromUrl(url, resourceType) || options?.resourceId
        if (id) {
          await OfflineCacheService.set(resourceType, id, response.data, {
            ttlMs: options?.cacheTTL,
            version: response.data?.version,
          })
        } else if (Array.isArray(response.data)) {
          // Si c'est une liste, mettre chaque élément en cache
          for (const item of response.data) {
            if (item.id) {
              await OfflineCacheService.set(resourceType, item.id, item, {
                ttlMs: options?.cacheTTL,
                version: item.version,
              })
            }
          }
        }
      }

      // Mettre à jour le cache après une écriture réussie
      if (['POST', 'PUT', 'PATCH'].includes(method) && resourceType) {
        const serverId = response.data?.id ?? response.data?.serverId
        if (serverId) {
          await OfflineCacheService.set(resourceType, serverId, response.data, {
            ttlMs: options?.cacheTTL,
            version: response.data?.version,
          })
        }
      }

      return { data: response.data }
    } catch (error: any) {
      // Erreur réseau → fallback offline
      if (isNetworkError(error) && options?.resourceType) {
        return handleOfflineFallback(method, url, options)
      }
      throw error
    }
  }

  // ── ÉTAT OFFLINE ou FALLBACK ─────────────────────────────────
  return handleOfflineFallback(method, url, options)
}

/**
 * Détecte si une erreur est un problème réseau
 */
function isNetworkError(error: any): boolean {
  return !error.response
    || error.code === 'ECONNABORTED'
    || error.code === 'ERR_NETWORK'
    || error.message === 'Network Error'
    || error.message?.includes('timeout')
    || error.message?.includes('Failed to fetch')
    || error.message?.includes('NetworkError')
}

/**
 * Comportement hors ligne selon le type d'opération
 */
async function handleOfflineFallback<T>(
  method: ApiMethod,
  url: string,
  options?: ApiCallOptions
): Promise<ApiCallResult<T>> {
  const resourceType = options?.resourceType

  // ── GET : Lire depuis IndexedDB ──────────────────────────────
  if (method === 'GET' && resourceType) {
    // Cas 1 : Ressource spécifique (ex: /api/reservation/123)
    const resourceId = options?.resourceId ?? extractIdFromUrl(url, resourceType)
    if (resourceId) {
      const cached = await OfflineCacheService.get<T>(resourceType, resourceId)
      if (cached) {
        return { data: cached.data, fromCache: true }
      }
      throw new Error(`Ressource ${resourceType}#${resourceId} non disponible hors ligne`)
    }

    // Cas 2 : Liste de ressources (ex: /api/guests)
    const allData = await OfflineCacheService.getAll<T>(resourceType)
    return {
      data: (Array.isArray(allData) ? allData : []) as unknown as T,
      fromCache: true,
    }
  }

  // ── GET sans cache défini : chercher dans toutes les tables ──
  if (method === 'GET' && !resourceType) {
    console.warn('GET offline sans resourceType, tentative de recherche générique')
    throw new Error('Requête GET non disponible hors ligne — resourceType manquant')
  }

  // ── ÉCRITURES (POST, PUT, PATCH, DELETE) : Queue offline ─────
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const opType = methodToOperationType(method)
    const resourceId = options?.resourceId ?? extractIdFromUrl(url, resourceType || '')

    // Ajouter à la file d'attente
    const { operationId } = await OfflineQueueService.enqueue(
      opType,
      resourceType || 'unknown',
      options?.data,
      {
        priority: options?.queuePriority,
        resourceId: resourceId as number | undefined,
        optimisticData: options?.optimisticData,
      }
    )

    // Retourner des données optimistes
    const optimisticResponse = options?.optimisticData || {
      id: resourceId || `tmp-${operationId}`,
      _offlineQueued: true,
      _operationId: operationId,
      _message: 'Opération mise en attente de synchronisation',
    }

    return {
      data: optimisticResponse as unknown as T,
      fromCache: false,
      offlineQueued: true,
      operationId,
    }
  }

  throw new Error(`Opération ${method} non supportée hors ligne`)
}

/**
 * Extrait l'ID de ressource depuis l'URL
 * Exemple: /api/reservation/123 → 123
 */
function extractIdFromUrl(url: string, resourceType: string): string | number | null {
  const match = url.match(new RegExp(`/${resourceType}/(\\d+)`))
  return match ? parseInt(match[1]) : null
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

### 6.3 CacheService Complet

```typescript
// src/services/offline/cacheService.ts

import { db, type OfflineQueueItem } from './db'

export class OfflineCacheService {
  // Durées de vie par défaut par catégorie
  static TTL = {
    CONFIG: 7 * 24 * 60 * 60 * 1000,     // 7 jours (configuration)
    DATA: 24 * 60 * 60 * 1000,            // 1 jour (données métier)
    TRANSACTION: 7 * 24 * 60 * 60 * 1000, // 7 jours (transactions)
    TEMP: 5 * 60 * 1000,                   // 5 minutes (disponibilités)
  }

  /**
   * Mettre en cache une ressource
   */
  static async set<T>(
    resourceType: string,
    resourceId: number | string,
    data: T,
    options?: { ttlMs?: number; version?: number; pending?: boolean }
  ) {
    // Mapper le resourceType (utilisé par l'API) vers la table IndexedDB
    const table = this.getTableForResource(resourceType)
    if (!table) return

    const ttl = options?.ttlMs ?? this.getDefaultTTL(resourceType)
    const entry = {
      id: resourceId,
      ...(typeof data === 'object' ? data : { data }),
      _cachedAt: Date.now(),
      _expiresAt: Date.now() + ttl,
      _pending: options?.pending ?? false,
      _version: options?.version ?? data?.version ?? 1,
    }

    await (db as any)[table].put(entry)
  }

  /**
   * Récupérer une ressource du cache
   */
  static async get<T>(
    resourceType: string,
    resourceId: number | string
  ): Promise<{ data: T; fromCache: boolean } | null> {
    const table = this.getTableForResource(resourceType)
    if (!table) return null

    const entry = await (db as any)[table].get(resourceId)
    if (!entry) return null

    // Vérifier l'expiration (sauf pour les éléments en attente)
    if (!entry._pending && entry._expiresAt && entry._expiresAt < Date.now()) {
      await (db as any)[table].delete(resourceId)
      return null
    }

    return { data: entry as unknown as T, fromCache: true }
  }

  /**
   * Récupérer toutes les ressources d'un type
   */
  static async getAll<T>(
    resourceType: string,
    filter?: (item: T) => boolean
  ): Promise<T[]> {
    const table = this.getTableForResource(resourceType)
    if (!table) return []

    let items = await (db as any)[table].toArray()

    // Filtrer les éléments expirés (non pending)
    const now = Date.now()
    items = items.filter((item: any) =>
      item._pending || !item._expiresAt || item._expiresAt > now
    )

    if (filter) {
      items = items.filter(filter)
    }

    return items as T[]
  }

  /**
   * Invalider le cache
   */
  static async invalidate(resourceType: string, resourceId?: number | string) {
    const table = this.getTableForResource(resourceType)
    if (!table) return

    if (resourceId) {
      await (db as any)[table].delete(resourceId)
    } else {
      await (db as any)[table].clear()
    }
  }

  /**
   * Vider toutes les données d'un hôtel (changement d'hôtel)
   */
  static async clearHotelData() {
    const tables = [
      'reservations', 'reservationRooms', 'reservationGuests',
      'guests', 'folios', 'folioTransactions',
      'rooms', 'roomBlocks', 'workOrders',
      'notifications', 'announcements',
    ]
    for (const table of tables) {
      await (db as any)[table].clear()
    }
    await db.checkpoints.clear()
    await db.conflicts.clear()
    // Ne pas vider la queue (elle contient des opérations en attente)
  }

  // ================================================================
  // HELPERS
  // ================================================================

  /**
   * Mapper un resourceType API vers une table IndexedDB
   */
  static getTableForResource(resourceType: string): string | null {
    const map: Record<string, string> = {
      reservation: 'reservations',
      guest: 'guests',
      room: 'rooms',
      folio: 'folios',
      folio_transaction: 'folioTransactions',
      reservation_room: 'reservationRooms',
      room_type: 'roomTypes',
      rate_type: 'rateTypes',
      room_rate: 'roomRates',
      booking_source: 'bookingSources',
      payment_method: 'paymentMethods',
      tax_rate: 'taxRates',
      extra_charge: 'extraCharges',
      discount: 'discounts',
      vip_status: 'vipStatuses',
      black_list_reason: 'blackListReasons',
      business_source: 'businessSources',
      market_code: 'marketCodes',
      reservation_type: 'reservationTypes',
      room_block: 'roomBlocks',
      work_order: 'workOrders',
      announcement: 'announcements',
      notification: 'notifications',
    }
    return map[resourceType] || null
  }

  /**
   * TTL par défaut selon le type de ressource
   */
  private static getDefaultTTL(resourceType: string): number {
    const configTypes = [
      'room_type', 'rate_type', 'room_rate', 'booking_source',
      'payment_method', 'tax_rate', 'extra_charge', 'discount',
      'vip_status', 'black_list_reason', 'business_source',
      'market_code', 'reservation_type',
    ]
    if (configTypes.includes(resourceType)) return this.TTL.CONFIG
    if (resourceType === 'folio_transaction') return this.TTL.TRANSACTION
    return this.TTL.DATA
  }
}
```

---

## 7. Simulation des Écritures (Le Défi Principal)

### 7.1 Problèmes à Résoudre

| Défi | Solution |
|------|----------|
| **ID temporaires** | Les créations offline génèrent des IDs au format `tmp-{uuid}` |
| **Numéros de documents** | Réservation : pré-allocation ou `tmp-{hotelId}-{date}` |
| **Références entre entités** | Une transaction créée offline référence un folio avec ID temporaire |
| **Mise à jour après sync** | Remplacer les IDs temporaires par les IDs serveur |
| **Intégrité financière** | Server-wins pour les montants, mise à jour des soldes |

### 7.2 IDs Temporaires et Références

```typescript
// src/services/offline/idService.ts
import { v4 as uuidv4 } from 'uuid'

export class TemporaryIdService {
  private static tempIdPrefix = 'tmp-'

  /**
   * Génère un ID temporaire unique
   */
  static generate(): string {
    return `${this.tempIdPrefix}${uuidv4()}`
  }

  /**
   * Vérifie si un ID est temporaire
   */
  static isTemporary(id: number | string): boolean {
    return String(id).startsWith(this.tempIdPrefix)
  }

  /**
   * Attend la résolution des IDs temporaires
   * Appelé après la sync, pour mettre à jour les références
   */
  static async resolveTempIds(serverResponse: any, localOperation: OfflineQueueItem) {
    const serverId = serverResponse?.serverId ?? serverResponse?.data?.id
    if (!serverId) return

    const resourceType = localOperation.resourceType
    const localId = localOperation.resourceId

    // Mettre à jour la table avec le nouvel ID serveur
    if (localId && this.isTemporary(localId)) {
      const table = OfflineCacheService.getTableForResource(resourceType)
      if (table) {
        const entry = await (db as any)[table].get(localId)
        if (entry) {
          await (db as any)[table].delete(localId)
          entry.id = serverId
          entry._tempId = false
          entry._pending = false
          await (db as any)[table].put(entry)
        }
      }
    }

    // Mettre à jour les références vers cet ID dans les autres tables
    await this.updateReferences(resourceType, localId, serverId)
  }

  /**
   * Met à jour les références aux IDs temporaires
   * Exemple: Si une réservation avec ID temporaire est créée,
   * les folios qui la référencent doivent être mis à jour
   */
  private static async updateReferences(
    resourceType: string,
    oldId: number | string,
    newId: number | string
  ) {
    const refMap: Record<string, { table: string; field: string }[]> = {
      reservation: [
        { table: 'folios', field: 'reservationId' },
        { table: 'folioTransactions', field: 'reservationId' },
        { table: 'reservationRooms', field: 'reservationId' },
        { table: 'reservationGuests', field: 'reservationId' },
      ],
      guest: [
        { table: 'reservations', field: 'guestId' },
        { table: 'folios', field: 'guestId' },
      ],
      folio: [
        { table: 'folioTransactions', field: 'folioId' },
      ],
    }

    const refs = refMap[resourceType] || []
    for (const ref of refs) {
      const items = await (db as any)[ref.table]
        .where(ref.field)
        .equals(oldId)
        .toArray()

      for (const item of items) {
        await (db as any)[ref.table].update(item.id, {
          [ref.field]: newId,
        })
      }
    }
  }
}
```

### 7.3 Exemple : Création de Réservation Hors Ligne

```
1. Utilisateur remplit le formulaire de réservation
2. Clic sur "Enregistrer" → hors ligne
3. offlineAwareApiCall('POST', '/reservation/create', {
     data: { guestId: 123, roomTypeId: 5, ... },
     resourceType: 'reservation',
     queuePriority: 7,  // HAUTE
     optimisticData: {
       id: 'tmp-abc123',
       hotelId: 1,
       guestId: 123,
       reservationStatus: 'Pending',
       scheduledArrivalDate: '2026-07-10',
       scheduledDepartureDate: '2026-07-13',
       confirmationCode: 'TMP-CONF-001',
       version: 1,
       _pending: true,
     }
   })
4. Résultat : Réservation affichée dans le planning avec badge 🟡 "En attente"
5. Dans la queue : { operationId: 'uuid', operationType: 'create',
      resourceType: 'reservation', resourceId: 'tmp-abc123' }
6. À la sync : Le serveur crée la réservation, retourne l'ID serveur
7. Mise à jour : remplacement de 'tmp-abc123' → 456 dans toutes les tables
8. Badge 🟢 "Synchronisé"
```

### 7.4 Exemple : Transaction Financière Hors Ligne

```
1. Utilisateur ajoute un paiement de 50 000 FCFA sur un folio
2. Hors ligne → offlineAwareApiCall('POST', '/folios/transactions', {
     data: { folioId: 42, amount: -50000, paymentMethodId: 1, ... },
     resourceType: 'folio_transaction',
     queuePriority: 10,  // CRITIQUE
     optimisticData: {
       id: 'tmp-trans-789',
       folioId: 42,
       amount: -50000,
       totalAmount: -50000,
       balance: 150000,  // Solde recalculé localement
       transactionType: 'payment',
       transactionDate: new Date().toISOString(),
       status: 'pending',
       _pending: true,
     }
   })
3. Mise à jour du cache du folio avec le nouveau solde
4. UI : Transaction affichée en orange "En attente de sync"
5. Solde du folio : 200 000 - 50 000 = 150 000 (calcul local)
6. À la sync : Le serveur vérifie l'intégrité et applique
7. Si conflit → Server-wins (le solde serveur fait foi)
8. Mise à jour du cache avec le solde serveur corrigé
```

---

## 8. File d'Attente (Outbox Queue)

### 8.1 Structure de la File d'Attente

```
Table IndexedDB: queue
┌─────────┬──────────────┬──────────────┬────────┬──────────┬──────────────┐
│ id (PK) │ operationId  │ resourceType │ status │ priority │  createdAt   │
├─────────┼──────────────┼──────────────┼────────┼──────────┼──────────────┤
│   1     │ "uuid-v4-1"  │ reservation  │pending │    7     │ 2026-07-07...│
│   2     │ "uuid-v4-2"  │guest         │pending │    5     │ 2026-07-07...│
│   3     │ "uuid-v4-3"  │folio_transact│pending │   10     │ 2026-07-07...│
│   4     │ "uuid-v4-4"  │reservation   │failed  │    7     │ 2026-07-06...│
└─────────┴──────────────┴──────────────┴────────┴──────────┴──────────────┘
```

### 8.2 Service de File d'Attente Complet

```typescript
// src/services/offline/queueService.ts

import { v4 as uuidv4 } from 'uuid'
import { db } from './db'
import { OfflineCacheService } from './cacheService'
import { TemporaryIdService } from './idService'

export interface EnqueueOptions {
  priority?: number
  resourceId?: number
  optimisticData?: any
}

export class OfflineQueueService {
  // Niveaux de priorité
  static PRIORITY = {
    CRITICAL: 10,  // Check-in/out, paiements, transactions
    HIGH: 7,       // Création réservation, création client
    NORMAL: 5,     // Modification réservation, modification client
    LOW: 2,        // Notes, préférences
  }

  /**
   * Ajouter une opération à la file d'attente
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
      priority: options?.priority ?? OfflineQueueService.PRIORITY.NORMAL,
      status: 'pending',
      createdAt: new Date().toISOString(),
      retryCount: 0,
    })

    // Mise à jour optimiste du cache local
    if (options?.optimisticData) {
      const localId = options.resourceId ?? `tmp-${operationId}`
      await OfflineCacheService.set(resourceType, localId, options.optimisticData, {
        version: 1,
        pending: true,
      })
    }

    // Notifier le store
    const store = useOfflineStore()
    await store.refreshPendingCount()

    return { operationId, id: itemId }
  }

  /**
   * Récupérer les opérations en attente (triées par priorité puis date)
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

    // Résoudre les IDs temporaires
    await TemporaryIdService.resolveTempIds(serverResponse, item)

    // Mettre à jour le cache avec la réponse serveur
    const serverId = serverResponse?.serverId ?? serverResponse?.data?.id
    if (serverId && item.resourceType && serverResponse?.data) {
      await OfflineCacheService.set(
        item.resourceType,
        serverId,
        serverResponse.data,
        { version: serverResponse.version }
      )
    }

    await refreshStore()
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
      await db.queue.update(id, {
        status: 'pending',
        retryCount: item.retryCount + 1,
        lastError: error,
      })
    } else if (conflict) {
      // Conflit → stocker pour résolution manuelle
      await db.queue.update(id, {
        status: 'failed',
        lastError: `Conflit: ${error}`,
      })
      await db.conflicts.add({
        operationId: item.operationId,
        resourceType: item.resourceType,
        resourceId: conflict.resourceId,
        clientVersion: conflict.clientVersion,
        serverVersion: conflict.serverVersion,
        clientData: conflict.clientData,
        serverData: conflict.serverData,
        resolution: 'pending',
        createdAt: new Date().toISOString(),
      })
    } else {
      await db.queue.update(id, {
        status: 'failed',
        lastError: error,
      })
    }

    await refreshStore()
  }

  /**
   * Obtenir le résumé des opérations par priorité
   */
  static async getSummary(): Promise<{
    critical: number
    high: number
    normal: number
    low: number
  }> {
    const pending = await this.getPending()
    return {
      critical: pending.filter(o => o.priority >= 10).length,
      high: pending.filter(o => o.priority >= 7 && o.priority < 10).length,
      normal: pending.filter(o => o.priority >= 4 && o.priority < 7).length,
      low: pending.filter(o => o.priority < 4).length,
    }
  }
}

async function refreshStore() {
  const { useOfflineStore } = await import('@/composables/offline/offlineStore')
  const store = useOfflineStore()
  await store.refreshPendingCount()
}
```

---

## 9. Synchronisation Automatique au Retour en Ligne

### 9.1 Détection du Retour en Ligne

```typescript
// src/composables/useConnection.ts — Version améliorée

import { ref, onMounted, onUnmounted } from 'vue'
import { connectionState } from '@/services/offline/connectionState'

export function useConnection() {
  const isOnline = ref(navigator.onLine)
  const wasOffline = ref(false)

  function handleOnline() {
    isOnline.value = true
    connectionState.isOnline = true

    if (wasOffline.value) {
      wasOffline.value = false
      console.log('[Offline] Retour en ligne détecté, déclenchement sync')
      window.dispatchEvent(new CustomEvent('app:online'))
    }
  }

  function handleOffline() {
    isOnline.value = false
    wasOffline.value = true
    connectionState.isOnline = false
    console.log('[Offline] Connexion perdue')
    window.dispatchEvent(new CustomEvent('app:offline'))
  }

  onMounted(() => {
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Vérification périodique (ping)
    const pingInterval = setInterval(async () => {
      try {
        const resp = await fetch('/ping', { method: 'GET', cache: 'no-store' })
        if (resp.ok && !isOnline.value) {
          handleOnline()
        }
      } catch {
        if (isOnline.value) handleOffline()
      }
    }, 30000) // Toutes les 30 secondes

    onUnmounted(() => {
      clearInterval(pingInterval)
    })
  })

  onUnmounted(() => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  })

  return { isOnline, wasOffline }
}
```

### 9.2 SyncManager Complet

```typescript
// src/services/offline/syncManager.ts

import { db } from './db'
import { OfflineQueueService } from './queueService'
import { OfflineCacheService } from './cacheService'
import { useOfflineStore } from '@/composables/offline/offlineStore'
import apiClient from '@/services/apiClient'
import { v4 as uuidv4 } from 'uuid'

export class SyncManager {
  private static instance: SyncManager

  static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager()
    }
    return SyncManager.instance
  }

  /**
   * Chargement initial complet pour un nouvel appareil
   */
  async initialLoad(hotelId: number): Promise<{
    totalItems: number
    checkpoint: number
  }> {
    const store = useOfflineStore()
    store.setSyncing(true)

    try {
      const deviceId = this.getDeviceId()
      const response = await apiClient.post('/api/sync/initial-load', {
        hotelId,
        deviceId,
      })

      const { data, checkpoint } = response.data

      // Stocker chaque ressource dans IndexedDB
      for (const [resourceType, resources] of Object.entries(data)) {
        if (Array.isArray(resources)) {
          for (const resource of resources) {
            await OfflineCacheService.set(resourceType, resource.id, resource, {
              ttlMs: OfflineCacheService.TTL.CONFIG,
            })
          }
        } else if (typeof resources === 'object' && resources !== null) {
          // Cas particulier hotel (objet unique)
          await OfflineCacheService.set(resourceType, resources.id, resources, {
            ttlMs: OfflineCacheService.TTL.CONFIG,
          })
        }
      }

      // Enregistrer le checkpoint
      await db.checkpoints.put({
        resourceType: '*',
        lastVersion: checkpoint,
        lastSyncAt: new Date().toISOString(),
      })

      store.setLastSync(new Date().toISOString())

      const totalItems = Object.values(data).reduce(
        (sum: number, arr: any) => sum + (Array.isArray(arr) ? arr.length : 1),
        0
      )

      return { totalItems, checkpoint }
    } finally {
      store.setSyncing(false)
    }
  }

  /**
   * Synchronisation complète : Push + Pull
   */
  async sync(hotelId: number): Promise<{
    pushed: number
    pulled: number
    conflicts: number
  }> {
    const store = useOfflineStore()

    if (!navigator.onLine || store.isSyncing.value) {
      return { pushed: 0, pulled: 0, conflicts: 0 }
    }

    store.setSyncing(true)

    try {
      const deviceId = this.getDeviceId()

      // ═══════════════ ÉTAPE 1 : PUSH ═══════════════
      const pending = await OfflineQueueService.getPending()
      let pushedCount = 0
      let conflictCount = 0

      if (pending.length > 0) {
        const pushResponse = await apiClient.post('/api/sync/push', {
          hotelId,
          deviceId,
          lastSyncVersion: 0,
          operations: pending.map(op => ({
            operationId: op.operationId,
            operationType: op.operationType,
            resourceType: op.resourceType,
            resourceId: typeof op.resourceId === 'number' ? op.resourceId : undefined,
            payload: op.payload,
            clientTimestamp: op.createdAt,
            priority: op.priority,
          })),
        })

        const pushResult = pushResponse.data

        // Traiter les résultats
        for (const processed of pushResult.processed || []) {
          const item = pending.find(p => p.operationId === processed.operationId)
          if (item?.id) {
            if (processed.status === 'completed') {
              await OfflineQueueService.markCompleted(item.id, processed)
              pushedCount++
            } else if (processed.status === 'conflicted') {
              await OfflineQueueService.markFailed(
                item.id,
                'Version conflict',
                false,
                pushResult.conflicts?.find((c: any) => c.operationId === processed.operationId)
              )
              conflictCount++
            }
          }
        }

        // Traiter les erreurs
        for (const error of pushResult.errors || []) {
          const item = pending.find(p => p.operationId === error.operationId)
          if (item?.id) {
            await OfflineQueueService.markFailed(item.id, error.error, error.retryable)
          }
        }
      }

      // ═══════════════ ÉTAPE 2 : PULL ═══════════════
      const lastCheckpoint = await db.checkpoints
        .where('resourceType')
        .equals('*')
        .first()

      const pullResponse = await apiClient.post('/api/sync/pull', {
        hotelId,
        deviceId,
        lastSyncVersion: lastCheckpoint?.lastVersion || 0,
        resourceTypes: [
          'reservation', 'guest', 'room', 'folio', 'folio_transaction',
          'room_type', 'rate_type', 'room_rate', 'extra_charge',
          'booking_source', 'payment_method', 'tax_rate', 'discount',
          'vip_status', 'room_block', 'work_order',
        ],
      })

      const pullResult = pullResponse.data
      let pulledCount = 0

      for (const [resourceType, changes] of Object.entries(pullResult.changes)) {
        const typedChanges = changes as any

        // Nouveaux enregistrements
        for (const created of typedChanges.created || []) {
          await OfflineCacheService.set(resourceType, created.id, created, {
            version: created.version,
          })
          pulledCount++
        }

        // Mises à jour
        for (const updated of typedChanges.updated || []) {
          await OfflineCacheService.set(resourceType, updated.id, updated, {
            version: updated.version,
          })
          pulledCount++
        }

        // Suppressions
        for (const deleted of typedChanges.deleted || []) {
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
    } finally {
      store.setSyncing(false)
    }
  }

  /**
   * Obtenir l'ID du périphérique
   */
  private getDeviceId(): string {
    let deviceId = localStorage.getItem('deviceId')
    if (!deviceId) {
      deviceId = `web-${uuidv4()}`
      localStorage.setItem('deviceId', deviceId)
    }
    return deviceId
  }
}

export const syncManager = SyncManager.getInstance()
```

### 9.3 Cycle de Vie de la Synchronisation

```
DÉMARRAGE / AUTHENTIFICATION
    │
    ├── App.vue onMounted
    │   ├── useConnection() → écoute online/offline
    │   └── usePwaUpdate() → PWA
    │
    ├── Connexion utilisateur
    │   ├── Récupération hotelId
    │   └── syncManager.initialLoad(hotelId) → chargement initial
    │
    ├── UTILISATION NORMALE
    │   ├── Tous les appels API passent par offlineAwareApiCall()
    │   ├── Si online → API + mise à jour cache
    │   └── Si offline → IndexedDB + queue
    │
    ├── RECONNEXION (online event)
    │   ├── syncManager.sync(hotelId)
    │   │   ├── PUSH pending operations
    │   │   ├── PULL changes distants
    │   │   └── Mise à jour cache local
    │   ├── Notification toast : "Sync terminée (X enregistrements)"
    │   └── Rafraîchissement UI
    │
    ├── SYNC PÉRIODIQUE
    │   ├── Toutes les 5 minutes si online
    │   └── syncManager.sync(hotelId) (silencieux)
    │
    └── CHANGEMENT D'HÔTEL / DÉCONNEXION
        ├── OfflineCacheService.clearHotelData()
        └── db.queue.clear() (optionnel)
```

---

## 10. Comportement par Module Métier

### 10.1 Réservations

| Action | Online | Offline | Priorité Queue |
|--------|--------|---------|:--------------:|
| Consultation planning | API → cache | Cache IndexedDB | — |
| Check-in | API → statut réel | Queue + UI optimiste | 🔴 10 |
| Check-out | API → statut réel | Queue + UI optimiste | 🔴 10 |
| Création réservation | API → ID serveur | Queue + ID temporaire | 🟠 7 |
| Amend stay (modification dates) | API | Queue | 🟡 5 |
| Annulation | API | Queue | 🟠 8 |
| No-show | API | Queue | 🟠 8 |
| Room move | API | Queue | 🟠 7 |
| Assigner chambre | API | Queue | 🟠 7 |

### 10.2 Finances (Folios & Transactions)

| Principe | Description |
|----------|-------------|
| **Mise à jour optimiste** | Le solde du folio est recalculé localement |
| **Server-wins en cas de conflit** | Le serveur a toujours raison pour les montants |
| **Badge "Provisoire"** | Transactions non synchronisées affichées en orange |
| **Void de transaction** | Queue avec vérification d'intégrité à la sync |

### 10.3 Clients

| Action | Online | Offline | Priorité Queue |
|--------|--------|---------|:--------------:|
| Création client | API → ID serveur | Queue + ID temporaire | 🟠 7 |
| Modification client | API | Queue | 🟡 5 |
| Recherche client | API | Cache IndexedDB (tous) | — |
| Ajout note | API | Queue | 🔵 2 |
| Blacklist | API | Queue | 🟡 5 |

### 10.4 Chambres & Housekeeping

| Action | Online | Offline | Priorité Queue |
|--------|--------|---------|:--------------:|
| Consultation statuts | API | Cache + IndexedDB | — |
| Changement statut chambre | API | Queue + UI immédiate | 🟠 7 |
| Changement housekeeping | API | Queue + UI immédiate | 🟠 7 |
| Rapport maintenance | API | Queue | 🟡 5 |

### 10.5 Configuration

Toutes les données de configuration sont **lecture seule** en mode hors ligne. Elles sont chargées lors de l'`initialLoad` et mises à jour via le `PULL`.

---

## 11. Gestion des Conflits

### 11.1 Stratégies par Type de Ressource

| Ressource | Stratégie | Raison |
|-----------|-----------|--------|
| **Réservation** | Last-Write-Wins basé sur timestamp | Opérations séquentielles |
| **FolioTransaction** | **Server-Wins** | Intégrité financière critique |
| **Folio** | Server-Wins (balance) | Le serveur est la source de vérité |
| **Guest** | Merge manuel (priorité basse) | Données client importantes |
| **Room (status)** | Last-Write-Wins | Statut en temps réel |
| **Configuration** | Server-Wins | Source de vérité : serveur |

### 11.2 Détection des Conflits (Backend)

```
Client (version 3)                Serveur (version 5)
      │                                 │
      ├── PUT /api/sync/push ──────────▶│
      │   { version: 3 }               │
      │                                 │
      │              ┌──────────────────┤
      │              │ Vérification :   │
      │              │ v5 > v3          │
      │              │ → CONFLIT !      │
      │              └──────────────────┤
      │                                 │
      │◀── 200 OK (conflict: true) ─────┤
      │   {                             │
      │     conflicts: [{               │
      │       resourceType: "reservation"│
      │       resourceId: 123,          │
      │       serverVersion: 5,         │
      │       clientVersion: 3,         │
      │       resolution: "server_wins" │
      │     }]                          │
      │   }                             │
```

### 11.3 Résolution de Conflit (Frontend)

```vue
<!-- src/components/offline/ConflictResolutionModal.vue -->
<template>
  <div v-if="visible" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div class="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl">
      <!-- En-tête -->
      <div class="flex items-center gap-3 border-b pb-4">
        <div class="rounded-full bg-yellow-100 p-2 text-yellow-600">
          ⚠️
        </div>
        <div>
          <h2 class="text-lg font-bold">Conflit de Synchronisation</h2>
          <p class="text-sm text-gray-500">
            {{ conflictLabel }} — Des modifications ont été faites à la fois en local et sur le serveur
          </p>
        </div>
      </div>

      <!-- Contenu -->
      <div class="grid grid-cols-2 gap-4 py-4">
        <!-- Version locale -->
        <div class="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div class="mb-2 flex items-center gap-2 font-semibold text-blue-700">
            📱 Version Locale (v{{ conflict?.clientVersion || '?' }})
          </div>
          <pre class="max-h-48 overflow-auto rounded bg-white p-3 text-xs">{{ formatJSON(conflict?.clientData) }}</pre>
          <button
            @click="resolve('client_wins')"
            class="mt-3 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            Garder la version locale
          </button>
        </div>

        <!-- Version serveur -->
        <div class="rounded-lg border border-green-200 bg-green-50 p-4">
          <div class="mb-2 flex items-center gap-2 font-semibold text-green-700">
            ☁️ Version Serveur (v{{ conflict?.serverVersion || '?' }})
          </div>
          <pre class="max-h-48 overflow-auto rounded bg-white p-3 text-xs">{{ formatJSON(conflict?.serverData) }}</pre>
          <button
            @click="resolve('server_wins')"
            class="mt-3 w-full rounded-lg bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"
          >
            Garder la version serveur
          </button>
        </div>
      </div>

      <!-- Pied -->
      <div class="flex justify-end border-t pt-3">
        <button @click="$emit('close')" class="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">
          Plus tard
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import apiClient from '@/services/apiClient'
import { useOfflineStore } from '@/composables/offline/offlineStore'

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
  try { return JSON.stringify(data, null, 2) }
  catch { return String(data) }
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

---

## 12. Changements Côté Backend

### 12.1 Ce qui Existe Déjà

| Élément | Statut | Fichier |
|---------|--------|---------|
| Migration `offline_mode_enabled` sur hotels | ✅ Fait | `1783000000000_*.ts` |
| Migration colonne `version` sur 5 tables | ✅ Fait | `1783000000000_*.ts` |
| Séquence `sync_version_seq` | ✅ Fait | `1783000000000_*.ts` |
| Index `updated_at` sur 5 tables | ✅ Fait | `1783000000000_*.ts` |
| Tables sync (operations, conflicts, checkpoints) | ✅ Fait | `1783000000001_*.ts` |
| Modèles SyncOperation, SyncConflict, SyncCheckpoint | ✅ Fait | `app/models/sync_*.ts` |
| SyncService (processBatch, pullChanges, initialLoad) | ✅ Fait | `app/services/sync_service.ts` |
| SyncController (push, pull, status, conflicts, initialLoad) | ✅ Fait | `app/controllers/sync_controller.ts` |
| Routes /api/sync/* | ✅ Fait | `start/routes.ts` |
| Validateur sync (push, pull, initialLoad, resolveConflict) | ✅ Fait | `app/validators/sync.ts` |
| Middleware checkOfflineMode | ✅ Fait | `app/middleware/check_offline_mode_middleware.ts` |
| Middleware syncRateLimit | ✅ Fait | `app/middleware/sync_rate_limit_middleware.ts` |
| PATCH toggle-offline-mode | ✅ Fait | `hotels_controller.ts` |

### 12.2 Ce qu'il FAUT AJOUTER / MODIFIER

#### 12.2.1 Ajouter les `version` aux tables manquantes

Actuellement, seules 5 tables ont une colonne `version`. Il faut l'ajouter aux autres tables critiques :

```sql
-- Tables critiques qui nécessitent une version
ALTER TABLE room_types ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE rate_types ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE room_rates ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE extra_charges ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE booking_sources ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE tax_rates ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE discounts ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE room_blocks ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE vip_statuses ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE black_list_reasons ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Index sur updated_at pour ces tables
CREATE INDEX IF NOT EXISTS idx_room_types_updated ON room_types(updated_at);
CREATE INDEX IF NOT EXISTS idx_rate_types_updated ON rate_types(updated_at);
CREATE INDEX IF NOT EXISTS idx_room_rates_updated ON room_rates(updated_at);
CREATE INDEX IF NOT EXISTS idx_extra_charges_updated ON extra_charges(updated_at);
CREATE INDEX IF NOT EXISTS idx_booking_sources_updated ON booking_sources(updated_at);
CREATE INDEX IF NOT EXISTS idx_payment_methods_updated ON payment_methods(updated_at);
CREATE INDEX IF NOT EXISTS idx_tax_rates_updated ON tax_rates(updated_at);
CREATE INDEX IF NOT EXISTS idx_discounts_updated ON discounts(updated_at);
CREATE INDEX IF NOT EXISTS idx_work_orders_updated ON work_orders(updated_at);
CREATE INDEX IF NOT EXISTS idx_room_blocks_updated ON room_blocks(updated_at);
CREATE INDEX IF NOT EXISTS idx_vip_statuses_updated ON vip_statuses(updated_at);
```

#### 12.2.2 Étendre le SyncService — Ajouter les `executeOperation` manquantes

Le `SyncService.executeOperation()` doit gérer TOUS les types de ressources que le frontend peut envoyer :

```typescript
// Dans app/services/sync_service.ts — À AJOUTER

private static async executeOperation(
  op: SyncOperationInput,
  hotelId: number,
  userId: number
): Promise<{ serverId: number; version: number }> {
  switch (op.resourceType) {
    case 'reservation':
      return this.executeReservationOperation(op, hotelId, userId)
    case 'guest':
      return this.executeGuestOperation(op, hotelId, userId)
    case 'folio_transaction':
      return this.executeFolioTransactionOperation(op, hotelId, userId)
    case 'room':
      return this.executeRoomOperation(op, hotelId, userId)
    case 'folio':
      return this.executeFolioOperation(op, hotelId, userId)
    // ── NOUVEAUX TYPES À AJOUTER ──
    case 'booking_source':
      return this.executeConfigOperation('booking_sources', op, hotelId)
    case 'payment_method':
      return this.executeConfigOperation('payment_methods', op, hotelId)
    case 'tax_rate':
      return this.executeConfigOperation('tax_rates', op, hotelId)
    case 'discount':
      return this.executeConfigOperation('discounts', op, hotelId)
    case 'work_order':
      return this.executeWorkOrderOperation(op, hotelId, userId)
    case 'room_block':
      return this.executeRoomBlockOperation(op, hotelId, userId)
    case 'vip_status':
      return this.executeConfigOperation('vip_statuses', op, hotelId)
    case 'black_list_reason':
      return this.executeConfigOperation('black_list_reasons', op, hotelId)
    case 'notification':
      return this.executeNotificationOperation(op, hotelId, userId)
    case 'announcement':
      return this.executeAnnouncementOperation(op, userId)
    default:
      throw new Error(`Unsupported resource type: ${op.resourceType}`)
  }
}

// Méthode générique pour les opérations CRUD simples sur les tables de config
private static async executeConfigOperation(
  table: string,
  op: SyncOperationInput,
  hotelId: number
): Promise<{ serverId: number; version: number }> {
  switch (op.operationType) {
    case 'create': {
      const result = await db.table(table).insert({
        ...op.payload,
        hotel_id: hotelId,
      }).returning('id')
      return { serverId: result[0].id, version: 1 }
    }
    case 'update': {
      await db.table(table).where('id', op.resourceId).update(op.payload)
      return { serverId: op.resourceId!, version: (op.payload.version || 1) + 1 }
    }
    case 'delete': {
      await db.table(table).where('id', op.resourceId).delete()
      return { serverId: op.resourceId!, version: 0 }
    }
    default:
      throw new Error(`Unknown operation type: ${op.operationType}`)
  }
}
```

#### 12.2.3 Étendre le `initialLoad` pour inclure plus de ressources

Le `initialLoad` doit charger **toutes les ressources** nécessaires :

```typescript
// Dans SyncService.initialLoad() — Ces ressources sont déjà ajoutées
// Vérifier que les nouvelles ressources suivantes sont incluses :
// - bookingSources ✅
// - paymentMethods ✅
// - taxRates ✅
// - discounts ✅
// - workOrders ✅
// - roomBlocks ✅
// - vipStatuses ✅
// - blackListReasons ✅
// - notifications ✅ (filtrées STAFF)
// - announcements ✅ (filtrées is_active)
```

#### 12.2.4 Améliorer la résolution des conflits par table

```typescript
// Dans SyncService.resolveConflict() — Mettre à jour le tableMap
// pour supporter toutes les tables

private static readonly TABLE_MAP: Record<string, string> = {
  reservation: 'reservations',
  guest: 'guests',
  room: 'rooms',
  folio: 'folios',
  folio_transaction: 'folio_transactions',
  booking_source: 'booking_sources',
  payment_method: 'payment_methods',
  tax_rate: 'tax_rates',
  discount: 'discounts',
  work_order: 'work_orders',
  room_block: 'room_blocks',
  vip_status: 'vip_statuses',
  black_list_reason: 'black_list_reasons',
  notification: 'notifications',
  announcement: 'announcements',
  room_type: 'room_types',
  rate_type: 'rate_types',
  room_rate: 'room_rates',
  extra_charge: 'extra_charges',
  business_source: 'business_sources',
  market_code: 'market_codes',
  reservation_type: 'reservation_types',
}
```

#### 12.2.5 Endpoint d'information sur l'état offline

Ajouter un endpoint pour que le frontend puisse vérifier si le mode offline est supporté :

```typescript
// Dans sync_controller.ts
async offlineInfo({ request, response, auth }: HttpContext) {
  const user = auth.user!
  const hotelId = request.input('hotelId')
  
  const hotel = await Hotel.findOrFail(hotelId)
  
  return response.ok({
    offlineModeEnabled: hotel.offlineModeEnabled,
    supportedResources: Object.keys(SyncService.TABLE_MAP),
    maxBatchSize: 100,
    maxRetries: 3,
    supportedVersions: ['1.0'],
  })
}
```

---

## 13. Stores Pinia & Composables Offline

### 13.1 offlineStore (Pinia)

```typescript
// src/composables/offline/offlineStore.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db } from '@/services/offline/db'

export const useOfflineStore = defineStore('offline', () => {
  // État
  const isOnline = ref(navigator.onLine)
  const isSyncing = ref(false)
  const lastSyncAt = ref<string | null>(localStorage.getItem('lastSyncAt'))
  const pendingCount = ref(0)
  const conflictsCount = ref(0)

  // Getters
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

  // Actions
  async function refreshPendingCount() {
    pendingCount.value = await db.queue
      .where('status')
      .anyOf('pending', 'failed')
      .count()

    conflictsCount.value = await db.conflicts
      .where('resolution')
      .equals('pending')
      .count()
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

### 13.2 ConnectionStatus.vue

Voir le composant existant dans les sources — doit être amélioré pour montrer :
- 🟢 En ligne (aucune action nécessaire)
- 🟡 X en attente (avec bouton "Sync")
- 🔴 Hors ligne (avec message)
- 🔄 Synchronisation en cours (avec animation)

### 13.3 Intégration dans App.vue

```typescript
// Dans App.vue (déjà partiellement fait)

import { onMounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { syncManager } from '@/services/offline/syncManager'
import { useConnection } from '@/composables/useConnection'
import { useOfflineStore } from '@/composables/offline/offlineStore'
import { useToast } from 'vue-toastification'

const authStore = useAuthStore()
const offlineStore = useOfflineStore()
const toast = useToast()
const { isOnline } = useConnection()

// ═══════════════════════════════════════════════════
// 1. CHARGEMENT INITIAL AU DÉMARRAGE
// ═══════════════════════════════════════════════════
onMounted(async () => {
  if (authStore.isAuthenticated && authStore.hotelId) {
    try {
      await syncManager.initialLoad(authStore.hotelId)
      toast.success('Données chargées pour le mode hors ligne')
    } catch (error) {
      console.warn('Initial load offline skipped:', error)
    }
  }
})

// ═══════════════════════════════════════════════════
// 2. SYNC AUTOMATIQUE À LA RECONNEXION
// ═══════════════════════════════════════════════════
window.addEventListener('app:online', async () => {
  const hotelId = authStore.hotelId
  if (!hotelId) return

  toast.info('Synchronisation en cours...', { timeout: 3000 })

  try {
    const result = await syncManager.sync(hotelId)
    if (result.pushed > 0 || result.pulled > 0) {
      toast.success(
        `${result.pushed} opération(s) envoyée(s), ${result.pulled} mise(s) à jour reçue(s)`
      )
    }
    if (result.conflicts > 0) {
      toast.warning(`${result.conflicts} conflit(s) à résoudre`)
    }
  } catch {
    toast.error('Échec de la synchronisation')
  }
})

// ═══════════════════════════════════════════════════
// 3. SYNC PÉRIODIQUE (toutes les 5 minutes)
// ═══════════════════════════════════════════════════
let syncInterval: ReturnType<typeof setInterval> | null = null

watch(isOnline, (online) => {
  if (online && authStore.hotelId) {
    syncInterval = setInterval(() => {
      syncManager.sync(authStore.hotelId!).catch(() => {})
    }, 5 * 60 * 1000)
  } else if (syncInterval) {
    clearInterval(syncInterval)
    syncInterval = null
  }
})

// ═══════════════════════════════════════════════════
// 4. CHANGEMENT D'HÔTEL
// ═══════════════════════════════════════════════════
watch(() => authStore.hotelId, async (newHotelId, oldHotelId) => {
  if (newHotelId && newHotelId !== oldHotelId) {
    await OfflineCacheService.clearHotelData()
    await syncManager.initialLoad(newHotelId)
  }
})
```

---

## 14. Plan d'Implémentation Recommandé

### Phase 1 — Mise à jour de l'IndexedDB (Schéma complet)

| # | Tâche | Fichier |
|---|-------|---------|
| 1.1 | Réécrire `db.ts` avec toutes les tables métier | `services/offline/db.ts` |
| 1.2 | Adapter `cacheService.ts` pour utiliser le nouveau schéma | `services/offline/cacheService.ts` |
| 1.3 | Adapter `queueService.ts` avec les nouveaux types | `services/offline/queueService.ts` |
| 1.4 | Créer `idService.ts` (gestion IDs temporaires) | `services/offline/idService.ts` |

### Phase 2 — Proxy API & OfflineAwareApiCall

| # | Tâche | Fichier |
|---|-------|---------|
| 2.1 | Créer `apiProxy.ts` complet | `services/offline/apiProxy.ts` |
| 2.2 | Remplacer les appels Axios dans les services API par `offlineAwareApiCall` | Tous les services API |

### Phase 3 — UI Offline

| # | Tâche | Fichier |
|---|-------|---------|
| 3.1 | Créer `offlineStore.ts` (Pinia) | `composables/offline/offlineStore.ts` |
| 3.2 | Améliorer `ConnectionStatus.vue` | `components/common/ConnectionStatus.vue` |
| 3.3 | Ajouter badge dans `AppHeader.vue` | `components/layout/AppHeader.vue` |
| 3.4 | Créer `ConflictResolutionModal.vue` | `components/offline/ConflictResolutionModal.vue` |
| 3.5 | Créer `useOfflineForm.ts` (auto-save) | `composables/offline/useOfflineForm.ts` |

### Phase 4 — Backend

| # | Tâche | Priorité |
|---|-------|----------|
| 4.1 | Migration : ajouter `version` aux tables manquantes | 🔴 Haute |
| 4.2 | Migration : ajouter index `updated_at` | 🔴 Haute |
| 4.3 | Étendre `SyncService.executeOperation()` pour tous les types | 🔴 Haute |
| 4.4 | Ajouter endpoint `GET /api/sync/info` | 🟢 Basse |

### Phase 5 — Intégration Métier

| # | Module | Priorité |
|---|--------|----------|
| 5.1 | Réservations (check-in/out, création) | 🔴 Critique |
| 5.2 | Folios & Transactions financières | 🔴 Critique |
| 5.3 | Clients (création, modification) | 🟡 Haute |
| 5.4 | Chambres & Housekeeping | 🟡 Haute |
| 5.5 | Configuration (lecture seule) | 🟢 Normale |

---

## Annexe A : Modification du validateur sync (côté backend)

Le validateur `sync.ts` doit être mis à jour pour supporter les nouveaux types de ressources :

```typescript
// app/validators/sync.ts — Ressources supportées
resourceType: vine.enum([
  'reservation', 'guest', 'room', 'folio', 'folio_transaction',
  'room_type', 'rate_type', 'room_rate', 'extra_charge',
  'booking_source', 'payment_method', 'tax_rate', 'discount',
  'work_order', 'room_block', 'vip_status', 'black_list_reason',
  'notification', 'announcement',
  'business_source', 'market_code', 'reservation_type',  // Nouveaux
] as const),
```

✅ Cette modification est déjà faite dans le code actuel.

---

## Annexe B : Migration pour les colonnes `version` manquantes

```typescript
// database/migrations/XXXXXXXXXXXXXX_add_version_to_tables.ts

import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    const tables = [
      'room_types', 'rate_types', 'room_rates', 'extra_charges',
      'booking_sources', 'payment_methods', 'tax_rates', 'discounts',
      'work_orders', 'room_blocks', 'vip_statuses', 'black_list_reasons',
      'notifications', 'announcements',
    ]

    for (const table of tables) {
      this.schema.alterTable(table, (t) => {
        t.integer('version').notNullable().defaultTo(1)
      })
      this.schema.raw(`
        CREATE INDEX IF NOT EXISTS idx_${table}_updated ON ${table}(updated_at);
      `)
    }
  }

  async down() {
    const tables = [
      'room_types', 'rate_types', 'room_rates', 'extra_charges',
      'booking_sources', 'payment_methods', 'tax_rates', 'discounts',
      'work_orders', 'room_blocks', 'vip_statuses', 'black_list_reasons',
      'notifications', 'announcements',
    ]

    for (const table of tables) {
      this.schema.raw(`DROP INDEX IF EXISTS idx_${table}_updated;`)
      this.schema.alterTable(table, (t) => {
        t.dropColumn('version')
      })
    }
  }
}
```

---

> **Document créé le 7 juillet 2026 — Dernière mise à jour : 7 juillet 2026**
>
> Ce document sert de plan directeur pour l'implémentation complète du mode hors ligne.
> Chaque phase doit être validée avant de passer à la suivante.
