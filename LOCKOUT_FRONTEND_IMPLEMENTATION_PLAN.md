# 🔒 LOCKOUT FRONTEND — Implémentation EnjoyAdmin
**Projet cible** : `E:\Documenti\dev\EnjoyAdmin`
**Backend lié** : `EnjoyBackEnd` (implémentation complète livrée : `login_security_service.ts`, `login_rate_limit_middleware.ts`, migration lockout sur users table)
**Date** : 2026-08-18
**Auteur** : Analyse + plan d'implémentation frontend
**Sujet** : Gestion côté frontend du verrouillage de compte après 5 échecs de mot de passe en 15 minutes, ainsi que du rate limiting IP / email+IP.

---

## ⚠️ IMPORTANT — Langue des messages Backend → Frontend
**Tous les messages renvoyés par le Backend (JSON API, Logs Logger) sont en ANGLAIS (EN) par défaut.**
Exemples :
- Login erreur 401 uniforme : `{ "message": "Invalid credentials", "error": "INVALID_CREDENTIALS" }`
- Lockout : `{ "message": "Account locked due to too many failed login attempts.", "error": "ACCOUNT_LOCKED", "retry_after_seconds": 900, "locked_until": "2026-08-18T12:34:56.000Z", "reason": "Too many failed login attempts (5) in 15min — lock 15min" }`
- Rate limit IP : `{ "message": "Too many requests. Please try again later.", "error": "TOO_MANY_REQUESTS_PER_IP", "retry_after_seconds": 60 }` + Header HTTP `Retry-After: N`
- Rate limit email+IP : `{ "message": "Too many attempts. Please try again later.", "error": "TOO_MANY_ATTEMPTS", "retry_after_seconds": 900 }` + Header HTTP `Retry-After: N`

👉 Le Frontend (EnjoyAdmin) **peut** afficher tel quel (convivial EN) **OU** utiliser le champ `error` + la clé `status` dans les réponses JSON pour faire de la **localisation via vue-i18n** (`fr.json` / `en.json`).

---

## 0. Configuration Backend — source de vérité (à connaître)

Seuils définis dans `EnjoyBackEnd/app/services/login_security_service.ts` (objet `LOCKOUT_CONFIG`) :

