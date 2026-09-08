Add-Type -AssemblyName System.Drawing
$iconOutput = Join-Path $PSScriptRoot '../build'
New-Item -ItemType Directory -Path $iconOutput -Force | Out-Null
$iconBitmap = New-Object System.Drawing.Bitmap(256,256)
$iconGraphics = [System.Drawing.Graphics]::FromImage($iconBitmap)
$iconGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$iconGraphics.Clear([System.Drawing.Color]::Transparent)
$iconShape = New-Object System.Drawing.Drawing2D.GraphicsPath
$iconShape.AddArc(8,8,72,72,180,90)
$iconShape.AddArc(176,8,72,72,270,90)
$iconShape.AddArc(176,176,72,72,0,90)
$iconShape.AddArc(8,176,72,72,90,90)
$iconShape.CloseFigure()
$iconGradient = New-Object System.Drawing.Drawing2D.LinearGradientBrush([System.Drawing.Point]::new(0,0),[System.Drawing.Point]::new(256,256),[System.Drawing.Color]::FromArgb(239,247,240),[System.Drawing.Color]::FromArgb(191,213,204))
$iconGraphics.FillPath($iconGradient,$iconShape)
$iconRim = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(220,255,255,255),3)
$iconGraphics.DrawPath($iconRim,$iconShape)
$iconPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(40,94,79),11)
$iconPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$iconPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$iconHeights = @(32,70,105,56,132,88,36)
for($iconIndex=0;$iconIndex -lt $iconHeights.Length;$iconIndex++){
 $iconX = 62 + $iconIndex * 22
 $iconHeight = $iconHeights[$iconIndex]
 $iconGraphics.DrawLine($iconPen,[float]$iconX,[float](128-$iconHeight/2),[float]$iconX,[float](128+$iconHeight/2))
}
$iconStream = New-Object System.IO.MemoryStream
$iconBitmap.Save($iconStream,[System.Drawing.Imaging.ImageFormat]::Png)
$iconBytes = $iconStream.ToArray()
[System.IO.File]::WriteAllBytes((Join-Path $iconOutput 'icon.png'),$iconBytes)
$icoFile = [System.IO.File]::Create((Join-Path $iconOutput 'icon.ico'))
$icoWriter = New-Object System.IO.BinaryWriter($icoFile)
$icoWriter.Write([UInt16]0);$icoWriter.Write([UInt16]1);$icoWriter.Write([UInt16]1)
$icoWriter.Write([byte]0);$icoWriter.Write([byte]0);$icoWriter.Write([byte]0);$icoWriter.Write([byte]0)
$icoWriter.Write([UInt16]1);$icoWriter.Write([UInt16]32);$icoWriter.Write([UInt32]$iconBytes.Length);$icoWriter.Write([UInt32]22);$icoWriter.Write($iconBytes)
$icoWriter.Dispose();$iconStream.Dispose();$iconPen.Dispose();$iconRim.Dispose();$iconGradient.Dispose();$iconShape.Dispose();$iconGraphics.Dispose();$iconBitmap.Dispose()
