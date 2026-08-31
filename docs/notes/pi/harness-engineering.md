---
kind: engineering-note
status: reviewed
as_of: 2026-08-31
last_verified: 2026-08-31
upstreams:
  - https://pi.dev/docs/latest/usage
  - https://pi.dev/docs/latest/security
  - https://pi.dev/docs/latest/extensions
  - https://pi.dev/docs/latest/skills
  - https://pi.dev/docs/latest/packages
  - https://pi.dev/docs/latest/sessions
  - https://pi.dev/docs/latest/session-format
  - https://pi.dev/docs/latest/compaction
  - https://pi.dev/docs/latest/sdk
  - https://pi.dev/docs/latest/json
  - https://pi.dev/docs/latest/rpc
  - https://pi.dev/docs/latest/providers
  - https://pi.dev/docs/latest/environment-variables
  - https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/src/core/auth-storage.ts
  - https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/src/core/telemetry.ts
  - https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/src/core/provider-attribution.ts
  - https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/src/modes/interactive/session-share.ts
  - https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/src/modes/interactive/interactive-mode.ts
  - https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/docs/settings.md
  - https://github.com/earendil-works/pi/blob/853a80d26c90a14c1886f0ebb8ffaae133ca2185/packages/protocol/README.md
  - https://github.com/earendil-works/pi/blob/853a80d26c90a14c1886f0ebb8ffaae133ca2185/packages/server/README.md
  - https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/examples/extensions/subagent/README.md
  - https://github.com/earendil-works/pi/security/advisories/GHSA-7v5m-pr3q-6453
  - https://github.com/earendil-works/pi/security/advisories/GHSA-r95r-rj6r-c39x
  - https://github.com/earendil-works/pi/security/advisories/GHSA-jfgx-wxx8-mp94
  - https://github.com/earendil-works/pi/security/advisories/GHSA-mqxh-6gq7-558m
confidence: high
---

# Pi harness engineering

This page examines Pi as an engineerable harness at the v0.84.4 release snapshot,
with explicitly marked observations of repository `main` as checked on
2026-08-31. It describes mechanisms and boundaries, not an independent security
audit.

## Instruction and resource discovery

