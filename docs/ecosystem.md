# Pi harness ecosystem snapshot

This page records the assumptions behind `pia`, not a permanent verdict on fast
moving upstream projects. The compatibility snapshot reviewed and represented
by the test fixtures is **Pi 0.84.4** and **Oh My Pi 18.0.11**, as of
2026-08-30.

## Upstream Pi

Pi supports a global agent directory, project-local `.pi` configuration, and
the `PI_CODING_AGENT_DIR` override. These primitives are sufficient for `pia`
to launch isolated full configurations, while repo-local settings and resources
can still participate according to Pi's trust and discovery rules. See Pi's
[settings](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/settings.md),
[environment variables](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/environment-variables.md),
and [packages](https://pi.dev/docs/latest/packages) documentation.

Pi does not provide a single stable first-class abstraction that composes all
settings, skills, extensions, package references, prompts, and session policy as
a named inheritable profile. That is why `pia` switches the complete agent
directory and keeps combo inheritance explicit and copy-based.

Two issue pages are easy to misread:

- [#3590, layered config](https://github.com/earendil-works/pi/issues/3590)
- [#7813, multiple settings profiles](https://github.com/earendil-works/pi/issues/7813)

Their closed status is easy to over-interpret, but each timeline contains the
GitHub Actions message that issues from new contributors are auto-closed
pending maintainer review. They are evidence that users asked
for these capabilities, **not** an explicit maintainer roadmap rejection. Any
future design review should re-check upstream rather than preserving either
interpretation as fact.

## Oh My Pi

OMP exposes named profiles through `omp --profile <name>` and has broader
configuration discovery and overlay behavior. A named profile relocates native
configuration and runtime resources, so `pia` uses an OMP profile named
`pia-<combo>` and resolves its actual path with OMP itself. See the upstream
[configuration and profile guide](https://github.com/can1357/oh-my-pi/blob/main/docs/config-usage.md).

OMP's richer configuration system does not remove the need for a repository
contract: different resource types have different discovery rules, runtime
state must still stay out of Git, and a Pi combo should remain understandable
without translating it into OMP concepts. `pia` therefore presents the same
simple combo/source/runtime workflow for both engines and lets OMP own only its
native profile resolution.

## MCP is an extension choice

Do not describe `pi.mcp` as a Pi core package-manifest feature. The manifest
shape discussed in the original research belongs to an adapter/integration,
not upstream Pi's package contract. MCP support for a combo should identify the
specific extension it uses—for example the community
[`pi-mcp-adapter`](https://github.com/nicobailon/pi-mcp-adapter)—and keep that
adapter's configuration inside the combo like any other harness dependency.

This distinction matters for portability: a combo that depends on an adapter
must pin and test that adapter rather than assuming another Pi installation can
interpret an undocumented `pi.mcp` field.

## Why maintain another thin layer?

There are many ready-made harnesses and profile managers. Use one of them when
its opinionated defaults already match the job. This repository is justified
when the goal is to:

- keep experimental, learning, and production combos together;
- switch Pi and OMP through one predictable interface;
- review the exact Git-managed configuration before it reaches runtime;
- keep auth, sessions, packages, and caches private and mutable;
- reproduce selected behaviors from other harnesses without adopting all of
  their machinery.

Research into [Claude Code](../backlog/claude-code-harness-to-pi.md),
[Codex](../backlog/codex-harness-to-pi.md), and
[OpenCode](../backlog/opencode-harness-to-pi.md) is intentionally deferred until
the base workflow has real usage data. Re-check upstream versions, docs, CLI
flags, and session formats before promoting any result to a production combo.
