[CmdletBinding()]
param(
    [string]$TestDatabaseUrl = $env:TEST_DATABASE_URL,
    [ValidateRange(1, 10)]
    [int]$Runs = 2
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$resultsRoot = Join-Path $repoRoot ".test-results"
$backendRoot = Join-Path $repoRoot "backend"
$mobileRoot = Join-Path $repoRoot "ecoloop-campus-mobile\ecoloop-campus-mobile"
$adminRoot = Join-Path $repoRoot "frontend\eco-loop-campus-admin"
$python = Join-Path $backendRoot ".venv\Scripts\python.exe"

if ([string]::IsNullOrWhiteSpace($TestDatabaseUrl)) {
    throw "TEST_DATABASE_URL is required. Use a dedicated PostgreSQL database whose name ends with '_test'."
}

try {
    $databaseUri = [System.Uri]$TestDatabaseUrl
} catch {
    throw "TEST_DATABASE_URL must be a valid PostgreSQL URL."
}
$databaseName = $databaseUri.AbsolutePath.Trim("/").ToLowerInvariant()
if (-not $databaseName.EndsWith("_test")) {
    throw "Refusing to run: TEST_DATABASE_URL database name must end with '_test'."
}
if (-not (Test-Path -LiteralPath $python)) {
    throw "Backend virtual environment was not found at backend/.venv."
}

New-Item -ItemType Directory -Path $resultsRoot -Force | Out-Null
$env:TEST_DATABASE_URL = $TestDatabaseUrl
$env:REQUIRE_TEST_DATABASE_URL = "1"
$env:CI = "true"

function Write-LayerResult {
    param(
        [string]$Path,
        [string]$Layer,
        [double]$Seconds,
        [int]$ExitCode
    )
    $settings = [System.Xml.XmlWriterSettings]::new()
    $settings.Indent = $true
    $settings.Encoding = [System.Text.UTF8Encoding]::new($false)
    $writer = [System.Xml.XmlWriter]::Create($Path, $settings)
    try {
        $writer.WriteStartDocument()
        $writer.WriteStartElement("testsuite")
        $writer.WriteAttributeString("name", $Layer)
        $writer.WriteAttributeString("tests", "1")
        $writer.WriteAttributeString("failures", $(if ($ExitCode -eq 0) { "0" } else { "1" }))
        $writer.WriteAttributeString("time", $Seconds.ToString("0.000", [System.Globalization.CultureInfo]::InvariantCulture))
        $writer.WriteStartElement("testcase")
        $writer.WriteAttributeString("classname", "ecoloop.gate")
        $writer.WriteAttributeString("name", $Layer)
        if ($ExitCode -ne 0) {
            $writer.WriteStartElement("failure")
            $writer.WriteAttributeString("message", "Layer exited with code $ExitCode")
            $writer.WriteEndElement()
        }
        $writer.WriteEndElement()
        $writer.WriteEndElement()
        $writer.WriteEndDocument()
    } finally {
        $writer.Dispose()
    }
}

function Invoke-TestLayer {
    param(
        [string]$Layer,
        [string]$WorkingDirectory,
        [string]$Command,
        [string[]]$Arguments,
        [string]$ResultPath
    )
    Write-Host "[$Layer] starting"
    $started = Get-Date
    $exitCode = 1
    Push-Location $WorkingDirectory
    try {
        & $Command @Arguments
        $exitCode = $LASTEXITCODE
    } finally {
        Pop-Location
    }
    $seconds = ((Get-Date) - $started).TotalSeconds
    if ($ResultPath) {
        Write-LayerResult -Path $ResultPath -Layer $Layer -Seconds $seconds -ExitCode $exitCode
    }
    if ($exitCode -ne 0) {
        throw "$Layer failed with exit code $exitCode."
    }
    Write-Host "[$Layer] passed in $([Math]::Round($seconds, 1))s"
}

for ($run = 1; $run -le $Runs; $run++) {
    Write-Host "=== EcoLoop automated logic gate: run $run of $Runs ==="
    $backendUnitXml = Join-Path $resultsRoot "backend-unit-run-$run.xml"
    $backendPostgresXml = Join-Path $resultsRoot "backend-postgres-run-$run.xml"
    Invoke-TestLayer -Layer "backend-unit-run-$run" -WorkingDirectory $backendRoot -Command $python -Arguments @(
        "-m", "pytest", "-q", "-m", "not postgres", "--junitxml=$backendUnitXml"
    )
    Invoke-TestLayer -Layer "backend-postgres-run-$run" -WorkingDirectory $backendRoot -Command $python -Arguments @(
        "-m", "pytest", "-q", "-m", "postgres", "--junitxml=$backendPostgresXml"
    )
    Invoke-TestLayer -Layer "mobile-tests-run-$run" -WorkingDirectory $mobileRoot -Command "npm.cmd" -Arguments @("test") -ResultPath (Join-Path $resultsRoot "mobile-tests-run-$run.xml")
    Invoke-TestLayer -Layer "mobile-typecheck-run-$run" -WorkingDirectory $mobileRoot -Command "npm.cmd" -Arguments @("run", "typecheck") -ResultPath (Join-Path $resultsRoot "mobile-typecheck-run-$run.xml")
    Invoke-TestLayer -Layer "admin-tests-run-$run" -WorkingDirectory $adminRoot -Command "npm.cmd" -Arguments @("test", "--", "--watchAll=false") -ResultPath (Join-Path $resultsRoot "admin-tests-run-$run.xml")
}

Write-Host "All $Runs gate run(s) passed. JUnit files: $resultsRoot"
