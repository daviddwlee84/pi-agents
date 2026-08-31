# Context

目前 repository 只有五篇 English Markdown 文件，沒有 MkDocs、雙語導覽、文件建置或 GitHub Pages。使用者希望把它改造成 English 為預設、Traditional Chinese (`zh-TW`) 為第二語言的網站：一方面讓第一次接觸的人快速理解 `pia` 自製 CLI 的用途與安全邊界，另一方面建立可長期累積 Pi、agent harness、相關生態、coding agents 與 best practices 的研究筆記區。

`pia` 的可信來源是目前程式碼、schema、測試與 CI；兩份 `.specstory/references/chatgpt-*.md` 只作為選題線索，因為其中有過期、互相衝突與不可攜引用。GitHub repository `daviddwlee84/pi-agents` 目前為 private、Pages 尚未啟用；文件實作與本地驗證先完成，commit/push、Pages API 與首次 workflow dispatch 仍是分開的 outward-facing consent gates。

## 1. 保護現況並記錄 docs 偏好

- 先保存 `git status --short --branch` baseline；不 stage、改寫或刪除既有的 `skills-lock.json`、`.agents/skills/mkdocs-site-bootstrap/`、`.claude/skills/...` 與 `.specstory/` 變更。
- 不執行目前有 worktree root detection 與 existing-docs `wrap` 缺陷的 `init-docs-site.sh` / `add-language.sh`，也不使用 `--force`；改為手動建立站點設定。
- 唯一重用的 skill helper 是 `.agents/skills/mkdocs-site-bootstrap/scripts/check-preferences.sh`，以明確 `--file <repo>/.skills/preferences.yaml` 寫入：`enabled: true`、執行日期、`stack: mkdocs-material`、`auto_deploy: true`、`pages_deployed: false`、`existing_docs_decision: wrapped`、repo/site URL、`languages: [en, zh-TW]`、`keep_english_terms: true`、`i18n_structure: suffix`。

## 2. 建立嚴格、精簡的雙語 MkDocs stack

新增／修改：

- `mkdocs.yml`
  - Material theme；`site_url: https://daviddwlee84.github.io/pi-agents/`、repo/edit links。
  - `mkdocs-static-i18n` suffix layout，`en` 為 default/root、`zh-TW` 為 `/zh-TW/`；`theme.language: en`、localized search、完整 `nav_translations`。
  - `nav` 只列 unsuffixed English source paths；移除會破壞 contextual language switching 的 `navigation.instant*`。
  - 開啟必要 Markdown extensions 與 MkDocs link/nav/anchor validation；CI 使用 `mkdocs build --strict`。
  - 首版不加入 `mkdocs-llmstxt`、copy-to-LLM 或 social cards：`llmstxt` 與 static-i18n strict build 已知衝突，其他兩項並非需求且會增加未本地化 UI 或 Cairo/Pango/CJK 字型成本。
- `pyproject.toml` + generated `uv.lock`
  - docs-only optional dependencies：`mkdocs>=1.6,<2`、`mkdocs-material>=9.5,<10`、`mkdocs-static-i18n>=1.2,<2`、`pymdown-extensions>=10.7`；Python `>=3.11`。
- `.gitignore`
  - 在 generated block 外加入 `/site/`、`/.venv/`；不加入未使用的 social-card cache。
- `scripts/check-docs.ts` 與 `package.json` 的 `docs:check`
  - 延續 repository 的 Node-native TypeScript 慣例，只用 built-ins。
  - 驗證每個 English page 都有 zh-TW sibling、沒有 orphan／placeholder、research frontmatter 完整且語言 sibling 的 metadata 一致、沒有發布或引用 raw `.specstory` transcript。

## 3. 以可追蹤搬移重組既有文件

使用 history-preserving moves，再依新職責改寫：

- `docs/architecture.md` → `docs/concepts/architecture.md`
- `docs/combos.md` → `docs/guides/combos.md`
- `docs/sessions-and-handoff.md` → `docs/guides/sessions-and-handoff.md`
- `docs/chezmoi.md` → `docs/guides/chezmoi.md`
- `docs/ecosystem.md` → `docs/notes/ecosystem/index.md`

同步更新 `README.md` 與四篇 `backlog/*-harness-to-pi.md` / inheritance note 的舊 docs links。docs 內指向 `../backlog/*.md` 的 link 改成新的 curated page 或 absolute GitHub URL，確保 strict build 不因 docs-root 外的 Markdown link 失敗。

