---
kind: product-profile
status: reviewed
as_of: 2026-08-31
last_verified: 2026-08-31
upstreams:
  - https://code.claude.com/docs/en/overview
  - https://code.claude.com/docs/en/platforms
  - https://code.claude.com/docs/en/how-claude-code-works
  - https://code.claude.com/docs/en/memory
  - https://code.claude.com/docs/en/tools-reference
  - https://code.claude.com/docs/en/permissions
  - https://code.claude.com/docs/en/sandboxing
  - https://code.claude.com/docs/en/sessions
  - https://code.claude.com/docs/en/data-usage
  - https://code.claude.com/docs/en/zero-data-retention
  - https://code.claude.com/docs/en/features-overview
  - https://code.claude.com/docs/en/agents
  - https://code.claude.com/docs/en/agent-view
  - https://code.claude.com/docs/en/workflows
  - https://code.claude.com/docs/en/agent-sdk/overview
  - https://code.claude.com/docs/en/feature-availability
  - https://github.com/anthropics/claude-code/blob/v2.1.251/LICENSE.md
  - https://api.github.com/repos/anthropics/claude-code/releases/latest
confidence: high
---

# Claude Code

> **編者分類 (Editorial classification)：** 本文將 Claude Code 描述為具有多種操作介面的代理式 (agentic) 程式開發產品與代理工具框架 (harness)。這項分類以文件為依據，不是基準評測結果或安全認證。

## 範圍與操作介面

