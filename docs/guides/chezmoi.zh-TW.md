# chezmoi 整合

建議採用的 chezmoi 契約 (contract) 範圍很窄：由 chezmoi 在
`~/.local/share/pi-agents` 維護一份**作業上不可變的部署鏡像
(operationally immutable deployment mirror)**，且只有平台啟動器 (launcher)
存在時，才將其 `bin/` 目錄加入 `PATH`。`pia` 會將私有執行階段 (runtime) 狀態
寫在其他位置。

這份鏡像並非由檔案系統強制設為唯讀。請將它視為不可變，以便
`git pull --ff-only` 安全更新；請在一般開發簽出目錄 (development checkout) 中
編輯 combo，完成審查與提交 (commit) 後，再更新 `external`。

此儲存庫 (repository) 不會編輯 dotfiles 儲存庫。請在你自己的 chezmoi 來源目錄中
套用以下做法。

## 私有 `external` 簽出目錄

在 `.chezmoiexternal.toml.tmpl` 中加入類似以下的項目：

```toml
[".local/share/pi-agents"]
    type = "git-repo"
    url = "https://github.com/daviddwlee84/pi-agents.git"
    refreshPeriod = "168h"
    [".local/share/pi-agents".clone]
        args = ["--depth", "1"]
    [".local/share/pi-agents".pull]
        args = ["--ff-only"]
```

此儲存庫為私有。請在 chezmoi 套用 `external` 前，使用你慣用的 Git 憑證或 SSH
設定完成 GitHub 身分驗證 (authentication)；請勿將權杖 (token) 放入此檔案或
任何 combo。

## 在 macOS 與 Linux 上依檔案是否存在設定 PATH

```sh
PIA_EXTERNAL_ROOT="$HOME/.local/share/pi-agents"
if [ -x "$PIA_EXTERNAL_ROOT/bin/pia" ]; then
  export PATH="$PIA_EXTERNAL_ROOT/bin:$PATH"
fi
unset PIA_EXTERNAL_ROOT
```

這項檢查可避免首次建置 (bootstrap) 或複製 (clone) 失敗時，加入無效的 PATH 項目。
啟動器會從本身所在的鏡像推導 `PIA_SOURCE_ROOT`，因此不需要覆寫 (override)。
Node 22.19+ 會直接執行儲存庫所追蹤的 TypeScript；請勿在鏡像中執行 `npm install`
或建立 `dist/`。

## Windows 啟動器與 PATH

同一個 `external` 會出現在 `%USERPROFILE%\.local\share\pi-agents`。請以 cmd 啟動器
是否存在為條件，決定是否加入受管理的使用者 PATH 項目：

```powershell
$piaRoot = Join-Path $HOME ".local\share\pi-agents"
$piaBin = Join-Path $piaRoot "bin"
if (Test-Path (Join-Path $piaBin "pia.cmd")) {
    $env:Path = "$piaBin;$env:Path"
}
```

請透過 dotfiles 儲存庫的標準 Windows PATH 機制持續設定該目錄，不要在每次 shell
啟動時從 `$PROFILE` 附加。PowerShell 會解析 `pia.ps1`；cmd.exe 會解析 `pia.cmd`。
兩者都對應同一個簽出版本 (checkout revision)。

PowerShell 啟動器會針對 `run` 與其經測試的直通分隔符
(passthrough separator)，原樣保留目標引數向量 (`argv`) 的邊界。`fork` 與
`handoff` 目前不會重建 PowerShell 已消耗的 `--` 分隔符，因此在 Windows 上請勿
假定這些命令也具有相同的直通保證。cmd 啟動器採用一般的 cmd.exe 引號規則
(quoting)，適用於受信任的互動式命令。`.gitattributes` 會讓兩個 Windows
啟動器都維持 CRLF 格式。

## 從鏡像產生自動補全

`pia completion zsh`、`bash` 與 `powershell` 會輸出
原生腳本。首次套用時，請明確指定鏡像啟動器的路徑，因為父 shell 可能還看不到
新的 PATH。

請以鏡像的 Git 修訂版本 (revision) 作為快取/更新判定鍵 (cache/freshness key)：
即使 `bin/pia` 沒有變更，自動補全邏輯或 combo 中繼資料仍可能變更。產生的補全
程式 (completer) 會在每次補全時掃描 combo 目錄，因此新增 combo 名稱不需要重新
產生。

常見的目的地如下：

```text
~/.zfunc/_pia
${XDG_DATA_HOME:-~/.local/share}/bash-completion/completions/pia
```

在 Windows 上，請將 `pia completion powershell` 的輸出寫入 dotfiles 儲存庫既有的
已產生的設定檔快取 (generated-profile cache)。

## 更新與驗證

```sh
chezmoi diff
chezmoi apply
chezmoi apply --refresh-externals
pia doctor
pia list --tree
```

`--ff-only` 失敗通常表示鏡像中有本機修改，或其歷史記錄無法快轉 (fast-forward)。
請勿在未檢查的情況下強制重設 (force-reset)：先檢查變更，將任何有意保留的工作
移至開發簽出目錄，還原鏡像，然後再更新。

## 邊界

- 將憑證、工作階段 (session)、資訊清單 (manifest)、交接 (handoff) 產物、套件與快取
  保留在 chezmoi 與鏡像之外。
- 請勿將 combo 檔案直接複製到 `~/.pi` 或 `~/.omp`；請執行 `pia apply`。
- 請勿在鏡像中使用 `pia derive` 或 `pia lineage --ack` 編輯 combo。
- 如需暫時測試尚未提交的工作，請以 `PIA_SOURCE_ROOT=/path/to/checkout` 將已安裝的
  啟動器指向開發簽出目錄（或設定對應的 PowerShell 環境變數）。
- chezmoi 只應負責確保簽出目錄可用、設定 PATH，以及串接產生的自動補全
  (generated completion wiring)。

這能保留所有權鏈 (ownership chain)：chezmoi 部署 CLI 鏡像、Git 追蹤 combo
意圖，而 `pia` 控制私有執行階段的同步。
