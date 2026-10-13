param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('private', 'public')]
  [string]$Mode
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$outputRoot = Split-Path -Path $projectRoot -Parent
$archiveName = if ($Mode -eq 'private') { '指尖灯影-逐步改进-私用-20261011.zip' } else { '指尖灯影-逐步改进-公开-20261011.zip' }
$destination = Join-Path $outputRoot $archiveName
if (Test-Path -LiteralPath $destination) {
  throw "发布包已存在，不会覆盖：$destination"
}

$rootFiles = @(
  'index.html', 'server.js', 'README.md', '.gitignore', '.env.local.example',
  '启动服务器.bat', '启动局域网演示.bat', 'THIRD_PARTY_NOTICES.md', 'AI_USE_DISCLOSURE.md'
)
if ($Mode -eq 'private') { $rootFiles += @('.env.local', '私用包说明.md') }
$folders = @('css', 'js', 'assets', 'diagnostics', 'docs', 'scripts')
$files = @()
foreach ($name in $rootFiles) {
  $files += Get-Item -LiteralPath (Join-Path $projectRoot $name)
}
foreach ($name in $folders) {
  $files += Get-ChildItem -LiteralPath (Join-Path $projectRoot $name) -Recurse -File -Force
}

if ($Mode -eq 'private') {
  $envText = [System.IO.File]::ReadAllText((Join-Path $projectRoot '.env.local'))
  if ($envText -notmatch '(?m)^\s*DEEPSEEK_API_KEY\s*=\s*sk-\S+') {
    throw '私用包的 .env.local 中没有可用格式的 DeepSeek 密钥。'
  }
}

$archive = [System.IO.Compression.ZipFile]::Open($destination, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($file in $files) {
    $entryName = $file.FullName.Substring($projectRoot.Length + 1).Replace('\', '/')
    $entry = $archive.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
    $inputStream = [System.IO.File]::OpenRead($file.FullName)
    $outputStream = $entry.Open()
    try { $inputStream.CopyTo($outputStream) }
    finally { $outputStream.Dispose(); $inputStream.Dispose() }
  }
}
finally { $archive.Dispose() }

$check = [System.IO.Compression.ZipFile]::OpenRead($destination)
try {
  $names = @($check.Entries | ForEach-Object { $_.FullName })
  if ('index.html' -notin $names -or 'server.js' -notin $names) { throw '压缩包缺少入口文件。' }
  if ($Mode -eq 'private' -and '.env.local' -notin $names) { throw '私用包缺少 .env.local。' }
  if ($Mode -eq 'public' -and '.env.local' -in $names) { throw '公开包意外包含 .env.local。' }
  Write-Output "已生成 $Mode 发布包（$($names.Count) 个文件）：$destination"
}
finally { $check.Dispose() }
