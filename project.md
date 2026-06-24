# EnjoyBackEnd — API de Gestion Hôtelière (PMS)

## 📋 Aperçu

**EnjoyBackEnd** est une API backend complète de **Property Management System (PMS)** pour l'industrie hôtelière. Elle gère l'ensemble des opérations d'un hôtel : réservations, check-in/check-out, facturation (folios), inventaire des chambres, housekeeping, audits de nuit, rapports, intégrations OTA (via Channex.io), communications WhatsApp, et bien plus.

- **Framework :** AdonisJS v6 (TypeScript)
- **Base de données :** PostgreSQL (via Lucid ORM)
- **Authentification :** Token-based (Access Tokens AdonisJS Auth)
- **Déploiement :** Render (render.yaml fourni)
- **Hébergé sur :** GitLab, branche `dev`

---

## 🏗️ Architecture

### Stack Technique

| Couche | Technologie |
|---|---|
| **Framework** | AdonisJS v6 |
| **Langage** | TypeScript ~5.7 |
| **Base de données** | PostgreSQL (via `@adonisjs/lucid`) |
| **ORM** | Lucid ORM (Active Record) |
| **Auth** | AdonisJS Auth (Access Tokens) |
| **Validation** | VineJS (`@vinejs/vine`) |
| **Templating** | Edge (AdonisJS) |
| **PDF** | Puppeteer, html-pdf-node |
| **Email** | Mailjet + SMTP + Nodemailer |
| **WhatsApp** | Meta Cloud API (WhatsApp Business) |
| **Images** | Cloudinary |
| **File upload** | Bodyparser multipart |
| **Logger** | Pino |
| **Tests** | Japa |
| **Cron** | node-cron |
| **Swagger** | adonis-autoswagger |

### Structure du Projet

```
enjoy-api/
├── ace.js                    # Entry point CLI Ace
├── adonisrc.ts               # Configuration AdonisJS
├── package.json              # Dépendances
├── tsconfig.json             # Configuration TypeScript
├── render.yaml               # Déploiement Render
│
├── app/
│   ├── controllers/          # ~80+ Contrôleurs
│   │   ├── Console/          # Contrôleurs du panel admin (souscriptions, modules, etc.)
│   ├── models/               # ~70+ Modèles Lucid
│   ├── services/             # ~60+ Services métier
│   ├── middleware/            # 9 Middlewares (auth, permission, IP, etc.)
│   ├── validators/           # ~40+ Validateurs VineJS
│   ├── exceptions/           # Gestionnaire d'exceptions
│   ├── events/               # Événements (night_audit, checkout)
│   ├── listeners/            # Listeners d'événements
│   ├── hooks/                # Hooks de modèles (reservation, room_type, transaction)
│   ├── types/                # Types TypeScript
│   └── utils/                # Utilitaires (génération de codes, etc.)
│
├── config/                   # Fichiers de configuration
├── commands/                 # Commandes Ace (CRON, maintenance)
├── database/
│   ├── migrations/           # ~200+ migrations
│   └── seeders/              # Seeders (permissions, rôles, etc.)
├── start/
│   ├── routes.ts             # Routes principales
│   ├── routes/pos.ts         # Routes POS (API Key)
│   ├── routes/reports.ts     # Routes rapports
│   ├── kernel.ts             # Middleware stack
│   ├── events.ts             # Registre d'événements
│   ├── scheduler.ts          # Tâches planifiées CRON
│   └── env.ts                # Variables d'environnement
├── resources/
│   └── views/                # Templates Edge / HTML
├── tests/                    # Tests Japa
├── docs/                     # Documentation supplémentaire
└── channex.io/               # Docs intégration Channex
```

---

## 🔐 Authentification & Sécurité

### Guards d'authentification
- **`api`** — Guard principal utilisant les Access Tokens AdonisJS
  - Provider : `tokensUserProvider` basé sur le modèle `User`
  - Durée : 24 heures
  - Préfixe : `ray_`

### Middleware Stack

| Middleware | Rôle |
|---|---|
| `container_bindings_middleware` | Binding du container IoC |
| `force_json_response_middleware` | Force les réponses JSON |
| `cors_middleware` | Gestion CORS |
| `check_maintenance_middleware` | Mode maintenance |
| `auth` | Authentification Bearer Token |
| `ip_restriction` | Restriction par IP (configuration hôtel) |
| `check_subscription` | Vérification abonnement module |
| `permission` | Vérification permissions RBAC |
| `check_permission` | Vérification permissions legacy |
| `api_key` | Auth par clé API (POS) |

