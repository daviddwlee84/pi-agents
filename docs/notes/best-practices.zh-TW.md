---
kind: best-practices
status: reviewed
as_of: 2026-08-31
last_verified: 2026-08-31
upstreams:
  - https://pi.dev/docs/latest/security
  - https://pi.dev/docs/latest/compaction
  - https://pi.dev/docs/latest/extensions
  - https://code.claude.com/docs/en/permissions
  - https://code.claude.com/docs/en/sandboxing
  - https://code.claude.com/docs/en/context-window
  - https://learn.chatgpt.com/docs/agent-approvals-security
  - https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/packages/mcp/mcp-client/README.md
confidence: high
---

# 代理式 (agentic) 程式開發工作的最佳實務

以下實務會套用分層模型，但不假設不同產品中名稱相似的功能具有相同行為。請先將其視為
編輯作業標準 (editorial operating standard)，再根據受測的確切操作介面 (surface)、發行
版本 (release)、供應商與環境加以調整。

## 執行受控比較

有用的比較一次只改變一項有意義的變數。請記錄：

- 儲存庫修訂版本 (revision) 與乾淨／有異動狀態 (clean/dirty state)；
- 確切任務、測試資料 (fixtures)、驗收測試 (acceptance tests) 與停止條件；
- 模型識別碼 (model ID)、供應商路徑 (provider path)、帳戶／方案 (account/plan) 與模型選項
  (model options)；
- 產品操作介面、發行版本／標籤／提交 (release/tag/commit) 與執行位置；
- 指示、脈絡檔案、啟用的工具／擴充功能 (extensions)／MCP 伺服器與政策；
- 沙箱 (sandbox)、網路、存取憑證 (credentials)、工作樹 (worktree) 與熱／冷工作階段狀態
  (warm/cold session state)；以及
- 重複試驗次數、失敗、人工介入、經過時間與用量。

應依照任務專屬檢查來評分成品 (artifact)，而不是依照功能數量或模型自評。保留解釋失敗
所需的記錄 (logs) 與差異內容 (diffs)，同時遮蔽機密資訊 (secrets)。不能把某個 CLI／版本
的結果逕自外推至該供應商的 IDE、雲端服務、SDK 或下一個發行版本。

!!! note "比較限制"
    第一方文件比較不是獨立稽核或基準評測 (benchmark)。這些筆記不會判定基準評測贏家。
    若要發布受控評估，應揭露其任務集、環境、政策、重複次數、排除項目與評估者。

## 為脈絡與工具編列預算

脈絡 (context) 是共用且有限的工作集。執行前請：

1. 把穩定的任務限制與具權威性的檔案放在前面。
2. 只載入下一個決策所需的程式碼與文件。
3. 優先搜尋並精準讀取，而不是匯入整個目錄樹。
4. 限制工具輸出；回傳路徑、錯誤與具有決定性的摘錄，而不是未篩選的記錄。
5. 維持精簡的啟用工具集。工具描述與 MCP 結構描述 (schemas) 也會消耗脈絡，並擴大可執行
   動作的範圍。
6. 預留足夠空間給實作、工具結果與最終檢查。
7. 將摘要與壓縮 (compaction) 視為有損處理；進行影響重大的編輯前，重新開啟確切限制與
   檔案。

