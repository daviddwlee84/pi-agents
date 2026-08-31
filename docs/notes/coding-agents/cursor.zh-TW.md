---
kind: product-profile
status: reviewed
as_of: 2026-08-31
last_verified: 2026-08-31
upstreams:
  - https://cursor.com/docs/agent/overview
  - https://cursor.com/docs/cli/overview
  - https://cursor.com/docs/cloud-agent
  - https://cursor.com/docs/cloud-agent/security
  - https://cursor.com/docs/cloud-agent/automations
  - https://cursor.com/docs/rules
  - https://cursor.com/docs/skills
  - https://cursor.com/docs/hooks
  - https://cursor.com/docs/agent/security/run-modes
  - https://cursor.com/docs/subagents
  - https://cursor.com/docs/plugins
  - https://cursor.com/docs/sdk/typescript
  - https://cursor.com/docs/models-and-pricing
  - https://cursor.com/data-use
  - https://cursor.com/terms-of-service
  - https://github.com/cursor/plugins/tree/68836ddaf5697224520f1847d90cdb90ca8babaa
  - https://github.com/cursor/cursor/tree/654b1b4775ca67aef473bd31a14c8c04a1abde2d
  - https://github.com/cursor/sdk-bridge/blob/8157597c625b5f642d3c4a1472d20c9c330a9d18/LICENSE
confidence: high
---

# Cursor

> **編者分類 (Editorial classification)：** 本文從四個介面 (surface) 描述 Cursor：衍生自 VS Code 的編輯器、終端機 CLI、代管的 Cloud Agents/Automations，以及 SDK。這不表示各介面功能相同，也不對其排名。

## 範圍與介面