Claude Code 是環繞 Claude 模型的代理工具框架，負責蒐集脈絡 (context)、選擇動作、叫用工具並驗證結果。它不是 Claude 模型或服務本身。第一方操作介面 (surfaces) 包括終端機命令列介面 (command-line interface, CLI)、VS Code 與 JetBrains 整合、Desktop，以及可透過網頁與行動裝置存取的 Cloud 或 Remote Control 工作階段 (sessions)。Anthropic 表示這些介面採用相同的底層引擎，但這是架構陳述，不代表功能對等、共用歷程或設定完全相同。CLI 被描述為**在終端機原生工作方面**最完整的操作介面；指令碼操作與 Claude Agent SDK 只在 CLI 提供，功能更豐富的用戶端則提供其他工作流程 (workflows)（[概覽](https://code.claude.com/docs/en/overview)、[平台](https://code.claude.com/docs/en/platforms)）。

執行位置是另一個獨立面向。本機工作階段會操作使用者的電腦；Cloud 工作階段使用 Anthropic 管理的虛擬機器 (virtual machines, VMs) 或組織營運的環境；Remote Control 則讓執行與檔案存取留在本機，同時由遠端使用者介面 (user interface, UI) 控制該工作階段。Remote Control 既不是雲端 VM，也不構成隔離機制：連線期間，流量會透過傳輸層安全性協定 (Transport Layer Security, TLS) 經由 Anthropic 傳輸，逐字稿則儲存在 Anthropic 的伺服器上（[運作方式](https://code.claude.com/docs/en/how-claude-code-works)、[安全性](https://code.claude.com/docs/en/security)）。

## 指示與脈絡

持久保存且由人員編寫的指引，來自受管理、使用者、專案與本機的 `CLAUDE.md` 檔案。上層目錄的檔案會在啟動時載入，下層目錄的檔案則在讀取相關路徑時載入；找到的檔案會串接，而不是視為單純覆寫。`.claude/rules/*.md` 可無條件套用，也可限定路徑。自動記憶 (auto memory) 以儲存庫為範圍、儲存在個別電腦本機，且屬於脈絡指引，而非政策強制執行機制（[記憶](https://code.claude.com/docs/en/memory)）。

脈絡也包含對話歷程、檔案與工具結果、技能 (Skills)，以及模型情境協定 (Model Context Protocol, MCP) 的中繼資料 (metadata)。Claude Code 會清除較舊的工具結果，並壓縮過長的對話；壓縮 (compaction) 會遺失資訊，因此需長期保留的要求應寫入受版本控制的指示與持久成品 (durable artifacts)，而不能只留在對話初期的回合（[脈絡視窗 (context window)](https://code.claude.com/docs/en/context-window)）。Cloud 工作階段採用已提交的專案設定和受管理政策，不會採用開發者電腦上尚未提交的使用者設定或專案本機設定。

## 工具與執行

[工具參考資料](https://code.claude.com/docs/en/tools-reference)是一份**依條件適用的目錄 (conditional catalog)**，並不保證每個工作階段都有所有工具。它涵蓋檔案編輯與搜尋、Bash、網頁存取、程式碼智慧 (code intelligence)、互動、任務 (tasks)、工作樹 (worktrees)、排程、Skills、子代理工具 (subagents)、訊息傳遞與工作流程。可用性會因操作介面、平台、供應商、模型、版本、設定與工作階段範圍而異。例如，語言伺服器協定 (Language Server Protocol, LSP) 功能需要程式碼智慧外掛程式 (code-intelligence plugin) 與語言伺服器執行檔，且不會在 Cloud 工作階段中啟用；排程任務預設僅限工作階段，而不是持久的系統 cron 工作。

內建檔案工具與 Bash 採用不同的強制執行路徑。命令會在使用者的環境中執行，且可能造成外部影響；工具輸出與擷取的內容仍是不受信任的輸入。

## 權限／信任／沙箱 (sandbox)

權限規則依 `deny`、`ask`、`allow` 的先後順序解析；負責強制執行的是 Claude Code，而不是模型或 `CLAUDE.md`。模式包括 Manual、`acceptEdits`、`plan`、`auto`、`dontAsk` 與 `bypassPermissions`。`auto` 會使用分類器，其行為取決於方案、模型、供應商與操作介面；它不是安全保證。`bypassPermissions` 僅適用於外層已隔離的環境，而且明確的 deny 規則仍會套用（[權限](https://code.claude.com/docs/en/permissions)、[權限模式](https://code.claude.com/docs/en/permission-modes)）。

由作業系統強制執行的沙箱會在受支援的 macOS、Linux 與 WSL2 設定中限制 Bash 及其子程序。它不會直接限制 Read/Edit/Write 或電腦操作工具 (computer-use tools)，在原生 Windows 與 WSL1 上無法使用，預設允許廣泛讀取，而且通常不檢查 TLS。Anthropic 明確指出，它不是完整的隔離邊界（[沙箱](https://code.claude.com/docs/en/sandboxing)）。對工作區 (workspace)、MCP、外掛程式及專案事件鉤子 (project hooks) 的信任是彼此獨立的決策；沒有任何提示注入 (prompt injection) 防禦是完整的。

## 工作階段與復原

CLI 工作階段預設會持續儲存為 `~/.claude/projects/` 下的純文字 JSONL。恢復操作會沿用同一個工作階段 ID；`/branch` 或 `--fork-session` 則會將歷程複製到新的工作階段。同時開啟同一個工作階段而不建立分支副本 (fork)，可能使訊息交錯；CLI、Desktop、網頁與 VS Code 各自維護不同的歷程儲存區（[工作階段](https://code.claude.com/docs/en/sessions)）。

檢查點 (checkpoints) 可以還原對話，以及透過 Claude 檔案編輯工具所做的編輯。它們不是 Git，也不涵蓋 Bash 變更、大多數子代理工具所做的編輯、同時發生的外部變更、部署、資料庫或 API 副作用（[檢查點機制 (checkpointing)](https://code.claude.com/docs/en/checkpointing)）。

## 擴充性

官方用語的區別很重要：`CLAUDE.md` 與規則 (rules) 提供脈絡；Skills 封裝按需取用的指示與資源；Hooks 處理生命週期事件；MCP 提供外部工具／資料；Plugins 則封裝並散布元件（[擴充性概覽](https://code.claude.com/docs/en/features-overview)）。Hooks 並非都能作為具確定性的強制執行機制：命令／HTTP／MCP 處理常式 (handlers)、由模型支援的提示詞處理常式或實驗性的代理工具處理常式，以及依事件而異的阻擋能力、盡力比對 (best-effort matching) 和逾時後開放通過 (fail-open) 行為，都有所不同（[Hooks](https://code.claude.com/docs/en/hooks)）。

MCP 支援 Streamable HTTP、已棄用的伺服器傳送事件 (Server-Sent Events, SSE)、標準輸入輸出 (stdio) 與 WebSocket，且各傳輸方式有不同限制。WebSocket 不支援 OAuth 與清單列舉 (listing)；ToolSearch 結構描述延遲載入 (schema deferral) 通常會啟用，但可能因供應商與設定而異（[MCP](https://code.claude.com/docs/en/mcp)）。Plugins、Hooks、MCP 伺服器、監控程式 (monitors) 與執行檔可以執行受信任的程式碼，或使用使用者憑證叫用外部服務。

## 協調編排 (orchestration)

[Anthropic 將](https://code.claude.com/docs/en/agents)子代理工具、Agent view、代理工具團隊 (agent teams) 與動態工作流程 (dynamic workflows) 區分開來。子代理工具具有隔離的委派脈絡，通常只回傳最終結果。代理工具團隊屬於實驗性功能且預設停用；它們加入固定的領隊 (lead)、同儕工作階段、共用任務清單與訊息傳遞，但不會自動隔離檢出區 (checkout)。Agent view 是供獨立背景工作階段使用的研究預覽 (research preview) UI：監督者 (supervisor) 狀態可在重新啟動、更新與睡眠後保留，但關機會停止程序；已完成且未釘選的工作階段通常會在約一小時後停止，記憶體壓力或逐字稿清理也可能使其無法再恢復（[Agent view](https://code.claude.com/docs/en/agent-view)）。

文件將動態工作流程描述為由指令碼掌控的協調編排：隔離的 JavaScript 執行環境 (runtime) 會協調多個子代理工具，而中間結果保留在變數中。這是目前一項具明訂並行與執行時間限制 (runtime limits) 的特定操作介面，不能據此認定每個 Claude Code 工作階段都會進行自主多代理工具規劃 (autonomous multi-agent planning)（[工作流程](https://code.claude.com/docs/en/workflows)）。跨工作階段訊息僅攜帶純文字，絕不承載使用者授權或權限核准。

## 模型／供應商邊界

Claude 模型提供推論 (inference)；Claude Code 提供程式開發代理工具框架。**Claude Agent SDK** 是另一套 Python/TypeScript 嵌入程式庫 (embedding library)，將 Claude Code 迴圈與工具封裝給開發者自行託管的基礎設施使用。它不是直接用戶端軟體開發套件 (Client SDK)，也不是由 Anthropic 託管的 Managed Agents；整合者需自行負責子程序隔離、資源、持久化與部署（[Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview)）。

Claude Code 可以使用 Anthropic 存取管道與文件記載的第三方平台，但由伺服器支援的功能會因供應商、模型、方案與政策而異（[功能可用性](https://code.claude.com/docs/en/feature-availability)）。穩定路由需要明確的供應商原生識別碼：Anthropic 模型 ID、Bedrock ID／設定檔 ARN／自訂識別碼、Google 版本名稱或 Foundry 部署名稱。動態別名不能視為固定指向 (pins)（[模型設定](https://code.claude.com/docs/en/model-config)）。

## 平台／授權／狀態

公開的 `anthropics/claude-code` 儲存庫**並未授予開放原始碼權利**：其授權條款載明保留所有權利，並指向 Anthropic 的 Commercial Terms（[授權](https://github.com/anthropics/claude-code/blob/v2.1.251/LICENSE.md)）。SDK 授權依元件而異：[Python Agent SDK 授權](https://github.com/anthropics/claude-agent-sdk-python/blob/af5ff1b9f2f279575f89b78f17572c6e35fbc2b6/LICENSE)採用 MIT，而 [TypeScript Agent SDK 授權](https://github.com/anthropics/claude-agent-sdk-typescript/blob/75667f1f76e800bb845b0a0e211df79fedfc9e86/LICENSE.md)則保留所有權利；兩者均未對 Claude Code、模型、託管服務、商標或相依套件重新授權。

> **事實 (Fact)，發布快照：** GitHub 發布中繼資料將 Claude Code `v2.1.251` 標記為非草稿、非預先發布版本，於 2026-08-28 建立並發布，且截至 2026-08-31 的資料截點仍為最新版（[發布 API](https://api.github.com/repos/anthropics/claude-code/releases/latest)）。若未重新查核，不得將「最新版」的說法沿用至未來。

## 變更訊號

請重新查核發布管道、供應商／模型矩陣、權限預設值、預覽標籤、資料保留條款與服務狀態。線上文件可能變動。Anthropic 目前適用的第一方商業標準規定，資料在伺服器保留 30 天；第三方部署則依其供應商協議辦理。本機逐字稿預設同樣按 30 天期限清理；但若工作階段是在 Desktop 或 Cowork 中啟動，或最近一次是在其中繼續，則不適用此預設，除非已設定 `desktopSessionCleanupPeriodDays`（[資料使用](https://code.claude.com/docs/en/data-usage)）。零資料保留 (Zero Data Retention) 需要符合資格的組織另行啟用，且僅涵蓋符合資格的身分驗證／供應商路徑（[ZDR](https://code.claude.com/docs/en/zero-data-retention)）。狀態觀察並不是服務可用時間保證。

## 待解問題

> **待解問題 (Open question)：** 部署時應假設使用哪個供應商、身分驗證路徑、方案、模型識別碼、區域與受管理政策？這項選擇會改變功能與資料政策矩陣。

此外，發布時也應驗證最新版本。任何嵌入或預先安裝 Claude Code 或 Agent SDK 的產品，都應按個別授權接受法律審查，而不是從儲存庫的公開可見性推論權利。

## 主要來源

- [Claude Code 概覽](https://code.claude.com/docs/en/overview)與[平台](https://code.claude.com/docs/en/platforms)
- [Claude Code 的運作方式](https://code.claude.com/docs/en/how-claude-code-works)
- [記憶與指示探索](https://code.claude.com/docs/en/memory)
- [工具參考資料](https://code.claude.com/docs/en/tools-reference)
- [權限](https://code.claude.com/docs/en/permissions)與[沙箱](https://code.claude.com/docs/en/sandboxing)
- [工作階段](https://code.claude.com/docs/en/sessions)與[資料使用](https://code.claude.com/docs/en/data-usage)
- [平行代理工具模式](https://code.claude.com/docs/en/agents)、[Agent view](https://code.claude.com/docs/en/agent-view)與[動態工作流程](https://code.claude.com/docs/en/workflows)
- [Claude Agent SDK 概覽](https://code.claude.com/docs/en/agent-sdk/overview)
- [功能可用性](https://code.claude.com/docs/en/feature-availability)
- [Claude Code 授權](https://github.com/anthropics/claude-code/blob/v2.1.251/LICENSE.md)與[最新版本 API](https://api.github.com/repos/anthropics/claude-code/releases/latest)
