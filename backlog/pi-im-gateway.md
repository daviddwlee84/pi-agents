# Evaluate an external Pi IM gateway

**Status**: P?
**Effort**: L
**Related**: `TODO.md` · `docs/ecosystem.md` · `docs/architecture.md` · `docs/combos.md`

## Context

Research completed on 2026-08-31 against Pi 0.84.4. The question is
whether remote messaging should become part of `pia`, a Pi combo, or remain an
external integration.

`pia` is currently a foreground, dependency-free Pi/OMP configuration launcher.
It can mechanically start Pi RPC with:

```sh
pia run pi/base -- --mode rpc
```

The existing passthrough in `src/cli.ts` and `src/harness.ts` safely applies the
combo and supplies its private session directory. `src/process.ts` then launches
one child with inherited stdio and returns only its exit code. This is a useful
process boundary for an external supervisor, but it is not an authenticated
network API, a multi-session scheduler, or a durable gateway.

The immediate decision is therefore **docs-first**. Keep `pia` core
transport-neutral, record the intended context contract and evidence, then test
an existing project outside this repository before committing any package,
extension, or combo.

All candidate assessments below are **source-reviewed, not runtime-verified**,
unless a row explicitly says otherwise. A permissive version range or the
continued presence of an API does not prove Pi 0.84.4 compatibility.

## Selected context model

Use a **Pi-authoritative session router**, not an IM-history mirror.

### Sources of truth

| Domain | Authority | Consequence |
|---|---|---|
| Native message identity, sender, revision, deletion, membership, and attachment availability | IM provider | Do not infer current IM state from a Pi transcript. |
| Model-visible conversation, tool history, branches, and compaction | Pi session | Do not replay the surrounding room history on each prompt. |
| Admission, project/session binding, execution lease, queue, approvals, cursors, and delivery receipts | Gateway state | These need durable service state outside a combo. |
| Repository and tool side effects | Workspace, filesystem, and Git | Editing or deleting an IM message cannot undo an executed action. |

Every admitted IM invocation is projected into exactly one selected Pi session.
Later turns continue from that Pi session rather than reconstructing context from
the IM timeline.

A canonical transport key must use stable IDs: provider, bot
account/installation, tenant or equivalent, conversation ID, and an optional
thread/topic/subconversation ID. Display names, channel titles, usernames, and
mutable topic labels are not identity keys. A binding additionally selects an
approved project alias, Pi combo, canonical working directory, tool policy, and
current Pi session.

### Thread and flat-room routing

Discord threads provide a convenient visible task boundary, but the portable
contract cannot assume they exist. For a flat room, resolve a message in this
order:

1. A reply to a known bot output uses the durable outbound-message-to-session
   mapping.
2. An authenticated gateway command names an authorized session handle.
3. A unique active binding for the conversation may be used.
4. If zero or multiple candidates remain, reject the message as ambiguous and
   require an explicit `/new`, `/resume`, or `/bind`.

A reply edge is a routing hint, not automatically a new conversation. Quoted
text is untrusted data, never authenticated control syntax. If referenced text
is needed and is not already in Pi history, include only that explicit, bounded
reference with its provider message ID and actor attribution; do not recursively
fetch a reply chain or ambient room window.

### Ordering and context lifetime

- Use one durable FIFO execution lane and one writable owner per **Pi session**,
  not merely per room. Two rooms bound to one session still share one lane.
- Ordinary messages arriving while work is active become later turns. Steering
  must be an explicit, authorized control rather than an implicit consequence
  of arrival time.
- Treat Pi's `agent_settled` event as the terminal boundary after retries,
  compaction recovery, and queued continuations; `agent_end` alone is not final.
- Let Pi own normal context-window compaction. Do not maintain a second gateway
  summary of the same accepted conversation.
- Before Pi submission, a trustworthy edit may replace a pending job. After
  submission, edits and deletions become corrections or tombstones; they do not
  mutate an earlier Pi entry or reverse tool effects.
- Default DMs to a distinct binding per provider account and peer. Shared rooms
  may share a session only for mutually trusted collaborators, with every turn
  attributed to its authenticated actor.

The router still needs a small durable control plane. At minimum it must retain
bindings, inbound provider IDs and job states, per-session ownership, the
original actor and response route, Pi entry/leaf cursors, pending approvals, and
outbound message/chunk receipts. It does not need a complete room transcript.

## Pi integration surfaces

