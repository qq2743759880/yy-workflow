# YY-owned server and configured ngrok lifecycle. No dependency installation.
[CmdletBinding()]
param(
  [Parameter(Position=0)][ValidateSet('start','stop','restart','status')][string]$Action='start',
  [int]$Port=0,
  [string]$PythonExe,
  [ValidateSet('none','oauth')][string]$AuthMode,
  [string]$BindingsPath,
  [switch]$NoTunnel,
  [string]$NgrokAuthtokenFile
)
$ErrorActionPreference = 'Stop'
$packageRoot = $PSScriptRoot
$workflowRoot = Split-Path -Parent (Split-Path -Parent $packageRoot)
$runtime = Join-Path $packageRoot 'runtime'
Import-Module (Join-Path $runtime 'yy-lifecycle.psm1')
$configPath = Join-Path $runtime 'config.json'
$config = $null
if (Test-Path -LiteralPath $configPath) {
  try { $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json } catch { throw 'RUNTIME_CONFIG_INVALID' }
}

if ($Action -eq 'status') {
  $status = [ordered]@{}
  foreach ($role in @('server','tunnel')) {
    $record = Read-YyProcessRecord (Join-Path $runtime "$role.pid")
    $status[$role] = if ($record) {
      [pscustomobject]@{ code=(Test-YyRecordIdentity $record).code; pid=$record.pid }
    } else { [pscustomobject]@{ code='NOT_RUNNING'; pid=$null } }
  }
  $status | ConvertTo-Json -Depth 5
  return
}

if ($Action -eq 'stop') {
  foreach ($role in @('tunnel','server')) {
    $stopped = Stop-YyOwnedProcess -RuntimeRoot $runtime -Role $role
    if ($stopped.code -notin @('NOT_RUNNING','STALE_PID_CLEARED','STOPPED_OWNED_PROCESS')) { throw $stopped.code }
    Write-Output "$role $($stopped.code)"
  }
  return
}

if ($Port -eq 0 -and $config -and $config.server.port) { $Port = [int]$config.server.port }
if ($Port -eq 0) { throw 'PORT_REQUIRED: specify -Port for the first YY startup' }
if ($Port -eq 8168 -or $Port -lt 1 -or $Port -gt 65535) { throw 'PORT_INVALID_OR_RESERVED' }
if (-not $PythonExe) {
  $PythonExe = Join-Path $packageRoot '.venv\Scripts\python.exe'
  if (-not (Test-Path -LiteralPath $PythonExe) -and $config -and $config.server.executablePath) {
    $PythonExe = [string]$config.server.executablePath
  }
}
if (-not (Test-Path -LiteralPath $PythonExe -PathType Leaf)) { throw 'SERVER_RUNTIME_MISSING: provide the existing project venv with -PythonExe' }

# Preserve caller-selected settings; defaults expose only synthetic bindings.
if ($AuthMode) { $env:YY_AUTH_MODE = $AuthMode }
elseif (-not $env:YY_AUTH_MODE) { $env:YY_AUTH_MODE = 'none' }
if ($env:YY_AUTH_MODE -notin @('none','oauth')) { throw 'AUTH_MODE_INVALID' }
if ($env:YY_AUTH_MODE -eq 'oauth') {
  foreach ($name in @('YY_AUTH_SECRET','YY_AUTH_PASSWORD_HASH','YY_AUTH_ISSUER')) {
    if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) { throw "AUTH_CREDENTIAL_MISSING: $name" }
  }
}
if ($BindingsPath) { $env:YY_READONLY_BINDINGS = $BindingsPath }
elseif (-not $env:YY_READONLY_BINDINGS) { $env:YY_READONLY_BINDINGS = Join-Path $packageRoot 'bindings-synthetic.json' }
if (-not (Test-Path -LiteralPath $env:YY_READONLY_BINDINGS -PathType Leaf)) { throw 'BINDINGS_FILE_MISSING' }
if (-not $env:YY_READONLY_ENABLED) { $env:YY_READONLY_ENABLED = 'true' }
if (-not $env:YY_DECISION_ENABLED) { $env:YY_DECISION_ENABLED = 'true' }
if (-not $env:YY_DECISION_ROOT) { $env:YY_DECISION_ROOT = $workflowRoot }
if (-not $env:PYTHONUTF8) { $env:PYTHONUTF8 = '1' }

