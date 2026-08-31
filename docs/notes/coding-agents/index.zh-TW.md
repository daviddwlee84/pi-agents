---
kind: research-landscape
status: reviewed
as_of: 2026-08-31
last_verified: 2026-08-31
upstreams:
  - https://pi.dev/docs/latest
  - https://omp.sh/docs/using
  - https://www.deepseek.com/harness/en/
  - https://code.claude.com/docs/en/overview
  - https://developers.openai.com/blog/codex-as-a-platform
  - https://cursor.com/docs/agent/overview
  - https://opencode.ai/docs/
  - https://geminicli.com/docs/
  - https://antigravity.google/docs/home
confidence: high
---

# 程式開發代理工具版圖

這份盤點整理了九項程式開發代理工具 (coding agent) 產品的使用介面 (interfaces)。它不是功能對等比較表、採用率排名或基準評測 (benchmark)。即使操作介面 (surface) 的概略名稱相同，實際執行位置仍可能是本機程序、供應商虛擬機器 (vendor VM) 或使用者自主管理的服務，所用工具、權限、儲存方式與發布節奏也可能不同。

!!! note "觀察 (Observation) — 編者分類 (Editorial classification)"
    比較單位是**產品層級的代理工具框架家族 (product-level agent harness family)**，而非模型、供應商、套件或個別執行檔。因此，各列會將關係密切的第一方介面歸為一組，但各儲存格仍保留不同的操作介面。這是供導覽使用的編者分類法 (editorial taxonomy)，而非上游標準。

本站將代理工具框架 (harness) 定義為一個層級：它會彙整指示與脈絡、選擇工具、執行代理迴圈 (agent loop)、調節授權範圍，並在一或多個模型外圍管理工作階段 (sessions)。關於本專案採用的工作模型，請參閱 [Pi 概覽](../pi/overview.md)、[代理工具框架工程](../pi/harness-engineering.md)與較廣泛的[生態系筆記](../ecosystem/index.md)。

## 操作介面盤點

**事實 (Fact)。** 以下項目是截至本次資料截點，經審閱的第一方來源所支援的操作介面名稱。「未列出」表示本盤點未找出對應的第一方操作介面；這並不能證明整合功能或第三方用戶端不存在。

| 產品家族 | 終端機或本機互動介面 | 編輯器或桌面介面 | 瀏覽器或受管理介面 | 自動化或通訊協定 | 嵌入介面 (embedding surface) |
| --- | --- | --- | --- | --- | --- |
| [Pi](../pi/overview.md) | 互動式終端機；列印模式 (print mode) | 未列出 | 未列出 | JSON 事件模式；子程序 JSON RPC；另有獨立的實驗性遠端通訊協定／伺服器 | `@earendil-works/pi-coding-agent` 軟體開發套件 (software development kit, SDK) |
| [Oh My Pi (OMP)](../ecosystem/oh-my-pi.md) | `omp` 文字使用者介面 (text user interface, TUI)；`omp -p` | 未列出；「IDE wired in」是產品定位，並非獨立的編輯器產品 | 未列出 | stdio RPC、`rpc-ui`、ACP | Bun/TypeScript SDK；以程序為後端的 Python RPC 用戶端 |
| [DeepSeek Harness](../ecosystem/deepseek-harness.md) | `dsh`；單次執行的無介面設定檔 (one-shot headless profile) | 未列出 | 本機瀏覽器網頁使用者介面 (Web UI) | JSON-RPC SDK 設定檔；ACP stdio 設定檔 | TypeScript 與 Python SDK 用戶端驅動 Harness 程序 |
| [Claude Code](claude-code.md) | 終端機命令列介面 (command-line interface, CLI) | VS Code、JetBrains、Desktop | 透過網頁與行動裝置存取；Cloud 與 Remote Control 是不同的執行模式 | 非互動式 CLI 工作流程 (workflows) | Python 與 TypeScript 的 Claude Agent SDK |
| [OpenAI Codex](codex.md) | Codex CLI TUI；`codex exec` | Codex 整合開發環境擴充功能 (integrated development environment extension, IDE extension)；ChatGPT 桌面應用程式中的 Codex | Codex 雲端／網頁介面 | App Server；逐行 JSON (JSON Lines, JSONL) 自動化 | TypeScript 與 Python Codex SDK |
| [Cursor](cursor.md) | `agent`；無介面模式 (headless) 的 `agent -p` | Cursor 編輯器／Desktop | 由多種用戶端操作、Cursor 管理的 Cloud Agents | ACP；Cloud Agents API | `@cursor/sdk`；SDK Bridge |
| [OpenCode](opencode.md) | TUI；CLI 與 `run` | 測試版 Desktop App；IDE 整合 | OpenCode 伺服器外層的瀏覽器 UI | 無介面伺服器 (headless server)；ACP | 自動產生的 `@opencode-ai/sdk` 用戶端 |
| [Gemini CLI](gemini-cli.md) | `gemini` 讀取－求值－輸出迴圈 (read-eval-print loop, REPL)；無介面的文字／JSON／JSONL 模式 | IDE 伴隨整合功能 (companion integration) | 瀏覽器代理工具 (Browser agent) 是工具／子代理工具 (subagent)，而非託管 UI | ACP；遠端代理工具使用 A2A | 初始版 `@google/gemini-cli-sdk` |
| [Google Antigravity](antigravity.md) | Antigravity CLI/TUI | Antigravity 2.0 Desktop；另有獨立版本管理的 IDE／編輯器整合 | 連至主機的 Remote Control 網頁／行動介面；排程／背景工作流程 | 輔助程序 (sidecars) 與代理工具協調編排 (agent orchestration) | 獨立版本管理的 Python 版 Google Antigravity SDK |

