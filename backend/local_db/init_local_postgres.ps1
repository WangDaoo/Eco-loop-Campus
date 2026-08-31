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

function ConvertFrom-SecureStringToPlainText([Security.SecureString] $SecureValue) {
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}

function Invoke-ExternalChecked([string] $ErrorMessage, [scriptblock] $Command) {
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw $ErrorMessage
    }
}

function Test-PostgresSuperPassword([string] $Password) {
    $previousPassword = $env:PGPASSWORD
    $env:PGPASSWORD = $Password
    try {
        & $Psql -h $HostName -p $Port -U postgres -d postgres -tAc "SELECT 1" > $null 2>&1
        return $LASTEXITCODE -eq 0
    }
    finally {
        $env:PGPASSWORD = $previousPassword
    }
}

function Read-PostgresSuperPassword() {
    New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null

    if (Test-Path -LiteralPath $PostgresPasswordPath) {
        $savedPassword = (Get-Content -LiteralPath $PostgresPasswordPath -Raw).Trim()
        if (Test-PostgresSuperPassword $savedPassword) {
            return $savedPassword
        }
        Write-Host "[WARN] Mat khau trong $PostgresPasswordPath khong dung voi PostgreSQL hien tai."
    }

    if (-not [string]::IsNullOrWhiteSpace($env:SETUP_POSTGRES_PASSWORD)) {
        $password = $env:SETUP_POSTGRES_PASSWORD.Trim()
        if (-not (Test-PostgresSuperPassword $password)) {
            throw "Mat khau PostgreSQL user postgres khong dung. Kiem tra lai SETUP_POSTGRES_PASSWORD."
        }
        Set-Content -LiteralPath $PostgresPasswordPath -Value $password -Encoding ASCII
        Write-Host "[OK] postgres_password.txt da duoc tao tu SETUP_POSTGRES_PASSWORD."
        return $password
    }

    Write-Host "[WARN] Thieu $PostgresPasswordPath."
    Write-Host "[INFO] Neu PostgreSQL da cai san, nhap mat khau cua user postgres de script tao database Eco-loop."
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        $securePassword = Read-Host -Prompt "Nhap mat khau PostgreSQL user postgres" -AsSecureString
        $password = (ConvertFrom-SecureStringToPlainText $securePassword).Trim()
        if ([string]::IsNullOrWhiteSpace($password)) {
            throw "Chua nhap mat khau PostgreSQL user postgres."
        }

        if (Test-PostgresSuperPassword $password) {
            Set-Content -LiteralPath $PostgresPasswordPath -Value $password -Encoding ASCII
            Write-Host "[OK] postgres_password.txt da duoc tao. Lan sau script se dung lai file nay."
            return $password
        }

        Write-Host "[WARN] Mat khau PostgreSQL user postgres khong dung. Thu lai ($attempt/3)."
    }

    throw "Mat khau PostgreSQL user postgres khong dung sau 3 lan thu."
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

if (Test-Path -LiteralPath $AppPasswordPath) {
    $AppPassword = (Get-Content -LiteralPath $AppPasswordPath -Raw).Trim()
} else {
    $Bytes = Get-SecureRandomBytes 18
    $AppPassword = "EcoApp-" + [Convert]::ToBase64String($Bytes).Replace("+", "A").Replace("/", "B").TrimEnd("=")
    Set-Content -LiteralPath $AppPasswordPath -Value $AppPassword -Encoding ASCII
}

$env:PGPASSWORD = Read-PostgresSuperPassword
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
Invoke-ExternalChecked "Tao/cap nhat PostgreSQL role $AppUser that bai." {
    $CreateRoleSql | & $Psql -h $HostName -p $Port -U postgres -d postgres -v ON_ERROR_STOP=1
}

& $Psql -h $HostName -p $Port -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DatabaseName'" > "$env:TEMP\ecoloop_db_exists.txt"
if ($LASTEXITCODE -ne 0) {
    throw "Kiem tra database $DatabaseName that bai."
}
$DbExistsOutput = Get-Content -LiteralPath "$env:TEMP\ecoloop_db_exists.txt" -ErrorAction SilentlyContinue
$DbExists = ($DbExistsOutput | Select-Object -First 1)
if ([string]::IsNullOrWhiteSpace($DbExists)) {
    Invoke-ExternalChecked "Tao database $DatabaseName that bai." {
        & $Createdb -h $HostName -p $Port -U postgres -O $AppUser $DatabaseName
    }
}

Invoke-ExternalChecked "Gan quyen database $DatabaseName cho $AppUser that bai." {
    & $Psql -h $HostName -p $Port -U postgres -d postgres -v ON_ERROR_STOP=1 -c "GRANT ALL PRIVILEGES ON DATABASE $DatabaseName TO $AppUser;"
}

Set-Content -LiteralPath $DatabaseUrlPath -Value "postgresql://${AppUser}:${AppPassword}@${HostName}:${Port}/${DatabaseName}" -Encoding ASCII

$env:PGPASSWORD = $AppPassword
Invoke-ExternalChecked "Apply schema.sql that bai." {
    Get-Content -LiteralPath $SchemaPath -Raw -Encoding UTF8 | & $Psql -h $HostName -p $Port -U $AppUser -d $DatabaseName -v ON_ERROR_STOP=1
}

Invoke-ExternalChecked "Smoke QR flow that bai." {
    Get-Content -LiteralPath $SmokePath -Raw -Encoding UTF8 | & $Psql -h $HostName -p $Port -U $AppUser -d $DatabaseName -v ON_ERROR_STOP=1
}

Write-Host "[OK] Local PostgreSQL ready: ${HostName}:${Port}/${DatabaseName}"
Write-Host "[OK] DATABASE_URL saved to $DatabaseUrlPath"
