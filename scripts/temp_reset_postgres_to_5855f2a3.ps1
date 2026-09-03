param(
    [string] $DatabaseName = "ecoloop_campus",
    [string] $HostName = "127.0.0.1",
    [int] $Port = 5432,
    [string] $PostgresBin = "",
    [string] $AdminEmail = "admin@school.edu.vn",
    [string] $AdminName = "Eco-loop Admin",
    [string] $AdminPassword = "123456"
)

$ErrorActionPreference = "Stop"

$ProjectDir = Resolve-Path (Join-Path $PSScriptRoot "..")
$RuntimeDir = Join-Path $ProjectDir ".runtime"
$BackupDir = Join-Path $RuntimeDir "db_backups"
$PostgresPasswordPath = Join-Path $RuntimeDir "postgres_password.txt"
$InitScript = Join-Path $ProjectDir "backend\local_db\init_local_postgres.ps1"
$BootstrapAdminScript = Join-Path $ProjectDir "scripts\bootstrap_local_admin.ps1"

function ConvertFrom-SecureStringToPlainText([Security.SecureString] $SecureValue) {
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}

function Find-PostgresBin() {
    if (-not [string]::IsNullOrWhiteSpace($PostgresBin)) {
        return $PostgresBin
    }

    $command = Get-Command "psql.exe" -ErrorAction SilentlyContinue
    if ($command -and (Test-Path -LiteralPath $command.Source)) {
        return Split-Path -Parent $command.Source
    }

    $roots = @(
        "${env:ProgramFiles}\PostgreSQL",
        "${env:ProgramFiles(x86)}\PostgreSQL"
    ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }

    foreach ($root in $roots) {
        $candidate = Get-ChildItem -LiteralPath $root -Directory |
            Sort-Object { [int]($_.Name -replace '[^\d]', '') } -Descending |
            ForEach-Object { Join-Path $_.FullName "bin" } |
            Where-Object { Test-Path -LiteralPath (Join-Path $_ "psql.exe") } |
            Select-Object -First 1
        if ($candidate) {
            return $candidate
        }
    }

    return "C:\Program Files\PostgreSQL\17\bin"
}

function Invoke-ExternalChecked([string] $ErrorMessage, [scriptblock] $Command) {
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & $Command
        if ($LASTEXITCODE -ne 0) {
            throw $ErrorMessage
        }
    }
    finally {
        $ErrorActionPreference = $previousPreference
    }
}

function Test-PostgresPassword([string] $Password) {
    $previousPassword = $env:PGPASSWORD
    $previousPreference = $ErrorActionPreference
    $env:PGPASSWORD = $Password
    $ErrorActionPreference = "Continue"
    try {
        & $Psql -h $HostName -p $Port -U postgres -d postgres -tAc "SELECT 1" > $null 2>&1
        return $LASTEXITCODE -eq 0
    }
    finally {
        $env:PGPASSWORD = $previousPassword
        $ErrorActionPreference = $previousPreference
    }
}

function Read-PostgresPassword() {
    if (Test-Path -LiteralPath $PostgresPasswordPath) {
        $savedPassword = (Get-Content -LiteralPath $PostgresPasswordPath -Raw).Trim()
        if (Test-PostgresPassword $savedPassword) {
            return $savedPassword
        }
        Write-Host "[WARN] Mat khau trong .runtime\postgres_password.txt khong dung voi PostgreSQL hien tai."
    }

    if (-not [string]::IsNullOrWhiteSpace($env:SETUP_POSTGRES_PASSWORD)) {
        $password = $env:SETUP_POSTGRES_PASSWORD.Trim()
        if (Test-PostgresPassword $password) {
            Set-Content -LiteralPath $PostgresPasswordPath -Value $password -Encoding ASCII
            return $password
        }
        throw "SETUP_POSTGRES_PASSWORD khong dung voi user postgres."
    }

    for ($attempt = 1; $attempt -le 3; $attempt++) {
        $securePassword = Read-Host -Prompt "Nhap mat khau PostgreSQL user postgres" -AsSecureString
        $password = (ConvertFrom-SecureStringToPlainText $securePassword).Trim()
        if (Test-PostgresPassword $password) {
            Set-Content -LiteralPath $PostgresPasswordPath -Value $password -Encoding ASCII
            return $password
        }
        Write-Host "[WARN] Mat khau postgres sai. Thu lai ($attempt/3)."
    }

    throw "Khong xac thuc duoc PostgreSQL user postgres."
}

