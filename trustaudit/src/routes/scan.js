const express = require('express');
const router = express.Router();
const { fetchTokenSecurity, CHAIN_IDS } = require('../services/goplus');
const { scoreRisk } = require('../services/riskScorer');
const { generateLLMNarrative } = require('../services/llm');

const SUPPORTED_CHAINS = Object.keys(CHAIN_IDS);

// Validate EVM address
function isValidEVMAddress(addr) {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

// Validate Solana address
function isValidSolanaAddress(addr) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
}

/**
 * POST /scan
 * Body: { address: string, chain?: string }
 */
router.post('/', async (req, res) => {
  const startTime = Date.now();

  try {
    const { address, chain = 'ethereum' } = req.body;

    // ── Input validation ──
    if (!address) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required field: address',
        example: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', chain: 'ethereum' },
      });
    }

    const chainLower = chain.toLowerCase();
    if (!CHAIN_IDS[chainLower] && isNaN(parseInt(chain))) {
      return res.status(400).json({
        ok: false,
        error: `Unsupported chain: "${chain}"`,
        supportedChains: SUPPORTED_CHAINS,
      });
    }

    const isSolana = chainLower === 'solana' || chainLower === 'sol';
    const isValidAddress = isSolana
      ? isValidSolanaAddress(address)
      : isValidEVMAddress(address);

    if (!isValidAddress) {
      return res.status(400).json({
        ok: false,
        error: `Invalid address format for chain "${chain}". EVM addresses must be 0x-prefixed 42 characters.`,
      });
    }

    // ── Fetch GoPlus data ──
    console.log(`Scanning ${address} on ${chain}...`);
    const { chainId, data: goplusData } = await fetchTokenSecurity(address, chain);

    // ── Score risk ──
    const report = scoreRisk(goplusData, address, chain);

    // ── AI Narrative Synthesis ──
    const aiNarrative = await generateLLMNarrative(report);
    if (aiNarrative) {
      if (aiNarrative.summary) report.summary = aiNarrative.summary;
      if (aiNarrative.verdict) report.verdict = aiNarrative.verdict;
    }

    // Add timing
    report.scanDurationMs = Date.now() - startTime;

    console.log(`Scan complete: ${address} → ${report.riskLevel} (score: ${report.riskScore})`);
    return res.json(report);

  } catch (err) {
    console.error('Scan error:', err.message);

    if (err.message.includes('not found') || err.message.includes('not analyzed')) {
      return res.status(404).json({
        ok: false,
        error: err.message,
        tip: 'Make sure the contract address is correct and deployed on the specified chain.',
      });
    }

    if (err.message.includes('Rate limit')) {
      return res.status(429).json({ ok: false, error: err.message });
    }

    return res.status(500).json({
      ok: false,
      error: `Scan failed: ${err.message}`,
    });
  }
});

/**
 * GET /scan — friendly usage hint
 */
router.get('/', (req, res) => {
  res.json({
    ok: true,
    message: 'TrustAudit scan endpoint. Use POST /scan with a JSON body.',
    example: {
      method: 'POST',
      url: '/scan',
      body: {
        address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        chain: 'ethereum',
      },
    },
    supportedChains: SUPPORTED_CHAINS,
  });
});

module.exports = router;
