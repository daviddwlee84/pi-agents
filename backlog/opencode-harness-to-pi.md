# Reproduce the OpenCode harness in Pi

**Status**: P?
**Effort**: L
**Related**: `TODO.md` · `docs/combos.md` · `docs/ecosystem.md`

## Context

Deferred on 2026-08-30 while the repository first proves a simple Pi/OMP combo
workflow. The objective is to reproduce selected OpenCode harness behavior in a
Pi combo when doing so has a clear operational or learning benefit.

## Current findings

- `pia` can hold an experimental reproduction beside neutral and production
  combos without leaking its runtime state into Git.
- Candidate study areas include provider abstraction, agents/commands,
  permission rules, tool/plugin integration, project instructions, and session
  UX. No candidate is yet approved for implementation.
- OpenCode and Pi terminology may hide materially different semantics; compare
  observable inputs, tool calls, approvals, and outputs rather than matching
  configuration names.
- The comparison must pin both tools and avoid carrying stale facts from a
  prior ecosystem snapshot.

## Open questions

- Which OpenCode behaviors are distinctive enough to reproduce rather than use
  OpenCode directly?
- Can Pi packages/extensions implement them with a small and reviewable config?
- How should provider differences be controlled so they do not dominate the
  harness comparison?
- What ongoing compatibility burden would the reproduction add?

## Exit criteria

- A versioned, source-linked behavior matrix and controlled experiment plan.
- A prioritized subset with explicit value and maintenance estimates.
- A Pi combo prototype plus repeatable tasks or fixtures.
- A documented decision to keep the prototype experimental, promote it, or
  remove it.

## Decision

2026-08-30: remain P?; direct OpenCode use is the baseline alternative, and a Pi
reproduction must demonstrate value beyond familiarity or configuration parity.
