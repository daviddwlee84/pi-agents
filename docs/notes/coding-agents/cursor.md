---
kind: product-profile
status: reviewed
as_of: 2026-08-31
last_verified: 2026-08-31
upstreams:
  - https://cursor.com/docs/agent/overview
  - https://cursor.com/docs/cli/overview
  - https://cursor.com/docs/cloud-agent
  - https://cursor.com/docs/cloud-agent/security
  - https://cursor.com/docs/cloud-agent/automations
  - https://cursor.com/docs/rules
  - https://cursor.com/docs/skills
  - https://cursor.com/docs/hooks
  - https://cursor.com/docs/agent/security/run-modes
  - https://cursor.com/docs/subagents
  - https://cursor.com/docs/plugins
  - https://cursor.com/docs/sdk/typescript
  - https://cursor.com/docs/models-and-pricing
  - https://cursor.com/data-use
  - https://cursor.com/terms-of-service
  - https://github.com/cursor/plugins/tree/68836ddaf5697224520f1847d90cdb90ca8babaa
  - https://github.com/cursor/cursor/tree/654b1b4775ca67aef473bd31a14c8c04a1abde2d
  - https://github.com/cursor/sdk-bridge/blob/8157597c625b5f642d3c4a1472d20c9c330a9d18/LICENSE
confidence: high
---

# Cursor

> **Editorial classification:** Cursor is profiled across four surfaces: its VS Code-derived editor, terminal CLI, managed Cloud Agents/Automations, and SDK. This does not assert parity or rank.

## Scope and surfaces

Cursor Agent is the autonomous coding surface in the editor sidepane. Cursor describes the loop as Instructions, Tools, and a selected Model. The separate Cursor CLI is invoked with `agent` and operates against a local workspace. Cloud Agents run remotely on Cursor-managed machines; Automations trigger those managed agents. `@cursor/sdk` embeds an agent loop in a caller's process or invokes cloud runs ([Agent overview](https://cursor.com/docs/agent/overview), [CLI](https://cursor.com/docs/cli/overview), [Cloud Agents](https://cursor.com/docs/cloud-agent), [SDK](https://cursor.com/docs/sdk/typescript)).

These are related but different trust boundaries. Editor Agent and CLI use local files and local controls. A Cloud Agent can continue without the user's machine online and executes without local Run Mode approval prompts. Repository-backed cloud runs can use a branch and pull request; Automations may instead run with no repository, one repository, or multiple repositories, so repository and branch claims are not universal. Documented comment launches are specifically GitHub and Bitbucket comments, not all connected source-control products.

## Instructions and context

