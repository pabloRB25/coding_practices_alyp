$ErrorActionPreference = "Stop"
& node (Join-Path $PSScriptRoot "check-drift.mjs") @args