## 重要邊界

- **產品不等於模型。** Claude Code 不等於 Claude 模型家族；Codex 用戶端與雲端工作並非單一模型；Gemini CLI 與 Antigravity 則是圍繞模型服務建構的代理工具框架產品。
- **共同源流不代表功能對等。** OMP 是有自己 `omp` 產品的分支版本 (fork)，而非 Pi 擴充功能 (extension)。DeepSeek Harness 有自己的 Cordis 執行階段 (runtime)；在轉接器 (adapter) 中使用 Pi 的 `pi-ai` 程式庫，並不會使它成為 Pi。
- **共用引擎不表示同一套發布版本。** 即使第一方來源描述它們採用共用的代理工具框架機制，Claude Code 介面、Codex 用戶端、Cursor 本機與雲端代理工具，以及 Antigravity 操作介面，在執行位置與生命週期上仍有所不同。
- **通訊協定與 SDK 不同。** ACP、MCP、A2A、JSON RPC 與產品 SDK 解決的是不同的整合問題。列出其中一項，不表示也具備其他項目。
- **授權範圍有多個面向。** 核准提示、專案信任、作業系統沙箱機制 (OS sandboxing)、工作樹 (worktrees)、受管理虛擬機器、網路政策與憑證隔離，都是彼此獨立的控制措施。

!!! warning "推論 (Inference) 邊界"
    任何一列均不表示某項產品更安全、能力更強或更適合特定工作。要得出這類結論，必須在相同的儲存庫、模型存取權、指示、工具政策與驗證準則下進行對照評估 (controlled evaluation)。

## 變更訊號

這些產品透過不同管道演進：具標籤的發布版本、可變動的文件、預設分支、託管服務逐步推出，以及預覽計畫。產品資料頁會標註具版本時效性之主張的日期，並區分發布成品與針對 `main`、`dev` 或託管文件所做的觀察。在將某份資料頁用於安全政策、相容性承諾或採購決策前，請重新查核。

## 主要來源

- [Pi 文件](https://pi.dev/docs/latest)
- [OMP 使用文件](https://omp.sh/docs/using)
- [DeepSeek Harness 概覽](https://www.deepseek.com/harness/en/)
- [Claude Code 概覽](https://code.claude.com/docs/en/overview)
- [OpenAI Codex 文件](https://developers.openai.com/blog/codex-as-a-platform)
- [Cursor Agent 概覽](https://cursor.com/docs/agent/overview)
- [OpenCode 文件](https://opencode.ai/docs/)
- [Gemini CLI 文件](https://geminicli.com/docs/)
- [Google Antigravity 文件](https://antigravity.google/docs/home)
