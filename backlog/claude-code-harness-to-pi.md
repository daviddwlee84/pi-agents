# Reproduce the Claude Code harness in Pi

**Status**: P?
**Effort**: L
**Related**: `TODO.md` · `docs/combos.md` · `docs/sessions-and-handoff.md`

## Context

Deferred on 2026-08-30 while establishing the basic `pia` combo workflow. The
goal is not to clone Claude Code wholesale; it is to identify observable harness
behaviors that materially improve coding work and reproduce the smallest useful
subset with Pi configurations, packages, skills, or extensions.

## Current findings

- `pia` now provides isolated configs, explicit launch arguments, session
  policy, and redacted handoff, which are enough to create a controlled Pi
  comparison combo.
- Candidate areas include instruction discovery, permissions, hooks, subagent
  workflows, compaction, and tool ergonomics, but no feature has been selected
  or benchmarked yet.
- Research must use public documentation and observable behavior. It must not
  depend on proprietary internals or copy protected prompts.
- Upstream versions move quickly; record exact Claude Code and Pi versions and
  pin source links or fixtures used by every experiment.

## Open questions

- Which Claude Code behaviors measurably improve completion quality, safety, or
  operator control rather than merely changing UI?
- Which behaviors map cleanly to Pi core, and which require a maintained
  extension or package?
- How should approval, hooks, and subagent behavior be evaluated without giving
  the two harnesses different permissions or context?
- Which gaps should remain documented instead of expanding `pia` itself?

## Exit criteria

- A versioned behavior matrix with reproducible observations and public sources.
- A ranked shortlist that explains expected benefit and maintenance cost.
- At least one isolated Pi combo prototype with fixtures or repeatable evals.
- Documented unsupported gaps and a decision to ship, revise, or retire the
  prototype.

## Decision

2026-08-30: keep this at P? until the base combos have been used in real work;
avoid adding Claude-specific abstractions to the core CLI meanwhile.