| Surface | Appropriate use | Boundary |
|---|---|---|
| Pi extension | Foreground single-session remote control, policy hooks, tool interception, and approval UI | Session-scoped; long-lived resources must start/stop with session lifecycle; runs with the host user's permissions. |
| `AgentSession` / `AgentSessionRuntime` SDK | Preferred TypeScript embedding surface for a future companion service | The host owns admission, trust, disposal, replacement rebinding, queues, persistence, and multi-session coordination. |
| JSONL RPC over stdin/stdout | Process-isolated worker controlled by another service | One active replaceable runtime; no network listener, authentication, global scheduler, or documented multi-process JSONL writer safety. |
| Experimental CBOR protocol/client/server | Possible future multi-session substrate | No compatibility guarantee, no bundled network transport, and no turnkey coding-agent service today. |
| Raw session JSONL mutation | Diagnostics and migration only | Do not use as a live event bus or concurrent writer. |

Pi project trust only controls project resource loading. It is not tool approval
or a sandbox. Pi tools and extensions run as the launching OS user; a remote
identity that may drive them must therefore be treated as a machine-access
credential unless a separately verified OS/VM boundary limits that authority.

## Operational baseline

A resident production gateway would have to own all of the following outside
`pia`:

- deny-by-default account, tenant, guild, channel/thread/topic, actor, and admin
  admission;
- project and session binding, one-writer fencing, per-session queues, and
  bounded global concurrency;
- provider event cursors, durable deduplication, accepted/active/uncertain job
  states, and an outbound receipt or outbox strategy;
- restart reconciliation without concurrently mutating one Pi JSONL file;
- approval requests bound to actor, session, turn, tool, arguments, project,
  generation, and expiry, with timeout/disconnect failing closed;
- attachment type/size/path controls, temporary owner-only storage, retention,
  and safe handling of unavailable or expired media;
- credentials and mutable state outside Git-managed combo trees, with a minimal
  environment and redacted logs;
- functional health checks, bounded reconnect/backoff, process supervision,
  resource limits, backup/migration, reproducible deployment, and rollback.

