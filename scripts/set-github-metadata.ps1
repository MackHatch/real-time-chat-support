# Requires: GitHub CLI (`gh`) authenticated for this account.
#   gh auth login
# Then from the repo root:
#   powershell -File scripts/set-github-metadata.ps1

$ErrorActionPreference = 'Stop'

$ownerRepo = 'mackhatch/real-time-chat-support'
$description = 'Production-oriented real-time customer support chat (Intercom-lite) with NestJS, Socket.IO, React, Prisma, and Playwright E2E.'

$topics = @(
  'nestjs',
  'socket-io',
  'react',
  'typescript',
  'prisma',
  'postgresql',
  'realtime',
  'customer-support',
  'playwright',
  'docker'
)

Write-Host "Updating description for $ownerRepo ..."
gh repo edit $ownerRepo --description $description

Write-Host "Setting topics..."
$body = @{ names = $topics } | ConvertTo-Json
$body | gh api -X PUT "repos/$ownerRepo/topics" -H "Accept: application/vnd.github+json" --input -

Write-Host "Done. Current About metadata:"
gh repo view $ownerRepo --json description,repositoryTopics,url
