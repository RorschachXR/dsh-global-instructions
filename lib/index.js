/**
 * Host half of `dsh-global-instructions`.
 *
 * Owns the `globalInstructions` Remote namespace: the Settings page in the Web
 * client reads and replaces the user-global instruction file
 * (`$DSH_HOME/AGENTS.md`, the file loaded by @deepseek-ai/dsh-agent-instructions
 * for every session).
 *
 * The service is registered through plain Cordis APIs (`ctx.provide`) and marks
 * its Remote methods with the Typert marker descriptor, so the package needs no
 * dependency on the dsh installation and no generated artifact: the Gateway's
 * SRC fallback resolves it from the prototype markers.
 */
import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

/** Stable prototype property the Typert protocol reads Remote markers from. */
const REMOTE_METHODS = '@deepseek-ai/dsh-typert-protocol/remote-methods'
/** Budget of the shipped agent-instructions plugin; used when this bundle states none. */
const DEFAULT_MAX_BYTES = 65536
const TRANSIENT_RENAME_CODES = new Set(['EACCES', 'EBUSY', 'EPERM'])

/** Resolve the harness home exactly as the shipped agent-instructions plugin does. */
function resolveDshHome(explicit) {
  if (typeof explicit === 'string' && explicit.length > 0) return explicit
  const fromEnv = process.env.DSH_HOME
  if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv
  return join(homedir(), '.dsh')
}

/** UTF-8 byte length, the unit the instruction budget is expressed in. */
function byteLength(text) {
  return Buffer.byteLength(text, 'utf8')
}

/** Replace the file through a same-directory rename so readers never see a partial write. */
async function replaceFile(file, content) {
  const temp = `${file}.${process.pid.toString(36)}.${Date.now().toString(36)}.tmp`
  await writeFile(temp, content, { encoding: 'utf8' })
  let failure
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await rename(temp, file)
      return
    } catch (error) {
      failure = error
      if (!TRANSIENT_RENAME_CODES.has(error?.code)) break
      await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)))
    }
  }
  await unlink(temp).catch(() => {})
  throw failure
}

/** User-global instruction file access, exposed to the browser as `remote.globalInstructions`. */
class GlobalInstructionsService {
  /**
   * @param {object} ctx - owning Cordis context.
   * @param {object} [config] - this bundle's row config (`dshHome`, `maxBytes`).
   */
  constructor(ctx, config) {
    this.ctx = ctx
    this.dshHome = resolveDshHome(config?.dshHome)
    this.file = join(this.dshHome, 'AGENTS.md')
    const configured = Number(config?.maxBytes)
    this.maxBytes = Number.isSafeInteger(configured) && configured > 0 ? configured : DEFAULT_MAX_BYTES
    this.typertRemote = { service: this, serviceKey: 'globalInstructions', namespace: 'globalInstructions' }
  }

  /**
   * Read the current user-global instruction file.
   * @returns the file path, existence, full text, byte size, and budget.
   */
  async read() {
    let content = ''
    let exists = false
    let modifiedAt = null
    try {
      const [text, info] = await Promise.all([readFile(this.file, 'utf8'), stat(this.file)])
      content = text
      exists = true
      modifiedAt = info.mtime.toISOString()
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
    return {
      path: this.file,
      exists,
      content,
      bytes: byteLength(content),
      maxBytes: this.maxBytes,
      modifiedAt,
    }
  }

  /**
   * Replace the user-global instruction file. An empty string keeps an empty
   * file rather than deleting it, so the Settings page can express "no
   * instructions" without racing a later read.
   * @param {string} content - complete next file content.
   * @returns the written path, byte size, and save time.
   */
  async write(content) {
    if (typeof content !== 'string') throw new TypeError('content must be a string')
    const bytes = byteLength(content)
    if (bytes > this.maxBytes) {
      throw new Error(`content is ${bytes} bytes, above the ${this.maxBytes}-byte instruction budget`)
    }
    await mkdir(dirname(this.file), { recursive: true })
    await replaceFile(this.file, content)
    return {
      path: this.file,
      bytes,
      maxBytes: this.maxBytes,
      savedAt: new Date().toISOString(),
    }
  }
}

/** Declaration-order Remote markers the Gateway's source-mode fallback reads. */
Object.defineProperty(GlobalInstructionsService.prototype, REMOTE_METHODS, {
  configurable: true,
  value: {
    version: 1,
    methods: [
      { method: 'read', invocation: { kind: 'direct' } },
      { method: 'write', invocation: { kind: 'direct' } },
    ],
  },
})

/**
 * Register the instruction service for this profile.
 * @param {object} ctx - owning Cordis context.
 * @param {object} [config] - this bundle's row config.
 */
export function apply(ctx, config) {
  const service = new GlobalInstructionsService(ctx, config)
  ctx.provide('globalInstructions', service)
}
