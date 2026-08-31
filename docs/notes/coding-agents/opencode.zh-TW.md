---
kind: product-profile
status: reviewed
as_of: 2026-08-31
last_verified: 2026-08-31
upstreams:
  - https://opencode.ai/docs/
  - https://opencode.ai/docs/server/
  - https://opencode.ai/docs/agents/
  - https://opencode.ai/docs/permissions/
  - https://opencode.ai/docs/providers/
  - https://opencode.ai/docs/share/
  - https://github.com/anomalyco/opencode/blob/10765ff2a9da8c3b88e4de873aa383a49c318912/SECURITY.md
  - https://github.com/anomalyco/opencode/releases/tag/v1.18.25
  - https://api.github.com/repos/anomalyco/opencode/releases/latest
confidence: high
---

# OpenCode

## 範圍與介面

OpenCode 是「為終端機打造」的開放原始碼程式開發代理工具 (open-source coding agent)，但不僅限於 TUI。`opencode [project]` 會開啟 TUI，而 `opencode run`、`serve`、`web`、`attach` 與 `acp` 則提供其他工作流程 (workflows)。一般 TUI 會啟動 OpenCode 伺服器 (server) 並作為其用戶端 (client)；相同架構也支援瀏覽器 UI、測試版 (beta) Desktop App、IDE／ACP 用戶端、無頭伺服器，以及產生的 JavaScript／TypeScript SDK ([CLI](https://opencode.ai/docs/cli/)、[server](https://opencode.ai/docs/server/))。

**事實 (Fact)。** 採 MIT 授權的 OpenCode 用戶端與 **OpenCode Zen** 是不同事物。Zen 是由 OpenCode 維護的選用模型閘道／供應商 (model gateway/provider)；使用該用戶端並不需要 Zen ([Zen](https://opencode.ai/docs/zen/))。

## 指示與上下文

OpenCode 會向上尋找專案 `AGENTS.md`，並讀取全域的 `~/.config/opencode/AGENTS.md`。若 OpenCode 原生檔案不存在，它可以使用專案／全域 `CLAUDE.md`，以及與 Claude 相容的 Skill 位置。`instructions` 設定可加入檔案、萬用字元模式 (globs) 或遠端 URL；僅寫在 `AGENTS.md` 內的引用不會自動展開
([rules](https://opencode.ai/docs/rules/))。

設定會從數個層級合併 (merge)，而不是整批取代。文件列出了有編號的優先順序 (precedence)，但另行討論 `OPENCODE_CONFIG_DIR`，未交代它相對於每一層的位置。應將完整優先順序視為**待解問題 (open question)**，而不是已確立的全序關係 (total order)
([設定](https://opencode.ai/docs/config/))。

## 工具與執行

文件記載的工具包括 `bash`、檔案讀取/搜尋/編輯/寫入操作、`apply_patch`、`skill`、`todowrite`、網頁擷取/搜尋、提問，以及實驗性、可由模型呼叫的 `lsp` 工具。`edit` 權限涵蓋所有會修改檔案的工具，而萬用字元群組可比對內建與 MCP 工具
([工具](https://opencode.ai/docs/tools/))。選用的 LSP 伺服器診斷是另一項功能，與該實驗性 `lsp` 工具不同。

## 權限、信任與沙箱 (sandbox)

規則會解析為 `allow`、`ask` 或 `deny`；依序套用的模式規則採用最後一次比對結果。多數權限預設為 `allow`。`external_directory` 與重複且完全相同的 `doom_loop` 呼叫預設為 `ask`；讀取通常允許，但 `.env` 除外，而 `.env.example` 則允許讀取。「always」核准只在目前工作階段 (session) 內有效，而 `--auto` 會將詢問轉為核准，但絕不會覆寫明確的拒絕
([權限](https://opencode.ai/docs/permissions/))。

!!! warning "事實 (Fact) — 權限並非隔離"
    OpenCode 的安全政策明確表示，它**不會**將代理工具放入沙箱。提示用於讓使用者知情並要求確認，而不提供圍堵 (containment)；需要隔離時，專案建議使用 Docker 或虛擬機器 (VM)
    ([安全政策](https://github.com/anomalyco/opencode/blob/10765ff2a9da8c3b88e4de873aa383a49c318912/SECURITY.md))。

`opencode serve` 預設繫結至 `127.0.0.1:4096`，並於 `/doc` 公開 OpenAPI。除非設定 `OPENCODE_SERVER_PASSWORD`，否則伺服器不會進行身分驗證 (authentication)。變更繫結位址或啟用探索 (discovery) 因此會改變網路邊界
([server](https://opencode.ai/docs/server/))。

## 工作階段與復原

工作階段會**持久儲存在本機 (persisted locally)**，並透過 TUI、CLI、伺服器與 SDK 公開。工作階段可續接、分支 (fork)、摘要、還原、匯出，也可連結為父／子工作階段。「持久儲存」是刻意選用的措辭：文件並未承諾備份、同步、結構描述穩定性 (schema stability)、保留期限或持久傳遞 (durable delivery)
([疑難排解](https://opencode.ai/docs/troubleshooting/))。系統支援自動與手動壓縮 (compaction)，但未記載觸發條件與摘要保真度保證 (summary-fidelity guarantees)。

分享是另一項代管操作。`/share` 會上傳完整對話與中繼資料，並建立任何取得連結者皆可使用的連結，直到執行 `/unshare` 為止；`share: "disabled"` 會禁止分享 ([分享](https://opencode.ai/docs/share/))。OpenCode 的[企業版文件](https://opencode.ai/docs/enterprise/)表示，其服務不會儲存程式碼或上下文；這項伺服器端主張不涵蓋明確分享的對話或已設定的模型供應商。因此，一般模型呼叫、本機工作階段檔案、選用分享，以及供應商端保留各自是不同的資料路徑。

## 擴充性

Agent Skills 是按需載入 (on-demand) 的 `SKILL.md` 套件，會在 OpenCode 原生路徑、`.claude/skills` 與 `.agents/skills` 路徑中尋找。自訂 Agents 會定義角色、模型、工具與權限；命令 (commands) 是可重複使用的提示範本 (prompt templates)。JavaScript 或 TypeScript Plugins 會註冊 Hooks 與工具，而自訂工具會收到工作階段、代理工具、目錄及工作樹 (worktree) 上下文。Plugins 與自訂工具會執行本機程式碼，且沒有文件記載的 Plugin 沙箱，也可能取代內建名稱
([Skills](https://opencode.ai/docs/skills/)、
[plugins](https://opencode.ai/docs/plugins/)、
[自訂工具](https://opencode.ai/docs/custom-tools/))。

系統支援本機子處理程序與遠端 HTTP MCP 伺服器，包括 OAuth 與工具篩選器 (tool filters)。已啟用的結構描述 (schemas) 會進入模型上下文，因此需要檢視伺服器信任與上下文成本 ([MCP](https://opencode.ai/docs/mcp-servers/))。產生的 `@opencode-ai/sdk` 可以啟動或連線至伺服器並串流事件；其文件未陳述正式相容性政策
([SDK](https://opencode.ai/docs/sdk/))。

## 協調與編排 (orchestration)

OpenCode 會區分 **Primary Agents** 與 **Subagents**。Primary Agents 透過 Task 叫用 Subagents；使用者也可用 `@agent-name` 直接叫用；每次委派都會建立一個子工作階段。`permission.task` 控制的是代理工具間呼叫 (Agent-to-Agent calls)，而非使用者直接叫用；`hidden` 只是從自動完成 (autocomplete) 移除名稱，並不會讓該名稱無法存取
([agents](https://opencode.ai/docs/agents/))。

文件記載 General Subagent 可以平行執行多個工作單元。這是委派式平行工作，而不是持久團隊系統 (persistent team system) 的證據：排程保證、並行限制、共用團隊狀態、代理工具間訊息、工作樹 (worktree) 隔離與合併語意均未明確說明。

## 模型與供應商邊界 (model/provider boundary)

OpenCode 使用 AI SDK 與 Models.dev，並宣稱支援 **「75+ LLM providers」**。這是註明來源、形同下限的主張，而不是經稽核的確切數量，也無法證明功能一致。模型使用 `provider/model` 識別字；並支援本機及自行代管、與 OpenAI 相容的端點。驗證資訊可能來自 `/connect`、環境變數、OAuth、供應商 CLI (provider CLIs) 或雲端憑證鏈 (credential chains) ([供應商](https://opencode.ai/docs/providers/)、
[模型](https://opencode.ai/docs/models/))。供應商計費、保留政策、地區、工具支援與上下文限制仍因供應商而異。

## 平台/授權/狀態

CLI 發行於 macOS、Linux 與 Windows；Windows 指南建議使用 WSL，以符合開發工具與檔案系統的預期行為。README 將 Desktop 標為 **BETA**，下載連結卻使用 `stable` 更新頻道；這是兩個僅適用各自來源的標籤，無法確立所有介面皆已普遍可用 (GA) 或功能相同
([下載](https://opencode.ai/download))。用戶端儲存庫採 [MIT 授權](https://github.com/anomalyco/opencode/blob/10765ff2a9da8c3b88e4de873aa383a49c318912/LICENSE)；該授權不規範 Zen、模型服務或第三方整合。

## 變更訊號

截至資料截點，GitHub 最新的非草稿、非預發行 (prerelease) 發行版本是
[v1.18.25](https://github.com/anomalyco/opencode/releases/tag/v1.18.25)，
發布於 2026-08-28；[官方發行 API](https://api.github.com/repos/anomalyco/opencode/releases/latest) 提供了這項觀察 (observation) 所依據的排序，以及草稿／預發行 (draft/prerelease) 旗標。已審查的即時文件追蹤 `dev`，不一定對應發行版本的提交 (commit)。因此，若未檢查標籤 (tag)，就不得將對 `dev` 的觀察回推至 v1.18.25。

## 待解問題

**待解問題 (open questions)。** 工作階段與憑證的保留／加密屬性為何？確切採用何種壓縮門檻與保存政策？`OPENCODE_CONFIG_DIR` 相對於每個設定來源如何排序？對指定版本而言，哪一個 SDK 結構化輸出欄位與相容性契約才是規範？

## 主要來源

- [OpenCode 文件](https://opencode.ai/docs/)
- [Agents](https://opencode.ai/docs/agents/)與[權限](https://opencode.ai/docs/permissions/)
- [Server](https://opencode.ai/docs/server/)與 [SDK](https://opencode.ai/docs/sdk/)
- [安全政策](https://github.com/anomalyco/opencode/blob/10765ff2a9da8c3b88e4de873aa383a49c318912/SECURITY.md)
- [v1.18.25 發行版本](https://github.com/anomalyco/opencode/releases/tag/v1.18.25)