These criteria were informed by a managed Kimaki/OpenCode deployment review and
by the public [Kimaki](https://github.com/remorses/kimaki) architecture. They are
requirements for any comparable production claim, not claims that upstream
Kimaki or an existing Pi candidate implements every item.

End-to-end exactly-once execution is not realistic across an IM provider, a
gateway database, Pi JSONL, filesystem side effects, and outbound APIs. A
truthful design should promise durable admission and reconciliation where
implemented, expose an `uncertain` outcome when it cannot prove completion, and
state the bounded circumstances in which duplicate execution or delivery may
occur.

## Candidate snapshot

### Shortlist

| Candidate | Observed fit | Source-reviewed gaps | Current decision |
|---|---|---|---|
| [`@zylab/pirelay@0.10.0`](https://github.com/zikolach/pirelay/releases/tag/v0.10.0) | Pi extension plus local broker; exact requester/conversation/thread binding; multiple live Pi sessions; pairing, progress, files, and optional remote approval gates; MIT release and substantial tests | CI/lockfile target Pi 0.73.1 rather than 0.84.4; host authority remains; approval coverage is opt-in; state rewrite is locked but not fully atomic; prompt queues and uniform ingress dedup are not durable | **First external spike** for the selected session-router model |
| [`earendil-works/pi-chat` at `9adbd29`](https://github.com/earendil-works/pi-chat/tree/9adbd29b40ee27ff1decf0fc87cbe180b40924f5) | Same organization as Pi and linked from Pi's README; Discord/Telegram; one worker and Gondolin micro-VM per configured conversation; persistent workspace and channel log | Do not infer an official support contract; current Discord mapping is channel-level, not thread-level; pending jobs are memory-only; open outbound network; QEMU/tmux footprint; no release/test/service unit; legacy Pi package scope and no 0.84.4 run; `LICENSE`/package say Apache-2.0 while README says MIT | Test second **only when per-conversation VM isolation is required** |
| [`TelePi` at `de6369e`](https://github.com/benedict2310/TelePi/tree/de6369e7e202e737498025d5f7ad5bfa35e86fce) | Telegram-focused standalone SDK daemon; per-chat/topic sessions, streaming, images/voice, dialogs, handoff, launchd/systemd, and current source near Pi 0.84.4 | Published v0.4.2 is materially stale; exact 0.84.4 not tested; chat/topic-to-session mapping and busy state are memory-only; no durable ingress cursor/queue or built-in tool gate | Consider only for a **Telegram-first** requirement, using pinned current source |

A shared lifecycle blocker applies to all three pinned shortlist entries: their
source finalizes responses or job state from nonterminal `agent_end`, while Pi
0.84.4 may still retry, recover from compaction, or process queued work before
`agent_settled`. A spike must provide a version-checked patch or demonstrate the
settled boundary before the candidate can pass the selected router gate.

### Useful references, not adoption candidates

| Project | Reusable lesson | Reason not to adopt now |
|---|---|---|
| [`pi-messenger-bridge` at `8b0c1da`](https://github.com/tintinweb/pi-messenger-bridge/tree/8b0c1da19c930225b15ec971f9225241a82b381d) | Small Pi extension and broad Telegram/WhatsApp/Slack/Discord/Matrix transport adapters | Every transport controls one active Pi session; one mutable pending reply destination is unsafe under concurrent senders; no durable routing, queue, dedup, attachments, or approval flow |
| [`Piscord` v1.7.0](https://github.com/Crokily/pi-discord-gateway/releases/tag/v1.7.0) | SQLite ingress queue, per-channel serialization, global concurrency, service setup, and retention | Confirmed broken by Pi 0.83/0.84 API changes; channel rather than actor admission; DMs can auto-register; no explicit thread creation or parent/thread binding, while admitted thread messages become separate channel-ID sessions; no streaming or approval gate; replay and outbound failure semantics can duplicate or lose work |
| [`notdezzi/pi-discord-bridge` at `14c2572`](https://github.com/notdezzi/pi-discord-bridge/tree/14c2572b00b319c255e8c2036ee69f1618ac5470) | Desired project-channel to Pi-session-thread shape and direct extension streaming | Slash-command authorization bypass, shared project-channel fan-out, optional unauthenticated launcher, no durable queue, license conflict, and no tests or GitHub Releases; npm 1.0.1 exists with unresolved source provenance |
| [`tasercake/pi-connect` at `9982be6`](https://github.com/tasercake/pi-connect/tree/9982be694f547e4bbb702958f208ad6476498d8e) | Broad transport normalization, persistent RPC workers, crash `outcome-unknown` semantics, and optional Unix-user separation | No reliable license grant file, misleading npm name collision, Pi approval is not implemented, incompatible approval/yolo behavior, volatile queues, and no exact 0.84.4 proof |
| [`Dwsy/pi-gateway` at `953b1b0`](https://github.com/Dwsy/pi-gateway/tree/953b1b0c857fdab22a39247320b891d8bde9e79c) | Deterministic Discord-thread/Telegram-topic session keys, worker pool, and bounded queues | Treats nonterminal `agent_end` as completion, auto-confirms unattended dialogs, has a configured but unenforced sandbox, and lacks current releases/test CI/durable queues |

Architecture comparators worth revisiting only after a concrete candidate fails a
documented gate:

- [remote-pi](https://github.com/jacobaraujo7/remote_pi) for device identity,
  keyring storage, relay trust disclosure, Unix-socket leadership, and service
  supervision;
- [pi-agent-web](https://github.com/leon-zym/pi-agent-web) for per-session process
  generations, controller leases, fencing, snapshot resynchronization, and exact
  Pi-version gates;
- [pi-rpc-bridge](https://github.com/CaptCanadaMan/pi-rpc-bridge) for a minimal
  loopback/private-network authentication boundary around one RPC process.

The reviewed [`@gamalan/pi-gateway` v1.10.1 at `04caf7f`](https://github.com/gamalan/pi-gateway/tree/04caf7fbfae5a237de3f1fccbd2882a7dcfdb4e2)
is not added to the spike order: its one global RPC process/current-channel
model, nonterminal completion handling, open/no-token defaults, missing event
dedup, and license/provenance questions do not fit this contract.

## Non-goals

For the current repository phase:

- no `pia gateway`, `pia serve`, network listener, broker, worker pool, provider
  adapter, service installer, or transport-aware combo schema;
- no full room transcript synchronization, automatic last-N history projection,
  cross-provider identity merge, or IM-native event mirror;
- no raw Pi RPC exposure as a secure public API and no dependency on the
  experimental CBOR stack;
- no Pi/OMP feature-parity promise for a Pi-specific integration;
- no exactly-once, never-lost, never-duplicated, sandbox, E2E-encryption, or
  universal-permission claim;
- no simultaneous local and gateway writers to one Pi session;
- no bot token, pairing secret, transport cursor, mapping database, queue,
  attachment cache, or outbox in a Git-managed combo tree;
- no committed gateway combo until an immutable external candidate passes the
  experimental gate.

## Promotion gates

The gates deliberately distinguish an experiment from a production service.
Failure at a higher tier does not prevent a clearly labelled lower-tier test.

### 1. Documentation decision

- Preserve this dated source review and session-router contract.
- Keep stable product-boundary language in `docs/ecosystem.md`; keep moving
  versions, rankings, and defects here.

### 2. Out-of-tree executable spike

- Name one operator, transport, topology, project-binding policy, concurrency
  target, attachment scope, target OS, and host-authority decision.
- Pin an immutable artifact and verify integrity, license/provenance, package
  scopes, install behavior, state paths, and required binaries.
- Run the real candidate with Pi 0.84.4 in a disposable account or VM and
  isolated `PI_CODING_AGENT_DIR`/`PIA_STATE_HOME`.
- Exercise authorized and unauthorized ingress, destination binding, same-session
  serialization, different-session concurrency, abort/new/resume/compact,
  `agent_settled`, approval allow/deny/timeout, attachments, disconnect, and
  process restart.
- Keep credentials and mutable state outside the repository and record every
  patch as a minimal, version-checked change.

### 3. Pi-only experimental combo

Passing this gate permits a `maturity: experimental` Pi combo without changing
`pia` core or its schema:

- immutable, licensed package/commit pin with an accountable maintainer;
- exact Pi 0.84.4 load and an authorized/unauthorized round trip;
- correct destination under the declared single-session or multi-session
  concurrency model;
- explicit service-state root outside combo source, with no secret in Git;
- no unattended auto-confirm and no authorization bypass for alternate command
  paths;
- documentation that promises only the behavior actually tested and states
  best-effort delivery, no sandbox, no service supervision, and no OMP support;
- dedicated typecheck/runtime coverage for any combo-local extension, because the
  current project TypeScript check does not compile `combos/**`.

### 4. Supported optional adapter

- maintained compatibility CI against the declared Pi versions;
- upgrade and security-response owner;
- authorization, routing, lifecycle, provider-limit, and restart regression
  tests;
- documented state migration, support matrix, failure semantics, and removal
  path.

### 5. Production resident service

- durable provider cursors, ingress uniqueness, queue state machine, outcome
  reconciliation, and transactional/idempotent outbound strategy where possible;
- generation fencing, one authoritative session writer, and crash injection at
  every admission/execution/delivery boundary;
- deny-by-default admission, auditable approvals, bounded media/network inputs,
  credential rotation, environment isolation, and an explicit VM/container/UID
  boundary when chat users must not receive host authority;
- functional transport and Pi health checks, supervised restart/backoff,
  resource limits, log rotation/redaction, database backup/migration, immutable
  or reproducible deployment, atomic activation, rollback, and recovery drills.

## Verification matrix

Runtime cells start as **unverified**. Update them only from a repeatable spike;
do not convert source inference into a pass.

| Candidate/ref | Artifact and license | Pi 0.84.4 load | State-root isolation | Admission | Binding/concurrency | Restart/dedup | Approval | Attachments | Result |
|---|---|---|---|---|---|---|---|---|---|
| Pirelay 0.10.0 | Source-reviewed | Unverified | Unverified | Unverified | Unverified | Unverified | Unverified | Unverified | First spike |
| pi-chat `9adbd29` | License conflict recorded | Unverified | Unverified | Unverified | Unverified | Unverified | N/A until designed | Unverified | Conditional on VM requirement |
| TelePi `de6369e` | Source-reviewed | Unverified | Unverified | Unverified | Unverified | Unverified | Unverified | Unverified | Telegram-only fallback |

A spike report should also capture the exact Node/Pi versions, package tarball or
Git digest, mutable files created, environment variables consumed, process tree,
provider event IDs, Pi entry IDs, outbound message IDs, fault-injection point,
and whether the outcome was completed, failed, or uncertain.

## Open questions

- Is the first real deployment Discord, Telegram, or multi-transport?
- Is it a foreground personal remote control or an always-on service?
- Does one trusted operator have host-user authority, or is VM/container/UID
  isolation mandatory?
- What exact channel/thread/topic-to-project policy and concurrency are needed?
- Which attachments and approval interactions are required?
- Who owns upgrades, credentials, provider setup, recovery, and incident response?

## Authoritative sources

- [Pi v0.84.4 release](https://github.com/earendil-works/pi/releases/tag/v0.84.4)
- Pi v0.84.4:
  [extensions](https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/docs/extensions.md),
  [SDK](https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/docs/sdk.md),
  [RPC](https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/docs/rpc.md),
  [sessions](https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/docs/session-format.md),
  [compaction](https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/docs/compaction.md),
  [packages](https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/docs/packages.md),
  and [security](https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/docs/security.md)
- Experimental Pi
  [protocol](https://github.com/earendil-works/pi/blob/v0.84.4/packages/protocol/README.md),
  [client](https://github.com/earendil-works/pi/blob/v0.84.4/packages/client/README.md),
  and [server](https://github.com/earendil-works/pi/blob/v0.84.4/packages/server/README.md)
- [Pi README at v0.84.4](https://github.com/earendil-works/pi/blob/v0.84.4/README.md)
  for its link to the separate pi-chat project
- Candidate source and release links in the tables above
- [Kimaki](https://github.com/remorses/kimaki) as a comparison architecture

## Decision

2026-08-31: remain P?. Document the Pi-authoritative session-router contract and
keep `pia` core unchanged. The next executable step is an out-of-tree,
time-boxed Pirelay 0.10.0 spike against Pi 0.84.4. Test the pinned pi-chat commit
instead only when per-conversation VM isolation is a requirement. If a candidate
passes the smaller experimental gate, adding a Pi-only experimental combo is
consistent with this repository; production gateway obligations remain a
separate, much higher gate.
