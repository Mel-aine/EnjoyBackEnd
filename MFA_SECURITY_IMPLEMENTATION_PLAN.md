# 🔐 Plan d'Implémentation — MFA et Sécurité des Comptes

**Projet** : EnjoyBackEnd (AdonisJS v6 — PMS Hôtelier)
**Date** : 17 août 2026
**Auteur** : Analyse technique
**Statut** : Document de spécification — À implémenter

---

## 📑 Table des matières

1. [📊 Audit — État actuel de la sécurité](#1--audit--état-actuel-de-la-sécurité)
2. [⚠️ Failles identifiées](#2-️-failles-identifiées)
3. [📦 Dépendances à installer](#3--dépendances-à-installer)
4. [Étape 1 — Migrations de base de données](#étape-1--migrations-de-base-de-données)
5. [Étape 2 — Service : `LoginSecurityService`](#étape-2--service--loginsecurityservice)
6. [Étape 3 — Service : `TwoFactorAuthService`](#étape-3--service--twofactorauthservice)
7. [Étape 4 — Middlewares de rate limiting](#étape-4--middlewares-de-rate-limiting)
8. [Étape 5 — Refacto du flux d'authentification](#étape-5--refacto-du-flux-dauthentification)
9. [Étape 6 — Endpoints de gestion du MFA](#étape-6--endpoints-de-gestion-du-mfa)
10. [Étape 7 — Modèles Lucid & relations](#étape-7--modèles-lucid--relations)
11. [🔐 Spécifications de sécurité détaillées](#-spécifications-de-sécurité-détaillées)
12. [🛣️ Routes à ajouter](#️-routes-à-ajouter)
13. [🧪 Tests critiques à écrire](#-tests-critiques-à-écrire)
14. [🎯 Ordre d'implémentation recommandé](#-ordre-dimplémentation-recommandé)
15. [📊 Monitoring & logs d'audit](#-monitoring--logs-daudit)
16. [🔗 Références fichiers existants](#-références-fichiers-existants)

---

## 1. 📊 Audit — État actuel de la sécurité

### Stack technique
| Couche | Technologie | Version |
|---|---|---|
| Framework | **AdonisJS** | v6.19 |
| ORM | **Lucid** | v21.6 |
| Auth | `@adonisjs/auth` | v9.3 (Access Tokens + Argon2) |
| Mail | `@adonisjs/mail` | v9.2 (SMTP + Mailjet) |
| Validation | `@vinejs/vine` | v3.0 |
| Base de données | PostgreSQL | — |

### Composants auth déjà en place

| Composant | Fichier | État |
|---|---|---|
| Config auth (tokens guard) | `config/auth.ts` | ✅ Fonctionnel |
| Modèle User | `app/models/user.ts` | ⚠️ Champ `two_factor_enabled` existe **mais inutilisé** |
| Endpoints login (×3) | `app/controllers/auth_controller.ts` | ⚠️ `login()` L177, `signin()` L235, `signinConsole()` L873 — duplication de logique |
| Refresh tokens (×2) | `auth_controller.ts` | ✅ Rotation + cookie httpOnly |
| Email verification | `auth_controller.ts` + `app/services/user_email_service.ts` | ✅ Fonctionnel |
| Password reset | `auth_controller.ts` + `app/models/password_reset_token.ts` | ✅ Fonctionnel |
| Service emails | `app/services/mail_service.ts` | ✅ SMTP + Mailjet + pièces jointes |
| Middleware IP restriction | `app/middleware/ip_restriction_middleware.ts` | ⚠️ Existe — pas de rate limiting |
| LoggerService d'audit | `app/services/logger_service.ts` | ✅ LOGIN / LOGOUT déjà loggés |
| Routes login (protégées IP) | `start/routes.ts` L310-L312 | ✅ `.use(middleware.ipRestriction())` |

---

## 2. ⚠️ Failles identifiées

| # | Risque | Sévérité | Description |
|---|---|---|---|
| F1 | **Brute-force non protégé** | 🔴 CRITIQUE | Aucun compteur d'échecs sur `signin`, `signinConsole`, `login`, `validatePassword`, `forgotPassword` |
| F2 | **Pas de MFA** | 🔴 CRITIQUE | Champ `two_factor_enabled` présent en base mais aucun flux associé |
| F3 | **User enumeration** | 🟠 HAUT | Réponse différente entre email inexistant vs mauvais mot de passe |
| F4 | **Hash calculé inutilement** | 🟡 MOYEN | Mot de passe vérifié via `Hash.verify()` **avant** de savoir si le compte est bloqué → gaspillage CPU (attaque DoS) |
| F5 | **Logique login dispersée** | 🟡 MOYEN | 3 méthodes de login dupliquées → risque d'oubli lors d'un patch |
| F6 | **Pas de 2e facteur email** | 🟠 HAUT | Infrastructure mail dispo mais pas utilisée comme 2FA |
| F7 | **Pas de codes de récupération** | 🟡 MOYEN | Si MFA activé et téléphone perdu → impossible de se connecter |

---

## 3. 📦 Dépendances à installer

```bash
cd e:\Documenti\dev\EnjoyBackEnd
npm install otplib qrcode
npm install -D @types/qrcode
```

| Package | Usage |
|---|---|
| `otplib` | Implémentation RFC 4226 (HOTP) & RFC 6238 (TOTP) — Google Authenticator / Authy / 1Password / Microsoft Authenticator |
| `qrcode` | Génération du QR code pour l'appairage de l'app authenticator (affiché en base64 data URI) |

> 💡 **SMS (optionnel/future)** : Nécessitera `twilio` ou `@plivo/plivo-node` → non inclus dans cette phase.

---

## Étape 1 — Migrations de base de données

### 1.1 Table `login_attempts`
Suivi des tentatives réussies et échouées.

```sql
CREATE TABLE login_attempts (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT REFERENCES users(id) ON DELETE SET NULL,
  email           VARCHAR(255) NOT NULL,
  ip_address      VARCHAR(45) NOT NULL,           -- IPv6 max 45 chars
  user_agent      TEXT,
  success         BOOLEAN NOT NULL DEFAULT FALSE,
  failure_reason  VARCHAR(50),                    -- WRONG_PASSWORD / ACCOUNT_LOCKED / MFA_FAILED / EMAIL_NOT_VERIFIED / RATE_LIMIT
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_login_attempts_email_ip_created ON login_attempts (email, ip_address, created_at DESC);
CREATE INDEX idx_login_attempts_user_id         ON login_attempts (user_id, created_at DESC);
CREATE INDEX idx_login_attempts_created         ON login_attempts (created_at DESC);
```

### 1.2 Table `mfa_methods`
Méthodes 2FA activées par utilisateur (TOTP / Email / SMS futur).

```sql
CREATE TABLE mfa_methods (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method_type     VARCHAR(10) NOT NULL,            -- TOTP | EMAIL | SMS
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,
  totp_secret     TEXT,                            -- chiffré avec APP_KEY (nullable: non TOTP)
  phone_number    VARCHAR(20),
  label           VARCHAR(100),                    -- ex: "iPhone de Paul"
  is_verified     BOOLEAN NOT NULL DEFAULT FALSE, -- la méthode a été validée par l'utilisateur
  last_used_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_method_type CHECK (method_type IN ('TOTP', 'EMAIL', 'SMS')),
  CONSTRAINT uq_user_method_type UNIQUE (user_id, method_type)
);

CREATE INDEX idx_mfa_methods_user ON mfa_methods (user_id);
```

### 1.3 Table `mfa_challenges`
Codes OTP en attente de validation (EMAIL / SMS).

```sql
CREATE TABLE mfa_challenges (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_id    VARCHAR(32) NOT NULL UNIQUE,     -- token public (cuid)
  method_type     VARCHAR(10) NOT NULL,            -- EMAIL | SMS
  hashed_code     VARCHAR(255) NOT NULL,           -- Argon2 du code 6 chiffres
  delivered_to    VARCHAR(255) NOT NULL,           -- email ou phone
  attempts        SMALLINT NOT NULL DEFAULT 0,
  is_consumed     BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_challenge_method CHECK (method_type IN ('EMAIL', 'SMS'))
);

CREATE INDEX idx_mfa_challenges_user     ON mfa_challenges (user_id, created_at DESC);
CREATE INDEX idx_mfa_challenges_cid      ON mfa_challenges (challenge_id);
CREATE INDEX idx_mfa_challenges_expire   ON mfa_challenges (expires_at);
```

### 1.4 Table `mfa_recovery_codes`
Codes de récupération à usage unique.

```sql
CREATE TABLE mfa_recovery_codes (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hashed_code     VARCHAR(255) NOT NULL,           -- Argon2
  code_hint       VARCHAR(8) NOT NULL,             -- 4 derniers chars (ex: "****ABCD")
  used_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mfa_recovery_user ON mfa_recovery_codes (user_id);
```

### 1.5 Colonnes supplémentaires sur `users`

```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS login_attempts_count   INTEGER      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_failed_login_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_until           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lock_reason            VARCHAR(255),
  ADD COLUMN IF NOT EXISTS last_login_ip          VARCHAR(45),
  ADD COLUMN IF NOT EXISTS last_login_user_agent  TEXT;

-- Index pour nettoyage périodique des verrous expirés
CREATE INDEX IF NOT EXISTS idx_users_locked_until ON users (locked_until) WHERE locked_until IS NOT NULL;
```

> 💡 **Migration AdonisJS** : Créer les 5 fichiers `YYYYMMDD_<timestamp>_create_*.ts` dans `database/migrations/`.

---

## Étape 2 — Service : `LoginSecurityService`

**Fichier à créer** : `app/services/login_security_service.ts`

Service centralisé — **tous** les endpoints de login **doivent** passer par lui.

### Constantes (configurables)
```typescript
export const LOCKOUT_CONFIG = {
  WINDOW_MINUTES: 15,          // fenêtre glissante de surveillance
  MAX_ATTEMPTS: 5,             // seuil de blocage
  FIRST_LOCK_MINUTES: 15,      // 1er blocage : 15 min
  SECOND_LOCK_MINUTES: 60,     // 2e blocage : 1 h
  THIRD_LOCK_HOURS: 24,        // 3e+ blocage : 24 h + flag admin
  RATE_LIMIT_PER_IP_PER_MIN: 20,// scraping général
} as const
```

### API du service

| Méthode | Signature | Rôle |
|---|---|---|
| `recordAttempt` | `(email, ip, success, reason?, userAgent?, userId?) → Promise<void>` | Insère dans `login_attempts` et met à jour le compteur user |
| `isAccountLocked` | `(user) → Promise<{ locked: boolean, remainingMs: number, reason?: string }>` | Vérifie `locked_until > now()` |
| `checkRateLimit` | `(email, ip) → Promise<{ ok: boolean, retryAfterSec?: number }>` | Compte les échecs dans la fenêtre WINDOW_MINUTES sur le triplet (email, ip, success=false) |
| `lockAccount` | `(user, minutes, reason) → Promise<void>` | Écrit `locked_until`, `lock_reason`, log `ACCOUNT_LOCKED` |
| `incrementFailed` | `(userOrEmail, ip, reason) → Promise<{ locked: boolean, attempts: number }>` | +1 compteur → si `>= MAX_ATTEMPTS` → `lockAccount()` avec durée adaptative |
| `resetFailedAttempts` | `(user, ip, userAgent?) → Promise<void>` | Reset compteur + met à jour `last_login_ip`, `last_login_user_agent`, `lastLogin` |
| `checkScrapingRate` | `(ip) → { ok: boolean, retryAfterSec?: number }` | 20 req/min par IP |

---

## Étape 3 — Service : `TwoFactorAuthService`

**Fichier à créer** : `app/services/two_factor_auth_service.ts`

### API du service

| Méthode | Signature | Rôle |
|---|---|---|
| `isMfaEnabled` | `(user) → Promise<boolean>` | Compte-t-il au moins 1 `mfa_method` avec `is_verified=true` ? |
| `getAvailableMethods` | `(user) → Promise<MfaMethod[]>` | Liste les méthodes vérifiées (pour choisir celle à utiliser au login) |
| `getDefaultMethod` | `(user) → Promise<MfaMethod \| null>` | Celle avec `is_default=true` |
| `generateTotpSetup` | `(user) → Promise<{ secret: string, otpauthUrl: string, qrCodeB64: string }>` | Génère secret + URL + QR en data URI (pas encore sauvegardé) |
| `confirmTotp` | `(user, code, label?) → Promise<MfaMethod>` | Vérifie code → crée `mfa_methods` TOTP vérifié → génère aussi les recovery codes |
| `verifyTotp` | `(user, code) → Promise<boolean>` | Valide code TOTP avec tolérance ±1 pas (±30s) |
| `enableEmailMethod` | `(user) → Promise<MfaMethod>` | Active méthode EMAIL (auto-vérifiée car email déjà vérifié) |
| `generateEmailChallenge` | `(user) → Promise<{ challengeId: string, code: string, expiresAt: DateTime }>` | Génère code 6 chiffres, le sauvegarde haché, envoie l'email (retourne code en clair pour logger debug — pas envoyé au client) |
| `verifyChallenge` | `(challengeId, code) → Promise<{ valid: boolean, userId?: number, failReason?: string }>` | Vérifie code → incrémente `attempts` → invalide après 3 essais |
| `disableMethod` | `(user, methodId) → Promise<void>` | Supprime une méthode MFA |
| `setDefaultMethod` | `(user, methodId) → Promise<void>` | Passe `is_default=true` sur la méthode cible, `false` sur les autres |
| `generateRecoveryCodes` | `(user) → Promise<string[]>` | Génère 8 codes de 8 chars → sauvegarde hachés → retourne les codes EN CLAIR (une seule fois) |
| `useRecoveryCode` | `(user, code) → Promise<boolean>` | Vérifie Argon2 → marque `used_at = now()` si OK |
| `getRecoveryHints` | `(user) → Promise<{ codeHint: string, usedAt: DateTime | null }[]>` | Retourne masques `****ABCD` (jamais le code en clair) |

### Sécurité interne
- **TOTP secret chiffré** : Utiliser `import encryption from '@adonisjs/core/services/encryption'` → `encryption.encrypt(secret)` avant insert, `encryption.decrypt()` avant verify.
- **Tous les codes (email challenge + recovery) hachés** : `Hash.make(code)` via Argon2 — **jamais stockés en clair**.
- **Constant-time comparison** : Utiliser `crypto.timingSafeEqual` pour les vérifications non prises en charge par Argon2.
- **Expiration auto** : Cron tous les jours pour `DELETE FROM mfa_challenges WHERE expires_at < NOW() - INTERVAL '1 week'`.

---

## Étape 4 — Middlewares de rate limiting

### 4.1 `login_rate_limit_middleware.ts`

**Appliqué sur** :
- `POST /api/auth` (`login`)
- `POST /api/authLogin` (`signin`)
- `POST /api/authLoginConsole` (`signinConsole`)
- `POST /api/validatePassword`
- `POST /api/validateEmail`
- `POST /api/auth/forgot-password`
- `POST /api/auth/forgot-password-console`

**Logique (dans cet ordre)** :
1. **Scraping général** : 20 req/min / IP → 429 `Retry-After`
2. **Rate limit métier** : Appel `LoginSecurityService.checkRateLimit(email, ip)` → si KO → 429 avec `retry_after_seconds`
3. Si IP sur liste noire (config future) → 403 immédiat

**Réponse 429** :
```json
{
  "status": "error",
  "message": "Too many attempts. Please try again later.",
  "error": "TOO_MANY_ATTEMPTS",
  "retry_after_seconds": 900
}
```

### 4.2 `mfa_rate_limit_middleware.ts`

**Appliqué sur** :
- `POST /api/mfa/verify`
- `POST /api/mfa/email/send`
- `POST /api/mfa/recovery/use`

**Règles** :
| Endpoint | Limite |
|---|---|
| `mfa/email/send` | 3 envois / 10 min / user + 1 envoi minimum toutes les 60 sec |
| `mfa/verify` | 5 tentatives / 5 min / challenge_id |
| `mfa/recovery/use` | 5 tentatives / 15 min / user |

---

## Étape 5 — Refacto du flux d'authentification

### Problème actuel
3 méthodes (`login`, `signin`, `signinConsole`) qui font ~80% la même chose → **risque d'oubli** lors du patch MFA.

### Solution
Créer une **méthode privée unique** `_baseLogin(ctx, options)` dans `AuthController` appelée par les 3 endpoints.

```typescript
type BaseLoginOptions = {
  consoleMode?: boolean              // → user without serviceAssignments
  requirePmsContext?: boolean        // → charge hotels, subscription, primaryHotel
}

private async _baseLogin(
  { request, response }: HttpContext,
  options: BaseLoginOptions = {}
): Promise<any>
```

### Nouveau flux en 3 étapes (authentication → MFA challenge → MFA verify)

```
┌─────────────────────────────────────────────────────────────┐
│  ÉTAPE 1 : POST /auth/signin  { email, password }           │
├─────────────────────────────────────────────────────────────┤
│  1. LoginSecurityService.checkRateLimit(email, ip)          │
│      → 429 si trop de requêtes                               │
│                                                              │
│  2. Fetch User par email                                     │
│                                                              │
│  3. LoginSecurityService.isAccountLocked(user)               │
│      → 423 Locked { locked_until, retry_after_seconds }     │
│        (⚠️ PAS de Hash.verify avant ce check !)              │
│                                                              │
│  4. Check emailVerified ?                                    │
│      → 403 { EMAIL_NOT_VERIFIED }                            │
│                                                              │
│  5. Hash.verify(user.password, password)                     │
│                                                              │
│  6. ÉCHEC → LoginSecurityService.incrementFailed()           │
│              → réponse 401 IDENTIQUE (email invalide /      │
│                mdp invalide) → PAS DE USER ENUMERATION      │
│                                                              │
│  7. RÉUSSIE → TwoFactorAuthService.isMfaEnabled(user)       │
│      ├─ CAS A: MFA OFF                                       │
│      │     → resetFailedAttempts()                           │
│      │     → émet access_token + refresh_token               │
│      │     → LoggerService.log('LOGIN')                      │
│      │     → return 200 OK                                   │
│      │                                                        │
│      └─ CAS B: MFA ON                                        │
│            → Génère mfa_challenge entry (placeholder)       │
│            → return 202 Accepted {                           │
│                 "mfa_required": true,                        │
│                 "mfa_challenge_id": "chal_xxx",              │
│                 "available_methods": [                       │
│                   { id: 5, type: "TOTP",  is_default: true },│
│                   { id: 7, type: "EMAIL", is_default: false }│
│                 ]                                            │
│               }                                              │
│               (⚠️ AUCUN token émis à ce stade)               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ÉTAPE 2 (EMAIL seulement) :                                 │
│           POST /auth/mfa/email/send  { mfa_challenge_id }   │
├─────────────────────────────────────────────────────────────┤
│  1. Retrouve challenge + user associé                       │
│  2. Rate limit: 1 code / 60s + 3 / 10min                    │
│  3. TwoFactorAuthService.generateEmailChallenge(user)       │
│     → envoi email via MailService                            │
│  4. return 200 OK { "expires_in_seconds": 300 }             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ÉTAPE 3 : POST /auth/mfa/verify                             │
│           { mfa_challenge_id, code, method_id? }            │
├─────────────────────────────────────────────────────────────┤
│  1. method_id = method_id ?? default_method_id              │
│                                                              │
│  2. Switch method.type :                                     │
│     • TOTP  → TwoFactorAuthService.verifyTotp(user, code)   │
│     • EMAIL → TwoFactorAuthService.verifyChallenge(...)     │
│                                                              │
│  3. ÉCHEC → incrémente attempts du challenge                │
│           → 401 { "MFA_INVALID", attempts_left }            │
│           → si attempts >= 3 → challenge révoqué            │
│                                                              │
│  4. RÉUSSIE → resetFailedAttempts()                         │
│              → is_consumed = true (EMAIL)                   │
│              → émet access_token + refresh_token DEFINITIFS │
│              → LoggerService.log('LOGIN', 'via TOTP/EMAIL') │
│              → return 200 OK                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Étape 6 — Endpoints de gestion du MFA

**Tous protégés par** `middleware.auth({ guards: ['api'] })`

| Méthode | Route | Controller | Rôle |
|---|---|---|---|
| `GET` | `/api/mfa/methods` | `MfaController.listMethods` | Retourne méthodes actives + statut |
| `POST` | `/api/mfa/totp/setup` | `MfaController.setupTotp` | Génère secret, otpauthUrl, qrCodeB64 (pas encore enregistré) |
| `POST` | `/api/mfa/totp/confirm` | `MfaController.confirmTotp` | `{ code, label? }` → valide le setup → enregistre la méthode → retourne recovery codes en clair (1 seule fois) |
| `POST` | `/api/mfa/email/enable` | `MfaController.enableEmail` | Active méthode EMAIL (envoie code test que l'utilisateur doit confirmer) |
| `DELETE` | `/api/mfa/methods/:id` | `MfaController.disableMethod` | Révoque une méthode (**requiert mot de passe en body** pour sécurité) |
| `PATCH` | `/api/mfa/methods/:id/default` | `MfaController.setDefault` | Définit comme méthode par défaut |
| `GET` | `/api/mfa/recovery-codes` | `MfaController.getRecoveryCodes` | Retourne masques `****ABCD` + usage status (jamais les codes en clair) |
| `POST` | `/api/mfa/recovery-codes/regenerate` | `MfaController.regenerateRecoveryCodes` | Invalide anciens + en génère de nouveaux (retournés 1× en clair — **mot de passe requis**) |

### Contrat réponse `GET /api/mfa/methods`
```json
{
  "mfa_enabled_overall": true,
  "methods": [
    {
      "id": 5,
      "type": "TOTP",
      "label": "Google Authenticator iPhone",
      "is_default": true,
      "is_verified": true,
      "last_used_at": "2026-08-16T14:22:01Z"
    },
    {
      "id": 7,
      "type": "EMAIL",
      "label": "paul@hotel.com",
      "is_default": false,
      "is_verified": true,
      "last_used_at": null
    }
  ]
}
```

---

## Étape 7 — Modèles Lucid & relations

**Fichier à modifier** : `app/models/user.ts`

Ajouter les colonnes manquantes + les relations :

```typescript
// ===== Colonnes (à compléter dans le modèle) =====
@column({ columnName: 'login_attempts_count' })
declare loginAttemptsCount: number

@column.dateTime({ columnName: 'last_failed_login_at' })
declare lastFailedLoginAt: DateTime | null

@column.dateTime({ columnName: 'locked_until' })
declare lockedUntil: DateTime | null

@column({ columnName: 'lock_reason' })
declare lockReason: string | null

@column({ columnName: 'last_login_ip' })
declare lastLoginIp: string | null

@column({ columnName: 'last_login_user_agent' })
declare lastLoginUserAgent: string | null

// ===== Relations =====
@hasMany(() => LoginAttempt, { foreignKey: 'userId' })
declare loginAttempts: HasMany<typeof LoginAttempt>

@hasMany(() => MfaMethod, { foreignKey: 'userId' })
declare mfaMethods: HasMany<typeof MfaMethod>

@hasMany(() => MfaChallenge, { foreignKey: 'userId' })
declare mfaChallenges: HasMany<typeof MfaChallenge>

@hasMany(() => MfaRecoveryCode, { foreignKey: 'userId' })
declare mfaRecoveryCodes: HasMany<typeof MfaRecoveryCode>
```

**Nouveaux modèles à créer** :
- `app/models/login_attempt.ts`
- `app/models/mfa_method.ts`
- `app/models/mfa_challenge.ts`
- `app/models/mfa_recovery_code.ts`
- `app/controllers/mfa_controller.ts`

---

## 🔐 Spécifications de sécurité détaillées

### A — Verrouillage de compte (Login rate limiting)

| Nombre d'échecs (fenêtre 15 min) | Action |
|---|---|
| 1 — 4 | Réponse `401 Invalid credentials` (**message identique** pour email inexistant OU mot de passe faux) |
| 5 | **Compte verrouillé 15 min** → HTTP `423 Locked` + `{ locked_until: ISO, retry_after_seconds: 900, error: "ACCOUNT_LOCKED" }` |
| 2e blocage dans < 1h | Durée **1 heure** |
| 3e+ blocage dans < 24h | Durée **24 h** + log spécial `ACCOUNT_SUSPICIOUS_ACTIVITY` pour alerte admin |
| Email inexistant | Incrémente le compteur **sur IP seulement** (pas de user_id) → évite de polluer les stats d'un vrai user |
| Compte déjà verrouillé | Retour `423` **immédiat**, **SANS** exécuter `Hash.verify()` (économise CPU en cas d'attaque DoS sur un compte bloqué) |

### B — MFA par Email

| Caractéristique | Valeur |
|---|---|
| Format code | 6 chiffres aléatoires (`crypto.randomInt(100_000, 999_999)`) |
| Durée de validité | **5 minutes** (`expires_at = now + 5min`) |
| Tentatives par challenge | **3 max** → la 4e invalide le challenge |
| Min intervalle envoi | 60 secondes |
| Max envois | 3 codes / 10 minutes / utilisateur |
| Stockage | **Jamais en clair** → Argon2 dans `mfa_challenges.hashed_code` |
| Comparaison | Via `Hash.verify()` (constant time inclus) |
| Consommation | Passage `is_consumed = true` après 1ère utilisation valide |

### C — MFA TOTP (Google Authenticator / Authy / 1Password / Microsoft)

| Caractéristique | Valeur |
|---|---|
| Standard | RFC 6238 (TOTP) via `otplib.authenticator` |
| Algorithme | SHA-1 (standard compatible toutes apps) |
| Période | 30 secondes |
| Chiffres | 6 |
| Tolérance | **±1 pas** (±30s) pour décalages horaires → `window: 1` dans otplib |
| Longueur secret | 20 octets (160 bits) → encodé Base32 |
| Stockage secret | **Chiffré** avec `encryption.encrypt()` via `APP_KEY` avant INSERT |
| L'otpauth URL format | `otpauth://totp/Enjoy:{email}?secret=XXX&issuer=Enjoy%20PMS&algorithm=SHA1&digits=6&period=30` |
| QR Code | Généré en `data:image/png;base64,...` par `qrcode` |
| Codes de récupération | Générés automatiquement lors de la 1ère activation TOTP |

### D — Codes de récupération (Recovery Codes)

| Caractéristique | Valeur |
|---|---|
| Quantité | 8 codes |
| Format | 8 caractères alphanumériques (majuscules, sans `0/O/1/I` pour lisibilité) |
| Exemple | `K7X9-P4VM` ou `K7X9P4VM` |
| Affichage | **Une seule fois** juste après l'activation MFA → affichage modal type "Imprimez ou sauvegardez ces codes" |
| Stockage | Chaque code haché séparément via Argon2 |
| Hint | 4 derniers chars stockés en clair (`code_hint`) → utilisateur sait quel code il a utilisé |
| Usage | **1 fois** → `used_at = now()`, code invalide ensuite |
| Régénération | Possible (endpoint dédié) → **invalide les anciens**, retourne nouveaux codes 1× en clair, mot de passe obligatoire |
| Rate limit | 5 essais / 15 min / user |

### E — Réponses HTTP uniformes (anti user-enumeration)

**Règle d'or** : Pour `signin` / `login` / `signinConsole` — réponses identiques :

| Cas réel | HTTP | Corps de réponse |
|---|---|---|
| Email n'existe pas | 401 | `{ status: "error", message: "Invalid credentials", error: "INVALID_CREDENTIALS" }` |
| Email OK, mauvais MDP | 401 | **Exactement le même JSON** (et même taille approx) |
| Email OK, compte non vérifié | 403 | `{ ..., error: "EMAIL_NOT_VERIFIED", email, requires_verification: true }` (volontairement distinct — nécessaire pour UX) |
| Email OK, compte verrouillé | 423 | `{ ..., error: "ACCOUNT_LOCKED", retry_after_seconds: N }` (volontairement distinct — info utile) |
| MFA requis | 202 | `{ mfa_required: true, ... }` |

---

## 🛣️ Routes à ajouter

Dans `start/routes.ts` :

```typescript
// ==========================================================
// GROUPE 1 : Auth endpoints — Rate Limité + IP Restriction
// ==========================================================
router.group(() => {
  router.post('/auth',              [AuthController, 'login'])
  router.post('/authLogin',         [AuthController, 'signin'])
  router.post('/authLoginConsole',  [AuthController, 'signinConsole'])
  router.post('/validatePassword',  [AuthController, 'validatePassword'])
  router.post('/validateEmail',     [AuthController, 'validateEmail'])
  router.post('/auth/forgot-password',         [AuthController, 'forgotPassword'])
  router.post('/auth/forgot-password-console', [AuthController, 'forgotPasswordConsole'])
}).prefix('api')
  .use([middleware.ipRestriction(), middleware.loginRateLimit()])

// ==========================================================
// GROUPE 2 : MFA verification login — Rate Limité + IP
// ==========================================================
router.group(() => {
  router.post('/mfa/verify',        [AuthController, 'verifyMfa'])
  router.post('/mfa/email/send',    [AuthController, 'sendEmailMfaCode'])
  router.post('/mfa/recovery/use',  [AuthController, 'useRecoveryCodeLogin'])
}).prefix('api')
  .use([middleware.ipRestriction(), middleware.mfaRateLimit()])

// ==========================================================
// GROUPE 3 : Gestion MFA profil — AUTHENTIFIÉ uniquement
// ==========================================================
router.group(() => {
  router.get('/mfa/methods',                        [MfaController, 'listMethods'])
  router.post('/mfa/totp/setup',                    [MfaController, 'setupTotp'])
  router.post('/mfa/totp/confirm',                  [MfaController, 'confirmTotp'])
  router.post('/mfa/email/enable',                  [MfaController, 'enableEmail'])
  router.delete('/mfa/methods/:id',                 [MfaController, 'disableMethod'])
  router.patch('/mfa/methods/:id/default',          [MfaController, 'setDefault'])
  router.get('/mfa/recovery-codes',                 [MfaController, 'getRecoveryCodes'])
  router.post('/mfa/recovery-codes/regenerate',     [MfaController, 'regenerateRecoveryCodes'])
}).prefix('api')
  .use(middleware.auth({ guards: ['api'] }))
```

Et enregistrer les middlewares nommés dans `start/kernel.ts` :
```typescript
export const middleware = router.named({
  // ... existants
  loginRateLimit: () => import('#middleware/login_rate_limit_middleware'),
  mfaRateLimit:   () => import('#middleware/mfa_rate_limit_middleware'),
})
```

---

## 🧪 Tests critiques à écrire

Créer dans `tests/functional/security/` :

### A — `account_lockout.spec.ts`
1. `5 échecs successifs → 423 Locked`
2. `6e tentative alors que locked → 423 immédiat (pas de Hash.verify appelé)`
3. `Attente 15 minutes (mock DateTime) → compte débloqué, login OK`
4. `2e blocage dans <1h → 60 min de verrou`
5. `Email inexistant → compteur IP incrémenté, pas de user_id dans login_attempts`
6. `User enumeration : email invalide vs mdp invalide → réponse + status HTTP identiques`

### B — `mfa_email.spec.ts`
1. `Génération challenge → code stocké haché → email envoyé`
2. `Code valide dans les 5 min → login OK`
3. `Code expiré (mock DateTime +6min) → 401 EXPIRED`
4. `3 codes erronés → challenge révoqué`
5. `Ré-envoi < 60s → 429 TOO_SOON`
6. `4e envoi dans < 10 min → 429 RATE_LIMITED`

### C — `mfa_totp.spec.ts`
1. `Setup → secret + qrcode B64 retournés`
2. `Confirm avec code valide → méthode enregistrée + recovery codes retournés 1×`
3. `Confirm avec code faux → méthode PAS enregistrée`
4. `Login avec code TOTP valide → 200 OK`
5. `Login avec code ±30s → toléré (window=1)`
6. `Login avec code ±60s → refusé`

### D — `mfa_recovery.spec.ts`
1. `8 codes générés → 8 hints stockés`
2. `Code valide → used_at rempli, login OK, code ne marche plus`
3. `Même code réutilisé → 401 ALREADY_USED`
4. `5 essais invalides → 429`
5. `Régénération → anciens codes invalides`

### E — `refacto_login_flow.spec.ts`
1. `Les 3 endpoints (signin / signinConsole / login) passent tous par _baseLogin`
2. `Chacun respecte ses options (consoleMode → sans serviceAssignments)`
3. `MFA désactivé → login direct avec tokens`
4. `MFA activé → 202 + mfa_required=true, AUCUN token dans la réponse`

> 💡 Exécuter via `npm test` — config déjà existante (Japa API Client + Assert + Plugin Adonis).

---

## 🎯 Ordre d'implémentation recommandé

| Phase | Description | Effort | Impact sécurité |
|---|---|---|---|
| **🔝 Phase 0** | **Installer packages** `otplib + qrcode` | 5 min | Pré-requis |
| **🔴 Phase 1 (critique)** | **Migrations + LoginSecurityService + loginRateLimit Middleware + refacto _baseLogin** | ~1 j | ✅ Protège déjà **contre 90% du brute-force** |
| **🟠 Phase 2 (haute)** | **MFA par Email** (méthode + challenges + endpoints verify/send) | ~1 j | ✅ MFA disponible sans app mobile |
| **🟡 Phase 3 (moyenne)** | **MFA TOTP** (setup, confirm, verify, controllers profil UI) | ~1,5 j | ✅ Google/Authy/1Password |
| **🟡 Phase 4 (moyenne)** | **Recovery Codes** (génération, usage, régénération) | ~0,5 j | ✅ Pas de "lockout permanent" |
| **🟢 Phase 5 (basse)** | **Tests fonctionnels** | ~1 j | Confiance non-régression |
| **🟢 Phase 6 (future)** | MFA SMS (Twilio) + WebAuthn (YubiKey / Touch ID) | Variable | Extensions |

**Pourquoi commencer par Phase 1 ?** Elle est autonome, ne dépend pas du package TOTP, et résout immédiatement les failles F1 + F3 + F4.

---

## 📊 Monitoring & logs d'audit

**Tous** les événements ci-dessous **doivent** passer par `LoggerService.log()` pour alimenter `activity_logs` (dashboard admin sécurité).

| Event | entityType | Contexte |
|---|---|---|
| `LOGIN_SUCCESS` | User | via `password` / `password + MFA_EMAIL` / `password + MFA_TOTP` / `RECOVERY_CODE` |
| `LOGIN_FAILED` | User | `failure_reason`: `WRONG_PASSWORD \| ACCOUNT_LOCKED \| MFA_FAILED \| EMAIL_NOT_VERIFIED \| RATE_LIMITED` |
| `ACCOUNT_LOCKED` | User | `duration_minutes`, `ip_address`, `attempts_count` |
| `ACCOUNT_UNLOCKED_AUTO` | User | unlock auto après expiration |
| `MFA_CODE_SENT` | MfaMethod | `method_type`, `delivery_channel` |
| `MFA_VERIFIED` | MfaChallenge | `method_type` |
| `MFA_METHOD_ENABLED` | MfaMethod | `method_type` (par qui, quand) |
| `MFA_METHOD_DISABLED` | MfaMethod | idem (avec IP) |
| `RECOVERY_CODE_USED` | MfaRecoveryCode | `code_hint`, `ip` |
| `RECOVERY_CODES_REGENERATED` | User | ancien count vs nouveau count |
| `ACCOUNT_SUSPICIOUS_ACTIVITY` | User | 3e blocage dans < 24h → flag pour admin |

### Dashboard sécurité admin (à ajouter dans Console)
- Tentatives de connexion par IP / pays (géolocalisation via un service)
- Comptes actuellement verrouillés
- Tentatives suspectes : plus de 50 échecs / jour d'un bloc IP
- Taux d'activation MFA par hôtel

---

## 🔗 Références fichiers existants

| Fichier | Utilité |
|---|---|
| [config/auth.ts](file:///e:/Documenti/dev/EnjoyBackEnd/config/auth.ts) | Configuration Access Tokens Guard |
| [app/models/user.ts](file:///e:/Documenti/dev/EnjoyBackEnd/app/models/user.ts) | Modèle User — champ `two_factor_enabled` déjà présent |
| [app/controllers/auth_controller.ts](file:///e:/Documenti/dev/EnjoyBackEnd/app/controllers/auth_controller.ts) | 3 endpoints login + refresh + forgot password |
| [app/services/mail_service.ts](file:///e:/Documenti/dev/EnjoyBackEnd/app/services/mail_service.ts) | Service d'envoi d'emails SMTP/Mailjet (à utiliser pour MFA par email) |
| [app/services/user_email_service.ts](file:///e:/Documenti/dev/EnjoyBackEnd/app/services/user_email_service.ts) | Exemple d'envoi de token + email (vérification email) |
| [app/services/logger_service.ts](file:///e:/Documenti/dev/EnjoyBackEnd/app/services/logger_service.ts) | Audit logger (à utiliser pour tous les events sécurité) |
| [app/middleware/auth_middleware.ts](file:///e:/Documenti/dev/EnjoyBackEnd/app/middleware/auth_middleware.ts) | Guard authenticate (utilisé par routes protégées profil MFA) |
| [app/middleware/ip_restriction_middleware.ts](file:///e:/Documenti/dev/EnjoyBackEnd/app/middleware/ip_restriction_middleware.ts) | Restriction IP (à combiner avec loginRateLimit) |
| [start/kernel.ts](file:///e:/Documenti/dev/EnjoyBackEnd/start/kernel.ts) | Enregistrement middlewares nommés |
| [start/routes.ts](file:///e:/Documenti/dev/EnjoyBackEnd/start/routes.ts) | Déclaration routes (groupes login + mfa + gestion) |
| [start/env.ts](file:///e:/Documenti/dev/EnjoyBackEnd/start/env.ts) | Schéma variables env — aucune nouvelle variable requise |
| [database/migrations/1716315000000_create_users_table.ts](file:///e:/Documenti/dev/EnjoyBackEnd/database/migrations/1716315000000_create_users_table.ts) | Migration users initiale (contient déjà `two_factor_enabled`) |
| [package.json](file:///e:/Documenti/dev/EnjoyBackEnd/package.json) | Dépendances actuelles |

---

## ✅ Avantages de cette architecture

| Point | Détail |
|---|---|
| **Centralisée** | Logique métier dans 2 services → 0 duplication sur les 3 endpoints login |
| **Extensible** | Nouveau type de MFA (SMS, WebAuthn) = 1 nouveau `method_type` |
| **Performance** | Vérification `locked_until` AVANT `Hash.verify` → économise CPU sous attaque |
| **RGPD / conformité** | Audit logs complets, secrets TOTP chiffrés, codes hachés Argon2 |
| **Pas de régression** | Endpoints login gardent même signature — `mfa_required` ajouté seulement quand MFA est ON |
| **Déployable par phases** | Rate limit d'abord, puis email MFA, puis TOTP → value incrémentale |
| **UX friendly** | Méthode par défaut auto-sélectionnée, codes recovery comme filet de sécurité |

---

*Fin du document — Version 1.0*
