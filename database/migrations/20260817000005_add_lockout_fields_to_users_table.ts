import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    const hasCol = async (name: string) => {
      return await this.schema.hasColumn(this.tableName, name)
    }

    const add = [] as Array<{ name: string; apply: (t: any) => void }>

    if (!(await hasCol('login_attempts_count'))) {
      add.push({
        name: 'login_attempts_count',
        apply: (t) => t.integer('login_attempts_count').notNullable().defaultTo(0).index(),
      })
    }
    if (!(await hasCol('last_failed_login_at'))) {
      add.push({
        name: 'last_failed_login_at',
        apply: (t) => t.timestamp('last_failed_login_at', { useTz: true }).nullable().index(),
      })
    }
    if (!(await hasCol('locked_until'))) {
      add.push({
        name: 'locked_until',
        apply: (t) => t.timestamp('locked_until', { useTz: true }).nullable().index(),
      })
    }
    if (!(await hasCol('lock_reason'))) {
      add.push({
        name: 'lock_reason',
        apply: (t) => t.string('lock_reason', 255).nullable(),
      })
    }
    if (!(await hasCol('last_login_ip'))) {
      add.push({
        name: 'last_login_ip',
        apply: (t) => t.string('last_login_ip', 45).nullable(),
      })
    }
    if (!(await hasCol('last_login_user_agent'))) {
      add.push({
        name: 'last_login_user_agent',
        apply: (t) => t.string('last_login_user_agent', 512).nullable(),
      })
    }

    if (add.length > 0) {
      this.schema.alterTable(this.tableName, (table) => {
        for (const entry of add) {
          entry.apply(table)
        }
      })
    }
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('last_login_user_agent')
      table.dropColumn('last_login_ip')
      table.dropColumn('lock_reason')
      table.dropColumn('locked_until')
      table.dropColumn('last_failed_login_at')
      table.dropColumn('login_attempts_count')
    })
  }
}