if (-not (Test-Path -LiteralPath $InitScript)) {
    throw "Khong tim thay backend\local_db\init_local_postgres.ps1."
}

if (-not (Test-Path -LiteralPath $BootstrapAdminScript)) {
    throw "Khong tim thay scripts\bootstrap_local_admin.ps1."
}

Write-Host "[WARN] Script nay se XOA database '$DatabaseName' hien tai va tao lai theo schema cua checkpoint 5855f2a3."
Write-Host "[WARN] Script se backup truoc vao .runtime\db_backups, nhung nen dong backend/web truoc khi chay."
$confirm = Read-Host "Go chinh xac 'RESET ECOLOOP DB' de tiep tuc"
if ($confirm -ne "RESET ECOLOOP DB") {
    Write-Host "[CANCEL] Khong reset PostgreSQL."
    exit 2
}

$ResolvedPostgresBin = Find-PostgresBin
$Psql = Join-Path $ResolvedPostgresBin "psql.exe"
$PgDump = Join-Path $ResolvedPostgresBin "pg_dump.exe"

if (-not (Test-Path -LiteralPath $Psql)) {
    throw "Khong tim thay psql.exe tai $Psql."
}

if (-not (Test-Path -LiteralPath $PgDump)) {
    throw "Khong tim thay pg_dump.exe tai $PgDump."
}

New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

$env:PGPASSWORD = Read-PostgresPassword

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = Join-Path $BackupDir "${DatabaseName}_before_5855f2a3_reset_${timestamp}.dump"
$databaseExists = (& $Psql -h $HostName -p $Port -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DatabaseName'").Trim()
if ($LASTEXITCODE -ne 0) {
    throw "Khong kiem tra duoc database $DatabaseName."
}

if (-not [string]::IsNullOrWhiteSpace($databaseExists)) {
    Write-Host "[1/4] Backup database hien tai..."
    Invoke-ExternalChecked "Backup database $DatabaseName that bai." {
        & $PgDump -h $HostName -p $Port -U postgres -d $DatabaseName -Fc -f $backupPath
    }
    Write-Host "[OK] Backup: $backupPath"
}
else {
    Write-Host "[1/4] Database $DatabaseName chua ton tai, bo qua backup."
}

Write-Host "[2/4] Drop database cu..."
$dropSql = "DROP DATABASE IF EXISTS $DatabaseName WITH (FORCE);"
Invoke-ExternalChecked "Drop database $DatabaseName that bai. Hay dong backend/web roi chay lai." {
    & $Psql -h $HostName -p $Port -U postgres -d postgres -v ON_ERROR_STOP=1 -c $dropSql
}

Write-Host "[3/4] Tao lai database va apply schema checkpoint 5855f2a3..."
& powershell -NoProfile -ExecutionPolicy Bypass -File $InitScript -DatabaseName $DatabaseName -HostName $HostName -Port $Port -PostgresBin $ResolvedPostgresBin
if ($LASTEXITCODE -ne 0) {
    throw "init_local_postgres.ps1 that bai."
}

if ($env:RESET_BOOTSTRAP_ADMIN -eq "0") {
    Write-Host "[4/4] Bo qua bootstrap admin vi RESET_BOOTSTRAP_ADMIN=0."
}
else {
    Write-Host "[4/4] Bootstrap admin mac dinh..."
    & powershell -NoProfile -ExecutionPolicy Bypass -File $BootstrapAdminScript -Email $AdminEmail -Name $AdminName -Password $AdminPassword
    if ($LASTEXITCODE -ne 0) {
        throw "bootstrap_local_admin.ps1 that bai."
    }
    Write-Host "[OK] Admin: $AdminEmail / $AdminPassword"
}

Write-Host "[OK] PostgreSQL da ve schema checkpoint 5855f2a3."