## 4. 完成精選首版內容（28 個 English pages + 28 個完整 zh-TW siblings）

建立下列 English canonical tree；每個 `x.md` 同時交付 `x.zh-TW.md`，不留 `Translation pending`：

```text
docs/
  index.md
  getting-started.md
  concepts/{architecture,security-and-data-boundaries}.md
  guides/{combos,sessions-and-handoff,chezmoi,troubleshooting}.md
  reference/{cli,combo-schema,paths-and-environment,compatibility}.md
  notes/
    index.md
    pi/{overview,harness-engineering}.md
    ecosystem/{index,oh-my-pi,deepseek-harness}.md
    paradigms/{model-harness-agent,engineering-evolution}.md
    coding-agents/{index,claude-code,codex,cursor,opencode,gemini-cli,antigravity}.md
    best-practices.md
```

### Project / CLI content contract

- Home 在首屏回答：`pia` 是 Git-versioned Pi/OMP combo manager、安全 materializer、session isolator 與 launcher；它不安裝 agent binaries、不管理 model/provider/credentials，也不把 Pi/OMP session formats 假裝成相容。
- Getting Started 說清 private clone/direct launch、`bin/` on `PATH`、`npm link` 只供 development、獨立安裝與登入 Pi/OMP、三個內建 combo 都是 neutral/`learning`，並帶讀者走過 `doctor → list --tree → apply --dry-run → apply/use/run` 及 `--` passthrough。
- Concepts / guides 由 `src/{runtime,harness,sessions,handoff,paths,combos}.ts` 與 tests 取材：完整 ownership/data-flow、安全拒絕表、drift/conflict、`--force` 邊界、session/fork/handoff、Git/Python/redactor/gitleaks prerequisites、chezmoi 的 operationally immutable mirror，以及 symptom-first troubleshooting。
- `reference/cli.md` 直接以 `src/cli.ts` 為 source of truth：所有 commands/options/aliases、implicit run、`--json`、selection precedence、stdout/stderr、exit codes、JSON examples，並警告 `sessions --json` 會包含 parsed conversation entries。
- `reference/combo-schema.md` 明示 `schema/combo.schema.json` 是 editor/schema aid，而 `src/combos.ts` 是 executable validator；如實記錄目前 `--no-session` 可進 `launchArgs` 的落差並建議不要依賴，不在此 docs task 偷改 CLI。
- Compatibility 只陳述 `.github/workflows/ci.yml` 證明的 Node 22/24、Linux/Windows coverage、Pi 0.84.4、OMP 18.0.11 與 macOS 未進 CI；不暗示 private repo 有 public release/license/support guarantee。

### Notes / research content contract

- 從兩份 ChatGPT export 萃取主題，不複製對話、metadata、`sediment://` 圖片或把它們當證據；移除 `utm_source=chatgpt.com`。
- 實作時以 first-party/current sources 重新查證 Pi、Oh My Pi、DeepSeek Harness 與六家 coding agents；動態能力、版本與產品狀態標明截至 `2026-08-31`，不用易腐壞的星數或「最強」排名。
- `notes/index.md` 同時定義研究方法與 source precedence：project code/tests → immutable upstream release/commit → current first-party docs → maintainer discussion → labeled secondary material。
- 每篇 notes page 使用統一 frontmatter：`kind`、`status`、`as_of`、`last_verified`、`upstreams`、`confidence`；正文區分 Fact、Observation、Inference、Opinion、Open question。
- Pi 兩頁涵蓋定位、minimal core、extension/resource/provider/session surfaces、SDK/RPC、security/trust 與「高可塑性不等於 benchmark 第一」。Oh My Pi 與 DeepSeek Harness 各自先建立 layer/interface/lifecycle/target-user，再比較與 Pi 的相似／不同；DeepSeek Harness 不預設為 Pi-like terminal replacement。
- Paradigm pages把 `LLM + harness → agent` 拆成可檢驗的心智模型，並把 `prompt → context → harness/meta-harness → loop → graph engineering` 明示為本站 editorial framework，而非公認線性標準。
- Coding-agent index 提供一致比較矩陣；六篇 profile 固定使用 instruction discovery、tools、permissions/sandbox、context/session、extensibility、orchestration、model/provider boundary、platform/license、change signals、sources/open questions 等欄位，方便後續更新。
- `best-practices.md` 收斂 controlled evaluation、context/tool budget、single/subagent/workflow/graph 選擇、verification、permission/sandbox 與 extension supply-chain checklist；避免把產品比較寫成無來源結論。

