# Guide Utilisateur — Mode Hors-Ligne (Offline)

**Version** : 1.0
**Application** : Enjoy PMS
**Module** : Mode Hors-Ligne

---

## 1. Introduction

Le mode hors-ligne (offline) permet de continuer à utiliser Enjoy PMS même lorsque vous n'avez plus de connexion Internet. Toutes les fonctionnalités essentielles restent disponibles : **check-in**, **check-out**, **création de réservations**, **gestion des clients** et **opérations financières**.

Les données sont automatiquement synchronisées dès que la connexion est rétablie.

---

## 2. Activation

### 2.1 Activation par l'administrateur

Le mode hors-ligne doit être activé pour chaque hôtel par un administrateur :

1. Allez dans **Configuration de l'hôtel**
2. Activez l'option **Mode hors-ligne** dans les paramètres
3. La première fois, un **chargement initial** des données sera effectué (cela peut prendre quelques secondes)

### 2.2 Premier chargement

Au premier accès après activation, une **barre de progression** s'affiche :

```
┌────────────────────────────────────────────┐
│  🔄 Chargement initial des données         │
│                                            │
│  Synchronisation des réservations,         │
│  clients et données de l'hôtel...          │
│                                            │
│  ████████████████░░░░░░░░░  65%            │
│  Veuillez patienter...                     │
└────────────────────────────────────────────┘
```

