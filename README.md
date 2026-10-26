# dsh-global-instructions

English | [简体中文](#简体中文)

A **Settings → Global instructions** page in the DeepSeek Harness Web UI that reads and saves the
user-global instruction file `$DSH_HOME/AGENTS.md` — the file injected into every new session.

## What you get

- **Settings → Global instructions**: the resolved file path, a full-height editor, and a byte
  counter against the instruction budget (65,536 bytes by default).
- **Save** writes the file atomically; **Reload** discards the draft and re-reads it;
  <kbd>Ctrl/Cmd</kbd>+<kbd>S</kbd> saves.
- A save over the budget is refused and reports the measured size instead of truncating silently.
- The text applies to **every new session in every workspace**. A project-level `AGENTS.md`
  takes precedence over it.
- An existing session picks the change up the same way it picks up an external edit: lazily, on
  a later model step, or on resume.

## Install

Requires the browser Web UI (`dsh web`) or the Desktop app — both profiles are separate, so
install into the one you use.

From the client: **Plugins** → install → paste

```
github:RorschachXR/dsh-global-instructions
```

Or from a terminal:

```sh
dsh plugin --profile web add github:RorschachXR/dsh-global-instructions
```

Restart the host afterwards. On the Desktop app, install from **Settings → Plugins** rather
than the CLI, which does not change the app's profile while it is running.

## Configuration (optional)

| Field | Default | Meaning |
|---|---|---|
| `dshHome` | `$DSH_HOME` or `~/.dsh` | Harness config root; its `AGENTS.md` is the edited file |
| `maxBytes` | `65536` | Instruction budget; a longer save is refused |

## Uninstall

```sh
dsh plugin --profile web remove dsh-global-instructions
```

Your `AGENTS.md` is left untouched.

---

## 简体中文

DeepSeek Harness Web UI 里的一页 **设置 → 全局指令**，用来读写**用户全局**指令文件
`$DSH_HOME/AGENTS.md`——也就是注入到每个新会话的那份文件。

### 开启后你会得到

- **设置 → 全局指令**：显示解析后的文件路径、占满高度的编辑器，以及对照指令预算
  （默认 65,536 字节）的字节计数。
- **保存**原子写入；**重新加载**丢弃草稿并重新读取；<kbd>Ctrl/Cmd</kbd>+<kbd>S</kbd> 保存。
- 超出预算的保存会被拒绝并给出实测字节数，不会悄悄截断。
- 内容对**所有工作区的新会话**生效。项目目录里的 `AGENTS.md` 优先级更高，会覆盖这里的内容。
- 已存在的会话按与外部编辑相同的方式生效：稍后的模型步骤或恢复会话时才重新读取。

### 安装

需要浏览器 Web UI（`dsh web`）或桌面应用——两者 profile 各自独立，装到你用的那一个。

在客户端里：**插件** → 安装 → 粘贴

```
github:RorschachXR/dsh-global-instructions
```

或在终端：

```sh
dsh plugin --profile web add github:RorschachXR/dsh-global-instructions
```

装好后重启 host。桌面应用请从 **设置 → 插件** 安装，而不是命令行——应用运行时 CLI
不会改动它的 profile。

### 配置（可选）

| 字段 | 默认值 | 含义 |
|---|---|---|
| `dshHome` | `$DSH_HOME` 或 `~/.dsh` | harness 配置根，其下 `AGENTS.md` 就是被编辑的文件 |
| `maxBytes` | `65536` | 指令预算，超出的保存会被拒绝 |

### 卸载

```sh
dsh plugin --profile web remove dsh-global-instructions
```

你的 `AGENTS.md` 不会被删除。

> 已在 DSH 0.2.1-rc.3 上安装验证。
