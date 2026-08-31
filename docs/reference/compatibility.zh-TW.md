# 相容性

本頁是一份附有日期、說明儲存庫 (repository) 目前測試範圍的陳述，而不是對每個
後續上游 (upstream) 版本的保證。

**由儲存庫設定驗證的快照 (snapshot)：2026-08-31**

## 執行階段與平台矩陣

| 領域 | 目前證據 |
|---|---|
| Node 執行階段 (runtime) | `package.json` 要求 22.19.0 或更新版本 |
| Linux | 應用程式檢查/測試會在 Ubuntu 上以 Node 22 與 24 執行 |
| Windows | 檢查與 Windows 測試會以 Node 22 與 24 執行 |
| macOS | 使用 POSIX 啟動器 (launcher)/路徑實作，但目前沒有 macOS 持續整合作業 (CI job) |
| Pi | Windows 啟動煙霧測試 (smoke launch) 會安裝 `@earendil-works/pi-coding-agent@0.84.4` |
| Oh My Pi | Windows 啟動煙霧測試會下載 OMP 18.0.11，並驗證固定的 SHA-256 |

Windows 作業會透過 `pia.ps1` 啟動 Pi，並透過 `pia.cmd` 啟動 OMP，接著將兩者的版本
輸出與直接叫用 (direct invocation) 的結果比較。單元測試 (unit tests) 會在主機平台上
涵蓋包裝器 (wrapper)、行程解析 (process resolution)、執行階段同步
(runtime synchronization)、combo、工作階段 (sessions)、handoff、補全 (completion)
與色彩行為。

## 此快照無法證明的事項

- 它不是針對真實上游對話歷程執行的跨平台端對端 (end-to-end) fork 或 handoff 測試。
- 工作階段測試資料 (fixtures) 是依已知格式合成，並非龐大的上游測試資料檔案封存。
- Linux CI 不會安裝兩個 代理工具框架執行檔 (harness binaries) 並進行啟動煙霧測試。
- GitHub Actions 不會驗證 macOS 行為。
- 較新的 Pi 或 OMP 版本不會自動被視為不相容，但在更新相容性陳述前，必須先以
  `pia doctor`、原始碼測試與實際啟動煙霧測試進行檢查。

工作階段指南中對實作敏感的主張使用固定的上游原始碼連結 (pinned upstream source
links)。任一快照版本變更時，請重新檢查這些連結與格式。

## Windows 啟動器邊界

對 `run` 而言，PowerShell 啟動器會重建被 PowerShell 消耗的 `--` 分隔符
(separator)，並保留字面目標引數與子行程結束狀態。目前 `fork` 或 `handoff` 尚未實作此分隔符重建；
這些形式必須增加 Windows 測試涵蓋範圍，之後才能套用相同保證。cmd 啟動器遵循
cmd.exe 引號規則，且預期用於受信任的互動式輸入。npm PowerShell shim 會透過固定的
`PowerShell -File` 命令啟動，而不啟用子行程的命令殼層剖析 (shell parsing)。

## 發布狀態

在此快照時間點：

- GitHub 儲存庫是私有的；
- `package.json` 設有 `"private": true`；
- 沒有已發布的儲存庫發行標籤 (release tags)；
- 不存在授權條款檔案。

因此，本文件描述的是獲授權之儲存庫使用者的操作方式。它不授予公開再散布權
(public redistribution rights)，也不承諾版本化的支援生命週期
(versioned support lifecycle)。

## 更新本頁

變更上游版本時：

1. 更新 `.github/workflows/ci.yml` 中固定的安裝/下載項目與摘要；
2. 執行完整的 Linux 與 Windows 測試套件；
3. 透過各平台啟動器對新的二進位檔執行啟動煙霧測試；
4. 將工作階段/profile/設定行為與剖析器及目標檢查進行比較；
5. 更新此處的日期、版本、原始碼永久連結 (source permalinks) 與任何已知限制。
