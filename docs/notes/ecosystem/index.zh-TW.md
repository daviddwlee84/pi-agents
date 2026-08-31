---
kind: ecosystem-index
status: reviewed
as_of: 2026-08-31
last_verified: 2026-08-31
upstreams:
  - https://pi.dev/
  - https://github.com/earendil-works/pi
  - https://github.com/earendil-works/pi-chat
  - https://github.com/can1357/oh-my-pi
  - https://github.com/nicobailon/pi-mcp-adapter
  - https://www.deepseek.com/harness/en/
  - https://github.com/deepseek-ai/deepseek-harness
confidence: high
---

# Pi 代理框架生態系

本概覽說明 `pia` 在上游代理框架 (harness)、分支 (fork)、轉接器 (adapter) 與其他
產品之間的位置。這是一份註明日期、以第一方來源為依據的檢視，不是基準測試
(benchmark)、資安稽核、背書，也不是聲稱某一個代理框架最好。

!!! info "事實 (Fact) — 相容性基準"
    儲存庫測試目前鎖定 Pi `0.84.4` 與 Oh My Pi `18.0.11`。這是一份相容性快照，
    不是對之後每一個發行版本的承諾。請參閱本站的
    [相容性聲明](../../reference/compatibility.md)。

## 四個不同層級

| 層級 | 負責範圍 | 範例 | 不代表什麼 |
|---|---|---|---|
| Pi 核心 | 代理迴圈 (agent loop)、終端機用戶端、工具、工作階段、供應商、RPC 與軟體開發套件 (SDK) | `earendil-works/pi`、CLI `pi` | 每一種選用的工作流程或整合 |
| 獨立分支 | 自有產品、CLI、套件、預設值與發行版本 | `can1357/oh-my-pi`、CLI `omp` | Pi 擴充套件 (Extension) 或官方 Pi 層級 |
| 轉接器 | 另外安裝、具有自有合約 (contract) 的整合 | `pi-mcp-adapter` | Pi 核心內建的能力 |
| 獨立代理框架／執行環境 | 自有迴圈、組合模型 (composition model)、用戶端與發行邊界 | DeepSeek Harness、CLI `dsh` | 不會只因重用 Pi 函式庫 (library) 就成為 Pi 發行版 |

這些邊界比系譜上的相似性更重要。分支不會繼承目前的相容性，轉接器不會擴張 Pi 的
核心合約，而共用函式庫也不會轉移產品身分、權限、授權或支援。

## Pi 核心：刻意保持精簡

Pi 自稱是極簡代理框架。`pi` 產品包含程式設計代理迴圈與終端機、內建工具、工作階段、
模型／供應商存取、JSON 輸出、標準輸入／輸出 RPC (stdio RPC) 與軟體開發套件
(SDK)。它預期使用者以 Extension、skill、提示範本 (prompt template)、佈景主題
(theme) 與 Pi package，組合出更具明確取向的工作流程
（[Pi coding-agent README](https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/README.md)）。

