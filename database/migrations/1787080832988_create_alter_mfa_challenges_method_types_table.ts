import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'mfa_challenges'

  async up() {
    // 1. Suppression de l'ancienne contrainte (si elle existe)
    await this.db.rawQuery(`
      ALTER TABLE ${this.tableName}
      DROP CONSTRAINT IF EXISTS mfa_challenges_method_type_check;
    `)

    await this.db.rawQuery(`
      ALTER TABLE ${this.tableName}
      DROP CONSTRAINT IF EXISTS chk_challenge_method;
    `)

    // 2. Ajout de la nouvelle contrainte CHECK avec la liste des méthodes autorisées
    // (Ajuste les valeurs 'TOTP', 'EMAIL', 'SMS', 'BACKUP_CODE' selon tes besoins)
    await this.db.rawQuery(`
      ALTER TABLE ${this.tableName}
      ADD CONSTRAINT mfa_challenges_method_type_check
      CHECK (method_type IN ('TOTP', 'EMAIL', 'SMS', 'BACKUP_CODE'));
    `)
  }

  async down() {
    // Annulation : suppression de la nouvelle contrainte
    await this.db.rawQuery(`
      ALTER TABLE ${this.tableName}
      DROP CONSTRAINT IF EXISTS mfa_challenges_method_type_check;
    `)

    // Rétablissement de la contrainte originale si nécessaire
    await this.db.rawQuery(`
      ALTER TABLE ${this.tableName}
      ADD CONSTRAINT mfa_challenges_method_type_check
      CHECK (method_type IN ('TOTP', 'EMAIL'));
    `)
  }
}
