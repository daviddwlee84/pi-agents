---
kind: product-profile
status: reviewed
as_of: 2026-08-31
last_verified: 2026-08-31
upstreams:
  - https://antigravity.google/docs/home
  - https://antigravity.google/docs/permissions
  - https://antigravity.google/docs/cli/sandbox
  - https://antigravity.google/docs/subagents
  - https://antigravity.google/docs/models
  - https://antigravity.google/docs/enterprise
  - https://antigravity.google/blog/introducing-google-antigravity-sdk
  - https://github.com/google-antigravity/antigravity-sdk-python/tree/ac516c7709e3baf225c09d8b9d112b07b70066ff
  - https://github.com/google-antigravity/antigravity-cli/tree/556846a4bb94117222f53846896c7eb0d645307e
  - https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/
  - https://bughunters.google.com/learn/invalid-reports/ai-products/antigravity-known-issues
confidence: medium
---

# Google Antigravity

## 範圍與介面

Google Antigravity 是一個傘狀的「代理式開發平台 (agentic development platform)」，而非單一 CLI 或單一 IDE。截至資料截點，其各自採用獨立版本的介面 (surfaces) 為：

- **Antigravity 2.0 v2.11.0**，獨立的桌面指揮中心 (command center)；
- **Antigravity CLI v1.1.22**，以 Go 開發的終端機／TUI 產品；
- **Antigravity for IDEs v2.5.5**，編輯器整合；以及
- **Google Antigravity SDK v0.1.15**，圍繞代理工具框架 (harness) 建構的 Python API。

