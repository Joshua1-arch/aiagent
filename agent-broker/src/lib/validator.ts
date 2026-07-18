import { promises as dns } from 'dns';
import type { ValidationResult, ValidationCheck, ValidateRequest } from './types';

function check(partial: Omit<ValidationCheck, 'name'> & { name?: string }): ValidationCheck {
  return { name: partial.name ?? 'check', severity: 'medium', ...partial };
}

function buildRecommendation(check: ValidationCheck): string {
  const key = check.name.split(':')[0];
  const map: Record<string, (c: ValidationCheck) => string> = {
    'x402': () => 'Implement x402 protocol: return HTTP 402 with `PAYMENT-REQUIRED` header, EIP-712 digest, and `accepts[]` with CAIP-2 network format (e.g. eip155:8453 for Base).',
    'endpoint': () => `Make sure the endpoint URL is publicly reachable. Issue: ${check.message}`,
    'endpoint-latency': (c) => {
      if (c.details) {
        const match = c.details.match(/([\d.]+)ms/);
        if (match) return `Endpoint responded in ${match[1]}ms. Target: <2000ms. Consider: adding CDN caching, reducing response payload size, upgrading server region.`;
      }
      return 'Optimize endpoint response time to under 2000ms. Slow endpoints are flagged during OKX review.';
    },
    'metadata': (c) => {
      if (c.message.includes('name')) return `ASP name is too short (under 3 chars). Choose a descriptive name that reflects your service.`;
      if (c.message.includes('type')) return 'Service type must be "A2A" (for task-based negotiation) or "A2MCP" (for API endpoint services).';
      return c.message;
    },
    'docker': (c) => {
      if (c.message.includes('localhost')) return 'Change "localhost" or "127.0.0.1" to "0.0.0.0" so the endpoint is reachable from outside the container. In Docker, localhost refers to the container itself.';
      if (c.message.includes('DNS lookup failed')) return `Hostname does not resolve in DNS. Check that "${c.message.split('"')[1] || 'your hostname'}" is a valid public DNS name.`;
      return 'Ensure your endpoint is accessible from outside Docker. Bind to 0.0.0.0 and use a public hostname.';
    },
    'schema': (c) => {
      if (c.message.includes('No OpenAPI')) return 'Provide an OpenAPI 3.x JSON spec. This lets OKX reviewers verify your endpoint schema matches your service description.';
      if (c.message.includes('not valid')) return 'Your OpenAPI spec could not be parsed. Ensure it is valid JSON with an "openapi" or "swagger" root field.';
      return c.message;
    },
    'output': (c) => {
      if (c.message.includes('short')) return `Description is too brief (${check.details || 'low word count'}). Expand to cover: (1) what the agent does, (2) input parameters it accepts, (3) output format it returns, (4) a concrete usage example.`;
      if (c.message.includes('missing')) return 'Your description lacks one or more key sections. Include: what the agent does, inputs, outputs, and an example use case.';
      return 'Improve description quality. Include technical details (specific chains, protocols, formats) to demonstrate depth.';
    },
    'hackathon': () => 'Submit before the July 28 deadline. Requirements: (1) ASP listed on marketplace, (2) Post on X with #OKXAI, (3) Demo video ≤90s, (4) Submit Google form.',
    'quality': (c) => `Description quality score: ${c.message}. ${c.details || 'Aim for a comprehensive description with technical depth and examples.'}`,
    'profile-pic': () => 'Add a profile picture URL. OKX listings with avatars have higher approval rates.',
    'pricing': (c) => {
      if (c.message.includes('negative')) return 'Fee cannot be negative. Set a fee of 0 for free services or a positive amount.';
      if (c.message.includes('high')) return 'Fee of ' + (c.details || '>100 USDT') + ' is high for the current marketplace. Most services are priced between 0.01 and 10 USDT.';
      return c.message;
    },
  };
  const builder = map[key];
  if (builder) return builder(check);
  const msg = check.message.replace(/["']/g, '');
  return `Fix: ${msg.length > 120 ? msg.slice(0, 120) + '...' : msg}`;
}

async function checkX402(endpoint: string): Promise<ValidationCheck[]> {
  const checks: ValidationCheck[] = [];
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.status === 402) {
      const paymentHeader = response.headers.get('payment-required') || response.headers.get('x-payment-required') || '';
      const contentType = response.headers.get('content-type') || '';

      checks.push(check({
        name: 'x402: HTTP 402 response',
        status: 'pass',
        message: 'Endpoint returns 402 Payment Required',
        severity: 'critical',
      }));

      if (paymentHeader) {
        checks.push(check({
          name: 'x402: PAYMENT-REQUIRED header',
          status: 'pass',
          message: `Payment header present: ${paymentHeader.slice(0, 80)}...`,
          severity: 'high',
        }));
      } else {
        checks.push(check({
          name: 'x402: PAYMENT-REQUIRED header',
          status: 'warn',
          message: 'Missing PAYMENT-REQUIRED header. Add it so agents can parse the payment challenge.',
          severity: 'high',
          details: 'The x402 spec requires a PAYMENT-REQUIRED header with the EIP-712 typed data digest.',
        }));
      }

      if (contentType.includes('json')) {
        try {
          const body = await response.clone().json();
          if (body.accepts && Array.isArray(body.accepts)) {
            checks.push(check({
              name: 'x402: accepts[] array',
              status: 'pass',
              message: `Accepts ${body.accepts.length} payment route(s)`,
            }));
            const hasCaip = body.accepts.some((a: string) => a.includes(':'));
            if (!hasCaip) {
              checks.push(check({
                name: 'x402: CAIP-2 network format',
                status: 'warn',
                message: 'accepts[] should use CAIP-2 format (e.g. eip155:8453) not chain names',
                details: 'Use eip155:8453 for Base, eip155:1 for Ethereum, etc.',
              }));
            }
          }
          if (body.extensions?.bazaar?.info?.input?.method) {
            checks.push(check({
              name: 'x402: Bazaar discovery extension',
              status: 'pass',
              message: 'Bazaar extension detected — endpoint is discoverable',
              severity: 'high',
            }));
          } else {
            checks.push(check({
              name: 'x402: Bazaar discovery extension',
              status: 'warn',
              message: 'No Bazaar extension. Add extensions.bazaar.info.input.method for CDP Bazaar indexing.',
              severity: 'medium',
            }));
          }
        } catch {}
      }
    } else if (response.ok) {
      checks.push(check({
        name: 'x402: expected 402',
        status: 'warn',
        message: `Endpoint returned ${response.status} instead of 402. Paid A2MCP services must return 402 on first call.`,
        severity: 'critical',
        details: 'A paid x402 endpoint should return HTTP 402 Payment Required on unpaid requests. If this is a free endpoint, set price to 0.',
      }));
    } else {
      checks.push(check({
        name: 'x402: expected 402',
        status: 'fail',
        message: `Unexpected status ${response.status}. Check endpoint configuration.`,
        severity: 'critical',
      }));
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    checks.push(check({
      name: 'x402: endpoint reachable',
      status: 'fail',
      message: `Cannot reach endpoint: ${msg}`,
      severity: 'critical',
    }));
  }
  return checks;
}

async function checkLatency(endpoint: string): Promise<ValidationCheck[]> {
  const checks: ValidationCheck[] = [];
  const timings: number[] = [];

  for (let i = 0; i < 3; i++) {
    try {
      const start = performance.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      await fetch(endpoint, { method: 'HEAD', signal: controller.signal });
      clearTimeout(timeout);
      timings.push(performance.now() - start);
    } catch {
      try {
        const start = performance.now();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        await fetch(endpoint, { method: 'GET', signal: controller.signal });
        clearTimeout(timeout);
        timings.push(performance.now() - start);
      } catch {
        timings.push(-1);
      }
    }
  }

  const positiveTimings = timings.filter(t => t > 0);
  const avg = positiveTimings.length > 0
    ? positiveTimings.reduce((a, b) => a + b, 0) / positiveTimings.length
    : 0;
  const max = positiveTimings.length > 0 ? Math.max(...positiveTimings) : 0;
  const min = positiveTimings.length > 0 ? Math.min(...positiveTimings) : 0;

  if (positiveTimings.length === 0) {
    checks.push(check({
      name: 'endpoint-latency',
      status: 'fail',
      message: 'Could not measure latency — endpoint unreachable',
      severity: 'high',
    }));
  } else if (avg > 5000) {
    checks.push(check({
      name: 'endpoint-latency',
      status: 'fail',
      message: `Very slow: ${avg.toFixed(0)}ms avg (max ${max.toFixed(0)}ms). Target < 2000ms.`,
      severity: 'high',
      details: `Min: ${min.toFixed(0)}ms, Max: ${max.toFixed(0)}ms, Samples: ${positiveTimings.length}`,
    }));
  } else if (avg > 2000) {
    checks.push(check({
      name: 'endpoint-latency',
      status: 'warn',
      message: `Moderate latency: ${avg.toFixed(0)}ms avg (max ${max.toFixed(0)}ms).`,
      severity: 'medium',
      details: `Min: ${min.toFixed(0)}ms, Max: ${max.toFixed(0)}ms, Samples: ${positiveTimings.length}`,
    }));
  } else {
    checks.push(check({
      name: 'endpoint-latency',
      status: 'pass',
      message: `Fast response: ${avg.toFixed(0)}ms avg (max ${max.toFixed(0)}ms)`,
      severity: 'low',
      details: `Min: ${min.toFixed(0)}ms, Max: ${max.toFixed(0)}ms, Samples: ${positiveTimings.length}`,
    }));
  }

  return checks;
}

function checkMetadata(req: ValidateRequest): ValidationCheck[] {
  const checks: ValidationCheck[] = [];

  if (!req.aspName || req.aspName.length < 3) {
    checks.push(check({
      name: 'metadata: ASP name',
      status: 'fail',
      message: 'ASP name is missing or too short (min 3 chars)',
      severity: 'critical',
    }));
  } else {
    checks.push(check({
      name: 'metadata: ASP name',
      status: 'pass',
      message: `ASP name: "${req.aspName}" (${req.aspName.length} chars)`,
    }));
  }

  if (!req.aspDescription || req.aspDescription.length < 50) {
    checks.push(check({
      name: 'metadata: ASP description',
      status: 'fail',
      message: 'ASP description is too short (min 50 chars recommended). Describe what your agent does, who it serves, and why it is valuable.',
      severity: 'critical',
      details: req.aspDescription ? `Current: ${req.aspDescription.length} chars` : 'Missing',
    }));
  } else if (req.aspDescription.length < 120) {
    checks.push(check({
      name: 'metadata: ASP description',
      status: 'warn',
      message: `ASP description is brief (${req.aspDescription.length} chars). Add more detail for better approval odds.`,
      severity: 'medium',
    }));
  } else {
    checks.push(check({
      name: 'metadata: ASP description',
      status: 'pass',
      message: `ASP description is thorough (${req.aspDescription.length} chars)`,
    }));
  }

  if (!req.serviceName || req.serviceName.length < 3) {
    checks.push(check({
      name: 'metadata: service name',
      status: 'fail',
      message: 'Service name is missing or too short',
      severity: 'critical',
    }));
  } else {
    checks.push(check({
      name: 'metadata: service name',
      status: 'pass',
      message: `Service name: "${req.serviceName}"`,
    }));
  }

  if (!req.serviceDescription || req.serviceDescription.length < 80) {
    checks.push(check({
      name: 'metadata: service description',
      status: 'fail',
      message: 'Service description is too short (min 80 chars). Must include: what the service does, input parameters, output format, and example use.',
      severity: 'critical',
      details: 'OKX requires "a complete description, parameter details, and usage examples" per rejection feedback.',
    }));
  } else if (req.serviceDescription.length < 200) {
    checks.push(check({
      name: 'metadata: service description',
      status: 'warn',
      message: `Service description is ${req.serviceDescription.length} chars. Expand with parameter details and usage examples for better odds.`,
      severity: 'medium',
    }));
  } else {
    checks.push(check({
      name: 'metadata: service description',
      status: 'pass',
      message: `Service description is thorough (${req.serviceDescription.length} chars)`,
    }));
  }

  if (!req.serviceType || !['A2A', 'A2MCP'].includes(req.serviceType)) {
    checks.push(check({
      name: 'metadata: service type',
      status: 'fail',
      message: 'Service type must be A2A or A2MCP',
      severity: 'critical',
    }));
  } else {
    checks.push(check({
      name: 'metadata: service type',
      status: 'pass',
      message: `Service type: ${req.serviceType}`,
    }));
  }

  if (req.serviceType === 'A2MCP') {
    if (!req.endpoint) {
      checks.push(check({
        name: 'metadata: endpoint',
        status: 'fail',
        message: 'A2MCP services require an endpoint URL',
        severity: 'critical',
      }));
    } else if (!req.endpoint.startsWith('http://') && !req.endpoint.startsWith('https://')) {
      checks.push(check({
        name: 'metadata: endpoint format',
        status: 'fail',
        message: 'Endpoint must start with http:// or https://',
        severity: 'critical',
      }));
    } else {
      checks.push(check({
        name: 'metadata: endpoint',
        status: 'pass',
        message: `Endpoint: ${req.endpoint}`,
      }));
    }
  }

  if (req.fee < 0) {
    checks.push(check({
      name: 'metadata: pricing',
      status: 'fail',
      message: 'Fee cannot be negative',
      severity: 'high',
    }));
  } else if (req.fee === 0) {
    checks.push(check({
      name: 'metadata: pricing',
      status: 'pass',
      message: 'Free service (no x402 required)',
    }));
  } else if (req.fee > 100) {
    checks.push(check({
      name: 'metadata: pricing',
      status: 'warn',
      message: `Fee is ${req.fee} USDT — high for the current marketplace. Most services are 0.01-10 USDT.`,
      severity: 'medium',
    }));
  } else {
    checks.push(check({
      name: 'metadata: pricing',
      status: 'pass',
      message: `Fee: ${req.fee} USDT`,
    }));
  }

  if (!req.profilePicture) {
    checks.push(check({
      name: 'metadata: profile picture',
      status: 'warn',
      message: 'No profile picture URL provided. Add one for better listing approval odds.',
      severity: 'low',
    }));
  } else {
    checks.push(check({
      name: 'metadata: profile picture',
      status: 'pass',
      message: 'Profile picture provided',
    }));
  }

  return checks;
}

// ── Output Quality ─────────────────────────────────────────────────────

const QUALITY_ACTION_VERBS = /scans?|analyz?e|monitors?|trades?|audits?|detects?|validates?|checks?|verifies?|generates?|creates?|builds?|provides?|offers?|supports?|enables?|allows?|fetches?|extracts?|converts?|routes?|optimizes?|predicts?/i;
const QUALITY_INPUT_WORDS = /input|parameter|takes?|accepts?|receives?|expects?|requires?|address|token|id|query|argument|payload|request/i;
const QUALITY_OUTPUT_WORDS = /return|output|result|response|delivers?|produces?|generates?|yields?|provides?|emits?|responds?/i;
const QUALITY_EXAMPLE_WORDS = /example|sample|e\.g\.|for instance|like|demo|showcase|use case|scenario|illustrate/i;
const QUALITY_CHAIN_NAMES = /solana|ethereum|base|bsc|polygon|arbitrum|optimism|avalanche|sui|aptos|xlayer|linea|scroll|zksync|blast|mode|celo|fantom|near|cosmos|osmosis|injective|sei/i;
const QUALITY_PROTOCOLS = /x402|a2a|a2mcp|webhook|websocket|api|sdk|rest|graphql|grpc|json-rpc|ipfs|erc-20|erc-721|erc-1155|permit2|eip-712|caip/i;
const QUALITY_FORMATS = /json|yaml|markdown|csv|pdf|image|audio|text|hex|base64|utf-8|buffer|stream|blob|file/i;

function checkOutputQuality(req: ValidateRequest): ValidationCheck[] {
  const checks: ValidationCheck[] = [];
  const combined = [req.aspName, req.aspDescription, req.serviceName, req.serviceDescription].filter(Boolean).join(' ');

  if (!combined || combined.trim().length < 20) {
    checks.push(check({ name: 'quality: overall', status: 'fail', message: 'Descriptions too short to evaluate quality', severity: 'high' }));
    return checks;
  }

  // Dimension 1: Verbosity (words, sentences, paragraphs)
  const words = combined.split(/\s+/).filter(w => w.length > 0);
  const sentences = combined.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const paragraphs = combined.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  const wordCount = words.length;
  const sentenceCount = sentences.length;
  const avgWordsPerSentence = sentenceCount > 0 ? wordCount / sentenceCount : wordCount;

  let verbosityScore = 0;
  if (wordCount < 30) verbosityScore = 20;
  else if (wordCount < 60) verbosityScore = 40;
  else if (wordCount < 100) verbosityScore = 65;
  else if (wordCount < 200) verbosityScore = 85;
  else verbosityScore = 100;

  checks.push(check({
    name: 'quality: verbosity',
    status: wordCount >= 60 ? 'pass' : wordCount >= 30 ? 'warn' : 'fail',
    message: `${wordCount} words, ${sentenceCount} sentences, ${paragraphs.length} paragraphs`,
    details: wordCount < 60 ? `Only ${wordCount} words — expand to at least 60 for adequate detail` : undefined,
    severity: wordCount < 30 ? 'high' : 'low',
  }));

  // Dimension 2: Structure / section coverage
  const hasAction = QUALITY_ACTION_VERBS.test(combined);
  const hasInput = QUALITY_INPUT_WORDS.test(combined);
  const hasOutput = QUALITY_OUTPUT_WORDS.test(combined);
  const hasExample = QUALITY_EXAMPLE_WORDS.test(combined);
  const structureFlags = [hasAction, hasInput, hasOutput, hasExample];
  const structureScore = structureFlags.filter(Boolean).length;
  const missingSections: string[] = [];
  if (!hasAction) missingSections.push('description of what the agent does');
  if (!hasInput) missingSections.push('input/parameter specification');
  if (!hasOutput) missingSections.push('output/return format');
  if (!hasExample) missingSections.push('usage example');

  checks.push(check({
    name: 'quality: structure',
    status: structureScore >= 3 ? 'pass' : structureScore >= 2 ? 'warn' : 'fail',
    message: `Covers ${structureScore}/4 key sections (what it does, inputs, outputs, example)`,
    details: missingSections.length > 0 ? `Missing: ${missingSections.join(', ')}` : undefined,
    severity: structureScore <= 1 ? 'high' : 'medium',
  }));

  // Dimension 3: Technical depth
  const chainMatches = (combined.match(QUALITY_CHAIN_NAMES) || []).length;
  const protocolMatches = (combined.match(QUALITY_PROTOCOLS) || []).length;
  const formatMatches = (combined.match(QUALITY_FORMATS) || []).length;
  const techTotal = chainMatches + protocolMatches + formatMatches;

  checks.push(check({
    name: 'quality: technical depth',
    status: techTotal >= 4 ? 'pass' : techTotal >= 2 ? 'warn' : 'fail',
    message: `${techTotal} technical references (${chainMatches} chains, ${protocolMatches} protocols, ${formatMatches} formats)`,
    details: techTotal < 2 ? 'Add specific blockchain names, protocol standards, and data format details' : undefined,
    severity: techTotal === 0 ? 'high' : 'low',
  }));

  // Dimension 4: Specificity (numbers, addresses, IDs, concrete values)
  const hasConcreteValues = /\b0x[a-fA-F0-9]{40}\b|\b0x[a-fA-F0-9]{64}\b|\d+\.\d+\s*(SOL|ETH|USDC|USDT)\b|\b\d+\s*(tps|ms|gb|mb|kb)\b|\$\d+/i.test(combined);
  const hasSpecificEntities = /\b(agent|contract|pool|vault|protocol|dapp|market|order|trade|swap|bridge|lend|borrow|stake|farm|yield)\b/i.test(combined);
  const specificityScore = (hasConcreteValues ? 1 : 0) + (hasSpecificEntities ? 1 : 0);

  checks.push(check({
    name: 'quality: specificity',
    status: specificityScore >= 2 ? 'pass' : specificityScore >= 1 ? 'warn' : 'fail',
    message: hasConcreteValues ? 'Contains concrete values (addresses, amounts, benchmarks)' : 'No concrete values or benchmarks',
    details: !hasConcreteValues ? 'Add specific addresses, amounts, or performance metrics to demonstrate real functionality' : undefined,
    severity: specificityScore === 0 ? 'medium' : 'low',
  }));

  // Composite score
  const weights = { verbosity: 0.15, structure: 0.35, techDepth: 0.30, specificity: 0.20 };
  const compositeScore = Math.round(
    (verbosityScore / 100) * weights.verbosity * 100 +
    (structureScore / 4) * weights.structure * 100 +
    Math.min(techTotal / 6, 1) * weights.techDepth * 100 +
    (specificityScore / 2) * weights.specificity * 100
  );

  let qualityStatus: 'pass' | 'fail' | 'warn';
  if (compositeScore >= 70) qualityStatus = 'pass';
  else if (compositeScore >= 40) qualityStatus = 'warn';
  else qualityStatus = 'fail';

  checks.push(check({
    name: 'quality: composite',
    status: qualityStatus,
    message: `Quality score: ${compositeScore}/100`,
    details: compositeScore < 70 ? 'Target ≥70. Key areas to improve: ' + missingSections.join(', ') : 'Good quality — covers key sections with technical depth',
    severity: compositeScore < 40 ? 'high' : 'low',
  }));

  return checks;
}

// ── Docker Private Ranges ─────────────────────────────────────────────

const DOCKER_PRIVATE_RANGES = [
  { prefix: '10.',     label: '10.x.x.x (RFC 1918)' },
  { prefix: '172.16.', label: '172.16.x.x (Docker default bridge)' },
  { prefix: '172.17.', label: '172.17.x.x (Docker default)' },
  { prefix: '172.18.', label: '172.18.x.x' },
  { prefix: '172.19.', label: '172.19.x.x' },
  { prefix: '172.20.', label: '172.20.x.x' },
  { prefix: '172.21.', label: '172.21.x.x' },
  { prefix: '172.22.', label: '172.22.x.x' },
  { prefix: '172.23.', label: '172.23.x.x' },
  { prefix: '172.24.', label: '172.24.x.x' },
  { prefix: '172.25.', label: '172.25.x.x' },
  { prefix: '172.26.', label: '172.26.x.x' },
  { prefix: '172.27.', label: '172.27.x.x' },
  { prefix: '172.28.', label: '172.28.x.x' },
  { prefix: '172.29.', label: '172.29.x.x' },
  { prefix: '172.30.', label: '172.30.x.x' },
  { prefix: '172.31.', label: '172.31.x.x' },
  { prefix: '192.168.', label: '192.168.x.x (RFC 1918)' },
];

async function checkDockerCompatibility(endpoint: string): Promise<ValidationCheck[]> {
  const checks: ValidationCheck[] = [];
  if (!endpoint) return checks;

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    checks.push(check({
      name: 'docker: URL parse',
      status: 'fail',
      message: 'Could not parse endpoint URL — cannot verify Docker compatibility',
      severity: 'critical',
    }));
    return checks;
  }

  const hostname = url.hostname;
  const port = url.port || (url.protocol === 'https:' ? '443' : '80');

  // --- Check 1: localhost binding ---
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
    if (hostname === '0.0.0.0') {
      checks.push(check({
        name: 'docker: host binding',
        status: 'pass',
        message: 'Endpoint bound to 0.0.0.0 — accessible from Docker containers',
        details: '0.0.0.0 binds to all interfaces, making it reachable from Docker.',
      }));
    } else {
      checks.push(check({
        name: 'docker: localhost binding',
        status: 'fail',
        message: `Endpoint uses "${hostname}" — unreachable from Docker containers`,
        severity: 'critical',
        details: 'In Docker, localhost resolves inside the container, not the host. Use 0.0.0.0 or the host machine IP.',
      }));
    }
  } else {
    checks.push(check({
      name: 'docker: host binding',
      status: 'pass',
      message: `Endpoint uses "${hostname}" — hostname-based, suitable for Docker`,
    }));
  }

  // --- Check 2: Docker-internal IP ranges ---
  const ipMatch = DOCKER_PRIVATE_RANGES.find(r => hostname.startsWith(r.prefix));
  if (ipMatch) {
    checks.push(check({
      name: 'docker: private IP range',
      status: 'warn',
      message: `Hostname "${hostname}" is in ${ipMatch.label} — may be Docker-internal and unreachable from OKX infrastructure`,
      severity: 'high',
    }));
  }

  // --- Check 3: reserved/unresolvable hostname patterns ---
  const suspiciousHostname = /\.local$/i.test(hostname) || /\.internal$/i.test(hostname) ||
    /\.lan$/i.test(hostname) || /localhost$/i.test(hostname) || /^[a-zA-Z]+$/.test(hostname);
  if (suspiciousHostname) {
    checks.push(check({
      name: 'docker: hostname pattern',
      status: 'warn',
      message: `Hostname "${hostname}" uses a reserved or single-label pattern — likely unreachable from Docker`,
      severity: 'high',
      details: 'OKX infrastructure runs in cloud Docker environments that need fully qualified public DNS names.',
    }));
  }

  // --- Check 4: Real DNS resolution ---
  try {
    const addresses = await dns.resolve4(hostname);
    if (addresses.length > 0) {
      const ip = addresses[0];
      checks.push(check({
        name: 'docker: DNS resolution',
        status: 'pass',
        message: `DNS resolves "${hostname}" → ${ip}`,
        severity: 'low',
      }));
      // Check if resolved IP is in private range (handles CNAME to internal IP)
      const resolvedPrivate = DOCKER_PRIVATE_RANGES.find(r => ip.startsWith(r.prefix));
      if (resolvedPrivate) {
        checks.push(check({
          name: 'docker: resolved private IP',
          status: 'warn',
          message: `DNS resolved "${hostname}" to ${ip} (${resolvedPrivate.label}) — may be Docker-internal`,
          severity: 'high',
        }));
      }
    } else {
      checks.push(check({
        name: 'docker: DNS resolution',
        status: 'fail',
        message: `DNS returned no records for "${hostname}"`,
        severity: 'critical',
      }));
    }
  } catch (err: unknown) {
    const dnsError = err as Error;
    checks.push(check({
      name: 'docker: DNS resolution',
      status: 'fail',
      message: `DNS lookup failed for "${hostname}": ${dnsError.message}`,
      severity: 'critical',
      details: 'If the hostname does not resolve, the endpoint is unreachable from OKX Docker infrastructure.',
    }));
  }

  // --- Check 5: Endpoint connectivity probe ---
  try {
    const controller = new AbortController();
    const probeTimeout = setTimeout(() => controller.abort(), 5000);
    const probe = await fetch(endpoint, { method: 'HEAD', signal: controller.signal });
    clearTimeout(probeTimeout);
    checks.push(check({
      name: 'docker: endpoint reachable',
      status: 'pass',
      message: `Endpoint reachable — HTTP ${probe.status} on ${hostname}:${port}`,
    }));
  } catch (err: unknown) {
    const probeErr = err as Error;
    if (probeErr.name === 'AbortError') {
      checks.push(check({
        name: 'docker: endpoint reachable',
        status: 'fail',
        message: `Endpoint timed out after 5s — ${hostname}:${port} may not be reachable from outside Docker`,
        severity: 'critical',
      }));
    } else {
      checks.push(check({
        name: 'docker: endpoint reachable',
        status: 'warn',
        message: `Endpoint connectivity: ${probeErr.message}`,
        severity: 'medium',
        details: 'Could not connect — may indicate Docker networking issue or endpoint is down.',
      }));
    }
  }

  return checks;
}

