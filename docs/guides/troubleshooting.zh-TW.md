# 疑難排解

先從目前的根目錄 (roots) 與相依項目 (dependencies) 開始：

```sh
pia doctor
pia list --tree
```

如需機器可讀的診斷資訊，請使用 `pia doctor --json`。致命的包裝程式 (wrapper)
錯誤會以 `2` 結束；遭阻擋的 `status` 或遭拒絕的 `apply` 會以 `1` 結束；已啟動的
Pi/OMP 處理程序 (process) 則會轉送自身的結束碼 (exit code)。

## 未選取 combo

**症狀：**執行 `pia`、`pia run` 或 `pia current` 時顯示 `No combo selected`。

```sh
pia list
pia use pi/base
pia current
```

明確指定的 `run` 引數或 `PIA_COMBO` 會覆寫已儲存的選擇。

## 找不到 Pi 或 OMP，或尚未完成身分驗證

`pia doctor` 會將缺少的代理工具執行檔 (agent binaries) 標為警告，因為你可能只使用
一種引擎 (engine)。它只探測版本，不會探測供應商 (provider) 身分驗證或模型
存取權。請另外安裝所選的代理框架 (harness)，再驗證其命令：

```sh
pi --version
omp --version
```

若執行檔位於非標準位置，請使用 `PIA_PI_BIN` 或 `PIA_OMP_BIN` 覆寫 (override)。
combo 不一定會重用未指定設定檔 (profile) 的代理框架所儲存的登入資訊：

- Pi 執行時，`PI_CODING_AGENT_DIR` 會指向 combo 執行階段 (runtime)，因此上游寫入的
  `auth.json` 僅供該 combo 使用。
- OMP 會以 `--profile=pia-<combo>` 執行；其原生 profile 會隔離身分驗證資料、設定、
  工作階段 (session) 與快取。
- 透過環境變數提供的憑證遵循上游供應商規則，且可由父 shell 共用。

請啟動所選的 combo 完成身分驗證；若要重現 OMP 問題，也請使用相同的 profile，
例如：

```sh
pia run pi/base --
pia run omp/base --
omp --profile=pia-base config path
omp --profile=pia-base
```

供應商登入、模型權益與計費仍由上游負責；絕不要將產生的憑證檔案複製到 combo
來源目錄中。

## OMP profile 解析遭拒絕

`pia` 會執行 `omp --profile=pia-<combo> config path`，並要求最後得到的路徑為絕對
路徑，且結尾形式為 `pia-<combo>/agent`。profile 目錄與 `agent/` 都不得為符號連結
(symlink)。

若解析失敗，請執行對應的原生命令，並檢查其最後一行輸出。請勿用手動複製的
執行階段目錄樹繞過路徑形式檢查；應修正 OMP 安裝、profile 行為或執行檔覆寫設定
(executable override)。

## 來源驗證失敗

實作會為許多失敗附加內部錯誤碼 (internal error codes)，但目前的 CLI 會顯示人類
可讀訊息，而不會顯示錯誤碼。閱讀原始碼/測試時可參考以下代碼：

| 內部代碼 | 含義 |
|---|---|
| `PIA_SOURCE_MISSING` | 受掃描的來源目錄不存在；combo 載入時也可能改為顯示未附錯誤碼的缺少 `agent/` 訊息 |
| `PIA_SYMLINK_REJECTED` | 來源根目錄 (source root)、目錄或檔案是符號連結 |
| `PIA_NON_FILE_REJECTED` | 找到通訊端 (socket)、裝置 (device)、FIFO 或其他特殊項目 |
| `PIA_FORBIDDEN_PATH` | 存在憑證/執行階段檔名或根儲存區 (root store) |
| `PIA_INVALID_PATH` | 路徑為空、不可攜，或超過位元組 (byte) 上限 |
| `PIA_PATH_TRAVERSAL` | 路徑元件 (component) 可能逸出根目錄，或以有歧義的方式定址根目錄 |

請將憑證、工作階段、套件儲存區、快取、二進位大型物件 (blob)、資料庫與 `.env`
檔案移出 combo。請以經審查的一般檔案，或代理框架能理解的套件參照取代符號連結。
完整清單請參閱[安全與資料邊界](../concepts/security-and-data-boundaries.md)。