Google 表示它們共用底層代理工具框架，但這無法確立其功能、設定、模型、安全性、資料政策、授權或生命週期完全相同
([首頁](https://antigravity.google/docs/home)、
[介面指南](https://cloud.google.com/blog/topics/developers-practitioners/choosing-your-surface-antigravity-20-antigravity-cli-antigravity-ide-or-antigravity-sdk))。
Google 的命名也互有衝突：目前頁面使用「Antigravity for IDEs」、「Antigravity IDE」與「Antigravity Extensions」，而企業資料則仍保留不同的「standalone Antigravity IDE」。因此，除非特定來源中的名稱很重要，本文一律使用 **IDE／編輯器整合 (IDE/editor integrations)**。

!!! note "事實 (Fact) — Gemini CLI 是不同產品"
    Antigravity CLI 是 Gemini CLI 面向消費者的後繼產品，不是同一個儲存庫或二進位檔 (binary) 的更名。消費者 Gemini CLI 流量已於 2026-06-18 遷移，而 Gemini CLI 仍可供 Standard／Enterprise 及付費 API 金鑰路徑 (API-key paths) 使用。遷移指南涵蓋特定視覺設定、驗證權杖 (auth tokens)、Extensions／Plugins、Commands／Skills、MCP 及上下文路徑。文件未記載 Hooks 與對話歷程遷移，也未確立設定或行為完全相同
    ([轉換](https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/)、
    [遷移](https://antigravity.google/docs/cli/gcli-migration))。

## 指示與上下文

Antigravity CLI 會在啟動時辨識工作區根目錄的 `GEMINI.md` 或 `AGENTS.md`。Antigravity 2.0 也記載全域 `~/.gemini/GEMINI.md`，以及位於 `.agents/rules` 下、工作區／Git 根目錄範圍的 Markdown Rules（並支援舊版 `.agent/rules`）。Rules 可以手動啟用、一律開啟、由模型選取，或透過萬用字元模式 (glob) 啟用
([最佳實務](https://antigravity.google/docs/cli/best-practices)、
[Rules 與 Workflows](https://antigravity.google/docs/rules-workflows))。

**待解問題 (open question)。** 第一方頁面並未定義當 `AGENTS.md` 與 `GEMINI.md` 並存、出現巢狀檔案，或全域／工作區 Rules 與 Skills 發生衝突時的確切優先順序。桌面版全域 Skills 與 CLI 全域 Skills 的文件記載目錄也不同。

## 工具與執行

Antigravity 2.0 提供檔案與命令操作、網頁搜尋／瀏覽器互動、Skills、MCP、計畫 (plans)、Subagents，以及可檢閱的 **Artifacts**，例如計畫、差異 (diffs)、圖解 (diagrams)、螢幕擷取畫面 (screenshots) 與瀏覽器錄製內容 (browser recordings)。其桌面介面使用視覺化檢閱窗格；Antigravity CLI 則另行記載鍵盤檢閱面板與終端機核准訊號
([概覽](https://antigravity.google/docs/overview)、
[Artifacts](https://antigravity.google/docs/artifacts))。IDE 導覽列出與 Artifact 相關的頁面，但該來源並未確立 IDE 具有相同的檢閱語意，也未確立任何 SDK Artifact 介面。Artifacts 可改善可檢查性 (inspectability)，但不能證明正確性、復原能力、保留政策或強制核准。

## 權限、信任與沙箱 (sandbox)

權限引擎 (permission engine) 涵蓋檔案、URL、命令、不受沙箱限制的操作 (unsandboxed operations)，以及 MCP，並採用 `Deny > Ask > Allow`。一般專案讀取與寫入會自動允許；未設定的命令、網頁／瀏覽器操作、MCP 及外部路徑通常會詢問。透過核准擴大的檔案、URL 或 MCP 授權只在目前回合 (turn) 內有效 ([權限](https://antigravity.google/docs/permissions))。

終端機沙箱機制 (terminal sandboxing) 是另一層，且預設停用。CLI 沙箱頁面記載 Linux nsjail、macOS `sandbox-exec` 與 Windows AppContainer，而統一的權限頁面則表示沙箱機制在 macOS／Linux 上為預覽版 (preview)，在 Windows 上則是「coming to Windows」。因此，Windows 沙箱可用性仍**未解決**，不能擅自統一為任一種說法
([CLI 沙箱](https://antigravity.google/docs/cli/sandbox))。**Antigravity for
IDEs Strict Mode** 會限制工作區外部存取、強制檢閱終端機／瀏覽器 JavaScript／Artifact 操作、啟用其終端機沙箱，並停用網路存取 ([IDE 設定](https://antigravity.google/docs/ide/settings))。
所引來源並未確立 Antigravity 2.0、CLI 或 SDK 具有完全相同的 Strict Mode 語意，而且此模式也不是抵禦提示注入 (prompt injection) 的保證。

!!! danger "事實 (Fact) — 已承認的安全性限制"
    Google Bug Hunters 承認仍有尚未解決的間接提示注入 (indirect prompt injection) 與本機檔案外洩問題類別，以及 Auto／Turbo 終端機政策下由提示驅動的命令執行。該公告未提供受影響或已修正的版本範圍
    ([已知問題](https://bughunters.google.com/learn/invalid-reports/ai-products/antigravity-known-issues))。

消費者與企業資料主張必須分開。Consumer Terms 表示 Google 會記錄並儲存服務互動；Settings 偏好設定 (preference) 控制特定的改善用途，員工或承包商可依 Terms 檢閱互動，而刪除則需要另行提出支援要求。文件未說明變更改善用途偏好設定會停用記錄或儲存。企業操作受 Google Cloud 條款與控制規範；即使主張在客戶私人環境中運作，仍包括將日誌寫入所選的 Cloud 專案，並不代表僅在裝置端處理
([條款](https://antigravity.google/terms)、
[企業版](https://antigravity.google/docs/enterprise))。

## 工作階段 (sessions) 與復原

CLI 對話歷程的範圍是 `agy` 執行所在的目錄，並可透過命令或 ID 續接。Hooks 參考資料記載 CLI 的持久本機日誌位於
`~/.gemini/antigravity-cli/brain/<conversationId>/.system_generated/logs/transcript.jsonl`，Antigravity
2.0 則使用平行的 `~/.gemini/antigravity/brain/...` 路徑 ([Hooks](https://antigravity.google/docs/hooks))。保留期限、刪除、加密，以及伺服器端是否另有副本仍無文件說明
([對話](https://antigravity.google/docs/cli/conversations))。CLI 可複製／匯入 Antigravity 2.0 對話串 (thread) 的歷程、上下文與工具軌跡 (tool trajectories)；文件未記載後續同步
([續接](https://antigravity.google/docs/cli/commands/resume))。`/fork` 分支的是對話歷程，而不是檔案。

## 擴充性

Skills 以漸進式揭露 (progressive disclosure) 方式載入 `SKILL.md`。持久 Rules 與以斜線叫用 (slash-invoked) 的程序式 Workflows 不同。本機 Command Hooks 涵蓋工具與叫用的執行前／後事件，另包括 Stop。Plugins 將具有命名空間 (namespaced) 的 Skills、Rules、Hooks 與 MCP 組合在一起；桌面版與 CLI Plugin 的目錄／生命週期不同。MCP 支援本機 stdio 與遠端 HTTP／SSE，並有數種驗證路徑，呼叫預設為 Ask ([Skills](https://antigravity.google/docs/skills)、
[Hooks](https://antigravity.google/docs/hooks)、
[MCP](https://antigravity.google/docs/mcp))。本機伺服器 (servers)、Hooks 與 Plugins 會執行已設定的程式碼，應納入擴充功能供應鏈邊界 (extension supply-chain boundary)。

獨立發行的 Google Antigravity SDK 支援工具 (tools)、Skills、MCP、政策 (policies)、核准 (approvals)、Hooks、工作階段、觸發器 (triggers) 與 Subagents。其發布公告將它稱為 **Research Preview**。已審查的
[Python SDK tree](https://github.com/google-antigravity/antigravity-sdk-python/tree/ac516c7709e3baf225c09d8b9d112b07b70066ff) 與
[授權條款](https://github.com/google-antigravity/antigravity-sdk-python/blob/ac516c7709e3baf225c09d8b9d112b07b70066ff/LICENSE) 採 Apache-2.0，而其
[固定版本 README](https://github.com/google-antigravity/antigravity-sdk-python/blob/ac516c7709e3baf225c09d8b9d112b07b70066ff/README.md) 表示可執行的 wheels 包含已編譯的平台 runtime。已審查的完整公開 tree 未顯示該 runtime 的原始碼；這是截至資料截點對 tree 的觀察 (observation)，並非聲稱其他地方不存在未公開的原始碼
([SDK 公告](https://antigravity.google/blog/introducing-google-antigravity-sdk))。

## 協調與編排 (orchestration)

父代理工具 (parent agents) 可以用全新上下文啟動平行的背景 Subagents。模式包括 inherit、branch（一個 Git 工作樹 (worktree)）與 share；父代理工具的安全範圍 (parent safety scopes) 會流向子代理工具，核准會回到主要介面，代理工具可向已知的親屬／同儕 (relatives/peers) 傳送訊息，而巢狀層級上限為十層。付費方案的 **Teamwork** 是不同的高階功能，不是一般 Subagents 的同義詞
([Subagents](https://antigravity.google/docs/subagents/))。

Scheduled Tasks 會建立週期性背景對話；Sidecars 是採用類似 cron 排程與重新啟動政策的受管理背景處理程序。其時區、錯過執行、重疊、身分、沙箱、機密資料 (secrets)、網路及資源語意均未明確說明 ([Sidecars](https://antigravity.google/docs/sidecars/))。
Remote Control 是另一個邊界：瀏覽器／行動用戶端 (browser/mobile clients) 會操作桌面版或無頭主機 (host)，但工作仍需要該主機保持上線
([Remote Control](https://antigravity.google/docs/remote-control))。

## 模型與供應商邊界 (model/provider boundary)

已發布的多模型矩陣 (multi-model matrix) 僅適用於 Antigravity 2.0，並隨方案而異；它無法證明 CLI、IDE、SDK 或 Enterprise 的可用性完全相同，也無法證明支援任意供應商 ([模型](https://antigravity.google/docs/models))。
SDK 文件記載 Gemini API 與 Gemini Enterprise Agent Platform／Vertex 路徑。其固定版本的 [v0.1.15 變更日誌](https://github.com/google-antigravity/antigravity-sdk-python/blob/ac516c7709e3baf225c09d8b9d112b07b70066ff/google/antigravity/CHANGELOG.md) 記錄了透過 LiteRT-LM 執行的本機 Gemma，以及 Ollama、LM Studio 或 vLLM 等與 OpenAI 相容的本機端點；這些本機路徑也已加入 MCP 與 Subagent 支援。這無法確立支援代管 OpenAI、任意供應商的功能均等性 (arbitrary-provider parity)，或其他 Antigravity 介面採用相同後端。一則公告將遠端 Google Cloud 代理工具框架執行稱為規劃中項目 (roadmap)，之後一篇 Google Cloud 文章卻表示部署需要「zero code changes」；目前 SDK 文件未提供相符的遠端部署程序。實際可用性仍是**待解問題 (open question)**。

## 平台/授權/狀態

Antigravity 2.0 記載 macOS 12+、Windows 10+ 與 Linux 需求。然而，同一個第一方平台介面一方面表示不支援 x86 Mac，另一方面卻提供 Intel 下載；Intel 支援仍未解決，而非不存在
([開始使用](https://antigravity.google/docs/getting-started))。

不得將 Gemini CLI 的 Apache-2.0 授權轉移至 Antigravity CLI。截至資料截點，已完整審查的 [位於 `556846a4` 的 Antigravity CLI tree](https://github.com/google-antigravity/antigravity-cli/tree/556846a4bb94117222f53846896c7eb0d645307e) 包含文件／範例，但沒有根目錄授權條款、建置資訊清單 (build manifest) 或實作 tree。因此，該固定版本的公開 tree 並未確立開放原始碼授權，所以本文不會將 CLI 標示為開放原始碼；這不代表儲存庫外部沒有任何適用條款。SDK 的 Apache-2.0 聲明適用於該儲存庫／套件範圍，但須注意前述已編譯 runtime 的但書；它不會授權整個平台或代管服務。

## 變更訊號

[2025 年 11 月的發布](https://developers.googleblog.com/build-with-google-antigravity-our-new-agentic-development-platform/)明確標示為公開預覽版 (public preview)；目前頁面未釐清每個介面的 GA、穩定性、支援期限或 SLA。SDK 的 Research Preview 標籤與此不同。變更日誌所載的推出會逐步進行，而四項產品採用獨立版本。絕不可將資料截點簡寫為「desktop/IDE 2.11.0」：v2.11.0 是 Antigravity 2.0，IDE／編輯器整合則是 v2.5.5。

## 待解問題

**待解問題 (open questions)。** Google 將統一採用哪些命名與生命週期標籤？Windows 沙箱機制是否可用，Intel 下載可用性對支援而言又代表什麼？消費者對話與 Artifacts 儲存在何處、保留多久？SDK 雲端代理工具框架部署是否可實際運作？Sidecar 排程器與隔離語意為何？每個獨立版本介面各自可使用哪些模型？

## 主要來源

- [Google Antigravity 文件](https://antigravity.google/docs/home)
- [權限](https://antigravity.google/docs/permissions)與 [CLI sandbox](https://antigravity.google/docs/cli/sandbox)
- [Subagents](https://antigravity.google/docs/subagents)與[模型](https://antigravity.google/docs/models)
- [Gemini CLI 轉換](https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/)
- [已知安全性問題](https://bughunters.google.com/learn/invalid-reports/ai-products/antigravity-known-issues)
