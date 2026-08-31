# 快速開始

本指南會帶領你將新的簽出內容 (checkout) 從零準備到可控的首次啟動。`pia`
直接從儲存庫執行：沒有編譯後的 `dist/` 目錄，也不需要安裝執行期 npm 相依套件
(runtime npm dependency installation)。

## 必要條件

| 需求 | 用途 |
|---|---|
| Node.js 22.19 或更新版本 | 所有 `pia` 命令 |
| Git | 複製與譜系工作流程 (lineage workflows)；handoff 來源追溯 (handoff provenance) 還要求來源工作階段位於可讀取且非裸 (non-bare) 的 Git 工作樹 (working tree)，其中至少有一筆 commit 且 `HEAD` 可解析 |
| [Pi](https://github.com/earendil-works/pi) 和／或 [Oh My Pi](https://omp.sh/) | 使用相應引擎 (engine) 執行 combo |
| `PATH` 上字面名稱為 `python3` 的 3.9 或更新版本執行檔，以及 `PATH` 上 8.25.0 或更新版本的 [`gitleaks`](https://github.com/gitleaks/gitleaks) | 建立 handoff |

請依照 Pi 或 OMP 各自的第一方說明進行安裝。`pia` 不會代你登入供應商，也不會代你選擇
模型。由於它會使用 combo 專屬代理工具 (agent) 目錄啟動 Pi，並使用 combo 專屬 profile 啟動
OMP，因此未套用 profile 的原生代理工具框架 (harness) 中已儲存的登入資訊，不一定是 combo 實際使用
的登入資訊。請在選定的 `pia run` 情境中完成任何必要的身分驗證 (authentication)；由環境
提供的憑證 (credentials) 仍受上游代理工具框架 規則約束。代理工具框架寫入的憑證會保持私密，且
一律不得納入 combo 來源。

!!! note "`doctor` 警告與 handoff"
    缺少 `python3`、`gitleaks`、Pi 或 OMP 時會顯示警告，因為並非每個命令都需要所有
    輔助工具。對於 `python3` 與 `gitleaks`，`doctor` 只會檢查命令是否存在，不會檢查
    必要版本；請另行驗證最低版本。任一輔助工具無法使用時，handoff 仍會採取失敗時
    預設拒絕 (fail closed) 策略。

## 取得私有簽出內容

```sh
git clone https://github.com/daviddwlee84/pi-agents.git
cd pi-agents
```

此版本發佈時儲存庫仍為私有，因此需要 GitHub 驗證與儲存庫存取權。請直接執行對應平台
的啟動器 (platform launcher)：

=== "macOS / Linux"

    ```sh
    ./bin/pia --version
    ```

=== "PowerShell"

    ```powershell
    .\bin\pia.ps1 --version
    ```

=== "cmd.exe"

    ```bat
    bin\pia.cmd --version
    ```

將 `bin/` 加入 `PATH`，即可使用簡短命令 `pia`。`npm link` 是供**開發用簽出內容**
使用的便利選項，並非從 npm 發佈的安裝方式：

```sh
npm link
pia --version
```

只有在參與開發、進行型別檢查 (type-checking) 或執行測試套件 (test suite) 時，才需要
`npm install` 或 `npm ci`。以下範例都假設可透過 `PATH` 解析到 `pia`；否則，請改用此簽出內容中
對應平台啟動器的絕對路徑。

## 瞭解隨附的 combo

```sh
pia list --tree
```

第一個版本包含：

| Combo | 用途 |
|---|---|
| `pi/base` | 採用上游預設 (upstream-default) 的 Pi 設定與隔離的歷程 (isolated history)；一般專案／全域探索 (project/global discovery) 仍保持啟用 |
| `pi/vanilla` | 衍生自 Pi 的學習基準；啟動旗標 (launch flags) 會停用核准機制 (approvals)，以及探索到的 Extensions、Skills、提示詞 (prompts)、主題 (themes) 與內容檔案 (context files) |
| `omp/base` | 採用上游預設的 OMP 原生 profile，並提供隔離的歷程 |

三者的 `maturity: learning` 都相同。其設定刻意留空或維持最少內容。此處的
「upstream-default」表示 代理工具框架仍可探索資源並套用一般的信任／權限行為；並不表示
已隔離或已置於沙箱 (sandbox) 中。`pia` 控制具現化 (materialization) 與工作階段路由
(session routing)，而不控制模型工具、shell 命令、網路存取、Extensions 或子程序。
若你需要探索範圍較窄的 Pi 基準，請使用 `pi/vanilla`，但啟動前仍須檢查實際生效的
上游權限／環境邊界。

首次啟動時，系統可能會要求你在 combo 專屬 Pi 目錄或 OMP profile 中完成模型、供應商
或驗證設定。該私有狀態屬於上游代理工具框架，而非此儲存庫。

## 檢查並選擇目標專案

除非你確實要讓代理工具在 `pi-agents` 儲存庫上作業，否則不要停留在該簽出內容中。
目前目錄會成為子程序工作目錄 (child process working directory)，並會參與產生專案範圍的
工作階段金鑰 (project-scoped session key)：

```sh
cd /path/to/your-project
pia doctor
```

`doctor` 會檢查 Node 版本、Git、選用的 handoff 輔助命令是否存在、已安裝的代理工具框架
執行檔、探索到的 combo 是否有效，以及目前選取項目。它會回報解析後的來源／設定／狀態根目錄，
但不會探測每個根目錄目前是否可用，也不會驗證供應商登入或模型存取權。

選擇已安裝的引擎。`--dry-run` 會計算確切的套用計畫 (apply plan)，但不變更執行期狀態：

=== "Pi 上游預設值"

    ```sh
    pia apply pi/base --dry-run
    pia apply pi/base
    pia run pi/base --
    ```

=== "Pi 窄化探索基準"

    ```sh
    pia apply pi/vanilla --dry-run
    pia apply pi/vanilla
    pia run pi/vanilla --
    ```

=== "Oh My Pi"

    ```sh
    pia apply omp/base --dry-run
    pia apply omp/base
    pia run omp/base --
    ```

請在此選定情境中完成所有上游驗證提示。`run` 每次啟動前都會再次執行安全套用。若來源
驗證 (source validation)、執行期漂移 (runtime drift)、衝突 (conflict) 或未受管理的碰撞
(unowned collision) 使作業受阻，它會在代理工具啟動前停止。

## 選取預設 combo 並傳遞原生引數 (native arguments)

```sh
pia use pi/base
pia current
pia run -- --model provider/model
```

選取優先順序 (selection precedence) 如下：

1. 明確提供給 `run` 的 combo；
2. `PIA_COMBO`；
3. 由 `pia use` 儲存的選取項目。

`--` 後的一般引數會傳遞給所選代理工具框架。`pia` 仍會在啟動前拒絕包裝器專屬
(wrapper-owned) 的 `--profile`、`--alias`、`--session-dir`、`--cwd` 與 `--api-key`。請保留
分隔符號 (separator)，讓它能區分包裝器引數與 Pi 或 OMP 的原生引數。不加子命令執行
`pia`，就是執行所選 combo 的簡寫方式。

## 啟用自動補全 (completion)

=== "zsh"

    ```sh
    mkdir -p ~/.zfunc
    pia completion zsh > ~/.zfunc/_pia
    ```

=== "bash"

    ```sh
    mkdir -p "${XDG_DATA_HOME:-$HOME/.local/share}/bash-completion/completions"
    pia completion bash > "${XDG_DATA_HOME:-$HOME/.local/share}/bash-completion/completions/pia"
    ```

=== "PowerShell"

    ```powershell
    pia completion powershell | Out-String | Invoke-Expression
    ```

自動補全會直接讀取 combo 目錄，因此新拉取或衍生的 combo 無須重新產生指令稿便會出現。
[chezmoi 指南](guides/chezmoi.md)說明如何從外部簽出內容快取及部署自動補全。

## 更新或移除簽出內容

請使用你平時經審查的 Git 工作流程更新一般開發用簽出內容。若是 chezmoi 鏡像
(mirror)，請使用其 `--ff-only` 重新整理流程，而不要就地編輯鏡像。

刪除簽出內容前，若要先移除開發連結：

```sh
npm unlink --global pi-agents
```

刪除簽出內容不會刪除私有狀態。移除前，請分別檢查下列位置：

```text
${XDG_CONFIG_HOME:-~/.config}/pi-agents/
${PIA_STATE_HOME:-${XDG_STATE_HOME:-~/.local/state}/pi-agents}/
```

其中可能包含已儲存的選取項目、Pi 具現化設定、資訊清單、工作階段與 handoff 成品。
OMP 的具現化內容位於此狀態根目錄外的原生 profile 中。進行任何清理前，請先解析你實際
使用過的每個 profile：

```sh
omp --profile=pia-base config path
```

請檢查回傳的整個 `pia-<combo>` profile 樹狀結構，而不只是其 `agent/` 葉節點。其中可能
包含由上游管理的憑證、快取與其他私有狀態。不要在無人監督的解除安裝作業中，遞迴移除
`pia` 根目錄或 OMP profile。

## 後續步驟

- 使用 [Combo](guides/combos.md) 建立經審查的設定。
- 透過[安全與資料邊界](concepts/security-and-data-boundaries.md)瞭解可複製的內容。
- 透過[工作階段與 handoff](guides/sessions-and-handoff.md)安全使用工作階段。
- 在 [CLI 參考資料](reference/cli.md)中查閱每個命令。
