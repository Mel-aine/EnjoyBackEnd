# Audit des modifications et des impressions

## État de livraison

Le schéma a été installé par l'utilisateur. **Aucune migration n'a été exécutée ou relancée par l'agent.** Après les tests autorisés sur des données fictives de l'hôtel 5, `AUDIT_TRAIL_ENABLED=true` a été ajouté au `.env` actuel le 19 novembre 2026 pour activer aussi l'audit dans le serveur utilisé par l'interface. L'activation a été vérifiée sur la réservation `RES-20261119-41QJH` : événement `DOCUMENT_GENERATED` 13160, impression `IMP-0000000004`, utilisateur 4, réservation 741 et folio 852. Le mode désactivé reste la valeur par défaut des environnements où cette variable est absente ; n'activer la variable qu'après installation du schéma correspondant.

L'implémentation utilise AdonisJS 6, Lucid, PostgreSQL, Japa et le moteur PDF existant `html-pdf-node`. Aucune nouvelle dépendance, aucun autre moteur de base de données.

## Table unique des impressions : `document_prints`

| Colonne | Contenu |
| --- | --- |
| `id` | Identifiant bigint, alloué par une séquence PostgreSQL |
| `created_at` | Date réelle de création, avec fuseau horaire |
| `user_id` | Compte authentifié ; NULL pour une génération système sans utilisateur |
| `data` | JSON : données source dans `input`, HTML utilisé dans `html`, options effectives dans `options` |
| `print_number` | Numéro unique global, par exemple `IMP-0000000123` |
| `reference` | JSON `{ type, id, number }` : folio, facture, reçu, réservation, rapport… |
| `hotel_id`, `reservation_id`, `folio_id` | Identifiants de rattachement, sans cascade de suppression |
| `document_type`, `template`, `language` | Type du document et variante du rendu |
| `pdf_data` | Octets exacts du PDF remis à l'appelant |
| `sha256` | Empreinte du PDF archivé |
| `operation_id` | Identifiant commun aux événements d'une requête |

Les secrets et certains justificatifs d'identité sont masqués dans le JSON. Le PDF exact est conservé pour permettre la vérification du document réellement produit. Les accès à cette table doivent donc respecter les autorisations des documents d'origine.

Chaque nouvelle génération reçoit un nouveau numéro. Deux éditions d'un même folio ont deux lignes distinctes. Un téléchargement d'un PDF déjà archivé conserve le numéro du fichier original. Un échec de rendu laisse éventuellement un trou dans la séquence et produit `DOCUMENT_GENERATION_FAILED` ; il n'invente pas un PDF réussi.

Le numéro figure au pied de **chaque page**. Les pieds de page personnalisés sont conservés ; une marge minimale est réservée au numéro. La génération/téléchargement d'un fichier ne prouve pas une impression physique.

Les deux services de génération PDF passent par `DocumentAuditService.generate`. Les appels HTML des contrôleurs transmettent également leurs données structurées. Tout nouveau moteur PDF doit être raccordé au même service ; le test de couverture détecte l'ajout d'un import direct de moteur dans l'application.

## Journal des changements

La migration installe des triggers INSERT/UPDATE/DELETE sur les tables publiques existantes, hors tables d'infrastructure et d'audit. Chaque événement conserve :

- les valeurs avant/après et les champs modifiés ;
- le nom de table et l'identifiant, même si la ligne est ensuite supprimée ;
- le compte authentifié, l'origine, le chemin HTTP et l'identifiant d'opération lorsqu'ils sont disponibles ;
- le compte PostgreSQL et l'identifiant de transaction ;
- le rattachement hôtel/réservation lorsque présent ou résoluble.

Le changement et son événement de base sont validés/annulés ensemble dans PostgreSQL. Les requêtes brutes et suppressions en cascade sont également couvertes. Les identifiants historiques de `activity_logs` ne sont plus liés par des clés étrangères destructrices.

Les journaux et impressions sont protégés contre UPDATE, DELETE et TRUNCATE. TRUNCATE des tables métier est refusé : utiliser des DELETE audités. Les identifiants et noms historiques restent disponibles après suppression des utilisateurs/réservations. Un propriétaire PostgreSQL peut toujours modifier/désactiver les triggers ; ce mécanisme ne remplace pas les journaux d'administration du serveur.

Les modifications via un client SQL externe n'ont pas d'utilisateur applicatif authentifié : `Database/System` est enregistré. `rowActorHint` est seulement un indice du dernier utilisateur stocké dans la ligne, jamais une preuve de l'auteur de la suppression. Les tables ajoutées après cette migration nécessitent le réenregistrement des triggers par une migration ultérieure avec `install_business_audit_triggers()`.

