# tools/scripts/make-icon.ps1 — vygeneruje assets/loyo-os.ico (ikona zástupce LoYo OS)
# Tmavý čtverec, neonový rámeček cyan → růžová, velké „L“ s přechodem a září.
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$out = Join-Path $root 'assets\loyo-os.ico'
New-Item -ItemType Directory -Force -Path (Split-Path $out) | Out-Null

$cyan = [Drawing.Color]::FromArgb(255, 18, 164, 255)
$pink = [Drawing.Color]::FromArgb(255, 255, 46, 151)

function New-RoundRect([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
    $p = New-Object Drawing.Drawing2D.GraphicsPath
    $p.AddArc($x, $y, $r, $r, 180, 90); $p.AddArc($x + $w - $r, $y, $r, $r, 270, 90)
    $p.AddArc($x + $w - $r, $y + $h - $r, $r, $r, 0, 90); $p.AddArc($x, $y + $h - $r, $r, $r, 90, 90)
    $p.CloseFigure(); return $p
}

function Draw-Icon([int]$S) {
    $bmp = New-Object Drawing.Bitmap $S, $S, ([Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'; $g.TextRenderingHint = 'AntiAliasGridFit'; $g.Clear([Drawing.Color]::Transparent)
    $pad = [float]($S * 0.04); $rad = [float]($S * 0.30); $w = [float]($S - 2 * $pad)
    $rect = New-Object Drawing.RectangleF $pad, $pad, $w, $w
    $grad = New-Object Drawing.Drawing2D.LinearGradientBrush $rect, $cyan, $pink, 45

    # tělo
    $body = New-RoundRect $pad $pad $w $w $rad
    $bg = New-Object Drawing.Drawing2D.LinearGradientBrush $rect, ([Drawing.Color]::FromArgb(255, 22, 22, 32)), ([Drawing.Color]::FromArgb(255, 8, 8, 12)), 90
    $g.FillPath($bg, $body)

    # záře rámečku (několik průhledných tahů) + ostrý rámeček
    for ($i = 4; $i -ge 1; $i--) {
        $c1 = [Drawing.Color]::FromArgb(28, 18, 164, 255); $c2 = [Drawing.Color]::FromArgb(28, 255, 46, 151)
        $gb = New-Object Drawing.Drawing2D.LinearGradientBrush $rect, $c1, $c2, 45
        $pen = New-Object Drawing.Pen $gb, ([float]($S * 0.018 * $i))
        $g.DrawPath($pen, $body)
    }
    $g.DrawPath((New-Object Drawing.Pen $grad, ([float][Math]::Max(1.5, $S * 0.035))), $body)

    # velké L
    $font = New-Object Drawing.Font 'Segoe UI Black', ([float]($S * 0.62)), ([Drawing.FontStyle]::Bold), ([Drawing.GraphicsUnit]::Pixel)
    $fmt = New-Object Drawing.StringFormat; $fmt.Alignment = 'Center'; $fmt.LineAlignment = 'Center'
    $tr = New-Object Drawing.RectangleF 0, ([float]($S * 0.02)), $S, $S
    if ($S -ge 48) {
        foreach ($o in 6, 4, 2) {
            $glow = New-Object Drawing.SolidBrush ([Drawing.Color]::FromArgb(40, 255, 46, 151))
            $g.DrawString('L', $font, $glow, (New-Object Drawing.RectangleF ([float]($S * 0.006 * $o)), ([float]($S * 0.02 + $S * 0.006 * $o)), $S, $S), $fmt)
        }
    }
    $g.DrawString('L', $font, $grad, $tr, $fmt)

    # tečka „online“
    $dot = [float]($S * 0.13)
    $g.FillEllipse((New-Object Drawing.SolidBrush ([Drawing.Color]::FromArgb(255, 57, 255, 136))), [float]($S * 0.72), [float]($S * 0.16), $dot, $dot)
    $g.Dispose()
    return $bmp
}

# ICO s PNG obrázky uvnitř (Vista+)
$sizes = 256, 128, 64, 48, 32, 24, 16
$pngs = foreach ($s in $sizes) { $ms = New-Object IO.MemoryStream; (Draw-Icon $s).Save($ms, [Drawing.Imaging.ImageFormat]::Png); , $ms.ToArray() }
$fs = [IO.File]::Create($out); $bw = New-Object IO.BinaryWriter $fs
$bw.Write([uint16]0); $bw.Write([uint16]1); $bw.Write([uint16]$sizes.Count)
$offset = 6 + 16 * $sizes.Count
for ($i = 0; $i -lt $sizes.Count; $i++) {
    $s = $sizes[$i]; $b = if ($s -ge 256) { 0 } else { $s }
    $bw.Write([byte]$b); $bw.Write([byte]$b); $bw.Write([byte]0); $bw.Write([byte]0)
    $bw.Write([uint16]1); $bw.Write([uint16]32); $bw.Write([uint32]$pngs[$i].Length); $bw.Write([uint32]$offset)
    $offset += $pngs[$i].Length
}
foreach ($p in $pngs) { $bw.Write($p) }
$bw.Close()
(Draw-Icon 256).Save((Join-Path $root 'assets\loyo-os.png'), [Drawing.Imaging.ImageFormat]::Png)
Write-Host "ikona: $out"
