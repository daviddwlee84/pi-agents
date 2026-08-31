# CLI 參考資料

`pia` 是此儲存庫 (repository) 以 Node 原生實作的 TypeScript 命令。執行 `pia --help` 可查看
精簡的內建概要；本頁記錄供人與指令碼 (scripts) 使用的行為。

## 全域形式

| 形式 | 結果 |
|---|---|
| `pia`，不加子命令 (subcommand) | 執行選定的 combo |
| `pia help`、`pia -h`、`pia --help` | 顯示說明 |
| `pia -V`、`pia --version` | 顯示套件版本 |

`run` 會依下列順序解析要選用的 combo：明確指定的 combo、`PIA_COMBO`，接著是
`pia use` 儲存的值。

## 命令

### `run`

```text
pia run [combo] -- [native args...]
```

安全地套用選定的 combo、建立其專案範圍工作階段 (session) 的根目錄，並
啟動 Pi 或 OMP。`--` 後方的原生引數 (native arguments) 會排在已簽入版本控制的
`launchArgs` 與包裝器 (wrapper) 的 `--session-dir` 之後。子行程 (child process) 的
結束碼 (exit code) 會成為 `pia` 的結束碼。

直接執行 `pia`，等同於執行未明確指定 combo 或原生引數的 `pia run`。

### `use` 與 `current`

```text
pia use <combo>
pia current
```

`use` 會驗證並儲存 combo ID，然後分別在兩行顯示該 ID 與選擇檔案的路徑。
`current` 會顯示目前有效的已儲存值或 `PIA_COMBO` 值；若未選取有效的 combo，
此命令便會失敗。

### `list`

```text
pia list [--tree] [--json]
```

列出探索到的 combo。預設輸出是以 Tab 分隔、供人閱讀的摘要；`--tree`
會顯示譜系 (lineage)；`--json` 的優先順序最高，並會傳回陣列：

```json
[
  {
    "id": "pi/base",
    "$schema": "../../../schema/combo.schema.json",
    "schemaVersion": 1,
    "description": "Neutral upstream Pi profile with isolated runtime state.",
    "maturity": "learning",
    "launchArgs": [],
    "history": { "mode": "isolated" }
  }
]
```

### `derive`

```text
pia derive <parent> <child> [--description TEXT]
```

複製完整的父 combo、寫入同一引擎的譜系中繼資料 (metadata)，並顯示子 combo ID。
`--description=value` 與 `--description value` 兩種形式皆可使用。父 combo 並非
即時疊加層 (live overlay)。

### `lineage`

```text
pia lineage <combo> [--ack] [--json]
```

顯示祖先、審查狀態與直接後代。`--ack` 會先記錄目前的父項摘要 (digest)，再顯示
結果；它絕不會合併內容。

```json
{
  "combo": "pi/vanilla",
  "ancestors": [
    {
      "id": "pi/base",
      "digest": "sha256:…",
      "reviewed": true,
      "recordedDigest": "sha256:…"
    }
  ],
  "descendants": []
}
```

在實際輸出中，上方的省略號代表一段由 64 個小寫字元組成的摘要。

### `status`

```text
pia status <combo> [--json]
```

分類受管理來源與執行階段 (runtime) 之間的關係。供人閱讀的輸出會省略狀態為
clean 的檔案。狀態受阻時會以 `1` 結束。

JSON 會將執行階段狀態與解析完成的路徑包在一起：

```json
{
  "targetDir": "/home/user/.local/state/pi-agents/runtime/pi/base/agent",
  "manifestPath": "/home/user/.local/state/pi-agents/manifests/pi/base.json",
  "sessionDir": "/home/user/.local/state/pi-agents/sessions/pi/base/project-a1b2c3d4e5f6",
  "status": {
    "state": "clean",
    "classification": "clean",
    "hasChanges": false,
    "hasRuntimeDrift": false,
    "hasConflicts": false,
    "canApply": true,
    "canForceApply": true,
    "counts": {
      "clean": 1,
      "source-only-update": 0,
      "runtime-drift": 0,
      "conflict": 0,
      "new": 0,
      "stale": 0,
      "total": 1
    },
    "files": []
  }
}
```

實際的 `status` 還包含其他來源、目標、資訊清單 (manifest)、模式及個別檔案的中繼資料；
請勿只依照這個簡化範例進行剖析。

