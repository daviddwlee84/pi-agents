---
kind: ecosystem-product-note
status: reviewed
as_of: 2026-08-31
last_verified: 2026-08-31
upstreams:
  - https://omp.sh/
  - https://github.com/can1357/oh-my-pi
  - https://github.com/can1357/oh-my-pi/releases/tag/v18.0.11
  - https://api.github.com/repos/can1357/oh-my-pi/releases/latest
  - https://api.github.com/repos/can1357/oh-my-pi/compare/v18.0.11...969062200754ea02cfac922e5ebb8c608c079e15
  - https://github.com/can1357/oh-my-pi/commit/969062200754ea02cfac922e5ebb8c608c079e15
confidence: high
---

# Oh My Pi (OMP)

Oh My Pi (OMP) presents itself as a terminal coding agent “with the IDE wired
in.” Its README calls it a coding-first fork of Mario Zechner’s Pi, but OMP is
now an independent product: it publishes the `omp` CLI, `@oh-my-pi/*` packages,
Rust crates, documentation, defaults, and releases under `can1357/oh-my-pi`
([README](https://github.com/can1357/oh-my-pi/blob/v18.0.11/README.md)). It is
not a Pi Extension, official Pi edition, or proven drop-in replacement.

## Release and source snapshots

!!! info "Fact — two snapshots, not one state"
    On 2026-08-31, GitHub’s latest non-draft, non-prerelease OMP release was
    [`v18.0.11`](https://github.com/can1357/oh-my-pi/releases/tag/v18.0.11),
    published 2026-08-29; the [official release API](https://api.github.com/repos/can1357/oh-my-pi/releases/latest) supplied the cutoff ordering and explicit `draft`/`prerelease` flags. The reviewed later source snapshot,
    [`main@9690622`](https://github.com/can1357/oh-my-pi/commit/969062200754ea02cfac922e5ebb8c608c079e15),
    was dated 2026-08-30 and 44 commits ahead (`behind_by: 0`) in GitHub’s
    [compare API](https://api.github.com/repos/can1357/oh-my-pi/compare/v18.0.11...969062200754ea02cfac922e5ebb8c608c079e15); the
    [fixed comparison](https://github.com/can1357/oh-my-pi/compare/v18.0.11...969062200754ea02cfac922e5ebb8c608c079e15) remains the human-readable view.

Most mechanics below are documented at the release tag. A notable exception is
standalone project-root `CLAUDE.md` discovery: it was added in commit `9690622`
after `v18.0.11`; `.claude/CLAUDE.md` support predates it. Treat the standalone
form as an unreleased source observation, not a `v18.0.11` capability.

OMP’s core agent entry points include the interactive TUI (`omp`), `omp -p`
print/JSON operation, stdio RPC and `rpc-ui`, ACP, the in-process Bun/TypeScript
`@oh-my-pi/pi-coding-agent` SDK, and the process-backed Python `omp-rpc` client
([CLI reference](https://github.com/can1357/oh-my-pi/blob/v18.0.11/docs/cli-reference.md),
[RPC](https://github.com/can1357/oh-my-pi/blob/v18.0.11/docs/rpc.md)). This is
not an exhaustive list of every application in the monorepo.

## Profiles and overlays

A profile selected with `omp --profile`, `OMP_PROFILE`, or legacy `PI_PROFILE`
relocates OMP-native user configuration and runtime state, by default to
`~/.omp/profiles/<name>/agent`. Settings, auth, sessions, blobs, commands, rules,
prompts, hooks, tools, extensions, skills, and MCP state move with it. A named
profile does not inherit native configuration from the default profile;
keybindings are the documented overlay exception. Project configuration and
external-tool roots remain profile-independent
([configuration guide](https://github.com/can1357/oh-my-pi/blob/v18.0.11/docs/config-usage.md)).

Profiles are distinct from process-only settings overlays. Effective precedence
is defaults, global config, project config, `PI_CONFIG_FILES`, repeated
`--config`, then runtime overrides. Objects deep-merge, but higher-layer arrays
replace lower arrays wholesale. Missing, malformed, or non-mapping overlay files
fail the run rather than being silently ignored
([settings](https://github.com/can1357/oh-my-pi/blob/v18.0.11/docs/settings.md)).

## Tools, approvals, and the sandbox boundary

OMP integrates file/search, shell/evaluation, code-intelligence, coordination,
browser/desktop, memory, and skill-oriented tools; availability still depends
on settings, model, credentials, and platform. Avoid treating a changing tool
count as a compatibility contract.

Tools declare `read`, `write`, or `exec` approval tiers, and argument or per-tool
policy can `allow`, `deny`, or `prompt`. Modes include `always-ask`, `write`, and
`yolo`; the `v18.0.11` schema default is `yolo`. That default is not an
unconditional “no gates” promise: provider-originated computer safety checks can
still prompt, and ACP retains its client permission gate unless `yolo` was
explicitly configured or passed
([approval mode](https://github.com/can1357/oh-my-pi/blob/v18.0.11/docs/approval-mode.md)).

!!! warning "Fact — approval is not confinement"
    OMP has no default general host sandbox. `task.isolation.mode` defaults to
    `none` and, when enabled, separates child workspaces and change integration;
    it does not confine arbitrary processes, credentials, host APIs, or network
    access. Extensions/plugins execute in-process, browser and `computer` code
    can use Bun/Node host authority, and OMP launches headless Chromium with its
    sandbox disabled
    ([task isolation](https://github.com/can1357/oh-my-pi/blob/v18.0.11/docs/tools/task.md),
    [extension loading](https://github.com/can1357/oh-my-pi/blob/v18.0.11/docs/extension-loading.md),
    [browser boundary](https://github.com/can1357/oh-my-pi/blob/v18.0.11/docs/tools/browser.md)).

## Sessions

Default file-backed sessions are JSONL beneath the active agent directory.
Entries form an append-only `id`/`parentId` tree and can record messages,
model/thinking changes, compactions, reset boundaries, lifecycle metadata, and
extension state. File-backed managers support resume and fork; the SDK also
offers in-memory sessions with fewer persistence operations
([session model](https://github.com/can1357/oh-my-pi/blob/v18.0.11/docs/session.md)).

Session commands have deliberately different meanings. `/fresh` rotates
provider-side stream/session state while retaining the local transcript;
`/clear` appends a reset boundary but does not erase earlier JSONL entries.
Completed messages are queued synchronously, but there is no `fsync`; partial
streaming text is not durable, and `/drop` is best-effort rather than a secure
erasure guarantee
([session operations](https://github.com/can1357/oh-my-pi/blob/v18.0.11/docs/session-operations-export-share-fork-resume.md)).

## Extensibility, subagents, and providers

OMP keeps several extension planes distinct:

- **Skills** expose file-backed instructions on demand.
- **Extensions** are trusted in-process TS/JS factories for events, tools,
  commands, UI, and providers; ordinary startup routes legacy JS/TS hooks
  through this runner.
- **Custom tools** expose focused executable APIs; **plugins** distribute one or
  more resources. Standalone npm plugin installation works, but npm-source
  objects in marketplace catalogs are parsed and currently rejected
  ([marketplace behavior](https://github.com/can1357/oh-my-pi/blob/v18.0.11/docs/marketplace.md#L199-L209)).
- **MCP** supports stdio, Streamable HTTP, and compatibility SSE. Project stdio
  definitions can execute arbitrary commands, so they are trusted input
  ([MCP configuration](https://github.com/can1357/oh-my-pi/blob/v18.0.11/docs/mcp-config.md)).

The `task` tool launches subagents that do not inherit the parent conversation;
prompts must carry their own context. Headless children force tier-level `yolo`
while explicit per-tool policy remains authoritative. Child JSONL/output
persistence depends on the parent’s artifact-persistence path and may use
temporary storage; isolated agents cannot be revived after merge/cleanup.
Workspace isolation is still not a security sandbox
([task tool](https://github.com/can1357/oh-my-pi/blob/v18.0.11/docs/tools/task.md)).
Vibe workers are kept alive only within that Vibe/session lifecycle: leaving
Vibe kills them, and interrupted turns do not automatically resume after a
process restart
([Vibe mode](https://github.com/can1357/oh-my-pi/blob/v18.0.11/docs/vibe-mode.md)).

OMP is best described as **multi-provider**, not provider-neutral. It has a
broad catalog and custom provider surfaces, but authentication, request shaping,
streaming, reasoning, retry, quota, and availability remain provider-specific
([provider quirks](https://github.com/can1357/oh-my-pi/blob/v18.0.11/docs/provider-quirks.md)).
Provider retention, training, residency, and subscription terms are outside the
OMP contract.

## License and compatibility cautions

OMP’s first-party code is MIT-licensed. Vendored code, dependencies, fonts,
data, and marks retain their component-specific notices; “OMP is MIT” must not
be expanded to “everything in every artifact is MIT”
([license](https://github.com/can1357/oh-my-pi/blob/v18.0.11/LICENSE),
[third-party notices](https://github.com/can1357/oh-my-pi/blob/v18.0.11/THIRD-PARTY-NOTICES.txt)).
No reviewed source establishes an LTS window, compatibility commitment, or
support SLA.

!!! question "Open question — downstream compatibility"
    Which post-`v18.0.11` changes will ship unchanged, and which Pi-originated
    config, session, extension, or instruction conventions will remain compatible?
    Re-test the exact release rather than inferring compatibility from fork
    ancestry or from `main`.

## Primary sources

- [OMP README, `v18.0.11`](https://github.com/can1357/oh-my-pi/blob/v18.0.11/README.md)
- [Configuration and profiles, `v18.0.11`](https://github.com/can1357/oh-my-pi/blob/v18.0.11/docs/config-usage.md)
- [Approval modes, `v18.0.11`](https://github.com/can1357/oh-my-pi/blob/v18.0.11/docs/approval-mode.md)
- [Session model, `v18.0.11`](https://github.com/can1357/oh-my-pi/blob/v18.0.11/docs/session.md)
- [Task/subagent behavior, `v18.0.11`](https://github.com/can1357/oh-my-pi/blob/v18.0.11/docs/tools/task.md)
- [Post-release source snapshot, commit `9690622`](https://github.com/can1357/oh-my-pi/commit/969062200754ea02cfac922e5ebb8c608c079e15)
