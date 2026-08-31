---
kind: paradigm
status: reviewed
as_of: 2026-08-31
last_verified: 2026-08-31
upstreams:
  - https://pi.dev/docs/latest/extensions
  - https://github.com/earendil-works/pi/tree/v0.84.4/packages/coding-agent/examples/extensions
  - https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/docs/subsystems/workflow.md
  - https://code.claude.com/docs/en/how-claude-code-works
  - https://code.claude.com/docs/en/workflows
  - https://geminicli.com/docs/tools/tracker/
confidence: medium-high
---

# 本站編者採用的工程分析視角

本站使用以下順序來思考逐步增加的協調編排 (orchestration)：

```text
prompt → context → harness / meta-harness → loop → graph
```

!!! important "編者視角，而非普遍適用的發展時序"
    這是本站採用的設計視角，不是上游分類法、成熟度排名，也不是宣稱業界按此順序演進。
    真實系統會合併階段、跳過階段，或退回先前階段以提高可預測性。圖 (graph) 本質上並不
    優於範圍明確的提示或單一代理迴圈 (agent loop)。

## 1. 提示工程 (prompt engineering)：明確指定轉換

提示 (prompt) 會說明一次模型互動的任務、限制、輸出契約 (output contract)，以及預期
證據。良好的**提示工程**會在增加機制之前先排除歧義：定義成品 (artifact)、禁止的變更、成功條件，
以及應如何報告不確定性。

當必要輸入已經放得下、不需要外部動作，而且結果可以直接檢查時，就適合使用提示工程。
分類、擷取與範圍有限的改寫通常屬於此類。

**失敗訊號。** 一再要求模型重新探索相同的專案事實，通常表示脈絡有問題，而不是需要
加入更多提示文字。

## 2. 脈絡工程 (context engineering)：控制模型可知的內容

**脈絡工程**會選擇並排列指示、程式碼、工具結果、對話紀錄與檢索到的資料，也會為這些內容
分配預算。脈絡並非越多越好：無關檔案會與任務證據競爭，大型工具結構描述 (tool schemas)
會消耗同一個有限的脈絡視窗 (context window)，而壓縮 (compaction) 可能遺失細節。

脈絡應具有來源依據 (provenance) 與目的。優先採用小而具權威性的片段，依需求取得額外
證據；若代理工具框架允許，則把易變動的執行狀態 (volatile run state) 放在穩定指示之後。

