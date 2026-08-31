---
kind: ecosystem-product-note
status: reviewed
as_of: 2026-08-31
last_verified: 2026-08-31
upstreams:
  - https://omp.sh/
  - https://github.com/can1357/oh-my-pi
  - https://github.com/can1357/oh-my-pi/releases/tag/v18.0.11
  - https://api.github.com/repos/can1357/oh-my-pi/releases/latest
  - https://api.github.com/repos/can1357/oh-my-pi/compare/v18.0.11...969062200754ea02cfac922e5ebb8c608c079e15
  - https://github.com/can1357/oh-my-pi/commit/969062200754ea02cfac922e5ebb8c608c079e15
confidence: high
---

# Oh My Pi (OMP)

Oh My Pi (OMP) 將自己定位為「已接好 IDE」的終端機程式設計代理 (terminal coding
agent)。其 README 稱它是 Mario Zechner 的 Pi 之程式設計優先分支 (coding-first
fork)，但 OMP 現在是獨立產品：它在 `can1357/oh-my-pi` 下發布 `omp` CLI、
`@oh-my-pi/*` 套件、Rust 套件 (crate)、文件、預設值與發行版本
（[README](https://github.com/can1357/oh-my-pi/blob/v18.0.11/README.md)）。它不是 Pi
擴充套件 (Extension)、官方 Pi 版本，也未經證實可直接替代 (drop-in replacement) Pi。

## 發行版本與原始碼快照

!!! info "事實 (Fact) — 兩份快照，而不是單一狀態"
    2026-08-31 時，GitHub 最新的非草稿、非預發布 OMP 發行版本是
    [`v18.0.11`](https://github.com/can1357/oh-my-pi/releases/tag/v18.0.11)，發布於
    2026-08-29；[官方發行版本 API](https://api.github.com/repos/can1357/oh-my-pi/releases/latest)
    提供截點排序與明確的 `draft`／`prerelease` 旗標。所檢視的較新原始碼快照
    [`main@9690622`](https://github.com/can1357/oh-my-pi/commit/969062200754ea02cfac922e5ebb8c608c079e15)
    日期為 2026-08-30；在 GitHub 的
    [比較 API](https://api.github.com/repos/can1357/oh-my-pi/compare/v18.0.11...969062200754ea02cfac922e5ebb8c608c079e15)
    中領先 44 個 commit（`behind_by: 0`）；
    [固定比較連結](https://github.com/can1357/oh-my-pi/compare/v18.0.11...969062200754ea02cfac922e5ebb8c608c079e15)
    則保留為方便人閱讀的檢視方式。

以下大部分機制都有發行標籤 (release tag) 的文件。值得注意的例外是獨立的專案根目錄
`CLAUDE.md` 探索：它是在 `v18.0.11` 之後的 commit `9690622` 加入；對
`.claude/CLAUDE.md` 的支援則早已存在。應將獨立形式視為尚未發布的原始碼觀察，而不是
`v18.0.11` 的能力。

OMP 的核心代理進入點包括互動式 TUI (`omp`)、`omp -p` 列印／JSON 操作、標準輸入／
輸出 RPC (stdio RPC) 與 `rpc-ui`、ACP、同一處理程序內 (in-process) 的
Bun/TypeScript `@oh-my-pi/pi-coding-agent` 軟體開發套件 (SDK)，以及以處理程序為後端
(process-backed) 的 Python `omp-rpc` 用戶端
（[CLI 參考資料](https://github.com/can1357/oh-my-pi/blob/v18.0.11/docs/cli-reference.md)、
[RPC](https://github.com/can1357/oh-my-pi/blob/v18.0.11/docs/rpc.md)）。這不是單一儲存庫
(monorepo) 中每一個應用程式的完整清單。

## 設定檔與覆疊

透過 `omp --profile`、`OMP_PROFILE` 或舊版 `PI_PROFILE` 選取的設定檔 (profile)，會
重新定位 OMP 原生的使用者設定與執行階段狀態，預設位置為
`~/.omp/profiles/<name>/agent`。設定、身分驗證資料、工作階段、blob、指令、規則、
提示、hook、工具、Extension、skill 與 MCP 狀態都會隨之移動。具名設定檔不會繼承預設
設定檔的原生設定；按鍵繫結 (keybinding) 是文件記載的覆疊 (overlay) 例外。專案設定
與外部工具根目錄仍與設定檔無關
（[設定指南](https://github.com/can1357/oh-my-pi/blob/v18.0.11/docs/config-usage.md)）。

設定檔不同於僅作用於處理程序的設定覆疊 (process-only settings overlays)。實際生效
的優先順序依序為預設值、全域設定、專案設定、`PI_CONFIG_FILES`、重複指定的
`--config`，最後是執行階段覆寫。物件會深度合併 (deep-merge)，但較高層的陣列會整批
取代較低層的陣列。覆疊檔案若不存在、格式錯誤或不是對應表 (mapping)，該次執行會
失敗，而不是默默忽略
（[設定](https://github.com/can1357/oh-my-pi/blob/v18.0.11/docs/settings.md)）。

## 工具、核准與沙箱邊界

OMP 整合檔案／搜尋、shell／評估、程式碼智慧 (code intelligence)、協調、瀏覽器／
桌面、記憶體，以及 skill 導向的工具；實際可用性仍取決於設定、模型、認證資訊與
平台。請勿將持續變動的工具數量視為相容性合約。

工具會宣告 `read`、`write` 或 `exec` 核准層級 (approval tier)，而引數或各工具政策
可設為 `allow`、`deny` 或 `prompt`。模式包括 `always-ask`、`write` 與 `yolo`；
`v18.0.11` 結構描述的預設值是 `yolo`。此預設並不構成無條件「沒有閘門」的承諾：
由供應商觸發的電腦安全檢查仍可能要求確認，而且除非已透過設定或引數明確指定
`yolo`，否則 ACP 仍會保留其用戶端權限閘門
（[核准模式](https://github.com/can1357/oh-my-pi/blob/v18.0.11/docs/approval-mode.md)）。

!!! warning "事實 (Fact) — 核准不等於限制"
    OMP 預設沒有一般性的主機沙箱。`task.isolation.mode` 預設為 `none`；啟用後會分隔
    子工作區 (child workspace) 與變更整合作業，但不會限制任意處理程序、認證資訊、
    主機 API 或網路存取。Extension／plugin 會在同一處理程序內執行，瀏覽器與
    `computer` 程式碼可以使用 Bun／Node 的主機權限，而 OMP 啟動無介面 Chromium 時
    會停用 Chromium 的沙箱
    （[工作隔離](https://github.com/can1357/oh-my-pi/blob/v18.0.11/docs/tools/task.md)、
    [Extension 載入](https://github.com/can1357/oh-my-pi/blob/v18.0.11/docs/extension-loading.md)、
    [瀏覽器邊界](https://github.com/can1357/oh-my-pi/blob/v18.0.11/docs/tools/browser.md)）。

## 工作階段

預設以檔案為基礎的工作階段 (session) 是作用中代理目錄下的 JSONL。項目形成僅附加
(append-only) 的 `id`／`parentId` 樹，並可記錄訊息、模型／思考設定變更、壓縮、重設
邊界、生命週期中繼資料與 Extension 狀態。檔案型管理程式支援繼續與分支；SDK 也提供
記憶體內工作階段 (in-memory session)，但可用的持久化操作較少
（[工作階段模型](https://github.com/can1357/oh-my-pi/blob/v18.0.11/docs/session.md)）。

各個工作階段指令刻意採用不同語義。`/fresh` 會輪替供應商端的串流／工作階段狀態，
同時保留本機逐字記錄 (transcript)；`/clear` 會附加重設邊界，但不會清除較早的 JSONL
項目。已完成的訊息會同步排入佇列，但不會執行 `fsync`；部分串流文字不具持久性，
而 `/drop` 只會盡力而為 (best-effort)，並不保證安全抹除
（[工作階段操作](https://github.com/can1357/oh-my-pi/blob/v18.0.11/docs/session-operations-export-share-fork-resume.md)）。

## 可擴充性、子代理與供應商

OMP 將幾種擴充層面 (extension planes) 維持為不同概念：

- **Skill** 會依需求提供以檔案為基礎的指令。
- **Extension** 是受信任、在同一處理程序內執行的 TS／JS 工廠函式，可用於事件、
  工具、指令、使用者介面與供應商；一般啟動流程會透過此執行器處理舊版 JS／TS hook。
- **自訂工具 (custom tool)** 提供用途集中的可執行 API；**plugin** 則發行一項或多項
  資源。可以獨立安裝 npm plugin，但市集目錄 (marketplace catalog) 中以 npm 為來源的
  物件雖會被解析，目前仍會被拒絕
  （[市集行為](https://github.com/can1357/oh-my-pi/blob/v18.0.11/docs/marketplace.md#L199-L209)）。
- **MCP** 支援 stdio、Streamable HTTP 與相容性 SSE。專案的 stdio 定義可以執行任意
  指令，因此屬於受信任的輸入
  （[MCP 設定](https://github.com/can1357/oh-my-pi/blob/v18.0.11/docs/mcp-config.md)）。

`task` 工具會啟動不繼承父對話的子代理 (subagent)；提示必須自行帶入情境。無介面子
代理會強制使用層級層面的 `yolo`，但明確的各工具政策仍具有最終效力。子代理的 JSONL
與輸出是否持久化，取決於父代理的 artifact 持久化路徑，且可能使用暫存空間；隔離的
代理在合併／清理後無法恢復。工作區隔離仍然不是安全沙箱
（[`task` 工具](https://github.com/can1357/oh-my-pi/blob/v18.0.11/docs/tools/task.md)）。
Vibe worker 只會在該 Vibe／工作階段生命週期內保持運作：離開 Vibe 會終止它們，
中斷的輪次也不會在處理程序重新啟動後自動繼續
（[Vibe 模式](https://github.com/can1357/oh-my-pi/blob/v18.0.11/docs/vibe-mode.md)）。

最適合將 OMP 描述為**多供應商 (multi-provider)**，而不是供應商中立
(provider-neutral)。它具備廣泛的目錄與自訂供應商介面，但身分驗證、請求塑形
(request shaping)、串流、推理、重試、配額與可用性仍依供應商而異
（[供應商特性](https://github.com/can1357/oh-my-pi/blob/v18.0.11/docs/provider-quirks.md)）。
供應商的資料保留、模型訓練、資料落地位置與訂閱條款不在 OMP 合約內。

## 授權與相容性注意事項

OMP 的第一方程式碼採 MIT 授權。隨附的第三方程式碼 (vendored code)、相依套件、
字型、資料與標誌，均保留各元件適用的個別聲明；不得將「OMP 採 MIT」擴張為「每一個
產出物 (artifact) 中的所有內容都採 MIT」
（[授權](https://github.com/can1357/oh-my-pi/blob/v18.0.11/LICENSE)、
[第三方聲明](https://github.com/can1357/oh-my-pi/blob/v18.0.11/THIRD-PARTY-NOTICES.txt)）。
檢視過的來源沒有建立 LTS 期間、相容性承諾或支援服務等級協議 (SLA)。

!!! question "待解問題 (Open question) — 下游相容性"
    `v18.0.11` 之後有哪些變更會原封不動發布？源自 Pi 的設定、工作階段、Extension
    或指令慣例又有哪些會保持相容？應重新測試確切的發行版本，而不是從分支系譜或
    `main` 推論相容性。

## 主要來源

- [OMP README，`v18.0.11`](https://github.com/can1357/oh-my-pi/blob/v18.0.11/README.md)
- [設定與設定檔，`v18.0.11`](https://github.com/can1357/oh-my-pi/blob/v18.0.11/docs/config-usage.md)
- [核准模式，`v18.0.11`](https://github.com/can1357/oh-my-pi/blob/v18.0.11/docs/approval-mode.md)
- [工作階段模型，`v18.0.11`](https://github.com/can1357/oh-my-pi/blob/v18.0.11/docs/session.md)
- [工作／子代理行為，`v18.0.11`](https://github.com/can1357/oh-my-pi/blob/v18.0.11/docs/tools/task.md)
- [發行後原始碼快照，commit `9690622`](https://github.com/can1357/oh-my-pi/commit/969062200754ea02cfac922e5ebb8c608c079e15)
