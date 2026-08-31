# Discord OpenCode Remote

This directory pins and deploys a managed Kimaki bot. Discord project channels
map to local working directories and threads map to isolated OpenCode sessions.

## 架構與程式碼導覽

這套服務不是從零重寫 Discord bot，而是以固定版本的
`kimaki@0.26.0` 作為 Discord／OpenCode 協調核心，再由本目錄補上可重現的
patch、安全隔離、常駐服務、健康檢查、部署與回滾。這個責任邊界很重要：

- 本專案維護的是整合與營運層：`start-kimaki.sh`、`patch-kimaki.mjs`、
  `deploy.sh`、`healthcheck.mjs`、launchd 設定及資料庫整理工具。
- Discord 事件、OpenCode session 與回應分派的核心來自 Kimaki，安裝後位於
  `node_modules/kimaki/dist/`。
- 不直接手改安裝後的 `dist`；所有必要變更集中在 `patch-kimaki.mjs`，並在
  `npm install` 的 `postinstall` 階段重播。
- patch 只接受 `0.26.0`。上游版本不符時直接失敗，避免把舊 patch 靜默套到
  不相容的新程式碼。

### 主要程式碼

```text
Discord bot/
├── package.json                    # 鎖定 Kimaki 版本與 postinstall patch
├── start-kimaki.sh                 # 乾淨環境、驗證、隔離與啟動參數
├── patch-kimaki.mjs                # 本機功能及安全修補的唯一來源
├── deploy.sh / rollback.sh         # 原子部署與回滾
├── healthcheck.mjs / watchdog.sh   # 功能健康檢查與故障恢復
├── com.solomon.kimaki.plist        # macOS launchd 常駐服務
└── node_modules/kimaki/dist/
    ├── discord-bot.js              # Discord MessageCreate 與 thread 路由
    ├── opencode.js                 # 啟動 opencode serve、建立 SDK client
    ├── session-handler/
    │   ├── thread-session-runtime.js   # prompt、session、queue、event 分派
    │   └── global-event-listener.js    # OpenCode SSE 全域事件流
    └── discord-utils.js            # Discord Markdown 與 2,000 字分段
```

### 執行拓樸

```text
macOS launchd
  └─ start-kimaki.sh
      └─ Kimaki Node.js process
          ├─ discord.js Gateway / REST
          ├─ ~/.kimaki/discord-sessions.db
          ├─ localhost Hrana DB bridge
          └─ opencode serve（localhost 隨機 port）
              ├─ OpenCode HTTP JSON API
              ├─ /global/event SSE stream
              ├─ Kimaki OpenCode plugins
              └─ 隔離的 OpenCode XDG／SQLite 狀態
```

所有專案共用一個本機 `opencode serve` process，但每次 SDK request 都帶入
工作目錄；Discord project channel 對應本機目錄，Discord thread 則對應一個
OpenCode session。

### 一次訊息的完整路徑

1. Discord Gateway 送出 `MessageCreate`，入口是
   `node_modules/kimaki/dist/discord-bot.js:331`。
2. Bot 依序檢查 guild allowlist、自己的訊息、channel 是否綁定本機專案，
   以及使用者的 owner／admin／Manage Server／`Kimaki` role 權限。
3. Project channel 的新訊息會建立 Discord thread；既有 thread 則載入原本的
   OpenCode session。對應關係持久化在 `discord-sessions.db`。
4. 前處理階段解析回覆內容、mention、文字附件、圖片、PDF 與語音訊息。
5. `thread-session-runtime.js:2291-2368` 將使用者文字、Discord metadata、
   system prompt、附件、agent 與 model 組成 OpenCode request。
6. `session.promptAsync(request)` 透過 OpenCode SDK 發出 HTTP request：
   `POST /session/{sessionID}/prompt_async`。
7. OpenCode 執行模型及工具，再由 `/global/event` 以 Server-Sent Events
   推送 session、文字與工具事件。
8. `global-event-listener.js:130-210` 維持一條全域 SSE 連線；每個 thread
   runtime 再依 session ID 過濾屬於自己的事件。
9. 完成的文字交給 `discord-utils.js:486-534`，保留 Markdown/code fence，
   並依 Discord 的 2,000 字限制分段送回原 thread。

```text
Discord MessageCreate
        │
        ▼
guild／role／channel 權限檢查
        │
        ▼
Discord channel → 本機專案目錄
Discord thread  → OpenCode session
        │
        ▼
session.promptAsync() ── HTTP + JSON ──► opencode serve
        ▲                                      │
        │                                      │ model / tools
        └──── session events ◄──── SSE ─────────┘
        │
        ▼
Markdown 整理、2,000 字分段、送回 Discord thread
```

