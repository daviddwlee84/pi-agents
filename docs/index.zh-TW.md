# pi-agents

`pi-agents` 會將多套 [Pi](https://github.com/earendil-works/pi) 與
[Oh My Pi](https://omp.sh/) 的代理工具框架 (harness) 設定保存在 Git 中。其 `pia`
命令列介面 (CLI) 會選取一個 **combo**，檢查該設定並將其具現化 (materialize)
到私有執行期狀態 (runtime state)，為其提供專案範圍的工作階段目錄
(project-scoped session directory)，再啟動相符的上游代理工具 (agent)。

```text
reviewed combo in Git
        │
        ▼
validate + plan + apply
        │
        ▼
private runtime configuration ──► Pi or Oh My Pi
        │                              │
        └──── manifest + drift checks  └──── private sessions
```

`pia` 刻意維持為一道精簡的所有權邊界 (ownership boundary)。它**不會**安裝 Pi 或
OMP、不會選擇模型 (model) 或供應商 (provider)、不會將憑證 (credentials) 存入此儲存庫，
也不會讓兩者的工作階段格式彼此互通。

## 快速開始

```sh
git clone https://github.com/daviddwlee84/pi-agents.git
cd pi-agents
PIA_CHECKOUT="$PWD"

"$PIA_CHECKOUT/bin/pia" doctor
"$PIA_CHECKOUT/bin/pia" list --tree
"$PIA_CHECKOUT/bin/pia" apply pi/base --dry-run

cd /path/to/your-project
"$PIA_CHECKOUT/bin/pia" run pi/base --
```

最後一個 `cd` 很重要：目前目錄會決定代理工具的工作範圍 (working scope) 與專案範圍歷程
(project-scoped history)。目前此儲存庫是私有的，因此複製儲存庫需要具備存取權的帳號。
`pia` 的核心命令需要 Node.js 22.19 或更新版本；`run` 還需要已選取的上游代理工具框架，而
handoff 另外需要 Git、來源工作階段所在的可讀取且非裸 (non-bare) Git 工作樹
(working tree)（其中至少有一筆 commit 且 `HEAD` 可解析）、`PATH` 上字面名稱為
`python3` 的 3.9 或更新版本執行檔、納入版本控制的遮罩器 (redactor)，以及 `PATH` 上
8.25.0 或更新版本的 `gitleaks`。`pia doctor` 只會檢查這兩個輔助命令是否存在，不會檢查
其版本。如需安裝、首次執行、自動補全
(completion)、更新與移除說明，請參閱[快速開始](getting-started.md)。

## `pia` 管理的內容

| 由 `pia` 管理 | 交由 Pi / OMP 或使用者管理 |
|---|---|
| Combo 中繼資料 (metadata) 與經審查的設定檔 | 代理工具執行檔的安裝與更新 |
| 安全的來源至執行期同步 (source-to-runtime synchronization) | 模型／供應商選擇與計費 |
| 執行期資訊清單 (manifest) 與漂移偵測 (drift detection) | 憑證與上游驗證資料存放區 |
| 每個 combo 專用或明確共用的工作階段根目錄 | 套件、快取、blob 與資料庫 |
| 同引擎分叉 (fork) 與經遮罩的 handoff 成品 | 上游代理迴圈 (agent loop) 與工具 |

簽入儲存庫的 combo 是刻意保持中立的 `learning` 範例，並非可供生產環境使用的模型或
供應商設定。

## 選擇使用路徑

<div class="grid cards" markdown>

-   🚀 **使用 CLI**

    依循[首次執行流程](getting-started.md)，接著瞭解如何
    [編寫 combo](guides/combos.md)。

-   🔐 **瞭解邊界**

    閱讀[架構](concepts/architecture.md)與明確的
    [安全與資料邊界](concepts/security-and-data-boundaries.md)。

-   💻 **自動化 `pia`**

    使用完整的 [CLI 參考資料](reference/cli.md)與
    [路徑和環境參考資料](reference/paths-and-environment.md)。

-   📓 **研究代理工具框架**

    瀏覽附有日期的[研究筆記](notes/index.md)，內容涵蓋 Pi、生態系、程式開發代理工具，
    以及代理工具框架工程 (harness engineering) 實務。

</div>

## 一句話說明設計

Combo 是一份完整且可審查的設定副本；譜系 (lineage) 會明確記錄、執行期漂移
(runtime drift) 會阻止啟動，而可變或敏感狀態則會留在 Git 之外。
