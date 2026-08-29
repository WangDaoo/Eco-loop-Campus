param(
    [string] $DatabaseName = "ecoloop_campus",
    [string] $AppUser = "ecoloop_app",
    [string] $HostName = "127.0.0.1",
    [int] $Port = 5432,
    [string] $PostgresBin = "C:\Program Files\PostgreSQL\17\bin"
)

$ErrorActionPreference = "Stop"

$ProjectDir = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$RuntimeDir = Join-Path $ProjectDir ".runtime"
$SchemaPath = Join-Path $PSScriptRoot "schema.sql"
$SmokePath = Join-Path $PSScriptRoot "smoke_qr_flow.sql"
$PostgresPasswordPath = Join-Path $RuntimeDir "postgres_password.txt"
$AppPasswordPath = Join-Path $RuntimeDir "ecoloop_db_password.txt"
$DatabaseUrlPath = Join-Path $RuntimeDir "DATABASE_URL.txt"
$Psql = Join-Path $PostgresBin "psql.exe"
$Createdb = Join-Path $PostgresBin "createdb.exe"

if (-not (Test-Path -LiteralPath $Psql)) {
    throw "Khong tim thay psql.exe tai $Psql. Hay cai PostgreSQL 17 truoc."
}

New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null

if (-not (Test-Path -LiteralPath $PostgresPasswordPath)) {
    throw "Thieu $PostgresPasswordPath. File nay duoc tao khi cai PostgreSQL lan dau."
}

if (Test-Path -LiteralPath $AppPasswordPath) {
    $AppPassword = (Get-Content -LiteralPath $AppPasswordPath -Raw).Trim()
} else {
    $Bytes = New-Object byte[] 18
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($Bytes)
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
