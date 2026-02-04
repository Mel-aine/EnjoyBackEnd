# Guide d'Implémentation : Contrôle d'Accès ZKTeco (node-zklib)

Ce document décrit les étapes techniques pour implémenter l'intégration des serrures/terminaux ZKTeco dans l'application EnjoyBackEnd (AdonisJS).

## 1. Prérequis et Installation

La bibliothèque `node-zklib` permet de communiquer avec les terminaux ZKTeco via le protocole UDP/TCP.

### Installation de la dépendance
```bash
npm install node-zklib
```

*Note : Assurez-vous que vos terminaux ZKTeco supportent le protocole de communication utilisé par `node-zklib` (généralement le protocole UDP par défaut).*

---

## 2. Architecture de la Base de Données

Nous devons créer de nouvelles tables pour gérer les portes (terminaux) et les logs d'accès.

### 2.1. Migration : `create_access_control_tables`

Créez un fichier de migration pour ajouter les tables suivantes :

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'doors'
  protected logsTableName = 'door_access_logs'

  public async up() {
    // Table des portes (Terminaux ZKTeco)
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name', 255).notNullable() // Ex: "Porte Chambre 101"
      table.string('ip_address', 45).notNullable().unique() // IP du terminal
      table.integer('port').defaultTo(4370) // Port par défaut ZKTeco
      table.integer('room_id').unsigned().references('id').inTable('rooms').onDelete('SET NULL')
      table.boolean('is_active').defaultTo(true)
      table.timestamp('last_synced_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
    })

    // Table des logs d'accès (Historique)
    this.schema.createTable(this.logsTableName, (table) => {
      table.increments('id')
      table.integer('door_id').unsigned().references('id').inTable('doors').onDelete('CASCADE')
      table.string('user_id_on_device', 50).notNullable() // ID utilisateur sur le terminal
      table.integer('verify_mode').nullable() // Mode de vérification (Finguerprint, Card, etc.)
      table.integer('in_out_status').nullable() // Entrée ou Sortie
      table.timestamp('access_time', { useTz: true }).notNullable()
      table.timestamp('created_at', { useTz: true })
    })
  }

  public async down() {
    this.schema.dropTable(this.logsTableName)
    this.schema.dropTable(this.tableName)
  }
}
```

---

## 3. Modèles (Models)

Créez les modèles Lucid correspondants dans `app/models`.

### `app/models/door.ts`
```typescript
import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Room from '#models/room'
import DoorAccessLog from '#models/door_access_log'

export default class Door extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public name: string

  @column()
  public ipAddress: string

  @column()
  public port: number

  @column()
  public roomId: number

  @column()
  public isActive: boolean

  @column.dateTime()
  public lastSyncedAt: DateTime

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  @belongsTo(() => Room)
  public room: BelongsTo<typeof Room>

  @hasMany(() => DoorAccessLog)
  public logs: HasMany<typeof DoorAccessLog>
}
```

### `app/models/door_access_log.ts`
(À créer de manière similaire avec les champs définis dans la migration)

---

## 4. Service Layer : `ZkAccessService`

C'est le cœur de l'intégration. Créez `app/services/zk_access_service.ts`.

Ce service doit gérer :
1.  La connexion au terminal.
2.  L'envoi des utilisateurs (Check-in).
3.  La suppression des utilisateurs (Check-out).
4.  La récupération des logs.

```typescript
// app/services/zk_access_service.ts
import ZKLib from 'node-zklib'
import Door from '#models/door'

export default class ZkAccessService {
  
  /**
   * Connecte à une porte spécifique et retourne l'instance ZKLib
   */
  private async connect(door: Door) {
    const zk = new ZKLib(door.ipAddress, door.port, 10000, 4000)
    try {
      // Créer la connexion socket
      await zk.createSocket()
      return zk
    } catch (error) {
      console.error(`Impossible de se connecter à la porte ${door.ipAddress}`, error)
      throw error
    }
  }

  /**
   * Ajoute un utilisateur (Guest) au terminal pour l'accès
   */
  public async grantAccess(doorId: number, userId: string, name: string, cardParams?: any) {
    const door = await Door.findOrFail(doorId)
    const zk = await this.connect(door)
    
    try {
      // Exemple d'ajout d'utilisateur (voir doc node-zklib pour setUser)
      // await zk.setUser(userId, '123456', name, cardParams)
      console.log(`Accès accordé à ${name} sur la porte ${door.name}`)
    } finally {
      await zk.disconnect()
    }
  }

  /**
   * Révoque l'accès (Check-out)
   */
  public async revokeAccess(doorId: number, userId: string) {
    const door = await Door.findOrFail(doorId)
    const zk = await this.connect(door)
    
    try {
      // await zk.deleteUser(userId)
      console.log(`Accès révoqué pour ${userId} sur la porte ${door.name}`)
    } finally {
      await zk.disconnect()
    }
  }

  /**
   * Ouvre la porte à distance (Unlock)
   */
  public async unlockDoor(doorId: number) {
    const door = await Door.findOrFail(doorId)
    const zk = await this.connect(door)
    
    try {
      await zk.unlock(10) // Ouvre pendant 10 secondes (selon API)
    } finally {
      await zk.disconnect()
    }
  }
}
```

---

## 5. Intégration Business (Logique Métier)

Il faut connecter ce service aux événements de réservation.

### Check-in (Arrivée)
Dans `app/services/reservation_service.ts` (ou équivalent), lors du check-in :
1.  Récupérer la chambre assignée.
2.  Trouver la `Door` liée à cette `Room`.
3.  Appeler `zkAccessService.grantAccess()` avec les infos du client.

### Check-out (Départ)
Dans `app/services/checkout_service.ts` :
1.  Appeler `zkAccessService.revokeAccess()` pour supprimer les droits d'accès du terminal.

---

## 6. Contrôleurs et Routes API

Créez `app/controllers/access_control_controller.ts` pour la gestion administrative.

```typescript
// Routes (start/routes.ts)
router.group(() => {
  router.post('/doors/:id/unlock', '#controllers/access_control_controller.unlock')
  router.get('/doors', '#controllers/access_control_controller.index')
  router.post('/doors', '#controllers/access_control_controller.store')
}).prefix('api/v1/access-control').use(middleware.auth())
```

---

## 7. Tâches de Fond (Background Tasks)

Utilisez `node-cron` (déjà présent dans le projet) pour synchroniser périodiquement l'heure et les logs.

Créez un fichier `app/tasks/sync_doors_task.ts` (ou structure similaire) :

```typescript
import cron from 'node-cron'
import Door from '#models/door'
import ZkAccessService from '#services/zk_access_service'

export const startDoorSync = () => {
  // Toutes les heures
  cron.schedule('0 * * * *', async () => {
    const doors = await Door.query().where('isActive', true)
    const service = new ZkAccessService()
    
    for (const door of doors) {
      try {
        // Logique de sync des logs ou de l'heure
        // await service.syncLogs(door)
      } catch (e) {
        console.error(`Erreur sync porte ${door.id}`, e)
      }
    }
  })
}
```

## Résumé des Fichiers à Créer/Modifier

1.  `database/migrations/xxxx_create_access_control_tables.ts` (Nouveau)
2.  `app/models/door.ts` (Nouveau)
3.  `app/models/door_access_log.ts` (Nouveau)
4.  `app/services/zk_access_service.ts` (Nouveau)
5.  `app/controllers/access_control_controller.ts` (Nouveau)
6.  `app/services/reservation_service.ts` (Modifier pour Check-in)
7.  `app/services/checkout_service.ts` (Modifier pour Check-out)
