# 安全與資料邊界

`pia` 是同步器 (synchronizer) 與啟動器 (launcher)，而非沙箱 (sandbox)。其安全契約
(safety contract) 是將經審查的設定與可變／私有的代理工具 (agent) 狀態分開，並拒絕語意不明的
寫入。上游代理工具框架 (harness)、模型供應商、工具、shell、網路與作業系統帳號仍是彼此獨立的
信任邊界 (trust boundary)。

## 可進入 combo 的內容

只會管理 `combos/<engine>/<name>/agent/` 下的一般檔案。來源目錄、子目錄與檔案不得為
符號連結 (symbolic links)；通訊端 (sockets)、裝置、FIFO 與其他特殊檔案都會被拒絕。

下列禁止名稱的路徑檢查不區分大小寫 (case-insensitive)。

| 相對路徑中任何位置都會拒絕 | 作為第一個路徑元件時會拒絕（檔案或目錄） |
|---|---|
| 名稱以 `.env` 開頭 | `sessions` |
| 名稱以 `.pia-` 開頭 | `blobs` |
| `auth.json` | `cache` |
| `oauth.json` | `npm` |
| `agent.db` | `git` |
|  | `tmp` |

前置點號無法規避第一個路徑元件偵測 (first-component detection)，因此 `.sessions` 也會
遭拒。此檢查會在判斷項目類型之前執行：例如，名為 `cache` 的根層級一般檔案也會遭拒。
此外，來源路徑符合下列任一條件時也會遭拒：

- 為空、是絕對路徑、含有 NUL 或反斜線；
- 含有空的、`.` 或 `..` 元件；
- UTF-8 位元組總數超過 4096；
- 任一元件超過 255 個 UTF-8 位元組。

這些規則可防止常見憑證 (credentials) 與執行期資料存放區 (runtime stores) 進入 Git；但
無法辨識所有可能的機密檔名。請將供應商驗證資訊 (provider authentication) 與含有機密的設定
(secret-bearing settings) 保留在上游代理工具框架 的私有機制中。

## 所有權邊界 (ownership boundaries)

| 資料 | 擁有者與位置 |
|---|---|
| 經審查的 combo 來源 | `combos/` 下的 Git 簽出內容 |
| 已儲存的選取項目 | `${XDG_CONFIG_HOME:-~/.config}/pi-agents/selection.json` |
| Pi 具現化設定 (materialized config) | `$PIA_STATE_HOME/runtime/pi/<combo>/agent`（或預設狀態根目錄） |
| OMP 具現化設定 | OMP 回傳的原生 `pia-<combo>` profile 路徑 |
| 套用資訊清單 (apply manifests) | `$PIA_STATE_HOME/manifests/<engine>/<combo>.json` |
| 工作階段 (sessions) | `$PIA_STATE_HOME/sessions/...` |
| handoff 成品 (handoff artifacts) | `$PIA_STATE_HOME/handoffs/...` |
| 憑證、套件、快取、blob | 上游代理工具框架／私有執行期；絕不納入 combo 來源 |

`PIA_STATE_HOME` 會取代預設的
`${XDG_STATE_HOME:-~/.local/state}/pi-agents` 根目錄。不會假設 OMP 的目標位置；`pia`
會先驗證 OMP 回傳的 profile 路徑，再加以使用。

## 三方套用決策 (three-way apply decisions)

資訊清單會限制 `pia` 擁有的內容。任何寫入前都會先將每條路徑分類：

| 情況 | 分類 | 一般套用結果 |
|---|---|---|
| 來源與受管理執行期都和資訊清單相同 | `clean` | 不寫入內容 |
| 來源已變更；受管理執行期仍相符 | `source-only-update` | 寫入來源版本 |
| 新來源；目標不存在 | `new` | 建立 |
| 來源已移除；受管理目標未變更／不存在 | `stale` | 移除／忘記 |
| 受管理執行期已獨立變更 | `runtime-drift` | 拒絕 |
| 來源與執行期已分歧，或來源變更後受管理檔案消失 | `conflict` | 拒絕 |
| 新來源與不受管理的檔案或障礙物碰撞 | 造成阻擋的 `conflict` | 一律拒絕 |

首次套用中斷後，內容相符的不受管理檔案 (matching unowned file) 可以被接管；但內容不同
的不受管理檔案絕不會遭覆寫。未列於資訊清單、僅存在目標端的檔案內容，仍不受管理且會
予以保留。受管理子項目所需的既有父目錄，在 POSIX 上仍可能將其權限模式 (mode) 正規化
為 `0700`。

`pia apply --dry-run` 會計算相同計畫，但不會寫入。

## `--force` 的含義

`--force` 會讓簽入儲存庫的來源覆蓋**先前受管理的**執行期漂移或衝突，包括已修改的
過時檔案。它不能覆寫不受管理的碰撞或非檔案障礙物。這是受資訊清單範圍限制的修復作業
(manifest-bounded repair operation)，而非遞迴取代代理工具目錄。

強制套用前：

```sh
pia status <combo>
pia diff <combo> --runtime
```

請先將任何刻意進行的執行期編輯帶回經審查的 combo 中。

## 檔案系統保護措施 (filesystem protections)

在 POSIX 系統上，`pia` 會以 `0700` 模式建立執行期／狀態目錄；受管理檔案則依可執行
意圖採用 `0600` 或 `0700`。個別寫入與資訊清單取代都會使用暫存檔及不可分割重新命名
(atomic rename)，但多檔案套用沒有復原交易 (rollback transaction)。寫入／接管動作會
重新驗證即將使用的來源與目標；移除過時項目時會重新驗證目標，但目前不會再次檢查來源
路徑是否仍不存在。

在 Windows 上，Node 無法提供對等的 POSIX 模式強制措施。檔案會繼承使用者 profile 的
ACL，且漂移比較會忽略合成的模式位元 (synthetic mode bits)。請據此保護 Windows 帳號與
profile 目錄。

## 機密掃描 (secret scanning) 與 handoff 限制

若可使用 `gitleaks`，儲存庫檢查會用它掃描 combo 內容。CI 會簽出完整歷程，並在 push
與 Pull Request (PR) 事件中執行 `gitleaks-action`；該 action 會掃描事件所關聯的 commit
範圍，而不保證每次執行都掃描全部歷程。掃描可輔助審查，但無法取代審查。

handoff 會排除隱藏思考、圖片、工具引數與成功的工具輸出，限制失敗輸出的長度，執行納入
版本控制的遮罩器 (tracked redactor)，接著要求通過 `gitleaks` 驗證。任何輔助工具失敗
都會中止作業。產生的 Markdown 仍可能包含以一般敘述寫下的敏感事實，因此分享前請先
審查。請參閱
[工作階段與 handoff](../guides/sessions-and-handoff.md)。

!!! warning "並非執行沙箱"
    `pia` 不會限制 Pi、OMP、Extensions、Skills、套件、模型工具或子程序能執行的操作。
    請使用上游權限模型，以及符合工作負載需求的作業系統／容器邊界。