## 套用時回報執行階段漂移或衝突

```sh
pia status <combo>
pia diff <combo> --runtime
```

- `runtime-drift`：先前受管理的執行階段路徑遭到獨立變更。
- `conflict`：來源與執行階段出現分歧、受管理的路徑在不正確的時機消失，或目標有
  阻礙項目。

若對執行階段的修改是有意為之，請將它複製到 combo 中並進行審查。若應以 Git
來源為準，`pia apply <combo> --force` 可修復先前受管理的路徑。它仍會拒絕不受
`pia` 管理的檔案/目錄，以及其他阻礙項目。

## 父項在審查後發生變更

過期的摘要 (digest) 會產生警告，但不會自動合併，也不會阻擋獨立使用：

```sh
pia lineage <child>
pia diff <child> --parent
# Review and adapt the changes.
pia lineage <child> --ack
```

在完整複製而來的子項仍能獨立有效運作之前，請勿確認。

## 工作階段選擇器遺失或有歧義

```sh
pia sessions <combo>
pia fork <from> <to> --session <longer-id-prefix> --
```

請使用更長且唯一的前綴；必要時，使用 `sessions` 傳回的絕對路徑。ID 前綴與
`--latest` 會在來源 combo 的有效引擎/專案/歷史記錄根目錄
(effective engine/project/history root) 內解析。目前的實作會直接剖析絕對路徑
選擇器，且不會強制確認它位於上述根目錄內，因此請勿提供不受信任或不相關的
路徑。`--latest` 很方便，但在並行作業後可能選到不同檔案；若操作需要可重現，
請使用明確的 ID。

## 分支因跨引擎而遭拒絕

原始 Pi 與 OMP 工作階段不具通訊格式相容性 (wire compatibility)。分支操作 (fork)
必須限定在同一引擎內。跨引擎移轉請使用交接 (handoff)：

```sh
pia handoff pi/base omp/base --latest --goal "Continue this task" --no-run
```

## 交接在啟動前失敗

檢查所有前置條件：

```sh
git rev-parse --is-inside-work-tree
git rev-parse --verify HEAD
git status --short
python3 --version
gitleaks version
pia doctor
```

字面名稱為 `python3` 的命令必須回報 Python 3.9 或更新版本，而 `gitleaks` 必須回報
8.25.0 或更新版本。`pia doctor` 只會檢查這兩個命令是否存在，不會檢查其版本。來源
溯源資訊 (provenance) 要求來源工作階段位於可讀取且非裸 (non-bare) 的 Git 工作樹
(working tree)，其中至少有一筆 commit 且 `HEAD` 可解析。儲存庫所追蹤的遮蔽工具
(redactor) 與 `.gitleaks.toml` 必須存在。
剖析、遮蔽、機密驗證、大小限制處理與產物寫入都採取失敗時預設拒絕
(fail closed) 策略。請修正回報的前置條件，而不是停用驗證。

## 原生代理工具引數遭拒絕

由包裝程式管理的執行階段/憑證旗標不能透過 combo 中繼資料或特定目標操作提供。
請將一般原生引數放在 `--` 之後：

```sh
pia run pi/base -- --model provider/model
```

分支/交接操作會自行建立目標工作階段，並拒絕目標引數中的 `--continue`、
`--resume`、`--session`、`--fork`、`--session-dir` 與 `--no-session`。請勿將
`--no-session` 放入 combo 的 `launchArgs`；目前的中繼資料驗證器無法捕捉這項
特定衝突。

## 子處理程序以非零狀態結束

成功套用後，`pia` 會原封不動地傳回 Pi 或 OMP 的結束碼。請以最小化的原生命令
執行相同的代理框架，再比較解析後的 combo、工作目錄與引數。請先使用
`pia status`，以免將乾淨的執行階段誤認為上游代理工具失敗。

## 自動補全過期或不存在

拉取 CLI/自動補全變更後，請重新產生 shell 轉接器 (adapter)。combo 名稱會在補全
時從簽出目錄 (checkout) 掃描，因此若缺少新的 combo，通常表示轉接器指向另一個
來源根目錄。請檢查 `PIA_SOURCE_ROOT`，以及 `PATH` 解析到的啟動器 (launcher)。
