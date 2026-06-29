# Rapport d'Audit — Implémentation Mode Offline Frontend (EnjoyAdmin)

**Date :** 29 juin 2026  
**Auteur :** Audit automatique  
**Projet :** `E:\dev\EnjoyAdmin`

---

## 1. Résumé Exécutif

| Métrique | Valeur |
|----------|--------|
| **Fichiers créés** | 6 fichiers (5 services + 1 composant) |
| **Fichiers modifiés** | 4 fichiers (App.vue, vite.config.ts, usePwaUpdate.ts, useConnection.ts) |
| **Package installé** | Dexie.js v4.4.4 |
| **Lignes de code offline** | ~950 lignes |
| **TypeScript** | ✅ Compilation OK |

### Ce qui fonctionne
- ✅ Base de données IndexedDB (Dexie) avec 4 tables
- ✅ File d'attente offline avec priorités
- ✅ SyncManager (push/pull/initial-load)
- ✅ Détection connexion (online/offline/unstable) avec état partagé
- ✅ Badge ConnectionStatus dans l'UI
- ✅ Stratégies Workbox améliorées (StaleWhileRevalidate + CacheFirst)
- ✅ PWA update enrichi avec background sync
- ✅ Intégration dans App.vue (v-if fixed)

### Ce qui MANQUE encore
- ❌ **OfflineCacheService** complet (getAll, invalidate, syncFromServer, pending items)
- ❌ **apiProxy.ts** (offlineAwareApiCall — proxy intelligent Axios↔IndexedDB)
- ❌ **offlineStore.ts** (Pinia store avec syncStatus, syncStatusColor, needsAttention)
- ❌ **draftService.ts** (auto-save des formulaires)
- ❌ **useOfflineForm.ts** (composable auto-save)
- ❌ **useOfflineReady.ts** (vérifier disponibilité offline des données)
- ❌ **ConflictResolutionModal.vue** (modal résolution conflits)
- ❌ **AppHeader.vue** (indicateur statut sync dans header)
- ❌ **initialLoad** ne charge pas encore les réservations 15j avant + infini ni les folios/transactions/paiements

---

## 2. Détail par Composant

### 2.1 Services (src/services/offline/)

| Fichier | Statut | Lignes | Description |
|---------|--------|--------|-------------|
| `db.ts` | ✅ Fait | 199 | Dexie DB : apiCache, syncQueue, drafts, checkpoints |
| `queue.ts` | ✅ Fait | 154 | File d'attente avec priorités (10/7/5/2) |
| `syncManager.ts` | ✅ Fait (partiel) | 269 | Push/pull/initialLoad — **manque les réservations 15j→infini** |
| `connectionState.ts` | ✅ Fait | 17 | État réactif partagé (singleton) |
| `index.ts` | ✅ Fait | 10 | Barrel export |
| `cacheService.ts` | ❌ Manquant | — | OfflineCacheService : getAll, invalidate, syncFromServer |
| `apiProxy.ts` | ❌ Manquant | — | offlineAwareApiCall : proxy Axios↔IndexedDB |
| `draftService.ts` | ❌ Manquant | — | Auto-save formulaires avec DraftService |

### 2.2 Composables (src/composables/)

| Fichier | Statut | Lignes | Description |
|---------|--------|--------|-------------|
| `useConnection.ts` | ✅ Fait | 119 | Détection online/offline + déclenchement sync |
| `usePwaUpdate.ts` | ✅ Fait | 88 | PWA update enrichi avec periodicSync |
| `offlineStore.ts` | ❌ Manquant | — | Pinia store : syncStatus, pendingCount, needsAttention |
| `useOfflineForm.ts` | ❌ Manquant | — | Auto-save formulaires (watch + debounce 30s) |
| `useOfflineReady.ts` | ❌ Manquant | — | Vérifier si données disponibles offline |

### 2.3 Composants (src/components/)

| Fichier | Statut | Lignes | Description |
|---------|--------|--------|-------------|
| `common/ConnectionStatus.vue` | ✅ Fait | 188 | Badge statut connexion (vert/jaune/rouge) |
| `offline/ConflictResolutionModal.vue` | ❌ Manquant | — | Modal résolution conflits client/server |

### 2.4 Intégration

| Point d'intégration | Statut | Détail |
|---------------------|--------|--------|
| `vite.config.ts` | ✅ Fait | 3 stratégies Workbox (API, Fonts, Images) |
| `App.vue` template | ✅ Corrigé | `<ConnectionStatus v-if="...">` réparé |
| `App.vue` script | ✅ Fait | Import syncManager, useConnection, init hotel |
| `App.vue` watcher auth | ✅ Fait | syncManager.init(hotelId) + startPeriodicSync |
| `AppHeader.vue` | ❌ Manquant | Badge statut sync à côté du menu utilisateur |
| `apiClient.ts` (interceptor) | ❌ Manquant | Fallback offline dans l'interceptor Axios |

---

## 3. Ce qu'il faut implémenter pour l'initialLoad complet

Le guide et votre demande précisent que l'initialLoad doit charger **toutes les données nécessaires pour fonctionner en offline complet**. Voici ce que ça implique :

### 3.1 Ressources à charger lors de l'initialLoad

