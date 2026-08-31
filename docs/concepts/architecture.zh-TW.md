# 架構

`pia` 將受版本控制的**意圖 (intent)** 與可變的代理工具 (agent) **狀態 (state)** 分開。儲存庫是
combo 定義的單一事實來源 (source of truth)；絕不會作為代理工具實際使用中的家目錄
(live home directory)。

## 所有權模型 (ownership model)

```text
pi-agents checkout                         private user state
──────────────────                         ──────────────────
combos/<engine>/<name>/                    config/selection.json
  combo.json                               state/manifests/...
  agent/  ── validate + materialize ─────► state/runtime/pi/...
                                           OMP native profile roots
                                           state/sessions/...
                                           state/handoffs/...
```

Combo 包含一棵完整的設定樹。`pia` 掃描該樹時不會跟隨連結，並會將其與上一份資訊清單
(manifest) 及目前目標比較，且只寫入受管理的檔案路徑 (managed file paths)。建立受管理的
子項目時，即使父目錄本身未列於資訊清單中，也可能將既有父目錄的權限正規化為 `0700`。
Pi 與 OMP 會繼續擁有憑證 (credentials)、已下載套件、快取、blob，以及其他在執行期
建立的資料。

## 主要模組

| 模組 | 職責 |
|---|---|
| `src/cli.ts` | 引數剖析 (argument parsing)、分派、文字／JSON 輸出與結束狀態 |
| `src/combos.ts` | Combo 驗證、探索、衍生、譜系 (lineage) 與摘要 (digest) |
| `src/runtime.ts` | 安全掃描、資訊清單、漂移分類 (drift classification)、逐檔不可分割寫入 (per-file atomic writes) 與可復原的套用作業 |
| `src/harness.ts` | Pi／OMP 目標解析 (target resolution)、執行前套用 (apply-before-run)、環境與引數 |
| `src/sessions.ts` | 專案範圍根目錄 (project-scoped roots)、Pi／OMP 剖析、選取器 (selectors) 與 fork 相容性 (fork compatibility) |
| `src/handoff.ts` | 逐字稿擷取 (transcript extraction)、Git 來源追溯 (Git provenance)、遮罩 (redaction)、驗證與成品 (artifacts) |
| `src/paths.ts` | 來源／設定／狀態路徑，以及私有的不可分割 JSON 寫入 |
| `src/process.ts` | 子程序執行，以及不使用 `shell: true` 的安全 Windows shim 解析 |
| `src/completion.ts` | 產生原生自動補全 (native completion) |
| `src/ui.ts` | 無相依套件的語意式終端機色彩 (semantic terminal color) |

原始碼使用 Node 可抹除型別的 TypeScript (Node-erasable TypeScript)。Node 22.19+ 可直接
執行這些檔案；TypeScript 與 Node 型別僅是用於嚴格檢查的開發期相依套件。

## 執行前套用

一般啟動會依循同一條路徑：

1. 從明確引數、`PIA_COMBO` 或已儲存的選取項目解析 combo。
2. 驗證 `combo.json`、其譜系，以及 `agent/` 下的每個來源路徑。
3. 解析引擎專屬目標與專案範圍工作階段 (session) 目錄。
4. 比較來源、上一份資訊清單與實際目標 (live target)。
5. 拒絕會阻擋作業的漂移或碰撞；否則依序執行套用動作，逐檔進行不可分割取代，然後
   寫入資訊清單。
6. 啟動上游執行檔並轉送其結束代碼。

多檔案套用不具交易性 (transactional)：如果較後面的動作失敗，先前的逐檔變更可能會
保留，而新資訊清單尚未寫入。下次執行 `status`／`apply` 時會重新計算彼此關係，而不會
假設該批次已完成。

對 Pi 而言，`pia` 會將 `PI_CODING_AGENT_DIR` 設為
`<state>/runtime/pi/<combo>/agent`。對 OMP 而言，它會建立原生 profile 名稱
`pia-<combo>`，並透過 `omp --profile=<profile> config path` 查詢實際的
`<profile>/agent` 目錄。它不會猜測 OMP 家目錄，而是拒絕非預期的形狀，並檢查最終
profile 與 `agent/` 元件是否為符號連結 (symlinks)；更前面的祖先元件仍屬於受信任的
OMP／檔案系統設定。

在兩種情況下，`pia` 都會加入 `--session-dir <resolved-session-directory>`，其值是解析後的
專案範圍工作階段葉目錄 (resolved project-scoped session leaf)，而非專案根目錄。簽入儲存庫的
`launchArgs` 會排在 `--` 後方提供的一次性使用者引數之前。

## 狀態與資訊清單模型

每份資訊清單都會繫結到一個絕對目標，並針對每個受管理的相對路徑記錄：

- SHA-256 內容雜湊 (content hash)；
- 可執行意圖 (executable intent)；
- 預期的私有權限模式 (expected private mode)。

這讓 `pia` 能以三方視角 (three-way view) 檢視目前來源、上次套用的狀態與實際執行期
(live runtime)。它可以區分安全的來源更新、執行期漂移 (runtime drift)、真正的衝突、
新檔案，以及過時的受管理檔案。確切的分類與 `--force` 規則請參閱
[安全與資料邊界](security-and-data-boundaries.md)。

## 工作階段是另一個獨立維度

實際生效的工作階段根目錄取決於引擎、歷程政策 (history policy)，以及從正規化工作目錄
(canonical working directory) 衍生出的穩定金鑰。即使是 `history.mode: shared`，仍會依
引擎與專案劃分範圍。同引擎 fork 會委派給目標代理工具框架 (harness) 的原生格式；跨引擎移轉則會使用
全新且經遮罩的 Markdown handoff，而不是複製 JSONL。

請參閱[工作階段與 handoff](../guides/sessions-and-handoff.md)。

## 為何採用完整副本而非繼承

Pi 並未公開一套涵蓋設定、Skills、Extensions、提示詞、套件與工作階段的穩定繼承契約
(inheritance contract)。OMP 提供 profile 與更豐富的設定分層 (configuration layering)，
但這些分層無法為兩種引擎建立可攜的共通模型。

因此，`pia derive` 會複製完整 combo，並記錄 `derivedFrom`，以及受審查父項的內容導向摘要
(content-oriented digest)。內容或中繼資料變更會產生譜系警告及手動審查工作流程
(manual review workflow)；摘要計算會刻意將僅有可執行位元的變更
(executable-bit-only changes) 正規化為無差異。啟動時絕不會合併父項變更。如此一來，每個
子項都能獨立理解，並讓衝突政策保持明確。

宣告式繼承 (declarative inheritance) 與三方同步 (three-way synchronization) 仍是研究主題，記錄於儲存庫的
[設計待辦事項](https://github.com/daviddwlee84/pi-agents/blob/main/backlog/declarative-inheritance-three-way-sync.md)。
