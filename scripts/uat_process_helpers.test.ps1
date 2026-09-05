$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$helpers = Join-Path $PSScriptRoot "uat_process_helpers.ps1"
if (-not (Test-Path -LiteralPath $helpers)) {
    throw "Missing UAT process helper module."
}
. $helpers

$runtime = Join-Path $root ".runtime"
New-Item -ItemType Directory -Force -Path $runtime | Out-Null
$pidFile = Join-Path $runtime "uat_process_helper_test.json"
$process = $null
$treeRoot = $null
$treeChildPid = $null
$listener = $null
try {
    $process = Start-Process -FilePath "powershell.exe" -ArgumentList @("-NoProfile", "-Command", "Start-Sleep -Seconds 60") -WindowStyle Hidden -PassThru
    Save-UatProcessIdentity -Process $process -Path $pidFile -Kind "test"
    $record = Get-Content -LiteralPath $pidFile -Raw | ConvertFrom-Json
    $record.executable = "C:\definitely-not-the-real-process.exe"
    $record | ConvertTo-Json | Set-Content -LiteralPath $pidFile -Encoding UTF8

    $refused = $false
    try { Stop-UatRecordedProcess -Path $pidFile -Name "stale test" -Quiet } catch { $refused = $true }
    if (-not $refused) { throw "A stale/reused PID identity must be refused." }
    if (-not (Get-Process -Id $process.Id -ErrorAction SilentlyContinue)) { throw "Identity mismatch killed an unrelated process." }

    Save-UatProcessIdentity -Process $process -Path $pidFile -Kind "test"
    Stop-UatRecordedProcess -Path $pidFile -Name "owned test" -Quiet
    if (Get-Process -Id $process.Id -ErrorAction SilentlyContinue) { throw "Owned test process was not stopped." }

    $childPidFile = Join-Path $runtime "uat_process_tree_child.pid"
    $treePidFile = Join-Path $runtime "uat_process_tree_test.json"
    $treeCommand = @"
`$child = Start-Process powershell.exe -ArgumentList @('-NoProfile', '-Command', 'Start-Sleep -Seconds 60') -WindowStyle Hidden -PassThru
Set-Content -LiteralPath '$childPidFile' -Value `$child.Id -Encoding ASCII
Start-Sleep -Seconds 60
"@
    $encodedTreeCommand = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($treeCommand))
    $treeRoot = Start-Process -FilePath "powershell.exe" -ArgumentList @("-NoProfile", "-EncodedCommand", $encodedTreeCommand) -WindowStyle Hidden -PassThru
    Save-UatProcessIdentity -Process $treeRoot -Path $treePidFile -Kind "tree-test"
    $treeDeadline = (Get-Date).AddSeconds(10)
    while (-not (Test-Path -LiteralPath $childPidFile) -and (Get-Date) -lt $treeDeadline) { Start-Sleep -Milliseconds 100 }
    if (-not (Test-Path -LiteralPath $childPidFile)) { throw "Test child process did not start." }
    $treeChildPid = [int](Get-Content -LiteralPath $childPidFile -Raw).Trim()
    Stop-UatRecordedProcessTree -Path $treePidFile -Name "owned process tree" -Quiet
    Start-Sleep -Milliseconds 250
    if (Get-Process -Id $treeRoot.Id -ErrorAction SilentlyContinue) { throw "Owned tree root was not stopped." }
    if (Get-Process -Id $treeChildPid -ErrorAction SilentlyContinue) { throw "Owned tree child was not stopped." }

    $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
    $listener.Start()
    $occupiedPort = ([Net.IPEndPoint]$listener.LocalEndpoint).Port
    $portRefused = $false
    try { Assert-UatPortAvailable -Port $occupiedPort } catch { $portRefused = $true }
    if (-not $portRefused) { throw "Occupied UAT port must be refused." }

    $good = [pscustomobject]@{ configured = $true; status = "ok"; database = "ecoloop_campus_uat" }
    $wrong = [pscustomobject]@{ configured = $true; status = "ok"; database = "ecoloop_campus" }
    if (-not (Test-UatHealthPayload -Payload $good -ExpectedDatabase "ecoloop_campus_uat")) { throw "Valid UAT health was rejected." }
    if (Test-UatHealthPayload -Payload $wrong -ExpectedDatabase "ecoloop_campus_uat") { throw "Wrong database health was accepted." }
}
finally {
    if ($listener) { $listener.Stop() }
    if ($process -and (Get-Process -Id $process.Id -ErrorAction SilentlyContinue)) { Stop-Process -Id $process.Id -Force }
    if ($treeRoot -and (Get-Process -Id $treeRoot.Id -ErrorAction SilentlyContinue)) { Stop-Process -Id $treeRoot.Id -Force }
    if ($treeChildPid -and (Get-Process -Id $treeChildPid -ErrorAction SilentlyContinue)) { Stop-Process -Id $treeChildPid -Force }
    Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $childPidFile, $treePidFile -Force -ErrorAction SilentlyContinue
}

Write-Host "UAT process helper behavior passed."