### CORS
- Origines autorisées : frontends Vercel (`enjoy-admin-one`, `enjoy-chi`), localhost, `live.enjoy-stay.com`
- Configurable via variable d'env `CORS_ORIGINS`

### Hash
- **Argon2** (Argon2id) — hash des mots de passe
- Fallback : scrypt

---

## 🏨 Modules Fonctionnels

### 1. Gestion des Hôtels (`/api/hotels`, `/configuration/hotels/:hotelId/...`)

Chaque hôtel possède une configuration riche :
- Informations générales (nom, adresse, contact, devise)
- Paramètres de réservation (check-in/out, politique annulation)
- Paramètres d'affichage, d'impression et d'email
- Configurations des taxes (taxes charges chambres, annulation, no-show)
- Statuts et couleurs (statuts chambres, ménage)
- Intégration Channex (property_id, group_id)
- Configuration WhatsApp (provider, credentials)
- Abonnements aux modules (système de souscriptions)

### 2. Gestion des Utilisateurs & Rôles

- **Modèle `User`** — Employés et clients
  - Champs : nom, email, téléphone, rôle, préférences, permissions individuelles
  - Auth : email/password avec Argon2, Access Tokens
  - Email de vérification (via Mailjet)
  - Mot de passe oublié (via token de réinitialisation)
- **RBAC** — Rôles et permissions
  - Assignation des rôles aux utilisateurs
  - Permissions attachées aux rôles (`role_permissions`)
  - SuperAdmin bypass toutes les vérifications
  - Middleware `permission` pour vérifier les permissions par route

### 3. Gestion des Clients / Guests

- **Modèle `Guest`** — Profil complet client
  - Informations personnelles (nom, date naissance, genre, nationalité)
  - Pièces d'identité (CNI, passeport, etc.)
  - Coordonnées, adresse, entreprise
  - Statut VIP, blacklist
  - Statistiques (nombre séjours, total dépensé)
  - Réservations et transactions associées

### 4. Réservations (`/reservation`, `/api/reservations`)

Workflow complet de cycle de vie des réservations :

| Statut | Description |
|---|---|
| `pending` | En attente de confirmation |
| `confirmed` | Confirmée |
| `checked_in` | En cours (client installé) |
| `checked_out` | Terminée |
| `cancelled` | Annulée |
| `no_show` | Non présenté |
| `voided` | Annulée (void) |

Fonctionnalités :
- Création, modification, annulation
- Check-in / Check-out (avec annulation possible - undo)
- Amendement de séjour (modification dates)
- Changement de chambre (room move / exchange)
- Assignation / désassignation de chambre
- Gestion des groupes de réservations
- Impression guest card et fiche police
- Intégration OTA (booking.com, etc.) via `ota_name`, `ota_reservation_code`
- Réservations day-use
- Réservations avec complémentaire (gratuite)

### 5. Gestion des Chambres (`/configuration/hotels/:hotelId/rooms`)

- Statuts : `available`, `booked`, `occupied`, `dirty`, `maintenance`, `out_of_order`, `out_of_service`
- Statuts ménage : clean, dirty, inspected
- Types de chambres, lits, équipements
- Étages, vues, caractéristiques (balcon, fumeur, accessible)
- Types de tarifs et saisons
- Blocs de chambres (room blocks)
- Housekeeping (assignation femme de ménage)

### 6. Facturation — Folios (`/folios`)

Système de folios complet (comptabilité hôtelière) :

**Types de folios :**
- `guest` — Folio client principal
- `master` — Folio maître (groupe/famille)
- `group` — Folio de groupe
- `house` — Compte maison
- `city_ledger` — Compte ville (entreprise)
- `advance_deposit` — Dépôt d'avance
- `company` — Compte entreprise
- `voice_incidental` — Incidents

**Transactions :**
- Types : `charge`, `payment`, `adjustment`, `tax`, `discount`, `refund`, `transfer`, `void`, `room_posting`
- Catégories : room, F&B, téléphone, laundry, minibar, spa, parking, internet, etc.
- Support des taxes et service charges
- Remises (percentage/flat)
- Paiements par méthodes multiples

