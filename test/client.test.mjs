/**
 * End-to-end test for the browser half of `dsh-global-instructions`.
 *
 * The bundle is a `window.__ModuleLoader__.load({ id, factory })` artifact, so
 * this loads it exactly as the Web UI does, hands `factory` a `react` stand-in,
 * and runs the returned `apply` against a fake Client context that reproduces
 * the two Cordis rules this plugin depends on:
 *
 *   - `ctx.get(name)` reads a service from the shared store (no inject needed);
 *   - ordinary property access (`ctx.remote.globalInstructions`) resolves only
 *     along the accessing fiber's ancestor chain, and otherwise throws
 *     `cannot get property "..." without inject`.
 *
 * That second rule is why the section must not read its own namespace through
 * `ctx.remote.*`: the mount installs the namespace in a sibling fiber, so the
 * property access throws even though the service exists. The fake context
 * enforces it, so a regression to `ctx.remote.globalInstructions` fails here
 * instead of only in the browser.
 *
 * The fake `$mount` forwards to the real host service from `lib/index.js`, so the
 * test crosses both halves and a real file on disk.
 */
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { apply as applyHost } from '../lib/index.js'

const NAMESPACE_KEY = 'remote.globalInstructions'

//#region the browser module table

let entry
globalThis.window = {
  __ModuleLoader__: {
    load(candidate) {
      entry = candidate
    },
  },
}

await import('../lib/client.js')
assert.ok(entry !== undefined, 'the bundle registered a module entry')
assert.equal(entry.id, 'dsh-global-instructions')

/** The single non-baseline import the bundle declares. */
const fakeRequire = (name) => {
  assert.equal(name, 'react')
  return { createElement: () => null }
}

const client = entry.factory(fakeRequire)
assert.deepEqual(client.inject, ['slots', 'locale', 'remote'])
assert.equal(typeof client.apply, 'function')

//#endregion

const home = await mkdtemp(join(tmpdir(), 'dgi-client-'))
const file = join(home, 'AGENTS.md')

try {
  //#region the real host half behind a real file

  let host
  applyHost(
    {
      provide(key, value) {
        assert.equal(key, 'globalInstructions')
        host = value
      },
    },
    { dshHome: home, maxBytes: 64 },
  )

  //#endregion

  //#region a Client context that enforces the Cordis rules

  const services = new Map()
  const registrations = []
  let mounted

  const locale = {
    register(namespace, dictionary) {
      assert.equal(namespace, 'global-instructions')
      assert.deepEqual(Object.keys(dictionary).sort(), ['en', 'zh'])
      return () => {}
    },
    bind(namespace) {
      return (key, params) => {
        const text = key
        if (params === undefined) return text
        return Object.entries(params).reduce((out, [name, value]) => out.replaceAll(`{${name}}`, value), text)
      }
    },
  }

  const slots = {
    inject(key, callback) {
      assert.equal(key, 'settings.section')
      callback()
      return () => {}
    },
    register(options, component) {
      assert.equal(options.name, 'settings.section')
      assert.equal(options.id, 'global-instructions')
      assert.equal(typeof options.label, 'function')
      assert.equal(options.locale, 'global-instructions')
      registrations.push({ options, component })
      return () => {}
    },
  }

  /**
   * The `remote` service. A mounted namespace is readable through `ctx.get`
   * only: property access throws the Cordis inject error, because this plugin
   * mints the namespace itself and cannot declare it in its static `inject`.
   */
  const remote = new Proxy(
    {
      async $mount(contribution) {
        assert.equal(contribution.package, 'dsh-global-instructions')
        assert.deepEqual(
          contribution.descriptors.map((descriptor) => `${descriptor.namespace}/${descriptor.method}`),
          ['globalInstructions/read', 'globalInstructions/write'],
        )
        for (const descriptor of contribution.descriptors) {
          for (const parameter of descriptor.parameters) {
            assert.equal(parameter.codec.mode, 'strict', 'the Client contribution declares strict inputs')
          }
        }
        // The wire envelope the Client Remote returns: `{ ok, value }` / `{ ok, error }`.
        mounted = {
          async read() {
            return { ok: true, value: await host.read() }
          },
          async write(content) {
            try {
              return { ok: true, value: await host.write(content) }
            } catch (error) {
              return { ok: false, error: { message: error.message } }
            }
          },
        }
        services.set(NAMESPACE_KEY, mounted)
        return async () => {}
      },
    },
    {
      get(target, property, receiver) {
        if (Reflect.has(target, property)) return Reflect.get(target, property, receiver)
        throw new Error(`cannot get property "remote.${String(property)}" without inject`)
      },
    },
  )

  const ctx = {
    remote,
    locale,
    slots,
    effect(callback) {
      const dispose = callback()
      return typeof dispose === 'function' ? dispose : () => {}
    },
    get(name) {
      return services.get(name)
    },
  }

  //#endregion

  await client.apply(ctx)

  assert.equal(registrations.length, 1, 'the settings section registered once')
  const { options, component } = registrations[0]
  assert.equal(component.name, 'GlobalInstructionsSection')
  assert.equal(options.order, 60)

  // The renderer composes the inject face into the section props.
  const props = options.inject()
  assert.deepEqual(Object.keys(props), ['instructionApi'])
  const api = props.instructionApi()

  // 1. Reading an absent file reports the resolved path and no content.
  const before = await api.read()
  assert.equal(before.ok, true)
  assert.equal(before.value.path, file)
  assert.equal(before.value.exists, false)
  assert.equal(before.value.content, '')
  assert.equal(before.value.maxBytes, 64)

  // 2. Saving writes the real user-global file.
  const saved = await api.write('be concise\n')
  assert.equal(saved.ok, true)
  assert.equal(saved.value.bytes, 'be concise\n'.length)
  assert.equal(await readFile(file, 'utf8'), 'be concise\n')

  // 3. The over-budget failure arrives as a gate failure, not a thrown call.
  const rejected = await api.write('x'.repeat(65))
  assert.equal(rejected.ok, false)
  assert.match(rejected.error.message, /above the 64-byte instruction budget/)
  assert.equal(await readFile(file, 'utf8'), 'be concise\n')

  // 4. The locale dictionary covers every key the section asks for: `t` here is
  //    the raw key, so a missing dictionary entry is silent, and this is the
  //    regression guard for the counter/notice copy.
  const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
  const zhText = source.slice(source.indexOf('zh: {'), source.indexOf('en: {'))
  const enText = source.slice(source.indexOf('en: {'))
  for (const key of ['nav', 'title', 'description', 'placeholder', 'path', 'missing', 'counter', 'over', 'save', 'saving', 'reload', 'loading', 'loadFailed', 'saveFailed', 'saved', 'unsaved', 'savedAt', 'shortcut']) {
    assert.ok(zhText.includes(`"${key}":`), `the zh dictionary defines ${key}`)
    assert.ok(enText.includes(`"${key}":`), `the en dictionary defines ${key}`)
  }

  // 5. A regression to property access fails with the Cordis inject error.
  assert.throws(() => ctx.remote.globalInstructions, /without inject/)
  assert.equal(ctx.get(NAMESPACE_KEY), mounted)

  console.log('dsh-global-instructions: browser half contract ok')
} finally {
  await rm(home, { recursive: true, force: true })
  delete globalThis.window
}
