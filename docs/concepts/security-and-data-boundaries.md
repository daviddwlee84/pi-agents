# Security and data boundaries

`pia` is a synchronizer and launcher, not a sandbox. Its safety contract is to
keep reviewed configuration separate from mutable/private agent state and to
refuse ambiguous writes. The upstream harness, model provider, tools, shell,
network, and operating-system account remain separate trust boundaries.

## What may enter a combo

Only ordinary files below `combos/<engine>/<name>/agent/` are managed. Source
directories, subdirectories, and files must not be symbolic links; sockets,
devices, FIFOs, and other special files are rejected.

Path checks are case-insensitive for the forbidden names below.

| Rejected anywhere in a relative path | Rejected as the first path component (file or directory) |
|---|---|
| names beginning `.env` | `sessions` |
| names beginning `.pia-` | `blobs` |
| `auth.json` | `cache` |
| `oauth.json` | `npm` |
| `agent.db` | `git` |
|  | `tmp` |

Leading dots do not bypass first-component detection, so `.sessions` is also
rejected. The check runs before entry type is considered: a root-level ordinary
file named `cache`, for example, is rejected too. A source path is additionally
rejected when it:

- is empty, absolute, contains NUL or a backslash;
- contains an empty, `.` or `..` component;
- exceeds 4096 UTF-8 bytes in total;
- contains a component over 255 UTF-8 bytes.

These rules prevent common credentials and runtime stores from entering Git;
they do not recognize every possible secret filename. Keep provider auth and
secret-bearing settings in the upstream harness's private mechanisms.

## Ownership boundaries

| Data | Owner and location |
|---|---|
| Reviewed combo source | Git checkout under `combos/` |
| Saved selection | `${XDG_CONFIG_HOME:-~/.config}/pi-agents/selection.json` |
| Pi materialized config | `$PIA_STATE_HOME/runtime/pi/<combo>/agent` (or the default state root) |
| OMP materialized config | Native `pia-<combo>` profile path returned by OMP |
| Apply manifests | `$PIA_STATE_HOME/manifests/<engine>/<combo>.json` |
| Sessions | `$PIA_STATE_HOME/sessions/...` |
| Handoff artifacts | `$PIA_STATE_HOME/handoffs/...` |
| Credentials, packages, caches, blobs | Upstream harness/private runtime; never combo source |

`PIA_STATE_HOME` replaces the default
`${XDG_STATE_HOME:-~/.local/state}/pi-agents` root. OMP's target is not assumed;
`pia` validates the profile path returned by OMP before using it.

## Three-way apply decisions

The manifest limits what `pia` owns. Every path is classified before any write:

| Situation | Classification | Normal apply |
|---|---|---|
| Source and managed runtime equal the manifest | `clean` | No content write |
| Source changed; managed runtime still matches | `source-only-update` | Write source version |
| New source; target absent | `new` | Create |
| Source removed; managed target unchanged/absent | `stale` | Remove/forget |
| Managed runtime changed independently | `runtime-drift` | Refuse |
| Source and runtime diverged, or managed file disappeared after source changed | `conflict` | Refuse |
| New source collides with an unowned file or obstruction | blocking `conflict` | Always refuse |

A matching unowned file can be adopted after an interrupted first apply, but an
unowned file with different content is never overwritten. Target-only file
contents not listed in the manifest remain unowned and are preserved. Existing
parent directories needed for a managed child may still have their mode
normalized to `0700` on POSIX.

`pia apply --dry-run` computes the same plan without writing.

## What `--force` means

`--force` lets checked-in source win over **previously managed** runtime drift
or conflicts, including a modified stale file. It cannot overwrite an unowned
collision or non-file obstruction. This is a manifest-bounded repair operation,
not recursive replacement of an agent directory.

Before forcing:

```sh
pia status <combo>
pia diff <combo> --runtime
```

Carry any intentional runtime edit back into the reviewed combo first.

## Filesystem protections

On POSIX systems `pia` creates runtime/state directories as `0700`; managed
files are `0600` or `0700` according to executable intent. Individual writes
and manifest replacement use temporary files plus atomic rename, but a
multi-file apply has no rollback transaction. Write/adopt actions revalidate
the source and target they are about to use; stale removal revalidates the
target but does not currently recheck that the source path is still absent.

Node does not provide equivalent POSIX mode enforcement on Windows. Files
inherit the user's profile ACL, and drift comparison ignores synthetic mode
bits there. Protect the Windows account and profile directory accordingly.

## Secret scanning and handoff limits

Repository checks scan combo content with `gitleaks` when available. CI checks
out full history and runs `gitleaks-action` for push and pull-request events;
the action scans the event-associated commit range rather than promising an
all-history scan on every run. Scanning supplements, but does not replace,
review.

A handoff excludes hidden thinking, images, tool arguments, and successful tool
output, caps failed output, runs the tracked redactor, and then requires
`gitleaks` verification. Any helper failure aborts the operation. The resulting
Markdown can still contain sensitive facts written in ordinary prose, so review
it before sharing. See [Sessions and handoff](../guides/sessions-and-handoff.md).

!!! warning "Not an execution sandbox"
    `pia` does not restrict what Pi, OMP, extensions, skills, packages, model
    tools, or child processes may do. Use the upstream permission model and an
    OS/container boundary appropriate to the workload.