**Opérations :**
- Posting de transactions
- Split de folio (par type ou par transactions)
- Cut de folio (création nouveau folio)
- Transfert de charges entre folios
- Close / Reopen
- Checkout avec settlement
- Génération de numéros de folio uniques

### 7. Audit de Nuit (`/night-audit`)

Processus automatisé de clôture de journée hôtelière :

**Métriques calculées :**
- Revenus : chambres, F&B, divers, taxes
- Occupation : chambres occupées, taux d'occupation
- KPI : RevPAR, ADR
- Activité : check-ins, check-outs, no-shows, annulations
- Finances : paiements reçus, comptes clients

**Processus :**
1. Mise à jour statuts chambres (occupied → dirty)
2. Mise à jour `currentWorkingDate` et `lastNightAuditDate`
3. Calcul des métriques
4. Génération des rapports (management, night audit, revenue, room status)
5. Récupération données POS externes
6. Envoi email récapitulatif quotidien
7. Stockage dans `daily_summary_facts`

**Planification :** Via événements et jobs asynchrones (tâche `NightAuditRequested` → listener `ProcessNightAudit`)

### 8. Rapports & Analyses (`/api/reports`)

Génération de rapports avec export PDF/CSV :

**Types de rapports :**
- Réservations : arrivées, départs, annulés, no-show, prévisions
- Front Office : statuts chambres, disponibilités, guests in-house
- Back Office : revenus, dépenses, caissier
- Statistiques : occupation, ADR, RevPAR, segments marché
- Rapports mensuels : revenus par type de tarif, par type de chambre, par pays
- Rapports quotidiens : résumé opérations, revenus, paiements
- City Ledger, Credit Ledger
- Work Orders
- Rapports personnalisés

### 9. Intégration Channex.io (`/channex`)

Intégration complète avec le channel manager Channex.io :

- **Propriétés** : CRUD complet des propriétés
- **Types de chambres** : Synchronisation
- **Plans tarifaires** : Gestion des rate plans
- **Disponibilités** : Mise à jour en temps réel (hooks)
- **Réservations** : Import/export via booking revisions
- **Restrictions** : min_stay, closed_to_arrival, stop_sell, etc.
- **Webhooks** : Configuration des notifications
- **Iframe** : URL d'authentification pour le portail Channex
- **Taxes/Tax Sets** : Synchronisation

Les **hooks de modèles** notifient automatiquement Channex lors de changements :
- `reservation_hooks.ts` — notification création/modification réservation
- `room_type_hooks.ts` — notification création/modification/suppression type chambre

### 10. Communications WhatsApp

Intégration WhatsApp Business API (Meta Cloud API) :

**Templates disponibles :**
- `htl_booking_confirms` — Confirmation de réservation
- `htl_checkin_remind` — Rappel check-in
- `feedback_surveys` — Enquête satisfaction
- `checkin_welcome` — Message de bienvenue (avec clé numérique)
- `htl_special_offer` — Offre spéciale
- `expense_alerts` — Alerte dépense
- `htl_payment_received` — Paiement reçu
- `htl_stay_amendment` — Modification séjour
- `invoice_ready` / `voucher_ready` — Documents prêts
- `feedback_positive_reply` / `feedback_negative_reply` — Réponses feedback

**Configuration :**
- Provider : `platform` (géré centralement) ou propre compte hôtel
- Logs de toutes les tentatives d'envoi (`whatsapp_logs`)
- Planification des messages différés (`whatsapp_scheduled_messages`)

### 11. POS Intégration (`/pos`)

API sécurisée par clé API (api_key_middleware) :
- Récupération infos hôtel
- Liste réservations in-house
- Posting de transactions chambre

### 12. Portail Console (Admin)

Gestion administrative de la plateforme Enjoy :
- **Souscriptions** — Abonnements aux modules (PMS, channel manager, etc.)
- **Modules** — Définition des modules (PMS, CHANNEX, etc.) avec slugs
- **Factures** — Facturation des abonnements
- **Add-ons** — Options supplémentaires
- **Annonces** — Communications internes
- **Demandes de démo** — Gestion des leads
- **Utilisateurs Console** — Gestion des admins

### 13. Notifications & Événements

Système de notifications multi-canaux :
- **Templates** : Modèles de notification paramétrables
- **Canaux** : In-app, email, SMS, push
- **SSE** (Server-Sent Events) : Notifications temps réel via `/api/notifications/stream`
- **Audit trail** : Journalisation de toutes les actions

