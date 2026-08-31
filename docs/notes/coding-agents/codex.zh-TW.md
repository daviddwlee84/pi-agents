---
kind: product-profile
status: reviewed
as_of: 2026-08-31
last_verified: 2026-08-31
upstreams:
  - https://learn.chatgpt.com/docs
  - https://learn.chatgpt.com/docs/codex/cli
  - https://learn.chatgpt.com/docs/non-interactive-mode
  - https://learn.chatgpt.com/docs/app
  - https://learn.chatgpt.com/docs/cloud
  - https://learn.chatgpt.com/docs/app-server
  - https://learn.chatgpt.com/docs/codex-sdk
  - https://learn.chatgpt.com/docs/agent-configuration/agents-md
  - https://learn.chatgpt.com/docs/agent-approvals-security
  - https://learn.chatgpt.com/docs/agent-configuration/subagents
  - https://learn.chatgpt.com/docs/open-source
  - https://developers.openai.com/blog/codex-as-a-platform
  - https://github.com/openai/codex/blob/rust-v0.151.0/LICENSE
  - https://github.com/openai/codex/releases/tag/rust-v0.151.0
confidence: high
---

# OpenAI Codex

> **編者分類 (Editorial classification)：** 本文將 Codex 視為分層式程式開發代理工具平台：模型提供推論 (inference)，開放式代理工具框架 (open harness) 管理代理迴圈 (agent loop)，本機與受管理產品則提供不同的操作介面 (surfaces)。「分層式平台」是由證據支持的編者分類，不是官方的排他性分類或基準評測判斷。

## 範圍與操作介面

