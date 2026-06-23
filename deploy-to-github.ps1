# Ivan Amad Portfolio — Push to GitHub
# Right-click this file → "Run with PowerShell"

$projectPath = "C:\Users\asus\Desktop\Portfolio Website\Portfolio website"
$token = "TOKEN_REMOVED"
$username = "ivan-amad"
$repoName = "ivan-amad-portfolio"

Write-Host "=== Creating GitHub repository ===" -ForegroundColor Cyan

$headers = @{
    "Authorization" = "token $token"
    "Content-Type"  = "application/json"
    "User-Agent"    = "ivan-amad-deploy"
}
$body = @{
    name        = $repoName
    description = "Ivan Amad Visual Art Director Portfolio"
    private     = $false
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "https://api.github.com/user/repos" -Method Post -Headers $headers -Body $body
    Write-Host "Repository created: $($response.html_url)" -ForegroundColor Green
} catch {
    Write-Host "Repository may already exist, continuing..." -ForegroundColor Yellow
}

Write-Host "=== Setting up git ===" -ForegroundColor Cyan

Set-Location $projectPath

if (Test-Path ".git") {
    Remove-Item -Recurse -Force ".git"
    Write-Host "Cleared old .git folder" -ForegroundColor Yellow
}

# Also remove token from this script before committing
$scriptContent = Get-Content $MyInvocation.MyCommand.Path -Raw
$scriptContent = $scriptContent -replace $token, "TOKEN_REMOVED"
Set-Content $MyInvocation.MyCommand.Path $scriptContent

git init
git config user.email "game7ivan1@gmail.com"
git config user.name "ivan-amad"
$remoteUrl = "https://" + $username + ":" + $token + "@github.com/" + $username + "/" + $repoName + ".git"
git remote add origin $remoteUrl

Write-Host "=== Adding files ===" -ForegroundColor Cyan
git add -A
# Remove deploy scripts from the commit (they contain the token)
git rm --cached deploy-to-github.ps1 2>$null
git rm --cached DEPLOY.bat 2>$null
git commit -m "Initial portfolio commit"
git branch -M main

Write-Host "=== Pushing to GitHub ===" -ForegroundColor Cyan
git push -u origin main

Write-Host ""
Write-Host "SUCCESS! Your code is now at:" -ForegroundColor Green
Write-Host "https://github.com/$username/$repoName" -ForegroundColor Green
Write-Host ""
Write-Host "Next: Go to railway.app and deploy from that repo!" -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to close"