| Ressource | Période | Priorité | Pourquoi |
|-----------|---------|----------|----------|
| **Réservations** | J-15 → ∞ | 🔴 Critique | Voir planning, check-in, check-out |
| **RéservationRooms** | J-15 → ∞ | 🔴 Critique | Assignations chambres |
| **Folios** | J-15 → ∞ | 🔴 Critique | Soldes, transactions |
| **FolioTransactions** | J-15 → ∞ | 🔴 Critique | Paiements, facturation |
| **Clients (Guests)** | Tous | 🔴 Critique | Rechercher, modifier clients |
| **Chambres** | Tous | 🟡 Haute | Statuts, housekeeping |
| **Types de chambres** | Tous | 🟡 Haute | Configuration tarifs |
| **Tarifs** | Tous | 🟡 Haute | Calcul prix |
| **Suppl./Extra charges** | Tous | 🟡 Haute | Ajout transactions |
| **Méthodes de paiement** | Tous | 🟡 Haute | Paiements offline |
| **Taxes** | Tous | 🟢 Normale | Facturation |
| **Remises** | Tous | 🟢 Normale | Application remises |

### 3.2 Modifications nécessaires

1. **Backend** — Ajouter un paramètre `dateFrom` à `POST /api/sync/initial-load` pour récupérer les réservations à partir de J-15
2. **Backend** — Ajouter `folio` et `folio_transaction` aux `INITIAL_LOAD_RESOURCES` du `SyncController`
3. **Frontend** — Mettre à jour `syncManager.ts` `initialLoad()` pour inclure :
   - Les réservations de J-15 à ∞
   - Les folios associés à ces réservations
   - Les transactions de ces folios
   - Les guests associés
4. **Frontend** — Mettre à jour `INITIAL_LOAD_RESOURCES` dans `syncManager.ts`

---

## 4. Backend — Vérification

### 4.1 Ce qui existe déjà côté backend

| Élément | Statut | Fichier |
|---------|--------|---------|
| Migration `offline_mode_enabled` | ✅ Fait | `1783000000000_add_offline_mode_to_hotels_and_version_columns.ts` |
| Tables sync (operations, conflicts, checkpoints) | ✅ Fait | `1783000000001_create_sync_tables.ts` |
| Modèles SyncOperation, SyncConflict, SyncCheckpoint | ✅ Fait | `app/models/sync_*.ts` |
| SyncService | ✅ Fait | `app/services/sync_service.ts` |
| SyncController | ✅ Fait | `app/controllers/sync_controller.ts` |
| Routes /api/sync/* | ✅ Fait | `start/routes.ts` |
| Validateur sync | ✅ Fait | `app/validators/sync.ts` |
| Middleware checkOfflineMode | ✅ Fait | `app/middleware/check_offline_mode_middleware.ts` |
| Middleware syncRateLimit | ✅ Fait | `app/middleware/sync_rate_limit_middleware.ts` |
| PATCH /hotels/:id/toggle-offline-mode | ✅ Fait | `hotels_controller.ts` |

### 4.2 Ce qu'il faut ajouter côté backend

| Élément | Priorité | Description |
|---------|----------|-------------|
| **Paramètre `dateFrom` dans initialLoad** | 🔴 Haute | Pour récupérer les réservations à partir de J-15 |
| **Ajouter folio + folio_transaction au initialLoad** | 🔴 Haute | Actuellement pas inclus |
| **Ajouter guest à l'initialLoad** | 🔴 Haute | Pour avoir les infos clients offline |

---

## 5. Plan Recommandé

### Phase A — Backend (immédiat)
1. Ajouter `dateFrom` param à `POST /api/sync/initial-load`
2. Ajouter `folio`, `folio_transaction`, `guest` aux ressources initialLoad
3. Étendre `initialLoad` pour charger J-15 → ∞

### Phase B — Services Offline Frontend
1. Créer `cacheService.ts` (OfflineCacheService complet)
2. Créer `apiProxy.ts` (offlineAwareApiCall)
3. Créer `offlineStore.ts` (Pinia store)
4. Créer `draftService.ts` + `useOfflineForm.ts` + `useOfflineReady.ts`

### Phase C — UI & Intégration
1. Ajouter badge statut dans `AppHeader.vue`
2. Ajouter `ConflictResolutionModal.vue`
3. Ajouter interceptor offline dans `apiClient.ts`

---

## 6. Fichiers Actuels — Résumé des Lignes

```
src/services/offline/
├── db.ts              ✅  199 lignes
├── queue.ts           ✅  154 lignes
├── syncManager.ts     ✅  269 lignes (à étendre)
├── connectionState.ts ✅   17 lignes
└── index.ts           ✅   10 lignes

src/composables/
├── useConnection.ts   ✅  119 lignes
├── usePwaUpdate.ts    ✅   88 lignes
└── (manque: offlineStore.ts, useOfflineForm.ts, useOfflineReady.ts)

src/components/
├── common/ConnectionStatus.vue  ✅  188 lignes
└── (manque: offline/ConflictResolutionModal.vue)

vite.config.ts         ✅  Workbox: 3 stratégies
App.vue                ✅  Intégré + v-if fixé
AppHeader.vue          ❌  Badge manquant
```

---

## 7. Conclusion

**L'architecture est solide et bien pensée**, mais il manque des pièces importantes pour un offline complet :

1. **🟢 Ce qui est prêt :** DB Dexie, file d'attente, sync manager basique, détection connexion, badge UI
2. **🟡 À compléter :** CacheService, apiProxy, offlineStore, draftService
3. **🔴 Critique pour votre besoin :** initialLoad doit charger J-15 → ∞ avec folios + transactions + guests + paiements

Le guide `frontend_offline_behavior_guide.md` dans `docs/` sert de référence complète pour l'implémentation.