# Capture the selected endpoint before starting the server. Start-YyServer also
# preserves this selection when rebuilding its server ownership configuration.
$selectedTunnel = $null
if (-not $NoTunnel -and $config -and $config.tunnel.selectionState -eq 'SELECTED_AFTER_W2_PASS') {
  $selectedTunnel = $config.tunnel
  if ($selectedTunnel.provider -ne 'ngrok') { throw 'TUNNEL_PROVIDER_UNSUPPORTED' }
  if ($selectedTunnel.targetHost -ne '127.0.0.1' -or [int]$selectedTunnel.targetPort -ne $Port) { throw 'TUNNEL_PORT_MISMATCH' }
}
if ($Action -eq 'restart') {
  foreach ($role in @('tunnel','server')) {
    $stopped = Stop-YyOwnedProcess -RuntimeRoot $runtime -Role $role
    if ($stopped.code -notin @('NOT_RUNNING','STALE_PID_CLEARED','STOPPED_OWNED_PROCESS')) { throw $stopped.code }
    Write-Output "$role $($stopped.code)"
  }
}
$server = Start-YyServer -RuntimeRoot $runtime -ProjectRoot $packageRoot -PythonExe $PythonExe -Port $Port
Write-Output "server $($server.code) pid=$($server.pid) port=$Port"
if ($selectedTunnel) {
  $oldTunnel = Read-YyProcessRecord (Join-Path $runtime 'tunnel.pid')
  $reuse = $false
  if ($oldTunnel) {
    $identity = Test-YyRecordIdentity $oldTunnel
    if ($identity.code -eq 'PID_OWNER_MATCH') {
      if ($oldTunnel.role -ne 'tunnel' -or $oldTunnel.provider -ne 'ngrok' -or
          $oldTunnel.providerEndpointId -ne $selectedTunnel.endpointIdentity.providerEndpointId -or
          $oldTunnel.executablePath -ine $selectedTunnel.executablePath -or
          $oldTunnel.targetHost -ne '127.0.0.1' -or [int]$oldTunnel.targetPort -ne $Port) { throw 'TUNNEL_CONFIG_MISMATCH' }
      if (-not (Test-YyTunnelEndpointHealth $oldTunnel $selectedTunnel.endpointIdentity.publicHost)) { throw 'TUNNEL_UNHEALTHY_USE_RESTART' }
      $reuse = $true
      Write-Output "tunnel TUNNEL_ALREADY_RUNNING pid=$($oldTunnel.pid)"
    } elseif ($identity.code -ne 'PID_NOT_FOUND') { throw $identity.code }
  }
  if (-not $reuse) {
    $tunnelArgs = @{
      RuntimeRoot=$runtime; NgrokExe=[string]$selectedTunnel.executablePath
      ProviderEndpointId=[string]$selectedTunnel.endpointIdentity.providerEndpointId
      PublicHost=[string]$selectedTunnel.endpointIdentity.publicHost; Port=$Port
    }
    if ($NgrokAuthtokenFile) { $tunnelArgs.AuthtokenFile = $NgrokAuthtokenFile }
    $tunnel = Start-YyNgrokTunnel @tunnelArgs
    Write-Output "tunnel $($tunnel.code) pid=$($tunnel.pid)"
  }
  Write-Output "MCP https://$($selectedTunnel.endpointIdentity.publicHost)/mcp"
  Write-Output "MCP-V2 https://$($selectedTunnel.endpointIdentity.publicHost)/mcp-v2"
}
else { Write-Output 'tunnel NOT_REQUESTED_OR_NOT_SELECTED' }