---

## 📡 API Routes

L'API expose des routes organisées sous les préfixes suivants :

| Préfixe | Description |
|---|---|
| `/api/auth*` | Authentification |
| `/api/hotels` | Hôtels (création initiale) |
| `/configuration/hotels/:hotelId/*` | Toute la configuration d'un hôtel |
| `/folios` | Facturation |
| `/folio-print` | Impression folios |
| `/folio-transactions` | Transactions |
| `/guests` | Clients |
| `/reservation` | Réservations |
| `/reservation-rooms` | Chambres réservées |
| `/hotels/:id/reservation/*` | Recherche réservations par hôtel |
| `/lost-found` | Objets trouvés |
| `/night-audit` | Audit de nuit |
| `/room-blocks` | Blocs de chambres |
| `/dashboard` | Tableaux de bord |
| `/api/reports/*` | Rapports |
| `/pos/*` | POS (clé API) |
| `/channex/*` | Intégration Channex |
| `/support/tickets` | Tickets de support |
| `/notifications` | Notifications (SSE) |
| `/whatsapp/*` | WhatsApp |
| `/company_accounts/*` | Comptes entreprises |
| `/city_ledger` | City ledger |
| `/incidental_invoices` | Factures incidentelles |
| `/transportation-requests` | Demandes de transport |
| `/cancellation-policies` | Politiques d'annulation |
| `/cron/subscriptions/renew` | CRON renouvellement abonnements |

### Routes Non-Authentifiées
- `GET /` — Page d'accueil Swagger
- `GET /swagger` — Documentation Swagger UI
- `POST /api/auth*` — Login, forgot/reset password
- `GET /documents/:type/:token` — Accès aux documents sécurisés par token
- `GET /reset-password` — Page HTML reset password
- `GET /ping` — Health check

---

## 🗄️ Base de Données

### Tables Principales

**Modules :**
- `modules` — Modules disponibles (pms, channex, etc.)
- `subscriptions` — Abonnements hôtel → module
- `invoices` — Factures
- `invoice_subscriptions` — Factures d'abonnement

**Hôtel :**
- `hotels` — Hôtels (60+ colonnes de configuration)
- `service_user_assignments` — Assignation utilisateurs aux hôtels

**Utilisateurs & Rôles :**
- `users` — Utilisateurs (staff + guests)
- `roles` — Rôles
- `permissions` — Permissions
- `role_permissions` — Liaison rôles-permissions
- `auth_access_tokens` — Tokens d'authentification

**Clients :**
- `guests` — Profils clients
- `reservation_guests` — Liaison réservation-clients

**Réservations :**
- `reservations` — Réservations (70+ colonnes)
- `reservation_rooms` — Chambres dans les réservations
- `reservation_groups` — Groupes de réservations

**Chambres :**
- `rooms` — Chambres
- `room_types` — Types de chambres
- `bed_types` — Types de lits
- `room_blocks` — Blocs de chambres
- `room_owners` — Propriétaires de chambres
- `room_tax_rates` — Taxe par chambre

**Tarification :**
- `rate_plans` / `rate_types` — Plans tarifaires
- `room_rates` — Prix par chambre
- `seasons` — Saisons
- `discounts` — Remises
- `meal_plans` — Formules repas
- `tax_rates` — Taux de taxe

**Facturation :**
- `folios` — Folios (80+ colonnes)
- `folio_transactions` — Transactions (50+ colonnes)
- `folio_transaction_taxes` — Taxes par transaction
- `receipts` — Reçus

**Finances :**
- `daily_summary_facts` — Résumé quotidien (audit de nuit)
- `city_ledger` — Comptes ville
- `credit_ledger_logs` — Logs crédit ledger
- `company_accounts` — Comptes entreprises

**Communication :**
- `email_accounts` — Comptes email
- `email_templates` — Templates email
- `whatsapp_logs` — Logs WhatsApp
- `whatsapp_scheduled_messages` — Messages WhatsApp planifiés
- `notifications` / `notification_templates` — Notifications

**Maintenance :**
- `support_tickets` — Tickets de support
- `ticket_comments` — Commentaires
- `work_orders` — Ordres de travail
- `house_keepers` — Femmes de ménage
- `lost_and_found_items` / `lost_found` — Objets trouvés

### Migrations
~200 migrations gérant l'évolution du schéma (AdonisJS Lucid migrations avec naturalSort activé).

