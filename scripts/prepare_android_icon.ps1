param(
    [Parameter(Mandatory = $true)]
    [string]$SourceImage,

    [Parameter(Mandatory = $true)]
    [string]$ResourceDirectory
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $SourceImage -PathType Leaf)) {
    throw "Khong tim thay anh logo: $SourceImage"
}

Add-Type -AssemblyName System.Drawing

$sizes = @{
    "mipmap-mdpi" = 48
    "mipmap-hdpi" = 72
    "mipmap-xhdpi" = 96
    "mipmap-xxhdpi" = 144
    "mipmap-xxxhdpi" = 192
}

$source = $null
try {
    $source = [System.Drawing.Image]::FromFile((Resolve-Path -LiteralPath $SourceImage).Path)
    if ($source.Width -ne $source.Height) {
        throw "Anh logo phai la anh vuong: $($source.Width)x$($source.Height)"
    }

    foreach ($entry in $sizes.GetEnumerator()) {
        $directory = Join-Path $ResourceDirectory $entry.Key
        New-Item -ItemType Directory -Force -Path $directory | Out-Null

        $bitmap = New-Object System.Drawing.Bitmap($entry.Value, $entry.Value)
        try {
            $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
            try {
                $graphics.Clear([System.Drawing.Color]::White)
                $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
                $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
                $graphics.DrawImage($source, 0, 0, $entry.Value, $entry.Value)
            }
            finally {
                $graphics.Dispose()
            }

            foreach ($fileName in @("ic_launcher.png", "ic_launcher_round.png")) {
                $destination = Join-Path $directory $fileName
                $bitmap.Save($destination, [System.Drawing.Imaging.ImageFormat]::Png)
            }
        }
        finally {
            $bitmap.Dispose()
        }
    }
}
finally {
    if ($source) {
        $source.Dispose()
    }
}

Write-Output "[OK] Android launcher icons generated from $SourceImage"
