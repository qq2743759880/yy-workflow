Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$script:YyProcessSnapshotProvider = $null
$script:YyPortOwnerProvider = $null
$script:YyPortFreeProvider = $null
$script:YyStopProcessProvider = $null
$script:YyStartServerProvider = $null
$script:YyTunnelStartProvider = $null
$script:YyEndpointHealthProvider = $null

function Get-YyCanonicalPath([string]$Path) {
  if ([string]::IsNullOrWhiteSpace($Path)) { throw 'PATH_REQUIRED' }
  $full = [IO.Path]::GetFullPath($Path)
  if (Test-Path -LiteralPath $full) {
    return (Resolve-Path -LiteralPath $full).Path.TrimEnd('\')
  }
  return $full.TrimEnd('\')
}

function Get-YySha256Text([string]$Value) {
  $sha = [Security.Cryptography.SHA256]::Create()
  try { return ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Value)))).Replace('-', '').ToLowerInvariant() }
  finally { $sha.Dispose() }
}

function Get-YySha256File([string]$Path) {
  $sha = [Security.Cryptography.SHA256]::Create()
  $stream = [IO.File]::OpenRead($Path)
  try { return ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-', '').ToLowerInvariant() }
  finally { $stream.Dispose(); $sha.Dispose() }
}

function ConvertTo-YyUtcTimestamp([object]$Value) {
  if ($Value -is [DateTime]) { return $Value.ToUniversalTime().ToString('o') }
  if ($Value -is [DateTimeOffset]) { return $Value.UtcDateTime.ToString('o') }
  return ([DateTimeOffset]::Parse([string]$Value)).UtcDateTime.ToString('o')
}

function Write-YyAtomicJson([string]$Path, $Value) {
  $parent = Split-Path -Parent $Path
  if (-not (Test-Path -LiteralPath $parent)) { [void](New-Item -ItemType Directory -Path $parent -Force) }
  $temp = "$Path.$([guid]::NewGuid().ToString('N')).tmp"
  $json = ConvertTo-Json -InputObject $Value -Depth 12
  try {
    [IO.File]::WriteAllText($temp, $json + [Environment]::NewLine, (New-Object Text.UTF8Encoding($false)))
    if (Test-Path -LiteralPath $Path) {
      $backup = "$Path.backup.$([guid]::NewGuid().ToString('N'))"
      [IO.File]::Replace($temp, $Path, $backup)
      if (Test-Path -LiteralPath $backup) { Remove-Item -LiteralPath $backup -Force }
    }
    else { [IO.File]::Move($temp, $Path) }
  } finally { if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp -Force } }
}

function New-YyRuntimeConfig([string]$PythonExe, [Parameter(Mandatory=$true)][int]$Port) {
  if ($Port -lt 1 -or $Port -gt 65535 -or $Port -eq 8168) { throw 'PORT_INVALID_OR_RESERVED' }
  $python = Get-YyCanonicalPath $PythonExe
  return [ordered]@{
    schema = 'yy/runtime-config@1'
    runtimeRoot = 'integrations/yy-web-mcp/runtime'
    paths = [ordered]@{ config='config.json'; serverPid='server.pid'; tunnelPid='tunnel.pid'; serverLog='logs/server.log'; tunnelLog='logs/tunnel.log' }
    server = [ordered]@{ portSelectionState='SELECTED_AFTER_FREE_PORT_CHECK'; bindHost='127.0.0.1'; port=$Port; executablePath=$python; health=[ordered]@{ mode='tcp_loopback'; host='127.0.0.1'; timeoutSeconds=5 } }
    tunnel = [ordered]@{ selectionState='UNSELECTED_W2_P1'; provider=$null; executablePath=$null; endpointIdentity=$null; targetHost='127.0.0.1'; targetPort=$null }
  }
}

function Get-YyProcessSnapshot([int]$ProcessId) {
  if ($script:YyProcessSnapshotProvider) { return (& $script:YyProcessSnapshotProvider $ProcessId) }
  $process = Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
  if (-not $process) { return $null }
  $created = $null
  try {
    if ($process.CreationDate -is [DateTime]) { $created = $process.CreationDate.ToUniversalTime().ToString('o') }
    else { $created = [Management.ManagementDateTimeConverter]::ToDateTime([string]$process.CreationDate).ToUniversalTime().ToString('o') }
  } catch {
    try { $created = (Get-Process -Id $ProcessId -ErrorAction Stop).StartTime.ToUniversalTime().ToString('o') }
    catch { throw 'PROCESS_START_TIME_UNAVAILABLE' }
  }
  return [pscustomobject]@{
    pid = [int]$process.ProcessId
    parentProcessId = [int]$process.ParentProcessId
    executablePath = Get-YyCanonicalPath ([string]$process.ExecutablePath)
    commandLine = [string]$process.CommandLine
    processStartedAtUtc = $created
  }
}

function Get-YyMarkerFromCommandLine([string]$CommandLine) {
  $match = [regex]::Match($CommandLine, 'YY_LIFECYCLE_MARKER=([A-Za-z0-9+/=]+)')
  if ($match.Success) {
    try {
      $bytes = [Convert]::FromBase64String($match.Groups[1].Value)
      return (ConvertFrom-Json -InputObject ([Text.Encoding]::UTF8.GetString($bytes)))
    } catch { return $null }
  }
  $tunnel = [regex]::Match($CommandLine, 'yy-tunnel-([0-9a-fA-F-]{36})-([a-fA-F0-9]{64})-([a-fA-F0-9]{64})\.yml')
  if ($tunnel.Success) {
    return [pscustomobject]@{
      role = 'tunnel'; instanceId = $tunnel.Groups[1].Value.ToLowerInvariant()
      configSha256 = $tunnel.Groups[2].Value.ToLowerInvariant()
      workingDirectorySha256 = $tunnel.Groups[3].Value.ToLowerInvariant()
    }
  }
  return $null
}