Cursor Agent 是編輯器側邊窗格中的自主程式設計介面 (autonomous coding surface)。Cursor 將其迴圈 (loop) 描述為指示 (Instructions)、工具 (Tools) 與所選模型 (Model)。獨立的 Cursor CLI 以 `agent` 叫用，並針對本機工作區 (workspace) 操作。Cloud Agents 在 Cursor 管理的機器上遠端執行；Automations 則觸發這些受管理的 Agent。`@cursor/sdk` 可將 Agent 迴圈 (agent loop) 嵌入呼叫端的處理程序 (process)，或叫用雲端執行 ([Agent 概覽](https://cursor.com/docs/agent/overview)、[CLI](https://cursor.com/docs/cli/overview)、[Cloud Agents](https://cursor.com/docs/cloud-agent)、[SDK](https://cursor.com/docs/sdk/typescript))。

這些介面彼此相關，但信任邊界 (trust boundaries) 不同。Editor Agent 與 CLI 使用本機檔案及本機控制。Cloud Agent 不必讓使用者的機器保持上線也能繼續執行，且執行時不會出現本機 Run Mode 核准提示。以儲存庫 (repository) 為基礎的雲端執行可使用分支 (branch) 與 Pull Request (PR)；Automations 則可能在沒有儲存庫、使用一個儲存庫或使用多個儲存庫的情況下執行，因此有關儲存庫與分支的說法並非普遍適用。文件記載的留言啟動方式特指 GitHub 與 Bitbucket 留言，而非所有已連線的版本控制產品。

## 指示與上下文

Cursor Rules 包括 Team Rules、位於 `.cursor/rules/**/*.mdc` 下的遞迴 Project Rules、User Rules，以及 `AGENTS.md`。Project Rules 可以一律套用、比對萬用字元模式 (globs)、依描述選取，或由使用者手動引用。Cursor 記載了 Team → Project → User 的優先順序 (precedence)，但未提供同一範圍內完整的衝突規則。CLI 也會讀取根目錄的 `AGENTS.md` 與 `CLAUDE.md`；這些相容性檔案和 Cursor Rules 之間的關係仍未明確說明 ([Rules](https://cursor.com/docs/rules)、[CLI 使用方式](https://cursor.com/docs/cli/using))。

聊天中的訊息、檔案、工具輸出、Rules、Skills、MCP 與 Subagents 會共用有限的上下文 (context)。接近容量上限時，Cursor 會摘要較舊的對話。這項上下文處理程序與檔案檢查點 (checkpoint) 及 Automation Memories 均不相同。

## 工具與執行

Editor Agent 文件記載的能力包括程式碼／檔案搜尋、讀取與編輯、殼層 (shell) 命令、網頁操作、瀏覽器控制、影像處理、提問，以及委派給 Subagent。Cursor CLI 提供互動式 Agent、Plan 和唯讀 Ask 模式，以及無頭模式 (headless mode) 的 `agent -p`。實際可用工具仍取決於介面與政策 (policy)。

Browser 工具透過 MCP 擴充伺服器 (extension server) 實作，並依工作區保留 Cookie 與瀏覽器儲存空間 (browser storage)。來源控制 (origin controls) 可降低暴露程度，但重新導向、點擊的連結、手動導覽與用戶端導覽仍可能跨越允許清單 (allowlist) ([瀏覽器工具](https://cursor.com/docs/agent/tools/browser))。Cloud Agents 可在受管理的機器上建置／測試、使用瀏覽器或桌面功能，並產生日誌或視覺產物；這些能力不能證明本機 CLI 擁有相同環境。

## 權限、信任與沙箱 (sandbox)

本機編輯器的 Run Modes 控制殼層、MCP 與 Fetch 的核准。Auto-review 結合允許清單、可用時的終端機沙箱，以及分類器 (classifier)；Allowlist 不使用分類器；Run Everything 則會在沒有沙箱的情況下自動執行命令。沙箱涵蓋受支援的終端機命令，而不涵蓋 MCP 或 Fetch；Cursor 並明確表示 Auto-review 並非安全邊界 (security boundary) ([Run Modes](https://cursor.com/docs/agent/security/run-modes))。CLI 另有全域／專案允許與拒絕規則；拒絕優先，但文件未說明 `~/.cursor/cli-config.json` 與 `.cursor/cli.json` 之間哪一個檔案優先。無頭模式的 `--force`／`--yolo` 會移除一般的編輯確認。

`.cursorignore` 會限制數項編輯器功能所呈現的內容，但 Terminal 與 MCP 仍可存取被忽略的檔案。它不是機密性邊界 (confidentiality boundary) ([忽略檔案](https://cursor.com/docs/reference/ignore-file))。

Cursor 表示，每個 Cloud Agent 都使用一個以 Firecracker 為基礎的專用 microVM，並繼承發起者的儲存庫權限。預設會開啟網際網路存取。Agent 可檢視 Environment Variables；Runtime Secrets 會從模型、工具、對話記錄 (transcript) 與提交 (commit) 介面中遮蔽，但仍可透過 Terminal 存取。資料外送控制 (egress controls) 與遮蔽處理 (redaction) 是緩解措施，而非防止由提示注入 (prompt injection) 驅動之外洩的保證 ([雲端安全性](https://cursor.com/docs/cloud-agent/security)、[secrets 與網路](https://cursor.com/docs/cloud-agent/security-network))。

## 工作階段 (sessions) 與復原

Editor Agent 檢查點會在重大變更前建立檔案快照；還原檔案不會清除對話訊息，且檢查點並不是 Git。CLI 對話可以列出並續接。在 SDK 中，Agent 是持久對話容器 (durable conversation container)，而 Run 是一次提示執行；本機狀態儲存在本機，雲端狀態則儲存在伺服器端 ([SDK](https://cursor.com/docs/sdk/typescript))。

雲端對話記錄與產物 (artifacts) 預設會持續保留到刪除為止，閒置環境的快照則另有文件記載的到期時間
([雲端安全性](https://cursor.com/docs/cloud-agent/security)、
[網路與 secrets](https://cursor.com/docs/cloud-agent/security-network))。Automation Memories 會跨執行持續存在於儲存庫之外，也可以編輯或停用；因此，不受信任的事件可能建立具誤導性的持久筆記
([Automations](https://cursor.com/docs/cloud-agent/automations))。

## 擴充性

Rules、Agent Skills、Hooks、MCP 與 Plugins 是不同機制。Skills 使用 `SKILL.md`、採漸進式載入 (progressive loading)，且可從 Cursor 與相容的 Agent 位置探索；Cursor 稱此格式開放且可攜，但並未提供具版本的符合性保證 (versioned conformance guarantee)，也未承諾跨產品行為完全相同 ([Skills](https://cursor.com/docs/skills))。使用者 Skills 不會自動轉移到 Cloud Agents、SSH 工作階段或受管理的工作節點 (workers)。

MCP 透過 stdio、SSE 或 Streamable HTTP 支援工具 (tools)、提示 (prompts)、資源 (resources)、根目錄 (roots)、資訊徵詢 (elicitation) 與應用程式 (apps)，並提供本機及系統管理控制。Hooks 是在生命週期事件 (lifecycle events) 執行、以 JSON 溝通的子處理程序；攸關安全性的 Hooks 在崩潰、逾時或 JSON 無效後會失敗時開放 (fail open)，除非設定 `failClosed: true`，而 Cloud Agents 僅支援其中一部分 ([Hooks](https://cursor.com/docs/hooks))。

Agent Plugins 將可攜式 Skills 與 MCP 封裝在一起。Cursor Plugins 還可封裝規則 (rules)、Agents、命令 (commands)、Hooks 與變數 (variables)。Public Marketplace 審查並非安全保證，而本機／團隊 Plugins 的來源也不同 ([plugins](https://cursor.com/docs/plugins))。截至資料截點，已審查的
[`cursor/plugins` tree](https://github.com/cursor/plugins/tree/68836ddaf5697224520f1847d90cdb90ca8babaa) 沒有根目錄 `LICENSE` 檔案，GitHub 也未偵測到授權，儘管其 README 將 License 章節標為「MIT」，而巢狀 Plugins 各自含有授權條款。這些跡象無法確立一項明確適用於整個儲存庫或整個產品的授權許可；這是對固定 tree 的觀察 (observation)，而不是聲稱其他地方不可能適用任何條款。

## 協調與編排 (orchestration)

文件記載 Editor、CLI 與 Cloud Agents 均支援 Subagents。每個 Subagent 都有隔離的上下文；前景工作會阻塞，背景工作則為非同步 (asynchronous)，而且多個工作節點可以同時執行。內建項目包括 Explore、Bash 與 Browser。共用檢出目錄 (checkout) 中的編輯可能互相衝突；在有設定的情況下，工作樹 (worktrees) 或獨立的雲端環境可提供檔案隔離 ([subagents](https://cursor.com/docs/subagents))。

Automations 會依排程及選定的外部事件觸發 Cloud Agents，包括版本控制、Slack、Webhooks、Linear、Sentry 與 PagerDuty。執行時可以不使用儲存庫，也可以儲存庫為基礎；Automation Memories 是工作流程 (workflow) 特定的持久狀態 ([Automations](https://cursor.com/docs/cloud-agent/automations))。這是受管理的編排 (managed orchestration)，與本機 Subagent 樹狀結構不同。

## 模型與供應商邊界 (model/provider boundary)

Cursor 提供 Cursor Models 與第三方模型。請求 (requests)（包括 BYOK 請求）會通過 Cursor 的後端以完成最終提示建構；實體推論託管 (inference hosting) 可能由模型供應商、受信任的合作夥伴或 Cursor 提供 ([模型](https://cursor.com/docs/models-and-pricing)、[資料使用方式](https://cursor.com/data-use))。所謂本機 SDK Agent，僅表示迴圈、工具與檔案系統影響發生在本機，**並不**表示推論在本機進行；模型生成仍會走遠端 Cursor 服務路徑。

SDK 是 Agent SDK，而非原始聊天完成 API (raw chat-completions API)。其識別字與所有酬載 (payload) 細節均不保證穩定。`agent acp` 另透過 stdio，以換行分隔的 JSON-RPC 2.0 公開 CLI；文件描述了其行為，但沒有提供穩定性等級 ([ACP](https://cursor.com/docs/cli/acp))。

## 平台/授權/狀態

Cursor 以 VS Code 程式碼庫為基礎，並可匯入許多 VS Code 設定、佈景主題、按鍵綁定 (keybindings) 與 Extensions，但 Cursor 的重定基底頻率 (rebasing cadence) 並不保證 Extension 功能相同 ([VS Code 遷移](https://cursor.com/docs/configuration/migrations/vscode))。Cursor 的 Terms 授予有限的服務使用權；其 OSS notice 涵蓋納入的元件，而非整個產品。已審查的公開 [`cursor/cursor` tree](https://github.com/cursor/cursor/tree/654b1b4775ca67aef473bd31a14c8c04a1abde2d) 僅供參考，並非完整原始碼。MIT 僅適用於明確授權條款所授予的範圍，例如固定版本的 [`cursor/sdk-bridge` 授權條款](https://github.com/cursor/sdk-bridge/blob/8157597c625b5f642d3c4a1472d20c9c330a9d18/LICENSE) 或特定 Plugin 目錄，而不會自動適用於整個 Plugin 儲存庫或 Cursor 產品 ([Terms](https://cursor.com/terms-of-service)、[OSS notices](https://cursor.com/licenses))。

Cloud Agents API v1 為公開測試版 (public beta)。在所引述的 v1 API 中，儲存庫／分支／PR 端點僅適用於 GitHub，且最多涵蓋 20 個儲存庫。五分鐘到期時間只適用於待處理集區監看游標 (pending-pool watch cursors)，並非普遍適用於執行串流；執行串流保留期另有訊號。v1 不含 Webhooks，且截至資料截點，部分環境變數支援仍在逐步推出 ([API](https://cursor.com/docs/cloud-agent/api/endpoints))。

## 變更訊號

模型目錄、上下文限制、Router 集區 (pools)、價格、方案資格、API 推出進度與 Privacy Mode 例外都容易變動。變更日誌項目只確立推出日期，不代表目前語意。狀態頁面與安全證明是供應商在特定時間點提供的證據，而非運作時間或安全性的保證。

Privacy Mode 是在特定安排下所陳述的不訓練承諾，而不是「不處理」或無條件「不保留」。BYOK、強制保留資料的模型 (required-retention models)、濫用調查、快取 (caches) 與雲端產物各有不同的處理方式 ([資料使用方式](https://cursor.com/data-use))。

## 待解問題

> **待解問題 (Open question)：** 同一範圍內的 Rules 如何解決衝突？CLI 的 `AGENTS.md`/`CLAUDE.md` 指示與 `.cursor/rules` 之間又如何排序？

文件也未解決全域與專案 CLI 權限之間的優先順序、未提供 ACP 相容性承諾，也未發布一個可普遍適用於 editor、CLI、provider、SDK 與 Cloud Agent 介面的保留期限。

## 主要來源

- [Cursor Agent 概覽](https://cursor.com/docs/agent/overview)與 [Cursor CLI](https://cursor.com/docs/cli/overview)
- [Cloud Agents](https://cursor.com/docs/cloud-agent)、[雲端安全性](https://cursor.com/docs/cloud-agent/security)與 [Automations](https://cursor.com/docs/cloud-agent/automations)
- [Rules](https://cursor.com/docs/rules)與 [Agent Skills](https://cursor.com/docs/skills)
- [Run Modes](https://cursor.com/docs/agent/security/run-modes)
- [Hooks](https://cursor.com/docs/hooks)、[plugins](https://cursor.com/docs/plugins)與 [subagents](https://cursor.com/docs/subagents)
- [Cursor TypeScript SDK](https://cursor.com/docs/sdk/typescript)
- [模型與價格](https://cursor.com/docs/models-and-pricing)及[資料使用方式](https://cursor.com/data-use)
- [Terms of Service](https://cursor.com/terms-of-service)