const HACKATHON_DEADLINE = new Date('2026-07-28T23:59:59Z');
const PRIZE_POOLS: { name: string; keywords: string[]; weight: number }[] = [
  { name: 'Finance Copilot',         keywords: ['finance', 'yield', 'trading', 'swap', 'defi', 'lending', 'borrow', 'portfolio', 'wealth', 'invest'], weight: 1.0 },
  { name: 'Software Utility',        keywords: ['software', 'api', 'utility', 'tool', 'automation', 'workflow', 'pipeline', 'integration', 'saas', 'plugin'], weight: 1.0 },
  { name: 'Lifestyle Companion',     keywords: ['lifestyle', 'health', 'fitness', 'travel', 'food', 'wellness', 'personal', 'daily', 'habit', 'social'], weight: 1.0 },
  { name: 'Artistic Excellence',     keywords: ['art', 'creative', 'image', 'design', 'music', 'video', 'nft', 'generative', 'media', 'content'], weight: 1.0 },
  { name: 'Creative Genius',         keywords: ['creative', 'genius', 'innovative', 'novel', 'breakthrough', 'unique', 'invention', 'discovery'], weight: 1.0 },
  { name: 'Social Buzz',             keywords: ['social', 'community', 'engagement', 'viral', 'network', 'follower', 'influence', 'trending'], weight: 1.0 },
];