function Test-YyRecordIdentity($Record) {
  if (-not $Record -or $Record.schema -ne 'yy/runtime-process-record@1' -or [int]$Record.pid -lt 1 -or $Record.role -notin @('server','tunnel')) {
    return [pscustomobject]@{ code = 'PID_RECORD_INVALID'; process = $null }
  }
  try { $snapshot = Get-YyProcessSnapshot -ProcessId ([int]$Record.pid) }
  catch { return [pscustomobject]@{ code = 'PID_OWNER_UNVERIFIED'; process = $null } }
  if (-not $snapshot) { return [pscustomobject]@{ code = 'PID_NOT_FOUND'; process = $null } }

  $recordExe = Get-YyCanonicalPath ([string]$Record.executablePath)
  $recordCwd = Get-YyCanonicalPath ([string]$Record.workingDirectory)
  $cmdHash = Get-YySha256Text $snapshot.commandLine
  $marker = Get-YyMarkerFromCommandLine $snapshot.commandLine
  try {
    $createdRecord = ConvertTo-YyUtcTimestamp $Record.processStartedAtUtc
    $createdNow = ConvertTo-YyUtcTimestamp $snapshot.processStartedAtUtc
  } catch { return [pscustomobject]@{ code = 'PID_RECORD_INVALID'; process = $snapshot } }
  $markerIdentityMatches = $false
  if ($marker -and [string]$Record.role -eq 'server') {
    $markerIdentityMatches = ([string]$marker.role -eq 'server') -and
      ([string]$marker.instanceId -eq [string]$Record.instanceId) -and
      ((Get-YyCanonicalPath ([string]$marker.workingDirectory)) -ieq $recordCwd) -and
      ([string]$marker.configSha256 -eq [string]$Record.configSha256)
  } elseif ($marker -and [string]$Record.role -eq 'tunnel') {
    $cwdHash = Get-YySha256Text ($recordCwd.ToLowerInvariant())
    $markerIdentityMatches = ([string]$marker.role -eq 'tunnel') -and
      ([string]$marker.instanceId -eq [string]$Record.instanceId) -and
      ([string]$marker.configSha256 -eq [string]$Record.configSha256) -and
      ([string]$marker.workingDirectorySha256 -eq $cwdHash)
  }
  $same = $false
  try {
    $same = ($snapshot.executablePath -ieq $recordExe) -and
      ($snapshot.pid -eq [int]$Record.pid) -and
      ($cmdHash -eq [string]$Record.commandLineSha256) -and
      ($createdNow -eq $createdRecord) -and
      $markerIdentityMatches
  } catch { return [pscustomobject]@{ code = 'PID_RECORD_INVALID'; process = $snapshot } }
  if (-not $same) { return [pscustomobject]@{ code = 'PID_OWNER_MISMATCH'; process = $snapshot } }
  return [pscustomobject]@{ code = 'PID_OWNER_MATCH'; process = $snapshot }
}

function Read-YyProcessRecord([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return $null }
  try { return (Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json) }
  catch { throw 'PID_RECORD_INVALID' }
}

function Remove-YyStaleRecord([string]$Path, [int]$ProcessId) {
  if (-not (Test-Path -LiteralPath $Path)) { return [pscustomobject]@{ code = 'STALE_PID_CLEARED' } }
  $moved = "$Path.stale.$([guid]::NewGuid().ToString('N'))"
  try {
    [IO.File]::Move($Path, $moved)
    $appeared = Get-YyProcessSnapshot -ProcessId $ProcessId
    if ($appeared) {
      if (-not (Test-Path -LiteralPath $Path)) { [IO.File]::Move($moved, $Path) }
      return [pscustomobject]@{ code = 'PID_OWNER_MISMATCH' }
    }
    Remove-Item -LiteralPath $moved -Force
    return [pscustomobject]@{ code = 'STALE_PID_CLEARED' }
  } catch {
    if ((Test-Path -LiteralPath $moved) -and -not (Test-Path -LiteralPath $Path)) {
      try { [IO.File]::Move($moved, $Path) } catch {}
    }
    return [pscustomobject]@{ code = 'STALE_CLEANUP_FAILED' }
  }
}

function Write-YyLifecycleEvent([string]$RuntimeRoot, [string]$Code, [int]$ProcessId, [int]$Port) {
  $logs = Join-Path $RuntimeRoot 'logs'
  if (-not (Test-Path -LiteralPath $logs)) { [void](New-Item -ItemType Directory -Path $logs -Force) }
  $event = [ordered]@{ atUtc = [DateTime]::UtcNow.ToString('o'); code = $Code; pid = $ProcessId; port = $Port }
  $logName = if ($Code.StartsWith('TUNNEL')) { 'tunnel.log' } else { 'server.log' }
  Add-Content -LiteralPath (Join-Path $logs $logName) -Value (ConvertTo-Json -InputObject $event -Compress) -Encoding UTF8
}

