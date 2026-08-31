# Context

The deployed `pi-agents` MkDocs site is complete, but the project-local `mkdocs-site-bootstrap` installation came from an upstream skill with two confirmed defects: nested invocation cannot locate a linked Git worktree root, and `--existing skip|wrap` leaves starter navigation and `llmstxt` paths pointing at pages that may not exist. The goal is to repair and regression-test the canonical source in `daviddwlee84/agent-skills`, publish it to the default branch as authorized, refresh the downstream snapshot through `npx skills`, and then finish the pending provenance/tooling commit without weakening secret scanning.

## 1. Repair the upstream skill on a dedicated branch

- In `/Users/david/Documents/Program/agent-skills`, fetch and reconfirm that the clean checkout still matches `origin/main`, then create `fix/mkdocs-existing-docs` before editing. Preserve and never stage unrelated work if the baseline changed.
- In `skills/local/mkdocs-site-bootstrap/scripts/init-docs-site.sh` and `scripts/check-preferences.sh`, replace `.git`-directory-only walking with `git rev-parse --show-toplevel` when inside Git, retaining the current-directory fallback outside Git and respecting explicit `--target-dir` / `--file` overrides. Update help text to describe normal checkouts and linked worktrees accurately.
- Add explicit sentinel boundaries around starter-only blocks in `assets/mkdocs.yml.template`, then make `init-docs-site.sh` rewrite those blocks atomically:
  - Fresh scaffolds remove only sentinel comments, keep starter nav/llmstxt entries, and create the normal skeleton.
  - Existing docs with `--existing skip` leave the complete `docs/` tree byte-for-byte untouched and omit the entire `nav` key so MkDocs filesystem auto-navigation works.
  - Existing docs with `--existing wrap` leave `docs/` untouched and emit a deterministic, `LC_ALL=C`-sorted, path-only nav containing recursive `*.md` paths relative to `docs/`; quote YAML scalars safely for spaces, apostrophes, and YAML punctuation, and exclude non-Markdown files.
  - Reuse the discovered Markdown list for the starter-specific `llmstxt.sections` block so existing-doc configurations never retain missing `index.md` / `getting-started.md` references.
  - Apply existing-doc configuration independently of skeleton copying so `--no-skeleton` cannot leave stale starter references. Preserve `--dry-run`, `--force`, Bash 3.2 compatibility, and atomic sibling-temp-file replacement.
- Synchronize the behavior contract in `SKILL.md` and `references/existing-docs-handling.md`: skip omits nav; wrap generates an alphabetical path-only nav without modifying user content.

## 2. Add executable regressions and CI coverage

- Create `skills/local/mkdocs-site-bootstrap/tests/test_init_docs_site.sh` following the repository’s Bash 3.2 test harness conventions (`mktemp`, cleanup trap, pass/fail counters, isolated Git config).
- Cover:
  - `init-docs-site.sh` and `check-preferences.sh --list` from a nested directory in a real linked worktree resolve the linked worktree root; a fake `yq` satisfies the latter’s eager availability check without adding a CI dependency.
  - Outside Git, current-directory fallback remains intact.
  - Fresh scaffold keeps starter nav and pages.
  - `skip` preserves an existing nested docs tree byte-for-byte, creates no skeleton, and emits no `nav` key or stale starter llmstxt paths.
  - `wrap` preserves docs, emits every Markdown path exactly once in C-locale order, handles nested paths/spaces/apostrophes, excludes non-Markdown files, and creates no skeleton.
  - Dry-run performs no writes.
  - Generated YAML parses and representative fresh/skip/wrap fixtures build with MkDocs under the repository’s docs environment.
- Add a `test-mkdocs-skill` Make target, include it in `test-skill`, and invoke the focused target from `.github/workflows/validate.yml` with the minimal uv/docs setup required for parser/build assertions. Existing catalog and native marketplace gates remain unchanged.

## 3. Validate, commit, and push upstream