At startup, Pi loads global `~/.pi/agent/AGENTS.md`, then walks the current
working directory and its ancestors for `AGENTS.md` or `CLAUDE.md`. Within one
directory, `AGENTS.override.md` replaces that directory’s regular context file;
files discovered in other directories still layer. `SYSTEM.md` replaces the
default system prompt and `APPEND_SYSTEM.md` appends to it
([usage](https://pi.dev/docs/latest/usage)).

Project trust gates selected project resources: settings, Extensions, skills,
prompt templates, themes, package resources, and system-prompt files. It does
**not** gate `AGENTS.override.md`, `AGENTS.md`, or `CLAUDE.md` under the documented
current behavior unless context loading is disabled
([security](https://pi.dev/docs/latest/security)). Repository text and command
output can therefore influence the model before protected executable resources
are approved.

> **Fact — trust is not authority.** Project trust controls input/resource
> loading. It neither approves each model-requested tool call nor confines tools
> to the repository. Noninteractive print, JSON, and RPC runs cannot open a trust
> prompt; they apply saved trust, `defaultProjectTrust`, or the run’s
> `--approve`/`--no-approve` decision.

## Extensions, skills, and Pi packages

An **Extension** is a JavaScript or TypeScript module whose factory receives
`ExtensionAPI`. It can register tools, commands, shortcuts, flags, providers,
renderers, and UI, and handle input, context, tool-call/result, compaction,
session, and shell events. At the provider boundary, an Extension may mutate
outgoing headers or replace an outgoing payload. The
`after_provider_response` event observes HTTP status and normalized response
headers before stream consumption; it does **not** expose or rewrite the streamed
response body ([Extensions](https://pi.dev/docs/latest/extensions)).

Extensions execute as the invoking user. Cleanup is resource-dependent: an
Extension that starts processes, sockets, watchers, or timers should register
idempotent shutdown cleanup, while a static registrar may have nothing to clean
up.

A **skill** is a `SKILL.md` resource. Pi discovers skills globally, in trusted
project `.pi/skills` and `.agents/skills` trees, through packages/settings, and
through `--skill`. Name and description can remain in the system prompt while the
model is instructed to read full instructions and supporting files when relevant.
That is progressive disclosure, not a guarantee that the model will invoke the
skill; `/skill:name` forces invocation, and `disable-model-invocation` can make a
skill user-only ([skills](https://pi.dev/docs/latest/skills)).

A **Pi package** distributes Extensions, skills, prompt templates, and themes via
npm, Git, or local paths. It is not the same category as a monorepo package such
as `@earendil-works/pi-ai`. Extensions/packages can execute host code, and skills
can include helpers or direct arbitrary tool actions, so installation is a code
trust decision ([packages](https://pi.dev/docs/latest/packages)).

## Sessions, sharing, and compaction

Sessions normally live as JSONL under `~/.pi/agent/sessions/`, grouped by working
directory. Format v3 entries use `id`/`parentId` relationships to represent a
logical tree. `/tree` moves among branches in one file; `/fork` and `/clone`
create another session file with lineage. `--no-session` avoids normal session
persistence, but does not undo provider transmissions, shell effects, Extension
behavior, or explicit exports
([sessions](https://pi.dev/docs/latest/sessions),
[format](https://pi.dev/docs/latest/session-format)).

“Append-only” describes the logical session model, not immutable storage:
migration and selected create/import paths can rewrite a JSONL file. Nor is
compaction deletion. Automatic compaction defaults to a 16,384-token response
reserve and retains roughly the newest 20,000 tokens; it appends a lossy,
model-generated summary for future requests while older entries remain in the
session history. Summary input truncates serialized tool results to 2,000
characters ([compaction](https://pi.dev/docs/latest/compaction)).

> **Observation — `/share` documentation conflict.** In v0.84.4 source,
> `/share` first attempts an authenticated Radius artifact upload with
> `visibility=organization`; its JSONL export includes the current system prompt
> and active tool names, descriptions, and schemas. Only when a Radius
> provider/token is unavailable does it fall back to a non-public GitHub Gist
> ([tagged implementation](https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/src/modes/interactive/session-share.ts)).
> The live sessions prose’s unconditional Gist description is stale. “Non-public”
> is not a confidentiality guarantee, and reviewed Pi sources do not define
> Radius/Gist recipient access, revocation, retention, or redaction guarantees.

## SDK, JSON, RPC, and remote protocol

The SDK exported by `@earendil-works/pi-coding-agent` exposes `AgentSession` plus
runtime, model/auth, settings, resource-loading, and session-management objects.
Embedders can inject tools and runtime-only credentials without persisting them
([SDK](https://pi.dev/docs/latest/sdk)). The public page does not state a
compatibility guarantee for every low-level class.

The integration surfaces are distinct:

- `--mode json` emits newline-delimited lifecycle and streaming events for a run
  ([JSON](https://pi.dev/docs/latest/json)).
- `--mode rpc` is bidirectional LF-delimited JSON over a local child process’s
  stdin/stdout, with commands for prompting, queues, abort, shell execution,
  model/thinking changes, compaction, and sessions
  ([RPC](https://pi.dev/docs/latest/rpc)).
- As observed on `main`, the separate remote stack uses four-byte-length-prefixed,
  definite-length CBOR. `pi-protocol` gives no compatibility promise and
  `pi-server` is explicitly experimental
  ([protocol](https://github.com/earendil-works/pi/blob/853a80d26c90a14c1886f0ebb8ffaae133ca2185/packages/protocol/README.md),
  [server](https://github.com/earendil-works/pi/blob/853a80d26c90a14c1886f0ebb8ffaae133ca2185/packages/server/README.md)).

> **Inference.** The RPC page documents local subprocess JSONL but is silent on
> authentication, authorization, encryption, and sandboxing. That silence means
> the protocol documents no such mechanisms; it does not prove that every host
> integration around RPC lacks them. By contrast, the experimental remote server
> docs explicitly assign client authentication/authorization to the chosen
> transport.

## Authority, credentials, and telemetry

Pi intentionally has no built-in sandbox and runs with the launching account’s
permissions. First-party guidance recommends an OS-backed container, VM,
micro-VM, remote sandbox, or policy-controlled sandbox for untrusted or unattended
work ([security](https://pi.dev/docs/latest/security)). Example permission gates
and sandbox wrappers are not core policy: the example gate covers only selected
Bash patterns, while the example sandbox wraps Bash/user-shell paths on macOS and
Linux and can fall back to ordinary Bash when disabled, unsupported, uninitialized,
or initialization fails.

Credential resolution is `--api-key`, `~/.pi/agent/auth.json`, environment, then
custom-provider configuration. Newly created POSIX directories/files use
`0700`/`0600`; existing modes and administrator ACLs are not tightened
([auth storage, v0.84.4](https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/src/core/auth-storage.ts)).
Login paths also differ in entitlement and billing, so provider authentication
must not be summarized as a uniform subscription benefit
([providers](https://pi.dev/docs/latest/providers)).

As documented in the [v0.84.4 settings reference](https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/docs/settings.md), `enableInstallTelemetry` defaults on. A fresh install or
detected update in a new interactive session sends an asynchronous GET to
`pi.dev` carrying the version and User-Agent, with no request body
([interactive trigger](https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/src/modes/interactive/interactive-mode.ts)).
`PI_TELEMETRY` or the setting can disable it; `PI_OFFLINE` suppresses this and
other startup network work. The same gate controls default Pi attribution headers
for OpenRouter, NVIDIA NIM, and Cloudflare, while OpenCode session headers are a
separate path. The reviewed sources do not state server-side retention,
aggregation, or deletion for the install endpoint
([telemetry gate, v0.84.4](https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/src/core/telemetry.ts),
[attribution implementation, v0.84.4](https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/src/core/provider-attribution.ts),
[environment variables](https://pi.dev/docs/latest/environment-variables)).
This CLI behavior is distinct from `@earendil-works/pi-telemetry`, the
vendor-neutral contracts package with no default exporter.

### Advisory scope

Four public repository advisories were visible at the cutoff: HTML-export URL
sanitization, an `auth.json` write race, predictable temporary Extension paths,
and unapproved project Extensions. The first three name `0.78.1` as the
current-scope fix for `@earendil-works/pi-coding-agent`; the project-trust issue
names `0.79.0`. Deprecated `@mariozechner/pi-coding-agent` ranges have no patched
old-scope release, so migration is required rather than assuming an old-package
patch. The high-severity temporary-path case also required a vulnerable version,
shared writable temporary storage, another local user, and execution of an npm or
Git Extension; its impact was code execution as the victim user, not an automatic
root or remote compromise
([HTML-export advisory](https://github.com/earendil-works/pi/security/advisories/GHSA-7v5m-pr3q-6453),
[`auth.json` advisory](https://github.com/earendil-works/pi/security/advisories/GHSA-r95r-rj6r-c39x),
[temporary-path advisory](https://github.com/earendil-works/pi/security/advisories/GHSA-jfgx-wxx8-mp94),
[trust advisory](https://github.com/earendil-works/pi/security/advisories/GHSA-mqxh-6gq7-558m)).
Being newer than listed fixes is not a general security guarantee.

## Optional subagents and the evidence limit

Subagents are not built into Pi core. The official optional example launches
separate `pi` subprocesses from Markdown agent definitions, giving them separate
LLM context windows. Its limits—eight parallel tasks, four concurrent workers,
and 50 KiB returned output per task—belong to that example, not to Pi or all
third-party orchestrators
([v0.84.4 example](https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/examples/extensions/subagent/README.md)).
A separate context window is not OS, filesystem, credential, network, user, or
sandbox isolation.

> **Opinion — comparison discipline.** Pi demonstrates unusually broad
> composability for a small core, but extensibility alone does not establish
> correctness, reliability, safety, latency, token efficiency, or coding quality.
> No common first-party benchmark in the reviewed evidence supports naming Pi—or
> another harness—a benchmark winner.

## Primary sources

- [Security and project trust](https://pi.dev/docs/latest/security)
- [Extensions](https://pi.dev/docs/latest/extensions), [skills](https://pi.dev/docs/latest/skills), and [Pi packages](https://pi.dev/docs/latest/packages)
- [Sessions](https://pi.dev/docs/latest/sessions), [session format](https://pi.dev/docs/latest/session-format), and [compaction](https://pi.dev/docs/latest/compaction)
- [SDK](https://pi.dev/docs/latest/sdk), [JSON mode](https://pi.dev/docs/latest/json), and [RPC mode](https://pi.dev/docs/latest/rpc)
- [v0.84.4 `/share` implementation](https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/src/modes/interactive/session-share.ts)
- [v0.84.4 optional subagent example](https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/examples/extensions/subagent/README.md)