| Paramètre | Valeur |
|---|---|
| `WINDOW_MINUTES` | 15 minutes (fenêtre glissante d'analyse) |
| `MAX_ATTEMPTS` | **5 tentatives** (seuil de déclenchement du blocage compte) |
| `FIRST_LOCK_MINUTES` | 15 min — blocage #1 |
| `SECOND_LOCK_MINUTES` | 60 min — blocage #2 si ≥1 blocage dans 24h |
| `THIRD_LOCK_HOURS` | 24 h — blocage #3 et suivants si ≥2 blocages dans 24h |
| `RATE_LIMIT_PER_IP_PER_MIN` | 20 req / min / IP |

Endpoints login protégés par le middleware `loginRateLimit()` (EnjoyBackEnd/start/routes.ts) :
- `POST /api/auth` (login simple)
- `POST /api/authLogin` (signin PMS — contexte hôtel)
- `POST /api/authLoginConsole` (signin Console Admin)

Endpoints MFA protégés par le middleware `mfaRateLimit()` :
- `POST /api/mfa/verify`
- `POST /api/mfa/email/send`
- `POST /api/mfa/recovery/use`

⚠️ **Les échecs MFA comptent aussi** dans le compteur de 5 (backend appelle `incrementFailed(..., 'MFA_FAILED')`). Les deux routes login ET MFA doivent donc implémenter le même handling lockout.

---

## 1. Stack frontend utilisée (déjà présente)

| Couche | Technologie | Usage Lockout |
|---|---|---|
| Framework | **Vue 3.5** (Composition API, `<script setup>`) | Tous composants lockout |
| Build | **Vite 6** | |
| Langage | **TypeScript 5.7** | Tous types lockout |
| Store | **Pinia 3** + `pinia-plugin-persistedstate` | Store `auth.ts` : états lock + rate limit |
| Router | **Vue Router 4.5** | Guards (pas de route lockout dédiée — banner inline) |
| HTTP Client | **Axios 1.8** (`src/services/apiClient.ts`) | Intercepteur 423 Retry-After + bus événements |
| UI | **TailwindCSS 4** + **lucide-vue-next** | Bannières lockout (🔒 / 🚦) |
| Toast | **vue-toastification 2** | Messages warning / erreur lockout |
| I18N | **vue-i18n 11** | Clés `security.*`, `auth.warnings.*` |
| Desktop | **Electron 37** | Pas d'adaptation particulière (web flow suffit) |

---

## 2. Architecture des fichiers

```
EnjoyAdmin/src/
├── services/
│   ├── apiClient.ts                 ✏️ MODIFIER : intercepteur 423/429 + securityBus
│   └── userApi.ts                   (inchangé — les endpoints existent déjà)
│
├── composables/
│   └── user.ts                      ✏️ MODIFIER : états lockout + getters + actions + persist
│
├── main.ts                          ✏️ MODIFIER : brancher securityBus au démarrage
│
├── views/
│   └── Auth/
│       ├── Signin.vue               ✏️ MODIFIER : banner 423/429 + disable form + warning progressif
│       └── MfaChallenge.vue         ✏️ MODIFIER : même handling lockout sur verify + email/send
│
├── components/
│   └── auth/
│       ├── LockoutBanner.vue        🆕 NOUVEAU : bannières lock (423) + rate (429) réutilisable
│       └── ReAuthModal.vue          ✏️ MODIFIER : même handling inline
│
└── lang/translations/
    ├── fr.json                      ✏️ MODIFIER : clés security.* + auth.warnings.*
    └── en.json                      ✏️ MODIFIER : clés security.* + auth.warnings.*
```

---

## 3. Les 5 réponses backend possibles au Login / MFA Verify

| Scénario | HTTP | Champ `error` JSON | Header clé | Champs data à exploiter |
|---|---|---|---|---|
| ✅ Mot de passe OK | **200** | — | — | `data.user_token`, `data.access_token`, `data.refresh_token`, `data.user` |
| ⚠️ MFA requis | **202** | — | — | `mfa_required`, `mfa_challenge_id`, `available_methods`, `default_method_id` |
| ❌ Identifiants invalides | **401** | `INVALID_CREDENTIALS` | — | `message: "Invalid credentials"` — **UNIFORME : ne JAMAIS divulguer si l'email existe** |
| 🔒 Compte VERROUILLÉ (5+ échecs en 15min) | **423** | `ACCOUNT_LOCKED` | — | `locked_until: ISO8601`, `retry_after_seconds: 900 \| 3600 \| 86400`, `reason: string` |
| 🚦 Trop de requêtes (IP ou email+IP) | **429** | `TOO_MANY_REQUESTS_PER_IP` \| `TOO_MANY_ATTEMPTS` | `Retry-After: N` | `retry_after_seconds: N` |

Règle d'or : **le backend est l'unique source de vérité.**
- Ne JAMAIS compter les échecs côté client pour décider d'un lock.
- Ne JAMAIS déduire les durées (15min / 60min / 24h) côté client.
- Se contenter d'afficher `locked_until` / `retry_after_seconds` renvoyés.

---

## 4. Couche API Client — Intercepteur Axios global

**Fichier EnjoyAdmin :** `src/services/apiClient.ts`

Ajout : intercepteur + Event Bus pour propager lockout à TOUS les composants abonnés (Signin, MfaChallenge, ReAuthModal, etc.).

```typescript
// ========== COLLER DANS apiClient.ts ==========
import axios, { AxiosError, AxiosResponse } from 'axios';

export type SecurityEvent =
  | { type: 'ACCOUNT_LOCKED'; retryAfterSec: number; lockedUntil: string; reason?: string }
  | { type: 'RATE_LIMITED'; retryAfterSec: number; scope: 'IP' | 'EMAIL_IP' };

/**
 * Bus événementiel global : toute réponse 423 / 429 d'Axios est émise ici.
 * Le store Pinia s'abonne au démarrage via initSecurityBus().
 */
export const securityBus = new (class {
  private listeners = new Set<(e: SecurityEvent) => void>();
  on(fn: (e: SecurityEvent) => void) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(e: SecurityEvent) { this.listeners.forEach(fn => fn(e)); }
})();

// Instance axios existante :
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true, // important pour refresh_token cookie httpOnly
});

// ─── Intercepteur DE RÉPONSE : attraper 423 / 429 DANS TOUS LES CAS ───
apiClient.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    const status = err.response?.status;
    const data = err.response?.data as any;
    const headerRetry = Number(err.response?.headers?.['retry-after']);
    const bodyRetry = Number(data?.retry_after_seconds);
    const retryAfter = Number.isFinite(bodyRetry) ? bodyRetry : Number.isFinite(headerRetry) ? headerRetry : 0;

    if (status === 423 && data?.error === 'ACCOUNT_LOCKED') {
      securityBus.emit({
        type: 'ACCOUNT_LOCKED',
        retryAfterSec: retryAfter || 900,
        lockedUntil: data?.locked_until || new Date(Date.now() + retryAfter * 1000).toISOString(),
        reason: data?.reason,
      });
    }

    if (status === 429) {
      securityBus.emit({
        type: 'RATE_LIMITED',
        retryAfterSec: retryAfter || 60,
        scope: data?.error === 'TOO_MANY_ATTEMPTS' ? 'EMAIL_IP' : 'IP',
      });
    }

    return Promise.reject(err);
  },
);

export default apiClient;
```

---

## 5. Store Pinia Auth — États lockout + rate limit

**Fichier EnjoyAdmin :** `src/composables/user.ts`

Ajouter les états, getters, actions suivants dans le store user auth existant :

```typescript
// ========== À AJOUTER DANS user.ts (store Pinia) ==========
import { defineStore } from 'pinia';
import { securityBus } from '@/services/apiClient';

interface LockState {
  locked: boolean;
  lockedUntil: string | null; // ISO 8601 — source de vérité
  retryAfterSec: number;
  reason: string | null;
  // Rate limit 429 (courte durée) :
  rateLimited: boolean;
  rateLimitScope: 'IP' | 'EMAIL_IP' | null;
  rateLimitRetryAfterSec: number;
}

export const useUserStore = defineStore('user', {
  state: () => ({
    // — états auth existants —
    token: null as string | null,
    refreshToken: null as string | null,
    user: null as any,
    rememberedEmail: null as string | null,
    mfaPending: false,
    mfaChallengeId: null as string | null,
    // ... (autres états MFA existants)

    // ═══════ NOUVEAU : états LOCKOUT ═══════
    lock: {
      locked: false,
      lockedUntil: null,
      retryAfterSec: 0,
      reason: null,
      rateLimited: false,
      rateLimitScope: null,
      rateLimitRetryAfterSec: 0,
    } satisfies LockState,

    /**
     * Compteur indicatif côté client (hint visuel UNIQUEMENT).
     * La source de vérité reste le backend.
     * On borne à 5 et on reset à chaque succès / F5.
     */
    failedAttemptsHint: 0,
  }),

  // ⚠️ PERSISTER lock (survivre F5)
  persist: {
    pick: [
      'token', 'refreshToken', 'user', 'rememberedEmail',
      'mfaPending', 'mfaChallengeId', 'mfaAvailableMethods', 'mfaDefaultMethodId',
      // +++ nouveau :
      'lock',
    ],
  },

  getters: {
    /** true = compte actuellement verrouillé (date expirée non atteinte) */
    isLocked: (s) => s.lock.locked && !!s.lock.lockedUntil && Date.parse(s.lock.lockedUntil) > Date.now(),

    /** secondes restantes AVANT déverrouillage (0 si pas locké) */
    lockRemainingSec: (s): number => {
      if (!s.lock.locked || !s.lock.lockedUntil) return 0;
      return Math.max(0, Math.ceil((Date.parse(s.lock.lockedUntil) - Date.now()) / 1000));
    },

    /** format lisible : "14min 32s" / "59min 00s" / "23h 45min" */
    lockRemainingHuman: (s): string => {
      const sec = s.lock.locked && s.lock.lockedUntil
        ? Math.max(0, Math.ceil((Date.parse(s.lock.lockedUntil) - Date.now()) / 1000))
        : 0;
      if (sec >= 86400) {
        const d = Math.floor(sec / 86400);
        const h = Math.floor((sec % 86400) / 3600);
        return d > 1 ? `${d}j ${h}h` : `${24 + h}h`;
      }
      if (sec >= 3600) {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        return `${h}h ${m.toString().padStart(2, '0')}min`;
      }
      const m = Math.floor(sec / 60);
      const s2 = sec % 60;
      return `${m}min ${s2.toString().padStart(2, '0')}s`;
    },

    /** Tague si un 429 est en cours (court terme : 60s ~ 900s max) */
    isRateLimited: (s) => s.lock.rateLimited && s.lock.rateLimitRetryAfterSec > 0,
  },

  actions: {
    // ════════ À APPELER DANS main.ts APRÈS installation Pinia ════════
    initSecurityBus() {
      securityBus.on((evt) => {
        if (evt.type === 'ACCOUNT_LOCKED') {
          this.lock.locked = true;
          this.lock.lockedUntil = evt.lockedUntil;
          this.lock.retryAfterSec = evt.retryAfterSec;
          this.lock.reason = evt.reason ?? null;
        }
        if (evt.type === 'RATE_LIMITED') {
          this.lock.rateLimited = true;
          this.lock.rateLimitScope = evt.scope;
          this.lock.rateLimitRetryAfterSec = evt.retryAfterSec;
          // Auto-reset quand le timer est écoulé
          setTimeout(() => {
            if (this.lock.rateLimitRetryAfterSec <= evt.retryAfterSec) {
              this.lock.rateLimited = false;
              this.lock.rateLimitScope = null;
              this.lock.rateLimitRetryAfterSec = 0;
            }
          }, evt.retryAfterSec * 1000);
        }
      });
    },

    /**
     * Appelé SUR CHAQUE 401 "invalid credentials" — incrémente UNIQUEMENT
     * le hint visuel. Ne déclenche JAMAIS de lock côté client (rôle du backend).
     */
    bumpFailedHint() {
      this.failedAttemptsHint = Math.min(this.failedAttemptsHint + 1, 5);
    },

    /** Appelé au SUCCÈS login (200 / 200 après MFA verify) */
    resetLockState() {
      this.lock = {
        locked: false,
        lockedUntil: null,
        retryAfterSec: 0,
        reason: null,
        rateLimited: false,
        rateLimitScope: null,
        rateLimitRetryAfterSec: 0,
      };
      this.failedAttemptsHint = 0;
    },

    /**
     * À appeler toutes les secondes depuis un setInterval monté dans Signin.
     * Nettoie l'état `locked` côté client quand lockedUntil est passé.
     */
    tickLockTimer() {
      if (this.lock.locked && this.lock.lockedUntil && Date.parse(this.lock.lockedUntil) <= Date.now()) {
        this.lock.locked = false;
        this.lock.lockedUntil = null;
        this.lock.retryAfterSec = 0;
        this.lock.reason = null;
      }
    },
  },
});
```

---

## 6. `main.ts` — Brancher securityBus une seule fois

```typescript
// main.ts
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';
import { useUserStore } from '@/composables/user';
import App from './App.vue';
import router from './router';
import Toast from 'vue-toastification';
import 'vue-toastification/dist/index.css';

const app = createApp(App);
const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);
app.use(pinia);
app.use(router);
app.use(Toast, { position: 'top-right', timeout: 4000 });

// ═══════ IMPORTANT : APRÈS app.use(pinia) ═══════
const store = useUserStore();
store.initSecurityBus();

app.mount('#app');
```

---

## 7. Composant réutilisable — `components/auth/LockoutBanner.vue`

À **créer** : affiche les 2 bannières (lock 423 + rate 429). Réutilisable dans Signin / MfaChallenge / ReAuthModal.

```vue
<!-- LockoutBanner.vue -->
<script setup lang="ts">
import { useUserStore } from '@/composables/user';
import { computed } from 'vue';
import { LockIcon, AlertTriangleIcon } from 'lucide-vue-next';

const store = useUserStore();
defineProps<{
  /** Si défini, affiche seulement cette variante (sinon les deux si applicable) */
  variant?: 'lock' | 'rate';
}>();

const tag = computed(() => {
  const sec = store.lock.retryAfterSec;
  if (sec >= 86400) return 'Blocage long — contactez un administrateur si nécessaire.';
  if (sec >= 3600) return '2ᵉ blocage consécutif : durée augmentée.';
  return '1ᵉʳ blocage.';
});
</script>

<template>
  <!-- ========================================================= -->
  <!-- 🔒 BANNIÈRE COMPTE VERROUILLÉ (HTTP 423 ACCOUNT_LOCKED)    -->
  <!-- ========================================================= -->
  <div
    v-if="store.isLocked && (!variant || variant === 'lock')"
    role="alert"
    aria-live="assertive"
    class="p-4 rounded-xl border-2 border-red-200 bg-red-50 flex gap-3 animate-fadeIn"
  >
    <LockIcon class="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" stroke-width="2" />
    <div class="flex-1 min-w-0">
      <h4 class="font-bold text-red-800 text-sm leading-5">
        Compte temporairement bloqué
      </h4>
      <p class="text-sm text-red-700 mt-1">
        Trop de tentatives de connexion échouées.
      </p>
      <div class="mt-3 flex items-baseline gap-2">
        <span class="text-[11px] uppercase tracking-wider font-semibold text-red-600/80">
          Déverrouillage dans :
        </span>
        <span
          class="font-mono text-xl font-bold text-red-700 tabular-nums select-none"
          aria-live="polite"
        >
          {{ store.lockRemainingHuman }}
        </span>
      </div>
      <p v-if="store.lock.reason" class="text-xs text-red-600/80 mt-2">
        {{ store.lock.reason }}
      </p>
      <p class="text-xs text-red-600/80 mt-1">
        {{ tag }}
      </p>
    </div>
  </div>

  <!-- ========================================================= -->
  <!-- 🚦 BANNIÈRE RATE LIMIT (HTTP 429 TOO_MANY_REQUESTS)        -->
  <!-- ========================================================= -->
  <div
    v-if="store.isRateLimited && !store.isLocked && (!variant || variant === 'rate')"
    role="alert"
    aria-live="polite"
    class="p-4 rounded-xl border-2 border-amber-200 bg-amber-50 flex gap-3 animate-fadeIn"
  >
    <AlertTriangleIcon class="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" stroke-width="2" />
    <div class="flex-1">
      <h4 class="font-bold text-amber-800 text-sm leading-5">
        {{
          store.lock.rateLimitScope === 'EMAIL_IP'
            ? 'Trop de tentatives sur ce compte'
            : 'Trop de requêtes depuis votre IP'
        }}
      </h4>
      <p class="text-sm text-amber-700 mt-1">
        Réessayez dans
        <b class="font-mono tabular-nums">{{ store.lock.rateLimitRetryAfterSec }}s</b>.
      </p>
    </div>
  </div>
</template>

<style scoped>
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fadeIn { animation: fadeIn 200ms ease-out; }
</style>
```

---

## 8. Vue — `views/Auth/Signin.vue` (MODIFIER)

### 8a. Partie `<script setup>`

```typescript
// views/Auth/Signin.vue
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useUserStore } from '@/composables/user';
import apiClient from '@/services/apiClient';
import { useToast } from 'vue-toastification';
import LockoutBanner from '@/components/auth/LockoutBanner.vue';
import AppLogo from '@/components/AppLogo.vue';
import { EyeIcon, EyeOffIcon } from 'lucide-vue-next';

const store = useUserStore();
const router = useRouter();
const toast = useToast();

// ───── Etats formulaire ─────
const email = ref(store.rememberedEmail ?? '');
const password = ref('');
const loading = ref(false);
const errorMsg = ref<string | null>(null);
const showPassword = ref(false);

// ───── Tick toutes les 1s pour rafraîchir lockRemainingHuman ─────
let tickHandle: number | null = null;
onMounted(() => {
  if (store.isLocked) {
    toast.warning(`Compte verrouillé — Réessayez dans ${store.lockRemainingHuman}`);
  }
  tickHandle = window.setInterval(() => store.tickLockTimer(), 1000);
});
onBeforeUnmount(() => { if (tickHandle) clearInterval(tickHandle); });

// ───── Helpers UI ─────
const showProgressWarning = computed(
  () => !store.isLocked && store.failedAttemptsHint >= 3 && store.failedAttemptsHint < 5
);
const attemptsLeft = computed(() => 5 - store.failedAttemptsHint);

function shakeCard() {
  const card = document.querySelector<HTMLElement>('[data-login-card]');
  card?.animate(
    [
      { transform: 'translateX(0)' },
      { transform: 'translateX(-8px)' },
      { transform: 'translateX(8px)' },
      { transform: 'translateX(-4px)' },
      { transform: 'translateX(0)' },
    ],
    { duration: 350, easing: 'ease-in-out' }
  );
}

// ───── SUBMIT ─────
async function submitLogin() {
  // Double guard : même si bouton disabled, empêcher submit programmatique
  if (loading.value || store.isLocked || store.isRateLimited) return;

  loading.value = true;
  errorMsg.value = null;

  try {
    // Choisir endpoint selon contexte :
    //   / (app PMS)      → /api/authLogin
    //   /console         → /api/authLoginConsole
    //   /login (ancien)  → /api/auth
    const path = window.location.pathname;
    let endpoint = '/api/authLogin';
    if (path.startsWith('/console')) endpoint = '/api/authLoginConsole';
    else if (path === '/login' || path === '/login/') endpoint = '/api/auth';

    const res = await apiClient.post(endpoint, {
      email: email.value.trim().toLowerCase(),
      password: password.value,
    });

    // ── 200 OK classique (pas de MFA) ──
    if (res.status === 200) {
      const payload = res.data.data ?? res.data;
      const { user_token, access_token, refresh_token, user } = payload;
      const at = user_token || access_token;
      store.setTokens?.(at, refresh_token); // fonction existante
      store.setUser?.(user);                 // fonction existante
      store.rememberedEmail = email.value;
      store.resetLockState();
      toast.success('Connexion réussie');
      router.push('/dashboard');
      return;
    }

    // ── 202 ACCEPTED : MFA étape 2 (voir plan MFA_FRONTEND_IMPLEMENTATION_PLAN.md) ──
    if (res.status === 202) {
      store.setPendingMfa?.(res.data, email.value);
      router.push('/mfa-challenge');
    }
  } catch (e: any) {
    const status = e.response?.status;
    const body = e.response?.data;

    // ═══════════════════════════════════
    // 🔒 423 ACCOUNT_LOCKED
    // ═══════════════════════════════════
    if (status === 423) {
      // (securityBus a déjà peuplé store.lock — affichage via LockoutBanner)
      errorMsg.value = body?.reason || 'Compte temporairement bloqué suite à trop de tentatives.';
      toast.error(`Compte bloqué — Réessayez dans ${store.lockRemainingHuman}`);
      loading.value = false;
      return;
    }

    // ═══════════════════════════════════
    // 🚦 429 RATE LIMIT
    // ═══════════════════════════════════
    if (status === 429) {
      const secs = store.lock.rateLimitRetryAfterSec;
      const scope = store.lock.rateLimitScope;
      toast.warning(
        scope === 'EMAIL_IP'
          ? `Trop de tentatives sur ce compte — Réessayez dans ${secs}s`
          : `Trop de requêtes depuis votre IP — Réessayez dans ${secs}s`
      );
      loading.value = false;
      return;
    }

    // ═══════════════════════════════════
    // ❌ 401 INVALID_CREDENTIALS — MESSAGE UNIFORME
    // ═══════════════════════════════════
    // RÈGLE SÉCURITÉ : ne JAMAIS faire la distinction entre "email introuvable"
    // et "mauvais mot de passe". Toujours le même message.
    store.bumpFailedHint();
    errorMsg.value = 'Identifiants invalides.';
    password.value = '';
    shakeCard();

    // Warning progressif à partir du 3e échec (hint visuel seulement)
    if (showProgressWarning.value) {
      toast.warning(
        `Attention — il reste ${attemptsLeft.value} tentative(s) avant blocage temporaire.`
      );
    }
  } finally {
    loading.value = false;
  }
}
```

### 8b. Partie `<template>`

```vue
<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-900/95 px-4 py-10">
    <div
      data-login-card
      class="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 transition-opacity duration-200"
      :class="{ 'opacity-90 pointer-events-none': store.isLocked || loading }"
    >
      <!-- ═══ BANNIÈRE LOCKOUT / RATE LIMIT ═══ -->
      <LockoutBanner class="mb-6" />

      <!-- ═══ LOGO + TITRE ═══ -->
      <div class="text-center mb-8">
        <AppLogo class="mx-auto h-12 w-auto" />
        <h1 class="mt-4 text-2xl font-bold text-slate-800 tracking-tight">
          Connexion
        </h1>
        <p class="mt-1 text-sm text-slate-500">
          Accédez à votre espace Enjoy
        </p>
      </div>

      <!-- ═══ FORMULAIRE ═══ -->
      <form
        @submit.prevent="submitLogin"
        class="space-y-5"
        :aria-disabled="store.isLocked || store.isRateLimited"
      >
        <!-- Email -->
        <div>
          <label for="email" class="block text-sm font-medium text-slate-700 mb-1.5">
            Adresse email
          </label>
          <input
            id="email"
            v-model="email"
            type="email"
            autocomplete="email"
            required
            :disabled="store.isLocked || store.isRateLimited || loading"
            :aria-invalid="errorMsg === 'Identifiants invalides.' ? 'true' : 'false'"
            class="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed transition"
            placeholder="vous@exemple.com"
          />
        </div>

        <!-- Password -->
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label for="password" class="block text-sm font-medium text-slate-700">
              Mot de passe
            </label>
            <router-link
              to="/forgot-password"
              class="text-xs font-medium text-indigo-600 hover:text-indigo-500 transition"
              :class="{ 'pointer-events-none opacity-50': store.isLocked || store.isRateLimited }"
            >
              Mot de passe oublié ?
            </router-link>
          </div>
          <div class="relative">
            <input
              id="password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              required
              :disabled="store.isLocked || store.isRateLimited || loading"
              :aria-invalid="errorMsg === 'Identifiants invalides.' ? 'true' : 'false'"
              class="w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none pr-10 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed transition"
              :class="
                errorMsg === 'Identifiants invalides.'
                  ? 'border-red-400 bg-red-50/50'
                  : 'border-slate-300'
              "
              placeholder="••••••••"
            />
            <button
              type="button"
              tabindex="-1"
              @click="showPassword = !showPassword"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
              :aria-label="showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
            >
              <EyeIcon v-if="!showPassword" class="w-4 h-4" />
              <EyeOffIcon v-else class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Message d'erreur inline -->
        <p
          v-if="errorMsg && !store.isLocked"
          role="alert"
          class="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2"
        >
          {{ errorMsg }}
        </p>

        <!-- Bouton submit -->
        <button
          type="submit"
          :disabled="
            store.isLocked ||
            store.isRateLimited ||
            loading ||
            !email ||
            !password
          "
          class="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-200 transition disabled:bg-slate-300 disabled:cursor-not-allowed disabled:hover:bg-slate-300 relative overflow-hidden"
        >
          <template v-if="store.isLocked">
            🔒 Déverrouillage dans {{ store.lockRemainingHuman }}
          </template>
          <template v-else-if="store.isRateLimited">
            🚦 Attendez {{ store.lock.rateLimitRetryAfterSec }}s
          </template>
          <template v-else-if="loading">
            <span class="flex items-center justify-center gap-2">
              <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Connexion en cours…
            </span>
          </template>
          <template v-else>Se connecter</template>
        </button>
      </form>

      <!-- ═══ Warning progressif : 3-4 échecs hint ═══ -->
      <div
        v-if="showProgressWarning"
        class="mt-4 text-center text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 animate-fadeIn"
      >
        ⚠️ Il reste <b>{{ attemptsLeft }}</b> tentative(s) avant blocage
        automatique du compte pendant <b>15 min</b>.
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fadeIn { animation: fadeIn 200ms ease-out; }
</style>
```

---

## 9. Vue — `views/Auth/MfaChallenge.vue` (MODIFIER)

⚠️ **Les échecs MFA (code invalide) comptent aussi dans les 5 tentatives** (backend appelle `LoginSecurityService.incrementFailed(..., 'MFA_FAILED')`). Il faut donc :

1. Réutiliser `<LockoutBanner />` en haut de la page
2. Gérer 423 / 429 sur `POST /mfa/verify` ET `POST /mfa/email/send`
3. Appeler `setInterval → tickLockTimer()` au montage
4. Au succès MFA verify : `store.resetLockState()`

Extrait du script :

```typescript
// Dans MfaChallenge.vue
import LockoutBanner from '@/components/auth/LockoutBanner.vue';
import { useToast } from 'vue-toastification';

const store = useUserStore();
const toast = useToast();
const errorText = ref('');
const loading = ref(false);

let tickHandle: number | null = null;
onMounted(() => {
  if (store.isLocked) toast.warning(`Compte verrouillé — ${store.lockRemainingHuman}`);
  tickHandle = window.setInterval(() => store.tickLockTimer(), 1000);
});
onBeforeUnmount(() => { if (tickHandle) clearInterval(tickHandle); });

/** Submit TOTP ou Email code */
async function submitMfa(code: string, methodId?: number) {
  if (store.isLocked || store.isRateLimited) return;
  loading.value = true;
  errorText.value = '';
  try {
    const res = await apiClient.post('/api/mfa/verify', {
      mfa_challenge_id: store.mfaChallengeId,
      code,
      method_id: methodId,
    });
    const payload = res.data.data ?? res.data;
    store.setTokens?.(payload.access_token, payload.refresh_token);
    store.setUser?.(payload.user);
    store.clearPendingMfa?.();
    store.resetLockState(); // ← ⚠️ NE PAS OUBLIER
    toast.success('Connexion réussie');
    router.push('/dashboard');
  } catch (e: any) {
    const status = e.response?.status;
    if (status === 423) {
      toast.error(`Compte bloqué — ${store.lockRemainingHuman}`);
      return;
    }
    if (status === 429) {
      toast.warning(`Ralentissez — réessayez dans ${store.lock.rateLimitRetryAfterSec}s`);
      return;
    }
    if (status === 404) {
      // Challenge row a disparu (backend redémarré ?)
      toast.error('Session MFA expirée — reconnectez-vous');
      store.abortMfa?.();
      return;
    }
    // 401 — code invalide
    store.bumpFailedHint();
    errorText.value = 'Code invalide. Vérifiez et réessayez.';
    if (store.failedAttemptsHint >= 3 && store.failedAttemptsHint < 5) {
      toast.warning(
        `Attention — ${5 - store.failedAttemptsHint} tentative(s) avant blocage 15 min.`
      );
    }
  } finally {
    loading.value = false;
  }
}

/** Envoi / renvoi code email */
async function sendEmailCode() {
  if (store.isLocked || store.isRateLimited) return;
  try {
    await apiClient.post('/api/mfa/email/send', {
      mfa_challenge_id: store.mfaChallengeId,
    });
    toast.success(`Code envoyé à ${maskEmail(store.rememberedEmail ?? '')}`);
    startCountdown(60); // bouton renvoyer disabled 60s
  } catch (e: any) {
    if (e.response?.status === 423) {
      toast.error(`Compte bloqué — ${store.lockRemainingHuman}`);
      return;
    }
    if (e.response?.status === 429) {
      const body = e.response?.data;
      const code = body?.error;
      if (code === 'MFA_SEND_RATE_LIMIT') {
        toast.error('Trop de codes envoyés — attendez quelques minutes.');
      } else {
        toast.warning(`Attendez ${store.lock.rateLimitRetryAfterSec}s avant d'envoyer un nouveau code.`);
      }
      return;
    }
    toast.error('Impossible d\'envoyer le code — réessayez');
  }
}
```

Dans le `<template>` : ajouter `<LockoutBanner class="mb-6" />` en haut de la carte, avant le titre.

---

## 10. I18N — Clés `fr.json` et `en.json`

```json
/* ========== fr.json — section security ========== */
{
  "security": {
    "section": "Sécurité du compte",

    "locked": {
      "title": "Compte temporairement bloqué",
      "subtitle_reason": "Trop de tentatives de connexion échouées.",
      "countdown_label": "Déverrouillage dans :",
      "reason_prefix": "Motif :",

      "tag_first": "1ᵉʳ blocage.",
      "tag_second": "2ᵉ blocage consécutif : durée augmentée.",
      "tag_long": "Blocage long — contactez un administrateur si nécessaire."
    },

    "rate_limit": {
      "scope_ip": "Trop de requêtes depuis votre IP",
      "scope_email_ip": "Trop de tentatives sur ce compte",
      "retry": "Réessayez dans {seconds}s."
    }
  },

  "auth": {
    "warnings": {
      "progress": "⚠️ Il reste {n} tentative(s) avant blocage automatique pendant 15 min.",
      "locked_toast": "Compte bloqué — Réessayez dans {duration}",
      "rate_ip_toast": "Trop de requêtes depuis votre IP — Réessayez dans {seconds}s",
      "rate_email_ip_toast": "Trop de tentatives sur ce compte — Réessayez dans {seconds}s"
    },

    "invalid_credentials": "Identifiants invalides.",

    "submit": {
      "locked": "🔒 Déverrouillage dans {duration}",
      "rate": "🚦 Attendez {seconds}s",
      "loading": "Connexion en cours…",
      "default": "Se connecter"
    }
  }
}
```

```json
/* ========== en.json — section security ========== */
{
  "security": {
    "section": "Account security",

    "locked": {
      "title": "Account temporarily locked",
      "subtitle_reason": "Too many failed login attempts.",
      "countdown_label": "Unlock in:",
      "reason_prefix": "Reason:",

      "tag_first": "1st lockout.",
      "tag_second": "2nd consecutive lockout: extended duration.",
      "tag_long": "Long lockout — contact an administrator if needed."
    },

    "rate_limit": {
      "scope_ip": "Too many requests from your IP",
      "scope_email_ip": "Too many attempts for this account",
      "retry": "Try again in {seconds}s."
    }
  },

  "auth": {
    "warnings": {
      "progress": "⚠️ {n} attempt(s) left before automatic 15-minute lockout.",
      "locked_toast": "Account locked — Try again in {duration}",
      "rate_ip_toast": "Too many requests from your IP — Try again in {seconds}s",
      "rate_email_ip_toast": "Too many attempts for this account — Try again in {seconds}s"
    },

    "invalid_credentials": "Invalid credentials.",

    "submit": {
      "locked": "🔒 Unlock in {duration}",
      "rate": "🚦 Wait {seconds}s",
      "loading": "Signing in…",
      "default": "Sign in"
    }
  }
}
```

---

## 11. UX / Accessibilité

### 11.1 UX essentielle à respecter
- **Compte à rebours temps-réel** : `setInterval 1s` + `store.tickLockTimer()` — le chiffre défile, pas un message figé.
- **Bouton submit adaptatif** : texte change selon l'état (normal / loading / lock / rate limit).
- **Effet SHAKE** sur 401 `Identifiants invalides` (anim CSS ou Web Animations API).
- **Password vidé** à chaque 401 (bonne sécurité).
- **Message uniforme 401** — aucune distinction email vs mot de passe.
- **Warning progressif** à partir du 3e échec hint (3 / 4). Jamais au 1er ou 2e échec.
- **Inputs disabled** + `pointer-events-none` sur carte + opacité pendant lock OU rate limit.
- **Clipboard friendly** : pas d'impact lockout, mais laisser Mot de passe oublié **accessible** (pas disabled) — même si locké.
- **Support paste** : mot de passe collé accepté.

### 11.2 Accessibilité
- `<div LockoutBanner role="alert" aria-live="assertive">` — lecteurs d'écran annoncent immédiatement le blocage.
- `<div rateBanner role="alert" aria-live="polite">` — moins urgent.
- Chaque input a un `<label for="id">` + `aria-invalid="true"` si erreur.
- Compte à rebours a `aria-live="polite"` séparé.
- Formulaire a `aria-disabled` quand locké (plus `:disabled` sur chaque input).
- Icône 👁 toggle password a un `aria-label` FR/EN.

---

## 12. Cas limites à tester

| Cas | Comportement attendu |
|---|---|
| User tape 5× faux password → 6e soumission | Backend renvoie **423 ACCOUNT_LOCKED `retry_after_seconds=900`** → banner rouge + compte à rebours 15min démarre + inputs disabled |
| User rafraîchit (F5) pendant que lock est actif | `lock` est persisté par Pinia → banner toujours visible, countdown correct (recalculé depuis `lockedUntil`) |
| User attend 15 min avec page ouverte | `tickLockTimer()` toutes les 1s détecte `Date.now > lockedUntil` → banner disparaît, inputs réactivés |
| Backend décrète 2e blocage → 60 min | `reason + retryAfterSec=3600` → tag affiche « 2ᵉ blocage consécutif : durée augmentée » |
| Backend décrète 3e blocage → 24h | `retryAfterSec=86400` → tag affiche « Blocage long — contactez un administrateur » |
| 20+ requêtes/min depuis même IP (sans être de login) | Middleware rate-limit → 429 `TOO_MANY_REQUESTS_PER_IP` → banner orange + inputs disabled pendant 60s |
| User navigue vers `/forgot-password` pendant lock | Liens de navigation hors form auth **doivent rester accessible** — seul le formulaire de login est disabled |
| Échec sur MFA verify (code totp invalide ×5) | Même flux : à 5 → 423 → banner lockout apparaît SUR LA PAGE MFA |
| User utilise recovery code | Si succès → `store.resetLockState()` appelée |
| `localStorage.clear()` | Perte store → `lock.locked=false`. Pas grave : backend renverra 423 à la prochaine tentative, et le securityBus repopulera le store |

---

## 13. Checklist de livraison Frontend (Lockout uniquement)

- [ ] **apiClient.ts** : intercepteur 423 / 429 + `securityBus` émettant `SecurityEvent`
- [ ] **user.ts (Pinia)** : états `lock` + getters `isLocked / lockRemainingSec / lockRemainingHuman / isRateLimited` + actions `initSecurityBus / bumpFailedHint / resetLockState / tickLockTimer` + persist `lock`
- [ ] **main.ts** : appel `store.initSecurityBus()` après installation Pinia
- [ ] **LockoutBanner.vue** : 2 bannières (rouge lock + orange rate) réutilisables, icônes lucide, `role="alert"`
- [ ] **Signin.vue** : `<LockoutBanner />` + setInterval tick + submit gère 200/202/401/423/429 + shake + warning progressif + submit button adaptatif
- [ ] **MfaChallenge.vue** : `<LockoutBanner />` + gère 423/429 sur `mfa/verify` ET `mfa/email/send` + `resetLockState()` au succès
- [ ] **ReAuthModal.vue** (si présent) : même handling inline
- [ ] **fr.json + en.json** : toutes les clés `security.*` et `auth.warnings.*`
- [ ] **Tests manuels** :
  - [ ] 5× faux login → observe 423 + banner 15min
  - [ ] F5 pendant lock → banner toujours là
  - [ ] Attendre expiration → banner disparaît automatiquement
  - [ ] 429 IP (spam submit) → banner orange 60s
  - [ ] Warning progressif affiché à 3-4 échecs (pas avant)
  - [ ] Message 401 **toujours uniforme** (aucune fuite email)
- [ ] **Build / TS** : `npm run build` + `npm run type-check` — 0 erreur

---

## 14. Mapping Backend → Frontend — référence rapide

| Événement Backend | Lieu catché Frontend | Effet UI |
|---|---|---|
| Login 401 `INVALID_CREDENTIALS` | catch `submitLogin` | `errorMsg`, shake, `bumpFailedHint()`, warning si 3+ |
| Login 200 | try 200 → `resetLockState()` | Banner disparaît si présente, store reset |
| Login 202 | try 202 → `router.push('/mfa-challenge')` | (MFA — autre page) |
| Login 423 `ACCOUNT_LOCKED` | 1. Intercepteur Axios → bus → `store.lock = …` <br> 2. catch submit 423 → toast | **Banner rouge visible** + countdown + inputs disabled |
| Login 429 rate-limit | 1. Intercepteur Axios → bus → `store.lock.rateLimited = …` <br> 2. catch submit 429 → toast | **Banner orange visible** + inputs disabled |
| MFA verify 401 code invalide | catch `submitMfa` | `errorText`, `bumpFailedHint()`, warning si 3+ |
| MFA verify 200 | try 200 → `resetLockState()` | Banner disparaît |
| MFA verify 423 | Intercepteur → bus | Banner rouge **sur la page MFA** |
| MFA email/send 429 | catch → toast + désactiver renvoyer | Bouton "Renvoyer" disabled N secondes |

---

**FIN DU PLAN — Implémentation Lockout Frontend EnjoyAdmin** 🔒
