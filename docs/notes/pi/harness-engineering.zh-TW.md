---
kind: engineering-note
status: reviewed
as_of: 2026-08-31
last_verified: 2026-08-31
upstreams:
  - https://pi.dev/docs/latest/usage
  - https://pi.dev/docs/latest/security
  - https://pi.dev/docs/latest/extensions
  - https://pi.dev/docs/latest/skills
  - https://pi.dev/docs/latest/packages
  - https://pi.dev/docs/latest/sessions
  - https://pi.dev/docs/latest/session-format
  - https://pi.dev/docs/latest/compaction
  - https://pi.dev/docs/latest/sdk
  - https://pi.dev/docs/latest/json
  - https://pi.dev/docs/latest/rpc
  - https://pi.dev/docs/latest/providers
  - https://pi.dev/docs/latest/environment-variables
  - https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/src/core/auth-storage.ts
  - https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/src/core/telemetry.ts
  - https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/src/core/provider-attribution.ts
  - https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/src/modes/interactive/session-share.ts
  - https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/src/modes/interactive/interactive-mode.ts
  - https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/docs/settings.md
  - https://github.com/earendil-works/pi/blob/853a80d26c90a14c1886f0ebb8ffaae133ca2185/packages/protocol/README.md
  - https://github.com/earendil-works/pi/blob/853a80d26c90a14c1886f0ebb8ffaae133ca2185/packages/server/README.md
  - https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/examples/extensions/subagent/README.md
  - https://github.com/earendil-works/pi/security/advisories/GHSA-7v5m-pr3q-6453
  - https://github.com/earendil-works/pi/security/advisories/GHSA-r95r-rj6r-c39x
  - https://github.com/earendil-works/pi/security/advisories/GHSA-jfgx-wxx8-mp94
  - https://github.com/earendil-works/pi/security/advisories/GHSA-mqxh-6gq7-558m
confidence: high
---

# Pi 代理框架工程

本頁以 v0.84.4 發行版本快照 (release snapshot) 為準，檢視 Pi 作為可工程化代理框架
(engineerable harness) 的特性；其中對儲存庫 (repository) `main` 的觀察，均明確標示為
截至 2026-08-31 的檢查結果。本文說明機制與邊界，並不是獨立的資安稽核
(security audit)。

## 指令與資源探索

