# 🔐 MFA FRONTEND — Implémentation EnjoyAdmin
**Projet cible** : `E:\Documenti\dev\EnjoyAdmin`  
**Backend lié** : `EnjoyBackEnd` (implémentation complète livrée, routes + contrôleurs + services + 5 migrations)  
**Date** : 2026-08-17  
**Auteur** : Analyse + plan d'implémentation

---

## 1. Stack frontend utilisée (déjà présente)

| Couche | Technologie | Usage MFA |
|---|---|---|
| Framework | **Vue 3.5** (Composition API, `<script setup>`) | Tous composants MFA |
| Build | **Vite 6** | |
| Langage | **TypeScript 5.7** | Tous types MFA |
| Store | **Pinia 3** + `pinia-plugin-persistedstate` | Store `auth.ts` : `mfa_challenge_id`, `mfa_pending`, tokens |
| Router | **Vue Router 4.5** | Guard `requiresAuth`, route `/mfa-challenge` |
| HTTP Client | **Axios 1.8** (`src/services/apiClient.ts`) | Client API + intercepteur 429 Retry-After |
| UI | **TailwindCSS 4** + **lucide-vue-next** / **@heroicons/vue** | Composants MFA (icônes 🔐 / 📧 / 📱 / 📋) |
| Toast | **vue-toastification 2** | Messages succés / erreur MFA |
| I18N | **vue-i18n 11** | Clés `mfa.*` (fr.json + en.json) |
| Desktop | **Electron 37** | Pas d'adaptation particulière (web flow suffit) |

---

## 2. Architecture 3 niveaux à implémenter

```
EnjoyAdmin/src/
├── services/
│   ├── apiClient.ts                 (MODIFIER : intercepteur 429 Retry-After + stockage challenge)
│   └── userApi.ts                   (MODIFIER : ajouter fonctions MFA wrappant Axios)
│
├── composables/
│   ├── user.ts                      (MODIFIER : store Pinia auth : états MFA + actions)
│   └── useMfa.ts                    (NOUVEAU : helper QR code display, clipboard, resend timer)
│
├── router/
│   └── index.ts                     (MODIFIER : 2 routes + guard avant /dashboard)
│
├── views/
│   └── Auth/
│       ├── Signin.vue               (MODIFIER : condition 202 → route mfa-challenge)
│       ├── MfaChallenge.vue         (NOUVEAU : Étape 2/3 — TOTP / Email code / Recovery)
│       └── ForgotPassword.vue       (EXISTANT — inchangé)
│
├── components/
│   └── auth/
│       ├── ReAuthModal.vue          (MODIFIER : gérer étape MFA si activé)
│       ├── MfaTotpCodeInput.vue     (NOUVEAU : 6 inputs digit OTP style Authy)
│       ├── MfaEmailCodeInput.vue    (NOUVEAU : 6 digit + bouton "Renvoyer code" avec compte à rebours 60s)
│       ├── MfaRecoveryCodeInput.vue (NOUVEAU : input format XXXX-XXXX + Paste)
│       └── MfaMethodSelector.vue    (NOUVEAU : onglets switcher TOTP / Email / Recovery)
│
├── components/ (profil utilisateur)
│   └── profile/
│       └── ProfileCard.vue          (MODIFIER : lien vers page Settings → Security)
│
├── views/
│   └── Configuration/
│       └── Security/
│           └── MfaSettings.vue      (NOUVEAU : Gestion méthodes MFA, QR, recovery codes)
│
└── lang/translations/
    ├── fr.json                      (MODIFIER : clés `mfa.*` et `security.*`)
    └── en.json                      (MODIFIER : clés `mfa.*` et `security.*`)
```

---

## 3. Flow Login complet (3 étapes, synchro backend EnjoyBackEnd)

### 3.1 Diagramme de séquence

