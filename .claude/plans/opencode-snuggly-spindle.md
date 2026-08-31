# Context

本次調研要判斷：Pi 的 extension／SDK／RPC 與既有 IM gateway 專案，是否適合直接納入 `pi-agents`，或目前只應留下可驗證的文件決策。以 **Pi 0.84.4** 與 **2026-08-31** 的來源快照為準，結論是 **docs-first**：`pia` 維持小型、無 runtime dependency、前景執行且同時支援 Pi／OMP 的 combo launcher；不在核心加入 gateway、daemon、transport schema 或 service lifecycle。

採用使用者選定的 **session-router context contract**：

- Pi session 是模型可見對話、tool history、branch 與 compaction 的唯一真相來源。
- IM provider 負責原生 message／reply／edit／delete／membership 事實；不把整個 room history 每輪重播進 prompt。
- Gateway 若日後實作，另以 durable state 負責 identity/admission、conversation↔project/combo↔Pi-session binding、per-session FIFO／single-writer lease、inbound dedup、approval 與 outbound receipt。
- Reply-to-bot 可作 routing hint；額外 quote/context 必須顯式、bounded、帶 attribution。沒有 thread 且 session 不唯一時拒絕猜測，要求明確 `/new`、`/resume` 或 `/bind`。

這不排除日後加入 Pi-only `maturity: experimental` combo；但外部候選尚未在 `pia` 隔離環境實跑 Pi 0.84.4，因此本階段不提交 package pin、extension 或 combo。

# Recommended changes

## 1. 建立 `backlog/pi-im-gateway.md`

沿用 `backlog/opencode-harness-to-pi.md` 等既有格式，加入 `Status: P?`、`Effort: L` 與 related links，並集中保存會隨時間變動的調研證據：

1. **Context / decision snapshot**
   - 標記版本與日期（Pi 0.84.4、2026-08-31）。
   - 說明 `pia run pi/base -- --mode rpc` 雖可透過既有 passthrough 啟動 RPC，但 `src/harness.ts::runCombo`／`src/process.ts::runInherited` 只有 inherited stdio 與 exit code，並不是 authenticated gateway API 或 session supervisor。
   - 記錄立即決策：docs-first、核心不變；下一個 executable step 是 time-boxed、repo 外的相容性 spike。

2. **Selected session-router contract**
   - 寫明上述四個 authority 與「accepted IM invocation 只投影至一個 Pi session」的不變量。
   - 記錄 threadless routing 順序、per-Pi-session FIFO／single writer、顯式 session control，以及不隱式匯入 ambient history。
   - 說明 edit/delete 不回寫既有 Pi history，也不能撤銷已發生的 filesystem/network side effects。

3. **Pi integration surfaces**
   - Extensions：適合 policy hooks、tool interception、foreground single-session bridge；生命週期綁定 session，且與宿主同權限。
   - SDK：未來 TypeScript companion service 的首選穩定 embed surface。
   - JSONL RPC：可作 process-isolated worker boundary，但不含網路、認證、global scheduler 或多 writer safety。
   - Experimental CBOR client/protocol/server：明示無相容保證、無 bundled network transport／turnkey coding-agent service，暫不採為 production contract。
   - 引用 Pi v0.84.4 的 extension、SDK、RPC、security 與 protocol 文件。

4. **Kimaki-derived operational baseline**
   - 將 `.specstory/references/Discord-OpenCode-Remote.md` 只作本次研究輸入，不讓 committed docs 依賴該未追蹤檔。
   - 列出 production gateway 必須自行擁有的 admission、mapping、queue、restart reconciliation、dedup/outbox、approval、attachment、credential isolation、health、supervision、deploy/rollback；明確說這些不是 `pia` 現有能力或承諾。

