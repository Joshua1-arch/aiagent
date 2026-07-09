const axios = require('axios');

const GOPLUS_API_URL = process.env.GOPLUS_API_URL || 'https://api.gopluslabs.io/api/v1';

// Map chain names to GoPlus chain IDs
const CHAIN_IDS = {
  ethereum: '1',
  eth: '1',
  bsc: '56',
  bnb: '56',
  polygon: '137',
  matic: '137',
  arbitrum: '42161',
  arb: '42161',
  base: '8453',
  optimism: '10',
  op: '10',
  avalanche: '43114',
  avax: '43114',
  solana: 'solana',
  sol: 'solana',
};

/**
 * Fetch token security data from GoPlus API
 * @param {string} address - Contract address
 * @param {string} chain - Chain name or ID
 * @returns {Object} Raw GoPlus security data
 */
async function fetchTokenSecurity(address, chain = 'ethereum') {
  const chainId = CHAIN_IDS[chain.toLowerCase()] || chain;

  // Solana uses a different endpoint
  const isSolana = chainId === 'solana';
  const endpoint = isSolana
    ? `${GOPLUS_API_URL}/solana/token_security?contract_addresses=${address}`
    : `${GOPLUS_API_URL}/token_security/${chainId}?contract_addresses=${address}`;

  const headers = {};
  if (process.env.GOPLUS_API_KEY) {
    headers['Authorization'] = process.env.GOPLUS_API_KEY;
  }

  try {
    const response = await axios.get(endpoint, {
      headers,
      timeout: 10000,
    });

    if (response.data.code !== 1) {
      throw new Error(`GoPlus API error: ${response.data.message || 'Unknown error'}`);
    }

    const result = response.data.result;
    const contractData = result[address.toLowerCase()] || result[Object.keys(result)[0]];

    if (!contractData) {
      throw new Error('Contract not found or not analyzed by GoPlus');
    }

    return { chainId, data: contractData };
  } catch (err) {
    if (err.response?.status === 429) {
      throw new Error('Rate limit exceeded on data provider. Please try again in a moment.');
    }
    if (err.code === 'ECONNABORTED') {
      throw new Error('Data provider timeout. Please try again.');
    }
    throw err;
  }
}

/**
 * Fetch deployer/address risk data from GoPlus
 * @param {string} address - Address to check
 * @param {string} chainId - Chain ID
 */
async function fetchAddressRisk(address, chainId) {
  try {
    const endpoint = `${GOPLUS_API_URL}/address_security/${address}?chain_id=${chainId}`;
    const response = await axios.get(endpoint, { timeout: 8000 });
    if (response.data.code === 1) return response.data.result;
    return null;
  } catch {
    return null; // Non-critical, fail silently
  }
}

module.exports = { fetchTokenSecurity, fetchAddressRisk, CHAIN_IDS };
