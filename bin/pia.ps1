$ErrorActionPreference = "Stop"

# PowerShell consumes a literal `--` when a .ps1 launcher is invoked with the
# call operator (`pia.ps1 run pi/base -- --version`). `run` accepts at most one
# combo before the separator, so reconstruct the unambiguous boundary here.
$forward = @($args)
if ($forward.Count -ge 2 -and $forward[0] -eq "run" -and $forward -notcontains "--") {
    if ($forward.Count -gt 2) {
        $forward = @($forward[0], $forward[1], "--") + @($forward[2..($forward.Count - 1)])
    } elseif ($forward[1].StartsWith("-")) {
        $forward = @($forward[0], "--", $forward[1])
    }
}

& node (Join-Path $PSScriptRoot "pia") @forward
exit $LASTEXITCODE
