/**
 * Browser half of `dsh-global-instructions`.
 *
 * Mounts the `globalInstructions` Remote contribution and registers the
 * **Global instructions** section into the Settings panel, where the user edits
 * and saves the user-global AGENTS.md at any time.
 */
window.__ModuleLoader__.load({
  id: 'dsh-global-instructions',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const React = require('react')
    const h = React.createElement

    const PACKAGE = 'dsh-global-instructions'
    const NS = 'global-instructions'
    const SECTION_ID = 'global-instructions'

    /**
     * A strict codec for a wire field. The browser never executes parameter
     * schemas — the Host validates every received field — so the codec only has
     * to satisfy the strict-input check that keeps source-mode calls off the
     * Client wire.
     */
    const codec = (name) => ({
      mode: 'strict',
      typeSymbol: PACKAGE + '#' + name,
      create: () => ({}),
    })

    /** The two Host methods this plugin exposes to its own Settings page. */
    const CONTRIBUTION = {
      package: PACKAGE,
      descriptors: [
        {
          id: PACKAGE + '#globalInstructions/read',
          service: 'globalInstructions',
          namespace: 'globalInstructions',
          method: 'read',
          invocation: { kind: 'direct' },
          parameters: [],
          result: codec('globalInstructions/read:result'),
        },
        {
          id: PACKAGE + '#globalInstructions/write',
          service: 'globalInstructions',
          namespace: 'globalInstructions',
          method: 'write',
          invocation: { kind: 'direct' },
          parameters: [
            {
              name: 'content',
              wire: 'content',
              source: 'json',
              codec: codec('globalInstructions/write:content'),
            },
          ],
          result: codec('globalInstructions/write:result'),
        },
      ],
    }

    const CSS = ".gi-section{display:flex;flex-direction:column;width:100%;gap:14px;padding:16px 0}.gi-head{display:flex;flex-direction:column;gap:4px}.gi-title{color:var(--dsw-alias-label-primary);font-size:14px;line-height:20px;font-weight:600}.gi-description{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}.gi-path{color:var(--dsw-alias-label-dimmed);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:18px;overflow-wrap:anywhere}.gi-editor{box-sizing:border-box;width:100%;min-height:300px;resize:vertical;padding:10px 12px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;line-height:20px;outline:none}.gi-editor:focus{border-color:var(--dsw-alias-state-business-primary)}.gi-editor::placeholder{color:var(--dsw-alias-label-dimmed)}.gi-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.gi-meta{display:flex;align-items:center;gap:10px;min-width:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}.gi-notice{font-size:12px;line-height:18px}.gi-ok{color:var(--dsw-alias-state-success-primary,var(--dsw-alias-label-secondary))}.gi-error{color:var(--dsw-alias-state-error-primary,#e5484d)}.gi-actions{display:flex;align-items:center;gap:8px}.gi-button{height:28px;padding:0 12px;border-radius:var(--dsw-radius-sm);border:.5px solid var(--dsw-alias-border-l3);background:transparent;color:var(--dsw-alias-label-primary);font-size:12px;line-height:18px;cursor:pointer}.gi-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.gi-button:disabled{cursor:not-allowed;opacity:.4}.gi-primary{border:none;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}.gi-primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}"

    /** Inject this plugin's stylesheet once; class names stay plugin-prefixed. */
    function installStyles() {
      if (typeof document === 'undefined') return
      const tagId = PACKAGE + '/global-instructions.css'
      if (document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') !== null) return
      const tag = document.createElement('style')
      tag.dataset.plugin = PACKAGE
      tag.dataset.pluginCss = tagId
      tag.textContent = CSS
      document.head.appendChild(tag)
    }

    /** UTF-8 byte length of the draft, the unit the instruction budget uses. */
    function byteLength(text) {
      return new TextEncoder().encode(text).length
    }

    /** Local wall-clock time for a save receipt. */
    function formatTime(value) {
      const date = new Date(value)
      return Number.isNaN(date.getTime())
        ? ''
        : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    /**
     * Render the Global instructions settings section.
     * @param props - composed slot props, including the localized `t` and the
     *   `instructionApi` business share.
     * @returns the section element tree.
     */
    function GlobalInstructionsSection(props) {
      const { t, instructionApi } = props
      const [phase, setPhase] = React.useState('loading')
      const [info, setInfo] = React.useState(null)
      const [message, setMessage] = React.useState('')
      const [draft, setDraft] = React.useState('')
      const [dirty, setDirty] = React.useState(false)
      const [busy, setBusy] = React.useState(false)
      const [notice, setNotice] = React.useState(null)

      const load = React.useCallback(async () => {
        setBusy(true)
        setNotice(null)
        try {
          const result = await instructionApi().read()
          if (!result.ok) {
            setPhase('error')
            setMessage(result.error.message)
            return
          }
          setPhase('ready')
          setInfo(result.value)
          setDraft(result.value.content)
          setDirty(false)
        } catch (error) {
          setPhase('error')
          setMessage(String(error && error.message ? error.message : error))
        } finally {
          setBusy(false)
        }
      }, [instructionApi])

      React.useEffect(() => {
        void load()
      }, [load])

      const save = React.useCallback(async () => {
        setBusy(true)
        setNotice(null)
        try {
          const result = await instructionApi().write(draft)
          if (!result.ok) {
            setNotice({ kind: 'error', text: t('saveFailed', { message: result.error.message }) })
            return
          }
          setDirty(false)
          setInfo((current) => ({
            ...(current || {}),
            ...result.value,
            exists: true,
            content: draft,
          }))
          setNotice({ kind: 'ok', text: t('saved') })
        } catch (error) {
          setNotice({
            kind: 'error',
            text: t('saveFailed', { message: String(error && error.message ? error.message : error) }),
          })
        } finally {
          setBusy(false)
        }
      }, [draft, instructionApi, t])

      if (phase === 'loading') {
        return h('div', { className: 'gi-section' }, h('div', { className: 'gi-description' }, t('loading')))
      }

      if (phase === 'error') {
        return h(
          'div',
          { className: 'gi-section' },
          h('div', { className: 'gi-head' }, h('div', { className: 'gi-title' }, t('title'))),
          h('div', { className: 'gi-notice gi-error' }, t('loadFailed', { message })),
          h(
            'div',
            { className: 'gi-actions' },
            h('button', { type: 'button', className: 'gi-button', onClick: () => void load(), disabled: busy }, t('reload')),
          ),
        )
      }

      const used = byteLength(draft)
      const max = info && Number.isFinite(info.maxBytes) ? info.maxBytes : 0
      const over = max > 0 && used > max

      return h(
        'div',
        { className: 'gi-section' },
        h(
          'div',
          { className: 'gi-head' },
          h('div', { className: 'gi-title' }, t('title')),
          h('div', { className: 'gi-description' }, t('description')),
          info && info.path ? h('div', { className: 'gi-path' }, t('path', { path: info.path })) : null,
          info && !info.exists ? h('div', { className: 'gi-path' }, t('missing')) : null,
        ),
        h('textarea', {
          className: 'gi-editor',
          value: draft,
          spellCheck: false,
          placeholder: t('placeholder'),
          'aria-label': t('title'),
          onChange: (event) => {
            setDraft(event.target.value)
            setDirty(true)
            setNotice(null)
          },
          onKeyDown: (event) => {
            if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === 's') {
              event.preventDefault()
              if (!busy) void save()
            }
          },
        }),
        h(
          'div',
          { className: 'gi-bar' },
          h(
            'div',
            { className: 'gi-meta' },
            h('span', { className: over ? 'gi-notice gi-error' : '' }, over
              ? t('counter', { used: used.toLocaleString(), max: max.toLocaleString() }) + ' · ' + t('over')
              : t('counter', { used: used.toLocaleString(), max: max.toLocaleString() })),
            notice ? h('span', { className: notice.kind === 'ok' ? 'gi-notice gi-ok' : 'gi-notice gi-error' }, notice.text) : null,
            !notice && dirty ? h('span', { className: 'gi-notice' }, t('unsaved')) : null,
            info && info.savedAt ? h('span', { className: 'gi-notice' }, t('savedAt', { time: formatTime(info.savedAt) })) : null,
          ),
          h(
            'div',
            { className: 'gi-actions' },
            h('span', { className: 'gi-notice' }, t('shortcut')),
            h('button', { type: 'button', className: 'gi-button', onClick: () => void load(), disabled: busy }, t('reload')),
            h(
              'button',
              { type: 'button', className: 'gi-button gi-primary', onClick: () => void save(), disabled: busy || !dirty || over },
              busy ? t('saving') : t('save'),
            ),
          ),
        ),
      )
    }

    /**
     * Mount the Remote contribution, the locale dictionary, and the settings page.
     * @param ctx - this plugin's Client context.
     */
    async function apply(ctx) {
      installStyles()
      ctx.effect(() => ctx.locale.register(NS, { zh: {"nav":"全局指令","title":"全局 AGENTS.md","description":"这里的指令会注入到每个新会话，对所有工作区生效。项目目录中的 AGENTS.md 优先级更高，可以覆盖这里的内容。","placeholder":"例如：\n- 始终用中文回答\n- 提交信息使用 Conventional Commits","path":"文件位置：{path}","missing":"文件尚不存在，保存后会创建。","counter":"{used} / {max} 字节","over":"已超出指令预算，保存会被拒绝","save":"保存","saving":"保存中…","reload":"重新加载","reloading":"读取中…","loading":"正在读取全局指令…","loadFailed":"读取失败：{message}","saveFailed":"保存失败：{message}","saved":"已保存","unsaved":"有未保存的修改","savedAt":"上次保存：{time}","shortcut":"Ctrl/Cmd + S 保存"}, en: {"nav":"Global instructions","title":"Global AGENTS.md","description":"These instructions are injected into every new session, in every workspace. A project-level AGENTS.md takes precedence over them.","placeholder":"For example:\n- Always answer in Chinese\n- Use Conventional Commits for commit messages","path":"File: {path}","missing":"The file does not exist yet; saving creates it.","counter":"{used} / {max} bytes","over":"over the instruction budget — saving is refused","save":"Save","saving":"Saving…","reload":"Reload","reloading":"Reading…","loading":"Reading global instructions…","loadFailed":"Could not read: {message}","saveFailed":"Could not save: {message}","saved":"Saved","unsaved":"Unsaved changes","savedAt":"Last saved: {time}","shortcut":"Ctrl/Cmd + S to save"} }), 'global-instructions:dictionary')
      await ctx.remote.$mount(CONTRIBUTION)
      const t = ctx.locale.bind(NS)
      /**
       * Read the namespace this plugin minted one line above.
       *
       * The mount installs `remote.globalInstructions` inside its own fiber,
       * which is a child of the `remote` service's context — not an ancestor of
       * this plugin's context. Cordis resolves ordinary property access
       * (`ctx.remote.globalInstructions`) only along the accessing fiber's
       * ancestor chain, so it would throw `cannot get property ... without
       * inject`: the plugin is the namespace's *owner* and cannot list it in the
       * static `inject` array it must satisfy before `apply` ever runs. The
       * shipped client plugins read services the same way when the dependency is
       * not an ancestor — `ctx.get('sessions')` in `dsh-workspace-folder-drop` —
       * which resolves from the shared service store instead.
       * @returns the mounted `globalInstructions` namespace service.
       */
      const namespaceApi = () => {
        const namespace = ctx.get('remote.globalInstructions')
        if (namespace === undefined) {
          throw new Error('the globalInstructions Remote namespace is not mounted')
        }
        return namespace
      }
      ctx.slots.inject('settings.section', () =>
        ctx.slots.register(
          {
            name: 'settings.section',
            id: SECTION_ID,
            order: 60,
            label: () => t('nav'),
            locale: NS,
            inject: () => ({ instructionApi: namespaceApi }),
          },
          GlobalInstructionsSection,
        ),
      )
    }

    exports.inject = ['slots', 'locale', 'remote']
    exports.apply = apply
    return module.exports
  },
})
