param(
    [string] $DatabaseName = "ecoloop_campus",
    [string] $AppUser = "ecoloop_app",
    [string] $HostName = "127.0.0.1",
    [int] $Port = 5432,
    [string] $PostgresBin = ""
)

$ErrorActionPreference = "Stop"

$ProjectDir = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$RuntimeDir = Join-Path $ProjectDir ".runtime"
$SchemaPath = Join-Path $PSScriptRoot "schema.sql"
$SmokePath = Join-Path $PSScriptRoot "smoke_qr_flow.sql"
$PostgresPasswordPath = Join-Path $RuntimeDir "postgres_password.txt"
$AppPasswordPath = Join-Path $RuntimeDir "ecoloop_db_password.txt"
$DatabaseUrlPath = Join-Path $RuntimeDir "DATABASE_URL.txt"

function Get-SecureRandomBytes([int] $Count) {
    $Bytes = New-Object byte[] $Count
    $Rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $Rng.GetBytes($Bytes)
    }
    finally {
        $Rng.Dispose()
    }
    return $Bytes
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

$ResolvedPostgresBin = Find-PostgresBin
$Psql = Join-Path $ResolvedPostgresBin "psql.exe"
$Createdb = Join-Path $ResolvedPostgresBin "createdb.exe"

if (-not (Test-Path -LiteralPath $Psql)) {
    throw "Khong tim thay psql.exe tai $Psql. Hay cai PostgreSQL native truoc."
}

New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null

if (-not (Test-Path -LiteralPath $PostgresPasswordPath)) {
    throw "Thieu $PostgresPasswordPath. File nay duoc tao khi cai PostgreSQL lan dau."
}

if (Test-Path -LiteralPath $AppPasswordPath) {
    $AppPassword = (Get-Content -LiteralPath $AppPasswordPath -Raw).Trim()
} else {
    $Bytes = Get-SecureRandomBytes 18
    $AppPassword = "EcoApp-" + [Convert]::ToBase64String($Bytes).Replace("+", "A").Replace("/", "B").TrimEnd("=")
    Set-Content -LiteralPath $AppPasswordPath -Value $AppPassword -Encoding ASCII
}

$env:PGPASSWORD = (Get-Content -LiteralPath $PostgresPasswordPath -Raw).Trim()
$CreateRoleSql = @"
DO `$`$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$AppUser') THEN
    CREATE ROLE $AppUser LOGIN PASSWORD '$AppPassword';
  ELSE
    ALTER ROLE $AppUser WITH LOGIN PASSWORD '$AppPassword';
  END IF;
END
`$`$;
"@
$CreateRoleSql | & $Psql -h $HostName -p $Port -U postgres -d postgres -v ON_ERROR_STOP=1

$DbExistsOutput = & $Psql -h $HostName -p $Port -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DatabaseName'"
$DbExists = ($DbExistsOutput | Select-Object -First 1)
if ([string]::IsNullOrWhiteSpace($DbExists)) {
    & $Createdb -h $HostName -p $Port -U postgres -O $AppUser $DatabaseName
}

& $Psql -h $HostName -p $Port -U postgres -d postgres -v ON_ERROR_STOP=1 -c "GRANT ALL PRIVILEGES ON DATABASE $DatabaseName TO $AppUser;"

Set-Content -LiteralPath $DatabaseUrlPath -Value "postgresql://${AppUser}:${AppPassword}@${HostName}:${Port}/${DatabaseName}" -Encoding ASCII

$env:PGPASSWORD = $AppPassword
Get-Content -LiteralPath $SchemaPath -Raw -Encoding UTF8 | & $Psql -h $HostName -p $Port -U $AppUser -d $DatabaseName -v ON_ERROR_STOP=1
if ($LASTEXITCODE -ne 0) {
    throw "Apply schema.sql that bai."
}

Get-Content -LiteralPath $SmokePath -Raw -Encoding UTF8 | & $Psql -h $HostName -p $Port -U $AppUser -d $DatabaseName -v ON_ERROR_STOP=1
if ($LASTEXITCODE -ne 0) {
    throw "Smoke QR flow that bai."
}

Write-Host "[OK] Local PostgreSQL ready: ${HostName}:${Port}/${DatabaseName}"
Write-Host "[OK] DATABASE_URL saved to $DatabaseUrlPath"
