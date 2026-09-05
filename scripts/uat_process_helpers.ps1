Set-StrictMode -Version Latest

function Save-UatProcessIdentity {
    param(
        [Parameter(Mandatory = $true)] [System.Diagnostics.Process] $Process,
        [Parameter(Mandatory = $true)] [string] $Path,
        [Parameter(Mandatory = $true)] [string] $Kind
    )

    $Process.Refresh()
    $identity = [ordered]@{
        pid = $Process.Id
        kind = $Kind
        executable = $Process.Path
        startedUtc = $Process.StartTime.ToUniversalTime().ToString("o")
    }
    $identity | ConvertTo-Json | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Get-ValidatedUatProcess {
    param([Parameter(Mandatory = $true)] [string] $Path)

    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    $raw = (Get-Content -LiteralPath $Path -Raw).Trim()
    $legacyPid = 0
    if ([int]::TryParse($raw, [ref] $legacyPid)) {
        $legacyProcess = Get-Process -Id $legacyPid -ErrorAction SilentlyContinue
        if ($legacyProcess) {
            throw "Refusing legacy PID $legacyPid in $Path because it has no executable/start-time identity."
        }
        Remove-Item -LiteralPath $Path -Force
        return $null
    }

    try { $identity = $raw | ConvertFrom-Json } catch { throw "Invalid UAT process identity file: $Path" }
    if (-not $identity.pid -or -not $identity.executable -or -not $identity.startedUtc) {
        throw "Incomplete UAT process identity file: $Path"
    }

    $process = Get-Process -Id ([int]$identity.pid) -ErrorAction SilentlyContinue
    if (-not $process) {
        Remove-Item -LiteralPath $Path -Force
        return $null
    }

    $actualPath = $process.Path
    # PowerShell 7 may deserialize ISO-8601 JSON values directly to DateTime,
    # while Windows PowerShell keeps the same value as a string. Avoid
    # formatting a deserialized DateTime through the current culture because
    # day/month ordering can then change the recorded process identity.
    if ($identity.startedUtc -is [DateTime]) {
        $expectedStart = ([DateTime]$identity.startedUtc).ToUniversalTime()
    }
    else {
        $expectedStart = [DateTimeOffset]::Parse(
            [string]$identity.startedUtc,
            [Globalization.CultureInfo]::InvariantCulture,
            [Globalization.DateTimeStyles]::RoundtripKind
        ).UtcDateTime
    }
    $actualStart = $process.StartTime.ToUniversalTime()
    $startDelta = [Math]::Abs(($actualStart - $expectedStart).TotalSeconds)
    if (-not $actualPath.Equals([string]$identity.executable, [StringComparison]::OrdinalIgnoreCase) -or $startDelta -gt 2) {
        throw "Refusing PID $($identity.pid): executable or start time no longer matches $Path."
    }
    return $process
}

function Stop-UatRecordedProcess {
    param(
        [Parameter(Mandatory = $true)] [string] $Path,
        [Parameter(Mandatory = $true)] [string] $Name,
        [switch] $Quiet
    )

    $process = Get-ValidatedUatProcess -Path $Path
    if (-not $process) {
        if (-not $Quiet) { Write-Host "[INFO] Khong co tien trinh $Name hop le dang chay." }
        return
    }
    Stop-Process -Id $process.Id -Force
    try { Wait-Process -Id $process.Id -Timeout 10 -ErrorAction SilentlyContinue } catch {}
    Remove-Item -LiteralPath $Path -Force
    if (-not $Quiet) { Write-Host "[OK] Da dung $Name (PID $($process.Id))." }
}

function Get-UatDescendantProcesses {
    param([Parameter(Mandatory = $true)] [int] $RootPid)

    $all = @(Get-CimInstance Win32_Process)
    $pendingParents = [Collections.Generic.Queue[int]]::new()
    $pendingParents.Enqueue($RootPid)
    $descendants = [Collections.Generic.List[System.Diagnostics.Process]]::new()
    while ($pendingParents.Count -gt 0) {
        $parentPid = $pendingParents.Dequeue()
        foreach ($item in $all | Where-Object { [int]$_.ParentProcessId -eq $parentPid }) {
            $child = Get-Process -Id ([int]$item.ProcessId) -ErrorAction SilentlyContinue
            if ($child) {
                $descendants.Add($child)
                $pendingParents.Enqueue($child.Id)
            }
        }
    }
    return @($descendants)
}

function Stop-UatRecordedProcessTree {
    param(
        [Parameter(Mandatory = $true)] [string] $Path,
        [Parameter(Mandatory = $true)] [string] $Name,
        [switch] $Quiet
    )

    $rootProcess = Get-ValidatedUatProcess -Path $Path
    if (-not $rootProcess) {
        if (-not $Quiet) { Write-Host "[INFO] Khong co cay tien trinh $Name hop le dang chay." }
        return
    }

    $rootStartedUtc = $rootProcess.StartTime.ToUniversalTime()
    $descendants = @(Get-UatDescendantProcesses -RootPid $rootProcess.Id | Where-Object {
        $_.StartTime.ToUniversalTime() -ge $rootStartedUtc.AddSeconds(-1)
    })

    # Stop the verified launcher first so it cannot create more children, then
    # stop the exact descendants captured from its live process tree.
    Stop-Process -Id $rootProcess.Id -Force -ErrorAction SilentlyContinue
    foreach ($child in ($descendants | Sort-Object StartTime -Descending)) {
        Stop-Process -Id $child.Id -Force -ErrorAction SilentlyContinue
    }
    Remove-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
    if (-not $Quiet) { Write-Host "[OK] Da dung cay tien trinh $Name (PID goc $($rootProcess.Id))." }
}

function Assert-UatPortAvailable {
    param([Parameter(Mandatory = $true)] [int] $Port)

    $listener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($listener) {
        throw "Port UAT $Port dang duoc PID $($listener.OwningProcess) su dung. Hay chon port khac hoac dung dung server cu."
    }
}

function Get-UatListenerProcess {
    param([Parameter(Mandatory = $true)] [int] $Port)

    $listener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $listener) { return $null }
    return Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue
}

function Test-UatHealthPayload {
    param(
        [Parameter(Mandatory = $true)] $Payload,
        [Parameter(Mandatory = $true)] [string] $ExpectedDatabase
    )
    return $Payload.configured -eq $true -and $Payload.status -eq "ok" -and $Payload.database -eq $ExpectedDatabase
}

function Wait-UatHealthy {
    param(
        [Parameter(Mandatory = $true)] [string] $Url,
        [Parameter(Mandatory = $true)] [int] $TimeoutSeconds,
        [Parameter(Mandatory = $true)] [string] $ExpectedDatabase,
        [System.Diagnostics.Process] $Process
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        if ($Process) {
            $Process.Refresh()
            if ($Process.HasExited) { throw "Tien trinh UAT dung som voi exit code $($Process.ExitCode) trong khi cho $Url" }
        }
        try {
            $payload = Invoke-RestMethod -Uri $Url -TimeoutSec 15
            if (Test-UatHealthPayload -Payload $payload -ExpectedDatabase $ExpectedDatabase) { return $payload }
        }
        catch {
            if ((Get-Date) -ge $deadline) { break }
        }
        Start-Sleep -Seconds 2
    } while ((Get-Date) -lt $deadline)
    throw "Khong nhan duoc health UAT cho database $ExpectedDatabase tu $Url trong $TimeoutSeconds giay."
}
