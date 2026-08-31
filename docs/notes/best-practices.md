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

# Best practices for agentic coding work

These practices apply the layer model without assuming that similarly named
features behave alike across products. Treat them as an editorial operating
standard, then adapt them to the exact surface, release, provider, and
environment under test.

## Run controlled comparisons

A useful comparison changes one meaningful variable at a time. Record:

- repository revision and clean/dirty state;
- exact task, fixtures, acceptance tests, and stop condition;
- model ID, provider path, account/plan, and model options;
- product surface, release/tag/commit, and execution location;
- instructions, context files, enabled tools/extensions/MCP servers, and policy;
- sandbox, network, credentials, worktree, and warm/cold session state; and
- repeated-trial count, failures, human interventions, elapsed time, and usage.

Score the artifact against task-specific checks, not feature counts or the
model’s self-assessment. Preserve logs and diffs needed to explain failures,
while redacting secrets. A result from one CLI/version cannot be promoted to its
vendor’s IDE, cloud service, SDK, or next release.

!!! note "Comparison limit"
    First-party documentation comparison is not an independent audit or
    benchmark. These notes do not identify a benchmark winner. If a controlled
    evaluation is published, disclose its task set, environment, policy,
    repetitions, exclusions, and evaluator.

## Budget context and tools

Context is a shared, finite working set. Before a run:

1. Put stable task constraints and authoritative files first.
2. Load only the code and documentation needed for the next decision.
3. Prefer search and targeted reads over whole-tree ingestion.
4. Bound tool output; return paths, errors, and decisive excerpts rather than
   unfiltered logs.
5. Keep the enabled tool set small. Tool descriptions and MCP schemas also
   consume context and increase the action surface.
6. Reserve enough space for implementation, tool results, and a final check.
7. Treat summaries and compaction as lossy; re-open exact constraints and files
   before consequential edits.

