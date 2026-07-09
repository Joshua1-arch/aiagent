/**
 * TrustAudit Risk Scorer
 * Converts raw GoPlus data into a structured risk score + plain-English narrative
 */

// Risk flag definitions with weights and descriptions
const FLAGS = {
  // Critical flags (automatic HIGH risk)
  honeypot:              { weight: 40, label: 'Honeypot',             desc: 'Tokens cannot be sold — classic honeypot trap' },
  is_blacklisted:        { weight: 30, label: 'Blacklisted Token',    desc: 'Token is flagged on security blacklists' },
  is_whitelisted:        { weight: -10,label: 'Whitelisted',          desc: 'Token appears on trusted whitelists' },
  trading_cooldown:      { weight: 20, label: 'Trading Cooldown',     desc: 'Artificial cooldown restricts when you can sell' },
  transfer_pausable:     { weight: 25, label: 'Transfers Pausable',   desc: 'Owner can pause all transfers at any time' },
  selfdestruct:          { weight: 30, label: 'Self-Destruct',        desc: 'Contract can be destroyed, wiping all tokens' },
  external_call:         { weight: 15, label: 'External Calls',       desc: 'Contract makes external calls — reentrancy risk' },

  // Ownership flags
  can_take_back_ownership: { weight: 25, label: 'Reclaim Ownership',  desc: 'Renounced ownership can be reclaimed — fake renounce' },
  owner_change_balance:    { weight: 30, label: 'Owner Balance Control', desc: 'Owner can modify token balances arbitrarily' },
  hidden_owner:            { weight: 30, label: 'Hidden Owner',       desc: 'Contract has a hidden owner address' },

  // Mint/supply flags
  is_mintable:           { weight: 20, label: 'Mintable',             desc: 'New tokens can be minted at any time, diluting holders' },

  // Tax flags (computed separately)
  high_buy_tax:          { weight: 15, label: 'High Buy Tax',         desc: 'Buy tax above 10% — reduces value on purchase' },
  high_sell_tax:         { weight: 25, label: 'High Sell Tax',        desc: 'Sell tax above 10% — significantly reduces exit value' },
  extreme_sell_tax:      { weight: 40, label: 'Extreme Sell Tax',     desc: 'Sell tax above 50% — near-impossible to exit profitably' },

  // Proxy flags
  is_proxy:              { weight: 10, label: 'Proxy Contract',        desc: 'Upgradeable proxy — logic can be changed after deployment' },

  // Holder concentration
  high_concentration:    { weight: 20, label: 'High Concentration',   desc: 'Top 10 holders control more than 50% of supply' },
  extreme_concentration: { weight: 35, label: 'Extreme Concentration', desc: 'Top 10 holders control more than 80% of supply — rug risk' },

  // Liquidity
  no_liquidity:          { weight: 30, label: 'No Liquidity',         desc: 'No liquidity pool detected — cannot trade' },
  lp_not_locked:         { weight: 20, label: 'Liquidity Not Locked', desc: 'Liquidity pool tokens are not locked — can be drained' },
};

/**
 * Normalize a GoPlus boolean-like value
 * GoPlus returns "0", "1", 0, 1, null, ""
 */
function isTrue(val) {
  return val === '1' || val === 1 || val === true;
}

/**
 * Parse tax as a number (GoPlus returns strings like "0.05" = 5%)
 */
function parseTax(val) {
  if (!val && val !== 0) return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n * 100; // Convert to percentage
}

/**
 * Analyze holder concentration from GoPlus holder list
 */
function analyzeHolders(holders) {
  if (!holders || !Array.isArray(holders) || holders.length === 0) return null;

  const top10 = holders.slice(0, 10);
  const totalPct = top10.reduce((sum, h) => {
    return sum + (parseFloat(h.percent) || 0);
  }, 0);

  // Check if any top holder is a locked/contract address
  const lockedCount = top10.filter(h => isTrue(h.is_locked)).length;

  return {
    top10Percent: (totalPct * 100).toFixed(1),
    lockedCount,
    holderCount: holders.length,
  };
}

/**
 * Analyze LP holders for liquidity lock status
 */
function analyzeLiquidity(lpHolders) {
  if (!lpHolders || !Array.isArray(lpHolders) || lpHolders.length === 0) {
    return { hasLiquidity: false, isLocked: false, lockedPercent: 0 };
  }

  const totalLocked = lpHolders
    .filter(h => isTrue(h.is_locked))
    .reduce((sum, h) => sum + (parseFloat(h.percent) || 0), 0);

  return {
    hasLiquidity: true,
    isLocked: totalLocked > 0,
    lockedPercent: (totalLocked * 100).toFixed(1),
  };
}

