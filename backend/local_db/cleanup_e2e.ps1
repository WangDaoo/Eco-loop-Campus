param(
    [string]$DatabaseUrl = "",
    [switch]$Apply
)

$ErrorActionPreference = "Stop"
$emails = @(
    "e2e_app_20260901013105@school.edu.vn",
    "e2e_volunteer_node_1788201013065@school.edu.vn",
    "e2e_student_node_1788201013065@school.edu.vn",
    "e2e_volunteer_20260901012948@school.edu.vn",
    "e2e_student_20260901012948@school.edu.vn"
)
$psql = (Get-Command psql.exe -ErrorAction SilentlyContinue).Source
if (-not $psql) { $psql = "C:\Program Files\PostgreSQL\16\bin\psql.exe" }
if (-not (Test-Path -LiteralPath $psql)) { throw "Khong tim thay psql.exe" }
if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
    $path = Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..\..")) ".runtime\DATABASE_URL.txt"
    if (Test-Path -LiteralPath $path) { $DatabaseUrl = (Get-Content -LiteralPath $path -Raw).Trim() }
}
if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) { throw "Thieu DatabaseUrl" }
$emailSql = ($emails | ForEach-Object { "'" + $_.Replace("'", "''") + "'" }) -join ","
$sql = @"
select id, name, email, role, status, points
from users
where lower(email) in ($emailSql)
order by email;
"@
Write-Host "E2E cleanup dry-run. Danh sach muc tieu:"
& $psql "--dbname=$DatabaseUrl" "--set=ON_ERROR_STOP=1" "--command=$sql"
if (-not $Apply) {
    Write-Host "Chua xoa du lieu. Chay lai voi -Apply sau khi da xac nhan dung 5 email."
    exit 0
}
$confirm = Read-Host "Nhap DELETE-E2E de xac nhan xoa dung danh sach tren"
if ($confirm -ne "DELETE-E2E") { throw "Huy cleanup: xac nhan khong khop" }
$deleteSql = @"
begin;
delete from users where lower(email) in ($emailSql);
commit;
"@
& $psql "--dbname=$DatabaseUrl" "--set=ON_ERROR_STOP=1" "--command=$deleteSql"
Write-Host "Da cleanup dung danh sach email E2E."
