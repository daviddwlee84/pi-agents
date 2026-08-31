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

# An editorial engineering lens

This site uses the sequence below to reason about increasing orchestration:

```text
prompt → context → harness / meta-harness → loop → graph
```

!!! important "Editorial lens, not universal chronology"
    This is a design lens for this site, not an upstream taxonomy, a maturity
    ranking, or a claim that the industry evolved in this order. Real systems
    combine stages, skip stages, or move backward to gain predictability. A graph
    is not inherently better than a well-scoped prompt or one agent loop.

## 1. Prompt engineering: specify the transformation

A prompt states the task, constraints, output contract, and evidence expected
from one model interaction. Good prompt engineering removes ambiguity before
adding machinery: define the artifact, prohibited changes, success conditions,
and how uncertainty should be reported.

Use it when the necessary input already fits, no external action is needed, and
the result can be checked directly. Classification, extraction, and a bounded
rewrite often belong here.

**Failure signal.** Repeatedly asking the model to rediscover the same project
facts suggests a context problem, not a need for more prompt prose.

## 2. Context engineering: control what the model can know

Context engineering selects and orders instructions, code, tool results,
conversation history, and retrieved material. It also budgets them. More context
is not automatically better: irrelevant files compete with task evidence, large
tool schemas consume the same finite window, and compaction can lose detail.

Context should have provenance and purpose. Prefer a small authoritative slice,
fetch additional evidence on demand, and keep volatile run state after stable
instructions where the harness permits it.

**Observation.** Harnesses expose context as an explicit engineering surface.
Claude Code documents context from instructions, history, files, tool output,
Skills, and MCP, then clears or summarizes older material
([context and loop](https://code.claude.com/docs/en/how-claude-code-works)).
That is a product-specific mechanism, not a universal retention guarantee.

## 3. Harness engineering: make capability and policy explicit

A harness turns a model call into an operating system for work: provider routing,
tools, instruction discovery, session state, UI, compaction, permissions, and
execution integration. Extension points let teams add policy or domain tools.

Pi deliberately keeps several workflows outside its core and demonstrates plan
mode, permission gates, sandboxed Bash, handoff, and subagents as Extensions or
examples rather than default product guarantees
([Extensions](https://pi.dev/docs/latest/extensions),
[examples](https://github.com/earendil-works/pi/tree/v0.84.4/packages/coding-agent/examples/extensions)).
This makes **core versus composition** part of the architecture.

A meta-harness operates one level out. `pia` selects a complete reviewed combo,
materializes it into private runtime state, establishes the session root, and
launches Pi or OMP. It standardizes configuration lifecycle without claiming to
replace the upstream loop. See [Architecture](../../concepts/architecture.md)
and [Combos](../../guides/combos.md).

## 4. Loop engineering: gather, act, verify, stop

An agent loop feeds model-requested actions back as observations:

```text
inspect → plan enough → act → observe → verify → continue or stop
```

Loop engineering defines more than repetition. It sets tool schemas, approval
points, retry rules, error serialization, cancellation, context pruning,
completion criteria, and a budget. The verification step must be a real action—
for example a test, type check, diff review, or source lookup—not the model’s
statement that work “looks correct.”

A single loop is usually the clearest choice for one tightly coupled change. It
keeps decisions and feedback in one context, but long tool output and repeated
exploration can crowd out the original constraints.

## 5. Graph engineering: expose topology

A graph makes dependencies and fan-out explicit. Nodes may be deterministic
code, model calls, isolated agents, reviews, or human approvals; edges carry
artifacts and control. Parallel nodes are useful only when their work is truly
independent or their write sets are isolated.

There are at least three materially different graph implementations:

- **Subagent delegation:** a parent asks child loops to research or implement
  bounded work, then synthesizes their outputs.
- **Code-driven workflow:** ordinary code owns `parallel`, `pipeline`, retries,
  aggregation, and budgets; agents are workers rather than the scheduler.
- **Durable task graph:** nodes and dependencies persist so work can resume,
  retry, be inspected, and cross process/session boundaries.

Do not call all three “multi-agent.” A child context does not imply peer
messaging, durable state, worktree isolation, or managed cloud execution.

**Fact.** DeepSeek Harness `dsh-v0.1.2-alpha.2` documents model-written
JavaScript workflows with `agent`, `pipeline`, `parallel`, and `phase` in an
API-restricted runtime. Its worker implementation explicitly warns that
`node:vm` is escapable and provides containment rather than a security boundary
([workflow reference](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/docs/subsystems/workflow.md),
[worker warning](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/packages/workflow/workflow-worker-thread/README.md)).
Claude Code documents a separate script-owned dynamic-workflow surface in which
intermediate results stay in script variables
([dynamic workflows](https://code.claude.com/docs/en/workflows)). Gemini CLI’s
experimental tracker exposes a session-scoped dependency DAG
([tracker](https://geminicli.com/docs/tools/tracker/)). These are useful examples,
not evidence of compatible semantics or equivalent maturity.

## Choose the least topology that works

| Need | Start with | Add machinery when… |
|---|---|---|
| One bounded transformation | Prompt | required evidence must be discovered |
| Better grounding | Curated context | external actions or iterative feedback are needed |
| Repeatable tools/policy/state | Harness or meta-harness | work must adapt over several actions |
| One adaptive task | Single loop | context or independent work can be safely split |
| Independent fan-out or dependencies | Workflow/graph | persistence, retries, or cross-session control are required |

**Opinion.** Complexity should earn its place through measured completion rate,
review burden, recoverability, latency, or cost—not through the number of agents
visible in a diagram.

## Engineering consequences

At every step, write down:

- the input and output contract;
- the context and tool budget;
- who controls sequencing—the model, harness, code, or graph scheduler;
- the authority and isolation of each executable node;
- the persistence and cancellation semantics; and
- the verifier that can reject an incorrect result.

For operational guidance, continue with [Best practices](../best-practices.md)
and [Sessions and handoff](../../guides/sessions-and-handoff.md). See the
[coding-agent landscape](../coding-agents/index.md) for surface-scoped examples
and the [Pi harness ecosystem](../ecosystem/index.md) for Pi/OMP constraints.

## Primary sources

- [Pi Extensions](https://pi.dev/docs/latest/extensions)
- [Pi Extension examples](https://github.com/earendil-works/pi/tree/v0.84.4/packages/coding-agent/examples/extensions)
- [DeepSeek Harness workflow at `dsh-v0.1.2-alpha.2`](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/docs/subsystems/workflow.md)
- [How Claude Code works](https://code.claude.com/docs/en/how-claude-code-works)
- [Claude Code dynamic workflows](https://code.claude.com/docs/en/workflows)
- [Gemini CLI task tracker](https://geminicli.com/docs/tools/tracker/)
