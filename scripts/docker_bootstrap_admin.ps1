param(
    [string]$Email = "admin@school.edu.vn",
    [string]$Name = "Eco-loop Admin",
    [string]$Password = "123456"
)

$ErrorActionPreference = "Stop"

$ProjectDir = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $ProjectDir ".env.docker"
$BootstrapSql = Join-Path $ProjectDir "backend\local_db\bootstrap_admin.sql"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Chua cai Docker Desktop hoac docker chua co trong PATH."
}

if (-not (Test-Path $EnvFile)) {
    throw "Chua co .env.docker. Hay chay start_docker.bat truoc."
}

if (-not (Test-Path $BootstrapSql)) {
    throw "Khong tim thay backend\local_db\bootstrap_admin.sql."
}

$envValues = @{}
Get-Content $EnvFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
        $parts = $line.Split("=", 2)
        $envValues[$parts[0].Trim()] = $parts[1].Trim()
    }
}

$DbUser = $envValues["POSTGRES_USER"]
$DbName = $envValues["POSTGRES_DB"]
if (-not $DbUser -or -not $DbName) {
    throw ".env.docker thieu POSTGRES_USER hoac POSTGRES_DB."
}

function ConvertTo-Base64Url([byte[]]$Bytes) {
    return [Convert]::ToBase64String($Bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

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

$saltBytes = Get-SecureRandomBytes 16
$Salt = -join ($saltBytes | ForEach-Object { $_.ToString("x2") })
$Iterations = 120000
$derive = [Security.Cryptography.Rfc2898DeriveBytes]::new(
    $Password,
    [Text.Encoding]::ASCII.GetBytes($Salt),
    $Iterations,
    [Security.Cryptography.HashAlgorithmName]::SHA256
)
$Digest = ConvertTo-Base64Url $derive.GetBytes(32)
$PasswordHash = "pbkdf2_sha256`$$Iterations`$$Salt`$$Digest"

Push-Location $ProjectDir
try {
    Get-Content -Raw $BootstrapSql | docker compose --env-file $EnvFile exec -T postgres `
        psql -U $DbUser -d $DbName `
        -v "admin_email=$Email" `
        -v "admin_name=$Name" `
        -v "password_hash=$PasswordHash" `
        -f -
}
finally {
    Pop-Location
}

Write-Host "[OK] Da bootstrap admin: $Email"