### `diff`

```text
pia diff <combo> [--runtime | --parent] [--json]
```

預設使用執行階段模式。它只會回報由來源/資訊清單管理的路徑，不會回報
目標端中不受管理且只存在於該處的檔案。`--parent` 會比較衍生 combo 的 `agent/`
樹與其父 combo，且不需要解析執行階段目標。兩個模式旗標 (mode flags) 互斥。

執行階段 JSON 包含 `sourceDir`、`targetDir`、`manifestPath`、`sourceDigest`、
`runtime`、`files`、`parent: null` 與 `text: null`。父項 JSON 包含：

```json
{
  "directory": "/checkout/combos/pi/base/agent",
  "digest": "…",
  "counts": {
    "added": 0,
    "removed": 0,
    "modified": 1,
    "unchanged": 0,
    "total": 1
  },
  "files": [
    {
      "path": "settings.json",
      "status": "modified",
      "source": { "sha256": "…", "executable": false, "mode": 384, "size": 3 },
      "parent": { "sha256": "…", "executable": false, "mode": 384, "size": 3 }
    }
  ]
}
```

### `apply`

```text
pia apply <combo> [--dry-run] [--force] [--json]
```

規劃受管理樹，且除非使用試執行 (dry run)，否則會將其實體化。`--force` 可以
修復資訊清單已管理的路徑；它無法覆寫不受管理的路徑碰撞 (collision)。套用遭拒時
會以 `1` 結束。

JSON 封套 (envelope) 包含解析完成的 `targetDir`、`manifestPath`、`sessionDir`，以及
具判別資訊的結果 (discriminated result) `result`：

```json
{
  "targetDir": "/state/runtime/pi/base/agent",
  "manifestPath": "/state/manifests/pi/base.json",
  "sessionDir": "/state/sessions/pi/base/project-a1b2c3d4e5f6",
  "result": {
    "ok": true,
    "applied": false,
    "changed": true,
    "dryRun": true,
    "force": false,
    "refused": false,
    "reason": null,
    "actions": [
      { "action": "ensure-target", "mode": 448 },
      { "action": "write", "path": "settings.json", "classification": "new" },
      { "action": "write-manifest" }
    ],
    "after": null
  }
}
```

遭拒時會有 `ok: false`、`refused: true`，而 reason 會是
`runtime-drift-or-conflict` 或 `unowned-or-obstructed-target`。完整結果也會包含
`before` 與擬議的資訊清單；套用完成後則包含 `after`。數值模式是 POSIX
`0700`/`0600` 在 JSON 中的十進位表示法。

### `sessions`

```text
pia sessions <combo> [--json]
```

列出有效的引擎/combo（或群組）/專案根目錄中直接包含的 `.jsonl` 檔案，並由新至舊
排列。供人閱讀的輸出以 Tab 分隔 ID、標題、修改時間與絕對路徑。

!!! warning "JSON 包含對話內容"
    `--json` 會序列化完整的已剖析記錄：`engine`、標題/標題欄位、header、ID、cwd、
    `entries`、`activeBranch`、path/filePath、修改時間、修改時間的毫秒值，以及大小。
    請將其視為敏感資料。其結構是為診斷而設計，並非已遮蔽敏感內容的匯出格式
    (redacted export format)。

```json
[
  {
    "engine": "pi",
    "id": "abcdef123456",
    "cwd": "/work/project",
    "entries": [],
    "activeBranch": [],
    "path": "/state/sessions/pi/base/project-hash/session.jsonl",
    "filePath": "/state/sessions/pi/base/project-hash/session.jsonl",
    "mtime": "2026-08-31T00:00:00.000Z",
    "mtimeMs": 1788134400000,
    "size": 128
  }
]
```

### `fork`

```text
pia fork <from> <to> (--session ID|PATH | --latest) -- [target args...]
```

必須恰好提供一個選擇器 (selector)，且兩個 combo 必須使用相同引擎。此命令會解析
來源工作階段、從來源工作目錄啟動目標，並傳入原生的
`--fork <absolute-session-path>`。目標工作階段的路由旗標會遭拒。子行程的結束碼
會向外轉送。

### `handoff`

```text
pia handoff <from> <to> (--session ID|PATH | --latest) \
  --goal TEXT [--max-bytes N] [--no-run] -- [target args...]
```

