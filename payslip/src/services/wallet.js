const { exec } = require('child_process');
const path = require('path');

// Common token contract addresses on different chains
const TOKEN_ADDRESSES = {
  ethereum: {
    usdt: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    usdc: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
  },
  base: {
    usdc: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    usdt: '0xfde4c568e9f0e5e31707010464f89d3d3ef0c090'
  },
  arbitrum: {
    usdt: '0xfd086bc7cd5c481d27fc297591788c1602e161a2',
    usdc: '0xaf88d065e77c8cc2239327c5edb3a432268e5831'
  },
  solana: {
    usdc: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    usdt: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
  },
  xlayer: {
    usdt: '0x1e1507fe092147b973ef4d4fa71e65c010d19a4e',
    usdc: '0x74b70841f26551865dd67559c5d0ce1869e5d4a1'
  }
};

/**
 * Execute an on-chain transfer
 * @param {string} recipient - The recipient address
 * @param {string} amount - Human-readable amount (e.g. "1.5")
 * @param {string} token - Token symbol (e.g. "USDT", "USDC", "ETH")
 * @param {string} chain - Chain name (e.g. "base", "solana", "arbitrum")
 * @returns {Promise<object>} - Transaction details
 */
function sendTransaction(recipient, amount, token, chain) {
  return new Promise((resolve, reject) => {
    const chainLower = chain.toLowerCase();
    const tokenLower = token.toLowerCase();

    let cmd = `onchainos wallet send --recipient "${recipient}" --chain "${chainLower}" --readable-amount "${amount}" --force`;

    // Add token contract address if it's not native (native is ETH/SOL/OKB depending on chain)
    const isNative = ['eth', 'sol', 'okb', 'native'].includes(tokenLower);
    if (!isNative) {
      const tokenAddress = TOKEN_ADDRESSES[chainLower]?.[tokenLower];
      if (tokenAddress) {
        cmd += ` --contract-token "${tokenAddress}"`;
      } else if (token.startsWith('0x') || token.length > 30) {
        // Fallback: user passed raw contract address as token symbol
        cmd += ` --contract-token "${token}"`;
      }
    }

    console.log(`Executing wallet transfer command: ${cmd}`);

    // Execute the command using onchainos.exe path or fallback to PATH
    const execPath = path.resolve(process.env.USERPROFILE, '.local/bin/onchainos.exe');
    const fullCmd = `& "${execPath}" ${cmd.substring(9)}`; // Replace 'onchainos' with full powershell path calling

    exec(fullCmd, { shell: 'powershell.exe' }, (error, stdout, stderr) => {
      const trimmedStdout = stdout ? stdout.trim() : '';
      
      if (trimmedStdout) {
        try {
          const response = JSON.parse(trimmedStdout);
          return resolve(response);
        } catch (parseErr) {
          // stdout is not JSON, continue to error handling
        }
      }

      if (error) {
        console.error(`Execution error: ${error.message}`);
        return resolve({ ok: false, error: error.message });
      }

      resolve({
        ok: true,
        raw: trimmedStdout,
        stderr: stderr ? stderr.trim() : ''
      });
    });
  });
}

module.exports = {
  sendTransaction
};
