#Requires -Version 5.1
<#
.SYNOPSIS
  Local Caddy CORS proxy for ODK Central (Windows port of central-cors-proxy.sh).
.DESCRIPTION
  Implements "Recipe 3" from
  docs/specs/2026-07-13-1331-central-publishing/user-guide.md, for when you
  cannot add CORS headers on the Central server itself.

  Downloads a stock Caddy binary (Apache-2.0, single static file) into .local\
  (gitignored) and creates or updates .local\Caddyfile. Register
  http://localhost:<port>/<prefix> as the server URL in Form Forge; Caddy
  forwards /<prefix>/* to the real Central and answers the preflights.

  An existing Caddyfile is updated in place: the requested prefix is added (or
  its upstream corrected) and every other prefix is preserved - run once per
  Central server to build up a multi-server proxy. A running proxy is reloaded
  automatically.
.PARAMETER Upstream
  Upstream Central base URL. Env default CENTRAL_PROXY_UPSTREAM, else
  https://my-central-server.example.com. Alias -u.
.PARAMETER Prefix
  Path prefix for this upstream. Env default CENTRAL_PROXY_PREFIX, else
  my-central. Alias -n.
.PARAMETER Origin
  Builder origin to allow (generation-time only). Env default
  CENTRAL_PROXY_ORIGIN, else http://localhost:5173. Alias -o.
.PARAMETER Port
  Local port to listen on (generation-time only). Env default
  CENTRAL_PROXY_PORT, else 8123. Alias -p.
.PARAMETER Force
  Regenerate the Caddyfile from scratch and re-download Caddy. Alias -f.
.EXAMPLE
  .\scripts\central-cors-proxy.ps1 -Upstream https://central.example.org -Prefix my-central
  .\.local\caddy.exe run --config .\.local\Caddyfile
  # then register  http://localhost:8123/my-central  as the server URL in Form Forge
#>
[CmdletBinding()]
param(
  [Alias('u')][string]$Upstream = $(if ($env:CENTRAL_PROXY_UPSTREAM) { $env:CENTRAL_PROXY_UPSTREAM } else { 'https://my-central-server.example.com' }),
  [Alias('n')][string]$Prefix   = $(if ($env:CENTRAL_PROXY_PREFIX)   { $env:CENTRAL_PROXY_PREFIX }   else { 'my-central' }),
  [Alias('o')][string]$Origin   = $(if ($env:CENTRAL_PROXY_ORIGIN)   { $env:CENTRAL_PROXY_ORIGIN }   else { 'http://localhost:5173' }),
  [Alias('p')][string]$Port     = $(if ($env:CENTRAL_PROXY_PORT)     { $env:CENTRAL_PROXY_PORT }     else { '8123' }),
  [Alias('f')][switch]$Force
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
# Don't let a native command's non-zero exit throw before we inspect $LASTEXITCODE
# (PowerShell 7.4+ default); harmless no-op on Windows PowerShell 5.1.
$PSNativeCommandUseErrorActionPreference = $false

$Root      = Split-Path -Parent $PSScriptRoot
$LocalDir  = Join-Path $Root '.local'
$Caddy     = Join-Path $LocalDir 'caddy.exe'
$Caddyfile = Join-Path $LocalDir 'Caddyfile'

$Upstream = $Upstream.TrimEnd('/')
$Prefix   = $Prefix.Trim('/')

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Write-CaddyFile([string[]]$Lines) {
  # Always LF, no BOM, single trailing newline -- byte-identical to the bash script.
  [System.IO.File]::WriteAllText($Caddyfile, (($Lines -join "`n") + "`n"), $Utf8NoBom)
}

New-Item -ItemType Directory -Force -Path $LocalDir | Out-Null

# --- 1. Fetch Caddy (official build server serves the bare binary) ----------
if (-not (Test-Path $Caddy) -or $Force) {
  switch -Regex ($env:PROCESSOR_ARCHITECTURE) {
    'ARM64'        { $arch = 'arm64' }
    'AMD64|x86_64' { $arch = 'amd64' }
    'x86'          { $arch = if ($env:PROCESSOR_ARCHITEW6432 -eq 'AMD64') { 'amd64' } else { '386' } }
    default        { Write-Host "error: unsupported arch $($env:PROCESSOR_ARCHITECTURE)"; exit 1 }
  }
  Write-Host "Downloading Caddy (windows/$arch) into .local\ ..."
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
  $tmp = "$Caddy.tmp"
  Invoke-WebRequest -Uri "https://caddyserver.com/api/download?os=windows&arch=$arch" -OutFile $tmp
  Move-Item -Force -Path $tmp -Destination $Caddy
}
Write-Host "Caddy: $(& $Caddy version)"

# --- 2. Create or update the Caddyfile (user-guide Recipe 3) -----------------
function New-CaddyfileContent {
  Write-CaddyFile @(
    '# CORS proxy for ODK Central - managed by scripts/central-cors-proxy.{sh,ps1}.',
    '# Recipe 3 of docs/specs/2026-07-13-1331-central-publishing/user-guide.md.',
    '#',
    '# One handle_path block per Central server; register each as',
    "# http://localhost:$Port/<prefix> in Form Forge. Re-run the script with",
    '# -n <prefix> -u <url> to add or update a server.',
    '{',
    "`tauto_https off",
    '}',
    '',
    ":$Port {",
    "`t@preflight method OPTIONS",
    "`thandle @preflight {",
    "`t`theader Access-Control-Allow-Origin `"$Origin`"",
    "`t`theader Access-Control-Allow-Methods `"GET, POST, PUT, PATCH, DELETE, OPTIONS`"",
    "`t`theader Access-Control-Allow-Headers `"Authorization, Content-Type`"",
    "`t`theader Access-Control-Max-Age `"3600`"",
    "`t`theader Access-Control-Allow-Private-Network `"true`"",
    "`t`trespond 204",
    "`t}",
    '',
    "`theader Access-Control-Allow-Origin `"$Origin`"",
    "`theader Access-Control-Expose-Headers `"ETag`"",
    '',
    "`t# header_up Host is mandatory: a forwarded Host: localhost:$Port gets",
    "`t# 404-routed before reaching Central's API.",
    "`thandle_path /$Prefix/* {",
    "`t`treverse_proxy $Upstream {",
    "`t`t`theader_up Host {upstream_hostport}",
    "`t`t}",
    "`t}",
    '',
    "`t# Fail loudly when no prefix matches (e.g. a stale server URL registered",
    "`t# in Form Forge) instead of Caddy's default empty 200.",
    "`thandle {",
    "`t`trespond `"No proxy prefix matches this path; check the server URL registered in Form Forge against this Caddyfile.`" 404",
    "`t}",
    '}'
  )
  Write-Host "Wrote $Caddyfile (/$Prefix -> $Upstream, origin: $Origin, port: $Port)."
}

function Get-CurrentUpstream([string[]]$Lines) {
  $inBlock = $false
  foreach ($line in $Lines) {
    if ($line.Contains("handle_path /$Prefix/*")) { $inBlock = $true }
    if ($inBlock -and $line -match 'reverse_proxy\s+(\S+)') { return $Matches[1] }
  }
  return $null
}

function Update-PrefixUpstream([string[]]$Lines) {
  $inBlock = $false
  $out = foreach ($line in $Lines) {
    if ($line.Contains("handle_path /$Prefix/*")) { $inBlock = $true }
    if ($inBlock -and $line -match 'reverse_proxy\s+\S+') {
      $inBlock = $false
      "`t`treverse_proxy $Upstream {"
    } else {
      $line
    }
  }
  Write-CaddyFile $out
}

function Add-PrefixBlock([string[]]$Lines) {
  # New blocks go just above the 404 fallback (or the final closing brace when
  # a hand-edited file dropped the fallback).
  $markIndex = -1
  $lastBrace = -1
  for ($i = 0; $i -lt $Lines.Count; $i++) {
    if ($markIndex -lt 0 -and $Lines[$i].Contains('# Fail loudly')) { $markIndex = $i }
    if ($Lines[$i] -eq '}') { $lastBrace = $i }
  }
  $pos = if ($markIndex -ge 0) { $markIndex } else { $lastBrace }
  $block = @(
    "`thandle_path /$Prefix/* {",
    "`t`treverse_proxy $Upstream {",
    "`t`t`theader_up Host {upstream_hostport}",
    "`t`t}",
    "`t}",
    ''
  )
  $out = @()
  for ($i = 0; $i -lt $Lines.Count; $i++) {
    if ($i -eq $pos) { $out += $block }
    $out += $Lines[$i]
  }
  Write-CaddyFile $out
}

if (-not (Test-Path $Caddyfile) -or $Force) {
  New-CaddyfileContent
} else {
  $lines = @(Get-Content -LiteralPath $Caddyfile)
  $existingPort = $null
  foreach ($line in $lines) {
    if ($line -match '^:(\d+) \{$') { $existingPort = $Matches[1]; break }
  }
  if ($existingPort -and $existingPort -ne $Port) {
    Write-Host "note: keeping the existing port :$existingPort (-p only applies at generation; use -f to regenerate)."
    $Port = $existingPort
  }
  $existingUpstream = Get-CurrentUpstream $lines
  if (-not $existingUpstream) {
    Add-PrefixBlock $lines
    Write-Host "Added /$Prefix -> $Upstream to $Caddyfile."
  } elseif ($existingUpstream -ne $Upstream) {
    Update-PrefixUpstream $lines
    Write-Host "Updated /${Prefix}: $existingUpstream -> $Upstream."
  } else {
    Write-Host "/$Prefix -> $Upstream already configured; Caddyfile unchanged."
  }
}

$validation = & $Caddy validate --config $Caddyfile 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host ($validation -join "`n")
  Write-Host 'error: Caddyfile failed to validate'
  exit 1
}
Write-Host 'Caddyfile validates.'

& $Caddy reload --config $Caddyfile *> $null
if ($LASTEXITCODE -eq 0) {
  Write-Host 'Live proxy reloaded.'
} else {
  Write-Host 'Proxy not running - start it with: .\.local\caddy.exe run --config .\.local\Caddyfile'
}

Write-Host ''
Write-Host 'Configured routes (register these as server URLs in Form Forge):'
$pfx = $null
foreach ($line in @(Get-Content -LiteralPath $Caddyfile)) {
  if ($line -match 'handle_path /(\S+?)/\*') {
    $pfx = $Matches[1]
  } elseif ($pfx -and $line -match 'reverse_proxy\s+(\S+)') {
    Write-Host "  http://localhost:$Port/$pfx  ->  $($Matches[1])"
    $pfx = $null
  }
}
