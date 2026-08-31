# Combo 結構描述

每個 combo 都是一個位於 `combos/<engine>/<name>/` 的目錄 (directory)，其中包含
`combo.json` 與一般的 `agent/` 目錄。此儲存庫 (repository) 支援結構描述版本
(schema version) `1`。

## ID 與名稱規則

`engine` 是 `pi` 或 `omp`。名稱須符合以下條件：

- 長度為 1–60 個字元；
- 以小寫 ASCII 字母或數字開頭；
- 後續字元只能是小寫字母、數字、`.`、`_` 或 `-`；
- 不得以句點結尾。

共用歷史記錄群組 (shared-history groups) 也適用相同的安全名稱規則。衍生 combo
(derived combo) 必須使用與其父 combo 相同的引擎 (engine)。

## 完整結構

```json
{
  "$schema": "../../../schema/combo.schema.json",
  "schemaVersion": 1,
  "description": "Research-oriented upstream Pi harness.",
  "maturity": "experimental",
  "launchArgs": ["--no-themes"],
  "history": {
    "mode": "shared",
    "group": "research"
  },
  "derivedFrom": "pi/base",
  "parentDigest": "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
}
```

不接受額外欄位。

| 欄位 | 必填 | 規則 |
|---|---:|---|
| `$schema` | 否 | 供編輯器探索 (editor discovery) 使用的字串；通常是指向 `schema/combo.schema.json` 的相對路徑 |
| `schemaVersion` | 是 | 必須恰好是 `1` |
| `description` | 是 | 非空字串 |
| `maturity` | 是 | `experimental`、`learning` 或 `production` |
| `launchArgs` | 否 | 字串陣列；在可執行驗證 (executable validation) 中預設為空 |
| `history` | 是 | 必須恰好符合下列其中一種結構 |
| `derivedFrom` | 成對 | 有效且使用相同引擎的 combo ID |
| `parentDigest` | 成對 | `sha256:` 加上 64 個小寫十六進位字元 |

譜系 (lineage) 的這對欄位必須一同出現。

## 歷史記錄變體

隔離歷史記錄：

```json
{ "history": { "mode": "isolated" } }
```

具名共用：

```json
{ "history": { "mode": "shared", "group": "daily-coding" } }
```

兩種物件內皆不接受其他鍵。共用歷史記錄的範圍仍限於單一引擎與正規化專案目錄。

## 成熟度屬於文件資訊，而非強制規則

`experimental`、`learning` 與 `production` 會在 `pia list` 中表達用途意圖。
它們不會改變權限、驗證、套用政策或啟動行為。將 combo 提升前，請先使用
[production 檢查清單](../guides/combos.md#production-checklist)。

## `launchArgs` 邊界

驗證器會拒絕字面值 `--`、`-r`、`-c`，以及下列長旗標 (long flags)（包含不帶值及
`--flag=value` 兩種形式）：

```text
--profile  --alias  --session-dir  --cwd  --config
--fork     --resume --session      --continue  --api-key
```

這可防止中繼資料 (metadata) 接管執行階段 (runtime)、profile 或工作階段 (session)
的路由 (routing)，或嵌入承載秘密的常見選項 (common secret-bearing option)。它不是
通用的秘密掃描器 (secret scanner)，而且原生旗標後方的一般字串仍可能是敏感資料。請勿將
秘密存入 Git。

!!! warning "已知的 `--no-session` 不一致"
    結構描述版本 1 與 `src/combos.ts` 目前都**不會**拒絕 `--no-session`，但 `pia`
    仍會附加 `--session-dir`，而 fork/handoff 的目標驗證會拒絕該旗標。請勿在
    `launchArgs` 中使用它。本文件記錄的是目前行為，並未重新定義該行為。

## 結構描述與執行階段驗證

`schema/combo.schema.json` 提供 JSON Schema 的編輯器輔助。可執行實作的權威來源是
`validateComboMetadata()`，以及 `src/combos.ts` 中的譜系載入邏輯。

`npm run check` 會剖析結構描述檔，以確認它是有效的 JSON，但目前不會對 combo
檔案執行 JSON Schema 驗證器。它會透過可執行驗證器載入每個 combo、以執行階段
安全規則掃描每個 `agent/` 樹、驗證父項摘要、檢查啟動器，並在 `gitleaks` 可用時
用它掃描 combo 內容。

結構描述不會描述檔案系統安全性。中繼資料有效的 combo 仍可能因 `agent/` 含有
符號連結 (symlink)、禁止的執行階段路徑、特殊檔案或不安全的可攜式路徑而失敗。
請參閱[安全性與資料邊界](../concepts/security-and-data-boundaries.md)。

## 譜系摘要

`pia derive` 會建立完整副本，並記錄父 combo 中繼資料與受管理**內容**樹的確定性
SHA-256 摘要 (digest)。計算樹內容部分時，會透過正規化排除可執行意圖
(executable intent)，因此父項若只有可執行位元 (executable bit) 發生變更，不會使
譜系過期。
`pia lineage --ack` 只會在人工審查後更新摘要；它不會變更子 combo 的檔案。
