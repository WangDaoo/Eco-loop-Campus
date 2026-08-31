param(
    [Parameter(Mandatory = $true)]
    [int] $Port,
    [string] $Name = "Eco-loop Campus",
    [string] $ProjectDir = ""
)

$ErrorActionPreference = "Stop"

function Normalize-ProjectDir([string] $Value) {
    if ([string]::IsNullOrWhiteSpace($Value)) {
        return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
    }

    $cleanPath = ([string] $Value).Trim(' "')
    $invalidChars = [System.IO.Path]::GetInvalidPathChars()
    foreach ($char in $invalidChars) {
        if ($cleanPath.IndexOf($char) -ge 0) {
            throw "ProjectDir contains invalid path characters after cleanup: $cleanPath"
        }
    }

    return (Resolve-Path -LiteralPath $cleanPath).Path
}

$ProjectDir = Normalize-ProjectDir $ProjectDir

function Get-ListeningPids([int] $TargetPort) {
    try {
        return @(Get-NetTCPConnection -LocalPort $TargetPort -State Listen -ErrorAction Stop |
            Select-Object -ExpandProperty OwningProcess -Unique |
            Where-Object { $_ -and $_ -gt 0 })
    }
    catch {
        $lines = netstat -ano -p tcp | Select-String ":$TargetPort\s+.*LISTENING\s+(\d+)"
        return @($lines | ForEach-Object {
            if ($_.Line -match "LISTENING\s+(\d+)$") { [int] $Matches[1] }
        } | Select-Object -Unique)
    }
}

function Get-ProcessInfo([int] $ProcessId) {
    $process = Get-WmiObject Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
    if ($process) {
        return $process
    }

    return [pscustomobject]@{
        ProcessId = $ProcessId
        Name = "unknown"
        CommandLine = ""
    }
}

function Test-IsEcoLoopProcess($ProcessInfo) {
    $commandLine = [string] $ProcessInfo.CommandLine
    $normalizedProjectDir = ([string] $ProjectDir).TrimEnd("\")

    if ($commandLine.IndexOf($normalizedProjectDir, [StringComparison]::OrdinalIgnoreCase) -ge 0) {
        return $true
    }
    if ($commandLine.IndexOf("serve_cra_build.js", [StringComparison]::OrdinalIgnoreCase) -ge 0) {
        return $true
    }
    if ($commandLine.IndexOf("uvicorn app:app", [StringComparison]::OrdinalIgnoreCase) -ge 0) {
        return $true
    }
    return $false
}

$pids = Get-ListeningPids $Port
if (-not $pids -or $pids.Count -eq 0) {
    Write-Host "[OK] Port $Port dang trong."
    exit 0
}

foreach ($listenerProcessId in $pids) {
    if ($listenerProcessId -eq $PID) {
        continue
    }

    $processInfo = Get-ProcessInfo $listenerProcessId
    $commandLine = [string] $processInfo.CommandLine

    if (-not (Test-IsEcoLoopProcess $processInfo)) {
        Write-Host "[ERROR] Port $Port belongs to another process."
        Write-Host "[ERROR] PID: $listenerProcessId"
        Write-Host "[ERROR] Name: $($processInfo.Name)"
        Write-Host "[ERROR] CommandLine: $commandLine"
        Write-Host "[FIX] Tat ung dung dang chiem port $Port hoac doi WEB_PORT/BACKEND_PORT roi chay lai."
        exit 1
    }

    Write-Host "[INFO] Dang tat tien trinh $Name cu tren port $Port. PID=$listenerProcessId"
    Stop-Process -Id $listenerProcessId -Force -ErrorAction Stop
}

Start-Sleep -Milliseconds 500
$remaining = Get-ListeningPids $Port
if ($remaining -and $remaining.Count -gt 0) {
    throw "Port $Port van dang bi chiem sau khi tat tien trinh cu."
}

Write-Host "[OK] Port $Port da san sang cho $Name."
