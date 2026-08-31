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

# Research notes and methodology

These notes examine agentic coding tools as layered systems rather than as a
single product category. The aim is to make design choices for `pia` and its
combos—not to rank vendors or turn documentation counts into a score.

!!! note "Method limit"
    This is a comparison of first-party documentation and pinned first-party
    source, not an independent security audit, behavioral certification, or
    benchmark. Vendor claims about isolation, privacy, reliability, and product
    support remain vendor claims unless a separately described test verifies
    them. No page in this section establishes a benchmark winner.

## Evidence order

Use the strongest available evidence for the claim being made:

1. **`pi-agents` code and tests for `pia` behavior.** Local implementation and
   tests govern what this repository actually does; upstream prose cannot
   override them. Start with [Architecture](../concepts/architecture.md) and
   [Security and data boundaries](../concepts/security-and-data-boundaries.md).
2. **Immutable release or commit evidence.** Prefer a release tag, commit
   permalink, versioned schema, or advisory for shipped behavior. For example,
   Pi `v0.84.4` is an immutable release snapshot, while repository `main` is not
   ([release](https://github.com/earendil-works/pi/releases/tag/v0.84.4)).
3. **Current first-party documentation.** Use it for supported workflows and
   product posture, record the access date, and treat mutable “latest” pages as
   a current observation rather than reproducible release evidence
   ([Pi documentation](https://pi.dev/docs/latest)).
4. **Maintainer discussions.** Issues, pull requests, and discussions can
   explain intent or unresolved behavior. A closed issue, proposal, or comment
   is not automatically a shipped commitment.
5. **Labeled secondary sources.** Use only when they add necessary context, and
   label them as secondary. They cannot establish an upstream default, release
   status, security guarantee, or license.

Legal and data-handling claims require the applicable terms or policy, not a
technical tutorial. Marketing pages can support positioning, not exact defaults.
Source code can support a narrowly labeled implementation observation, not an
unqualified support promise.

## Comparison unit

Every material claim should identify four coordinates:

- the **canonical product**;
- the **surface**—for example CLI, editor, desktop, cloud service, or SDK;
- the **execution location** for the loop and tools; and
- the **release tag, commit, or documentation snapshot** observed.

Shared models, ancestry, protocol support, or a common harness do not transfer
features, licenses, support, or security properties between surfaces. Anthropic,
for example, describes Claude Code as the harness around Claude, with tools,
context management, and an execution environment; that statement does not make
all Claude products or deployment paths equivalent
([Claude Code architecture](https://code.claude.com/docs/en/how-claude-code-works)).
OpenAI likewise distinguishes model reasoning, its open harness, clients, and
managed services ([Codex as a platform](https://developers.openai.com/blog/codex-as-a-platform)).

Use the following publication vocabulary:

| Label | Meaning |
|---|---|
| **Fact** | Directly supported by the cited source at the stated snapshot |
| **Observation** | What documentation, source, or a test showed at that snapshot |
| **Inference** | A reasoned conclusion from cited facts; not an upstream claim |
| **Opinion** | A recommendation or value judgment |
| **Open question** | Evidence is absent, ambiguous, or contradictory |

Feature status also needs a qualifier such as **core**, **optional built-in**,
**first-party example**, **extension**, **preview/experimental**, **unreleased
source**, or **not documented**. Empty evidence never means “no.”

## Handling time and conflict

Release-tag facts and mutable `main`/`dev` observations belong in different
sentences. “Latest non-prerelease” does not imply GA, LTS, or a support window.
When first-party sources conflict, present the conflict and its scope rather
than silently selecting the convenient answer. Recheck volatile model catalogs,
plans, defaults, preview labels, and policy pages before relying on them.

**Observation.** First-party documentation is useful for mapping supported
concepts, but it is uneven across products and surfaces. A controlled local test
can answer a narrow behavioral question; it still does not prove a universal
security or quality conclusion.

## Reading map

- [Model, provider, harness, and agent](paradigms/model-harness-agent.md) defines
  the layers used throughout these notes.
- [An editorial engineering lens](paradigms/engineering-evolution.md) explains
  the prompt → context → harness/meta-harness → loop → graph progression.
- [Best practices](best-practices.md) turns those distinctions into comparison,
  orchestration, verification, and trust checklists.
- [Coding-agent landscape](coding-agents/index.md) is the surface-scoped product
  index; [Pi harness ecosystem](ecosystem/index.md) covers the narrower Pi/OMP
  context behind `pia`.
- The operational path is documented in [Getting started](../getting-started.md),
  [Combos](../guides/combos.md), and
  [Sessions and handoff](../guides/sessions-and-handoff.md).

## Primary sources

- [`pi-agents` repository](https://github.com/daviddwlee84/pi-agents)
- [Pi `v0.84.4` release](https://github.com/earendil-works/pi/releases/tag/v0.84.4)
- [Pi documentation](https://pi.dev/docs/latest)
- [How Claude Code works](https://code.claude.com/docs/en/how-claude-code-works)
- [Codex as a platform](https://developers.openai.com/blog/codex-as-a-platform)
