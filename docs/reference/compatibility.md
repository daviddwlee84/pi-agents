# Compatibility

This page is a dated statement of what the repository currently tests, not a
guarantee for every later upstream release.

**Snapshot verified by repository configuration: 2026-08-31**

## Runtime and platform matrix

| Area | Current evidence |
|---|---|
| Node runtime | `package.json` requires 22.19.0 or newer |
| Linux | Application checks/tests run on Ubuntu with Node 22 and 24 |
| Windows | Checks and Windows tests run with Node 22 and 24 |
| macOS | Uses the POSIX launcher/path implementation, but has no current macOS CI job |
| Pi | Windows smoke launch installs `@earendil-works/pi-coding-agent@0.84.4` |
| Oh My Pi | Windows smoke launch downloads OMP 18.0.11 and verifies a pinned SHA-256 |

The Windows job launches Pi through `pia.ps1` and OMP through `pia.cmd`, then
compares their version output with direct invocation. Unit tests cover the
wrapper, process resolution, runtime synchronization, combos, sessions,
handoffs, completion, and color behavior on the host platform.

## What the snapshot does not prove

- It is not a cross-platform end-to-end fork or handoff test against real
  upstream conversation histories.
- Session fixtures are synthesized from the known format; they are not a large
  archive of upstream fixture files.
- Linux CI does not install and smoke-launch both harness binaries.
- macOS behavior is not exercised by GitHub Actions.
- A newer Pi or OMP version is not automatically incompatible, but it must be
  checked with `pia doctor`, source tests, and a real smoke launch before the
  compatibility statement is updated.

Implementation-sensitive claims in the session guide use pinned upstream source
links. Recheck those links and formats when either snapshot version changes.

## Windows launcher boundary

For `run`, the PowerShell launcher reconstructs the `--` separator consumed by
PowerShell and preserves literal target arguments and child exit status. That
separator reconstruction is not currently implemented for `fork` or `handoff`;
those forms need additional Windows coverage before the same guarantee applies.
The cmd launcher follows cmd.exe quoting rules and is intended for trusted
interactive input. npm PowerShell shims are launched through a fixed
`PowerShell -File` command without enabling child shell parsing.

## Distribution status

At this snapshot:

- the GitHub repository is private;
- `package.json` has `"private": true`;
- there are no published repository release tags;
- no license file is present.

The documentation therefore describes operation for authorized repository
users. It does not grant public redistribution rights or promise a versioned
support lifecycle.

## Updating this page

When changing an upstream version:

1. update the pinned install/download and digest in `.github/workflows/ci.yml`;
2. run the full Linux and Windows suites;
3. smoke-launch the new binaries through the platform launchers;
4. compare session/profile/config behavior with the parsers and target checks;
5. update the date, versions, source permalinks, and any known limitations here.