## 5. 雙語作者規則

- 先穩定 English page，再成對翻譯 title、headings、body、tables、admonitions、link text 與 alt text。
- zh-TW 技術名詞首次出現採「中文 (English original)」；沒有公認譯名就保留 English。CLI flags、API/package names、environment variables、paths、filenames、code 不翻譯。
- 兩語 sibling 保持相同 dates、versions、citations、research metadata 與章節語意；相對連結永遠指 canonical unsuffixed `.md`，不手寫 `.zh-TW.md` link。
- English/zh-TW pair 是一個完成單位：通過 `docs:check` 與 strict build 才算完成。

## 6. README 與 isolated docs CI

- 精簡更新 `README.md`：統一定位與 non-goals、拆開 core 與 handoff prerequisites、說明 empty learning combos／first-run auth、更新新 docs links；部署成功前以 repository-relative docs 為主，成功驗證後才提升 live-site URL。
- 新增 `.github/workflows/docs.yml`，不改現有 app CI：
  - PR 對 docs 相關 path 執行 parity check + frozen uv sync + strict build。
  - push `main` 自動 build/deploy，並支援 `workflow_dispatch`；deploy 僅允許 `main`、非 PR event。
  - filters 包含 `docs/**`、`mkdocs.yml`、`pyproject.toml`、`uv.lock`、`package.json`、`scripts/check-docs.ts` 與 workflow 自身。
  - 使用 official Pages artifact/deploy actions、`github-pages` environment、concurrency；將 `contents: read` 與 deploy 所需 `pages: write` / `id-token: write` 壓到最小 job scope。

## 7. End-to-end verification

依序執行：

```sh
uv lock
uv sync --extra docs --frozen
npm run docs:check
uv run mkdocs build --strict
npm run test:all
git diff --check
git status --short --branch
```

另外用本地 `mkdocs serve`／generated site 檢查 `/`、`/zh-TW/`、每個 top-level section 的 nested route、context-preserving language switch、translated nav/search、mobile nav、tables/code、internal anchors，以及 site 中沒有 English fallback、raw transcripts、placeholder 或生成目錄。最後和初始 status baseline 比對，確保既有 uncommitted skill/specstory 內容仍 untouched/unstaged。

## 8. Commit、push 與 GitHub Pages consent boundary

- 本地實作與驗證完成後先停止並回報；未另行指示前不 commit/push。
- workflow 必須先經使用者選定的 commit/push/merge 路徑進入 `main`。在實際啟用前，再明確確認將影響 `daviddwlee84/pi-agents` 且會執行：

```sh
gh api -X POST repos/daviddwlee84/pi-agents/pages -f build_type=workflow
gh workflow run docs.yml --repo daviddwlee84/pi-agents
```

- 若 private-repo Pages eligibility 因 GitHub plan 失敗，停止並如實回報；不自動改 visibility、billing、建立 `gh-pages` branch 或換部署平台。
- 成功後從 Actions/Pages API 取得實際 URL（預期 `https://daviddwlee84.github.io/pi-agents/`）並檢查首頁；只有驗證上線後才把 preferences 設為 `pages_deployed: true` / `pages_enabled_at` 並更新 README live link。

## Critical files / reusable sources

- Site/runtime: `mkdocs.yml`, `pyproject.toml`, `uv.lock`, `.github/workflows/docs.yml`, `scripts/check-docs.ts`, `.skills/preferences.yaml`
- Landing/reference: `README.md`, `docs/index.md`, `docs/getting-started.md`, `docs/reference/cli.md`, `docs/notes/index.md`
- Code-backed sources: `src/cli.ts`, `src/{combos,runtime,harness,sessions,handoff,paths}.ts`, `schema/combo.schema.json`, `test/*.test.ts`, `.github/workflows/ci.yml`
- Skill utility reused: `.agents/skills/mkdocs-site-bootstrap/scripts/check-preferences.sh`; scaffold/i18n scripts intentionally not used because their current worktree/existing-doc behavior is unsafe for this migration.