function Stop-YyOwnedProcess([string]$RuntimeRoot, [ValidateSet('server','tunnel')][string]$Role) {
  $runtime = Get-YyCanonicalPath $RuntimeRoot
  $path = Join-Path $runtime "$Role.pid"
  try { $record = Read-YyProcessRecord $path } catch { return [pscustomobject]@{ code = 'PID_RECORD_INVALID' } }
  if (-not $record) { return [pscustomobject]@{ code = 'NOT_RUNNING' } }
  if ([string]$record.role -ne $Role) { return [pscustomobject]@{ code = 'PID_OWNER_MISMATCH' } }
  $check = Test-YyRecordIdentity $record
  if ($check.code -eq 'PID_NOT_FOUND') { return (Remove-YyStaleRecord $path ([int]$record.pid)) }
  if ($check.code -ne 'PID_OWNER_MATCH') { return [pscustomobject]@{ code = $check.code } }

  # Re-resolve the PID and full identity tuple immediately before signaling.
  $check = Test-YyRecordIdentity $record
  if ($check.code -ne 'PID_OWNER_MATCH') {
    if ($check.code -eq 'PID_NOT_FOUND') { return (Remove-YyStaleRecord $path ([int]$record.pid)) }
    return [pscustomobject]@{ code = $check.code }
  }
  if ($script:YyStopProcessProvider) { & $script:YyStopProcessProvider ([int]$record.pid) }
  else {
    try { Stop-Process -Id ([int]$record.pid) -Force -ErrorAction Stop }
    catch { return [pscustomobject]@{ code = 'STOP_FAILED'; pid = [int]$record.pid } }
    try { Wait-Process -Id ([int]$record.pid) -Timeout 5 -ErrorAction SilentlyContinue } catch {}
  }
  $afterStop = $null
  try { $afterStop = Get-YyProcessSnapshot -ProcessId ([int]$record.pid) } catch {
    return [pscustomobject]@{ code = 'STOP_EXIT_UNVERIFIED'; pid = [int]$record.pid }
  }
  if ($afterStop) {
    $afterCheck = Test-YyRecordIdentity $record
    if ($afterCheck.code -eq 'PID_OWNER_MATCH') { return [pscustomobject]@{ code = 'STOP_TIMEOUT'; pid = [int]$record.pid } }
    return [pscustomobject]@{ code = 'PID_OWNER_MISMATCH'; pid = [int]$record.pid }
  }
  if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path -Force }
  return [pscustomobject]@{ code = 'STOPPED_OWNED_PROCESS'; pid = [int]$record.pid }
}

function Test-YyLoopbackPortFree([int]$Port) {
  if ($Port -lt 1 -or $Port -gt 65535 -or $Port -eq 8168) { throw 'PORT_INVALID_OR_RESERVED' }
  if ($script:YyPortFreeProvider) { return [bool](& $script:YyPortFreeProvider $Port) }
  $listener = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Parse('127.0.0.1'), $Port)
  try { $listener.Start(); return $true }
  catch [Net.Sockets.SocketException] { return $false }
  finally { try { $listener.Stop() } catch {} }
}

function Get-YyPortOwner([int]$Port) {
  if ($script:YyPortOwnerProvider) { return (& $script:YyPortOwnerProvider $Port) }
  $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
  if ($listeners.Count -eq 0) { return $null }
  $loopback = @($listeners | Where-Object { $_.LocalAddress -eq '127.0.0.1' })
  if ($loopback.Count -ne 1) { return [pscustomobject]@{ pid = -1; address = 'AMBIGUOUS' } }
  return [pscustomobject]@{ pid = [int]$loopback[0].OwningProcess; address = [string]$loopback[0].LocalAddress }
}