### 關鍵程式片段

Discord 訊息入口先做 admission control，而不是收到訊息就直接交給模型：

```js
discordClient.on(Events.MessageCreate, async (message) => {
  if (!isAllowedGuildId(message.guildId)) return
  if (isSelfBotMessage && !isCliInjectedPrompt) return

  const channelConfig = await getChannelDirectory(owningChannelId)
  if (!channelConfig) return

  const member = await resolveGuildMessageMember(message)
  if (!hasKimakiBotPermission(member, message.guild)) return

  // 通過檢查後才交給對應的 thread/session runtime。
})
```

Kimaki 在本機啟動一個共用 OpenCode server，並以 project directory 建立 SDK
client。實作入口是 `node_modules/kimaki/dist/opencode.js:639-790`：

```js
const serverProcess = spawn(spawnCommand, spawnArgs, {
  cwd: os.homedir(),
  env: {
    ...process.env,
    OPENCODE_CONFIG: opencodeConfigPath,
    OPENCODE_PORT: port.toString(),
    KIMAKI: "1",
  },
})

const client = createOpencodeClient({
  baseUrl,
  directory,
  headers: getOpencodeServerAuthHeaders(),
})
```

送給 OpenCode 的資料不只有聊天文字，也包含這次 Discord turn 的執行上下文：

```js
const parts = [
  { type: "text", text: promptWithImagePaths },
  { type: "text", text: syntheticContext, synthetic: true },
  ...images,
]

const request = {
  sessionID: session.id,
  directory: this.sdkDirectory,
  parts,
  system: getOpencodeSystemMessage({
    sessionId: session.id,
    channelId,
    guildId: this.thread.guildId,
    threadId: this.thread.id,
  }),
  ...(resolvedAgent ? { agent: resolvedAgent } : {}),
  ...(modelField ? { model: modelField } : {}),
}

await waitForGlobalEventListener()
await getClient().session.promptAsync(request)
```

回應不是解析 CLI stdout，而是訂閱 OpenCode 的 typed event stream：

```js
const subscribeResult = await client.global.event({ signal })

for await (const event of subscribeResult.stream) {
  dispatchEvent(event)
}
```

SSE 中斷時會以 exponential backoff 重連，從 500 ms 增加至最多 30 秒。

### Session、狀態與並行

- 一個 Discord thread 通常對應一個 OpenCode session，因此對話可以跨訊息延續。
- 不同 thread 有獨立 runtime，可以並行執行；同一 thread 的狀態變更會序列化，
  避免 event、queue 與 session transition 互相踩資料。
- 完整 OpenCode 對話存放在隔離的 OpenCode SQLite；thread/session mapping、
  model 選擇及已送出的 part mapping 存放在 Kimaki SQLite。
- 已送出的 OpenCode part 會記錄其 Discord message mapping，重連後可避免重複傳送。
- 顯式的本機 per-thread queue 是記憶體狀態，process restart 後不保留；這是目前
  已知的恢復邊界。

### 安全邊界

- `start-kimaki.sh` 使用 `env -i` 建立環境變數白名單，避免 launchd 或互動 shell
  的任意變數滲入服務。
- OpenCode API 只監聽 localhost 隨機 port，並要求私有 Basic Auth credential。
- Bot 使用固定 Discord guild allowlist，channel 還必須存在本機 project mapping。
- `--restrict-directories` 讓模型離開目前專案前必須取得額外許可。
- Bot 的 OpenCode XDG 目錄與桌面／Tailscale OpenCode 完全分離；啟動器拒絕
  symlink，並檢查 `opencode.db`、WAL、SHM 是否與共用實例指向相同 inode。
- `umask 077`、目錄 `0700` 及 credential `0600` 限制其他本機帳號讀取狀態。
- `--no-analytics`、`--no-critique` 與 `--no-auto-upgrade` 分別關閉產品分析、
  外部 diff critique，以及未經測試的自動升級。

這不是 sandbox。獲授權的 Discord 使用者能透過 `!` 或 `/run-shell-command`
執行此 macOS 帳號可執行的 shell command；因此 Discord 帳號、server role 與
bot token 都必須視為主機存取憑證。

### 給工程師的一句話

這是一個以 Kimaki 作為 transport 與 session orchestration core 的 Discord
遠端 OpenCode runtime：本專案釘死上游版本，透過可重播 patch 客製行為，再補上
guild allowlist、XDG／SQLite 隔離、localhost Basic Auth、launchd supervision、
functional health check、原子部署與 rollback。

## Runtime