function checkHackathonEligibility(req: ValidateRequest): ValidationCheck[] {
  const checks: ValidationCheck[] = [];
  const desc = [req.aspName, req.aspDescription, req.serviceName, req.serviceDescription].filter(Boolean).join(' ').toLowerCase();
  const now = Date.now();
  const deadlineMs = HACKATHON_DEADLINE.getTime();
  const daysRemaining = Math.max(0, Math.ceil((deadlineMs - now) / 86400000));
  const hoursRemaining = Math.max(0, Math.floor((deadlineMs - now) / 3600000));
  const isOverdue = now > deadlineMs;

  // Check 1: Deadline urgency
  if (isOverdue) {
    checks.push(check({
      name: 'hackathon: deadline',
      status: 'fail',
      message: 'Hackathon deadline (July 28, 2026) has passed',
      severity: 'critical',
      details: 'The Genesis Hackathon submission window is closed. Contact OKX support for late submission options.',
    }));
  } else if (daysRemaining <= 3) {
    checks.push(check({
      name: 'hackathon: deadline',
      status: 'warn',
      message: `⚠️ ${daysRemaining}d ${hoursRemaining % 24}h remaining until deadline — hurry!`,
      severity: 'high',
      details: `Deadline: ${HACKATHON_DEADLINE.toUTCString()}. Submit ASAP to avoid missing the window.`,
    }));
  } else if (daysRemaining <= 14) {
    checks.push(check({
      name: 'hackathon: deadline',
      status: 'warn',
      message: `${daysRemaining} days until hackathon deadline (July 28)`,
      severity: 'medium',
    }));
  } else {
    checks.push(check({
      name: 'hackathon: deadline',
      status: 'pass',
      message: `${daysRemaining} days until hackathon deadline — plenty of time`,
      severity: 'low',
    }));
  }

  // Check 2: Prize category matching — weighted
  const categoryScores: { name: string; score: number; hits: string[] }[] = [];
  for (const pool of PRIZE_POOLS) {
    const hits = pool.keywords.filter(kw => desc.includes(kw));
    if (hits.length > 0) {
      // Weight: keywords found earlier in the description count more,
      // so we check first-third vs last-third separately
      const firstThird = desc.slice(0, Math.ceil(desc.length / 3));
      const midThird = desc.slice(Math.ceil(desc.length / 3), Math.ceil(desc.length * 2 / 3));
      const positionMultiplier = hits.filter(kw => firstThird.includes(kw)).length * 2
        + hits.filter(kw => midThird.includes(kw)).length * 1.2
        + hits.filter(kw => !firstThird.includes(kw) && !midThird.includes(kw)).length * 0.6;
      const score = Math.round((hits.length / pool.keywords.length) * positionMultiplier * pool.weight * 50);
      categoryScores.push({ name: pool.name, score, hits });
    }
  }

  categoryScores.sort((a, b) => b.score - a.score);

  if (categoryScores.length > 0) {
    const best = categoryScores[0];
    checks.push(check({
      name: 'hackathon: top category',
      status: best.score >= 30 ? 'pass' : 'warn',
      message: `Best fit: ${best.name} (${best.score} pts) — ${best.hits.join(', ')}`,
      severity: 'low',
    }));
    if (categoryScores.length > 1) {
      checks.push(check({
        name: 'hackathon: alternate categories',
        status: 'pass',
        message: `Also eligible: ${categoryScores.slice(1, 3).map(c => `${c.name} (${c.score} pts)`).join(', ')}`,
        severity: 'low',
      }));
    }
  } else {
    checks.push(check({
      name: 'hackathon: top category',
      status: 'fail',
      message: 'No prize category keywords detected in description. Add terms related to Finance, Software, Lifestyle, Art, or Social.',
      severity: 'medium',
      details: 'Categories: Finance Copilot | Software Utility | Lifestyle Companion | Artistic Excellence | Creative Genius | Social Buzz',
    }));
  }

  // Check 3: Submission requirements checklist
  const mentionsX = /x\.com|twitter|#okxai|#okx|post.*x|tweet/i.test(desc) || /#okx/i.test(req.serviceName);
  const mentionsDemo = /demo|video|screen|showcase|walkthrough|tutorial/i.test(desc);
  const mentionsListed = /marketplace|listed|published|live|active/i.test(desc);
  const requirementsMet = [mentionsX, mentionsDemo, mentionsListed];
  const reqCount = requirementsMet.filter(Boolean).length;

  checks.push(check({
    name: 'hackathon: submission checklist',
    status: reqCount >= 2 ? 'pass' : reqCount >= 1 ? 'warn' : 'fail',
    message: `Submission readiness: ${reqCount}/3 requirements met`,
    details: [
      ...(!mentionsX ? ['❌ Post on X with #OKXAI'] : ['✅ X post']),
      ...(!mentionsDemo ? ['❌ Demo video ≤90s'] : ['✅ Demo video']),
      ...(!mentionsListed ? ['❌ ASP listed on marketplace'] : ['✅ ASP listed']),
    ].join(' | '),
    severity: reqCount === 0 ? 'high' : 'low',
  }));

  return checks;
}