function ConvertTo-YyWindowsArgument([string]$Argument) {
  if ($Argument.Length -gt 0 -and $Argument -notmatch '[\s"]') { return $Argument }
  $builder = New-Object Text.StringBuilder
  [void]$builder.Append('"')
  $slashes = 0
  foreach ($character in $Argument.ToCharArray()) {
    if ($character -eq '\') { $slashes++; continue }
    if ($character -eq '"') {
      [void]$builder.Append(('\' * (2 * $slashes + 1)))
      [void]$builder.Append('"')
    } else {
      if ($slashes -gt 0) { [void]$builder.Append(('\' * $slashes)) }
      [void]$builder.Append($character)
    }
    $slashes = 0
  }
  if ($slashes -gt 0) { [void]$builder.Append(('\' * (2 * $slashes))) }
  [void]$builder.Append('"')
  return $builder.ToString()
}

function Start-YyServer([string]$RuntimeRoot, [string]$ProjectRoot, [string]$PythonExe, [Parameter(Mandatory=$true)][int]$Port) {
  $runtime = Get-YyCanonicalPath $RuntimeRoot
  $root = Get-YyCanonicalPath (Split-Path -Parent $runtime)
  if ((Get-YyCanonicalPath $ProjectRoot) -ine $root) { throw 'PROJECT_ROOT_MISMATCH' }
  $python = Get-YyCanonicalPath $PythonExe
  $serverScript = Get-YyCanonicalPath (Join-Path $root 'server.py')
  $configPath = Join-Path $runtime 'config.json'
  $previous = $null
  if (Test-Path -LiteralPath $configPath) {
    try { $previous = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json } catch { throw 'RUNTIME_CONFIG_INVALID' }
  }
  if ($Port -eq 8168 -or $Port -lt 1 -or $Port -gt 65535) { throw 'PORT_INVALID_OR_RESERVED' }
  if (-not (Test-Path -LiteralPath $python) -or -not (Test-Path -LiteralPath $serverScript)) { throw 'SERVER_RUNTIME_MISSING' }
  $recordPath = Join-Path $runtime 'server.pid'
  try { $old = Read-YyProcessRecord $recordPath } catch { throw 'PID_RECORD_INVALID' }
  if ($old) {
    $oldCheck = Test-YyRecordIdentity $old
    if ($oldCheck.code -eq 'PID_NOT_FOUND') {
      $clear = Remove-YyStaleRecord $recordPath ([int]$old.pid)
      if ($clear.code -ne 'STALE_PID_CLEARED') { throw $clear.code }
    }
    elseif ($oldCheck.code -eq 'PID_OWNER_MATCH') {
      # A venv launcher may own a child running the interpreter's real executable.
      # Record identity checks that child; runtime config retains the requested launcher.
      if ($old.role -ne 'server' -or [int]$old.port -ne $Port -or $old.workingDirectory -ine $root -or
          -not $previous -or (Get-YyCanonicalPath ([string]$previous.server.executablePath)) -ine $python) { throw 'PID_OWNER_MISMATCH' }
      $owner = Get-YyPortOwner $Port
      if (-not $owner -or [int]$owner.pid -ne [int]$old.pid) { throw 'SERVER_UNHEALTHY_USE_RESTART' }
      return [pscustomobject]@{ code='SERVER_ALREADY_RUNNING'; pid=[int]$old.pid; port=$Port; instanceId=$old.instanceId }
    }
    else { throw 'PID_OWNER_MISMATCH' }
  }
  if (-not (Test-YyLoopbackPortFree $Port)) { throw 'PORT_CONFLICT' }

  $instanceId = [guid]::NewGuid().ToString()
  $config = New-YyRuntimeConfig -PythonExe $python -Port $Port
  if ($previous) {
    if ($previous.tunnel.selectionState -eq 'SELECTED_AFTER_W2_PASS') {
      if ($previous.tunnel.targetHost -ne '127.0.0.1' -or [int]$previous.tunnel.targetPort -ne $Port) { throw 'TUNNEL_PORT_MISMATCH' }
      $config['tunnel'] = $previous.tunnel
    }
  }
  Write-YyAtomicJson $configPath $config
  $configHash = Get-YySha256File $configPath
  $marker = [ordered]@{ role = 'server'; instanceId = $instanceId; workingDirectory = $root; configSha256 = $configHash }
  $marker64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -InputObject $marker -Compress)))
  # Start-Process inherits the deployment environment; credentials never enter argv.
  $inline = "import os,runpy,sys;os.environ['YY_LIFECYCLE_MARKER']='YY_LIFECYCLE_MARKER=$marker64';os.chdir(r'$root');sys.argv=['server.py','--port','$Port'];runpy.run_path(r'$serverScript',run_name='__main__')"
  $args = @('-c', $inline) | ForEach-Object { ConvertTo-YyWindowsArgument ([string]$_) }
  $logs = Join-Path $runtime 'logs'
  if (-not (Test-Path -LiteralPath $logs)) { [void](New-Item -ItemType Directory -Path $logs -Force) }
  # Child output can contain workspace data. Discard it; only structured lifecycle codes are logged.
  $process = Start-Process -FilePath $python -ArgumentList ($args -join ' ') -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput 'NUL' -RedirectStandardError '\\.\NUL'
  $deadline = [DateTime]::UtcNow.AddSeconds(20)
  $snapshot = $null
  $serverProcessId = [int]$process.Id
  while ([DateTime]::UtcNow -lt $deadline) {
    Start-Sleep -Milliseconds 250
    $launcherSnapshot = Get-YyProcessSnapshot $process.Id
    if ($launcherSnapshot -and -not (Test-YyLoopbackPortFree $Port)) {
      $portOwner = Get-YyPortOwner $Port
      if ($portOwner) {
        if ($portOwner.pid -eq $process.Id) {
          $snapshot = $launcherSnapshot
          $serverProcessId = [int]$process.Id
          break
        }
        $ownerSnapshot = $null
        if ([int]$portOwner.pid -gt 0) { $ownerSnapshot = Get-YyProcessSnapshot ([int]$portOwner.pid) }
        if ($ownerSnapshot -and [int]$ownerSnapshot.parentProcessId -eq [int]$process.Id) {
          $ownerCandidate = [pscustomobject]@{ schema='yy/runtime-process-record@1'; role='server'; pid=[int]$portOwner.pid; executablePath=$ownerSnapshot.executablePath; workingDirectory=$root; commandLineSha256=(Get-YySha256Text $ownerSnapshot.commandLine); instanceId=$instanceId; processStartedAtUtc=$ownerSnapshot.processStartedAtUtc; configSha256=$configHash }
          if ((Test-YyRecordIdentity $ownerCandidate).code -eq 'PID_OWNER_MATCH') {
            $snapshot = $ownerSnapshot
            $serverProcessId = [int]$portOwner.pid
            break
          }
        }
        $launcherCandidate = [pscustomobject]@{ schema='yy/runtime-process-record@1'; role='server'; pid=$process.Id; executablePath=$launcherSnapshot.executablePath; workingDirectory=$root; commandLineSha256=(Get-YySha256Text $launcherSnapshot.commandLine); instanceId=$instanceId; processStartedAtUtc=$launcherSnapshot.processStartedAtUtc; configSha256=$configHash }
        if ((Test-YyRecordIdentity $launcherCandidate).code -eq 'PID_OWNER_MATCH') { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue }
        throw 'PORT_CONFLICT'
      }
    }
    if ($process.HasExited) { throw 'SERVER_EXITED_DURING_START' }
  }
  if (-not $snapshot -or (Test-YyLoopbackPortFree $Port)) {
    $owned = $false
    try {
      $snapshot = Get-YyProcessSnapshot $process.Id
      $candidate = [pscustomobject]@{ schema='yy/runtime-process-record@1'; role='server'; pid=$process.Id; executablePath=$snapshot.executablePath; workingDirectory=$root; commandLineSha256=(Get-YySha256Text $snapshot.commandLine); instanceId=$instanceId; processStartedAtUtc=$snapshot.processStartedAtUtc; configSha256=$configHash }
      $owned = $snapshot -and (Test-YyRecordIdentity $candidate).code -eq 'PID_OWNER_MATCH'
      if ($owned) { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue }
    } catch {}
    throw 'SERVER_HEALTH_FAILED'
  }
  $record = [ordered]@{
    schema = 'yy/runtime-process-record@1'; role = 'server'; pid = $serverProcessId
    executablePath = $snapshot.executablePath; workingDirectory = $root
    commandLineSha256 = Get-YySha256Text $snapshot.commandLine; instanceId = $instanceId
    processStartedAtUtc = $snapshot.processStartedAtUtc; configSha256 = $configHash
    bindHost = '127.0.0.1'; port = $Port
  }
  $identity = Test-YyRecordIdentity $record
  if ($identity.code -ne 'PID_OWNER_MATCH') {
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    throw 'PID_OWNER_MISMATCH'
  }
  Write-YyAtomicJson $recordPath $record
  Write-YyLifecycleEvent -RuntimeRoot $runtime -Code 'SERVER_STARTED' -ProcessId $serverProcessId -Port $Port
  return [pscustomobject]@{ code = 'SERVER_STARTED'; pid = $serverProcessId; port = $Port; instanceId = $instanceId }
}

function Invoke-YyWatchdogOnce([string]$RuntimeRoot) {
  $runtime = Get-YyCanonicalPath $RuntimeRoot
  $path = Join-Path $runtime 'server.pid'
  try { $record = Read-YyProcessRecord $path } catch { return [pscustomobject]@{ code = 'PID_RECORD_INVALID'; action = 'none' } }
  if (-not $record) { return [pscustomobject]@{ code = 'SERVER_RECORD_MISSING'; action = 'none' } }
  $check = Test-YyRecordIdentity $record
  if ($check.code -eq 'PID_NOT_FOUND') {
    $clear = Remove-YyStaleRecord $path ([int]$record.pid)
    if ($clear.code -ne 'STALE_PID_CLEARED') { return [pscustomobject]@{ code = $clear.code; action = 'none' } }
    return Invoke-YyBoundedServerRestart $runtime 'STALE_PID_CLEARED'
  }
  if ($check.code -ne 'PID_OWNER_MATCH') { return [pscustomobject]@{ code = $check.code; action = 'none' } }
  $portOwner = Get-YyPortOwner ([int]$record.port)
  if ($portOwner -and $portOwner.pid -eq [int]$record.pid) {
    $tunnel = Invoke-YyTunnelWatchdogOnce -RuntimeRoot $runtime
    return [pscustomobject]@{ code = 'HEALTHY'; action = 'none'; pid = [int]$record.pid; tunnelCode = $tunnel.code; tunnelAction = $tunnel.action }
  }
  if ($portOwner) { return [pscustomobject]@{ code = 'PORT_OWNER_MISMATCH'; action = 'none'; pid = [int]$record.pid } }
  $stopped = Stop-YyOwnedProcess -RuntimeRoot $runtime -Role server
  if ($stopped.code -ne 'STOPPED_OWNED_PROCESS') { return [pscustomobject]@{ code = $stopped.code; action = 'none' } }
  return Invoke-YyBoundedServerRestart $runtime 'SERVER_UNHEALTHY_OWNED'
}

function Invoke-YyBoundedServerRestart([string]$RuntimeRoot, [string]$Reason) {
  $configPath = Join-Path $RuntimeRoot 'config.json'
  if (-not (Test-Path -LiteralPath $configPath)) { return [pscustomobject]@{ code = 'RUNTIME_CONFIG_MISSING'; action = 'none'; reason = $Reason } }
  try { $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json } catch { return [pscustomobject]@{ code = 'RUNTIME_CONFIG_INVALID'; action = 'none'; reason = $Reason } }
  if (-not $config.server -or [int]$config.server.port -eq 8168 -or -not $config.server.port -or -not $config.server.executablePath) {
    return [pscustomobject]@{ code = 'RUNTIME_CONFIG_INCOMPLETE'; action = 'none'; reason = $Reason }
  }
  if ($config.server.portSelectionState -ne 'SELECTED_AFTER_FREE_PORT_CHECK') {
    return [pscustomobject]@{ code = 'PORT_NOT_FROZEN'; action = 'none'; reason = $Reason }
  }
  try {
    if ($script:YyStartServerProvider) {
      $started = & $script:YyStartServerProvider $RuntimeRoot (Split-Path -Parent $RuntimeRoot) ([string]$config.server.executablePath) ([int]$config.server.port)
    } else {
      $started = Start-YyServer -RuntimeRoot $RuntimeRoot -ProjectRoot (Split-Path -Parent $RuntimeRoot) -PythonExe ([string]$config.server.executablePath) -Port ([int]$config.server.port)
    }
    return [pscustomobject]@{ code = 'SERVER_RESTARTED'; action = 'restart_once'; reason = $Reason; pid = $started.pid; port = $started.port }
  } catch {
    return [pscustomobject]@{ code = 'SERVER_RESTART_FAILED'; action = 'restart_once'; reason = $Reason; detail = $_.Exception.Message }
  }
}

function Test-YyEndpointStatus([int]$StatusCode) {
  # A Streamable HTTP MCP GET without a session returns 400; an ngrok offline
  # endpoint returns 404 and must not be mistaken for a ready tunnel.
  return (($StatusCode -ge 200 -and $StatusCode -lt 300) -or $StatusCode -eq 400)
}

function Test-YyTunnelEndpointHealth($Record, [string]$PublicHost) {
  if ($script:YyEndpointHealthProvider) { return [bool](& $script:YyEndpointHealthProvider $Record $PublicHost) }
  if ([string]::IsNullOrWhiteSpace($PublicHost) -or $PublicHost -notmatch '^[A-Za-z0-9.-]+$') { return $false }
  try {
    $response = Invoke-WebRequest -Uri "https://$PublicHost/mcp" -Headers @{ Accept = 'text/event-stream' } -UseBasicParsing -TimeoutSec 8 -ErrorAction Stop
    return (Test-YyEndpointStatus ([int]$response.StatusCode))
  } catch {
    if ($_.Exception.Response) {
      try { $status = [int]$_.Exception.Response.StatusCode; return (Test-YyEndpointStatus $status) } catch { return $false }
    }
    return $false
  }
}

function Get-YyNgrokConfigTemplate() {
  # P1-01 fix: ngrok v3 YAML does NOT expand $VAR syntax — "authtoken: $NGROK_AUTHTOKEN" is a literal string → ERR_NGROK_105.
  # Instead, omit authtoken from the config entirely; ngrok natively reads NGROK_AUTHTOKEN from the child process env
  # (set by Start-YyNgrokTunnel via $startInfo.EnvironmentVariables['NGROK_AUTHTOKEN']).
  # The --config flag still isolates YY from any default ngrok config.
  return ('version: 3{0}agent:{0}  web_addr: false{0}  log: false{0}' -f [Environment]::NewLine)
}

function Get-YyNgrokExitCode($Process, $StdoutTask, $StderrTask) {
  if (-not $Process.HasExited) { return $null }
  $diagnostic = ''
  try { $diagnostic = $StdoutTask.GetAwaiter().GetResult() + [Environment]::NewLine + $StderrTask.GetAwaiter().GetResult() } catch {}
  $safeCode = [regex]::Match($diagnostic, 'ERR_NGROK_[0-9]+').Value
  if ($safeCode) { return $safeCode }
  return 'NGROK_AGENT_EXITED'
}

function Start-YyNgrokTunnel([string]$RuntimeRoot, [string]$NgrokExe, [string]$ProviderEndpointId, [string]$PublicHost, [Parameter(Mandatory=$true)][int]$Port, [string]$AuthtokenFile) {
  $runtime = Get-YyCanonicalPath $RuntimeRoot
  $exe = Get-YyCanonicalPath $NgrokExe
  if (-not (Test-Path -LiteralPath $exe)) { throw 'NGROK_EXECUTABLE_MISSING' }
  if ($Port -lt 1 -or $Port -gt 65535 -or $Port -eq 8168) { throw 'PORT_INVALID_OR_RESERVED' }
  if ($PublicHost -notmatch '^[A-Za-z0-9.-]+$' -or [string]::IsNullOrWhiteSpace($ProviderEndpointId)) { throw 'ENDPOINT_IDENTITY_INVALID' }
  $configPath = Join-Path $runtime 'config.json'
  try { $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json } catch { throw 'RUNTIME_CONFIG_INVALID' }
  if ($config.server.portSelectionState -ne 'SELECTED_AFTER_FREE_PORT_CHECK' -or [int]$config.server.port -ne $Port) { throw 'PORT_NOT_FROZEN_OR_MISMATCH' }
  if ($config.tunnel.selectionState -notin @('UNSELECTED_W2_P1','SELECTED_AFTER_W2_PASS')) { throw 'TUNNEL_SELECTION_STATE_INVALID' }
  if ($config.tunnel.selectionState -eq 'SELECTED_AFTER_W2_PASS' -and ($config.tunnel.provider -ne 'ngrok' -or $config.tunnel.endpointIdentity.providerEndpointId -ne $ProviderEndpointId -or $config.tunnel.endpointIdentity.publicHost -ne $PublicHost -or $config.tunnel.executablePath -ine $exe -or [int]$config.tunnel.targetPort -ne $Port -or $config.tunnel.targetHost -ne '127.0.0.1')) { throw 'TUNNEL_CONFIG_MISMATCH' }
  if ([string]::IsNullOrWhiteSpace($AuthtokenFile)) {
    $localConfigPath = Join-Path $runtime 'credentials.local.json'
    if (Test-Path -LiteralPath $localConfigPath -PathType Leaf) {
      try {
        $localConfig = Get-Content -LiteralPath $localConfigPath -Raw | ConvertFrom-Json
        $AuthtokenFile = [string]$localConfig.ngrokAuthtokenFile
      } catch { throw 'RUNTIME_CONFIG_INVALID' }
      if (-not [string]::IsNullOrWhiteSpace($AuthtokenFile) -and -not [IO.Path]::IsPathRooted($AuthtokenFile)) {
        $AuthtokenFile = Join-Path $runtime $AuthtokenFile
      }
    }
  }
  if ([string]::IsNullOrWhiteSpace($AuthtokenFile) -or -not (Test-Path -LiteralPath $AuthtokenFile -PathType Leaf)) { throw 'NGROK_TOKEN_FILE_MISSING' }
  $credentialPath = Get-YyCanonicalPath $AuthtokenFile
  try { $credential = [IO.File]::ReadAllText($credentialPath).Trim() } catch { throw 'NGROK_TOKEN_FILE_UNREADABLE' }
  if ([string]::IsNullOrWhiteSpace($credential)) { throw 'NGROK_TOKEN_FILE_EMPTY' }
  $serverRecord = Read-YyProcessRecord (Join-Path $runtime 'server.pid')
  if (-not $serverRecord -or $serverRecord.role -ne 'server' -or [int]$serverRecord.port -ne $Port -or (Test-YyRecordIdentity $serverRecord).code -ne 'PID_OWNER_MATCH') { throw 'YY_SERVER_NOT_VERIFIED' }
  $serverOwner = Get-YyPortOwner $Port
  if (-not $serverOwner -or $serverOwner.pid -ne [int]$serverRecord.pid) { throw 'YY_SERVER_PORT_OWNER_MISMATCH' }
  $tunnelPath = Join-Path $runtime 'tunnel.pid'
  $old = Read-YyProcessRecord $tunnelPath
  if ($old) {
    $oldCheck = Test-YyRecordIdentity $old
    if ($oldCheck.code -eq 'PID_NOT_FOUND') {
      $clear = Remove-YyStaleRecord $tunnelPath ([int]$old.pid)
      if ($clear.code -ne 'STALE_PID_CLEARED') { throw $clear.code }
    } elseif ($oldCheck.code -eq 'PID_OWNER_MATCH') { throw 'YY_TUNNEL_ALREADY_RUNNING' }
    else { throw 'PID_OWNER_MISMATCH' }
  }

  $instanceId = [guid]::NewGuid().ToString().ToLowerInvariant()
  $cwd = Get-YyCanonicalPath (Split-Path -Parent $runtime)
  $configIdentity = [ordered]@{ provider='ngrok'; endpointId=$ProviderEndpointId; publicHost=$PublicHost; targetHost='127.0.0.1'; targetPort=$Port; executablePath=$exe }
  $configHash = Get-YySha256Text (ConvertTo-Json -InputObject $configIdentity -Compress)
  $cwdHash = Get-YySha256Text ($cwd.ToLowerInvariant())
  $agentConfig = Join-Path $runtime "yy-tunnel-$instanceId-$configHash-$cwdHash.yml"
  [IO.File]::WriteAllText($agentConfig, (Get-YyNgrokConfigTemplate), (New-Object Text.UTF8Encoding($false)))
  $argv = @('http', "http://127.0.0.1:$Port", "--url=https://$PublicHost", "--config=$agentConfig") | ForEach-Object { ConvertTo-YyWindowsArgument ([string]$_) }
  $startInfo = New-Object Diagnostics.ProcessStartInfo
  $startInfo.FileName = $exe
  $startInfo.Arguments = ($argv -join ' ')
  $startInfo.WorkingDirectory = $cwd
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $startInfo.EnvironmentVariables['NGROK_AUTHTOKEN'] = $credential
  $process = New-Object Diagnostics.Process
  $process.StartInfo = $startInfo
  try { $started = $process.Start() } catch { $credential = $null; throw 'TUNNEL_START_FAILED' }
  [void]$startInfo.EnvironmentVariables.Remove('NGROK_AUTHTOKEN')
  $credential = $null
  $stdoutTask = $process.StandardOutput.ReadToEndAsync()
  $stderrTask = $process.StandardError.ReadToEndAsync()
  $deadline = [DateTime]::UtcNow.AddSeconds(5)
  $snapshot = $null
  while ([DateTime]::UtcNow -lt $deadline) {
    Start-Sleep -Milliseconds 250
    $snapshot = Get-YyProcessSnapshot $process.Id
    if ($snapshot -or $process.HasExited) { break }
  }
  if (-not $snapshot) {
    $exitCode = Get-YyNgrokExitCode $process $stdoutTask $stderrTask
    if ($exitCode -and $exitCode -ne 'NGROK_AGENT_EXITED') { throw "NGROK_AGENT_EXITED_$exitCode" }
    if ($exitCode) { throw $exitCode }
    throw 'TUNNEL_START_FAILED'
  }

  $record = [ordered]@{
    schema='yy/runtime-process-record@1'; role='tunnel'; pid=$process.Id
    executablePath=$snapshot.executablePath; workingDirectory=$cwd
    commandLineSha256=Get-YySha256Text $snapshot.commandLine; instanceId=$instanceId
    processStartedAtUtc=$snapshot.processStartedAtUtc; configSha256=$configHash
    provider='ngrok'; providerEndpointId=$ProviderEndpointId; targetHost='127.0.0.1'; targetPort=$Port
  }
  if ($record.targetHost -ne '127.0.0.1') { throw 'TUNNEL_TARGET_HOST_INVALID' }
  if ((Test-YyRecordIdentity $record).code -ne 'PID_OWNER_MATCH') { throw 'PID_OWNER_MISMATCH' }
  Write-YyAtomicJson $tunnelPath $record
  Write-YyLifecycleEvent -RuntimeRoot $runtime -Code 'TUNNEL_STARTED' -ProcessId $process.Id -Port $Port
  $ready = $false
  $readyUntil = [DateTime]::UtcNow.AddSeconds(30)
  while ([DateTime]::UtcNow -lt $readyUntil) {
    if ($process.HasExited) { break }
    if (Test-YyTunnelEndpointHealth $record $PublicHost) { $ready = $true; break }
    Start-Sleep -Seconds 2
  }
  if (-not $ready) {
    if ($process.HasExited) {
      $exitCode = Get-YyNgrokExitCode $process $stdoutTask $stderrTask
      $stopped = Stop-YyOwnedProcess -RuntimeRoot $runtime -Role tunnel
      if ($stopped.code -notin @('STOPPED_OWNED_PROCESS','STALE_PID_CLEARED')) { throw $stopped.code }
      if ($exitCode -and $exitCode -ne 'NGROK_AGENT_EXITED') { throw "NGROK_AGENT_EXITED_$exitCode" }
      if ($exitCode) { throw $exitCode }
    } else {
      $stopped = Stop-YyOwnedProcess -RuntimeRoot $runtime -Role tunnel
      if ($stopped.code -ne 'STOPPED_OWNED_PROCESS') { throw $stopped.code }
    }
    throw 'TUNNEL_ENDPOINT_NOT_READY'
  }
  if ($config.tunnel.selectionState -eq 'UNSELECTED_W2_P1') {
    $config.tunnel.selectionState = 'SELECTED_AFTER_W2_PASS'
    $config.tunnel.provider = 'ngrok'
    $config.tunnel.executablePath = $exe
    $config.tunnel.endpointIdentity = [ordered]@{ providerEndpointId=$ProviderEndpointId; publicHost=$PublicHost }
    $config.tunnel.targetHost = '127.0.0.1'
    $config.tunnel.targetPort = $Port
    Write-YyAtomicJson -Path $configPath -Value $config
  }
  return [pscustomobject]@{ code='TUNNEL_STARTED'; pid=$process.Id; port=$Port; instanceId=$instanceId }
}
function Invoke-YyBoundedTunnelRestart([string]$RuntimeRoot, $Record, $Config, [string]$Reason) {
  if (-not $Config.tunnel -or $Config.tunnel.selectionState -ne 'SELECTED_AFTER_W2_PASS' -or $Config.tunnel.provider -ne 'ngrok') {
    return [pscustomobject]@{ code='TUNNEL_NOT_CONFIGURED'; action='none'; reason=$Reason }
  }
  try {
    if ($script:YyTunnelStartProvider) {
      $started = & $script:YyTunnelStartProvider $RuntimeRoot ([string]$Config.tunnel.executablePath) ([string]$Config.tunnel.endpointIdentity.providerEndpointId) ([string]$Config.tunnel.endpointIdentity.publicHost) ([int]$Config.server.port)
    } else {
      $started = Start-YyNgrokTunnel -RuntimeRoot $RuntimeRoot -NgrokExe ([string]$Config.tunnel.executablePath) -ProviderEndpointId ([string]$Config.tunnel.endpointIdentity.providerEndpointId) -PublicHost ([string]$Config.tunnel.endpointIdentity.publicHost) -Port ([int]$Config.server.port)
    }
    return [pscustomobject]@{ code='TUNNEL_RESTARTED'; action='restart_once'; reason=$Reason; pid=$started.pid; port=$started.port }
  } catch {
    return [pscustomobject]@{ code='TUNNEL_RESTART_FAILED'; action='restart_once'; reason=$Reason; detail=$_.Exception.Message }
  }
}

function Invoke-YyTunnelWatchdogOnce([string]$RuntimeRoot) {
  $runtime = Get-YyCanonicalPath $RuntimeRoot
  $path = Join-Path $runtime 'tunnel.pid'
  try { $record = Read-YyProcessRecord $path } catch { return [pscustomobject]@{ code='PID_RECORD_INVALID'; action='none' } }
  if (-not $record) { return [pscustomobject]@{ code='TUNNEL_NOT_CONFIGURED'; action='none' } }
  $configPath = Join-Path $runtime 'config.json'
  try { $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json } catch { return [pscustomobject]@{ code='RUNTIME_CONFIG_INVALID'; action='none' } }
  if ($config.tunnel.selectionState -ne 'SELECTED_AFTER_W2_PASS' -or $config.tunnel.provider -ne 'ngrok') { return [pscustomobject]@{ code='TUNNEL_NOT_CONFIGURED'; action='none' } }
  $identity = Test-YyRecordIdentity $record
  if ($identity.code -eq 'PID_NOT_FOUND') {
    $clear = Remove-YyStaleRecord $path ([int]$record.pid)
    if ($clear.code -ne 'STALE_PID_CLEARED') { return [pscustomobject]@{ code=$clear.code; action='none' } }
    return Invoke-YyBoundedTunnelRestart $runtime $record $config 'STALE_TUNNEL_PID_CLEARED'
  }
  if ($identity.code -ne 'PID_OWNER_MATCH') { return [pscustomobject]@{ code=$identity.code; action='none' } }
  if ($record.provider -ne 'ngrok' -or $record.providerEndpointId -ne $config.tunnel.endpointIdentity.providerEndpointId -or [int]$record.targetPort -ne [int]$config.server.port -or $record.targetHost -ne '127.0.0.1' -or $record.targetHost -ne $config.tunnel.targetHost) {
    return [pscustomobject]@{ code='TUNNEL_OWNER_MISMATCH'; action='none' }
  }
  $publicHost = [string]$config.tunnel.endpointIdentity.publicHost
  if (Test-YyTunnelEndpointHealth $record $publicHost) { return [pscustomobject]@{ code='TUNNEL_HEALTHY'; action='none'; pid=[int]$record.pid } }
  $stopped = Stop-YyOwnedProcess -RuntimeRoot $runtime -Role tunnel
  if ($stopped.code -ne 'STOPPED_OWNED_PROCESS') { return [pscustomobject]@{ code=$stopped.code; action='none' } }
  return Invoke-YyBoundedTunnelRestart $runtime $record $config 'TUNNEL_ENDPOINT_UNHEALTHY'
}

Export-ModuleMember -Function Get-YyCanonicalPath,Get-YySha256Text,Write-YyAtomicJson,New-YyRuntimeConfig,Get-YyProcessSnapshot,Test-YyRecordIdentity,Read-YyProcessRecord,Stop-YyOwnedProcess,Test-YyLoopbackPortFree,Get-YyPortOwner,Start-YyServer,Start-YyNgrokTunnel,Invoke-YyWatchdogOnce,Invoke-YyTunnelWatchdogOnce,Test-YyTunnelEndpointHealth
