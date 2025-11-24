import { BaseSchema } from '@adonisjs/lucid/schema'

export default class FixRoomBlocksStatusCheck extends BaseSchema {
  protected tableName = 'room_blocks'

  public async up() {
    // Normalize existing misspelled values
    await this.schema.raw(`UPDATE "${this.tableName}" SET "status" = 'inProgress' WHERE "status" = 'inProgess'`)

    // Replace the check constraint to allow the correct values
    await this.schema.raw(`ALTER TABLE "${this.tableName}" DROP CONSTRAINT IF EXISTS "room_blocks_status_check"`)
    await this.schema.raw(
      `ALTER TABLE "${this.tableName}" ADD CONSTRAINT "room_blocks_status_check" CHECK (status IN ('pending','inProgress','completed'))`
    )
  }

  public async down() {
    // Revert values to the original (misspelled) form
    await this.schema.raw(`UPDATE "${this.tableName}" SET "status" = 'inProgess' WHERE "status" = 'inProgress'`)

    // Restore the original constraint definition
    await this.schema.raw(`ALTER TABLE "${this.tableName}" DROP CONSTRAINT IF EXISTS "room_blocks_status_check"`)
    await this.schema.raw(
      `ALTER TABLE "${this.tableName}" ADD CONSTRAINT "room_blocks_status_check" CHECK (status IN ('pending','inProgess','completed'))`
    )
  }
}