async function checkSchema(req: ValidateRequest): Promise<ValidationCheck[]> {
  const checks: ValidationCheck[] = [];

  if (!req.openApiSpec) {
    checks.push(check({
      name: 'schema: OpenAPI spec',
      status: 'warn',
      message: 'No OpenAPI spec provided. Providing one helps reviewers verify your endpoint matches your service description.',
      severity: 'medium',
    }));
    return checks;
  }

  try {
    const spec = JSON.parse(req.openApiSpec);
    if (spec.openapi || spec.swagger) {
      checks.push(check({
        name: 'schema: valid format',
        status: 'pass',
        message: `Valid OpenAPI ${spec.openapi ? spec.openapi : 'Swagger ' + spec.swagger} spec`,
      }));

      const paths = spec.paths ? Object.keys(spec.paths) : [];
      if (paths.length === 0) {
        checks.push(check({
          name: 'schema: endpoints defined',
          status: 'warn',
          message: 'OpenAPI spec has no paths defined',
          severity: 'medium',
        }));
      } else {
        checks.push(check({
          name: 'schema: endpoints defined',
          status: 'pass',
          message: `${paths.length} endpoint(s) defined in spec`,
        }));
      }

      if (req.endpoint) {
        const match = paths.some(p => req.endpoint!.includes(p) || p.includes(req.endpoint!));
        if (!match) {
          checks.push(check({
            name: 'schema: endpoint match',
            status: 'warn',
            message: `Submitted endpoint "${req.endpoint}" does not explicitly match any path in OpenAPI spec`,
            severity: 'medium',
          }));
        } else {
          checks.push(check({
            name: 'schema: endpoint match',
            status: 'pass',
            message: 'Endpoint matches a path in OpenAPI spec',
          }));
        }
      }
    } else {
      checks.push(check({
        name: 'schema: valid format',
        status: 'fail',
        message: 'Provided spec is not valid OpenAPI or Swagger format',
        severity: 'high',
      }));
    }
  } catch {
    checks.push(check({
      name: 'schema: valid format',
      status: 'fail',
      message: 'Could not parse OpenAPI spec as valid JSON',
      severity: 'high',
    }));
  }

  return checks;
}

