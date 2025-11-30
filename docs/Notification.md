Gestion des Notifications:
1- creation de la table des notification

Nom du Champ,Type de Donnée,Description,Contraintes/Index
NotificationID,INT (ou BIGINT),Identifiant unique de la notification (Clé Primaire).,PK
TemplateID,INT,Clé étrangère vers la table NotificationTemplates.,FK
RecipientType,VARCHAR(50),"Type de destinataire (e.g., 'GUEST', 'STAFF', 'HOUSEKEEPING', 'MAINTENANCE').",
RecipientID,INT,"Clé étrangère vers la table de l'utilisateur concerné (GuestID, StaffID, etc.). Peut être NULL si diffusé.",Index
RelatedEntityType,VARCHAR(50),"Entité déclencheuse (e.g., 'RESERVATION', 'ROOM', 'WORK_ORDER', 'INVOICE').",
RelatedEntityID,INT,"Clé étrangère vers l'enregistrement déclencheur (e.g., ReservationID, RoomID).",Index
Channel,VARCHAR(20),"Canal utilisé (e.g., 'EMAIL', 'SMS', 'PUSH', 'IN_APP').",
Subject,VARCHAR(255),Sujet de l'e-mail ou titre de l'alerte.,
Content,TEXT,Contenu final du message (après remplacement des variables).,
TimestampSent,DATETIME,Date et heure d'envoi ou de génération.,Index
Status,VARCHAR(20),"Statut d'envoi (e.g., 'SENT', 'FAILED', 'PENDING', 'DELIVERED').",
IsRead,BOOLEAN,Indique si le destinataire l'a consultée,