Le middleware Adonis conserve aussi les actions HTTP réussies/échouées et un payload masqué limité à 32 Ko. Les journaux d'échec ne contiennent pas le corps des réponses, les fichiers téléchargés ni les en-têtes d'authentification. Les tentatives SQL externes échouées ne peuvent pas être conservées par un trigger annulé avec la transaction ; elles nécessitent les logs PostgreSQL du serveur.

L'adaptateur de contexte ajoute un commentaire à chaque instruction du client PostgreSQL Knex déjà utilisé par Lucid. Aucun état de session n'est partagé entre connexions. Ce point d'intégration interne est couvert par un test sur le client et ses clones transactionnels et doit être revérifié lors d'une mise à jour de Knex.

## Consultation et vérifications ultérieures

Le journal existant accepte `operationId` et les filtres hôtel/réservation. Le header `X-Audit-Operation-Id` permet de retrouver les événements d'une requête. Les événements `DOCUMENT_GENERATED` et `DOCUMENT_SEND_*` contiennent `documentPrintId` et `printNumber`. Un envoi accepté par le fournisseur n'est pas une preuve de réception/lecture par le client.

Le modèle Lucid `DocumentPrint` permet la consultation des impressions ; `pdfData` est exclu de la sérialisation JSON automatique.

`node scripts/test_audit.mjs` exécute les tests Japa isolés, sans démarrer Adonis, son scheduler ou une connexion à la base. La commande Ace `audit:coverage`, à utiliser seulement après installation autorisée, contrôle en lecture seule la présence des triggers. Le déploiement doit inclure une validation PostgreSQL sur une base de test et une vérification visuelle des PDF avant activation. Ces validations SQL n'ont pas été exécutées dans la base de l'utilisateur.

Les anciennes modifications non journalisées et les anciennes versions de PDF ne peuvent pas être reconstruites rétroactivement par cette implémentation.

## Chronologie, références et incidents

Les nouveaux PDF numérotés indiquent l'heure locale avec son fuseau et son décalage UTC, ainsi que l'instant UTC. Leur en-tête de facture, leur pied de page et `document_prints.created_at` proviennent du même instant fourni par PostgreSQL lors de l'allocation du numéro. Le rendu remplace le marqueur d'heure de l'en-tête avant d'archiver le HTML effectivement utilisé. Le JSON conserve `generatedAt` et `clockSource`. Les en-têtes de facture affichent également un fuseau explicite lorsque le nouvel audit est désactivé ; ils utilisent alors l'horloge applicative existante. Les filtres du journal acceptent `timeZone` (Africa/Douala par défaut) : une recherche sur le 18 novembre couvre le jour local entier, avec une borne de fin exclusive.

Une séquence PostgreSQL globale préparée pour les nouvelles références de folio ne revient pas en arrière lors d'un rollback ou d'une suppression. Elle est initialisée au-delà des références connues dans les folios et journaux existants. Le format `F-hôtel-chambre-numéro` est conservé ; le suffixe ne redémarre plus à 1 pour chaque chambre. Les références existantes restent inchangées. Un trigger préparé bloque leur modification et la réutilisation d'une référence présente dans les anciennes traces ou impressions. Les références anciennes supprimées sans aucune trace avant cette installation restent inconnues.

Les suppressions sont journalisées AVANT leur exécution dans la même transaction. Cela préserve les liens hôtel/réservation avant les cascades. Si la suppression est annulée, ces événements sont également annulés. Les événements persistants des parents permettent de rattacher les lignes enfants même après disparition du parent.

Le champ `meta.events` précise les changements métier détectés : paiement, montant, tarif, chambre, dates du séjour, taxes, devise, remise, statut, VOID et annulation. Le filtre `event` du journal permet de les retrouver sans dépendre d'un seul contrôleur.

Chaque requête HTTP produit une tentative `HTTP_ACTION_STARTED`, puis un résultat. Les données d'entrée masquées sont figées avant l'exécution de l'action. L'identité reste conservée si une déconnexion efface ensuite `auth.user`. Si l'enregistrement initial échoue, l'action n'est pas exécutée. Un échec d'enregistrement du résultat est signalé dans les logs serveur sans remplacer la réponse ou l'erreur d'origine.

Les erreurs SQL produisent un événement structuré `DATABASE_QUERY_FAILED` dans les logs serveur, indépendant du rollback de la base. Il contient l'identifiant d'opération, l'utilisateur connu, le code d'erreur et l'heure UTC, sans SQL brut, paramètres, mots de passe ni message SQL potentiellement sensible. La conservation de ces événements dépend de la rétention des logs serveur de l'hébergement ; les triggers ne peuvent pas rendre persistante une écriture annulée avec sa transaction.

La validation hors base compile aussi le SQL préparé à travers le client Knex existant sans l'exécuter. Cela contrôle notamment que ses expressions PostgreSQL ne sont pas interprétées comme des paramètres. Ce contrôle ne remplace pas la validation du schéma sur PostgreSQL avant activation ; aucune migration ni écriture dans la base de l'utilisateur n'a été faite.
