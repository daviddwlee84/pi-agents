# 設定組合 (combo)

每個 combo 都是一套完整且可供選取的 代理工具設定 (agent setup)。其 ID 為
`<engine>/<name>`，其中 `engine` 為 `pi` 或 `omp`。`pia` 會複製已審查的設定，
而不會在啟動時合併繼承關係圖 (inheritance graph)。

## 隨附範例

| ID | 成熟度 | 用途 |
|---|---|---|
| `pi/base` | `learning` | 中立的 Pi 代理工具目錄 |
| `pi/vanilla` | `learning` | 衍生的 Pi 設定，透過啟動旗標 (launch flags) 停用專案與全域資源 |
| `omp/base` | `learning` | 中立的 OMP 原生設定檔 (native profile) |

這些範例刻意保留為空或只包含最低限度的內容。它們用來示範隔離 (isolation)
與譜系 (lineage)，並非針對特定模型、供應商 (provider) 或團隊的 `production`
設定。

## 目錄配置

```text
combos/pi/research/
  combo.json
  agent/
    settings.json
    AGENTS.md
    skills/
    extensions/
```

`agent/` 是完整的受管理目錄樹 (managed tree)，而不是差異內容 (delta)。請勿在
其中放置身分驗證資料 (auth)、`.env*`、工作階段 (session)、資料庫、套件儲存區、
快取或二進位大型物件 (blob)。強制執行的規則請參閱
[安全與資料邊界](../concepts/security-and-data-boundaries.md)。

## 中繼資料

最小的 `combo.json` 如下：

```json
{
  "$schema": "../../../schema/combo.schema.json",
  "schemaVersion": 1,
  "description": "Research-oriented upstream Pi harness.",
  "maturity": "experimental",
  "launchArgs": [],
  "history": {
    "mode": "isolated"
  }
}
```

| 欄位 | 約定 |
|---|---|
| `$schema` | 選用的編輯器/結構描述 (schema) URI |
| `schemaVersion` | 必須是 `1` |
| `description` | 不可為空的人類可讀說明 |
| `maturity` | `experimental`、`learning` 或 `production` |
| `launchArgs` | 每次啟動時使用且不含機密的原生引數 |
| `history` | 隔離，或在具名的同引擎群組內共用 |
| `derivedFrom` / `parentDigest` | 由 `derive` 寫入且必須成對出現的譜系欄位 |

combo 與共用群組名稱的長度為 1–60 個小寫安全名稱字元 (safe-name characters)。
名稱須以英文字母或數字開頭，可包含小寫英文字母、數字、`.`、`_` 與 `-`，且
不得以句點結尾。這也可確保 `pia-<name>` 是有效的 OMP profile。

共用歷史記錄 (shared history) 必須明確指定：

```json
{
  "history": {
    "mode": "shared",
    "group": "daily-coding"
  }
}
```

即使使用共用歷史記錄，仍會依引擎與標準化專案目錄 (canonical project directory)
分開存放。

## 建立子 combo

從你了解的設定開始：

```sh
pia derive pi/base pi/research \
  --description "Pi setup for source-backed research"
```

這會複製完整的父項目錄樹、寫入 `derivedFrom`，並記錄目前的父項摘要
(parent digest)。請將子 combo 視為獨立設定來編輯與審查。

當父項變更時：

```sh
pia lineage pi/research
pia diff pi/research --parent
# Copy or adapt only the changes you have reviewed.
pia lineage pi/research --ack
```

`--ack` 會更新已記錄的摘要；它不會合併檔案。請只在審查完成後執行。父項與子項
必須使用相同引擎，且系統會拒絕譜系循環。

## 謹慎選擇啟動引數

`launchArgs` 不得包含由包裝程式 (wrapper) 管理或可能承載機密的旗標，例如
`--profile`、`--alias`、`--session-dir`、`--cwd`、`--config`、工作階段續接/分支路由
(resume/fork routing) 或 `--api-key`。一次性引數應放在 `pia run ... --` 分隔符之後，
機密則應留在上游身分驗證機制或環境中。

!!! warning "目前的 `--no-session` 缺口"
    執行檔驗證器 (executable validator) 與 JSON Schema 目前允許在 `launchArgs` 中
    使用 `--no-session`，即使 `pia` 也會注入 `--session-dir`。`fork` 與 `handoff`
    的目標引數會拒絕 `--no-session`。請將它視為不受支援，且不要依賴由此產生的
    上游引數互動。[結構描述參考資料](../reference/combo-schema.md)記錄了這項已知
    缺口。

## 檢查、套用與執行

```sh
pia list --tree
pia lineage pi/research
pia status pi/research
pia diff pi/research --runtime
pia apply pi/research --dry-run
pia apply pi/research
pia run pi/research -- <native arguments>
```

一般的 `apply` 會拒絕受管理的執行階段漂移 (managed runtime drift) 與來源/執行階段
衝突 (source/runtime conflicts)。請審查執行階段差異、將有意保留的變更帶回
`agent/`，或只在需要讓來源再次覆蓋 `pia` 已管理的路徑時使用 `--force`。不受
`pia` 管理的衝突項目一律不會遭到覆寫。

## `production` 檢查清單 {#production-checklist}

將 `maturity` 變更為 `production` 之前：

- [ ] 已審查完整的 `agent/` 目錄樹，以及套件與擴充功能 (extension) 的來源。
- [ ] 未追蹤任何憑證或可變狀態。
- [ ] `pia apply <combo> --dry-run` 只包含預期動作。
- [ ] Pi 或 OMP 能在乾淨的執行階段中安裝或解析所參照的套件。
- [ ] 工作階段歷史記錄模式與共用群組都是刻意選定的。
- [ ] 父項譜系是最新的。
- [ ] `pia doctor` 與實際的冒煙啟動測試 (smoke launch) 都能在目標平台通過。
- [ ] 權限、沙箱 (sandbox) 與網路政策由代理框架 (harness) 或執行環境定義；`pia`
      不會提供這些政策。