export async function validateASP(req: ValidateRequest): Promise<ValidationResult> {
  const allChecks: ValidationCheck[] = [];

  allChecks.push(...checkMetadata(req));
  allChecks.push(...checkOutputQuality(req));

  if (req.serviceType === 'A2MCP' && req.endpoint) {
    const x402 = await checkX402(req.endpoint);
    allChecks.push(...x402);

    const latency = await checkLatency(req.endpoint);
    allChecks.push(...latency);

    const docker = await checkDockerCompatibility(req.endpoint);
    allChecks.push(...docker);
  } else if (req.serviceType === 'A2MCP') {
    allChecks.push(check({
      name: 'endpoint: missing',
      status: 'fail',
      message: 'A2MCP requires an endpoint',
      severity: 'critical',
    }));
  }

  const schema = await checkSchema(req);
  allChecks.push(...schema);

  const hackathon = checkHackathonEligibility(req);
  allChecks.push(...hackathon);

  const failures = allChecks.filter(c => c.status === 'fail');
  const warns = allChecks.filter(c => c.status === 'warn');
  const critical = failures.filter(c => c.severity === 'critical');

  let overall: 'pass' | 'fail' | 'warn';
  let summary: string;

  if (failures.length === 0 && warns.length === 0) {
    overall = 'pass';
    summary = 'All checks passed. Your ASP is ready for listing submission.';
  } else if (critical.length === 0 && failures.length <= 2) {
    overall = 'warn';
    summary = `Passed with ${warns.length} warning(s) and ${failures.length} issue(s). Address warnings for better approval odds.`;
  } else {
    overall = 'fail';
    summary = `${failures.length} check(s) failed (${critical.length} critical). Fix the critical items before submitting.`;
  }

  const recommendations: string[] = [];
  for (const c of [...failures, ...warns]) {
    const rec = buildRecommendation(c);
    if (!recommendations.includes(rec)) {
      recommendations.push(rec);
    }
  }

  const totalChecks = allChecks.length;
  const passed = allChecks.filter(c => c.status === 'pass').length;
  const score = totalChecks > 0 ? Math.round((passed / totalChecks) * 100) : 0;

  return {
    overall,
    score,
    summary,
    checks: allChecks,
    recommendations,
    timestamp: new Date().toISOString(),
  };
}