```
Signin.vue         BackEnd EnjoyBackEnd        MfaChallenge.vue        Pinia store
   │                     │                          │                     │
   │ 1 POST /authLogin {email,password}           │                     │
   │─────────────────────▶                         │                     │
   │                     │                          │                     │
   │ ◀──────── 202 Accepted {                      │                     │
   │         mfa_required: true,                   │                     │
   │         mfa_challenge_id: "cuid_abc123",      │                     │
   │         available_methods: [                  │                     │
   │           {id:1,type:"TOTP",is_default:true},│                     │
   │           {id:2,type:"EMAIL",label:"a***@x"} │                     │
   │         ],                                    │                     │
   │         default_method_id: 1                  │                     │
   │      }                                          │                   │
   │  1bis (Si MFA OFF) ◀──────── 200 OK {tokens} ───────────────────── SET tokens
   │                     │                          │                     │
   │ 2 router.push('/mfa-challenge')               │                     │
   │───────────────────────────────────────────────▶ persist challenge  │
   │                                                ├───────────────────── mfa_pending = true
   │                                                │                     mfa_challenge_id = cuid
   │                                                │                     available_methods = […]
   │                                                │                     │
   │                                                │ 3 Choisit méthode + saisit code
   │                                                │  POST /api/mfa/verify
   │◀──────────────────────────────────────────────┤─────────────────────▶
   │                                                │                     │
   │                     │                          │ 401 {error:"INVALID_CODE"} → toast
   │                     ◀──────────────────────────┤ increment attempts
   │                     │                          │
   │                     │                          │ 429 {code:"MFA_SEND_RATE_LIMIT"} → disable btn
   │                     ◀──────────────────────────┤ header Retry-After
   │                     │                          │
   │                     ◀──────── 200 OK {         │                     │
   │                     │   token, refresh_token}  │                     │
   │                     ├──────────────────────────▶                     │
   │                                               SET tokens             │
   │                                               router.push('/dashboard')
   │                                               mfa_pending = false
```

### 3.2 3 réponses backend possibles au Signin

| Réponse HTTP | Corps JSON | Action frontend |
|---|---|---|
| **200 OK** | `{token, refresh_token, user, pms_context, ...}` | Flux classique → store tokens → dashboard |
| **202 Accepted** | `{mfa_required:true, mfa_challenge_id, available_methods, default_method_id}` | Sauvegarde challenge dans store + **`router.push('/mfa-challenge')`** |
| **401 Unauthorized** | `{message:"Identifiants invalides"}` (uniforme email absent/mp faux) | Toast erreur + shake anim |
| **423 Locked** | `{message:"Compte verrouillé", retry_after_seconds:900}` | Alerte block + timer unlock + disable form |
| **429 Too Many Requests** | header `Retry-After: 15` | Désactive inputs 15 secondes + toast rate limit |

### 3.3 Alternatives à l'étape MFA (depuis MfaChallenge.vue)

```
Utilisateur sur /mfa-challenge
     │
     ├─ 📱 TAB TOTP (par défaut si default_method_id.type=TOTP)
     │     MfaTotpCodeInput.vue
     │     └── POST /api/mfa/verify {mfa_challenge_id, code:"123456", method_id?}
     │
     ├─ 📧 TAB EMAIL (par défaut si default_method.type=EMAIL)
     │     ├─ ⚠️ Au montage (si email défaut OU user clique sur onglet Email)
     │     │      → POST /api/mfa/email/send {mfa_challenge_id}
     │     │      → 200 {challenge_id, expires_in_seconds:300}
     │     │      → start timer 60s bouton "Renvoyer"
     │     │
     │     ├─ MfaEmailCodeInput.vue + Compte à rebours 60s
     │     │      └── POST /api/mfa/verify {mfa_challenge_id, code:"123456", method_id?}
     │     │
     │     └─ "Je n'ai pas reçu le code" → POST /mfa/email/send (si timer 60s écoulé, sinon 429 + toast)
     │
     └─ 🛟 TAB "Utiliser un code de récupération"
          MfaRecoveryCodeInput.vue (format XXXX-XXXX, uppercase automatique, dash auto)
          └── POST /api/mfa/recovery/use {email,password,recovery_code:"AB12CD34"}
              └── (retourne tokens si OK)
```

---

## 4. Types TypeScript à ajouter (`src/types/type.ts`)

```ts
// ====== MFA ======
export type MfaMethodType = 'TOTP' | 'EMAIL' | 'SMS';

export interface MfaMethodSummary {
  id: number;
  type: MfaMethodType;
  is_default: boolean;
  is_verified: boolean;
  label: string | null;
  last_used_at: string | null;
}

export interface MfaStep2Payload {
  mfa_required: true;
  mfa_challenge_id: string;
  available_methods: MfaMethodSummary[];
  default_method_id: number | null;
}

export interface MfaRecoveryHint {
  id: number;
  code_hint: string; // ****ABCD
  used_at: string | null;
}

export interface MfaMethodFull {
  id: number;
  type: MfaMethodType;
  is_default: boolean;
  label: string | null;
  last_used_at: string | null;
  created_at: string;
}

export interface MfaProfile {
  mfa_enabled_overall: boolean;
  methods: MfaMethodFull[];
  has_recovery_codes: boolean;
  recovery_codes: MfaRecoveryHint[];
}

export interface TotpSetupResult {
  secret: string;          // Base32 160-bit
  otpauth_url: string;     // otpauth://totp/Enjoy:...
  qr_code_b64: string;     // data:image/png;base64,....
}

export interface ConfirmTotpResult {
  method_id: number;
  recovery_codes: string[]; // 8 codes XXXXXXXX (1× donné à l'user)
}

export interface EmailSendResult {
  challenge_id: string;
  expires_in_seconds: number;
}
```