5. **Dated candidate snapshot**
   - 第一個 repo 外 spike：immutable `@zylab/pirelay@0.10.0`；它最接近 multi-session/thread/session-router 與 remote approval，但 Pi 0.84.4 未實跑、仍有 host privilege、volatile queue／dedup 與 state atomicity 缺口。
   - 若 per-conversation VM isolation 是硬需求，再測 Pi README 所連結、同組織的 `earendil-works/pi-chat` 固定 commit `9adbd29b40ee27ff1decf0fc87cbe180b40924f5`；不得稱為正式支援。記錄其 channel-level Discord mapping、memory-only pending jobs、open egress、QEMU 成本、缺 release/test/service supervision、0.84.4 未驗證，以及 LICENSE/package Apache-2.0 與 README MIT 的衝突。
   - `pi-messenger-bridge` 僅作 single-active-session transport 參考；其 mutable pending destination 不符合多 context routing。
   - TelePi 僅列 Telegram-first 候選，且應測 current source 而非過期 release。
   - Piscord 記為目前與 Pi 0.84.4 不相容，且缺 user/role/guild admission 與 threads。
   - 所有安全／相容敘述標記為 source-reviewed 或 execution-verified；moving ranking、stars、issue counts 只可留在此 dated backlog，不放長期 user docs。

6. **Non-goals and staged promotion gates**
   - 本階段不做 `pia gateway`／`serve`、broker、daemon、raw RPC network exposure、IM-native history mirror、Pi/OMP parity、exactly-once 或 sandbox 承諾；credential／DB／queue 不得進 combo Git tree。
   - 分開定義 gates，避免拿 production 門檻阻擋合理實驗：
     1. docs decision；
     2. out-of-tree spike（artifact/license、Pi 0.84.4、state path、authorized/unauthorized routing、approval、restart）；
     3. experimental combo（immutable licensed pin、正確 declared concurrency/destination、secret/state 外置、無 unattended confirmation、明示 best-effort/no-sandbox/no-supervision/no-OMP）；
     4. supported optional adapter（持續 compatibility CI、owner、authorization/routing regression、provider/restart contract）；
     5. production resident service（durable ingress/outbox、generation fencing、recovery drills、health/supervision、backup、atomic deploy/rollback）。
   - 提供 verification matrix 欄位，所有 runtime 欄先標 `unverified`，只能由 repeatable execution 更新。

## 2. 更新 `TODO.md`

在 `## P?` 加入一項 `[?/L] Evaluate an external Pi IM gateway`，連至 `backlog/pi-im-gateway.md`，描述先按 session-router／experimental-combo gates 做 time-boxed Pi 0.84.4 spike，再決定是否加入 Pi-only combo。維持未排優先序，不升為 P1/P2。

## 3. 更新 `docs/ecosystem.md`

在既有 `MCP is an extension choice` 段落後新增短小、穩定的 **Remote messaging is an external integration**：

- Remote messaging 是可由 Pi package/extension 提供的 optional integration，日後可由 Pi-only combo 固定版本。
- `pia` 本身不提供 transport、authentication/admission、session orchestration、sandbox、durable delivery 或 service supervision。
- 沿用既有 MCP adapter 原則：必須指名、pin、測試具體 integration，不把第三方能力描述成 Pi core。
- 可連到 Pi README 所連結的同組織 `earendil-works/pi-chat`，但不暗示官方 support 或 Pi 0.84.4 compatibility。
- 連至 `../backlog/pi-im-gateway.md` 查看 dated evidence、session-router contract 與 promotion gates；不要在這裡複製易腐化的候選排名／issue 數。

# Explicitly unchanged

不修改 `README.md`、`package.json`／lockfile、`schema/combo.schema.json`、`src/`、tests 或 `combos/`。保留並不編輯、不移動、不 stage 既有未追蹤檔：

- `.specstory/references/Discord-OpenCode-Remote.md`
- `.specstory/history/2026-08-30_16-46-37Z-opencode-gateway-bridge-e.md`

# Verification

1. 執行 project-knowledge TODO/backlog validator（使用 `project-knowledge-harness` 提供的 validate-only workflow），確認 P? metadata 與 links 符合現有慣例。
2. 執行 `npm run check` 與 `npm test`，確認 docs 變更未伴隨意外 repo regression。
3. 執行 `git diff --check`，並人工檢視 Markdown heading、table 與 relative links。
4. 逐一驗證 backlog 中 pinned/release source URL；無法 live 驗證者必須在文件標示 unverified，而不是省略限制。
5. 檢查最終 diff 只包含：
   - `backlog/pi-im-gateway.md`
   - `TODO.md`
   - `docs/ecosystem.md`
6. 確認兩個既有 `.specstory` 未追蹤檔內容與狀態均未改變；本階段不啟動 bot、不寫入 credential，也不執行外部候選 spike。