Cursor Rules include Team Rules, recursive Project Rules under `.cursor/rules/**/*.mdc`, User Rules, and `AGENTS.md`. Project rules may always apply, match globs, be selected from descriptions, or be manually referenced. Cursor documents Team → Project → User precedence, but not a complete same-scope conflict rule. CLI also reads root `AGENTS.md` and `CLAUDE.md`; the relationship between those compatibility files and Cursor Rules remains unspecified ([Rules](https://cursor.com/docs/rules), [CLI use](https://cursor.com/docs/cli/using)).

Chats share a finite context among messages, files, tool output, rules, skills, MCP, and subagents. Near capacity, Cursor summarizes older conversation. This context process is separate from file checkpoints and from Automation Memories.

## Tools and execution

Editor Agent documents code/file search, reading and editing, shell commands, web operations, browser control, image handling, questions, and subagent delegation. Cursor CLI offers interactive Agent, Plan, and read-only Ask modes plus headless `agent -p`. Tool availability still depends on surface and policy.

The Browser tool is implemented through an MCP extension server and retains cookies and browser storage per workspace. Origin controls reduce exposure but redirects, clicked links, manual navigation, and client-side navigation can cross allowlists ([browser tool](https://cursor.com/docs/agent/tools/browser)). Cloud Agents can build/test, use browser or desktop capabilities, and produce logs or visual artifacts on managed machines; these are not evidence that the local CLI has the same environment.

## Permissions/trust/sandbox

Local editor Run Modes govern shell, MCP, and Fetch approval. Auto-review combines allowlists, a terminal sandbox where available, and a classifier; Allowlist omits the classifier; Run Everything automatically runs commands without a sandbox. The sandbox covers supported terminal commands—not MCP or Fetch—and Cursor explicitly says Auto-review is not a security boundary ([Run Modes](https://cursor.com/docs/agent/security/run-modes)). CLI has separate global/project allow and deny rules; deny wins, but the docs do not state which file wins between `~/.cursor/cli-config.json` and `.cursor/cli.json`. Headless `--force`/`--yolo` removes normal edit confirmation.

`.cursorignore` limits what several editor features surface, but Terminal and MCP can still reach ignored files. It is not a confidentiality boundary ([ignore file](https://cursor.com/docs/reference/ignore-file)).

Cursor says each Cloud Agent uses a dedicated Firecracker-based microVM and inherits the initiating user's repository permissions. Internet access is on by default. Environment Variables are inspectable by the agent; Runtime Secrets are redacted from model/tool/transcript/commit surfaces but remain accessible through Terminal. Egress controls and redaction are mitigations, not guarantees against prompt-injection-driven exfiltration ([cloud security](https://cursor.com/docs/cloud-agent/security), [secrets and network](https://cursor.com/docs/cloud-agent/security-network)).

## Sessions and recovery

Editor Agent checkpoints snapshot files before significant changes; restoring files does not erase conversation messages, and checkpoints are not Git. CLI conversations can be listed and resumed. In the SDK, an Agent is a durable conversation container and a Run is one prompt execution; local state is stored locally, while cloud state is stored server-side ([SDK](https://cursor.com/docs/sdk/typescript)).

Cloud conversation records and artifacts persist by default until deletion, while inactive environment snapshots have a separate documented expiry
([cloud security](https://cursor.com/docs/cloud-agent/security),
[network and secrets](https://cursor.com/docs/cloud-agent/security-network)). Automation Memories persist across runs outside the repository and can be edited or disabled; untrusted events can therefore create misleading persistent notes
([Automations](https://cursor.com/docs/cloud-agent/automations)).

## Extensibility

Rules, Agent Skills, hooks, MCP, and plugins are different mechanisms. Skills use `SKILL.md`, load progressively, and can be discovered in Cursor and compatible agent locations; Cursor calls the format open and portable, but does not provide a versioned conformance guarantee or promise identical cross-product behavior ([Skills](https://cursor.com/docs/skills)). User skills do not automatically transfer to Cloud Agents, SSH sessions, or managed workers.

MCP supports tools, prompts, resources, roots, elicitation, and apps over stdio, SSE, or Streamable HTTP, with local and administrative controls. Hooks are JSON-speaking subprocesses at lifecycle events; security-sensitive hooks fail open after crash, timeout, or invalid JSON unless `failClosed: true`, and Cloud Agents support only a subset ([hooks](https://cursor.com/docs/hooks)).

Agent Plugins package portable skills and MCP. Cursor Plugins can additionally package rules, agents, commands, hooks, and variables. Public Marketplace review is not a safety guarantee, and local/team plugins have different provenance ([plugins](https://cursor.com/docs/plugins)). At the cutoff, the reviewed
[`cursor/plugins` tree](https://github.com/cursor/plugins/tree/68836ddaf5697224520f1847d90cdb90ca8babaa) had no root `LICENSE` file or GitHub-detected license, although its README labels a License section “MIT” and nested plugins contain their own licenses. Those signals do not establish one clear repository-wide or product-wide grant; this is a frozen-tree observation, not a claim that no terms can apply elsewhere.

## Orchestration

Subagents are documented for editor, CLI, and Cloud Agents. Each has an isolated context; foreground work blocks, background work is asynchronous, and multiple workers may run concurrently. Built-ins include Explore, Bash, and Browser. Shared-checkout edits can collide; worktrees or separate cloud environments provide file isolation where configured ([subagents](https://cursor.com/docs/subagents)).

Automations trigger Cloud Agents from schedules and selected external events, including source control, Slack, webhooks, Linear, Sentry, and PagerDuty. Runs can be repository-free or repository-backed, and Automation Memories are workflow-specific persistent state ([Automations](https://cursor.com/docs/cloud-agent/automations)). This is managed orchestration, distinct from a local subagent tree.

## Model/provider boundary

Cursor exposes Cursor Models and third-party models. Requests—including BYOK requests—pass through Cursor's backend for final prompt construction; physical inference hosting may be by the model vendor, a trusted partner, or Cursor ([models](https://cursor.com/docs/models-and-pricing), [data use](https://cursor.com/data-use)). A local SDK agent means the loop, tools, and filesystem effects are local, **not** that inference is local; model generation remains a remote Cursor service path.

The SDK is an agent SDK, not a raw chat-completions API. Its identifiers and all payload details are not guaranteed stable. `agent acp` separately exposes the CLI through newline-delimited JSON-RPC 2.0 over stdio; the documentation describes behavior but gives no stability designation ([ACP](https://cursor.com/docs/cli/acp)).

## Platform/license/status

Cursor is based on the VS Code codebase and can import many VS Code settings, themes, keybindings, and extensions, but Cursor's rebasing cadence does not guarantee extension parity ([VS Code migration](https://cursor.com/docs/configuration/migrations/vscode)). Cursor's Terms grant a limited service-use right; its OSS notice covers incorporated components, not the whole product. The reviewed public [`cursor/cursor` tree](https://github.com/cursor/cursor/tree/654b1b4775ca67aef473bd31a14c8c04a1abde2d) is informational and is not the full source. MIT applies where an explicit license grants it, such as the pinned [`cursor/sdk-bridge` license](https://github.com/cursor/sdk-bridge/blob/8157597c625b5f642d3c4a1472d20c9c330a9d18/LICENSE) or particular plugin directories—not automatically to the aggregate plugin repository or Cursor product ([Terms](https://cursor.com/terms-of-service), [OSS notices](https://cursor.com/licenses)).

The Cloud Agents API v1 is public beta. In the cited v1 API, repository/branch/PR endpoints are GitHub-specific and cover up to 20 repositories. Five-minute expiry applies to pending-pool watch cursors, not universally to run streams; run-stream retention is separately signaled. v1 webhooks are absent and some environment-variable support was still rolling out at the cutoff ([API](https://cursor.com/docs/cloud-agent/api/endpoints)).

## Change signals

Model catalogs, context limits, Router pools, prices, plan eligibility, API rollout, and Privacy Mode exceptions are volatile. Changelog entries establish introduction dates, not current semantics. The status page and security attestations are point-in-time vendor evidence, not uptime or safety guarantees.

Privacy Mode is a stated no-training commitment under specified arrangements, not “no processing” or unconditional “no retention.” BYOK, required-retention models, abuse investigations, caches, and cloud artifacts have separate handling ([data use](https://cursor.com/data-use)).

## Open questions

> **Open question:** How do same-scope Rules resolve conflicts, and how are CLI `AGENTS.md`/`CLAUDE.md` instructions ordered against `.cursor/rules`?

The docs also leave global-versus-project CLI permission precedence unresolved, provide no ACP compatibility commitment, and do not publish one universal retention period across editor, CLI, provider, SDK, and Cloud Agent surfaces.

## Primary sources

- [Cursor Agent overview](https://cursor.com/docs/agent/overview) and [Cursor CLI](https://cursor.com/docs/cli/overview)
- [Cloud Agents](https://cursor.com/docs/cloud-agent), [cloud security](https://cursor.com/docs/cloud-agent/security), and [Automations](https://cursor.com/docs/cloud-agent/automations)
- [Rules](https://cursor.com/docs/rules) and [Agent Skills](https://cursor.com/docs/skills)
- [Run Modes](https://cursor.com/docs/agent/security/run-modes)
- [Hooks](https://cursor.com/docs/hooks), [plugins](https://cursor.com/docs/plugins), and [subagents](https://cursor.com/docs/subagents)
- [Cursor TypeScript SDK](https://cursor.com/docs/sdk/typescript)
- [Models and pricing](https://cursor.com/docs/models-and-pricing) and [data use](https://cursor.com/data-use)
- [Terms of Service](https://cursor.com/terms-of-service)
