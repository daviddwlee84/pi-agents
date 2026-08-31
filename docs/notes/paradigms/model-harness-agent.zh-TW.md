---
kind: paradigm
status: reviewed
as_of: 2026-08-31
last_verified: 2026-08-31
upstreams:
  - https://github.com/earendil-works/pi/blob/v0.84.4/packages/ai/README.md
  - https://github.com/earendil-works/pi/blob/v0.84.4/packages/agent/README.md
  - https://pi.dev/docs/latest/extensions
  - https://code.claude.com/docs/en/how-claude-code-works
  - https://developers.openai.com/blog/codex-as-a-platform
  - https://learn.chatgpt.com/docs/config-file/config-advanced
confidence: high
---

# 模型 (model)、供應商 (provider)、代理工具框架 (harness) 與代理工具 (agent)

「代理工具」一詞經常把數個各自獨立變動的分層壓縮成一個詞。這種簡稱在日常對話中無妨，
但不適合作為架構與比較方法。

**編者分類 (Editorial classification)。** 本站使用以下分層架構來討論代理式程式開發系統
(agentic coding systems)。這是本站自訂的詞彙，並非宣稱每個供應商都使用完全相同的邊界。

## 各分層

### 1. 模型

**模型**是針對某次回合 (turn) 所選定的推論系統 (inference system)：它將提供的脈絡轉換
為輸出，也可能要求叫用工具 (tool calls)。模型的身分很重要，因為能力、脈絡限制、工具使用行為與輸出都可能
不同。

模型本身不會探索儲存庫、核准命令、執行 `git`、保存工作階段 (session)，也不會決定
檔案掛載在何處。
這些行為來自周遭的其他分層。

### 2. 供應商

**供應商**提供模型存取能力，並擁有一個 API／服務邊界 (API/service boundary)：端點
(endpoint)、身分驗證 (authentication)、模型識別碼 (model identifiers)、串流協定
(streaming protocol)、配額、計費，以及適用的資料條款。閘道 (gateway) 或雲端平台可能
再增加一層供應商邊界。