必須提供一個選擇器與非空的目標。`--goal=value` / `--goal value` 及
`--max-bytes=value` / `--max-bytes value` 皆可使用。預設上限為 131072 位元組 (bytes)；
最小值為 4096。來源溯源資訊 (provenance) 要求來源工作階段位於可讀取且非裸
(non-bare) 的 Git 工作樹 (working tree)，其中至少有一筆 commit 且 `HEAD` 可解析。

此命令會先顯示產生的產出物 (artifact) 路徑。使用 `--no-run` 時，這就是唯一的命令
輸出。否則，它會啟動全新的目標工作階段；其 stdout/stderr 會沿用繼承的串流
(streams)，並向外轉送其結束碼。請參閱[工作階段與 handoff](../guides/sessions-and-handoff.md)。

### `doctor`

```text
pia doctor [--json]
```

檢查 Node 版本；Git 及選用且字面名稱為 `python3`/`gitleaks` 的 handoff 輔助命令
是否存在；Pi/OMP 二進位檔 (binaries) 探測；探索到的一般 combo 目錄；來源安全性；
以及選擇狀態。它不會檢查輔助命令版本：handoff 需要 3.9 或更新版本的 `python3`，
以及 8.25.0 或更新版本的 `gitleaks`。它會回報解析完成的來源/設定/狀態根目錄字串，
但不驗證每個路徑是否可用。handoff 來源溯源資訊仍要求來源工作階段位於可讀取且非裸
(non-bare) 的 Git 工作樹 (working tree)，其中至少有一筆 commit 且 `HEAD` 可解析；
`doctor` 不會驗證此狀態。探索時會略過以符號連結 (symlink) 形式存在的
combo 目錄項目，而不會將其診斷為問題。缺少 Pi、OMP、`python3` 或 `gitleaks` 只會產生
警告。目前若沒有已儲存的選擇，檢查仍會回報為 **ok**，detail 為 `none`，即使直接
執行 `pia` 與 `pia current` 仍需要 `PIA_COMBO` 或 `pia use`。Node 版本無效或探索到的
combo 樹無效時會回報錯誤。探索結果為空時，目前會回報 `0 valid`，而非失敗。

```json
{
  "checks": [
    { "name": "node", "ok": true, "detail": "22.19.0", "severity": "error" },
    { "name": "gitleaks", "ok": false, "detail": "not found", "severity": "warning" },
    { "name": "combos", "ok": true, "detail": "3 valid", "severity": "error" }
  ]
}
```

doctor 只會在至少一項未通過的檢查具有 `severity: "error"` 時，以 `1` 結束。

### `completion`

```text
pia completion <zsh | bash | powershell>
```

在 stdout 輸出原生指令碼。`pwsh` 可作為 `powershell` 未記錄於文件的別名 (alias)。
補全 (completion) 輸出絕不會套用色彩。

## 選項剖析

具名值選項接受 `--name=value` 與 `--name value`。布林 (Boolean) 旗標無論出現在
直通分隔符 (passthrough separator) 之前的何處，都會被移除。其餘無法辨識的引數會
視為錯誤。`--` 會分隔包裝器引數與原生目標引數；它對 `run`、`fork` 與 `handoff`
具有實質意義。

## 輸出與色彩

當目的串流支援時，供人閱讀的狀態、樹狀與動作輸出會使用語意色彩 (semantic color)。
設為非空值的 `NO_COLOR` 與 `NODE_DISABLE_COLORS` 會停用色彩；`FORCE_COLOR` 與非零的
`CLICOLOR_FORCE` 則可強制啟用色彩。

JSON、版本、combo ID、補全程式碼與 handoff 產出物路徑會維持純文字。致命診斷與
譜系警告會送至 stderr；結構化命令結果則送至 stdout。

## 結束狀態

| 狀態 | 意義 |
|---:|---|
| `0` | 包裝器命令成功完成 |
| `1` | `status` 受阻、`apply` 遭拒，或 `doctor` 有一項錯誤嚴重度的檢查未通過 |
| `2` | CLI 剖析、驗證、來源/執行階段操作或先決條件在啟動前失敗 |
| 子行程狀態 | `run`、啟動中的 `fork` 與啟動中的 `handoff` 會向外轉送上游行程結果 |