---

## 5. Store Pinia — modifications `src/composables/user.ts`

### 5.1 Nouveaux états persistés (cookie safe, pas de secrets)

```ts
// ===== À AJOUTER dans useUserStore =====
interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  // +++++++ MFA ÉTATS +++++++
  mfaPending: boolean;
  mfaChallengeId: string | null;
  mfaAvailableMethods: MfaMethodSummary[];
  mfaDefaultMethodId: number | null;
  // Optionnel : mémoriser email/password non (!) - ne JAMAIS stocker le password
  rememberedEmail: string | null;
}

// ===== Nouvelles actions =====
actions: {
  // (1) Appelé depuis Signin.vue si status === 202
  setPendingMfa(payload: MfaStep2Payload, rememberedEmail?: string) {
    this.mfaPending = true;
    this.mfaChallengeId = payload.mfa_challenge_id;
    this.mfaAvailableMethods = payload.available_methods;
    this.mfaDefaultMethodId = payload.default_method_id;
    if (rememberedEmail) this.rememberedEmail = rememberedEmail;
  },

  // (2) Appelé en fin de login (après 200 verify) OU apres recovery use
  clearPendingMfa() {
    this.mfaPending = false;
    this.mfaChallengeId = null;
    this.mfaAvailableMethods = [];
    this.mfaDefaultMethodId = null;
  },

  // (3) Si utilisateur annule (<< retour)
  abortMfa() {
    this.clearPendingMfa();
    this.logout(); // sécurité : clear token
    this.$router.push('/');
  }
}
```

### 5.2 Persistance Pinia

