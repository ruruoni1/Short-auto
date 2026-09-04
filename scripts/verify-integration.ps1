[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$failures = [System.Collections.Generic.List[string]]::new()
$checks = [System.Collections.Generic.List[string]]::new()

function Add-Check {
    param([string]$Name, [bool]$Passed, [string]$Failure)
    if ($Passed) {
        $checks.Add($Name)
    }
    else {
        $failures.Add($Failure)
    }
}

$requiredFiles = @(
    'PROJECT_STATUS.md',
    'docs/timeline-contract.md',
    'docs/05_asset/README.md',
    'docs/05_asset/asset-record.schema.json',
    'REVIEW_APPROVAL_QUALITY_SPEC.md',
    'design/DESIGN_SYSTEM.md',
    'design/ANIMATION_QA.md',
    'design/theme.css',
    'design/motion.css',
    'docs/DESKTOP_RELEASE.md',
    'docs/INTEGRATION_BASELINE.md'
)

foreach ($relativePath in $requiredFiles) {
    $fullPath = Join-Path $projectRoot $relativePath
    Add-Check "required:$relativePath" (Test-Path -LiteralPath $fullPath -PathType Leaf) "Missing required file: $relativePath"
}

$schemaPath = Join-Path $projectRoot 'docs/05_asset/asset-record.schema.json'
try {
    $schema = Get-Content -LiteralPath $schemaPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Add-Check 'asset-schema:json' $true ''
    Add-Check 'asset-schema:version' ($schema.properties.schemaVersion.const -eq 1) 'Asset schemaVersion must be 1.'
    Add-Check 'asset-schema:id-prefix' ($schema.properties.assetId.pattern -eq '^ast_[0-9A-HJKMNP-TV-Z]{26}$') 'Asset ID pattern changed without an integration decision.'
    Add-Check 'asset-schema:generator' ($null -ne $schema.properties.source.properties.generator) 'Asset generator metadata must live at source.generator.'
}
catch {
    Add-Check 'asset-schema:json' $false "Asset schema is not valid JSON: $($_.Exception.Message)"
}

$assetDoc = Get-Content -LiteralPath (Join-Path $projectRoot 'docs/05_asset/README.md') -Raw -Encoding UTF8
$timelineDoc = Get-Content -LiteralPath (Join-Path $projectRoot 'docs/timeline-contract.md') -Raw -Encoding UTF8
$releaseDoc = Get-Content -LiteralPath (Join-Path $projectRoot 'docs/DESKTOP_RELEASE.md') -Raw -Encoding UTF8
$projectStatus = Get-Content -LiteralPath (Join-Path $projectRoot 'PROJECT_STATUS.md') -Raw -Encoding UTF8
$animationQa = Get-Content -LiteralPath (Join-Path $projectRoot 'design/ANIMATION_QA.md') -Raw -Encoding UTF8

Add-Check 'asset-doc:generator-path' ($assetDoc -match '`source\.generator`' -and $assetDoc -notmatch '`provenance\.generator`') 'Asset documentation and schema disagree about generator metadata.'
Add-Check 'timeline:integer-microseconds' ($timelineDoc -match '정수 마이크로초' -and $timelineDoc -match '\[startUs, endUs\)') 'Timeline must retain integer microseconds and half-open ranges.'
Add-Check 'timeline:asset-source-ref' ($timelineDoc -match 'sourceRef' -and $timelineDoc -match '"asset"') 'Timeline must retain the asset sourceRef contract.'
Add-Check 'status:not-empty' ($projectStatus -notmatch '폴더는 현재 비어 있다') 'PROJECT_STATUS.md incorrectly reports an empty workspace.'
Add-Check 'motion:reduced-motion' ($animationQa -match 'prefers-reduced-motion') 'Animation QA must cover reduced motion.'
Add-Check 'motion:timeline-direct-manipulation' ($animationQa -match '드래그|drag' -and $animationQa -match 'transition') 'Animation QA must cover direct timeline manipulation without transition lag.'

$releaseTerms = @('신규 설치', '업데이트', '중단', '제거', '한글과 공백', 'SHA-256', '서명')
foreach ($term in $releaseTerms) {
    Add-Check "release:$term" ($releaseDoc.Contains($term)) "Desktop release gate is missing: $term"
}

$cssFiles = @('design/theme.css', 'design/motion.css')
$cssText = ($cssFiles | ForEach-Object { Get-Content -LiteralPath (Join-Path $projectRoot $_) -Raw -Encoding UTF8 }) -join "`n"
$openBraces = ([regex]::Matches($cssText, '\{')).Count
$closeBraces = ([regex]::Matches($cssText, '\}')).Count
Add-Check 'css:balanced-braces' ($openBraces -eq $closeBraces) "CSS braces are unbalanced: $openBraces opening, $closeBraces closing."

$definedTokens = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
[regex]::Matches($cssText, '--[a-z0-9-]+\s*:') | ForEach-Object {
    [void]$definedTokens.Add($_.Value.TrimEnd(':').Trim())
}
$usedTokens = [regex]::Matches($cssText, 'var\((--[a-z0-9-]+)') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique
foreach ($token in $usedTokens) {
    Add-Check "css-token:$token" ($definedTokens.Contains($token)) "CSS token is used but not defined: $token"
}

if ($failures.Count -gt 0) {
    Write-Host "Integration verification failed ($($failures.Count))" -ForegroundColor Red
    $failures | ForEach-Object { Write-Host "FAIL  $_" -ForegroundColor Red }
    exit 1
}

Write-Host "Integration verification passed ($($checks.Count) checks)" -ForegroundColor Green
$checks | ForEach-Object { Write-Host "PASS  $_" }
