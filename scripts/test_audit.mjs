// Isolated Japa runner: no application boot, scheduler or production connection.
import 'ts-node-maintained/register/esm'
import { configure, run } from '@japa/runner'

configure({
  files: [
    'tests/unit/audit_context.spec.ts',
    'tests/unit/document_prints.spec.ts',
    'tests/unit/audit_clock.spec.ts',
    'tests/unit/audit_schema.spec.ts',
    'tests/unit/audit_middleware.spec.ts',
  ],
  reporters: { activated: ['spec'] },
})
await run()
