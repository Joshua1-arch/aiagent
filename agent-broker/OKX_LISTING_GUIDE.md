# AgentGate — OKX.AI ASP Listing Content

Use this to edit Agent Agent #4885 resubmission on https://onchainos.okx.com/a2a/agent-center.

---

## 1. Service Name

```
AgentGate — ASP Pre-Validator + Agent Hiring Broker
```

## 2. Service Description (paste into description field)

```
AgentGate is a two-sided agent service built on OKX.AI:

A. PRE-VALIDATION — Before you submit an ASP listing to OKX.AI, AgentGate runs 8 automated checks against your agent's endpoint to catch rejection reasons proactively:

- X402 compliance (HTTP 402, PAYMENT-REQUIRED header, accepts[] array, Bazaar extension)
- Endpoint latency (3-probe timing — pass <2s / warn <5s / fail >5s)
- Metadata completeness (name, description quality, service type, pricing, profile picture)
- Docker compatibility (localhost binding detection, hostname pattern analysis)
- Schema validation (OpenAPI spec format, path matching)
- Hackathon eligibility (prize category mapping, deadline proximity to July 28, 2026)
- Description quality scoring (depth and clarity evaluation)
- Specific fix recommendations per failure

B. AGENT HIRING BROKER — Once validated, AgentGate searches the OKX.AI marketplace for the right provider agent for your task, reasons over agent capabilities and reputation, publishes the task on-chain via a2a-pay, and tracks it through completion.

INPUT EXAMPLE:
{
  "action": "validate",
  "endpoint": "https://your-agent.example.com/api",
  "metadata": {
    "name": "MyAgent",
    "description": "Scans Solana tokens for honeypot and liquidity risk. Supports bundle detection and holder cluster analysis.",
    "serviceType": "Security",
    "pricing": "0.001 ETH per scan",
    "chain": "solana"
  },
  "openApiSchema": "openapi: 3.0.0\ninfo:\n  title: MyAgent API\n  version: 1.0.0\npaths:\n  /scan:\n    post:\n      summary: Scan a token\n      parameters:\n        - name: tokenAddress\n          in: query\n          schema:\n            type: string"
}

OUTPUT EXAMPLE:
{
  "score": 72,
  "overall": "needs_work",
  "summary": "6 of 8 checks passed. 2 warnings.",
  "checks": [
    {
      "category": "x402_compliance",
      "status": "fail",
      "message": "Endpoint did not return HTTP 402 or PAYMENT-REQUIRED header",
      "recommendation": "Implement x402 handler: return 402 with WWW-Authenticate: Payment header, reveal amounts in accepts[]"
    },
    {
      "category": "hackathon_eligibility",
      "status": "pass",
      "message": "Description mentions 'security' and 'risk' — maps to Security Tools track"
    }
  ]
}
```

## 3. Parameter Details

**Parameter details for service:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| action | string | yes | Operation: "validate" for pre-validation, "hire" for broker |
| endpoint | string | yes (for validate) | The ASP agent's base URL to probe |
| metadata | object | yes (for validate) | Agent metadata for completeness checks |
| metadata.name | string | yes | Agent display name |
| metadata.description | string | yes | Agent description (min 50 chars) |
| metadata.serviceType | string | yes | Category: Security, Trading, Data, DeFi, NFT, Social, AI, Custom |
| metadata.pricing | string | yes | Price description or amount |
| metadata.chain | string | no | Target blockchain (solana, ethereum, base, etc.) |
| metadata.profilePicture | string | no | Avatar URL for metadata completeness |
| openApiSchema | string | no | OpenAPI 3.0 YAML/JSON for schema validation |
| taskDescription | string | yes (for hire) | Description of task to be done |
| budget | string | yes (for hire) | Maximum task budget |
| category | string | no | Filter for agent search |

## 4. Pricing

```
Free validation (public good). Hiring: standard a2a-pay task fees apply.
```

## 5. Usage Examples

**Example 1 — Validate an ASP agent before submitting to OKX:**

```json
{
  "action": "validate",
  "endpoint": "https://api.trustaudit.example.com",
  "metadata": {
    "name": "TrustAudit",
    "description": "On-chain smart contract auditor supporting Solana and EVM chains. Detects honeypots, rug pulls, and token risk patterns.",
    "serviceType": "Security",
    "pricing": "0.002 ETH per audit"
  }
}
```

Expected output:
```json
{
  "score": 85,
  "overall": "good",
  "summary": "7 of 8 checks passed. 1 warning.",
  "checks": [
    {
      "category": "x402_compliance",
      "status": "warn",
      "message": "Response time 2800ms (threshold: 2000ms)",
      "recommendation": "Consider optimizing endpoint response time"
    }
  ]
}
```

**Example 2 — Hire a Solana sniping agent:**

```json
{
  "action": "hire",
  "taskDescription": "Monitor pump.fun for new SOL tokens and snipe buys under 0.1 SOL with 0.5 slippage",
  "budget": "0.05 SOL",
  "category": "Trading"
}
```

Expected output (AgentGate searches marketplace, selects best match, creates task):
```json
{
  "taskId": 12345,
  "agent": "Agent Name (#9999)",
  "status": "searching"
}
```

**Example 3 — Validate with OpenAPI schema and Docker metadata:**

```json
{
  "action": "validate",
  "endpoint": "http://localhost:3000",
  "metadata": {
    "name": "Local Agent",
    "description": "Test agent running on local machine for development",
    "serviceType": "Custom",
    "pricing": "free"
  },
  "openApiSchema": "openapi: 3.0.0\ninfo:\n  title: Local\n  version: 1.0.0\npaths:\n  /health:\n    get:\n      responses:\n        '200':\n          description: OK"
}
```

Expected output (will fail docker check and endpoint check):
```json
{
  "score": 45,
  "overall": "needs_work",
  "summary": "4 of 8 checks passed. 2 warnings. 2 failures.",
  "checks": [
    {
      "category": "docker_compatibility",
      "status": "fail",
      "message": "Endpoint uses localhost — not reachable from Docker",
      "recommendation": "Use 0.0.0.0 or DNS hostname instead of localhost"
    }
  ]
}
```

## 6. Submission Notes

- Agent ID: **4885** (rename from "Agent Broker" to "AgentGate")
- Wallet: `0xf1779f61c8f4e0ddbd942f29963aeec01840b111` (Account 1)
- The endpoint does not need to serve x402 for OKX listing — the validator checks the *target* endpoint for x402, not AgentGate's own endpoint
- After accepting the listing, run `okx-a2a agent update --id 4885` with updated content
