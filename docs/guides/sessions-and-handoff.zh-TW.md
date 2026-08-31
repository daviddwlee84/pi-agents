# 工作階段與交接

設定可經過審查並實體化 (materialized)。不能假定即時對話樹
(live conversation trees) 可攜，因此 `pia` 將一般歷史記錄、同引擎分支
(same-engine fork) 與有損交接 (lossy handoff) 明確區分為不同操作。

## 專案範圍的歷史記錄

隔離的 combo 會將工作階段 (session) 儲存在以下位置：

```text
${PIA_STATE_HOME:-${XDG_STATE_HOME:-~/.local/state}/pi-agents}/
  sessions/<engine>/<combo-name>/<project-key>/
```

若為 `history.mode: shared`：

```text
sessions/<engine>/shared/<group>/<project-key>/
```

專案鍵 (project key) 是有長度上限的工作目錄基底名稱，加上標準化路徑
(canonical path) SHA-256 的 12 字元前綴。共用模式只會移除 combo 這一層：絕不會
跨越引擎或專案邊界。

列出某個 combo 可以看到的內容：

```sh
pia sessions pi/base
pia sessions pi/base --json
```

!!! warning "工作階段 JSON 含有敏感資料"
    `--json` 會傳回經剖析的工作階段記錄，其中包括 `entries` 與作用中分支
    (active branch)，而不只是向使用者顯示的 ID/title/path 摘要。無論重新導向或
    保留該輸出，都應將它視為對話資料。

## 選取工作階段

需要來源工作階段的命令必須恰好指定一個選擇器 (selector)：

- `--latest` 依修改時間選擇最新的檔案；
- `--session <id-prefix>` 在有效工作階段根目錄 (effective session root) 下解析唯一且
  無歧義的 ID 前綴；
- `--session <absolute-path>` 通過格式與一般檔案檢查後，直接剖析明確指定的檔案。

有歧義的前綴、格式錯誤的 JSONL 與遺失的檔案，都會在啟動前導致失敗。

!!! warning "絕對路徑不受根目錄範圍限制"
    目前的實作不會檢查絕對路徑選擇器是否位於 combo 的有效工作階段根目錄內。
    請只使用 `pia sessions <combo>` 傳回的絕對路徑，並將任何其他路徑視為明確的
    信任決策。ID 前綴與 `--latest` 仍會以有效工作階段目錄為根目錄進行選取。

## 同引擎分支

```sh
pia fork pi/base pi/research --latest -- <target arguments>
pia fork pi/base pi/research --session <id-or-path> -- <target arguments>
```

兩個 combo 都必須使用相同引擎。`pia` 會委派給目標代理框架 (harness) 原生的
`--fork` 並建立新的目標工作階段；它既不會附加至來源檔案，也不會逐位元組複製
(byte-copy) 該檔案。

Pi 與 OMP 不會只因兩種格式都使用第 3 版，就具備通訊格式相容性
(wire compatibility)。版本鎖定的 Pi [版本與標頭](https://github.com/earendil-works/pi/blob/853a80d26c90a14c1886f0ebb8ffaae133ca2185/packages/coding-agent/src/core/session-manager.ts#L30-L39)
及[項目聯集](https://github.com/earendil-works/pi/blob/853a80d26c90a14c1886f0ebb8ffaae133ca2185/packages/coding-agent/src/core/session-manager.ts#L138-L150)，
與 OMP 的[第 3 版標頭及實體 title 欄位](https://github.com/can1357/oh-my-pi/blob/51f03804476c3fd3c15748ae07e4849d1efc883b/docs/session.md#L59-L81)
及[較大的項目分類](https://github.com/can1357/oh-my-pi/blob/51f03804476c3fd3c15748ae07e4849d1efc883b/docs/session.md#L106-L124)不同，因此 `pia`
只允許在同一引擎內建立原生工作階段分支。

## 確定性交接

當目標使用不同引擎，或你想要可審查且縮減過的上下文邊界 (context boundary) 時，
請使用交接：

```sh
pia handoff pi/research omp/base --latest \
  --goal "Continue the provider comparison" -- <target arguments>
```

產生作業在本機執行且具確定性；不會由任何模型摘要來源內容。擷取器 (extractor)
會：

1. 沿著作用中分支走訪，而不是走訪每個已捨棄的分支 (abandoned branch)；
2. 優先採用最新的壓縮摘要 (compaction summary) 或重設邊界 (reset boundary)，否則
   保留第一個使用者目標，加上一個有長度上限的近期視窗；
3. 納入來源、目標與工作階段的溯源資訊 (provenance)，以及該工作階段專案的 Git
   分支、HEAD、狀態與差異統計 (diff-stat)；
4. 保留可見的使用者/助理文字 (user/assistant text) 與工具名稱；
5. 排除隱藏的思考內容、圖片、工具引數與成功的工具輸出；失敗的工具輸出上限為
   2 KiB；
6. 讓產物預設不超過 128 KiB，並回報省略或截斷的內容；
7. 執行儲存庫所追蹤的 Python 遮蔽工具 (redactor)，再以 `gitleaks` 驗證結果；
8. 寫入私有、內容定址的 Markdown 產物 (content-addressed Markdown artifact)，且
   除非另有要求，會以該附件啟動全新的目標工作階段。

變更上限，或只產生內容而不啟動：

```sh
pia handoff pi/research omp/base --session <id-or-path> \
  --goal "Prepare a reviewed transfer" --max-bytes 65536 --no-run
```

`--max-bytes` 必須是至少 4096 的整數。

## 交接前置條件

除了兩個 combo 之外，交接還需要下列所有項目：

- Git，以及來源工作階段所在的可讀取且非裸 (non-bare) Git 工作樹
  (working tree)，其中至少有一筆 commit 且 `HEAD` 可解析，以提供來源溯源資訊；
- `PATH` 上字面名稱為 `python3` 的 3.9 或更新版本執行檔；
- 儲存庫所追蹤的 `.agents/skills/agent-history-hygiene/assets/redact_secrets.py`；
- 儲存庫所追蹤的 `.gitleaks.toml` 政策；
- `PATH` 上 8.25.0 或更新版本的 `gitleaks`。

`pia doctor` 只會檢查 `python3` 與 `gitleaks` 命令是否存在，不會檢查這些必要版本。
找不到命令時只會標為警告，因為其他命令不需要它們也能運作。只要遮蔽、溯源資訊
處理、驗證、剖析、大小檢查或產物持久化任一環節失敗，交接本身就會採取失敗時預設
拒絕 (fail closed) 策略。

## 審查責任

經遮蔽處理的交接是**有損的歷史上下文 (lossy historical context)**，而不是目前
儲存庫狀態的可信陳述。目標提示 (target prompt) 會要求代理工具再次驗證工作樹
(working tree)。將檔案分享至本機以外之前，請親自檢查：一般文字可能包含敏感的
商業上下文，而任何以模式比對為基礎的機密掃描器 (secret scanner) 都無法辨識
這類內容。

請按以下方式使用：

- 在單一 combo 內繼續作業時，使用一般歷史記錄；
- 要保留原生的同引擎對話結構時，使用分支；
- 要進行範圍有限、可稽核且適用於同引擎或跨引擎的移轉時，使用交接。