2- les difference senario des notification et la langue de l'utilistaeur cible: 
| Déclencheur | Cible(s) | Modèle de Message (FR) | Template Message (EN) |
| :--- | :--- | :--- | :--- |
| **Check-in Urgent** | Réception | **VIP ARRIVÉE :** Le client [Nom Client] est arrivé. Statut : [Niveau VIP]. Action immédiate requise. | **VIP ARRIVAL:** Guest [Guest Name] has arrived. Status: [VIP Level]. Immediate action required. |
| **Check-out Non Effectué** | Réception, Ménage | **Retard Départ :** Chambre [N° Chambre] toujours occupée à [Heure]. Vérifier avec le client. | **Late Check-out:** Room [Room #] still occupied at [Time]. Please verify with guest. |
| **Modification Réservation** | Réception | **Modif Résa :** [Réf Réservation] a changé. Nouveau statut : [Statut]. Voir détails. | **Booking Update:** [Booking Ref] changed. New status: [Status]. See details. |
| **Problème de Paiement** | Réception, Compta | **ÉCHEC PAIEMENT :** Carte refusée pour Ch. [N° Chambre] / Client [Nom]. Montant : [Montant]. | **PAYMENT FAILED:** Card declined for Rm [Room #] / Guest [Name]. Amount: [Amount]. |
| **Dépassement Capacité** | Sécurité, Réception | **SÉCURITÉ :** Surcapacité détectée en Ch. [N° Chambre]. Occupants actuels : [Nombre]. | **SECURITY:** Overcapacity detected in Rm [Room #]. Current occupants: [Number]. |
| **Chambre Prête (Clean)** | Réception | **Chambre Prête :** La Ch. [N° Chambre] est PROPRE et disponible pour assignation. | **Room Ready:** Rm [Room #] is CLEAN and available for assignment. |
| **Maint. Requise (Ménage)** | Maintenance | **Demande Maint :** Ch. [N° Chambre]. Problème signalé : [Description Problème]. | **Maint Request:** Rm [Room #]. Reported issue: [Issue Description]. |
| **Objet Oublié (Found)** | Réception, Sécurité | **Objet Trouvé :** Ch. [N° Chambre]. Type : [Catégorie Objet]. Enregistré sous ID #[ID Objet]. | **Item Found:** Rm [Room #]. Type: [Item Category]. Logged as ID #[Item ID]. |
| **Alerte DND (Ne pas déranger)** | Superviseur Ménage | **Alerte DND :** La Ch. [N° Chambre] est toujours en "Ne Pas Déranger" depuis 24h. Vérification requise. | **DND Alert:** Rm [Room #] still on "Do Not Disturb" for 24h. Check required. |
| **Nouveau Bon de Travail** | Technicien | **Nouvelle Tâche :** #[ID Tâche] pour Ch. [N° Chambre]. Priorité : [Haute/Moyenne]. | **New Task:** #[Task ID] for Rm [Room #]. Priority: [High/Medium]. |
| **Statut de Tâche (Fini)** | Réception | **Maint Terminée :** Tâche #[ID Tâche] en Ch. [N° Chambre] résolue. Chambre remise en service. | **Maint Complete:** Task #[Task ID] in Rm [Room #] resolved. Room back in service. |
| **Maint. Préventive** | Chef Maintenance | **Rappel Préventif :** [Nom Tâche] doit être effectuée aujourd'hui. Zone : [Zone/Étage]. | **Preventive Reminder:** [Task Name] due today. Area: [Zone/Floor]. |
| **Chambre Hors Service (OOS)** | Réception, Revenue | **Mise en OOS :** Ch. [N° Chambre] passée Hors Service. Raison : [Raison]. Durée estimée : [X] jours. | **Set to OOS:** Rm [Room #] set to Out of Service. Reason: [Reason]. Est. duration: [X] days. |
| **Inventaire Critique** | Revenue Manager | **Stock Bas :** Attention, plus que [Quantité] chambres disponibles en catégorie [Type de Chambre]. | **Low Inventory:** Warning, only [Quantity] rooms left in category [Room Type]. |
| **Nouvelle Résa Groupe** | Ventes, Réception | **Nouveau Groupe :** [Nom Groupe] confirmé. [Nombre] chambres bloquées du [Date Début] au [Date Fin]. | **New Group:** [Group Name] confirmed. [Number] rooms blocked from [Start Date] to [End Date]. |
| **Parité Tarifaire** | Revenue Manager | **Alerte Tarif :** [OTA Name] vend la Ch. [Type] à [Prix] (Inférieur au tarif direct). | **Rate Alert:** [OTA Name] selling Rm [Type] at [Price] (Lower than direct rate). |
| **Garantie Échue** | Ventes, Compta | **Rappel Acompte :** Paiement dû pour le groupe [Nom Groupe]. Montant : [Montant]. | **Deposit Reminder:** Payment due for group [Group Name]. Amount: [Amount]. |
| **Nouvelle Résa OTA** | Réception, Réservations | **Nouvelle Résa OTA :** Reçu via [Nom OTA]. Réf: [Réf OTA]. Client: [Nom Client]. Arrivée: [Date Arrivée]. | **New OTA Booking:** Received via [OTA Name]. Ref: [OTA Ref]. Guest: [Guest Name]. Arrival: [Arrival Date]. |
| **Modification Résa OTA** | Réception, Réservations | **Modif OTA :** [Nom OTA] Réf: [Réf OTA]. Dates/Chambre modifiées. Vérifier le planning. | **OTA Modification:** [OTA Name] Ref: [OTA Ref]. Dates/Room changed. Check schedule. |
| **Annulation Résa OTA** | Réception, Revenue | **Annulation OTA :** [Nom OTA] Réf: [Réf OTA] annulée. La chambre est de nouveau disponible à la vente. | **OTA Cancellation:** [OTA Name] Ref: [OTA Ref] cancelled. Room is now available for sale. |
| **Erreur de Synchronisation OTA** | Revenue Manager, IT | **Erreur Sync OTA :** Échec de mise à jour pour [Nom OTA]. Code erreur: [Code]. Vérifier la connexion. | **OTA Sync Error:** Update failed for [OTA Name]. Error code: [Code]. Check connection. |