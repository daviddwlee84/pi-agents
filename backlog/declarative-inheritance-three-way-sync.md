# Evaluate declarative combo inheritance

**Status**: P?
**Effort**: M
**Related**: `TODO.md` · `docs/concepts/architecture.md` · `docs/guides/combos.md`

## Context

Deferred on 2026-08-30 in favor of complete copied configs with lineage
metadata. Inheritance looks attractive for `base -> language -> domain`
families, but defining merge, deletion, ordering, validation, and conflict rules
before real usage would add a second configuration language without evidence it
is needed.

## Current findings

- `pia derive` copies a complete parent and records `derivedFrom` plus a parent
  digest. Parent changes warn; the child never changes until a human reviews it.
- `pia diff --parent` and `pia lineage --ack` provide a deliberately manual
  update loop with no hidden launch-time composition.
- OMP has native layers, while Pi and individual resource types expose
  different composition behavior. A wrapper-level merge could therefore be
  surprising even if it works for simple settings objects.
- Three-way sync could preserve child edits better than re-copying, but needs a
  durable base snapshot and precise treatment of arrays, renames, deletes,
  executable modes, and conflicts.

## Options to compare

| Option | Benefit | Cost/risk |
|---|---|---|
| Keep copy + digest acknowledgement | Explicit, portable, easy to debug | Repeated manual updates |
| Declarative `extends` materialised at apply | Compact child definitions | Merge semantics become a public API |
| Three-way sync command | Preserves independent child edits | Complex conflict/base storage and recovery |

## Open questions

- How often do parent changes need to propagate, and how many files are
  repeatedly copied in practice?
- Are conflicts mostly structured settings, or arbitrary prompts, skills, and
  executable assets?
- Should inheritance be engine-neutral or defer to each harness's native
  mechanisms?
- Can every effective combo still be inspected, exported, and reproduced
  without running an opaque merge?

## Exit criteria

- At least three meaningful derived combos and two parent-update events have
  been maintained with the copy workflow.
- The maintenance cost and conflict types are recorded with concrete examples.
- A decision note specifies merge/delete/array/mode/conflict behavior for any
  proposed alternative and includes migration/rollback steps.
- If complexity is justified, a throwaway prototype proves deterministic
  materialisation and conflict reporting before changing the public schema.

## Decision

2026-08-30: use complete copies and digest acknowledgements now. Do not add
declarative inheritance or three-way sync until the exit criteria show a real
maintenance problem.
