# Tests r?els de tra?abilit? ? h?tel 5

Date : 19 novembre 2026. H?tel : MEL 2 HOTEL. Compte authentifi? : Jean Fotsing (ID 4).

## Retrouver la r?servation dans l?interface

R?servation **RES-20261119-UACUO**, ID **740**, client fictif **TEST TRACABILITE AUDIT-20261119-01**. Cr??e le 19/11/2026 pour le s?jour **10?12 f?vrier 2027**. Prolong?e au 13 f?vrier, puis ramen?e au 12 f?vrier. Chambre 201, puis 202.

?tat final : **VOID**. L?affectation de chambre fictive a ?t? supprim?e pour lib?rer le planning. Rechercher dans les r?servations VOID, avec la date de cr?ation du 19/11/2026 ; elle ne figure plus dans le planning actif. Le profil fictif, la r?servation VOID, le folio et les preuves sont conserv?s.

## R?sultats de tra?abilit?

- 39 ?v?nements m?tier de base pour cette r?servation.
- Utilisateur incorrect/manquant : **0**.
- Cible manquante : **0**.
- Identifiant d?op?ration manquant : **0**.
- 2 suppressions trac?es, dont la nuit retir?e et l?affectation de chambre.
- Paiement fictif 3255 et re?u 273 pass?s en VOID.
- Six protections PostgreSQL v?rifi?es : UPDATE/DELETE des journaux, UPDATE/DELETE des PDF, changement de r?f?rence, r?utilisation de r?f?rence. Toutes les op?rations ont ?t? refus?es ; chaque transaction de protection a ?t? termin?e par ROLLBACK.
- Tentative de modification du journal via l?API refus?e avec HTTP 405.

## Versions de facture conserv?es

| Impression | Montant | Auteur | R?f?rence | Empreinte du t?l?chargement identique ? l?archive |
| --- | ---: | --- | --- | --- |
| IMP-0000000001 | 250000 FCFA | 4 | F-5-839-000005 | Oui |
| IMP-0000000002 | 80000 FCFA | 4 | F-5-839-000005 | Oui |

Les deux fichiers exacts et leurs donn?es JSON sont pr?sents dans document_prints. Les heures locales explicites et UTC utilisent l?instant PostgreSQL enregistr?.

## Parcours HTTP ex?cut?s

| Test | Statut HTTP | Identifiant d?op?ration |
| --- | ---: | --- |
| create_reservation_250000 | 201 | ce047587-1f89-4bc8-8041-c036455b24f5 |
| first_pdf_250000 | 200 | 56abb553-29b1-46c7-bc15-6f576f198655 |
| change_rate_to_40000_per_night | 200 | 42d84045-3f1e-41c1-8225-11d4219888ec |
| second_pdf_80000 | 200 | 5c312411-2865-44db-a311-9b4b22a16955 |
| extend_stay_to_three_nights | 200 | 1591af1f-5aa6-44a3-848c-8a2dad261174 |
| move_test_room_201_to_202 | 200 | d4709556-81ef-4177-a302-d935d0dfaf6b |
| create_test_cash_payment | 201 | f8ae5d8d-2f34-4a9e-9ce5-94597d86e94a |
| void_test_payment | 200 | f07a0fae-0a59-4c05-a71f-ed26e5483832 |
| shorten_stay_back_to_two_nights | 200 | 4b54aa68-ba87-4cb0-98f8-2aa96569aa74 |
| reject_edit_of_existing_audit_log | 405 | dc3e43f6-50d5-402b-9e9f-593a056333e3 |
| void_test_reservation | 200 | 1a480724-cc3b-4833-85e4-aeaedfec7f4c |
| delete_voided_test_reservation_room | 200 | e1f8a63b-73ca-44f7-a425-235a816f4345 |
| logout_test_account | 200 | 99f8f0cf-c94c-4f8c-8b96-a6a52abbedef |

## D?fauts identifi?s

1. **Cible du log de demande de r?servation : corrig?e dans le code.** L?ancien log utilisait l?ID utilisateur comme ID de r?servation avant que cette derni?re existe. Le nouveau log RESERVATION_CREATE_REQUESTED cible l?h?tel 5. Une requ?te volontairement invalide, sans cr?ation de r?servation, a confirm? le log 13024 : utilisateur 4, type Hotel, cible 5. Les anciennes traces n?ont pas ?t? r??crites.
2. **?cart de recalcul apr?s amendement : reste ? corriger.** Apr?s prolongation de deux ? trois nuits ? 40 000, la r?servation affiche 126 000 et le folio 120 000. Apr?s r?duction ? deux nuits, la r?servation affiche 84 000 au lieu des 80 000 du folio. La m?thode amendStay additionne des taxes ? un tarif d?j? inclus et divise une taxe journali?re par le nombre de nuits. Cette incoh?rence est effectivement trac?e ; les calculs m?tier n?ont pas ?t? modifi?s dans cette campagne de test.

## P?rim?tre et pr?cautions

Aucune migration relanc?e. Audit activ? uniquement dans le processus local de test ; .env inchang?. T?ches planifi?es et envois externes neutralis?s dans ce processus. Les tentatives de synchronisation Channex ont ?t? bloqu?es avant toute connexion HTTP externe. Aucun document envoy? ? un client. Les r?servations et paiements r?els existants n?ont pas ?t? utilis?s comme donn?es de test.

Les tests couvrent les parcours ci-dessus, pas chaque ?cran ou combinaison de r?gles de l?application. Le check-in/check-out et les remboursements ne sont pas valid?s de bout en bout par cette campagne. Les ?v?nements HTTP_ACTION_STARTED peuvent ?tre anonymes avant l?authentification ; les ?v?nements m?tier et r?sultats authentifi?s sont reli?s par operationId.

Tests isol?s Japa apr?s correction : **19 r?ussis**.
