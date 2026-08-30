$ErrorActionPreference = "Stop"

& node (Join-Path $PSScriptRoot "pia") @args
exit $LASTEXITCODE