Pi 明確未將 MCP、子代理 (subagent)、權限對話框 (permission dialogs)、規劃模式
(plan mode)、內建待辦事項與背景 shell 執行納入預設核心
（[帶標籤的 coding-agent README](https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/README.md)）。它另外在文件中說明本身沒有內建沙箱
（[安全性](https://pi.dev/docs/latest/security)）。第一方範例展示 Extension 如何加入
其中部分行為，但範例仍是選用的組合，而不是內建保證
（[子代理範例](https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/examples/extensions/subagent/README.md)）。

## OMP：系譜相關，產品獨立

[Oh My Pi](oh-my-pi.md) 是著重程式設計的分支，擁有自己的 `omp` CLI、
`@oh-my-pi/*` 套件、Rust 元件、設定檔 (profile)、整合工具、協調功能
(orchestration features)、預設值與發行歷程。這些是具體的整合能力，並不是整體品質
排名的證據。OMP 不是安裝到 Pi 裡的外掛 (plugin)，也不應記載成相容的功能層級。單憑分支系譜
(fork lineage)，並不會讓 Pi 與 OMP 的設定、工作階段、政策或 Extension 可以互換
（[OMP README](https://github.com/can1357/oh-my-pi/blob/v18.0.11/README.md)）。

## 轉接器：明確指出相依項目

在 Pi 設定中支援 MCP 時，應指出提供該功能的 Extension 或套件。例如，
`pi-mcp-adapter` 是社群轉接器，擁有自己的設定、伺服器生命週期與信任邊界
（[轉接器 README](https://github.com/nicobailon/pi-mcp-adapter/blob/ff234b862359e722bf4dc1c99cde62278d4b8eb3/README.md)）。
不得將該轉接器所描述的 `pi.mcp` 資訊清單欄位 (manifest field)，說成 Pi package
資訊清單的功能。依賴轉接器的 combo 應明確鎖定版本、審查並測試該轉接器。

## 遠端訊息是外部整合

Pi package 與 Extension 可以把工作階段連接到 Discord、Telegram 或其他訊息系統，
未來的 Pi-only combo 也可能鎖定其中一種整合。這並不會讓遠端訊息成為 `pia` 核心
能力。`pia` 不提供訊息傳輸、認證或准入、即時工作階段協調、沙箱、耐久投遞或服務
監督。

應套用與 MCP 相同的規則：明確指出具體整合、鎖定版本，並針對選定的 Pi 版本測試
其行為，而不是把第三方行為歸於 Pi 本身。Pi README 將獨立的
[`earendil-works/pi-chat`](https://github.com/earendil-works/pi-chat) 專案列為聊天自動化
選項；共用組織與上游連結本身並不能建立支援合約，也不能證明它與本儲存庫的 Pi
快照相容。

請參閱註明日期的 [IM gateway 研究](https://github.com/daviddwlee84/pi-agents/blob/main/backlog/pi-im-gateway.md)，
了解所選的工作階段路由器脈絡合約、候選方案證據，以及從外部實驗升級為實驗性 combo
或維護服務所需的關卡。

## 其他代理框架：比較相同層級

[DeepSeek Harness](deepseek-harness.md) 是獨立、以 Cordis 為基礎的執行環境，提供 Web、
無介面 (headless)、SDK、minimal-SDK 與 ACP 設定檔。其中一個模型轉接器使用 Pi 可重用
的 `pi-ai` 套件，但 DeepSeek Harness 仍保有自己的代理迴圈、外掛圖 (plugin graph)、
工作階段、權限、沙箱實作、CLI、狀態與授權邊界。因此，它只能在**代理框架／執行環境
層級**與 Pi 比較，而不是可直接替代 (drop-in) 的 Pi 終端機用戶端。

!!! note "推論 (Inference) — 編者分類 (Editorial classification)"
    「代理框架／執行環境層級」是本站依各專案的第一方架構與產品定位所推論出的比較
    類別。這不是供應商的互通性聲明，也不表示功能對等 (feature parity)。

## `pia` 為何維持精簡

`pia` 不會取代代理迴圈、工具登錄檔 (tool registry)、供應商層、權限系統或沙箱。
它的任務更窄：將可審查的 combo 來源保存在 Git 中、將其具現化至私有執行階段狀態
(private runtime state)、以可預期的方式選擇 Pi 或 OMP，並將認證資訊、工作階段、
快取 (cache) 與其他可變資料留在 combo 來源之外。

即使引擎有原生設定檔 (native profile)，這樣的區隔仍然實用。OMP 設定檔會重新定位
OMP 原生的使用者狀態，但不會隔離每一個專案或外部工具的設定來源；Pi 則有不同的探索
基元 (discovery primitives)。`pia` 為兩個引擎提供一套小型的來源／執行階段工作流程，
同時不假裝兩者的原生語義完全相同。引擎專屬功能與轉接器仍是明確的 combo 相依項目，
而不是複製到 `pia` 裡的抽象層 (abstractions)。

## 主要來源

- [Pi coding-agent README，`v0.84.4`](https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/README.md)
- [Pi Extension 範例，`v0.84.4`](https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/examples/extensions/subagent/README.md)
- [`pi-chat`，commit `9adbd29`](https://github.com/earendil-works/pi-chat/tree/9adbd29b40ee27ff1decf0fc87cbe180b40924f5)
- [Oh My Pi README，`v18.0.11`](https://github.com/can1357/oh-my-pi/blob/v18.0.11/README.md)
- [`pi-mcp-adapter` README，commit `ff234b8`](https://github.com/nicobailon/pi-mcp-adapter/blob/ff234b862359e722bf4dc1c99cde62278d4b8eb3/README.md)
- [DeepSeek Harness 架構，`dsh-v0.1.2-alpha.2`](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/docs/architecture.md)
