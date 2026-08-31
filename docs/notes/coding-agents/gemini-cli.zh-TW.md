---
kind: product-profile
status: reviewed
as_of: 2026-08-31
last_verified: 2026-08-31
upstreams:
  - https://geminicli.com/docs/
  - https://geminicli.com/docs/cli/gemini-md/
  - https://geminicli.com/docs/reference/policy-engine/
  - https://geminicli.com/docs/cli/sandbox/
  - https://geminicli.com/docs/core/subagents/
  - https://github.com/google-gemini/gemini-cli/blob/v0.57.0/packages/cli/src/config/settingsSchema.ts
  - https://developers.google.com/gemini-code-assist/docs/deprecations/code-assist-individuals
  - https://github.com/google-gemini/gemini-cli/releases/tag/v0.57.0
confidence: high
---

# Gemini CLI

## 範圍與介面

Gemini CLI 是 Google 的開放原始碼終端機代理工具 (open-source terminal agent)，用於搭配 Gemini 模型與本機專案上下文。`gemini` 會啟動互動式 REPL；提示也可以位置引數 (positional argument)、`-p/--prompt`、stdin 或非 TTY 的方式傳入。無頭模式 (headless mode) 支援文字、單一 JSON 物件，或串流 JSONL 事件。IDE 輔助整合 (IDE companion integration) 與 ACP 模式則加入編輯器／用戶端 (client) 介面
([概覽](https://geminicli.com/docs/)、
[無頭模式](https://geminicli.com/docs/cli/headless/))。

!!! warning "事實 (Fact) — 消費者存取方式已變更"
    自 2026-06-18 起，以消費者 Google 帳戶進行驗證、用於 Gemini Code Assist for individuals、Google AI Pro 與 Google AI Ultra 的請求，已不再由 Gemini CLI 處理；Google 指示這些使用者改用 Antigravity CLI。該公告並未終止 Standard／Enterprise 存取及付費 API 金鑰驗證 (API-key authentication)
    ([棄用公告](https://developers.google.com/gemini-code-assist/docs/deprecations/code-assist-individuals))。
    持續發布版本不能證明路線圖維持不變，而這次轉換也不能證明專案已終止生命週期 (EOL)。

## 指示與上下文

`GEMINI.md` 是預設的指示檔案。Gemini CLI 會合併全域、工作區/祖先目錄，以及工具進入某一路徑時才探索到的即時上下文 (just-in-time context)，並在受信任的根目錄停止。`/memory show` 會顯示合併後的上下文，`/memory reload` 則會重新掃描；`@file.md` 可匯入其他檔案。`context.fileName` 可設定 `AGENTS.md` 等替代檔案
([GEMINI.md](https://geminicli.com/docs/cli/gemini-md/))。這種持久的階層式上下文 (hierarchical context) 與按需載入的 Agent Skills、自訂 commands 及系統提示覆寫不同。

## 工具與執行

內建功能涵蓋殼層 (shell) 執行；檔案列出、讀取、搜尋、取代與寫入；使用者提問；工作階段待辦事項 (session todos)；實驗性相依性追蹤器 (dependency tracker)；MCP 資源 (resources)；Skill 啟用；Plan Mode；Google 網頁搜尋；以及 URL 擷取。待辦工具 (todo tool) 是工作階段範圍的進度清單，不是持久工作流程；實驗性追蹤器則是另一個工作階段 DAG
([工具](https://geminicli.com/docs/reference/tools/))。

Plan Mode 是以讀取為主的研究／設計工作流程 (workflow)；其預設政策允許特定讀取、研究用 Subagents、Skills、提問、唯讀 MCP，以及計畫目錄 (plan directory) 中的 Markdown。使用者政策可以放寬限制，而已核准的無頭執行會轉為 YOLO，因此 Plan Mode 並非不可變的沙箱
([Plan Mode](https://geminicli.com/docs/cli/plan-mode/))。

## 權限、信任與沙箱 (sandbox)

Policy Engine 會回傳 `allow`、`deny` 或 `ask_user`；讀取通常允許，而寫入與殼層命令則會詢問。`ask_user` 在無頭模式會變成拒絕。核准模式包括 `default`、`autoEdit`、`plan` 與 `yolo`。文件明確表示工作區 `.gemini/policies` 不具功能，因此不應將它們視為保護邊界
([Policy Engine](https://geminicli.com/docs/reference/policy-engine/))。

**事實 (Fact)。** 不可變的 v0.57.0 結構描述 (schema) 未定義舊式全處理程序沙箱機制 (full-process sandboxing)，且工具沙箱機制 (tool sandboxing) 預設為 false。各種沙箱機制可以分別啟用，包括 macOS Seatbelt、容器 (containers)、Windows Native Sandbox、gVisor，以及實驗性的 LXC／LXD
([v0.57.0 結構描述](https://github.com/google-gemini/gemini-cli/blob/v0.57.0/packages/cli/src/config/settingsSchema.ts)、
[sandbox](https://geminicli.com/docs/cli/sandbox/))。不得將此摘要為「預設已置於沙箱中 (sandboxed by default)」。

!!! question "待解問題 (Open question) — 第一方預設值互相衝突"
    Trusted Folders 指南表示資料夾信任預設為停用，但 v0.57.0 結構描述與產生的設定則將
    `security.folderTrust.enabled` 設為 true。這兩項主張均僅適用於各自的來源；本文不會默默選擇任一項作為永恆不變的預設值
    ([Trusted Folders](https://geminicli.com/docs/cli/trusted-folders/))。

信任、政策與沙箱機制相輔相成：信任會在不受信任的資料夾中抑制專案自有設定，政策決定工具能否執行，而沙箱則限制已獲准的執行。採失敗時預設拒絕 (fail-closed) 的信任／A2A 篩選修正於 2026-08-28 合併至 `main`，晚於 v0.57.0；該修正不應歸於此發行版本 ([Pull Request (PR) #29099](https://github.com/google-gemini/gemini-cli/pull/29099))。

## 工作階段 (sessions) 與復原

工作階段會依專案儲存在 `~/.gemini/tmp/<project_hash>/chats/` 下，內容包括提示、回應、工具 I/O 與詞元 (token) 資料。工作階段可以續接，且文件記載的預設清理期為 30 天，清理時也會移除相關計畫 (plans)、追蹤器 (trackers)、輸出 (outputs) 與活動日誌 (activity logs)
([工作階段](https://geminicli.com/docs/cli/session-management/))。檢查點 (checkpointing) 與倒轉 (rewind) 必須啟用，且以 AI 的檔案編輯為核心；殼層副作用與手動編輯不屬於其一般復原模型的涵蓋範圍。

本機對話記錄 (transcripts) 不代表本機推論：提示與上下文會送至所選 Google 服務。匿名使用統計資料預設開啟，且與預設關閉的 OpenTelemetry 分開
([設定](https://geminicli.com/docs/reference/configuration/))。

## 擴充性

**Extensions** 是可安裝的組合包機制 (bundle mechanism)，可提供命令 (commands)、上下文 (context)、Skills、Hooks、Subagents、政策 (policies)、佈景主題 (themes) 與 MCP 伺服器。Agent Skills 會在使用者同意後，以漸進式揭露 (progressive disclosure) 方式提供 `SKILL.md`
([Skills](https://geminicli.com/docs/cli/skills/))。事件驅動的命令 Hooks (command hooks) 可以變更或阻止生命週期操作，並以使用者權限執行。它們並非全都同步：Hook 群組 (groups) 可以同時執行，`PreCompress` 是非同步，而 `SessionEnd` 採盡力而為 (best-effort)。格式不正確的一般標準輸出 (stdout) 可能導致失敗時開放 (fail open)；安全性封鎖必須使用結束碼 (exit code) 2 或有效的拒絕 JSON
([Hooks](https://geminicli.com/docs/hooks/reference/))。

MCP 支援 stdio、SSE 與 Streamable HTTP。直接設定 `trust: true` 會略過該伺服器的確認；這不會讓伺服器成為受信任的沙箱元件
([MCP](https://geminicli.com/docs/tools/mcp-server/))。初版 `@google/gemini-cli-sdk` 支援 Agent、串流、工作階段、指示 (instructions) 與自訂工具，但儲存庫設計筆記並未確立與 CLI 功能相同，且將 Hooks、Subagents、Extensions、ACP 及核准／政策 (approvals/policies) 列為尚未實作，Skills 的狀態則互相矛盾。這是在 [`0bd1d439`](https://github.com/google-gemini/gemini-cli/blob/0bd1d439751478771c45d3d0895a6a9760554bf4/packages/sdk/SDK_DESIGN.md) 對儲存庫設計的觀察 (observation)，而不是受支援功能或穩定性契約。

## 協調與編排 (orchestration)

本機 Subagents 是具獨立提示、上下文迴圈、模型、限制，以及選用工具／MCP 隔離的專業工具。目前文件列出內建與自訂定義、禁止遞迴 Subagent 呼叫，並將 Extension 提供的 Subagents 標為預覽版 (preview)
([Subagents](https://geminicli.com/docs/core/subagents/))。Browser Agent 是不同功能，預設停用。遠端 Agents 使用 A2A；ACP 則將 Gemini CLI 連線至編輯器／用戶端。不得將這些協定混為單一「多 Agent」功能。

## 模型與供應商邊界 (model/provider boundary)

文件記載的存取途徑是 Google 服務／驗證後端：Gemini Code Assist、透過 `GEMINI_API_KEY` 使用的 Gemini Developer API，以及 Vertex AI 憑證。它們並非三種供應商外掛 (provider-plugin) 實作，且文件未記載通用的第三方模型供應商介面
([驗證](https://geminicli.com/docs/get-started/authentication/))。`/model` 與 `--model` 不會控制 Subagent 模型。實驗性本機 Gemma 路由會在本機分類工作，但仍將任務推論送至代管的 Gemini 模型。

## 平台/授權/狀態

Google 建議使用 macOS 15+、Windows 11 24H2+ 或 Ubuntu 20.04+、Node.js 20+、網際網路連線，以及支援的地區
([安裝](https://geminicli.com/docs/get-started/installation/))。Gemini CLI 儲存庫著作 (Work) 採
[Apache-2.0 授權](https://github.com/google-gemini/gemini-cli/blob/v0.57.0/LICENSE)。
該授權不會轉移至代管的 Gemini 服務、模型、商標或 Antigravity。

## 變更訊號

截至資料截點，[v0.57.0](https://github.com/google-gemini/gemini-cli/releases/tag/v0.57.0)
是日期為 2026-08-25 的非預發行 (non-prerelease) 發行版本；
[v0.58.0-preview.0](https://github.com/google-gemini/gemini-cli/releases/tag/v0.58.0-preview.0) 與
[v0.59.0 nightly](https://github.com/google-gemini/gemini-cli/releases/tag/v0.59.0-nightly.20260830.g0bd1d4397) 頻道也在運作中。即時的
[變更日誌頁面](https://geminicli.com/docs/changelogs/latest/)仍將 v0.55.1 稱為「latest stable」，而且數個頁面仍保留轉換前的消費者驗證 (consumer-auth) 文字。因此，發行標籤 (release tags)、即時文件與 `main` 必須分別引述為不同快照。

## 待解問題

**待解問題 (open questions)。** 哪一個穩定發行版本最早包含 v0.57.0 之後的信任修正？信任／沙箱預設值與消費者驗證頁面何時會統一？SDK 將採用何種相容性與功能契約？開發工作整併至 Antigravity 之後，Gemini CLI 將保留何種維護範圍？

## 主要來源

- [Gemini CLI 文件](https://geminicli.com/docs/)
- [Policy Engine](https://geminicli.com/docs/reference/policy-engine/)與 [sandboxing](https://geminicli.com/docs/cli/sandbox/)
- [v0.57.0 設定結構描述](https://github.com/google-gemini/gemini-cli/blob/v0.57.0/packages/cli/src/config/settingsSchema.ts)
- [消費者帳戶棄用公告](https://developers.google.com/gemini-code-assist/docs/deprecations/code-assist-individuals)
- [v0.57.0 發行版本](https://github.com/google-gemini/gemini-cli/releases/tag/v0.57.0)