**Fact.** Pi explicitly describes compaction as lossy and summarizes older
context ([Pi compaction](https://pi.dev/docs/latest/compaction)). Claude Code
also documents automatic clearing/summarization of older material
([context window](https://code.claude.com/docs/en/context-window)). Exact
thresholds and reinjection behavior are product-specific.

Set run budgets as well: maximum turns, wall time, tool calls, child agents, and
cost or tokens where observable. A budget must have a graceful stop rule that
returns partial evidence and unresolved questions rather than rushing an
unverified change.

## Choose the smallest execution topology

| Topology | Prefer it when | Main cost/control issue |
|---|---|---|
| **Single agent** | Work is tightly coupled; one context can inspect, edit, and verify it | Context growth and serial latency |
| **Subagent delegation** | Research or write sets are independent and outputs can be summarized | Multiplied cost, lost parent context, merge conflicts |
| **Code-driven workflow** | Fan-out is regular and sequencing, retries, or aggregation should be deterministic | You own schemas, failure handling, and runtime |
| **Task graph** | Dependencies, resumability, auditability, or cross-session work are first-class | State, scheduling, cancellation, and recovery complexity |

Default to a single agent. Delegate only a bounded question with an explicit
return contract. For parallel writers, give each an isolated file set or
worktree; a worktree prevents checkout collisions but is not a process,
credential, or network sandbox. Have one owner integrate and run the full
verification suite.

Use code-driven workflows when code can more cheaply and reliably control the
fan-out. Use a durable graph when nodes need dependency tracking, retry, resume,
or human gates. “More agents” is not itself an outcome.

## Verify actions and artifacts

Verification belongs inside the work plan, not after the confidence statement.
For code or configuration changes:

- inspect the diff and unexpected files;
- run the narrow test first, then the relevant broader suite;
- run formatter, linter, type checker, schema validation, and docs link/build
  checks that apply;
- test failure paths, denied permissions, cancellation, and restart/resume where
  relevant;
- compare generated/runtime state with the reviewed source; and
- report commands, results, skipped checks, and remaining uncertainty.

For research claims, verify the exact product surface and immutable snapshot.
Separate release-tag facts from observations on `main`, `dev`, nightly, or live
documentation. When first-party sources conflict, publish “conflicting” or
“undetermined”; do not average them into certainty.

`pia` users should review status and runtime drift before forcing an apply. See
[Combos](../guides/combos.md),
[Troubleshooting](../guides/troubleshooting.md), and
[Sessions and handoff](../guides/sessions-and-handoff.md).

## Separate trust, permission, and confinement

These controls answer different questions:

| Control | Question |
|---|---|
| Project/folder trust | May repository instructions, settings, or executable extensions load? |
| Permission/approval | May this requested action proceed? |
| Sandbox | What can a named process/tool technically access? |
| Worktree | Which checkout receives filesystem edits? |
| Container/VM | What outer OS, credential, process, and network boundary applies? |

Never summarize them as a generic “safe mode.” An approval prompt is not process
isolation; read-only planning may still read secrets or reach a provider; and a
shell sandbox may not cover built-in file tools, MCP servers, extensions,
browsers, sockets, or credentials.

**Fact.** Pi’s project trust gates project resources, while Pi still runs with
the invoking account’s authority and recommends an OS-backed boundary for
untrusted work ([Pi security](https://pi.dev/docs/latest/security)). Claude Code
states that permissions are enforced by the harness
([permissions](https://code.claude.com/docs/en/permissions)) and scopes its Bash
sandbox separately from other tools
([sandboxing](https://code.claude.com/docs/en/sandboxing)). Codex likewise
documents sandbox policy and approval policy as independent controls
([approvals and security](https://learn.chatgpt.com/docs/agent-approvals-security)).

Start with least privilege: disposable workspace, minimal mounts, no ambient
production credentials, restricted egress, and explicit write/execute approval.
Fail closed when approval is unavailable. Increase authority for a named task,
then remove it. `pia` synchronizes and launches configurations; it is not an
execution sandbox. See [Security and data boundaries](../concepts/security-and-data-boundaries.md).

## Review extensions and MCP as a supply chain

Extensions, plugins, hooks, Skills with executable helpers, custom tools, and
MCP servers can cross the same trust boundaries as ordinary dependencies—or
wider ones. Before enabling one:

1. Confirm canonical owner, license, source, release/commit, and maintenance
   channel; do not infer trust from a marketplace listing.
2. Inspect package manifests, transitive dependencies, install scripts,
   downloaded binaries, update behavior, and integrity/lockfile support.
3. Pin a reviewed version or commit and record how rollback works.
4. Enumerate executable entry points, tool names, hooks, prompts/resources,
   environment variables, filesystem access, network destinations, and
   credential flow.
5. Check default enablement, approval rules, namespace collisions, and whether a
   custom tool can shadow a built-in.
6. Install and test in a disposable profile/container with synthetic credentials.
7. Re-review diffs before updates and remove stale grants/configuration.

MCP is a protocol boundary, not a sandbox or endorsement. A local stdio server
is a process you chose to execute; a remote server adds authentication, network,
and data-disclosure boundaries. Tool allowlists reduce exposure but do not prove
that a server’s implementation is safe. DeepSeek Harness, for example, documents
that its stdio MCP command is trusted executable code outside the agent sandbox
([MCP client at `dsh-v0.1.2-alpha.2`](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/packages/mcp/mcp-client/README.md),
[CLI trust warning](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/apps/cli/reference/README.md)).
Pi Extensions run with full system access. They can mutate outgoing provider
headers/payloads and observe response status/normalized headers, but the response
hook does not expose or rewrite the streamed body; they can also intercept tools
and context ([Pi Extensions](https://pi.dev/docs/latest/extensions)).

**Inference.** Review should follow effective authority, not branding: a small
adapter with shell, network, and credential access deserves more scrutiny than a
large prompt-only package.

## Before an unattended run

- Pin the combo and upstream versions you actually tested.
- Start from a reviewable diff and recoverable Git state.
- Define allowed paths, network, credentials, tools, and maximum spend/time.
- Isolate independent writers; serialize overlapping edits.
- Define success, failure, cancellation, and partial-result handling.
- Require tests or another external verifier before merge/deploy.
- Preserve an audit trail without preserving secrets.
- Know how to stop the loop and revoke credentials.

**Open question.** If the product docs do not specify child-agent inheritance,
headless approval behavior, extension authority, or cloud data flow, treat that
as an unresolved deployment condition—not as a permissive default.

For product-specific surface notes, use the
[coding-agent landscape](coding-agents/index.md). For the narrower Pi/OMP design
context, use the [ecosystem index](ecosystem/index.md); for `pia` ownership and
state, return to [Architecture](../concepts/architecture.md).

## Primary sources

- [Pi security](https://pi.dev/docs/latest/security)
- [Pi compaction](https://pi.dev/docs/latest/compaction)
- [Pi Extensions](https://pi.dev/docs/latest/extensions)
- [Claude Code permissions](https://code.claude.com/docs/en/permissions)
- [Claude Code sandboxing](https://code.claude.com/docs/en/sandboxing)
- [Claude Code context window](https://code.claude.com/docs/en/context-window)
- [Codex approvals and security](https://learn.chatgpt.com/docs/agent-approvals-security)
- [DeepSeek Harness MCP client at `dsh-v0.1.2-alpha.2`](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/packages/mcp/mcp-client/README.md)