Pi 啟動時會先載入全域的 `~/.pi/agent/AGENTS.md`，接著從目前工作目錄及其上層目錄
逐層尋找 `AGENTS.md` 或 `CLAUDE.md`。在同一個目錄內，`AGENTS.override.md` 會取代
該目錄的一般情境檔案 (context file)；在其他目錄找到的檔案仍會分層套用。`SYSTEM.md`
會取代預設系統提示 (system prompt)，`APPEND_SYSTEM.md` 則附加於其後
（[使用方式](https://pi.dev/docs/latest/usage)）。

專案信任 (project trust) 會管控特定專案資源：設定、Extension、skill、提示範本
(prompt template)、佈景主題 (theme)、套件資源，以及系統提示檔案。依文件記載的目前
行為，除非停用情境載入 (context loading)，否則它**不會**管控
`AGENTS.override.md`、`AGENTS.md` 或 `CLAUDE.md`
（[安全性](https://pi.dev/docs/latest/security)）。因此，在受保護的可執行資源獲得核准
之前，儲存庫文字與指令輸出 (command output) 就可能影響模型 (model)。

> **事實 (Fact) — 信任不等於權限。** 專案信任控制輸入與資源的載入。它既不會逐一
> 核准模型要求的工具呼叫 (tool call)，也不會將工具限制在儲存庫內。非互動式的列印、
> JSON 與 RPC 執行無法開啟信任提示；它們會套用已儲存的信任、
> `defaultProjectTrust`，或該次執行的 `--approve`／`--no-approve` 決定。

## Extension、skill 與 Pi package

**擴充套件 (Extension)** 是 JavaScript 或 TypeScript 模組 (module)，其工廠函式 (factory) 會
收到 `ExtensionAPI`。它可以註冊工具、指令、快速鍵、旗標、供應商、算繪器與使用者介面
(UI)，並處理輸入、情境、工具呼叫／結果、壓縮 (compaction)、工作階段與 shell 事件。
在供應商邊界，Extension 可以修改傳出的標頭 (headers)，或取代傳出的酬載
(payload)。`after_provider_response` 事件會在串流內容開始取用前，觀察 HTTP 狀態與
正規化的回應標頭 (normalized response headers)；它**不會**公開或改寫串流回應內容 (streamed response body)
（[Extension](https://pi.dev/docs/latest/extensions)）。

Extension 會以啟動者的使用者身分執行。清理方式取決於資源：若 Extension 會啟動
處理程序、通訊端 (socket)、監看器 (watcher) 或計時器，就應註冊具等冪性
(idempotent) 的關閉清理程序 (shutdown cleanup)；只進行靜態註冊的 Extension 則可能
沒有任何項目需要清理。

**技能 (skill)** 是一種 `SKILL.md` 資源。Pi 會在全域位置、受信任專案的
`.pi/skills` 與 `.agents/skills` 目錄樹、套件／設定中，以及透過 `--skill` 探索
skill。名稱與描述可留在系統提示中，同時指示模型在相關時讀取完整指令與支援檔案。
這是漸進式揭露 (progressive disclosure)，並不保證模型一定會叫用該 skill；
`/skill:name` 會強制叫用，而 `disable-model-invocation` 可將 skill 限為僅供使用者叫用
（[skill](https://pi.dev/docs/latest/skills)）。

**Pi package** 透過 npm、Git 或本機路徑發行 Extension、skill、提示範本與佈景主題。
它與 `@earendil-works/pi-ai` 等單一儲存庫套件 (monorepo package) 不屬於同一類別。
Extension／package 可以執行主機程式碼，skill 也可包含輔助程式 (helper) 或直接指示
任意工具動作，因此安裝是一項程式碼信任決策
（[Pi package](https://pi.dev/docs/latest/packages)）。

## 工作階段、分享與壓縮

工作階段 (session) 通常以 JSONL 儲存在 `~/.pi/agent/sessions/` 下，並依工作目錄
分組。格式 v3 的項目 (entry) 使用 `id`／`parentId` 關係表示邏輯樹。`/tree` 可在同一
檔案中的分支 (branch) 之間移動；`/fork` 與 `/clone` 則建立另一個保有譜系
(lineage) 的工作階段檔案。`--no-session` 會避免一般的工作階段持久化，但不會撤銷
供應商傳輸、shell 造成的作用、Extension 行為或明確匯出的內容
（[工作階段](https://pi.dev/docs/latest/sessions)、
[格式](https://pi.dev/docs/latest/session-format)）。

「僅附加 (append-only)」描述的是邏輯工作階段模型，並不是不可變儲存空間：遷移與
特定的建立／匯入路徑可能重寫 JSONL 檔案。壓縮也不等於刪除。自動壓縮預設會保留
16,384 個 token 的回應額度 (response reserve)，並保留約最新的 20,000 個 token；
它會附加一份有損、由模型產生的摘要供後續請求使用，而舊項目仍留在工作階段歷程中。
摘要輸入會將序列化的工具結果截斷至 2,000 個字元
（[壓縮](https://pi.dev/docs/latest/compaction)）。

> **觀察 (Observation) — `/share` 文件衝突。** 在 v0.84.4 原始碼中，`/share`
> 會先嘗試經身分驗證的 Radius artifact 上傳，並設為 `visibility=organization`；其
> JSONL 匯出內容包含目前的系統提示，以及作用中工具的名稱、描述與結構描述
> (schema)。只有在 Radius 供應商／token 無法使用時，才會退回使用非公開 GitHub
> Gist（[帶標籤的實作](https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/src/modes/interactive/session-share.ts)）。
> 現行工作階段文件中無條件描述為 Gist 的文字已過時。「非公開」並不保證機密性，
> 而檢視過的 Pi 來源也未定義 Radius／Gist 的接收者存取、撤銷、保留或內容遮蔽
> (redaction) 保證。

## SDK、JSON、RPC 與遠端通訊協定

`@earendil-works/pi-coding-agent` 匯出的軟體開發套件 (SDK) 提供 `AgentSession`，以及
執行環境、模型／身分驗證、設定、資源載入與工作階段管理物件。嵌入端 (embedder) 可
注入工具與僅存在於執行階段的認證資訊 (runtime-only credentials)，而不將它們持久化
（[SDK](https://pi.dev/docs/latest/sdk)）。公開頁面未聲明每一個低階類別 (low-level
class) 都有相容性保證。

各個整合介面彼此不同：

- `--mode json` 為一次執行輸出以換行分隔的生命週期與串流事件
  （[JSON](https://pi.dev/docs/latest/json)）。
- `--mode rpc` 透過本機子處理程序 (child process) 的 stdin/stdout 雙向傳輸以 LF
  分隔的 JSON，並提供指令以處理提示、佇列、中止、shell 執行、模型／思考設定變更、
  壓縮與工作階段（[RPC](https://pi.dev/docs/latest/rpc)）。
- 依 `main` 上的觀察，另一套獨立的遠端堆疊 (remote stack) 採四位元組長度前綴，
  並使用明確長度 (definite-length) 的 CBOR。`pi-protocol` 未提供相容性承諾，
  `pi-server` 則明確標示為實驗性
  （[通訊協定](https://github.com/earendil-works/pi/blob/853a80d26c90a14c1886f0ebb8ffaae133ca2185/packages/protocol/README.md)、
  [伺服器](https://github.com/earendil-works/pi/blob/853a80d26c90a14c1886f0ebb8ffaae133ca2185/packages/server/README.md)）。

> **推論 (Inference)。** RPC 頁面記載本機子處理程序 JSONL，卻未說明身分驗證、
> 授權、加密與沙箱 (sandbox)。未提及這些項目，代表該通訊協定並未記載這些機制；
> 但不能據此證明 RPC 周邊的每一種主機整合都沒有這些機制。相較之下，實驗性遠端
> 伺服器文件明確將用戶端身分驗證／授權交由所選的傳輸層 (transport) 負責。

## 權限、認證資訊與遙測

Pi 刻意不內建沙箱，並以啟動帳號的權限執行。第一方指南建議針對不受信任或無人監看
的工作，採用由作業系統支援的容器、虛擬機器 (VM)、微型虛擬機器 (micro-VM)、遠端
沙箱，或受政策控制的沙箱（[安全性](https://pi.dev/docs/latest/security)）。權限閘門
(permission gate) 與沙箱包裝程式 (sandbox wrapper) 範例並不是核心政策：權限閘門
範例僅涵蓋特定 Bash 模式，而沙箱範例會在 macOS 與 Linux 上包裝 Bash／使用者 shell
路徑；若沙箱遭停用、不受支援、尚未初始化或初始化失敗，則可能退回一般 Bash。

認證資訊的解析順序為 `--api-key`、`~/.pi/agent/auth.json`、環境變數，再到自訂供應商
設定。新建立的 POSIX 目錄／檔案會使用 `0700`／`0600`；既有模式 (mode) 與管理員
存取控制清單 (ACL) 不會被收緊
（[認證資訊儲存，v0.84.4](https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/src/core/auth-storage.ts)）。
登入路徑的使用權與計費方式也不同，因此不能將供應商身分驗證概括為一致的訂閱權益
（[供應商](https://pi.dev/docs/latest/providers)）。

依 [v0.84.4 設定參考資料](https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/docs/settings.md) 所載，`enableInstallTelemetry` 預設啟用。全新安裝，或在新的互動式工作階段中
偵測到更新時，會向 `pi.dev` 非同步傳送 GET；其中帶有版本與 User-Agent，且沒有請求
本文（[互動式觸發條件](https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/src/modes/interactive/interactive-mode.ts)）。
`PI_TELEMETRY` 或該設定可停用此功能；`PI_OFFLINE` 會抑制此功能與其他啟動時的網路
作業。同一閘門也控制 OpenRouter、NVIDIA NIM 與 Cloudflare 的預設 Pi 歸屬標頭
(attribution headers)，而 OpenCode 工作階段標頭則是另一條獨立路徑。檢視過的來源
未說明安裝端點 (install endpoint) 的伺服器端保留、彙總或刪除情形
（[遙測閘門，v0.84.4](https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/src/core/telemetry.ts)、
[歸屬資訊實作，v0.84.4](https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/src/core/provider-attribution.ts)、
[環境變數](https://pi.dev/docs/latest/environment-variables)）。
此 CLI 行為不同於 `@earendil-works/pi-telemetry`；後者是供應商中立的遙測合約套件，
預設不含匯出器 (exporter)。

### 安全公告範圍

截點時可見四項公開的儲存庫安全公告 (repository advisory)：HTML 匯出 URL 清理
(sanitization)、`auth.json` 寫入競爭條件 (race)、可預測的暫存 Extension 路徑，
以及未經核准的專案 Extension。前三項將 `0.78.1` 列為
`@earendil-works/pi-coding-agent` 目前套件範圍的修正版本；專案信任問題則列為
`0.79.0`。已棄用的 `@mariozechner/pi-coding-agent` 版本範圍並沒有修補後的舊範圍
發行版本，因此必須遷移，不能假設舊套件已有修補程式。高嚴重性的暫存路徑案例還必須
同時符合以下條件：使用有漏洞的版本、採用共享且可寫入的暫存空間、存在另一位本機
使用者，並執行 npm 或 Git Extension；其影響是以受害使用者身分執行程式碼，並不是
自動取得 root 權限或從遠端攻陷
（[HTML 匯出公告](https://github.com/earendil-works/pi/security/advisories/GHSA-7v5m-pr3q-6453)、
[`auth.json` 公告](https://github.com/earendil-works/pi/security/advisories/GHSA-r95r-rj6r-c39x)、
[暫存路徑公告](https://github.com/earendil-works/pi/security/advisories/GHSA-jfgx-wxx8-mp94)、
[信任公告](https://github.com/earendil-works/pi/security/advisories/GHSA-mqxh-6gq7-558m)）。
版本高於列出的修正版本，並不構成一般性的安全保證。

## 選用子代理與證據限制

子代理 (subagent) 並未內建於 Pi 核心。官方選用範例會從 Markdown 代理定義啟動獨立的
`pi` 子處理程序，讓它們各自擁有獨立的大型語言模型情境視窗 (LLM context window)。
其限制——八項平行工作、四個並行工作程式 (concurrent workers)，以及每項工作最多
回傳 50 KiB——只屬於該範例，不適用於 Pi 或所有第三方協調器 (orchestrator)
（[v0.84.4 範例](https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/examples/extensions/subagent/README.md)）。
獨立的情境視窗不等於作業系統、檔案系統、認證資訊、網路、使用者或沙箱隔離。

> **觀點 (Opinion) — 比較原則。** Pi 以小型核心展現格外廣泛的可組合性
> (composability)，但僅有可擴充性並不能證明正確性、可靠性、安全性、延遲、token
> 效率或程式碼品質。檢視過的證據中，沒有共同的第一方基準測試 (benchmark) 足以將
> Pi——或其他代理框架——稱為基準測試的贏家。

## 主要來源

- [安全性與專案信任](https://pi.dev/docs/latest/security)
- [Extension](https://pi.dev/docs/latest/extensions)、[skill](https://pi.dev/docs/latest/skills) 與 [Pi package](https://pi.dev/docs/latest/packages)
- [工作階段](https://pi.dev/docs/latest/sessions)、[工作階段格式](https://pi.dev/docs/latest/session-format) 與 [壓縮](https://pi.dev/docs/latest/compaction)
- [SDK](https://pi.dev/docs/latest/sdk)、[JSON 模式](https://pi.dev/docs/latest/json) 與 [RPC 模式](https://pi.dev/docs/latest/rpc)
- [v0.84.4 `/share` 實作](https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/src/modes/interactive/session-share.ts)
- [v0.84.4 選用子代理範例](https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/examples/extensions/subagent/README.md)
