# Reproduce the Codex harness in Pi

**Status**: P?
**Effort**: L
**Related**: `TODO.md` · `docs/combos.md` · `docs/sessions-and-handoff.md`

## Context

Deferred on 2026-08-30 after defining a neutral multi-harness combo manager.
The research should isolate useful Codex harness behaviors and test whether Pi
can reproduce them without turning `pia` into a Codex compatibility layer.

## Current findings

- Combo-local instructions, tools/extensions, launch policy, and isolated state
  give the experiment a clean Pi baseline.
- Likely comparison areas are instruction/skill loading, sandbox and approval
  policy, planning/execution boundaries, compaction, and multi-agent
  collaboration. These are hypotheses, not selected requirements.
- `pia handoff` can preserve a bounded task state between harnesses, enabling
  side-by-side work without sharing incompatible native sessions.
- Exact Codex, Pi, model, permission, and repository state must be captured for
  any result to be meaningful.

## Open questions

- Which outcomes come from the harness rather than model choice or hidden
  service behavior?
- Can Pi express the desired sandbox/approval and instruction precedence with
  supported configuration and extensions?
- What is the smallest representative eval set for coding, review, recovery
  after compaction, and delegated work?
- Which successful behaviors belong in a combo versus a general `pia` feature?

## Exit criteria

- A public-source, versioned feature and behavior matrix.
- Controlled comparisons with matched model, task, permissions, and context.
- A standalone Pi combo prototype for the selected behaviors.
- Repeatable eval notes, known gaps, and an explicit promotion or rejection
  decision.

## Decision

2026-08-30: keep this at P? until neutral combo/session behavior is stable and
there is enough usage to distinguish core needs from one-off imitation.