Le plugin `pinia-plugin-persistedstate` doit PERSISTER `mfaPending` + `mfaChallengeId` (rafraîchissement F5 ne doit pas perdre l'étape 2).

```ts
// Dans le store user.ts
persist: {
  pick: [
    'token','refreshToken','user','rememberedEmail',
    // +++ nouveau :
    'mfaPending', 'mfaChallengeId', 'mfaAvailableMethods','mfaDefaultMethodId'
  ],
}
```

---

## 6. Router — modifications `src/router/index.ts`

### 6.1 Nouvelles routes

```ts
// Déjà existant (à conserver)
{ path: '/', name: 'Signin', component: () => import('@/views/Auth/Signin.vue'), meta:{ guest: true } },

// ===== À AJOUTER : =====
{
  path: '/mfa-challenge',
  name: 'MfaChallenge',
  component: () => import('@/views/Auth/MfaChallenge.vue'),
  meta: {
    guest: true,
    // Guard custom : doit avoir mfaPending=true (sinon redirect /)
    async beforeEnter(to, from, next) {
      const userStore = useUserStore();
      if (!userStore.mfaPending || !userStore.mfaChallengeId) return next('/');
      next();
    }
  }
},
// ===== FIN AJOUT =====

// Route dashboard (garde)
{
  path: '/dashboard',
  // meta: { requiresAuth: true },
  // guard beforeEach déjà présent : AJOUTER check
  // if (store.mfaPending) next({name:'MfaChallenge'})
}
```

### 6.2 Guard global `beforeEach`

```ts
router.beforeEach((to, from, next) => {
  const store = useUserStore();
  // (1) routes guest : ok
  if (to.meta.guest) return next();
  // (2) pas token : /
  if (!store.token) return next('/');
  // (3) +++ AJOUT MFA +++ : si user MFA PENDING → bloque accès à tout autre page
  if (store.mfaPending && to.name !== 'MfaChallenge') return next({ name: 'MfaChallenge' });
  next();
});
```

---

## 7. Couche API — modifications `src/services/userApi.ts` + `apiClient.ts`

### 7.1 Intercepteur Axios anti-429 (TOUS les endpoints)

```ts
// Dans src/services/apiClient.ts :
import axios, { AxiosResponse } from 'axios';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

apiClient.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status = err?.response?.status;
    const retryAfter = Number(err?.response?.headers?.['retry-after'] ?? err?.response?.data?.retry_after_seconds);
    // === MFA / LOGIN RATE LIMIT : attendre puis rejeter (interdire retry automatique login) ===
    if (status === 429) {
      if (Number.isFinite(retryAfter) && retryAfter > 0) {
        // Event global pour afficher spinner "trop de requêtes…" :
        window.dispatchEvent(new CustomEvent('mfa:rate-limit', { detail: { retryAfter } }));
      }
      return Promise.reject(err);
    }
    return Promise.reject(err);
  }
);
```

### 7.2 Nouvelles fonctions `userApi.ts`

```ts
// ========== AJOUT DANS userApi.ts ==========
import type {
  MfaProfile, MfaMethodFull, TotpSetupResult, ConfirmTotpResult,
  EmailSendResult, MfaStep2Payload
} from '@/types/type';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// ===== Flow Login ÉTAPE 2/3 : envoyé par Signin.vue si 202 ok =====
//  (1) POST /api/mfa/verify (code totp ou email)
export async function mfaVerify(payload: {
  mfa_challenge_id: string;
  code: string;
  method_id?: number;
}) {
  return apiClient.post(`${API_BASE}/mfa/verify`, payload);
}

//  (2) POST /api/mfa/email/send (demande renvoi code email)
export async function mfaEmailSend(payload: { mfa_challenge_id: string }): Promise<EmailSendResult> {
  const r = await apiClient.post(`${API_BASE}/mfa/email/send`, payload);
  return r.data as EmailSendResult;
}

//  (3) POST /api/mfa/recovery/use (bypass via recovery code)
export async function mfaRecoveryUse(payload: {
  email: string;
  password: string;
  recovery_code: string;
}) {
  return apiClient.post(`${API_BASE}/mfa/recovery/use`, payload);
}

// ===== PROFIL UTILISATEUR MFA (authentifié — Bearer) =====
export async function mfaListMethods(): Promise<MfaProfile> {
  const r = await apiClient.get(`${API_BASE}/mfa/methods`);
  return r.data.data as MfaProfile;
}
export async function mfaTotpSetup(): Promise<TotpSetupResult> {
  const r = await apiClient.post(`${API_BASE}/mfa/totp/setup`);
  return r.data.data as TotpSetupResult;
}
export async function mfaTotpConfirm(payload: {
  code: string;
  secret: string;
  label?: string;
}): Promise<ConfirmTotpResult> {
  const r = await apiClient.post(`${API_BASE}/mfa/totp/confirm`, payload);
  return r.data.data as ConfirmTotpResult;
}
export async function mfaEmailEnable(): Promise<MfaMethodFull> {
  const r = await apiClient.post(`${API_BASE}/mfa/email/enable`);
  return r.data.data as MfaMethodFull;
}
export async function mfaDisableMethod(methodId: number, current_password: string) {
  return apiClient.delete(`${API_BASE}/mfa/methods/${methodId}`, { data: { current_password } });
}
export async function mfaSetDefault(methodId: number): Promise<MfaMethodFull> {
  const r = await apiClient.patch(`${API_BASE}/mfa/methods/${methodId}/default`);
  return r.data.data as MfaMethodFull;
}
export async function mfaRecoveryCodes(): Promise<MfaProfile['recovery_codes']> {
  const r = await apiClient.get(`${API_BASE}/mfa/recovery-codes`);
  return r.data.data as MfaProfile['recovery_codes'];
}
export async function mfaRecoveryRegenerate(current_password: string): Promise<string[]> {
  const r = await apiClient.post(`${API_BASE}/mfa/recovery-codes/regenerate`, { current_password });
  return r.data.data.recovery_codes as string[];
}
```

---

## 8. Composants MFA login flow (nouveaux)

### 8.1 `components/auth/MfaTotpCodeInput.vue`
→ 6 `<input type="text" inputmode="numeric" maxlength="1">` séparés par `-`
→ Auto-focus suivant via `@input` + `nextTick` `el.focus()`
→ Efface BackSpace → input précédent
→ Paste `123-456` → dispatch digits 1→6
→ Submit `@keyup.enter="$emit('submit', code)"`
→ Props `disabled` (rate limit) + `error` (shake anim + border rouge)

### 8.2 `components/auth/MfaEmailCodeInput.vue`
→ Même architecture 6 inputs digit
→ + Bouton secondaire "Renvoyer le code"
→ + Compte à rebours 60s via composable `useCountdown(60)`
→ Si `countdown > 0` : bouton disabled + texte "Renvoyer dans 47s"
→ Si timeout : `$emit('resend')`
→ Toast "Un nouveau code a été envoyé à a***@email.com"

### 8.3 `components/auth/MfaRecoveryCodeInput.vue`
→ Input unique avec v-model avec format auto :
```ts
const code = computed({
  get: () => raw.value.replace(/(.{4})/g,'$1-').replace(/-$/,'').toUpperCase(),
  set: (v) => raw.value = v.replace(/[^A-Za-z0-9]/g,'').substring(0,8)
})
```
→ Masqué par défaut type password, avec bouton 👁 toggle
→ Placeholder `XXXX-XXXX`

### 8.4 `components/auth/MfaMethodSelector.vue`
→ Tabs lucide-vue-next `KeyRoundIcon` (TOTP) / `MailIcon` (EMAIL) / `ShieldAlertIcon` (Recovery)
→ Désactive les tabs non présents dans `mfaAvailableMethods` (ex: si user a que TOTP, Email tab grisée)
→ Onglet par défaut = store.mfaDefaultMethodId

### 8.5 `views/Auth/MfaChallenge.vue` (PAGE)
Structure :
```vue
<template>
  <div class="min-h-screen bg-auth-logo bg-cover …">
    <div class="w-full max-w-md p-8 mx-auto">
      <AppLogo />
      <h2 class="text-2xl font-bold mt-6">Vérification en deux étapes</h2>
      <p class="text-gray-500 text-sm mt-2">
        Bonjour <b>{{ maskedEmail }}</b>, une vérification supplémentaire est requise.
      </p>

      <MfaMethodSelector
        :methods="store.mfaAvailableMethods"
        :default-id="store.mfaDefaultMethodId"
        v-model:active="active"
      />

      <!-- TAB TOTP -->
      <MfaTotpCodeInput
        v-if="active==='TOTP'"
        :error="errorText"
        :disabled="loading"
        @submit="onSubmitTotp"
      />

      <!-- TAB EMAIL -->
      <MfaEmailCodeInput
        v-else-if="active==='EMAIL'"
        :error="errorText"
        :disabled="loading"
        @submit="onSubmitEmail"
        @resend="onResendEmail"
      />

      <!-- TAB RECOVERY -->
      <MfaRecoveryCodeInput
        v-else-if="active==='RECOVERY'"
        :error="errorText"
        :disabled="loading"
        @submit="onSubmitRecovery"
      />

      <button class="w-full mt-4" @click="abort" variant="ghost">
        ← Retour à la connexion
      </button>
    </div>
  </div>
</template>
```

Scripts clés :
```ts
const maskedEmail = computed(() => maskEmail(store.rememberedEmail ?? store.user?.email ?? ''))

async function onSubmitTotp(codeDigits: string[]) {
  await submitMfa('verify', { code: codeDigits.join('') });
}
async function onSubmitEmail(codeDigits: string[]) {
  await submitMfa('verify', { code: codeDigits.join('') });
}
async function onSubmitRecovery(raw: string) {
  // ICI on repasse une nouvelle requête (cf endpoint /recovery/use : besoin email+mdp)
  // Donc REDEMANDE password via prompt modal
  const { password } = await showPasswordModal({ title: "Confirmez votre mot de passe" });
  loading.value = true;
  try {
    const r = await mfaRecoveryUse({ email: store.rememberedEmail!, password, recovery_code: raw });
    await finalizeLogin(r);
  } catch(e){ errorText.value = "Code de récupération invalide"; } finally { loading.value=false; }
}

async function submitMfa(kind:'verify', extra:{code:string, method_id?:number}) {
  loading.value = true; errorText.value = '';
  try {
    const r = await mfaVerify({ mfa_challenge_id: store.mfaChallengeId!, ...extra });
    await finalizeLogin(r);
  } catch (e:any) {
    if (e.response?.status === 401) errorText.value = "Code invalide. Il vous reste X tentatives";
    else if (e.response?.status === 423) { errorText.value = "Compte bloqué"; disableAll(900); }
    else if (e.response?.status === 429) startRateLimitTimer(e.response);
    else errorText.value = "Erreur réseau";
  } finally { loading.value = false; }
}

async function finalizeLogin(res: AxiosResponse) {
  const { token, refresh_token, user } = res.data;
  store.setTokens(token, refresh_token);
  store.setUser(user);
  store.clearPendingMfa();
  useToast().success("Connexion réussie");
  router.push('/dashboard');
}
```

### 8.6 Modification `views/Auth/Signin.vue`
Dans la clause `.then()` / `try` de submit :
```ts
async function submitLogin() {
  try {
    const res = await signIn(payload);
    // +++++++ NOUVEAU MFA CHECK +++++++
    if (res.status === 202) {
      store.setPendingMfa(res.data as MfaStep2Payload, payload.email);
      router.push('/mfa-challenge');
      return;
    }
    // OK : classique
    store.setTokens(res.data.token, res.data.refresh_token);
    ...
  } catch (e:any) {
    if (e.response?.status === 423) {
      lockedSeconds.value = e.response.data.retry_after_seconds;
      showToast("Compte temporairement bloqué…","error");
    } else if (e.response?.status === 429) {
      toastRetryAfter(e.response);
    } else {
      // 401 — message uniforme (ne PAS dire si email existe)
      showInvalidCredentials();
    }
  }
}
```

---

## 9. Profil / Paramètres MFA — page Settings

### 9.1 Route ajoutée

```ts
// router/index.ts
{
  path: '/configuration/securite/mfa',
  name: 'ConfigSecurityMfa',
  component: () => import('@/views/Configuration/Security/MfaSettings.vue'),
  meta: { requiresAuth: true, permission: 'security:mfa:manage' /* ou auth basic suffit */ }
}
```

### 9.2 `views/Configuration/Security/MfaSettings.vue` (NOUVEAU)
→ Onglets : `Activer TOTP` + `Activer Email` + `Codes de récupération`

Structure UI :

```
 ┌── SECURITY / AUTHENTIFICATION 2 FACTEURS ───────────────────────┐
 │  🔐 Statut global : ⚠️ DÉSACTIVÉ        [ Activer maintenant › ] │
 │  ou ✅ 2 méthodes actives (par défaut : 📱 Google Auth)          │
 ├──────────────────────────────────────────────────────────────────┤
 │                                                                   │
 │  📱 APPLICATION AUTHENTIFICATRICE (TOTP)                         │
 │     Ajoutée le 12/05/2026 • Dernière utilisation : 2 min         │
 │     [ Reconfigurer ]  [ Supprimer ]⚠️ [ Définir par défaut ]     │
 │                                                                   │
 │  📧 EMAIL : a***@enjoy.com                                       │
 │     Ajoutée le 12/05/2026 • Dernière utilisation : 3 jours       │
 │     [ Désactiver l'email ]  [ Définir par défaut ]               │
 │                                                                   │
 ├──────────────────────────────────────────────────────────────────┤
 │  🛟 CODES DE RÉCUPÉRATION        (8 codes, usage unique)         │
 │                                                                   │
 │  • Code hint ****AB12 — utilisé 20/06/2026 14:22  (✅ épuisé)    │
 │  • Code hint ****KL90 — jamais utilisé                           │
 │  • Code hint ****X7PP — jamais utilisé                           │
 │  • …                                                              │
 │                                                                   │
 │  [ Régénérer mes 8 codes (⚠️ invalide les anciens) ]             │
 │                                                                   │
 └──────────────────────────────────────────────────────────────────┘
```

#### Flux "Activer TOTP" (2 temps, backend setup → confirm)

```
1. User clique [Activer application auth]
   → POST /mfa/totp/setup → {secret, otpauth_url, qr_code_b64}
   → Affiche MODAL :
        ┌─────────────────────────────────────┐
        │ SCANNEZ CE CODE QR                   │
        │                                     │
        │  [ IMAGE <img :src="qr_code_b64"> ] │
        │                                     │
        │ Impossible de scanner ?             │
        │   ┌─────────────────────────────────┐│
        │   │ Secret : JBSWY3DPEHPK3PXP  📋  ││
        │   └─────────────────────────────────┘│
        │                                     │
        │ Compatibilité : Google Auth,        │
        │   Authy, 1Password, Microsoft Auth… │
        │                                     │
        │ Nom du compte : [ Enjoy App (phone) ]   │
        │                                     │
        │ Saisissez le code à 6 chiffres      │
        │ [1][2][3][4][5][6]  [Confirmer]     │
        └─────────────────────────────────────┘

2. User entre 6 digits + submit
   → POST /mfa/totp/confirm {code,secret,label}
   → 201 Created { recovery_codes: ["AB12CD34","KL90X7PP",…] }
   → Affiche MODAL CRITIQUE (fermeture bloquée tant que case non cochée) :

        ⚠️ CONSERVEZ CES CODES DANS UN ENDROIT SÉCURISÉ
        ┌────────────────────────────────────┐
        │ AB12-CD34   📋 Copier              │
        │ KL90-X7PP   📋 Copier              │
        │ 9ZZP-AX19   📋 Copier              │
        │ …                                    │
        │ [ 📋 Tout copier (presse-papier) ] │
        └────────────────────────────────────┘
        ☐ J'ai conservé ces codes dans un endroit sûr (cocher pour activer)
        [ Activer la double authentification ]
```

---

## 10. I18N — clés `fr.json`

```json
{
  "mfa": {
    "title": "Vérification en deux étapes",
    "subtitle": "Une vérification supplémentaire est requise pour vous connecter.",
    "tabs": {
      "totp": "Application d'authentification",
      "email": "Code par email",
      "recovery": "Code de récupération"
    },
    "totp": {
      "placeholder": "Saisissez le code à 6 chiffres",
      "invalid": "Code invalide. Vérifiez l'heure de votre téléphone.",
      "label_confirm": "Confirmer"
    },
    "email": {
      "sent_to": "Code envoyé à {email}",
      "resend": "Renvoyer le code",
      "resend_in": "Renvoyer dans {seconds}s",
      "not_received": "Vous n'avez pas reçu le code ?",
      "placeholder": "Code à 6 chiffres",
      "expired": "Le code a expiré, cliquez sur Renvoyer"
    },
    "recovery": {
      "placeholder": "Saisissez un code de récupération (XXXXXXXX)",
      "used": "Ce code a déjà été utilisé",
      "modal_title": "Entrez votre mot de passe pour utiliser un code de récupération",
      "warning": "Ces codes ne doivent JAMAIS être partagés."
    },
    "errors": {
      "rate_limit": "Trop de tentatives. Réessayez dans {seconds} secondes.",
      "locked": "Compte bloqué {minutes} minutes. Contactez l'administrateur si nécessaire.",
      "too_many_attempts": "Trop de tentatives erronées. Le code a été invalidé."
    },
    "abort": "← Retour à la connexion",
    "success": "Connexion sécurisée établie !",
    "settings": {
      "title": "Authentification à deux facteurs",
      "enabled": "✅ Double authentification activée",
      "disabled": "⚠️ Double authentification désactivée",
      "method_default": "Défaut",
      "delete": {
        "title": "Supprimer cette méthode ?",
        "body": "Vous perdrez la 2FA s'il s'agissait de la dernière méthode active.",
        "password_required": "Entrez votre mot de passe actuel pour confirmer"
      },
      "totp_setup": {
        "title": "Ajouter une application d'authentification",
        "scan": "Scannez le QR code dans Google Authenticator / Authy / 1Password / Microsoft Authenticator",
        "secret": "Impossible de scanner ? Copiez le secret :",
        "label": "Nom du compte (optionnel) :",
        "placeholder_label": "Ex : Téléphone pro",
        "confirm": "Entrez le code à 6 chiffres affiché dans l'application"
      },
      "recovery": {
        "header": "🛟 Codes de récupération",
        "subtitle": "Utilisez-en un si vous perdez accès à vos autres méthodes. 1 usage max chacun.",
        "regenerate": "Régénérer 8 nouveaux codes",
        "regenerate_confirm": "⚠️ Les anciens codes deviendront inutilisables.",
        "list_used": "Utilisé le {date}",
        "list_never": "Jamais utilisé",
        "download": "💾 Télécharger en .txt"
      }
    }
  },
  "security": {
    "section": "Sécurité du compte",
    "mfa_enabled": "Double authentification",
    "last_login_ip": "Dernière IP :",
    "last_login_device": "Dernier appareil :"
  }
}
```

---

## 11. UX / Accessibilité

### 11.1 UX essentielle
- **Compte à rebours clair** : le bouton Renvoyer affiche **"Renvoyer (59s)"** désactivé, pas juste grisé.
- **Effets visuels erreur** : shake (anim tailwind `animate-shake`) + bordure **rouge** + toast explicite.
- **Auto-focus premier input** dès montage composant OTP.
- **Clipboard friendly** : bouton `📋` sur QR code secret, codes recovery, hint.
- **Support paste** : coller `123456` depuis téléphone → dispatch sur chaque digit.
- **Écran large** : responsive mobile-first (480px max-width) — Electron et navigateur.
- **Masquage Email** : affiche `a***@enjoy.com` (jamais email entier sur écran MFA).

### 11.2 Accessibilité
- Tous inputs OTP ont `aria-label="Chiffre 1 du code MFA"`.
- `<form role="form" aria-labelledby="mfa-title">`.
- Compte à rebours `aria-live="polite"`.
- Focus trap modal quand demande mdp pour disable method.

---

## 12. Cas limites à gérer

| Cas | Comportement |
|---|---|
| Refresh F5 sur `/mfa-challenge` | Chargement challenge depuis Pinia persisté → pas d'erreur. |
| Backend redémarre (challenge row plus en DB) | `verifyMfa` 404 → toast "Session MFA expirée, reconnectez-vous" → `abortMfa()`. |
| User change d'onglet pendant 10 minutes | `expires_at` passé → `verifyMfa` 401 "expiré" → reset inputs + proposition renvoyer email. |
| `localStorage.clear()` | Perte `mfaChallengeId` → guard redirige `/` (OK). |
| 5 échecs successifs verify | Backend renvoie 423 lock 15 min + `retry_after_seconds=900` → boutons disabled + banner compte à rebours 900s. |
| User tape code avant que email soit envoyé (race) | Disable bouton submit pendant que `POST mfa/email/send` n'a pas répondu 200. |
| MFA via recovery (POST /recovery/use prend email+mdp) | MfaChallenge.vue a mémorisé l'email, mais pas password : **modal de demande mdp** avant soumission du recovery. |

---

## 13. Liste des fichiers modifiés + créés (récap)

### 🔧 MODIFIÉS (code existant)
| Chemin EnjoyAdmin | Tâche |
|---|---|
| `src/composables/user.ts` | + états MFA (pending, challenge_id, méthodes), + actions setPending/clear/abort + persist |
| `src/router/index.ts` | + route `/mfa-challenge` + `/configuration/securite/mfa` + guard |
| `src/services/userApi.ts` | + 10 fonctions wrappant endpoints MFA |
| `src/services/apiClient.ts` | + intercepteur 429 + `window.event('mfa:rate-limit', detail)` |
| `src/views/Auth/Signin.vue` | + branchement 202 Accepted → router mfa |
| `src/components/auth/ReAuthModal.vue` | + étape MFA (pattern similaire MfaChallenge en modale inline) |
| `src/components/profile/ProfileCard.vue` | + badge statut 2FA et lien settings/security |
| `src/lang/translations/fr.json` + `en.json` | +150 clés `mfa.*`, `security.*` |
| `src/types/type.ts` | + interfaces MfaMethod/MfaStep2Payload/MfaProfile/... |

### ✨ CRÉÉS (nouveaux)
| Chemin EnjoyAdmin | Tâche |
|---|---|
| `src/views/Auth/MfaChallenge.vue` | Page étape 2/3 login |
| `src/components/auth/MfaTotpCodeInput.vue` | 6 input digit TOTP |
| `src/components/auth/MfaEmailCodeInput.vue` | 6 input email + renvoyer + timer |
| `src/components/auth/MfaRecoveryCodeInput.vue` | XXXX-XXXX |
| `src/components/auth/MfaMethodSelector.vue` | Tabs TOTP/Email/Recovery |
| `src/views/Configuration/Security/MfaSettings.vue` | Gestion profil MFA |
| `src/composables/useMfa.ts` | helper `maskEmail()`, `useCountdown(seconds)`, clipboard wrapper, mask secret |

---

## 14. Checklist de livraison Frontend

- [x] Endpoints backend EnjoyBackEnd livrés (19 routes MFA + 5 migrations)
- [ ] Store Pinia MFA états + persistence OK
- [ ] Guard router /mfa-challenge beforeEnter OK
- [ ] Signin.vue branche 202 → /mfa-challenge OK
- [ ] MfaChallenge.vue (3 tabs + sous-composants) OTP inputs OK
- [ ] Resend email compte à rebours 60s + 429 handle OK
- [ ] Recovery modal password + endpoint recovery/use OK
- [ ] Composables `useMfa.ts` helpers OK
- [ ] Page profil Configuration/Security/MfaSettings.vue :
  - [ ] Setup TOTP (QR + secret copiable)
  - [ ] Confirm 6 digits
  - [ ] Modal regeneration recovery codes (oblige case cochée)
  - [ ] Disable method → prompt password
- [ ] I18N FR/EN 100% OK
- [ ] Accessibilité (labels, aria-live, focus trap) OK
- [ ] Tests unitaires MfaTotpCodeInput (paste, autosuivant, enter submit) vitest
- [ ] Build `npm run build` + `npm run type-check` OK (0 erreur TS)
- [ ] Test E2E scénario : login sans MFA → 200 ; login avec MFA → 202 → /mfa-challenge → TOTP code → 200 dashboard
- [ ] Test scénario lockout : 5× faux code → 423 banner 15 min décompte
- [ ] Test scénario recovery : onglet recovery → code bon → login success + code marqué used

---

## 15. Annexe — Mapping exact Endpoints Backend → Frontend (référence)

| Groupe | Endpoint Backend EnjoyBackEnd | Appel frontend |
|---|---|---|
| **LOGIN ÉTAPE 1** | `POST /api/authLogin` (Signin.vue) | signin() déjà présent + check status 202 |
| **LOGIN ÉTAPE 2** | `POST /api/mfa/verify` | MfaChallenge.vue → submit TOTP/email |
| | `POST /api/mfa/email/send` | MfaChallenge.vue onSendEmail() |
| | `POST /api/mfa/recovery/use` | MfaChallenge.vue → onglet recovery (mdp demandé) |
| **PROFIL MFA** | `GET /api/mfa/methods` | MfaSettings.vue onMounted load overview |
| | `POST /api/mfa/totp/setup` | MfaSettings → setup (affiche QR code) |
| | `POST /api/mfa/totp/confirm` | MfaSettings → confirm 6 digits + recovery codes affichés 1× |
| | `POST /api/mfa/email/enable` | MfaSettings → [Activer par email] |
| | `DELETE /api/mfa/methods/:id` (body `current_password`) | MfaSettings → suppression méthode |
| | `PATCH /api/mfa/methods/:id/default` | MfaSettings → définir défaut |
| | `GET /api/mfa/recovery-codes` | MfaSettings → liste hints + usedAt |
| | `POST /api/mfa/recovery-codes/regenerate` (body `current_password`) | MfaSettings → régénération |

---

**FIN DU PLAN — Implémentation MFA Frontend EnjoyAdmin** 🔐