- Kimaki: `0.26.0`
- Sharp security override: `0.35.3`
- Node.js: `24.15.0`
- Bun: `1.3.12`
- OpenCode: `/opt/homebrew/bin/opencode`
- Kimaki state and Discord credentials: `~/.kimaki/`
- Kimaki OpenCode state: `~/.local/share/solomon-kimaki/opencode/`
- Default Discord model: `github-copilot/gpt-5.6-sol`

The launcher uses `umask 077`, so newly created credentials and logs default to
owner-only access.

Install dependencies:

```sh
npm install
```

Start the interactive setup or run the configured bot:

```sh
./start-kimaki.sh
```

The launcher intentionally enables:

- `--restrict-directories`: ask before leaving the active project.
- `--no-critique`: do not upload diffs to an external review service.
- `--no-analytics`: disable Kimaki product analytics.
- `--no-auto-upgrade`: keep the tested version pinned.

It does not enable `--allow-all-users`. Initially, only the owner of the private
Discord server should have access.

The runtime also enforces a fixed guild allowlist. Being a Discord server owner
or administrator is not sufficient unless the server ID is explicitly allowed.
The health endpoint becomes unhealthy when no allowlisted server is connected.
The localhost OpenCode API requires a private Basic Auth credential, and its
database retains only sessions referenced by Discord threads or scheduled work.

## Discord Setup

1. Create a private Discord server used only for this bot.
2. Open <https://discord.com/developers/applications> and create an application.
3. In **Bot**, enable **Message Content Intent**.
4. Reset and copy the bot token when the Kimaki setup wizard requests it.
5. Never paste the token into Discord, this repository, or an OpenCode prompt.
6. Use the install URL printed by Kimaki to add the bot to the private server.

## Projects

Register the two initial project directories after onboarding:

```sh
./node_modules/.bin/kimaki project add "/Users/solomon/Skill training"
./node_modules/.bin/kimaki project add "/Users/solomon/every thing can be quant/第一性原理/不再被騙系統"
```

Kimaki creates one Discord channel per directory. Switch project by switching
channel; start a separate task by posting a new channel message. Continue a task
inside its thread.

This installation applies a version-checked local patch after `npm install`.
Discord's `/add-project` can accept an absolute path, browse a path prefix, or
search folder names under the home directory and mounted volumes. Projects are
created only when requested; subfolders are not pre-created as channels.
The command and its autocomplete can be used from any channel in the allowed
private server, including a channel that is not yet linked to a project.

Examples in Discord's `/add-project` field:

- `TOEIC`: search matching folder names.
- `/Users/solomon/`: browse folders in the home directory.
- `/Volumes/`: browse mounted disks.
- `/absolute/path/to/folder`: use an exact directory as the project root.

Folder choices end in `/`. Select a folder, then reopen the `project` field to
browse its children. Submit at any level to create that folder's project channel.
One- or two-character searches use fast top-level matching; longer searches add
Spotlight results. If deep search times out, top-level matches remain available.

## Background Service

`com.solomon.kimaki.plist` is installed under `~/Library/LaunchAgents/`. It
starts Kimaki when this macOS user logs in and restarts it after failures. Logs
are written to `~/.kimaki/launchd.log` and `~/.kimaki/launchd-error.log`.

The deployed runtime is isolated from this Git working tree under
`~/.local/share/solomon-kimaki/releases/`. `current` points at the active
release and `previous` provides rollback. Deploy a verified release with:

```sh
./deploy.sh
```

The watchdog checks Kimaki, Discord, and OpenCode every five minutes. It only
restarts after two consecutive failures and rotates each service log at 10 MB.
The OpenCode check performs a real session query instead of trusting the shallow
global health endpoint.

Management commands:

```sh
kimaki-remote status
kimaki-remote restart
kimaki-remote logs
kimaki-remote doctor
kimaki-remote deploy
kimaki-remote rollback
```

Switch from the shared Gateway bot to your own Discord application with:

```sh
kimaki-remote setup-self-hosted
```

The command validates the Bot token before downtime, backs up the database,
accepts the token using hidden terminal input, opens the authorization URL, and
verifies functional health before finishing. `kimaki-remote use-gateway` only
stops the current Bot after confirming that saved Gateway credentials exist.

Do not run two writing sessions concurrently against `Skill training`: its
workflow pulls, commits, and pushes at the end of each training round.

## Security Boundary

A user who can operate Kimaki can run shell commands on this Mac through `!` or
`/run-shell-command`. Treat the Discord account, server owner role, `Kimaki`
role, and bot token as machine-access credentials.

Keep the existing Tailscale OpenCode service as a fallback. Kimaki starts its
own localhost OpenCode server on a separate random port and separate XDG data
directory. It never shares `opencode.db`, WAL, or SHM files with the desktop or
Tailscale service on port `4096`.
