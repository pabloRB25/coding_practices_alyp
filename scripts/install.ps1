# Shim PowerShell — la lógica vive en install.mjs (cross-platform).
$ErrorActionPreference = "Stop"
& node (Join-Path $PSScriptRoot "install.mjs") @args
