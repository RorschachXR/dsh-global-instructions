# dsh-global-instructions

A **Harness Web UI** settings page that reads and saves the *user-global*
instruction file, `$DSH_HOME/AGENTS.md` — the file
`@deepseek-ai/dsh-agent-instructions` loads for every session, the closest
equivalent of Codex's global custom instructions.

Target of this plugin is the **browser Web UI** (`dsh web` / the page at
`http://127.0.0.1:<port>`), not the Electron shell: the client half is a
`window.__ModuleLoader__` bundle declared with `dsh.client.platform: "web"`, and
it registers into the same `settings.section` slot the shipped Settings panel
declares. It touches no desktop-only API (`__DSH_HOST_PATHS__`, preload, IPC).

## Where it appears

Settings → **全局指令** / **Global instructions**, as its own page after the
shipped General / Models / Plugins / Agent presets pages (`order: 60`).

The page shows the resolved file path, a full-height editor for the file, and a
byte counter against the instruction budget (65,536 bytes by default). **Save**
writes the file atomically; **Reload** discards the draft and re-reads the file;
Ctrl/Cmd+S saves. A save above the budget is refused with the measured size
instead of silently truncating.

Because `dsh-agent-instructions` is touch-driven, a save becomes visible to
sessions the same way an external edit does: the next eligible `agent/pre-step`
of a new session loads the file, and an existing session picks it up after a
successful first-party `read`/`write`/`edit` or on resume.

## Package shape

| Face | File | Role |
|---|---|---|
| Host half | `lib/index.js` | Registers the `globalInstructions` service with Cordis `ctx.provide` and the Typert Remote markers; the Gateway's SRC fallback makes it callable. No dependency on dsh packages. |
| Browser half | `lib/client.js` | Hand-written `window.__ModuleLoader__.load` bundle: mounts the Remote contribution, registers the locale dictionary and the Settings section. |
| Bundle layer | `cordis.patch.yml` | Inserts the `global-instructions` Host row. |
| Tests | `test/service.test.mjs`, `test/client.test.mjs` | Host service contract (atomic replace, budget refusal, empty-file semantics, `typertRemote` binding, marker descriptor) and browser-half contract (module entry, contribution, namespace lookup, both halves over a real file). |

### Why the section resolves its namespace with `ctx.get`

The plugin mints `remote.globalInstructions` itself through `ctx.remote.$mount`, so
the namespace is installed in the mount's fiber — a sibling of this plugin's
context, not an ancestor. Cordis resolves ordinary property access
(`ctx.remote.globalInstructions`) only along the accessing fiber's ancestor chain
and otherwise throws `cannot get property "..." without inject`; a plugin cannot
list a namespace it creates in the static `inject` array it must satisfy before
`apply` runs. `ctx.get(name)` is the documented "read a service from the store
without the inject requirement" path, and is the same optional-access seam other
client plugins use (`ctx.get('sessions')` in `dsh-workspace-folder-drop`).
`test/client.test.mjs` enforces this: its fake context throws the Cordis inject
error on property access, so the regression fails in Node instead of only in the
browser.

## Configuration

The row accepts `dshHome` (defaults to `$DSH_HOME` or `~/.dsh`) and `maxBytes`
(defaults to 65536).

## Install

From the profile that should carry it:

```
dsh plugin --profile <profile> add link:<absolute path to this folder>
```

then select the bundle in the profile's `dsh.profile.bundles` (or install it
through the Plugin Manager, which does both).

## Verify

```sh
node test/service.test.mjs   # host service: atomic replace, budget, binding, markers
node test/client.test.mjs    # browser half: module entry, namespace lookup, both halves
```

Both tests use only Node built-ins — no dependencies and no build step.
