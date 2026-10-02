/**
 * Functional test for the host half of `dsh-global-instructions`.
 *
 * Runs the real `apply()` against a fake Cordis context and a temporary
 * `dshHome`, then exercises the read/write contract the Settings page relies on:
 * the atomic replace, the budget refusal, the empty-file semantics, and the
 * Typert binding shape the Gateway validates before dispatch.
 */
import assert from 'node:assert/strict'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { apply } from '../lib/index.js'

const REMOTE_METHODS = '@deepseek-ai/dsh-typert-protocol/remote-methods'

/** Apply the plugin against a capturing fake context and return its service. */
function mount(config) {
  let service
  apply(
    {
      provide(key, value) {
        assert.equal(key, 'globalInstructions')
        service = value
      },
    },
    config,
  )
  return service
}

const home = await mkdtemp(join(tmpdir(), 'dgi-'))
const file = join(home, 'AGENTS.md')

try {
  const service = mount({ dshHome: home, maxBytes: 64 })

  // 1. Missing file reads as an absent, empty instruction set.
  const before = await service.read()
  assert.deepEqual(
    { path: before.path, exists: before.exists, content: before.content, bytes: before.bytes, maxBytes: before.maxBytes, modifiedAt: before.modifiedAt },
    { path: file, exists: false, content: '', bytes: 0, maxBytes: 64, modifiedAt: null },
  )

  // 2. A save creates the file and is read back byte-for-byte (UTF-8).
  const text = 'hello 世界\n'
  const saved = await service.write(text)
  assert.equal(saved.path, file)
  assert.equal(saved.bytes, Buffer.byteLength(text, 'utf8'))
  assert.equal(saved.maxBytes, 64)
  assert.ok(Number.isFinite(Date.parse(saved.savedAt)))

  const after = await service.read()
  assert.equal(after.exists, true)
  assert.equal(after.content, text)
  assert.equal(after.bytes, Buffer.byteLength(text, 'utf8'))
  assert.ok(Number.isFinite(Date.parse(after.modifiedAt)))

  // 3. An over-budget save is refused and leaves the previous content intact.
  await assert.rejects(() => service.write('x'.repeat(65)), /65 bytes, above the 64-byte instruction budget/)
  assert.equal((await service.read()).content, text)

  // 4. A non-string payload is refused.
  await assert.rejects(() => service.write(42), TypeError)

  // 5. An empty string keeps an existing empty file rather than deleting it.
  await service.write('')
  const empty = await service.read()
  assert.equal(empty.exists, true)
  assert.equal(empty.content, '')
  assert.equal(empty.bytes, 0)

  // 6. The atomic replace leaves no temporary sibling behind.
  assert.deepEqual(await readdir(home), ['AGENTS.md'])

  // 7. The Gateway binding and Remote markers have the exact shape it validates.
  assert.deepEqual(service.typertRemote, {
    service,
    serviceKey: 'globalInstructions',
    namespace: 'globalInstructions',
  })
  const marker = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(service), REMOTE_METHODS)?.value
  assert.equal(marker?.version, 1)
  assert.deepEqual(marker?.methods, [
    { method: 'read', invocation: { kind: 'direct' } },
    { method: 'write', invocation: { kind: 'direct' } },
  ])

  // 8. `DSH_HOME` is the fallback home, and the row config wins over it.
  process.env.DSH_HOME = home
  assert.equal(mount(undefined).file, file)
  assert.equal(mount({ dshHome: join(home, 'other') }).file, join(home, 'other', 'AGENTS.md'))

  console.log('dsh-global-instructions: host service contract ok')
} finally {
  await rm(home, { recursive: true, force: true })
}