**觀察 (Observation)。** 代理工具框架會將脈絡呈現為明確的工程操作介面
(engineering surface)。Claude Code 文件所述的脈絡來自指示、紀錄、檔案、工具輸出、Skills
與 MCP，之後會清除或摘要較舊的資料
([脈絡與迴圈](https://code.claude.com/docs/en/how-claude-code-works))。這是特定產品的機制，
不是普遍適用的資料保留保證。

## 3. 代理工具框架工程 (harness engineering)：明確呈現能力與政策

**代理工具框架工程**把一次模型呼叫變成工作的作業系統：包含供應商路由、工具、指示探索、
工作階段狀態、使用者介面 (UI)、壓縮、權限與執行整合。擴充點 (extension points) 讓團隊
可以加入政策或領域工具。

Pi 刻意把數種工作流程留在核心之外，並將規劃模式 (plan mode)、權限閘門
(permission gates)、在沙箱內執行的 Bash (sandboxed Bash)、交接 (handoff) 與子代理工具
(subagents) 示範為 Extensions 或範例，而不是預設的產品保證
([Extensions](https://pi.dev/docs/latest/extensions)、
[範例](https://github.com/earendil-works/pi/tree/v0.84.4/packages/coding-agent/examples/extensions))。
這使**核心與組合 (core versus composition)** 成為架構的一部分。

後設代理工具框架 (meta-harness) 在外一層運作。`pia` 會選擇完整且已審查的組合
(combo)、將其具體建立至私有執行期狀態 (private runtime state)、設定工作階段根目錄
(session root)，
並啟動 Pi 或 OMP。它將設定生命週期標準化，但不宣稱會取代上游迴圈。請參閱
[架構](../../concepts/architecture.md)與[Combos](../../guides/combos.md)。

## 4. 迴圈工程 (loop engineering)：蒐集、行動、驗證、停止

代理迴圈會將模型要求的動作回饋為觀察：

```text
inspect → plan enough → act → observe → verify → continue or stop
```

**迴圈工程**定義的不只是重複動作，也會設定工具結構描述、核准點、重試規則、錯誤序列化、
取消、脈絡修剪、完成條件與預算。驗證步驟必須是實際動作，例如執行測試、型別檢查
(type check)、檢查差異內容 (diff) 或查閱來源，而不能只採信模型聲稱工作「看起來正確」。

對一項緊密耦合的變更而言，單一迴圈通常是最清楚的選擇。它會把決策與回饋保留在同一份
脈絡中，但冗長的工具輸出與重複探索可能排擠原始限制。

## 5. 圖工程 (graph engineering)：明確呈現拓撲

**圖工程**會明確呈現相依關係與扇出 (fan-out)。節點可能是確定性程式碼
(deterministic code)、模型呼叫、隔離的代理工具、審查或人工核准；邊則傳遞成品與控制資訊。
只有當各節點的工作真正獨立，或其寫入集合互相隔離時，平行節點才有用。

圖至少有三種實質不同的實作：

- **子代理工具委派 (subagent delegation)：** 父層代理工具要求子迴圈研究或實作範圍有限的
  工作，再彙整其輸出。
- **程式碼驅動的工作流程 (code-driven workflow)：** 一般程式碼控制 `parallel`、
  `pipeline`、重試、彙總與預算；代理工具是工作執行器 (workers)，不是排程器 (scheduler)。
- **可持久化任務圖 (durable task graph)：** 保存節點與相依關係，讓工作能夠恢復、重試、
  受檢查，並跨越程序／工作階段邊界。

不要把三者全都稱為「多代理工具 (multi-agent)」。具有子脈絡並不代表同儕訊息傳遞、持久
狀態、工作樹 (worktree) 隔離或託管雲端執行也存在。

**事實 (Fact)。** DeepSeek Harness `dsh-v0.1.2-alpha.2` 文件記載了由模型撰寫、在 API 受限
執行環境 (API-restricted runtime) 中使用 `agent`、`pipeline`、`parallel` 與 `phase` 的
JavaScript 工作流程。其
工作執行器實作明確警告，`node:vm` 的隔離可被突破 (escapable)，只能提供圍堵
(containment)，並不構成安全邊界
([workflow 參考資料](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/docs/subsystems/workflow.md)、
[工作執行器警告](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/packages/workflow/workflow-worker-thread/README.md))。
Claude Code 文件則描述另一種由指令碼掌控 (script-owned) 的 dynamic-workflow 操作介面，
其中間結果 (intermediate results) 會保留在指令碼變數 (script variables) 中
([dynamic workflows](https://code.claude.com/docs/en/workflows))。Gemini CLI 的實驗性
(experimental) tracker 會呈現工作階段範圍的相依關係 DAG (dependency DAG)
([tracker](https://geminicli.com/docs/tools/tracker/))。這些都是實用的範例，但不能證明它們
具有相容語意或同等成熟度。

## 選擇足以運作的最簡拓撲 (topology)

| 需求 | 起點 | 何時增加機制… |
|---|---|---|
| 一次範圍有限的轉換 | 提示 | 必須探索才能取得必要證據時 |
| 更扎實的依據 | 經篩選的脈絡 | 需要外部動作或反覆回饋時 |
| 可重複使用的工具／政策／狀態 | 代理工具框架或後設代理工具框架 | 工作必須經過多項動作進行調整時 |
| 一項自適應任務 | 單一迴圈 | 可以安全拆分脈絡或獨立工作時 |
| 獨立的扇出或相依關係 | 工作流程／圖 | 需要持久性、重試或跨工作階段控制時 |

**觀點 (Opinion)。** 增加複雜度應以實測的完成率、審查負擔、可復原性、延遲或成本作為
理由，而不是取決於圖中可見的代理工具數量。

## 工程上的影響

每個步驟都應記錄：

- 輸入與輸出契約；
- 脈絡與工具預算；
- 由誰控制順序——模型、代理工具框架、程式碼或圖的排程器；
- 每個可執行節點的權限範圍與隔離方式；
- 持久性與取消語意；以及
- 能拒絕錯誤結果的驗證者。

如需操作指引，請繼續閱讀[最佳實務](../best-practices.md)與
[工作階段與交接](../../guides/sessions-and-handoff.md)。依操作介面區分的範例請參閱
[程式開發代理工具全貌](../coding-agents/index.md)，Pi/OMP 的限制則請參閱
[Pi 代理工具框架生態系](../ecosystem/index.md)。

## 主要來源

- [Pi Extensions](https://pi.dev/docs/latest/extensions)
- [Pi Extension 範例](https://github.com/earendil-works/pi/tree/v0.84.4/packages/coding-agent/examples/extensions)
- [`dsh-v0.1.2-alpha.2` 的 DeepSeek Harness workflow](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/docs/subsystems/workflow.md)
- [Claude Code 的運作方式](https://code.claude.com/docs/en/how-claude-code-works)
- [Claude Code dynamic workflows](https://code.claude.com/docs/en/workflows)
- [Gemini CLI task tracker](https://geminicli.com/docs/tools/tracker/)