/**
 * Main risk scoring function
 * @param {Object} goplusData - Raw data from GoPlus API
 * @param {string} address - Contract address
 * @param {string} chain - Chain name
 * @returns {Object} Full risk report
 */
function scoreRisk(goplusData, address, chain) {
  const d = goplusData;
  const activeFlags = [];
  let riskScore = 0; // 0 = safe, 100 = maximum danger

  const isTrusted = isTrue(d.trust_list);
  const isCexListed = d.is_in_cex && isTrue(d.is_in_cex.listed);
  const totalHolders = parseInt(d.holder_count) || 0;

  // ── Critical flags ──
  if (isTrue(d.is_honeypot))           { activeFlags.push('honeypot');              riskScore += FLAGS.honeypot.weight; }
  if (isTrue(d.is_blacklisted))        { activeFlags.push('is_blacklisted');         riskScore += FLAGS.is_blacklisted.weight; }
  if (isTrue(d.trading_cooldown))      { activeFlags.push('trading_cooldown');       riskScore += FLAGS.trading_cooldown.weight; }
  if (isTrue(d.transfer_pausable))     { activeFlags.push('transfer_pausable');      riskScore += FLAGS.transfer_pausable.weight; }
  if (isTrue(d.selfdestruct))          { activeFlags.push('selfdestruct');           riskScore += FLAGS.selfdestruct.weight; }
  if (isTrue(d.external_call))         { activeFlags.push('external_call');          riskScore += FLAGS.external_call.weight; }

  // ── Ownership flags ──
  if (isTrue(d.can_take_back_ownership)) { activeFlags.push('can_take_back_ownership'); riskScore += FLAGS.can_take_back_ownership.weight; }
  if (isTrue(d.owner_change_balance))    { activeFlags.push('owner_change_balance');    riskScore += FLAGS.owner_change_balance.weight; }
  if (isTrue(d.hidden_owner))            { activeFlags.push('hidden_owner');            riskScore += FLAGS.hidden_owner.weight; }

  // ── Mint ──
  if (isTrue(d.is_mintable))           { activeFlags.push('is_mintable');            riskScore += FLAGS.is_mintable.weight; }

  // ── Proxy ──
  if (isTrue(d.is_proxy))              { activeFlags.push('is_proxy');               riskScore += FLAGS.is_proxy.weight; }

  // ── Tax analysis ──
  const buyTax = parseTax(d.buy_tax);
  const sellTax = parseTax(d.sell_tax);

  if (sellTax !== null && sellTax > 50) {
    activeFlags.push('extreme_sell_tax');
    riskScore += FLAGS.extreme_sell_tax.weight;
  } else if (sellTax !== null && sellTax > 10) {
    activeFlags.push('high_sell_tax');
    riskScore += FLAGS.high_sell_tax.weight;
  }

  if (buyTax !== null && buyTax > 10) {
    activeFlags.push('high_buy_tax');
    riskScore += FLAGS.high_buy_tax.weight;
  }

  // ── Holder concentration ──
  const holderAnalysis = analyzeHolders(d.holders);
  if (holderAnalysis) {
    const pct = parseFloat(holderAnalysis.top10Percent);
    if (pct > 80) {
      activeFlags.push('extreme_concentration');
      riskScore += FLAGS.extreme_concentration.weight;
    } else if (pct > 50) {
      activeFlags.push('high_concentration');
      riskScore += FLAGS.high_concentration.weight;
    }
  }

  // ── Liquidity ──
  const liquidityAnalysis = analyzeLiquidity(d.lp_holders);
  if (!liquidityAnalysis.hasLiquidity) {
    // If cex listed or has huge holder count, no LP on dex doesn't mean "no liquidity"
    if (!isCexListed && totalHolders < 10000) {
      activeFlags.push('no_liquidity');
      riskScore += FLAGS.no_liquidity.weight;
    }
  } else if (!liquidityAnalysis.isLocked) {
    // If highly trusted/large token, LP lock is less critical
    if (!isTrusted && totalHolders < 50000) {
      activeFlags.push('lp_not_locked');
      riskScore += FLAGS.lp_not_locked.weight;
    }
  }

  // ── Trust list override ──
  if (isTrusted) {
    // Keep warning flags in activeFlags for information, but scale down riskScore completely
    riskScore = Math.min(riskScore, 5); 
  } else {
    // Cap score at 100
    riskScore = Math.min(100, Math.max(0, riskScore));
  }

  // ── Risk level ──
  let riskLevel, riskEmoji;
  if (riskScore >= 70 || (activeFlags.includes('honeypot') && !isTrusted)) {
    riskLevel = 'CRITICAL';
    riskEmoji = '🔴';
  } else if (riskScore >= 40) {
    riskLevel = 'HIGH';
    riskEmoji = '🟠';
  } else if (riskScore >= 20) {
    riskLevel = 'MEDIUM';
    riskEmoji = '🟡';
  } else {
    riskLevel = 'LOW';
    riskEmoji = '🟢';
  }

  // ── Plain-English narrative ──
  const narrative = generateNarrative({
    address, chain, riskLevel, riskScore, activeFlags,
    buyTax, sellTax, holderAnalysis, liquidityAnalysis,
    tokenName: d.token_name || 'Unknown',
    tokenSymbol: d.token_symbol || '???',
    totalSupply: d.total_supply,
    ownerAddress: d.owner_address,
    isOpenSource: isTrue(d.is_open_source),
    creatorAddress: d.creator_address,
    isTrusted,
    isCexListed,
    totalHolders,
  });

  // ── Build flag details ──
  const flagDetails = activeFlags
    .filter(f => FLAGS[f])
    .map(f => ({
      flag: FLAGS[f].label,
      severity: getSeverity(f, isTrusted),
      description: FLAGS[f].desc,
    }));

  return {
    ok: true,
    address,
    chain,
    token: {
      name: d.token_name || 'Unknown',
      symbol: d.token_symbol || '???',
      totalSupply: d.total_supply || null,
      decimals: d.decimals || null,
      isOpenSource: isTrue(d.is_open_source),
      ownerAddress: d.owner_address || null,
      isTrusted,
      isCexListed,
      totalHolders,
    },
    riskScore,
    riskLevel,
    riskEmoji,
    summary: narrative.summary,
    verdict: narrative.verdict,
    flags: flagDetails,
    details: {
      tax: {
        buy: buyTax !== null ? `${buyTax.toFixed(1)}%` : 'Unknown',
        sell: sellTax !== null ? `${sellTax.toFixed(1)}%` : 'Unknown',
      },
      holders: holderAnalysis
        ? {
            top10Percent: `${holderAnalysis.top10Percent}%`,
            lockedHolders: holderAnalysis.lockedCount,
            totalHolders: totalHolders || holderAnalysis.holderCount,
          }
        : null,
      liquidity: {
        hasLiquidity: liquidityAnalysis.hasLiquidity,
        isLocked: liquidityAnalysis.isLocked,
        lockedPercent: `${liquidityAnalysis.lockedPercent}%`,
      },
    },
    scannedAt: new Date().toISOString(),
    poweredBy: 'TrustAudit + GoPlus Security',
  };
}
function getSeverity(flagKey, isTrusted) {
  if (isTrusted) return 'info'; // All warnings are downgraded to informational for trusted assets
  const criticalFlags = ['honeypot', 'is_blacklisted', 'selfdestruct', 'hidden_owner',
    'owner_change_balance', 'extreme_sell_tax', 'extreme_concentration', 'can_take_back_ownership'];
  const highFlags = ['transfer_pausable', 'trading_cooldown', 'external_call',
    'is_mintable', 'no_liquidity', 'high_sell_tax'];
  if (criticalFlags.includes(flagKey)) return 'critical';
  if (highFlags.includes(flagKey)) return 'high';
  return 'medium';
}

