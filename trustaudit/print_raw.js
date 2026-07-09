const { fetchTokenSecurity } = require('./src/services/goplus');
const USDT_ETH = '0xdac17f958d2ee523a2206206994597c13d831ec7';

async function run() {
  const { data } = await fetchTokenSecurity(USDT_ETH, 'ethereum');
  console.log(JSON.stringify(data, null, 2));
}
run();
