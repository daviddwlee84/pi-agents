---
kind: paradigm
status: reviewed
as_of: 2026-08-31
last_verified: 2026-08-31
upstreams:
  - https://github.com/earendil-works/pi/blob/v0.84.4/packages/ai/README.md
  - https://github.com/earendil-works/pi/blob/v0.84.4/packages/agent/README.md
  - https://pi.dev/docs/latest/extensions
  - https://code.claude.com/docs/en/how-claude-code-works
  - https://developers.openai.com/blog/codex-as-a-platform
  - https://learn.chatgpt.com/docs/config-file/config-advanced
confidence: high
---

# Model, provider, harness, and agent

“Agent” often compresses several independently changing layers into one word.
That shortcut is harmless in casual conversation but poor architecture and poor
comparison methodology.

**Editorial classification.** This site uses the following stack to discuss
agentic coding systems. It is a house vocabulary, not a claim that every vendor
uses these exact boundaries.

## The layers

### 1. Model

A **model** is the inference system selected for a turn: it transforms supplied
context into output and may request tool calls. Its identity matters because
capabilities, context limits, tool-use behavior, and output can differ.

A model does not, by itself, discover a repository, approve a command, execute
`git`, preserve a session, or decide where a file is mounted. Those behaviors
come from surrounding layers.

### 2. Provider

A **provider** exposes model access and owns an API/service boundary: endpoint,
authentication, model identifiers, streaming protocol, quotas, billing, and
applicable data terms. A gateway or cloud platform can add another provider
boundary.

Pi makes this distinction concrete: `@earendil-works/pi-ai` routes a `Model`
through its owning `Provider`, while credentials, headers, and provider options
remain request concerns
([`pi-ai` README](https://github.com/earendil-works/pi/blob/v0.84.4/packages/ai/README.md)).
A provider-neutral harness therefore does **not** imply equal model features,
entitlements, retention, or tool behavior across providers.

### 3. Harness and agent loop

The **harness** assembles instructions, repository context, tools, policy,
session state, and provider calls. Its **agent loop** repeats some form of:

```text
gather context → ask model → validate/authorize request → run tool
               ← append result/error ← observe and continue or stop
```

The loop is an implementation, not a new model. It decides what the model sees,
which tool requests are executable, how results are serialized, when context is
compacted, and what constitutes completion. Pi separates its provider-facing
package from `@earendil-works/pi-agent-core`, which owns the loop, mutable state,
tools, queues, and events
([agent-core README](https://github.com/earendil-works/pi/blob/v0.84.4/packages/agent/README.md)).
Anthropic similarly describes Claude Code as the “agentic harness” around Claude
([How Claude Code works](https://code.claude.com/docs/en/how-claude-code-works)).

A **meta-harness** configures or launches another harness rather than replacing
its inner loop. `pia` is in this category: it selects and materializes a reviewed
Pi or OMP combo, establishes session paths, then invokes the upstream engine.
It does not become the model provider or the upstream execution sandbox. See
[`pia` architecture](../../concepts/architecture.md).

### 4. Client and product surface

A **client/surface** is how a user or another program controls the system: CLI,
TUI, editor extension, desktop app, web/cloud console, headless command, server,
or SDK. A **product** may bundle several of these with a harness and hosted
services.

Shared branding or a common harness is not evidence of surface parity. A local
CLI and a managed cloud task can differ in filesystem, credentials, available
tools, approvals, persistence, and data path. OpenAI’s own layered account of
Codex distinguishes model reasoning, the harness, integration surfaces, and
managed infrastructure
([Codex as a platform](https://developers.openai.com/blog/codex-as-a-platform)).

### 5. Environment

The **environment** is where the loop and tools actually run: host account,
working tree, worktree, container, VM, managed worker, browser, network, and
credential set. Inference may still happen somewhere else.

Keep four locations separate:

1. where the client runs;
2. where the agent loop runs;
3. where tools cause effects; and
4. where inference and stored artifacts live.

“Local agent” can mean local tool execution with remote inference. “Remote
control” can mean a remote interface to a process still running on the user’s
machine. An SDK can embed a loop without supplying managed deployment.

## Agent is a role, not a magic layer

**Inference.** In this vocabulary, an agent is the model-in-a-loop behavior
produced by a particular model, provider, harness configuration, tool set,
policy, session, and environment. Change any one and the effective agent can
change even when the product name does not.

This also explains why similarly named features are not interchangeable:

- a permission prompt authorizes an operation; it does not confine a process;
- project trust controls which repository instructions or code may load; it is
  not tool authorization;
- a sandbox constrains a specified process or resource, not necessarily built-in
  file tools, extensions, MCP servers, browsers, or network paths;
- a worktree separates checkouts; it does not isolate credentials or processes;
- compaction preserves a summary, not the exact discarded context.

Pi documents that Extensions can intercept context, tools, and sessions while
running with full system access. At the provider boundary they can mutate
outgoing headers/payloads and observe response status/normalized headers, not
rewrite the streamed response body
([Extensions](https://pi.dev/docs/latest/extensions)). That is a harness
extension boundary, not a model capability.

## A claim template

Before comparing two “agents,” write the claim this way:

> At **[tag/commit/date]**, **[product + surface]** runs the **[loop]** in
> **[location]**, executes **[named tools]** in **[environment]**, reaches
> **[model]** through **[provider]**, and applies **[approval/confinement]**.

Then mark whether the evidence is shipped release behavior, current docs,
unreleased source, example/extension behavior, or an editorial inference.

**Open question.** Provider and product documentation often leave exact
cross-surface parity or data flow unspecified. In that case, record “not
documented” rather than filling the gap from a neighboring surface.

## Why this matters for `pia`

A combo can pin harness configuration and make it reviewable, but it cannot make
provider terms, model behavior, network policy, or host isolation identical.
Use [Security and data boundaries](../../concepts/security-and-data-boundaries.md)
to identify `pia`’s actual boundary, and
[Sessions and handoff](../../guides/sessions-and-handoff.md) for persistence.
Product examples live in the [coding-agent landscape](../coding-agents/index.md),
with Pi/OMP-specific context in the [ecosystem note](../ecosystem/index.md).

## Primary sources

- [Pi AI/provider layer](https://github.com/earendil-works/pi/blob/v0.84.4/packages/ai/README.md)
- [Pi agent-loop layer](https://github.com/earendil-works/pi/blob/v0.84.4/packages/agent/README.md)
- [Pi Extensions](https://pi.dev/docs/latest/extensions)
- [How Claude Code works](https://code.claude.com/docs/en/how-claude-code-works)
- [Codex as a platform](https://developers.openai.com/blog/codex-as-a-platform)
- [Codex advanced configuration](https://learn.chatgpt.com/docs/config-file/config-advanced)
