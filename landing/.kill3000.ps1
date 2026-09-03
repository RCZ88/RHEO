$p = (Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue).OwningProcess
if ($p -ne $null) {
  Stop-Process -Id $p -Force
  Write-Host "killed $p"
} else {
  Write-Host "nothing on 3000"
}
