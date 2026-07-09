const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');

/**
 * Generate a professional freelancer pitch using LLM or template fallback
 * @param {string} clientName - Client's name/company
 * @param {string} projectDescription - Details about the gig or work
 * @param {string} budget - Rate or budget (e.g. "50 USDT")
 * @returns {Promise<string>} - The generated pitch
 */
async function generatePitch(clientName, projectDescription, budget) {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!geminiKey && !openaiKey) {
    console.log('[LLM] No LLM keys found. Using template pitch generator.');
    return generateTemplatePitch(clientName, projectDescription, budget);
  }

  const prompt = `
Client/Company Name: ${clientName}
Project/Work Description: ${projectDescription}
Proposed Budget/Payment: ${budget}
`;

  const systemPrompt = `You are the AI assistant of GigAgent, a professional assistant for freelancers.
Your task is to draft a highly professional, engaging, and persuasive outreach email or proposal pitch for the client.

Guidelines:
1. Start with a warm but professional greeting to ${clientName}.
2. Briefly summarize how you can help with their project ("${projectDescription}").
3. Highlight value, efficiency, and professionalism.
4. Politely state the proposed pricing/budget of ${budget} and mention that payments are settled securely on-chain.
5. End with a professional call-to-action asking for a quick chat.
6. Keep the email concise (2-3 paragraphs, around 150 words). Do not include any HTML, subject lines, or placeholder text like [My Name]. Sign off as "Freelancer (via GigAgent)".`;

  try {
    if (geminiKey) {
      console.log('[LLM] Generating pitch using Gemini...');
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const response = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        systemInstruction: systemPrompt
      });

      return response.response.text().trim();
    } else if (openaiKey) {
      console.log('[LLM] Generating pitch using OpenAI...');
      const openai = new OpenAI({ apiKey: openaiKey });
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ]
      });

      return response.choices[0].message.content.trim();
    }
  } catch (err) {
    console.error('[LLM] Pitch generation failed:', err.message);
    return generateTemplatePitch(clientName, projectDescription, budget);
  }
}

/**
 * Fallback static template pitch generator
 */
function generateTemplatePitch(clientName, projectDescription, budget) {
  return `Hi ${clientName},\n\n` +
         `I hope this message finds you well.\n\n` +
         `I'm writing to express my interest in collaborating on your project: "${projectDescription}". ` +
         `With my experience in this field, I am confident I can deliver high-quality results efficiently.\n\n` +
         `My rate for this scope of work is ${budget}, settled securely on-chain. ` +
         `Please let me know if you would be open to a brief call to discuss the details and how we can get started.\n\n` +
         `Best regards,\n` +
         `Freelancer (via GigAgent)`;
}

module.exports = {
  generatePitch
};