function generateNarrative({ address, chain, riskLevel, riskScore, activeFlags,
  buyTax, sellTax, holderAnalysis, liquidityAnalysis,
  tokenName, tokenSymbol, isOpenSource, ownerAddress, isTrusted, isCexListed, totalHolders }) {

  const parts = [];

  // Opening
  if (isTrusted) {
    parts.push(`✅ TRUSTED ASSET: ${tokenSymbol} (${tokenName}) on ${chain} is a verified, highly trusted asset.`);
  } else if (riskLevel === 'CRITICAL') {
    parts.push(`⚠️ CRITICAL RISK DETECTED for ${tokenSymbol} (${tokenName}) on ${chain}.`);
  } else if (riskLevel === 'HIGH') {
    parts.push(`🔶 HIGH RISK detected for ${tokenSymbol} (${tokenName}) on ${chain}.`);
  } else if (riskLevel === 'MEDIUM') {
    parts.push(`⚡ MEDIUM RISK detected for ${tokenSymbol} (${tokenName}) on ${chain}.`);
  } else {
    parts.push(`✅ LOW RISK: ${tokenSymbol} (${tokenName}) on ${chain} passed most security checks.`);
  }

  // Honeypot
  if (activeFlags.includes('honeypot')) {
    parts.push('🚨 HONEYPOT CONFIRMED: This token cannot be sold. Any funds sent to buy this token are effectively lost.');
  }

  // Tax
  if (sellTax !== null) {
    if (sellTax > 50) {
      parts.push(`Sell tax is ${sellTax.toFixed(1)}% — exiting this position would lose more than half your investment to tax alone.`);
    } else if (sellTax > 10) {
      parts.push(`Sell tax is ${sellTax.toFixed(1)}%, which is high and significantly reduces your exit value.`);
    }
  }

  // Holder concentration
  if (activeFlags.includes('extreme_concentration') && holderAnalysis) {
    parts.push(`Top 10 wallets hold ${holderAnalysis.top10Percent}% of supply — extreme concentration increases rug pull probability.`);
  } else if (activeFlags.includes('high_concentration') && holderAnalysis) {
    if (isTrusted) {
      parts.push(`Top 10 wallets hold ${holderAnalysis.top10Percent}% of supply, which is standard for major centralized reserves/bridges.`);
    } else {
      parts.push(`Top 10 wallets hold ${holderAnalysis.top10Percent}% of supply — concentrated ownership is a yellow flag.`);
    }
  }

  // Liquidity
  if (activeFlags.includes('no_liquidity')) {
    parts.push('No liquidity pool detected — this token cannot currently be traded on DEXs.');
  } else if (activeFlags.includes('lp_not_locked') && !isTrusted) {
    parts.push(`Liquidity is NOT locked — the deployer can remove all liquidity at any time, causing a rug pull.`);
  } else if (liquidityAnalysis.hasLiquidity && liquidityAnalysis.isLocked) {
    parts.push(`Liquidity is locked (${liquidityAnalysis.lockedPercent}% secured) — reduces rug pull risk.`);
  }

  // Ownership / Backdoor flags (Explain with context of trust)
  if (activeFlags.includes('owner_change_balance')) {
    if (isTrusted) {
      parts.push('The contract owner holds balance modification capabilities, commonly used by bridge/custody admins for verified stablecoins.');
    } else {
      parts.push('The owner can modify wallet balances — a critical backdoor for theft.');
    }
  }
  if (activeFlags.includes('hidden_owner')) {
    parts.push('A hidden owner address was detected — the contract has concealed administrative control.');
  }
  if (activeFlags.includes('can_take_back_ownership')) {
    parts.push('Ownership appears renounced but can be reclaimed — this is a fake renounce pattern.');
  }

  // Mint
  if (activeFlags.includes('is_mintable')) {
    if (isTrusted) {
      parts.push('Supply is mintable (standard for stablecoins to maintain peg/issuance).');
    } else {
      parts.push('Token is mintable — new supply can be created at any time, diluting your holdings.');
    }
  }

  // Transfer pause
  if (activeFlags.includes('transfer_pausable')) {
    if (isTrusted) {
      parts.push('Transfers are pausable by the contract admin (compliance/freeze feature).');
    } else {
      parts.push('Token transfers can be paused by the owner — your funds could be frozen.');
    }
  }

  // Open source
  if (!isOpenSource) {
    parts.push('Source code is NOT verified — the contract logic cannot be audited publicly.');
  }

  // Verdict
  let verdict;
  if (isTrusted) {
    verdict = '✅ SAFE ASSET. This is a widely recognized token on GoPlus trust list. Proceed with confidence for standard trading.';
  } else if (riskLevel === 'CRITICAL') {
    verdict = '❌ DO NOT INTERACT. This contract shows characteristics of a scam or honeypot. Any investment is at extreme risk of total loss.';
  } else if (riskLevel === 'HIGH') {
    verdict = '⚠️ AVOID OR PROCEED WITH EXTREME CAUTION. Multiple high-severity risk factors detected. Research thoroughly before any investment.';
  } else if (riskLevel === 'MEDIUM') {
    verdict = '🔍 RESEARCH REQUIRED. Some risk factors present. Review the flags carefully and verify the project legitimacy before investing.';
  } else {
    verdict = '✅ LOW RISK. Standard due diligence still recommended.';
  }

  return {
    summary: parts.join(' '),
    verdict,
  };
}

module.exports = { scoreRisk };
