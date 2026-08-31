---
kind: ecosystem-product-note
status: reviewed
as_of: 2026-08-31
last_verified: 2026-08-31
upstreams:
  - https://www.deepseek.com/harness/en/
  - https://github.com/deepseek-ai/deepseek-harness
  - https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.2-alpha.2
confidence: high
---

# DeepSeek Harness

DeepSeek Harness (`dsh`) 是 DeepSeek 的開源代理框架 (agent harness)。DeepSeek 將代理
描述為「模型 + 代理框架 (Model + Harness)」：模型提供智慧，而代理框架將其連接至
環境、工具、工作階段與持續進行的工作
（[概覽](https://www.deepseek.com/harness/en/)）。它不是 DeepSeek 模型、Pi 發行版，
也不是可直接替代 (drop-in) 的 Pi 終端機用戶端。

!!! warning "事實 (Fact) — 開發者預覽版"
    DeepSeek 將 Harness 標示為開發者預覽版 (developer preview)；帶標籤的 README
    明言會有破壞相容性的變更，而安全聲明則表示此軟體未經稽核且尚未可用於正式環境。
    請在拋棄式虛擬機器 (VM)、容器或專用環境中，以最低權限執行
    （[README](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/README.md)、
    [SAFETY.md](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/SAFETY.md)）。

## 版本與發行管道

截至 2026-08-31，各管道並未指出一個通用的「最新」組建 (build)：

| 管道 | 已驗證狀態 |
|---|---|
| GitHub | `dsh-v0.1.2-alpha.2`，發布於 2026-08-30 的預發布版本 |
| npm `alpha` | `0.1.2-alpha.2` |
| npm `latest` 與 `next` | `0.1.1-rc.2`；未指定管道的 `npx @deepseek-ai/dsh web` 會採用此預設管道 |
| PyPI 執行環境二進位檔 | `0.1.1rc1`；提供 Linux x64／arm64 與 macOS 14+ arm64 的 wheel，該版本沒有 Windows wheel 或原始碼發行套件 (source distribution) |

確切的 Node 範圍 `^22.19.0 || >=24.0.0` 屬於帶標籤的私有
[根工作區資訊清單](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/package.json)
與原始碼組建合約 (source-build contract)；已發布的
[`@deepseek-ai/dsh` 資訊清單](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/apps/cli/package.json)
並未宣告 `engines` 欄位。同樣地，Windows x64 是原始碼文件記載的 Python 目標，
不是已驗證 PyPI 發行版本中可下載的 Python 執行環境產出物 (artifact)。版本與管道兩者都應鎖定
（[GitHub 發行版本](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.2-alpha.2)、
[npm 中繼資料](https://registry.npmjs.org/@deepseek-ai%2Fdsh)、
[PyPI 中繼資料](https://pypi.org/pypi/deepseek-harness-runtime-bin/0.1.1rc1/json)）。

## Cordis 與「Everything is a Plugin」

Cordis 是底層的生命週期、服務、具型別事件 (typed event) 與可逆作用
(reversible effect) 框架。DeepSeek Harness 是組裝完成的產品。其架構透過 plugin
組合模型轉接器、工具登錄檔、工作階段日誌、代理迴圈、持久化、沙箱服務與使用者介面，
而不是將它們硬接到單一的高權限應用程式核心
（[Cordis 入門](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/docs/cordis-primer.md)、
[架構](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/docs/architecture.md)）。

「Everything is a Plugin」描述的是能力組合。它並不表示 Cordis 基底 (substrate)、
CLI 啟動器、套件管理員或執行環境載入器，本身也是可替換的 Harness plugin。請區分
以下術語：

- **設定檔 (Profile)** 是可執行的處理程序組合；
- **套裝 (Bundle)** 發行一層設定；
- **代理預設集 (Agent Preset)** 為一個工作階段提供工具、提示與 Skill。

## 設定檔與 Standard 預設集

`dsh` 啟動器隨附以下設定檔：本機瀏覽器使用者介面 (`web`)、單次執行
(one-shot execution) (`headless`)、JSON-RPC SDK 伺服器 (`sdk` 與 `sdk-minimal`)，
以及 ACP stdio 伺服器 (`acp`)。`dsh web` 預設繫結至 `127.0.0.1:3080`，並拒絕
`--host 0.0.0.0`；SSH 會抑制自動開啟瀏覽器
（[CLI 參考資料](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/apps/cli/reference/README.md)）。
TypeScript 與 Python SDK 會透過以換行分隔的 JSON-RPC 驅動完整執行環境；ACP 是另一個
自動化設定檔，而不是該 SDK 通訊協定。`sdk-minimal` 刻意不是安全或完整的預設：它
省略設定、受管理的認證資訊、遙測、Web 工具、子代理、指令探索、執行階段情境與壓縮，
並固定使用 `danger-full-access`；只能在適當的外層隔離邊界內使用
（[Python SDK 指南](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/docs/user/guide/python-sdk.md)）。

在工作階段內，**Standard** 代理預設集是完整的程式設計代理組合：包括檔案編輯、shell
執行、檢索、Skill、規劃、目標、子代理與工作流程。原始碼也隨附 `ptc`、`minimal` 與
`cordis` 預設集。帶標籤的
[使用者介面語系原始碼](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/packages/client/ui-agent-preset/src/client/locales.ts)
將 `cordis` 對應至「Creator mode」，並把 `ptc` 稱為「PTC mode」；在檢視過的資料中，
產品頁面的「Code Mode」標籤與預設集 ID `ptc` 並沒有明確的等價關係
（[代理預設集](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/packages/preset/agent-presets/README.md)）。

## 工具、權限與限制

以 Base 為基礎的工作階段 (Base-backed sessions) 預設採用 `workspace-write` 權限預設集
與核准政策 `ask`。只有 `allowed-once` 會授予所要求的動作；拒絕、取消、沒有答覆器
(answerer) 或答覆器拋出錯誤，以及核准管道無法使用，都會拒絕該動作。另一個
`danger-full-access` 預設集使用核准政策 `never`
（[權限預設集](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/docs/subsystems/permission-presets.md)、
[核准](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/docs/subsystems/approval.md)）。

處理程序沙箱的術語——`read-only`、`workspace-write` 與 `danger-full-access`——管控
特定能力對檔案系統造成的作用，而不是所有權限。Base 設定檔仍可讀取資料與存取網路；
處理程序可見性則取決於後端。系統會在本機選用 Linux bwrap／Landlock、macOS
Seatbelt，或 Windows 受限 token／ACL 執行器；Windows 或舊版 Landlock 的強制執行
可能回報為部分生效。這不等同於認證資訊、網路、plugin 或虛擬機器隔離
（[沙箱參考資料](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/docs/subsystems/sandbox.md)）。

## 工作階段與擴充機制

工作階段是僅附加、事件溯源 (event-sourced) 的日誌，可由此衍生模型訊息、軌跡檢視、
繼續、分支、重播與遙測。記錄可包含原始串流區塊、組合後的訊息、工具呼叫／結果、
注入的情境、路由中繼資料與實際生效的請求標頭。JSONL 與選用的 SQLite 持久化會保留
邏輯串流；壓縮會透過持久化摘要改變模型可見的內容，同時保留原始日誌證據
（[工作階段](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/docs/subsystems/session.md)、
[持久化](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/docs/subsystems/persistence.md)）。

原生 Cordis plugin 是廣泛的擴充層面 (extension plane)。Git 相依項目獲允許的
`prepare` 指令碼，會在安裝時於代理沙箱之外執行，因此必須審查 plugin 並鎖定版本
（[發布指南](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/docs/user/develop/basic/publish.md)）。由模型編寫、位於 `cordis` 預設集的 plugin 是暫時性的，可以影響同一處理程序中的
其他工作階段，信任程度應比照 shell 存取
（[動態 Cordis](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/docs/user/develop/practice/dynamic-cordis.md)、
[預設集](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/packages/preset/agent-presets/presets/cordis/agent.cordis.yml)）。其他介面較為有限：

- **Skill** 是分層的指令套件，其內容會依需求載入。
- **MCP** 是選用項目，且只橋接外部工具——不包含 Resource、Prompt 或工作所需工具。
  Stdio 伺服器指令是在代理沙箱外執行的受信任可執行檔
  （[MCP 用戶端](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/packages/mcp/mcp-client/README.md)、
  [CLI 參考資料](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/apps/cli/reference/README.md)）。
- **Hook** 提供部分 Claude Code 與 Codex 指令 hook 相容性；每一座橋接器都以文件記載
  不支援的事件、處理常式 (handler)、酬載、探索方式與輸出語義。

## 工作流程與協調

子代理可以是單次執行，也可以是由持久化工作階段支援、能繼續執行的子項目。工作流程
接縫 (Workflow seam) 可讓模型編寫的 JavaScript 在工作執行緒 (worker thread) 中協調
`agent`、`pipeline`、`parallel`、`phase` 與 `log` 操作。雖然計時器、檔案系統、網路
與 Node 全域物件都不是刻意注入，但 `node:vm` 情境明確可以逃逸；它提供的是圍阻
(containment)，而不是安全邊界
（[工作流程](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/docs/subsystems/workflow.md)、
[工作執行緒警告](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/packages/workflow/workflow-worker-thread/README.md)）。
排程只是在工作階段內盡力而為的提醒——不是 cron、保證恰好執行一次 (exactly-once)
的工作，也不是外部通知。

Agent Teams 需要另作限定：其架構存在於帶標籤的原始碼中，但私有的實驗性套件並未
納入官方 npm、CLI、Web 與 Python 發行內容。這是只能從原始碼簽出版本使用的實驗性
工作，而不是已出貨基礎內容中遭停用的一列
（[實驗性設定檔](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/packages/experimental/agent-team-profile/README.md)）。

## 模型轉接器與 Pi 邊界

Harness 透過可替換的 `ctx.llm` 轉接器選擇模型。該標籤包含直接連線的
`deepseek-official` 轉接器，以及由 Pi 可重用 `pi-ai` 函式庫支援的多供應商轉接器
（[Harness 轉接器](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/packages/llm/llm-pi-ai/README.md)、
[`pi-ai`](https://github.com/earendil-works/pi/blob/853a80d26c90a14c1886f0ebb8ffaae133ca2185/packages/ai/README.md)）。
重用函式庫並不會引入 Pi 的程式設計代理迴圈、CLI、工作階段、Extension、產品身分、
發行政策、權限或支援邊界。檢視過的來源並未確立整合式本機推論引擎；支援某家公司或
自行託管端點，只能證明有可設定的遠端端點。

!!! note "推論 (Inference) — 編者比較範圍"
    DeepSeek Harness 與 Pi 可在代理框架／執行環境層級比較，因為兩個專案都以此定位
    自己。DeepSeek Harness 提供由 plugin 組合、具多種設定檔的執行環境；Pi 的主要
    產品則是極簡的終端機程式設計代理框架。這項分類屬於編者判斷，不是供應商的相容性
    聲明，也不是功能品質排名。

「預設使用本機 (Local by default)」適用於預設儲存空間與受意見回饋閘門控制的工作
階段遙測，而不是網路隔離。一般的模型、Web、MCP、plugin 與工具呼叫都可能傳輸內容。
直接連線的 DeepSeek 轉接器也會隨官方請求傳送歸屬資訊、匿名／工作階段識別碼，以及
——在準備程序成功時——作用中的 plugin 套件清單
（[轉接器行為](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/packages/llm/llm-deepseek/README.md)、
[意見回饋／遙測行為](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/apps/cli/reference/README.md)、
[資料處理](https://www.deepseek.com/harness/en/data-processing/)）。
該政策頁面未提供明確修訂日期、具體保留期間或刪除時程。Harness 程式碼適用帶標籤的
[MIT 授權](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/LICENSE)；隨附第三方元件的條款仍另外記載於
[THIRD_PARTY_NOTICES.md](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/THIRD_PARTY_NOTICES.md)，外部酬載／服務條款也維持獨立。

!!! question "待解問題 (Open question) — 生命週期"
    檢視過的第一方來源均未提供正式發布 (GA) 日期、API 穩定性藍圖、支援服務等級協議
    (SLA)、資安稽核時程，或完整的跨設定檔平台矩陣。採用前請重新檢查確切的發行版本
    與發行管道。

## 主要來源

- [DeepSeek Harness 概覽](https://www.deepseek.com/harness/en/)
- [README，`dsh-v0.1.2-alpha.2`](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/README.md)
- [架構，`dsh-v0.1.2-alpha.2`](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/docs/architecture.md)
- [CLI 行為參考資料，`dsh-v0.1.2-alpha.2`](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/apps/cli/reference/README.md)
- [沙箱參考資料，`dsh-v0.1.2-alpha.2`](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/docs/subsystems/sandbox.md)
- [安全聲明，`dsh-v0.1.2-alpha.2`](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/SAFETY.md)
- [MIT 授權，`dsh-v0.1.2-alpha.2`](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/LICENSE)