Pi 具體呈現了這項區分：`@earendil-works/pi-ai` 透過 `Model` 所屬的 `Provider` 進行路由，
而存取憑證 (credentials)、標頭 (headers) 與供應商選項 (provider options) 仍是每項請求
需處理的事項
([`pi-ai` README](https://github.com/earendil-works/pi/blob/v0.84.4/packages/ai/README.md))。
因此，供應商中立的代理工具框架**不**代表不同供應商會提供相同的模型功能、存取權益、
資料保留方式 (retention) 或工具行為。

### 3. 代理工具框架與代理迴圈

**代理工具框架**會組合指示、儲存庫脈絡、工具、政策、工作階段狀態與供應商呼叫。其
**代理迴圈 (agent loop)** 會重複某種形式的下列流程：

```text
gather context → ask model → validate/authorize request → run tool
               ← append result/error ← observe and continue or stop
```

迴圈是一種實作，不是新的模型。它決定模型看見什麼、哪些工具請求可以執行、結果如何
序列化、何時壓縮脈絡，以及何種狀態構成完成。Pi 將面向供應商的套件與
`@earendil-works/pi-agent-core` 分開；後者負責迴圈、可變狀態、工具、佇列與事件
([agent-core README](https://github.com/earendil-works/pi/blob/v0.84.4/packages/agent/README.md))。
Anthropic 同樣將 Claude Code 描述為環繞 Claude 的「代理式框架 (agentic harness)」
([Claude Code 的運作方式](https://code.claude.com/docs/en/how-claude-code-works))。

**後設代理工具框架 (meta-harness)** 會設定或啟動另一個代理工具框架，而不是取代其內部
迴圈。`pia` 屬於此類：它會選取已審查的 Pi 或 OMP 組合 (combo) 並將其具體化、設定工作
階段路徑，再呼叫上游引擎。它不會成為模型供應商，也不會成為上游執行沙箱。請參閱
[`pia` 架構](../../concepts/architecture.md)。

### 4. 用戶端與產品操作介面

**用戶端／操作介面 (client/surface)** 是使用者或其他程式控制系統的方式：CLI、TUI、
編輯器 Extension、桌面應用程式、Web／雲端主控台、無介面命令 (headless command)、
伺服器或 SDK。一項**產品**可能會把其中數種操作介面與代理工具框架、託管服務組合在一起。

共用品牌或共用代理工具框架並不是操作介面對等 (surface parity) 的證據。本機 CLI 與託管
雲端任務可能在檔案系統、存取憑證、可用工具、核准機制、持久性與資料路徑方面有所不同。
OpenAI 對 Codex 的分層說明也區分模型推理、代理工具框架、整合操作介面與託管基礎設施
([Codex 平台介紹](https://developers.openai.com/blog/codex-as-a-platform))。

### 5. 環境

**環境 (environment)** 是迴圈與工具實際執行之處：主機帳號 (host account)、工作目錄
(working tree)、Git 工作樹 (worktree)、容器 (container)、虛擬機器 (VM)、託管工作執行器
(managed worker)、瀏覽器、網路與存取憑證組合 (credential set)。推論仍可能在其他位置進行。

請分別看待以下四個位置：

1. 用戶端在哪裡執行；
2. 代理迴圈在哪裡執行；
3. 工具在哪裡產生實際影響；以及
4. 推論與已儲存成品位於何處。

「本機代理工具 (local agent)」可能指工具在本機執行、推論卻在遠端進行。「遠端控制
(remote control)」可能指透過遠端介面控制仍在使用者電腦上執行的程序。SDK 可以嵌入迴圈，
但不一定提供託管部署。

## 代理工具是一種角色，不是神奇的分層

**推論 (Inference)。** 在這套詞彙中，代理工具是由特定模型、供應商、代理工具框架設定、
工具集、政策、工作階段與環境共同產生的「模型位於迴圈中 (model-in-a-loop)」行為。即使
產品名稱不變，只要改動其中任何一項，實際的代理工具就可能改變。

這也解釋了為何名稱相似的功能不能互換：

- 權限詢問 (permission prompt) 會授權某項操作；它不會限制程序的活動範圍；
- 專案信任 (project trust) 控制可載入哪些儲存庫指示或程式碼；它不是工具授權；
- 沙箱 (sandbox) 限制的是指定程序或資源，不一定涵蓋內建檔案工具、擴充功能
  (extensions)、MCP 伺服器、瀏覽器或網路路徑；
- Git 工作樹會分隔檢出內容 (checkouts)；它不會隔離存取憑證或程序；
- 壓縮 (compaction) 保留的是摘要，而不是遭捨棄脈絡的完整原文。

Pi 文件指出，Extensions 能攔截脈絡、工具與工作階段，且執行時擁有完整系統存取權。在
供應商邊界上，它們可以修改傳出的標頭／承載資料 (headers/payloads)，也能觀察回應狀態／
正規化標頭 (response status/normalized headers)，但不能改寫串流回應內容
(streamed response body)
([Extensions](https://pi.dev/docs/latest/extensions))。這是代理工具框架的擴充邊界，不是
模型功能。

## 主張範本

比較兩個「代理工具」之前，請用以下方式撰寫主張：

> 在 **[標籤／提交／日期]**，**[產品 + 操作介面]** 於 **[位置]** 執行
> **[迴圈]**，在 **[環境]** 中執行 **[具名工具]**，透過 **[供應商]**
> 存取 **[模型]**，並套用 **[核准／隔離限制]**。

接著標示證據屬於已發布的發行版本行為、現行文件、未發布原始碼、範例／Extension 行為，
或編者推論 (editorial inference)。

**待解問題 (Open question)。** 供應商與產品文件經常未說明不同操作介面之間是否完全對等，
或未說明確切資料流。遇到這種情況時，應記錄「文件未記載 (not documented)」，而不是用
相鄰操作介面的資訊填補缺口。

## 這對 `pia` 為何重要

組合可以鎖定代理工具框架設定並讓其可供審查，但無法讓供應商條款、模型行為、網路政策
或主機隔離方式完全相同。請使用
[安全性與資料邊界](../../concepts/security-and-data-boundaries.md)辨識 `pia` 的實際邊界，並
參閱[工作階段與交接](../../guides/sessions-and-handoff.md)了解持久性。產品範例列於
[程式開發代理工具全貌](../coding-agents/index.md)，而 Pi/OMP 專屬背景則位於
[生態系筆記](../ecosystem/index.md)。

## 主要來源

- [Pi AI／供應商分層](https://github.com/earendil-works/pi/blob/v0.84.4/packages/ai/README.md)
- [Pi 代理迴圈分層](https://github.com/earendil-works/pi/blob/v0.84.4/packages/agent/README.md)
- [Pi Extensions](https://pi.dev/docs/latest/extensions)
- [Claude Code 的運作方式](https://code.claude.com/docs/en/how-claude-code-works)
- [Codex 平台介紹](https://developers.openai.com/blog/codex-as-a-platform)
- [Codex 進階設定](https://learn.chatgpt.com/docs/config-file/config-advanced)
