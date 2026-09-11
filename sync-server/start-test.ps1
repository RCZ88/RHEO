$env:JWT_SECRET='ESLuPtCGYXQb5VLlpmlez4FrLQzYEGuDpG3mYBYMlEk'
$env:RELAY_TICKET_SECRET='TZQle-JA8SZow5Aa3OCYh72quiwVKCrWtFI5kfI3wEk'
$env:PORT='8787'
$env:HOST='0.0.0.0'
$env:DATABASE_URL='file:./data/sync.db'
$env:CORS_ORIGINS='*'
Set-Location $PSScriptRoot
npx tsx src/index.ts
