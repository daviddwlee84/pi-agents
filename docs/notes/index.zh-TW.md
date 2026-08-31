---
kind: research-methodology
status: reviewed
as_of: 2026-08-31
last_verified: 2026-08-31
upstreams:
  - https://github.com/daviddwlee84/pi-agents
  - https://github.com/earendil-works/pi/releases/tag/v0.84.4
  - https://pi.dev/docs/latest
  - https://code.claude.com/docs/en/how-claude-code-works
  - https://developers.openai.com/blog/codex-as-a-platform
confidence: high
---

# 研究筆記與方法

這些筆記將代理式程式開發工具 (agentic coding tools) 視為分層系統，而非單一產品類別來探討。
目的是為 `pia` 及其組合 (combos) 提供設計選擇依據，而不是替供應商排名，或把文件數量
轉換成分數。

!!! note "方法限制"
    這是第一方文件與鎖定版本之第一方原始碼的比較，不是獨立的安全稽核、行為認證或
    基準評測 (benchmark)。除非另有明確說明的測試加以驗證，否則供應商對隔離、隱私、
    可靠性與產品支援的主張仍只是供應商主張。本節沒有任何頁面判定誰是基準評測贏家。

## 證據順序

針對所提出的主張，應採用可取得的最有力證據：

1. **以 `pi-agents` 的程式碼與測試判定 `pia` 行為。** 本機實作與測試決定此儲存庫
   實際執行的內容；上游文字說明無法推翻它們。請先閱讀[架構](../concepts/architecture.md)
   與[安全性與資料邊界](../concepts/security-and-data-boundaries.md)。
2. **不可變的發行版本 (release) 或提交 (commit) 證據。** 對已發布的行為，優先採用
   發行標籤 (release tag)、提交永久連結、版本化結構描述 (versioned schema) 或公告
   (advisory)。例如，Pi `v0.84.4` 是不可變的發行版本快照，而儲存庫的 `main` 則不是
   ([release](https://github.com/earendil-works/pi/releases/tag/v0.84.4))。
3. **目前的第一方文件。** 用它來確認受支援的工作流程 (workflows) 與產品定位，記錄存取
   日期，並將可變動的「latest」頁面視為目前的觀察，而非可重現的發行版本證據
   ([Pi 文件](https://pi.dev/docs/latest))。
4. **維護者討論。** 議題 (issue)、Pull Request (PR) 與討論 (discussion) 可用來
   說明意圖或尚未解決的行為。已關閉的議題、提案或留言，不會自動等同於已發布的承諾。
5. **已標示的次要來源。** 僅在能補充必要背景時使用，並將其標示為次要來源。它們無法
   證明上游預設值、發行狀態、安全保證或授權條款。

法律與資料處理相關主張必須以適用的條款或政策為依據，而非技術教學。行銷頁面可以佐證
產品定位，但不能證明精確的預設值。原始碼可以佐證範圍明確且有標示的實作觀察，但不能
證明不附帶條件的支援承諾。

## 比較單位

每項實質主張都應指出四個座標：

- **明確指涉的產品 (canonical product)**；
- **操作介面 (surface)**，例如 CLI、編輯器、桌面應用程式、雲端服務或 SDK；
- 迴圈與工具的**執行位置**；以及
- 所觀察的**發行標籤、提交或文件快照**。

共用模型、源流、協定支援或共用代理工具框架 (harness)，並不會讓不同操作介面自動具有
相同功能、授權、支援或安全屬性。例如，Anthropic 將 Claude Code 描述為環繞 Claude、
具備工具、脈絡管理 (context management) 與執行環境的代理工具框架；這項說明並不表示
所有 Claude 產品或部署路徑都相同
([Claude Code 架構](https://code.claude.com/docs/en/how-claude-code-works))。
OpenAI 同樣區分模型推理、其開放式代理工具框架、用戶端與託管服務
([Codex 平台介紹](https://developers.openai.com/blog/codex-as-a-platform))。

發布時請使用下列詞彙：

| 標籤 | 意義 |
|---|---|
| **事實 (Fact)** | 在所述快照中，引用來源直接支持的內容 |
| **觀察 (Observation)** | 文件、原始碼或測試在該快照中呈現的內容 |
| **推論 (Inference)** | 從引用事實推導出的合理結論；不是上游主張 |
| **觀點 (Opinion)** | 建議或價值判斷 |
| **待解問題 (Open question)** | 證據缺失、模糊或互相矛盾 |

功能狀態也需要使用限定詞，例如**核心 (core)**、**選用內建功能 (optional built-in)**、
**第一方範例 (first-party example)**、**擴充功能 (extension)**、**預覽／實驗性
(preview/experimental)**、**未發布原始碼 (unreleased source)** 或**文件未記載
(not documented)**。沒有證據絕不代表「沒有」。

## 處理時間與衝突

發行標籤所記載的事實與可變動的 `main`/`dev` 觀察應分別寫在不同句子中。「最新非預發行
版本 (latest non-prerelease)」不代表正式發布 (GA)、長期支援 (LTS) 或某種支援期間。當第一方來源互相衝突時，應
呈現衝突及其適用範圍，而非默默選擇方便的答案。依賴易變動的模型目錄、方案、預設值、
預覽標籤與政策頁面前，應先重新查證。

**觀察 (Observation)。** 第一方文件有助於整理受支援的概念，但各產品與操作介面的文件
完整程度並不一致。受控的本機測試可以回答範圍明確的行為問題；它仍無法證明普遍適用的
安全性或品質結論。

## 閱讀地圖

- [模型、供應商、代理工具框架與代理工具](paradigms/model-harness-agent.md)定義這些筆記
  通篇使用的分層。
- [本站採用的工程分析視角](paradigms/engineering-evolution.md)說明提示 → 脈絡 →
  代理工具框架／後設代理工具框架 → 迴圈 → 圖的演進。
- [最佳實務](best-practices.md)將上述區分轉化為比較、協調編排、驗證與信任檢查清單。
- [程式開發代理工具全貌](coding-agents/index.md)是依操作介面劃分的產品索引；
  [Pi 代理工具框架生態系](ecosystem/index.md)則涵蓋 `pia` 背後較聚焦的 Pi/OMP 背景。
- 操作路徑記載於[快速開始](../getting-started.md)、[Combos](../guides/combos.md)與
  [工作階段與交接](../guides/sessions-and-handoff.md)。

## 主要來源

- [`pi-agents` 儲存庫](https://github.com/daviddwlee84/pi-agents)
- [Pi `v0.84.4` release](https://github.com/earendil-works/pi/releases/tag/v0.84.4)
- [Pi 文件](https://pi.dev/docs/latest)
- [Claude Code 的運作方式](https://code.claude.com/docs/en/how-claude-code-works)
- [Codex 平台介紹](https://developers.openai.com/blog/codex-as-a-platform)