- Run the focused Bash suite under stock macOS `/bin/bash`, then `make test-skill`, `make validate`, `make native-marketplace-smoke`, and `make docs-build`.
- Run `bash -n` and both helper `--help` commands; run ShellCheck at warning/error severity; run `git diff --check`, staged secret/shipped-file hygiene, and review the full scoped diff.
- Stage only the helper, template, regression, Makefile/CI, and synchronized skill documentation. Commit on `fix/mkdocs-existing-docs` with an English Conventional Commit and required Claude Code co-author trailer.
- Fetch again. If `origin/main` moved, rebase the fix branch and rerun validation; otherwise fast-forward local `main` to the fix commit and push `origin main` directly as authorized. Do not create a PR, release tag, force push, or remote feature branch. Confirm remote `main` resolves to the pushed commit and wait for relevant CI to pass.

## 4. Refresh and validate the downstream installation

- In `/Users/david/Worktrees/pi-agents/feat-mkdocs-init`, fetch `origin`, confirm current `HEAD` is an ancestor of `origin/main` with an identical tree, and fast-forward this branch in place without reset/rebase/stash or an extra merge commit. Stop rather than override if the dirty artifacts obstruct the fast-forward.
- Refresh only this skill from upstream default-branch content:

  ```sh
  npx skills@latest add daviddwlee84/agent-skills/skills \
    --skill mkdocs-site-bootstrap --yes
  ```

- Verify `.agents/skills/mkdocs-site-bootstrap/` is byte-identical to the pushed upstream source, `.claude/skills/mkdocs-site-bootstrap` retains its expected relative symlink, `skills-lock.json` records the new content hash, and no unrelated skill changed.
- Run the installed regression suite, script syntax/help checks, `npm run test:all`, `npm run docs:check`, `npm run docs:test`, strict MkDocs build, built-site crawl, and `git diff --check`.

## 5. Stage provenance safely and commit downstream locally

- Explicitly stage the refreshed skill snapshot, symlink, lockfile, both plans, both research references, the complete prior implementation transcript, and a stable snapshot of the current follow-up transcript. Never stage ignored caches/SpecStory state or the incomplete same-UUID alias `.specstory/history/2026-08-30_16-50-35Z.md`.
- Select the complete prior session exactly with UUID `72342db6-02a9-4e6d-885b-de2475265713`, transcript `.specstory/history/2026-08-30_16-50-35Z-explore-this-repository-very.md`, and plan `.claude/plans/docs-docs-mkdocs-eventual-key.md`; pair the current transcript with `.claude/plans/jazzy-skipping-allen.md` using an exact artifact selector.
- Run the repository redactor on the staged snapshot, re-stage only sanitized outputs, and rerun the exact staged gitleaks/private-key scan. If any finding is a real credential, stop for provider rotation rather than merely redacting it.
- Run every pre-commit hook while setting `SKIP=check-added-large-files`; this is the sole authorized exception for the complete 64 MB transcript. Never use `--no-verify` or skip redaction, gitleaks, private-key detection, formatting, or merge checks.
- Generate agent metadata from the final staged index, verify every trailer path is staged, and commit locally with a Conventional Commit plus required attribution under the same single-hook exception. Inspect the resulting commit and status; leave the incomplete alias uncommitted and do not push `pi-agents` or open another PR.

## Critical files

Upstream:

- `skills/local/mkdocs-site-bootstrap/scripts/init-docs-site.sh`
- `skills/local/mkdocs-site-bootstrap/scripts/check-preferences.sh`
- `skills/local/mkdocs-site-bootstrap/assets/mkdocs.yml.template`
- `skills/local/mkdocs-site-bootstrap/tests/test_init_docs_site.sh`
- `skills/local/mkdocs-site-bootstrap/SKILL.md`
- `skills/local/mkdocs-site-bootstrap/references/existing-docs-handling.md`
- `Makefile`
- `.github/workflows/validate.yml`

Downstream:

- `.agents/skills/mkdocs-site-bootstrap/`
- `.claude/skills/mkdocs-site-bootstrap`
- `skills-lock.json`
- `.claude/plans/*.md`
- selected `.specstory/history/*.md` and `.specstory/references/*.md`
