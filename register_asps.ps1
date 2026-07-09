$env:Path = "C:\Users\Joshua\.local\bin;$env:Path"

# Write JSON files with correct encoding
$trustSvc = '[{"serviceName":"Contract Risk Scan","serviceDescription":"Summary: Scan a smart contract address on supported chains for honeypot risks, tax structures, LP lock status, and ownership backdoors.\nInput requirements: 1. smart contract address, 2. chain name.","serviceType":"A2MCP","fee":"0.1","endpoint":"https://trustaudit-tau.vercel.app/scan"}]'
$paySvc   = '[{"serviceName":"Crypto Payroll","serviceDescription":"Summary: On-chain payroll agent that automates recurring crypto salary payments, schedules, and receipt generation for remote teams.\nInput requirements: 1. payee wallet address 2. payment amount and token 3. release schedule","serviceType":"A2A"}]'
$gigSvc   = '[{"serviceName":"Freelance Invoicing","serviceDescription":"Summary: AI invoicing and outreach assistant for freelancers that drafts pitches, generates payment links, and monitors payment status on-chain.\nInput requirements: 1. outreach details or client name 2. payment amount 3. freelancer wallet address","serviceType":"A2A"}]'

[System.IO.File]::WriteAllText("C:\Users\Joshua\Desktop\Okx hack\svc_trust.json", $trustSvc, [System.Text.Encoding]::ASCII)
[System.IO.File]::WriteAllText("C:\Users\Joshua\Desktop\Okx hack\svc_pay.json",   $paySvc,   [System.Text.Encoding]::ASCII)
[System.IO.File]::WriteAllText("C:\Users\Joshua\Desktop\Okx hack\svc_gig.json",   $gigSvc,   [System.Text.Encoding]::ASCII)

$t = Get-Content "C:\Users\Joshua\Desktop\Okx hack\svc_trust.json" -Raw -Encoding Ascii
$p = Get-Content "C:\Users\Joshua\Desktop\Okx hack\svc_pay.json"   -Raw -Encoding Ascii
$g = Get-Content "C:\Users\Joshua\Desktop\Okx hack\svc_gig.json"   -Raw -Encoding Ascii

Write-Host "TrustAudit JSON bytes check: $($t.Substring(0,3) | Format-Hex)"

Write-Host "Registering TrustAudit..."
onchainos agent create --role asp --name TrustAudit --description "AI smart contract risk scanner. Submit a contract address and get an instant risk report covering honeypot detection, holder concentration, and rug pull patterns." --picture "https://static.okx.com/cdn/web3/wallet/marketplace/headimages/agent/avatar/53e78847-edc0-465c-84b9-52b95a91c5b6.png" --service $t

Write-Host "Registering PaySlip..."
onchainos agent create --role asp --name PaySlip --description "On-chain payroll agent for remote teams. Tell it who to pay and when - it executes crypto payments, generates receipts, and maintains a ledger." --picture "https://static.okx.com/cdn/web3/wallet/marketplace/headimages/agent/avatar/03c0168c-c7a5-4dc3-b66c-fabba0be8a05.png" --service $p

Write-Host "Registering GigAgent..."
onchainos agent create --role asp --name GigAgent --description "AI invoicing agent for freelancers. Writes outreach, generates USDT/USDC invoices, monitors on-chain payment confirmation, and logs earnings." --picture "https://static.okx.com/cdn/web3/wallet/marketplace/headimages/agent/avatar/bdb146f1-02da-41bd-8c0f-86ba695c080d.png" --service $g

Write-Host "Done!"