---

## 🔧 Commandes CLI (Ace)

Commandes personnalisées disponibles :

| Commande | Description |
|---|---|
| `auto:release-rooms` | Libération automatique des chambres (CRON quotidien) |
| `subscriptions:renew` | Renouvellement automatique des abonnements (mensuel) |
| `auto:send-feedback-surveys` | Envoi enquêtes satisfaction programmées (toutes les minutes) |
| `run:night-audit-interval` | Exécution audit de nuit |
| `send:daily-email` | Envoi email quotidien |
| `send:daily-summary` | Envoi résumé quotidien |
| `send:scheduled-feedback-surveys` | Envoi enquêtes programmées |
| `sync:folio-transaction-working-date` | Sync dates de travail |
| `import:*` | Import de données (guests, hotels, currencies, etc.) |
| `upload:images` | Upload d'images |
| `fix:*` / `debug:*` | Outils de correction/debug |

---

## 📧 Emailing

- **Provider** : Mailjet (API + SMTP)
- **Config** : Mailjet API Key/Secret, templates de vérification
- **Fonctionnalités** :
  - Email de vérification de compte
  - Email de bienvenue
  - Factures et vouchers par email
  - Rapports quotidiens
  - Templates email personnalisables par hôtel

---

## ⏰ Tâches Planifiées (CRON)

| Fréquence | Tâche | Description |
|---|---|---|
| Quotidien (00:00) | `auto:release-rooms` | Libération automatique des chambres |
| Mensuel (1er à 00:01) | `subscriptions:renew` | Renouvellement abonnements |
| Toutes les minutes | `auto:send-feedback-surveys` | Envoi enquêtes satisfaction |
| Toutes les minutes (scheduler) | Feedback survey cron | Vérification et envoi messages WhatsApp programmés |

---

## 🌐 Intégrations Externes

| Service | Utilisation |
|---|---|
| **Channex.io** | Channel manager (OTA distribution) |
| **Meta WhatsApp Cloud API** | Communication clients |
| **Mailjet** | Emails transactionnels |
| **Cloudinary** | Stockage et gestion d'images |
| **Supabase** | Base de données PostgreSQL (hébergement) |
| **Render** | Hébergement et déploiement |

---

## 🔄 Événements & Hooks

### Événements système
- `NightAuditRequested` — Déclenché lorsqu'un audit de nuit est demandé
- `ReservationCheckedOut` — Déclenché lorsqu'une réservation est checkoutée

### Hooks de modèles
- `reservation_hooks.ts` — Notifie Channex des changements de disponibilité
- `room_type_hooks.ts` — Notifie Channex des changements de types de chambre
- `transaction_hooks.ts` — Met à jour le statut du folio après transaction
- `Room.afterUpdate` — Notifie le Front Office et Housekeeping des changements de statut

---

## 🧪 Tests

- **Framework** : Japa (AdonisJS plugin)
- **Suites** :
  - `unit` — Tests unitaires (`tests/unit/`)
  - `functional` — Tests fonctionnels (`tests/functional/`)
- **Commandes** :
  - `node ace test` — Exécuter tous les tests
  - Tests existants : auth, identity_types, company_accounts

---

## 🚀 Déploiement

Déploiement via Render (render.yaml) :

```yaml
type: web
runtime: node
buildCommand: npm install && npm run build
startCommand: node build/server.js
```

**Prérequis :**
- PostgreSQL (Supabase)
- Variables d'environnement configurées (DB, Auth, Mailjet, WhatsApp, Channex, etc.)

---

## 📚 Documentation Additionnelle

Des documents supplémentaires se trouvent dans le dossier `docs/` :
- Audit trail service
- Intégration et migration Channex
- API POS
- Comptes entreprises
- Création de folios
- Rapports PMS
- Templates de reçus, factures, vouchers

---

## 🔒 Sécurité & Contrôle d'Accès

- **RBAC** complet avec rôles/permissions
- **SuperAdmin** bypass
- **Restriction IP** par hôtel (IP configuration avec patterns wildcard `*`)
- **Vérification d'abonnement** middleware pour contrôle d'accès aux modules
- **Clé API** pour intégrations POS
- **Validation** des entrées via VineJS
- **Hash** Argon2id pour les mots de passe
- **CORS** configuré avec liste blanche d'origines
- **Token-based** auth avec expiration 24h
- **Vérification email** obligatoire
