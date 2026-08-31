---
kind: research-landscape
status: reviewed
as_of: 2026-08-31
last_verified: 2026-08-31
upstreams:
  - https://pi.dev/docs/latest
  - https://omp.sh/docs/using
  - https://www.deepseek.com/harness/en/
  - https://code.claude.com/docs/en/overview
  - https://developers.openai.com/blog/codex-as-a-platform
  - https://cursor.com/docs/agent/overview
  - https://opencode.ai/docs/
  - https://geminicli.com/docs/
  - https://antigravity.google/docs/home
confidence: high
---

# Coding-agent landscape

This inventory maps the interfaces through which nine coding-agent products can
be used. It is not a feature-parity table, adoption ranking, or benchmark. A
surface with the same broad name may execute in a local process, a vendor VM,
or a user-managed service and may have different tools, permissions, storage,
and release cadence.

!!! note "Observation — editorial classification"
    The comparison unit is a **product-level agent harness family**, not a
    model, provider, package, or individual binary. Rows therefore group closely
    related first-party interfaces, but the cells preserve distinct surfaces.
    This is an editorial taxonomy for navigation, not an upstream standard.

For this site, a harness is the layer that gathers instructions and context,
selects tools, runs an agent loop, mediates authority, and manages sessions
around one or more models. See [Pi overview](../pi/overview.md), [harness
engineering](../pi/harness-engineering.md), and the broader [ecosystem
notes](../ecosystem/index.md) for the project’s working model.

## Surface inventory

**Fact.** The entries below are surface names supported by reviewed first-party
sources as of the cutoff. “Not listed” means this inventory did not identify a
corresponding first-party surface; it does not prove that integrations or
third-party clients do not exist.

| Product family | Terminal or local interactive | Editor or desktop | Browser or managed surface | Automation or protocol | Embedding surface |
| --- | --- | --- | --- | --- | --- |
| [Pi](../pi/overview.md) | Interactive terminal; print mode | Not listed | Not listed | JSON event mode; subprocess JSON RPC; separate experimental remote protocol/server | `@earendil-works/pi-coding-agent` SDK |
| [Oh My Pi (OMP)](../ecosystem/oh-my-pi.md) | `omp` TUI; `omp -p` | Not listed; “IDE wired in” is positioning, not a separate editor product | Not listed | stdio RPC, `rpc-ui`, ACP | Bun/TypeScript SDK; process-backed Python RPC client |
| [DeepSeek Harness](../ecosystem/deepseek-harness.md) | `dsh`; one-shot headless profile | Not listed | Local browser Web UI | JSON-RPC SDK profiles; ACP stdio profile | TypeScript and Python SDK clients drive a Harness process |
| [Claude Code](claude-code.md) | Terminal CLI | VS Code, JetBrains, Desktop | Web and mobile access; cloud and Remote Control are different execution modes | Non-interactive CLI workflows | Claude Agent SDK in Python and TypeScript |
| [OpenAI Codex](codex.md) | Codex CLI TUI; `codex exec` | Codex IDE extension; Codex in the ChatGPT desktop app | Codex cloud/web | App Server; JSONL automation | TypeScript and Python Codex SDKs |
| [Cursor](cursor.md) | `agent`; headless `agent -p` | Cursor editor/Desktop | Cursor-managed Cloud Agents, operated from several clients | ACP; Cloud Agents API | `@cursor/sdk`; SDK Bridge |
| [OpenCode](opencode.md) | TUI; CLI and `run` | beta Desktop App; IDE integrations | Browser UI around an OpenCode server | headless server; ACP | generated `@opencode-ai/sdk` client |
| [Gemini CLI](gemini-cli.md) | `gemini` REPL; headless text/JSON/JSONL | IDE companion integration | Browser agent is a tool/subagent, not a hosted UI | ACP; remote agents use A2A | initial `@google/gemini-cli-sdk` |
| [Google Antigravity](antigravity.md) | Antigravity CLI/TUI | Antigravity 2.0 desktop; separately versioned IDE/editor integrations | Remote Control web/mobile interface to a host; scheduled/background workflows | Sidecars and agent orchestration | separately versioned Google Antigravity SDK for Python |

## Boundaries that matter

- **Product is not model.** Claude Code is not the Claude model family; Codex
  clients and cloud tasks are not a single model; Gemini CLI and Antigravity are
  harness products around model services.
- **Shared lineage is not parity.** OMP is a fork with its own `omp` product,
  not a Pi extension. DeepSeek Harness has its own Cordis runtime; use of Pi’s
  `pi-ai` library in an adapter does not make it Pi.
- **A shared engine is not one release.** Claude Code interfaces, Codex clients,
  Cursor local and cloud agents, and Antigravity surfaces differ in execution
  location and lifecycle even when first-party sources describe shared harness
  machinery.
- **Protocols and SDKs differ.** ACP, MCP, A2A, JSON RPC, and a product SDK solve
  different integration problems. Listing one does not imply the others.
- **Authority is multidimensional.** Approval prompts, project trust, OS
  sandboxing, worktrees, managed VMs, network policy, and credential isolation
  are separate controls.

!!! warning "Inference boundary"
    No row implies that a product is safer, more capable, or better for a task.
    Such a conclusion requires a controlled evaluation with the same repository,
    model access, instructions, tool policy, and verification criteria.

## Change signals

These products move on different channels: tagged releases, mutable documentation,
default branches, hosted rollouts, and preview programs. Profile pages date
version-sensitive claims and distinguish release artifacts from observations on
`main`, `dev`, or hosted documentation. Re-check a profile before using it for a
security policy, compatibility promise, or purchasing decision.

## Primary sources

- [Pi documentation](https://pi.dev/docs/latest)
- [OMP usage documentation](https://omp.sh/docs/using)
- [DeepSeek Harness overview](https://www.deepseek.com/harness/en/)
- [Claude Code overview](https://code.claude.com/docs/en/overview)
- [OpenAI Codex documentation](https://developers.openai.com/blog/codex-as-a-platform)
- [Cursor Agent overview](https://cursor.com/docs/agent/overview)
- [OpenCode documentation](https://opencode.ai/docs/)
- [Gemini CLI documentation](https://geminicli.com/docs/)
- [Google Antigravity documentation](https://antigravity.google/docs/home)
