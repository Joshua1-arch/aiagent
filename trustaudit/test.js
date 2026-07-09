const { fetchTokenSecurity } = require('./src/services/goplus');
const { scoreRisk } = require('./src/services/riskScorer');

// Test with USDT on Ethereum
const USDT_ETH = '0xdac17f958d2ee523a2206206994597c13d831ec7';

async function runTest() {
  console.log('Testing GoPlus integration with USDT on Ethereum...');
  try {
    const { data } = await fetchTokenSecurity(USDT_ETH, 'ethereum');
    console.log('GoPlus raw fetch successful! Token Name:', data.token_name);
    
    const report = scoreRisk(data, USDT_ETH, 'ethereum');
    console.log('\n--- TrustAudit Risk Report ---');
    console.log(`Token: ${report.token.name} (${report.token.symbol})`);
    console.log(`Risk Score: ${report.riskScore}/100`);
    console.log(`Risk Level: ${report.riskEmoji} ${report.riskLevel}`);
    console.log(`Verdict: ${report.verdict}`);
    console.log(`Summary: ${report.summary}`);
    console.log('\nFlags:');
    if (report.flags.length === 0) {
      console.log('  None');
    } else {
      report.flags.forEach(f => console.log(`  - [${f.severity.toUpperCase()}] ${f.flag}: ${f.description}`));
    }
    console.log('\nDetails:');
    console.log(`  Buy Tax: ${report.details.tax.buy}`);
    console.log(`  Sell Tax: ${report.details.tax.sell}`);
    console.log(`  Holders: Top 10 hold ${report.details.holders.top10Percent} across ${report.details.holders.totalHolders} holders`);
    console.log(`  Liquidity Locked: ${report.details.liquidity.isLocked} (${report.details.liquidity.lockedPercent} locked)`);
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

runTest();
