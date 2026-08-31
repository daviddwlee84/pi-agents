# 路徑與環境

下列所有路徑都是預設值。`~` 代表目前作業系統 (operating system) 使用者的家目錄
(home directory)。

## 來源與私有根目錄

| 用途 | 預設值 | 覆寫方式 |
|---|---|---|
| 來源簽出目錄 (source checkout) | 從執行中的 `src/`/啟動器 (launcher) 簽出目錄解析 | `PIA_SOURCE_ROOT` |
| 設定根目錄 (config root) | `${XDG_CONFIG_HOME:-~/.config}/pi-agents` | `XDG_CONFIG_HOME` |
| 狀態根目錄 (state root) | `${XDG_STATE_HOME:-~/.local/state}/pi-agents` | `PIA_STATE_HOME`，否則使用 `XDG_STATE_HOME` |
| 已儲存的選擇 (saved selection) | `<config-root>/selection.json` | 由設定根目錄衍生 |

`PIA_STATE_HOME` 會取代整個狀態根目錄；它不是一個會再附加 `pi-agents` 的父目錄。
`PIA_SOURCE_ROOT` 適合用於測試，或讓已安裝的啟動器指向尚未提交的開發簽出目錄。

## 狀態目錄結構 (state layout)

```text
<state-root>/
  manifests/<engine>/<combo>.json
  runtime/pi/<combo>/agent/
  sessions/<engine>/<combo>/<project-key>/
  sessions/<engine>/shared/<group>/<project-key>/
  handoffs/<content-addressed-artifact>.md
```

OMP 的實體化設定 (materialized configuration) 不會放在 `runtime/omp` 下。`pia` 將原生
profile 命名為
`pia-<combo>`，並向 OMP 查詢其設定路徑。傳回的絕對路徑必須以
`pia-<combo>/agent` 結尾；若最後兩個元件的任一項是符號連結 (symlink) 或不是目錄，
`pia` 都會拒絕。目前它不會逐層檢查並拒絕更前面的祖先目錄中的符號連結，因此 OMP
安裝位置及其父目錄仍屬於受信任的檔案系統邊界。

在 POSIX 上，私有目錄會以 `0700` 建立，私有 JSON/檔案則以 `0600` 建立。
由 `derive` 或譜系確認 (lineage acknowledgement) 所建立的來源 JSON 為 `0644`。
Windows 使用使用者設定檔 (user profile) 的存取控制清單 (ACL)，而非 POSIX 模式檢查。

## 工作階段 (session) 專案鍵值

最末層鍵值 (leaf key) 為：

```text
<sanitized-working-directory-basename>-<12-hex-sha256-prefix>
```

雜湊 (hash) 是根據正規化的絕對工作目錄 (canonical absolute working directory) 計算。
基本名稱 (basename) 會經過正規化、調整為檔案系統安全的形式，並限制在 120 個字元內。
如此可區分基本名稱相同的兩個儲存庫 (repositories)，同時保持路徑易讀。即使路徑
不存在，仍會以確定性方式正規化。

## 公開環境變數

| 變數 | 效果 |
|---|---|
| `PIA_COMBO` | 覆寫 `pia use` 儲存的選擇 |
| `PIA_SOURCE_ROOT` | 使用另一個簽出目錄作為來源 |
| `PIA_STATE_HOME` | 取代所有預設私有狀態 |
| `XDG_STATE_HOME` | 未設定 `PIA_STATE_HOME` 時，作為預設狀態的父目錄 |
| `XDG_CONFIG_HOME` | 作為儲存選擇的父目錄 |
| `PIA_PI_BIN` | 使用指定的 Pi 可執行檔名稱或路徑，而非 `pi` |
| `PIA_OMP_BIN` | 使用指定的 OMP 可執行檔名稱或路徑，而非 `omp` |

可執行檔覆寫值會直接傳給安全的行程解析 (process resolution)。`pia` 不會為子行程
(child processes) 啟用命令殼層剖析 (shell parsing)。

## 子行程環境與引數

對 Pi 而言，`pia` 會設定：

```text
PI_CODING_AGENT_DIR=<resolved Pi runtime agent directory>
```

對 OMP 而言，它會移除繼承而來的 Pi/OMP profile 變數，並傳入：

```text
--profile=pia-<combo>
```

對兩個引擎而言，`pia` 都會移除繼承而來的 `PI_CODING_AGENT_SESSION_DIR`、建立選定的
私有工作階段最末層目錄，並傳入：

```text
--session-dir <session leaf>
```

接著，它會附加在 CLI `--` 分隔符之後提供的一次性原生引數。啟動 fork 與 handoff
時，會使用所選工作階段的工作目錄。

## 色彩環境

供人閱讀的輸出遵循下列常見控制方式：

| 變數 | 行為 |
|---|---|
| `NO_COLOR` | 設為非空值時停用色彩 |
| `NODE_DISABLE_COLORS` | 停用 Node/CLI 色彩 |
| `FORCE_COLOR` | 依照其一般 Node 語意強制啟用色彩 |
| `CLICOLOR_FORCE` | 非零值會強制啟用色彩 |

供機器處理的 JSON、產生的補全內容、套件版本、選定的 ID 與 handoff 產出物路徑
都不會上色。

## 命令殼層 (shell) 補全 (completion) 與來源探索 (source discovery)

產生的補全指令碼 (completion scripts) 會插入簽出目錄的來源根目錄，但仍遵循
執行階段 (runtime) 的 `PIA_SOURCE_ROOT`。它們會直接掃描 `combos/pi/` 與 `combos/omp/`，
因此不必在每次按下 Tab 時啟動 Node，也能在不重新產生補全內容的情況下顯示剛拉取的
combo。

## 請勿透過複製搬移私有狀態

請在建立狀態前使用環境覆寫，或透過明確且經過審查的遷移來搬移狀態。資訊清單
(manifests) 會綁定至精確的絕對執行階段目標，並會在讀取時進行驗證；將資訊清單複製到
不同目標會導致拒絕，而不會默默採用新位置。
