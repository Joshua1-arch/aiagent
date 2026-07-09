/**
 * OKX Agent Payments Protocol — x402 payment middleware for TrustAudit
 *
 * Implements the x402 v2 "exact" scheme:
 *   - Unauthenticated requests → HTTP 402 with PAYMENT-REQUIRED header (base64 JSON challenge)
 *   - Authenticated requests   → validate X-PAYMENT header via onchainos CLI, then pass through
 *
 * The payment amount, recipient wallet, and network are set via environment variables.
 */

'use strict';

const { execSync } = require('child_process');

// ── Config (override via .env) ──────────────────────────────────────────────
const PAYMENT_AMOUNT   = process.env.PAYMENT_AMOUNT_USDC || '100000'; // 0.1 USDC (6 decimals)
const PAYMENT_ASSET    = process.env.PAYMENT_ASSET       || '0x74b7F16337b8972027F6196A17a631aC6dE26d22'; // USDC on XLayer
const PAYMENT_NETWORK  = process.env.PAYMENT_NETWORK     || 'eip155:196'; // XLayer mainnet
const PAYMENT_PAYTO    = process.env.PAYMENT_PAYTO       || process.env.OWNER_ADDRESS || '';
const PAYMENT_RESOURCE = process.env.PAYMENT_RESOURCE    || 'https://trustaudit-tau.vercel.app/scan';

// ── Build the PAYMENT-REQUIRED challenge payload (x402 v2) ──────────────────
function buildChallenge(req) {
  const challenge = {
    x402Version: 2,
    accepts: [
      {
        scheme: 'exact',
        network: PAYMENT_NETWORK,
        asset: PAYMENT_ASSET,
        amount: PAYMENT_AMOUNT,
        payTo: PAYMENT_PAYTO,
        resource: PAYMENT_RESOURCE,
        description: 'Pay 0.1 USDC per smart-contract scan (OKX Agent Payments Protocol)',
      },
    ],
  };
  return Buffer.from(JSON.stringify(challenge)).toString('base64');
}

// ── Validate an inbound X-PAYMENT token via onchainos CLI ───────────────────
function verifyPayment(xPaymentToken, resource) {
  try {
    const result = execSync(
      `onchainos payment verify --token "${xPaymentToken}" --resource "${resource}"`,
      { timeout: 8000, encoding: 'utf8' }
    );
    const parsed = JSON.parse(result.trim());
    return parsed && parsed.ok === true;
  } catch (err) {
    // If CLI not available or verify fails, fall through to 402
    return false;
  }
}

// ── Middleware ───────────────────────────────────────────────────────────────
function x402PaymentRequired(req, res, next) {
  // Skip for non-POST or preflight
  if (req.method === 'OPTIONS' || req.method === 'GET') {
    return next();
  }

  const xPayment = req.headers['x-payment'];

  // No payment header → issue 402 challenge
  if (!xPayment) {
    const challengeB64 = buildChallenge(req);
    res.set('PAYMENT-REQUIRED', challengeB64);
    res.set('Access-Control-Expose-Headers', 'PAYMENT-REQUIRED');
    return res.status(402).json({
      error: 'Payment Required',
      message:
        'This endpoint requires a payment via the OKX Agent Payments Protocol. ' +
        'Send payment and include the X-PAYMENT token in your request headers.',
      x402Version: 2,
    });
  }

  // Payment header present → verify it
  const valid = verifyPayment(xPayment, PAYMENT_RESOURCE);
  if (!valid) {
    return res.status(402).json({
      error: 'Payment verification failed',
      message: 'The provided X-PAYMENT token is invalid or has already been used.',
      x402Version: 2,
    });
  }

  // Valid payment — attach payment info to request for downstream logging
  req.paymentVerified = true;
  req.paymentToken = xPayment;
  return next();
}

module.exports = { x402PaymentRequired };
