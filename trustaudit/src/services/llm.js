const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');

/**
 * Generate AI-powered risk summary and verdict
 * @param {Object} report - The calculated report structure containing basic flags
 * @returns {Promise<{summary: string, verdict: string}|null>}
 */
async function generateLLMNarrative(report) {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!geminiKey && !openaiKey) {
    console.log('[LLM] No API keys (GEMINI_API_KEY or OPENAI_API_KEY) found. Using fallback rule-based narrative.');
    return null;
  }

  const prompt = `
Token Name: ${report.token.name} (${report.token.symbol})
Contract Address: ${report.address}
Chain: ${report.chain}
Risk Level: ${report.riskLevel} (Score: ${report.riskScore}/100)

Active Risk Flags:
${report.flags.map(f => `- [${f.severity.toUpperCase()}] ${f.flag}: ${f.description}`).join('\n') || 'None'}

Details:
- Buy Tax: ${report.details.tax.buy}
- Sell Tax: ${report.details.tax.sell}
- Holders: Top 10 hold ${report.details.holders?.top10Percent || 'Unknown'} (Total Holders: ${report.details.holders?.totalHolders || 'Unknown'})
- Liquidity locked: ${report.details.liquidity.isLocked} (${report.details.liquidity.lockedPercent} locked)
- Trusted Asset Status: ${report.token.isTrusted ? 'TRUSTED (GoPlus white-list)' : 'Not on trusted whitelist'}
- CEX Listing: ${report.token.isCexListed ? 'Listed on Centralized Exchanges' : 'No CEX listing detected'}
- Open Source: ${report.token.isOpenSource ? 'Yes' : 'No'}
`;

  const systemPrompt = `You are the AI engine of TrustAudit, a smart contract risk scanner.
Your task is to synthesize raw token data and risk flags into a concise, professional, human-readable risk narrative and final verdict.

Guidelines:
1. Explain the risk findings in plain, natural English.
2. If the token is highly trusted/verified (like USDT/USDC), explain that it is widely trusted but mention any compliance/administrative features (e.g. minting, pausing) neutrally.
3. If there are critical vulnerabilities (e.g. honeypots, extreme sell tax, fake renounced ownership, or locked-LP rug risks), highlight them clearly.
4. Keep the narrative concise (2-4 sentences). Do not include any HTML, markdown links, developer commentary, or legal disclaimers.
5. Provide a summary narrative and a clear final verdict.

Format the output strictly as a JSON object with these two fields:
{
  "summary": "<concise summary of findings>",
  "verdict": "<actionable recommendation>"
}`;

  try {
    if (geminiKey) {
      console.log('[LLM] Generating narrative using Gemini...');
      const genAI = new GoogleGenerativeAI(geminiKey);
      // Use gemini-2.5-flash for speed and reliability
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { responseMimeType: 'application/json' }
      });

      const response = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        systemInstruction: systemPrompt
      });

      const resultText = response.response.text();
      return JSON.parse(resultText);
    } else if (openaiKey) {
      console.log('[LLM] Generating narrative using OpenAI...');
      const openai = new OpenAI({ apiKey: openaiKey });
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      });

      const resultText = response.choices[0].message.content;
      return JSON.parse(resultText);
    }
  } catch (err) {
    console.error('[LLM] Narrative synthesis failed:', err.message);
    return null;
  }
}

module.exports = { generateLLMNarrative };
