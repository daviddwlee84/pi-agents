---
kind: product-note
status: reviewed
as_of: 2026-08-31
last_verified: 2026-08-31
upstreams:
  - https://pi.dev/
  - https://pi.dev/news/2026/5/7/pi-has-a-new-home
  - https://github.com/earendil-works/pi/releases/tag/v0.84.4
  - https://api.github.com/repos/earendil-works/pi/releases?per_page=20
  - https://github.com/earendil-works/pi/blob/v0.84.4/README.md
  - https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/package.json
  - https://pi.dev/docs/latest/usage
  - https://pi.dev/docs/latest/providers
  - https://github.com/earendil-works/pi/blob/v0.84.4/packages/ai/README.md
  - https://pi.dev/docs/latest/windows
  - https://pi.dev/docs/latest/termux
  - https://github.com/earendil-works/pi/blob/v0.84.4/LICENSE
confidence: high
---

# Pi 概覽

Pi 自稱是**極簡代理框架 (minimal agent harness)**：這是一個小型的程式設計代理
(coding agent) 核心，預期透過設定與擴充套件 (Extension) 塑造，而不是隨附一整套
工作流程 (workflow) 目錄。它的呈現方式以終端機為優先，但不僅限於終端機：產品也提供
列印／JSON 模式 (print/JSON modes)、標準輸入／輸出 RPC (stdio RPC)，以及軟體開發套件
(SDK)（[Pi](https://pi.dev/)、[使用方式](https://pi.dev/docs/latest/usage)）。

> **事實 (Fact) — 快照範圍。** 本頁以 2026-08-28 發布的 `v0.84.4`
> 作為發行版本快照 (release snapshot)。它是截至 2026-08-31 觀察到最新的已發布、
> 非草稿且非預發布版本。這項描述**不**代表穩定版、LTS 或受到正式環境支援；Pi 並未
> 發布相應的生命週期 (lifecycle) 或支援版本承諾。[官方發行版本 API](https://api.github.com/repos/earendil-works/pi/releases?per_page=20)
> 提供截點排序以及 `draft`／`prerelease` 旗標；
> [不可變標籤 (immutable tag)](https://github.com/earendil-works/pi/releases/tag/v0.84.4)
> 則固定了發行版本內容。

## 主要上游與遷移

目前的主要上游 (canonical upstream) 是
[`earendil-works/pi`](https://github.com/earendil-works/pi)。Pi 於 2026-05-07 宣布
從 `badlogic/pi-mono` 長期遷移至此。npm 套件範圍 (package scope) 從
`@mariozechner/*` 移至 `@earendil-works/*`，但可執行檔 (executable) 仍為 `pi`；
舊範圍的 `0.73.1` 是過渡終點，新範圍的發行版本則從 `0.74.0` 開始。原有設定與
工作階段 (session) 原先預期會留在原處；舊套件已棄用 (deprecated)，而未成為目前的
產品身分（[遷移公告](https://pi.dev/news/2026/5/7/pi-has-a-new-home)）。

新工作應使用目前的儲存庫 (repository) 與套件名稱。歷史名稱只有在說明遷移或解讀
舊連結時才有用。

## 刻意保持極簡

Pi 首頁明確列出核心未隨附的幾項功能：MCP、子代理 (subagent)、權限對話框
(permission dialogs)、規劃模式 (plan mode)、內建待辦事項追蹤 (to-do tracking)，
以及背景 shell 執行 (background shell execution)。它提出的解法是組合
(composition)——使用 Extension、Pi package、容器 (container)、`tmux` 或其他外部
機制——而不是隱藏的內建功能（[Pi](https://pi.dev/)）。

> **觀察 (Observation)。**「極簡」是供應商定位 (vendor positioning)，並不是聲稱
> Pi 的元件最少、攻擊面 (attack surface) 最小，或任務品質優於其他代理框架。

預設的跨平台工具是 `read`、`write`、`edit` 與 `bash`。`grep`、`find` 和 `ls`
是額外的內建工具；`powershell` 為選用項目且僅適用於 Windows。旗標可建立工具的允許
清單 (allowlist)、排除工具或停用工具（[使用方式](https://pi.dev/docs/latest/usage)）。
預設工具少並不會降低工具權限：除非另外加上外部邊界，否則處理程序 (process) 及其
載入的 Extension 都會以啟動者的使用者權限運作。

## 套件職責

v0.84.4 README 列出單一儲存庫 (monorepo) 中五個主要套件
（[帶標籤的 README](https://github.com/earendil-works/pi/blob/v0.84.4/README.md)）：

| 套件 | 職責 |
| --- | --- |
| `@earendil-works/pi-ai` | 面向供應商／模型 (provider/model-facing) 的大型語言模型 API (LLM API) 與串流 (streaming) |
| `@earendil-works/pi-agent-core` | 代理迴圈 (agent loop)、狀態、工具、佇列與事件 |
| `@earendil-works/pi-tui` | 終端機算繪 (terminal rendering) 與使用者介面 (UI) 元件 |
| `@earendil-works/pi-coding-agent` | `pi` CLI、工作階段、資源與整合模式 |
| `@earendil-works/pi-telemetry` | 供應商中立的遙測 (telemetry) 合約；預設不含匯出器 (exporter) |

> **編者分類 (Editorial classification)。** 這些是文件記載的套件與職責，並不是正式宣告的五層架構。
> `pi-telemetry` 是橫跨各層的項目 (cross-cutting)，而 README 清單也不是完整的
> 工作區清單 (workspace inventory)。

v0.84.4 原始碼樹 (source tree) 還包含
[`@earendil-works/pi-client`](https://github.com/earendil-works/pi/blob/v0.84.4/packages/client/package.json)、
[`@earendil-works/pi-protocol`](https://github.com/earendil-works/pi/blob/v0.84.4/packages/protocol/package.json)、明確標示為實驗性的
[`@earendil-works/pi-server`](https://github.com/earendil-works/pi/blob/v0.84.4/packages/server/package.json)、Node
[SQLite 工作階段後端 (session backend)](https://github.com/earendil-works/pi/blob/v0.84.4/packages/session-backends/sqlite-node/package.json)，以及私有 (private) 的
[evals 工作區](https://github.com/earendil-works/pi/blob/v0.84.4/packages/evals/package.json)。這些是**原始碼快照觀察**，並不是聲稱它們全都是穩定的公開產品介面。

**Pi package** 與上述 npm 工作區套件是不同概念：前者是 Extension、skill、提示範本
(prompt template) 與佈景主題 (theme) 的發行單位 (distribution unit)。不應將這些
概念一概稱為「外掛 (plugin)」。

## 使用者與整合介面

Pi 支援四種主要方式來驅動程式設計代理迴圈：

- 互動式 TUI，包括引導 (steering) 與後續訊息佇列；
- 列印模式，以及以換行分隔的 JSON 生命週期／串流輸出；
- 透過子處理程序 (child process) 的 stdin/stdout 雙向傳輸、以 LF 分隔的 JSON RPC；以及
- 透過 `@earendil-works/pi-coding-agent` 進行 SDK 嵌入 (SDK embedding)。

在截點提交版本 (cutoff commit) `853a80d` 中，另有一套遠端工作階段堆疊
(remote-session stack)——`pi-client`、`pi-protocol` 與 `pi-server`。它使用帶四位元組
長度前綴、採明確長度編碼的 CBOR (four-byte-length-prefixed, definite-length CBOR)，並不是 CLI
以 LF 分隔的 JSON [RPC 模式](https://pi.dev/docs/latest/rpc)。固定版本的
[protocol README](https://github.com/earendil-works/pi/blob/853a80d26c90a14c1886f0ebb8ffaae133ca2185/packages/protocol/README.md) 未提供相容性承諾，而
[server README](https://github.com/earendil-works/pi/blob/853a80d26c90a14c1886f0ebb8ffaae133ca2185/packages/server/README.md) 則將伺服器標示為實驗性。

## 供應商邊界

在 `pi-ai` 中，`Provider` 負責供應商身分、身分驗證 (authentication)、模型目錄
(model catalogue) 與串流行為；`Model` 則包含供應商專屬 ID，以及功能、限制與成本的
中繼資料 (metadata)。呼叫會透過所屬供應商路由，而認證資訊 (credentials)、標頭
(headers)、取消作業 (cancellation) 與供應商專屬選項，仍是每次請求 (request) 的考量
事項（[`pi-ai` README](https://github.com/earendil-works/pi/blob/v0.84.4/packages/ai/README.md)）。
`models.json` 可設定支援的 API 形式 (API shapes)；非標準身分驗證、動態探索或自訂串流，
則需要由 Extension 定義的供應商。

現行供應商頁面是一份具時效性的目錄，並將 Google Vertex AI 列為獨立的雲端路徑
(cloud path)。其中的「login」項目並不共用同一種使用權 (entitlement) 或計費模式：
例如，第三方代理框架若使用 Claude Pro/Max，須仰賴另行計費的額外用量；OpenRouter
OAuth 會建立由使用者控制、從 OpenRouter 點數扣款的金鑰；Radius 是 OAuth 閘道；
xAI 也支援 API 金鑰。應將這些描述為各不相同的身分驗證路徑，而不是一致的「訂閱存取
(subscription access)」（[供應商](https://pi.dev/docs/latest/providers)）。
供應商的選擇也會決定提示 (prompt) 傳送至何處，以及適用哪一家供應商的資料保留、
模型訓練、資料落地位置與計費條款；Pi 的設定文件並未建立單一的下游資料政策。

## 平台、執行環境與授權

帶標籤的 coding-agent 套件需要 Node.js `>=22.19.0`，並提供 `pi` 二進位執行檔
(binary)（[資訊清單 (manifest)](https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/package.json)）。
第一方指南記載如何透過 Git Bash 在 Windows 上使用，並可選用 PowerShell；Android 則
透過 Termux 使用。在 ARM64 Termux 上，部分選用的原生相依套件 (native dependencies)
會被略過，而且無法貼上剪貼簿中的圖片（[Windows](https://pi.dev/docs/latest/windows)、
[Termux](https://pi.dev/docs/latest/termux)）。這些指南描述的是工作流程，並不是完整的
支援矩陣 (support matrix)。

儲存庫中的程式碼採 MIT 授權；帶標籤的授權內容為「Copyright (c) 2025 Mario
Zechner」，目前網站則另行將維護責任 (stewardship) 歸於 Earendil Inc. 與貢獻者
（[授權](https://github.com/earendil-works/pi/blob/v0.84.4/LICENSE)）。該程式碼授權並未
確立第三方模型、供應商或服務的條款。

## 主要來源

- [Pi 首頁與產品定位](https://pi.dev/)
- [遷移至 Earendil](https://pi.dev/news/2026/5/7/pi-has-a-new-home)
- [Pi v0.84.4 發行版本](https://github.com/earendil-works/pi/releases/tag/v0.84.4)
- [v0.84.4 monorepo README](https://github.com/earendil-works/pi/blob/v0.84.4/README.md)
- [供應商文件](https://pi.dev/docs/latest/providers)
- [`pi-ai` 套件文件 (v0.84.4)](https://github.com/earendil-works/pi/blob/v0.84.4/packages/ai/README.md)
- [v0.84.4 MIT 授權](https://github.com/earendil-works/pi/blob/v0.84.4/LICENSE)