**事實 (Fact)。** Pi 明確指出壓縮為有損處理，且會摘要較舊的脈絡
([Pi 壓縮](https://pi.dev/docs/latest/compaction))。Claude Code 也記載了自動清除／摘要
較舊資料的行為
([脈絡視窗](https://code.claude.com/docs/en/context-window))。確切門檻與重新注入行為
(reinjection behavior) 取決於個別產品。

也應設定執行預算：回合上限 (maximum turns)、經過時間 (wall time)、工具叫用次數
(tool calls)、子代理工具 (child agents)，以及可觀測時的成本或詞元數 (tokens)。預算必須
有妥善的停止規則，回傳部分證據與未解問題，而不是為求完成而匆忙做出未經驗證的變更。

## 選擇最精簡的執行拓撲 (execution topology)

| 拓撲 | 適用情況 | 主要成本／控制問題 |
|---|---|---|
| **單一代理工具 (single agent)** | 工作緊密耦合；一份脈絡即可檢查、編輯並驗證 | 脈絡增長與循序延遲 |
| **子代理工具委派 (subagent delegation)** | 研究工作或寫入集合彼此獨立，且輸出可供摘要 | 成本倍增、父層脈絡遺失、合併衝突 (merge conflicts) |
| **程式碼驅動的工作流程 (code-driven workflow)** | 扇出具有規律，且順序、重試或彙總應由確定性程式碼 (deterministic code) 控制 | 必須自行負責結構描述、失敗處理 (failure handling) 與執行環境 (runtime) |
| **任務圖 (task graph)** | 相依關係、可恢復性、可稽核性或跨工作階段工作屬於核心需求 | 狀態、排程、取消與復原的複雜度 |

預設採用單一代理工具。只委派範圍有限、具明確回傳契約的問題。對平行寫入者，應為每個
寫入者分配互相隔離的檔案集合或工作樹；工作樹可以避免檢出內容彼此衝突，但不是程序、
存取憑證或網路沙箱。由一位負責人整合並執行完整的驗證套件。

當程式碼能以更低成本、更高可靠性控制扇出時，請使用程式碼驅動的工作流程。當節點需要
相依關係追蹤、重試、恢復或人工閘門時，請使用可持久化的圖。「更多代理工具」本身並不是
成果。

## 驗證動作與成品

驗證應納入工作計畫，而不是放在信心陳述之後。對程式碼或設定變更，請：

- 檢查差異內容與非預期檔案；
- 先執行範圍小的測試，再執行相關且更廣泛的測試套件；
- 執行適用的格式化工具 (formatter)、程式碼檢查工具 (linter)、型別檢查器 (type checker)、
  結構描述驗證 (schema validation)，以及文件連結／建置檢查；
- 在相關情況下測試失敗路徑 (failure paths)、遭拒的權限 (denied permissions)、取消
  (cancellation) 與重新啟動／恢復 (restart/resume)；
- 比較產生／執行期狀態 (generated/runtime state) 與已審查的來源；以及
- 報告命令 (commands)、結果 (results)、略過的檢查 (skipped checks) 與剩餘的不確定性
  (remaining uncertainty)。

研究主張應查證確切的操作介面與不可變快照。分別陳述發行標籤的事實，以及對 `main`、
`dev`、每夜建置版 (nightly) 或即時文件的觀察。第一方來源互相衝突時，應發布「互相衝突」或「無法
判定」；不要把它們平均成確定結論。

`pia` 使用者在強制套用前，應檢查狀態與執行期漂移 (runtime drift)。請參閱
[Combos](../guides/combos.md)、[疑難排解](../guides/troubleshooting.md)與
[工作階段與交接](../guides/sessions-and-handoff.md)。

## 分別看待信任、權限與隔離限制

這些控制項回答不同問題：

| 控制項 | 問題 |
|---|---|
| 專案／資料夾信任 (project/folder trust) | 可以載入儲存庫指示、設定或可執行的擴充功能嗎？ |
| 權限／核准 (permission/approval) | 可以繼續執行這項要求的動作嗎？ |
| 沙箱 (sandbox) | 指定的程序／工具在技術上可以存取什麼？ |
| 工作樹 (worktree) | 檔案系統編輯會寫入哪份檢出內容？ |
| 容器／虛擬機器 (container/VM) | 適用哪一層外部作業系統、存取憑證、程序與網路邊界？ |

絕不要將它們籠統稱為「安全模式 (safe mode)」。核准詢問 (approval prompt) 不是程序隔離
(process isolation)；唯讀規劃仍可能讀取機密資訊或連線至供應商；命令殼層沙箱 (shell sandbox) 也可能未涵蓋
內建檔案工具、MCP 伺服器、擴充功能、瀏覽器、通訊端 (sockets) 或存取憑證。

**事實 (Fact)。** Pi 的專案信任會控管專案資源，但 Pi 仍以呼叫帳號的權限執行，並建議
對不受信任的工作採用由作業系統支援的邊界 (OS-backed boundary)
([Pi 安全性](https://pi.dev/docs/latest/security))。Claude Code 表示權限由代理工具框架
強制執行
([權限](https://code.claude.com/docs/en/permissions))，並將其 Bash 沙箱的範圍與其他工具
分開說明
([沙箱](https://code.claude.com/docs/en/sandboxing))。Codex 同樣將沙箱政策 (sandbox policy)
與核准政策 (approval policy) 記載為兩種獨立控制
([核准與安全性](https://learn.chatgpt.com/docs/agent-approvals-security))。

從最小權限 (least privilege) 開始：使用可拋棄的工作區、最少掛載、不提供環境中既有的
正式環境存取憑證 (ambient production credentials)、限制對外連線 (egress)，並對寫入／
執行進行明確核准。核准機制無法使用時，應採失敗時預設拒絕 (fail closed) 策略。針對具名任務提高權限，
完成後再移除。`pia` 負責同步與啟動設定；它不是執行沙箱。請參閱
[安全性與資料邊界](../concepts/security-and-data-boundaries.md)。

## 將擴充功能與 MCP 當成供應鏈 (supply chain) 審查

擴充功能、外掛程式 (plugins)、掛鉤 (hooks)、具有可執行輔助程式 (helpers) 的 Skills、
自訂工具與 MCP 伺服器，能跨越和一般相依套件相同、甚至更廣的信任邊界。啟用前請：

1. 確認主要擁有者 (canonical owner)、授權條款 (license)、來源、發行版本／提交
   (release/commit) 與維護管道 (maintenance channel)；不要從市集項目 (marketplace listing)
   推論其可信度。
2. 檢查套件資訊清單 (package manifests)、遞移相依套件 (transitive dependencies)、安裝
   指令碼 (install scripts)、下載的二進位檔 (downloaded binaries)、更新行為
   (update behavior)，以及完整性／鎖定檔支援 (integrity/lockfile support)。
3. 鎖定已審查的版本或提交，並記錄回復 (rollback) 方式。
4. 列出可執行進入點 (executable entry points)、工具名稱、掛鉤、提示／資源
   (prompts/resources)、環境變數 (environment variables)、檔案系統存取、網路目的地與
   存取憑證流向。
5. 檢查預設啟用狀態 (default enablement)、核准規則 (approval rules)、命名空間衝突
   (namespace collisions)，以及自訂工具是否能遮蔽內建工具 (built-in)。
6. 使用合成存取憑證 (synthetic credentials)，在可拋棄的設定檔／容器
   (disposable profile/container) 中安裝並測試。
7. 更新前重新審查差異內容，並移除過時的授權／設定 (grants/configuration)。

MCP 是協定邊界 (protocol boundary)，不是沙箱，也不代表背書。本機標準輸入輸出 (stdio)
伺服器是你選擇執行的程序；遠端伺服器則會增加身分驗證 (authentication)、網路與資料揭露
邊界 (data-disclosure boundaries)。工具允許清單 (allowlists) 可以減少曝險，但不能證明
伺服器的實作安全。例如，DeepSeek Harness
文件指出，其 stdio MCP 命令是在代理工具沙箱之外執行且受到信任的可執行程式碼
(executable code)
([`dsh-v0.1.2-alpha.2` 的 MCP 用戶端](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/packages/mcp/mcp-client/README.md)、
[CLI 信任警告](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/apps/cli/reference/README.md))。
Pi Extensions 以完整系統存取權執行。它們可以修改傳出的供應商標頭／承載資料
(headers/payloads)，也能觀察回應狀態／正規化標頭 (response status/normalized headers)，
但回應掛鉤 (response hook) 不會暴露或改寫串流回應內容 (streamed response body)；它們也能攔截
工具與脈絡
([Pi Extensions](https://pi.dev/docs/latest/extensions))。

**推論 (Inference)。** 審查強度應取決於實際權限，而不是品牌：具有命令殼層、網路與
存取憑證權限的小型轉接器 (adapter)，應比僅含提示的大型套件受到更嚴格的審查。

## 無人值守執行前

- 鎖定實際測試過的組合 (combo) 與上游版本。
- 從可供審查的差異內容與可復原的 Git 狀態開始。
- 定義允許的路徑 (allowed paths)、網路、存取憑證、工具，以及支出／時間上限
  (maximum spend/time)。
- 隔離互相獨立的寫入者；重疊的編輯應依序執行。
- 定義成功、失敗、取消與部分結果的處理方式
  (success, failure, cancellation, and partial-result handling)。
- 合併／部署 (merge/deploy) 前必須執行測試或其他外部驗證。
- 保存稽核軌跡 (audit trail)，但不要保存機密資訊。
- 確認如何停止迴圈並撤銷存取憑證。

**待解問題 (Open question)。** 若產品文件未說明子代理工具繼承關係
(child-agent inheritance)、無介面核准行為 (headless approval behavior)、擴充功能權限
(extension authority) 或雲端資料流 (cloud data flow)，應將其視為尚未解決的部署條件，
而不是寬鬆的預設值。

如需特定產品操作介面的筆記，請參閱
[程式開發代理工具全貌](coding-agents/index.md)。較聚焦的 Pi/OMP 設計背景請參閱
[生態系索引](ecosystem/index.md)；若要了解 `pia` 的擁有權與狀態，請回到
[架構](../concepts/architecture.md)。

## 主要來源

- [Pi 安全性](https://pi.dev/docs/latest/security)
- [Pi 壓縮](https://pi.dev/docs/latest/compaction)
- [Pi Extensions](https://pi.dev/docs/latest/extensions)
- [Claude Code 權限](https://code.claude.com/docs/en/permissions)
- [Claude Code 沙箱](https://code.claude.com/docs/en/sandboxing)
- [Claude Code 脈絡視窗](https://code.claude.com/docs/en/context-window)
- [Codex 核准與安全性](https://learn.chatgpt.com/docs/agent-approvals-security)
- [`dsh-v0.1.2-alpha.2` 的 DeepSeek Harness MCP 用戶端](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/packages/mcp/mcp-client/README.md)