Ce chargement récupère :
- ✅ Réservations des 30 derniers jours et à venir
- ✅ Clients (jusqu'à 2000)
- ✅ Factures et transactions
- ✅ Chambres et types de chambres
- ✅ Tarifs
- ✅ Configuration (sources de réservation, méthodes de paiement, taxes, etc.)

> ⚠️ **Important** : Ne fermez pas l'application pendant ce chargement.

---

## 3. Indicateurs de Connexion

### 3.1 Badge de statut

Un indicateur est visible dans l'en-tête de l'application :

| Couleur | Statut | Signification |
|---------|--------|---------------|
| 🟢 **Vert** | En ligne | Connexion normale, données synchronisées |
| 🟡 **Jaune** | Synchronisation... | Données en cours de synchronisation |
| 🟠 **Orange** | X en attente | Opérations en attente de synchronisation |
| 🔴 **Rouge** | Hors ligne | Aucune connexion Internet |
| 🔴 **Rouge (clignotant)** | X conflit(s) | Conflits à résoudre |

### 3.2 Notifications toast

Lorsque la connexion change, une notification apparaît en bas à gauche :

- ✅ **"Vous êtes de nouveau en ligne"** — Connexion rétablie, synchronisation automatique
- ⚠️ **"Vous êtes hors ligne"** — Connexion perdue, mode hors-ligne activé

---

## 4. Fonctionnalités Disponibles Hors-Ligne

### 4.1 ✅ Réservations

| Fonction | Disponible hors-ligne ? |
|----------|------------------------|
| Créer une réservation | ✅ Oui (mise en attente) |
| Modifier une réservation | ✅ Oui |
| Check-in | ✅ Oui (priorité haute) |
| Check-out | ✅ Oui (priorité haute) |
| Annuler une réservation | ✅ Oui |
| No-show | ✅ Oui |
| Déplacer une chambre | ✅ Oui |
| Voir les détails d'une réservation | ✅ Oui (données en cache) |

### 4.2 ✅ Clients

| Fonction | Disponible hors-ligne ? |
|----------|------------------------|
| Créer un client | ✅ Oui |
| Modifier un client | ✅ Oui |
| Voir le profil client | ✅ Oui (données en cache) |
| Blacklist | ✅ Oui |

### 4.3 ✅ Facturation (Folios)

| Fonction | Disponible hors-ligne ? |
|----------|------------------------|
| Créer un folio | ✅ Oui |
| Ajouter une transaction | ✅ Oui |
| Paiement | ✅ Oui |
| Transfert de charges | ✅ Oui |
| Clôture de folio | ✅ Oui |
| Voir l'état d'un folio | ✅ Oui (données en cache) |

### 4.4 ✅ Tâches ménagères

| Fonction | Disponible hors-ligne ? |
|----------|------------------------|
| Ordres de travail | ✅ Oui |
| Blocage de chambres | ✅ Oui |
| Statut d'entretien | ✅ Oui |

### 4.5 ❌ Fonctionnalités Non Disponibles Hors-Ligne

| Fonction | Raison |
|----------|--------|
| Impression de documents (PDF) | Nécessite génération serveur |
| Envoi d'emails | Nécessite connexion SMTP |
| WhatsApp | Nécessite connexion réseau |
| Rapports et statistiques avancés | Nécessitent données temps réel |
| Configuration hôtel (paramètres) | Opérations administratives en ligne |

---

## 5. Comment Ça Marche

### 5.1 Consultation des données

Quand vous êtes hors-ligne et que vous consultez une liste (réservations, clients, etc.) :

1. **Enjoy PMS** vérifie d'abord si les données sont disponibles dans le cache local
2. Si oui, les données s'affichent immédiatement 📋
3. Sinon, un message indique que les données ne sont pas disponibles hors-ligne

### 5.2 Création / Modification

Quand vous créez ou modifiez une donnée hors-ligne :

1. **Enjoy PMS** enregistre la modification localement
2. Un indicateur **🟠 "en attente"** apparaît dans l'en-tête
3. L'opération est mise dans une **file d'attente prioritaire**

| Priorité | Type d'opération | Exemples |
|----------|------------------|----------|
| 🔴 10 | Critique | Check-in, check-out, paiement |
| 🟠 7 | Haute | Création réservation, assignation chambre |
| 🟡 5 | Normale | Modification client, notes |
| ⚪ 2 | Basse | Préférences, analytique |

### 5.3 Retour en ligne

Quand la connexion est rétablie :

1. **Synchronisation automatique** déclenchée immédiatement
2. Les opérations en attente sont envoyées au serveur **par ordre de priorité**
3. Les données fraîches du serveur sont **téléchargées** pour mettre à jour le cache local

---

## 6. Gestion des Conflits

### 6.1 Quand un conflit arrive

Un conflit peut survenir si une donnée a été modifiée **à la fois** :
- Sur l'appareil hors-ligne (votre modification)
- Sur le serveur (modification par un autre utilisateur)

### 6.2 Résolution

Une fenêtre s'affiche automatiquement :

```
┌─────────────────────────────────────────────┐
│  ⚠️ Conflit de synchronisation              │
│                                             │
│  Réservation #1234                          │
│                                             │
│  ┌─────────────────┬──────────────────────┐ │
│  │  📱 Version locale│  ☁️ Version serveur  │ │
│  │                    │                      │ │
│  │  Statut: check-in  │  Statut: cancelled   │ │
│  │                    │                      │ │
│  │  [Garder locale]   │  [Garder serveur]    │ │
│  └─────────────────┴──────────────────────┘ │
│                                             │
│  🔀 [Fusionner manuellement]                │
└─────────────────────────────────────────────┘
```

**Trois options :**

| Option | Quand l'utiliser |
|--------|------------------|
| **📱 Garder ma version** | Quand vous êtes sûr que votre modification est correcte |
| **☁️ Garder la version serveur** | Quand la version serveur est plus récente ou correcte |
| **🔀 Fusionner** | Pour combiner les deux versions |

---

## 7. Bonnes Pratiques

### ✅ À faire

- **Vérifiez régulièrement** l'indicateur de connexion dans l'en-tête
- **Patientez** après le retour en ligne le temps que la synchronisation se termine (indicateur 🟡)
- **Vérifiez** que les opérations en attente 🟠 ont bien été traitées avant de fermer l'application
- **Contactez le support** si des conflits persistent après plusieurs synchronisations

### ❌ À éviter

- **Ne fermez pas** l'application pendant le chargement initial
- **N'effectuez pas** la même opération sur deux appareils différents en même temps hors-ligne (risque de conflit)
- **N'ignorez pas** les conflits — ils doivent être résolus pour garantir l'intégrité des données

---

## 8. Questions Fréquentes

### Q: Combien de temps puis-je rester hors-ligne ?

**R:** Le temps que vous voulez. Les données sont stockées localement et la file d'attente conserve toutes les opérations tant qu'elles ne sont pas synchronisées.

### Q: Mes données sont-elles sécurisées hors-ligne ?

**R:** Oui. Les données sont stockées localement dans votre navigateur (IndexedDB) et ne sont accessibles que par l'application. Elles ne sont jamais partagées sans votre connexion.

### Q: Que se passe-t-il si je nettoie le cache du navigateur ?

**R:** Les données hors-ligne seront perdues. Un nouveau chargement initial sera nécessaire lors de la prochaine connexion.

### Q: Puis-je utiliser le mode hors-ligne sur plusieurs appareils ?

**R:** Oui, chaque appareil a son propre cache local. Assurez-vous de synchroniser chaque appareil avant de passer à un autre pour éviter les conflits.

### Q: Les données prennent-elles beaucoup de place ?

**R:** Généralement entre 5 et 50 Mo selon le nombre de réservations et clients. IndexedDB a une capacité de stockage bien supérieure (plusieurs centaines de Mo).

---

## 9. Dépannage

### Problème : "Données non disponibles hors ligne"

**Cause :** La donnée que vous cherchez n'a pas été chargée pendant l'initialisation.

**Solution :**
1. Revenez en ligne
2. Les données manquantes seront chargées automatiquement
3. Ou déclenchez une synchronisation manuelle (bouton dans le menu)

### Problème : La synchronisation ne se termine pas

**Cause :** Conflit non résolu ou erreur réseau persistante.

**Solution :**
1. Vérifiez les conflits dans le menu
2. Résolvez les conflits un par un
3. Contactez le support si le problème persiste

### Problème : L'application rame hors-ligne

**Cause :** Volumineux cache ou trop d'opérations en attente.

**Solution :**
1. Revenez en ligne pour vider la file d'attente
2. Si le cache est trop volumineux, contactez le support

---

## 10. Résumé Visuel

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│   ÉTAT           CE QUE VOUS VOYEZ         CE QUI SE PASSE      │
│                                                                  │
│   🟢 En ligne    ✓ Tout fonctionne         Données temps réel   │
│                                                                  │
│   🟡 Sync...     ⟳ Synchronisation...      Échange de données   │
│                                                                  │
│   🟠 X attente   Opérations en attente     File d'attente       │
│                                                                  │
│   🔴 Hors ligne  Fonctionnalités limitées  Cache local          │
│                                                                  │
│   🔴 Conflit     ⚠️ Conflit à résoudre     Version conflict     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

> **Support** : Pour toute question ou problème, contactez-nous à **support@enjoypms.com**
