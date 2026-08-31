param(
    [string]$Email = "admin@school.edu.vn",
    [string]$Name = "Eco-loop Admin",
    [string]$Password = "123456"
)

$ErrorActionPreference = "Stop"

$ProjectDir = Split-Path -Parent $PSScriptRoot
$RuntimeDatabaseUrlPath = Join-Path $ProjectDir ".runtime\DATABASE_URL.txt"
$BootstrapSql = Join-Path $ProjectDir "backend\local_db\bootstrap_admin.sql"

function Find-Psql() {
    $command = Get-Command "psql.exe" -ErrorAction SilentlyContinue
    if ($command -and (Test-Path -LiteralPath $command.Source)) {
        return $command.Source
    }

    $roots = @(
        "${env:ProgramFiles}\PostgreSQL",
        "${env:ProgramFiles(x86)}\PostgreSQL"
    ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }

    foreach ($root in $roots) {
        $candidate = Get-ChildItem -LiteralPath $root -Directory |
            Sort-Object { [int]($_.Name -replace '[^\d]', '') } -Descending |
            ForEach-Object { Join-Path $_.FullName "bin\psql.exe" } |
            Where-Object { Test-Path -LiteralPath $_ } |
            Select-Object -First 1
        if ($candidate) {
            return $candidate
        }
    }

    throw "Khong tim thay psql.exe. Hay cai PostgreSQL native truoc."
}

if (-not (Test-Path -LiteralPath $RuntimeDatabaseUrlPath)) {
    throw "Chua co .runtime\DATABASE_URL.txt. Hay chay start_backend.bat hoac backend\local_db\init_local_postgres.ps1 truoc."
}

if (-not (Test-Path -LiteralPath $BootstrapSql)) {
    throw "Khong tim thay backend\local_db\bootstrap_admin.sql."
}

function ConvertTo-Base64Url([byte[]]$Bytes) {
    return [Convert]::ToBase64String($Bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

$saltBytes = New-Object byte[] 16
[Security.Cryptography.RandomNumberGenerator]::Fill($saltBytes)
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

$Psql = Find-Psql
$DatabaseUrl = (Get-Content -LiteralPath $RuntimeDatabaseUrlPath -Raw).Trim()
Get-Content -Raw -LiteralPath $BootstrapSql | & $Psql $DatabaseUrl `
    -v ON_ERROR_STOP=1 `
    -v "admin_email=$Email" `
    -v "admin_name=$Name" `
    -v "password_hash=$PasswordHash" `
    -f -

Write-Host "[OK] Da bootstrap admin native PostgreSQL: $Email"
