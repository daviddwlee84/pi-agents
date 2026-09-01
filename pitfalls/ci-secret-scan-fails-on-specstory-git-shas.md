# CI secret scan reports thousands of leaks after committing SpecStory history

## Symptom

The GitHub Actions `secret-scan` job failed after large SpecStory transcripts
were committed. The exact terminal messages were:

```text
leaks found: 2851
$GITHUB_STEP_SUMMARY upload aborted, supports content up to a size of 1024k, got 1972k.
```

Most findings used the `sourcegraph-access-token` rule against ordinary
40-character Git commit IDs quoted in the transcript. The remaining findings
were scanner rule names, code fragments, and synthetic values copied from the
agent-history-hygiene test corpus.

## Cause

`gitleaks/gitleaks-action` scans the pushed commit range, including generated
transcripts that preserve command output and previous secret-scanner tests. A
transcript can therefore contain thousands of strings that intentionally look
like scanner inputs without containing a live credential.

## Resolution

Inspect the redacted SARIF artifact before changing policy. When every finding
is proven synthetic, add the immutable commit IDs to a commit-scoped
`[[allowlists]]` entry in `.gitleaks.toml`.

Do not exclude `.specstory/history/`: that would hide future real leaks. Do not
rewrite an already-pushed `main`; future commits must remain fully scanned.