此產品家族包含 Codex CLI、`codex exec`、Codex 整合開發環境擴充功能 (Codex IDE extension)、ChatGPT 桌面應用程式中的 Codex 體驗、網頁／受管理的雲端工作、TypeScript 與 Python Codex SDK，以及 Codex App Server。它們共用 Codex 代理工具框架家族的部分元件，但在執行位置、能力、帳戶邊界、設定與成熟度上有所不同（[文件中心](https://learn.chatgpt.com/docs)、[平台文章](https://developers.openai.com/blog/codex-as-a-platform)）。本機桌面、命令列介面 (command-line interface, CLI) 與整合開發環境 (integrated development environment, IDE) 操作介面可共用部分主機設定，例如模型情境協定 (Model Context Protocol, MCP)；ChatGPT 網頁版不會讀取該設定，雲端環境則另行設定。

Codex CLI 是本機終端機代理工具；`codex exec` 是供指令碼與持續整合 (continuous integration, CI) 使用、範圍受限的非互動式介面。Desktop 操作介面提供 Local、Worktree 與 Cloud 模式，以及並非所有介面都有的豐富用戶端功能。受管理的雲端工作會在已設定的 OpenAI 環境中遠端執行。SDK 會嵌入本機 Codex 對話串 (threads)。App Server 提供生命週期與事件通訊協定給功能豐富的用戶端使用；但屬於實驗性且不支援正式環境的，是 `app-server` 命令本身，不只是 WebSocket 傳輸（[CLI](https://learn.chatgpt.com/docs/codex/cli)、[雲端](https://learn.chatgpt.com/docs/cloud)、[App Server](https://learn.chatgpt.com/docs/app-server)）。

## 指示與脈絡

Codex 最多會從 `CODEX_HOME` 找出一個有內容的全域指示檔，且優先使用 `AGENTS.override.md` 而非 `AGENTS.md`。在專案中，它會從根目錄逐層走訪至目前目錄，每個目錄選取一個指示檔，再依根目錄至葉節點的順序串接。因此，較接近目前目錄的文字會出現在後面；將此描述為「優先權 (precedence)」只是提示詞排序 (prompt ordering) 的簡稱，而不是文件所定義、用來解決語意衝突的機制（[`AGENTS.md`](https://learn.chatgpt.com/docs/agent-configuration/agents-md)）。

對話串會持續保留回合 (turns) 與具型別的項目 (typed items)，供未來作為脈絡使用。手動或自動壓縮 (compaction) 會以較短的表述取代先前內容。本機記憶 (Local Memories) 是另一項獨立的實驗性功能，截至資料截點預設停用；其產生與使用可在 `CODEX_HOME` 下分別設定。它們不是 ChatGPT 網頁版記憶，也不能取代受版本控制的團隊規則（[Memories](https://learn.chatgpt.com/docs/customization/memories?surface=app)、[設定](https://learn.chatgpt.com/docs/config-file/config-reference)）。

## 工具與執行

代理工具框架提供經沙箱 (sandbox) 限制的命令執行、檔案變更、計畫 (plans)、網頁搜尋、MCP 呼叫、影像操作、程式碼審查 (review)、壓縮與協作活動。確切可用性取決於模型、供應商、用戶端、工作區 (workspace) 與政策。Desktop／網頁版的瀏覽器支援不適用於 CLI 或 IDE 擴充功能。Computer Use 是受支援之 macOS 與 Windows 體驗上的選用外掛程式／技能 (plugin/skill)，另有獨立的應用程式核准項目，且無法自動操作終端機應用程式或 ChatGPT 本身（[瀏覽器](https://learn.chatgpt.com/docs/browser)、[Computer Use](https://learn.chatgpt.com/docs/computer-use)）。

`codex exec` 可以用 `--json` 串流逐行 JSON (JSON Lines, JSONL) 事件、用 `--output-schema` 約束最終結果、恢復工作階段 (session)，或用 `--ephemeral` 避免持久化。它啟動時使用唯讀沙箱；若要編輯，必須明確指定沙箱，例如 `--sandbox workspace-write`。`danger-full-access` 僅應置於適當隔離的外層環境內（[非互動模式](https://learn.chatgpt.com/docs/non-interactive-mode)）。

## 權限／信任／沙箱

沙箱政策 (sandbox policy) 限制本機命令的權限範圍；核准政策 (approval policy) 則決定何時必須由使用者作出決定。兩者彼此獨立。對受版本控制的資料夾，OpenAI 建議採用由 `workspace-write` 加上 `on-request` 組成的 Auto 預設組合 (preset)；對未受版本控制的資料夾，則建議從唯讀開始。這並非一套通用預設值（[核准與安全性](https://learn.chatgpt.com/docs/agent-approvals-security)）。

在 macOS 上，本機強制執行機制使用 Seatbelt。Linux 預設使用 `bwrap` 加上 seccomp；WSL2 使用 Linux 實作。容器限制、缺少輔助程式 (helpers) 或選用完整存取權，都可能改變這項基準。在預設的 `workspace-write` 下，可寫入根目錄之下既有的 `.git`、`.agents` 與 `.codex` 路徑會受到唯讀保護，其中也包括 `.git` 指標檔 (pointer files) 所參照並解析出的 Git 目錄；這項保護並不保證適用於所有設定檔 (profiles)。

Codex cloud 使用隔離的 OpenAI 管理容器／環境。設定階段可能取得已設定的祕密值 (secrets) 與網路存取權 (networking)；在預設離線的代理工具階段開始前，祕密值會被移除。託管瀏覽器／搜尋／連接器與本機命令網路政策是彼此獨立的控制措施。外部頁面、MCP 輸出、Plugins 與儲存庫指示仍是提示注入 (prompt injection) 的輸入來源。

## 工作階段與復原

一段對話即包含回合與項目的對話串。CLI 支援建立、恢復、分叉 (fork)、壓縮、封存、重新命名與刪除；`/side` 會建立暫時且不能巢狀分叉的分支副本。App Server 支援持久或短暫的對話串、方向調整 (steering)、中斷 (interruption)、分頁 (pagination) 與壓縮。Desktop Worktree 對話使用隔離的檢出區 (checkouts)，通常處於分離式 HEAD (detached HEAD)，並能將對話與程式碼交回本機檢出區（[工作樹 (worktrees)](https://learn.chatgpt.com/docs/environments/git-worktrees)）。

> **推論 (Inference)：** 壓縮與經摘要的子代理工具回傳內容可能遺漏細節。當精確重現很重要時，應在對話脈絡之外保存差異內容 (diffs)、測試、成品 (artifacts) 及必要指示。

## 擴充性

Agent Skills 會封裝 `SKILL.md` 指示與選用的指令碼／資源。Codex 是用於本機標準輸入輸出 (stdio) 與遠端 Streamable HTTP 伺服器的 MCP 用戶端；本機桌面、CLI 與 IDE 操作介面可共用主機 MCP 設定，而 ChatGPT 網頁版不會讀取該設定。已棄用的 `codex mcp-server` 橋接器 (bridge) 並不是原生子代理工具協調編排（[MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)）。

Plugins 是以 Skills 和／或 MCP 為核心的可安裝套件；在主機支援的情況下，目錄 (catalog) 也可能呈現選用的瀏覽器擴充功能 (browser extensions)、事件鉤子 (hooks) 與排程任務範本 (scheduled-task templates)。「共用 Plugin 目錄」是指公開目錄，不一定代表本機檔案系統中的同一個目錄。IDE 擴充功能不支援 Plugins，且仍受帳戶、工作區與身分驗證條件限制。Hooks 也不是完整的安全邊界：非同步 Hooks 無法阻擋，有些特殊路徑可以繞過一般 Hooks，而使用後 Hooks (post-use hooks) 無法撤銷已產生的效果（[Plugins](https://learn.chatgpt.com/docs/plugins?surface=app)、[Hooks](https://learn.chatgpt.com/docs/hooks)）。

## 協調編排 (orchestration)

原生 Codex 子代理工具 (subagents) 是子 Codex 對話串，會各自執行模型／工具工作並回傳摘要。內建角色 (roles) 包含 `default`、`worker` 與以讀取為主的 `explorer`；自訂代理工具可以選擇指示、模型、運算投入程度 (effort)、沙箱、MCP 與 Skills。並行數量可以設定，但文件既未公布省略設定值時通用的預設值，也未公布巢狀深度的硬性上限（[子代理工具](https://learn.chatgpt.com/docs/agent-configuration/subagents)）。Max 與 Ultra 的行為取決於模型、操作介面、帳戶與設定；Ultra 的主動委派只有在符合資格的 ChatGPT Work 帳戶與受支援模型上有文件記載。

其他協調編排操作介面包括平行雲端工作、SDK 對話串、App Server 整合與工作樹。`/goal` 是另一種持久控制模式，適用於文件所列的 ChatGPT 桌面版、互動式 Codex CLI 與 IDE 操作介面，可處理長時間執行的多步驟工作；它可以與工具或代理工具共存，但其本身不能證明有多代理工具協調編排（[長時間執行的工作](https://learn.chatgpt.com/docs/long-running-work?surface=app)）。應避免讓大量寫入的代理工具彼此重疊作業；利用工作樹隔離寫入是一項操作層面的綜合建議 (operational synthesis)，不能證明每種子代理工具模式都會自動隔離。

## 模型／供應商邊界

Codex 模型負責推論；Codex 代理工具框架管理脈絡、工具、執行、核准與事件。模型存取權與託管服務彼此獨立。可設定的供應商會提供基底 URL (base URLs)、傳輸 API (wire APIs)、憑證、標頭、重試機制與串流，但「與 OpenAI 相容 (OpenAI-compatible)」並不保證所有端點 (endpoints)、搜尋模式、推理摘要、工具、身分驗證流程或目錄都能運作。本機開放原始碼軟體模式 (open-source software mode, OSS mode) 支援文件記載的本機執行環境，而 Amazon Bedrock 是一條不同的直接供應商路徑，不使用 ChatGPT 身分驗證或 Codex cloud（[進階設定](https://learn.chatgpt.com/docs/config-file/config-advanced)、[Bedrock](https://learn.chatgpt.com/docs/amazon-bedrock)）。

Codex TypeScript SDK 透過 JSONL 包裝 CLI；Python SDK 則透過 JSON-RPC 使用 App Server。兩者都是本機代理工具框架整合，與 OpenAI 的通用 Agents SDK 及受管理雲端工作不同（[SDK](https://learn.chatgpt.com/docs/codex-sdk)）。

## 平台／授權／狀態

OpenAI 的 [2025-10-06 Codex 正式發布 (general availability, GA) 公告](https://openai.com/index/codex-now-generally-available/)適用於產品層級，而不是每個元件。Linux 桌面版與 GitLab 可能仍帶有預覽／測試版 (preview/beta) 標籤，App Server 則仍屬實驗性質。OpenAI 也將 Skills、Plugins、Codex Security 元件與通用雲端環境 (universal cloud environment) 列為開放原始碼；開放的基礎環境並不會使託管雲端服務成為開放原始碼。公開的 `openai/codex` 儲存庫（包括儲存庫內的 CLI、SDK 與 App Server 程式碼）採用 Apache-2.0 授權。該授權不涵蓋模型、託管 Codex 服務、封閉原始碼的 IDE 擴充功能、Codex cloud、品牌或第三方相依套件（[開放原始碼盤點](https://learn.chatgpt.com/docs/open-source)、[授權](https://github.com/openai/codex/blob/rust-v0.151.0/LICENSE)）。

> **事實 (Fact)，發布快照：** GitHub 中繼資料將 `rust-v0.151.0` 標記為非草稿、非預先發布版本，並於 2026-08-29 發布；截至 2026-08-31 的資料截點，[官方發布版本 API](https://api.github.com/repos/openai/codex/releases?per_page=20)並未顯示更晚的穩定版本（[不可變的發布版本](https://github.com/openai/codex/releases/tag/rust-v0.151.0)）。這項排序主張在該日期後必須重新查核。

## 變更訊號

請重新查核發布排序、實驗性 API、Linux／GitLab 成熟度、模型汰除、方案／區域可用性，以及自訂供應商相容性。大多數產品文件都是持續更新的頁面。App Server 文件與 `main` 分支協定細節的變動速度可能不同，因此將來源觀察視為已發布契約前，必須先釘選來源版本。

## 待解問題

> **待解問題 (Open question)：** 省略 `agents.max_concurrent_threads_per_session` 時會套用哪個預設值？系統是否會強制執行巢狀深度的硬性上限？

文件也未提供 App Server 的正式環境相容日期、已棄用之 Chat Completions／供應商路徑或 `codex mcp-server` 的移除日期，也未提供一份具權威性的單一方案／區域／工作區／模型矩陣。

## 主要來源

- [Codex 文件中心](https://learn.chatgpt.com/docs)
- [Codex CLI](https://learn.chatgpt.com/docs/codex/cli)與[非互動模式](https://learn.chatgpt.com/docs/non-interactive-mode)
- [桌面應用程式](https://learn.chatgpt.com/docs/app)與[Codex cloud](https://learn.chatgpt.com/docs/cloud)
- [Codex App Server](https://learn.chatgpt.com/docs/app-server)
- [Codex SDK](https://learn.chatgpt.com/docs/codex-sdk)
- [`AGENTS.md` 指南](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- [核准與安全性](https://learn.chatgpt.com/docs/agent-approvals-security)
- [原生子代理工具](https://learn.chatgpt.com/docs/agent-configuration/subagents)
- [Codex 作為平台](https://developers.openai.com/blog/codex-as-a-platform)
- [開放原始碼盤點](https://learn.chatgpt.com/docs/open-source)、[儲存庫授權](https://github.com/openai/codex/blob/rust-v0.151.0/LICENSE)與 [`rust-v0.151.0`](https://github.com/openai/codex/releases/tag/rust-v0.151.0)
