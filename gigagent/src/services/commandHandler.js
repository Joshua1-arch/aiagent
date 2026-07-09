const billing = require('./billing');
const llm = require('./llm');
const { getDB } = require('./db');

/**
 * Processes incoming text commands for GigAgent
 * @param {string} text - User request text
 * @returns {Promise<string>} - Reply text
 */
async function handleCommand(text) {
  const normalized = text.toLowerCase().trim();

  // 1. List Invoices
  if (normalized.includes('list invoice') || normalized.includes('show invoice') || normalized === 'invoices') {
    const invoices = await billing.getInvoices();
    if (invoices.length === 0) {
      return "No invoices generated yet. Create one by replying: `invoice ClientName amount 50 USDT`";
    }

    let reply = "🧾 **Freelancer Invoices & Statuses**\n\n";
    invoices.forEach((inv) => {
      let statusIcon = '⏳';
      if (inv.status === 'completed') statusIcon = '✅';
      if (inv.status === 'failed') statusIcon = '❌';
      if (inv.status === 'expired') statusIcon = '⌛';
      if (inv.status === 'cancelled') statusIcon = '🚫';

      reply += `${statusIcon} **Invoice [${inv.payment_id}]**\n`;
      reply += `   Client: **${inv.client_name}**\n`;
      reply += `   Amount: **${inv.amount} ${inv.symbol}**\n`;
      reply += `   Status: **${inv.status}**\n`;
      if (inv.tx_hash) {
        reply += `   TxHash: \`${inv.tx_hash}\`\n`;
      }
      reply += `   ---\n`;
    });
    return reply;
  }

  // 2. Check Invoice Status
  const statusMatch = normalized.match(/(?:status|check)\s+(a2a_[a-zA-Z0-9_]+)/);
  if (statusMatch) {
    const paymentId = statusMatch[1];
    const db = await getDB();
    const invoice = await db.get(`SELECT * FROM invoices WHERE payment_id = ?`, [paymentId]);

    // Force pull status from CLI to be fresh
    const { exec } = require('child_process');
    const path = require('path');
    
    return new Promise((resolve) => {
      const execPath = path.resolve(process.env.USERPROFILE, '.local/bin/onchainos.exe');
      const cmd = `& "${execPath}" payment a2a-pay status --payment-id "${paymentId}"`;

      exec(cmd, { shell: 'powershell.exe' }, async (error, stdout) => {
        try {
          const response = JSON.parse(stdout.trim());
          if (response && response.ok && response.data) {
            const status = response.data.status;
            const txHash = response.data.tx_hash || null;
            
            // Update DB if found
            if (invoice) {
              await db.run(
                `UPDATE invoices SET status = ?, tx_hash = ?, updated_at = ? WHERE id = ?`,
                [status, txHash, Date.now(), invoice.id]
              );
            }

            let statusMsg = `⏳ Awaiting buyer signature.`;
            if (status === 'settling') statusMsg = `🔄 Settling on-chain (credential submitted, awaiting confirmation).`;
            if (status === 'completed') statusMsg = `✅ Confirmed on-chain!\nTxHash: \`${txHash}\``;
            if (status === 'failed') statusMsg = `❌ Failed.`;
            if (status === 'expired') statusMsg = `⌛ Expired before settlement.`;
            if (status === 'cancelled') statusMsg = `🚫 Cancelled by seller.`;

            return resolve(`📊 **Invoice Status for [${paymentId}]**\n\nStatus: **${status.toUpperCase()}**\n${statusMsg}`);
          }
        } catch (e) {}

        if (invoice) {
          return resolve(`📊 **Invoice Status (Local Cache)**\n\nPayment ID: \`${paymentId}\`\nClient: **${invoice.client_name}**\nAmount: **${invoice.amount} ${invoice.symbol}**\nStatus: **${invoice.status.toUpperCase()}**`);
        }
        resolve(`❌ Invoice with Payment ID **${paymentId}** not found.`);
      });
    });
  }

  // 3. Generate Invoice / Payment Link
  // Format: "invoice ClientName amount 50 USDT" or "bill ClientName 50 USDT"
  const invoiceMatch = normalized.match(/(?:invoice|bill)\s+([a-zA-Z0-9_]+)\s+(?:amount\s+)?([\d.]+)\s+(\w+)(?:\s+desc\s+(.+))?/);
  if (invoiceMatch) {
    const clientName = invoiceMatch[1];
    const amount = invoiceMatch[2];
    const symbol = invoiceMatch[3].toUpperCase();
    const description = invoiceMatch[4] || `Invoice for ${clientName}`;

    try {
      const invoice = await billing.createInvoice(clientName, amount, symbol, description);
      return `✅ **Invoice & Payment Link Created!**\n\n` +
             `🆔 **Payment ID**: \`${invoice.paymentId}\`\n` +
             `👤 **Client**: ${invoice.clientName}\n` +
             `💰 **Amount**: ${invoice.amount} ${invoice.symbol}\n` +
             `📝 **Description**: ${description}\n\n` +
             `🔗 **Payment link / Share details**:\n` +
             `\`${invoice.url}\`\n\n` +
             `Send this link/ID to your client. I will monitor the payment confirmation on-chain!`;
    } catch (err) {
      return `❌ Failed to create invoice: ${err.message}`;
    }
  }

  // 4. Generate Freelance Pitch
  // Format: "pitch for ClientName doing website development budget 100 USDT"
  const pitchMatch = normalized.match(/pitch\s+for\s+([a-zA-Z0-9_\s]+)\s+doing\s+(.+?)\s+budget\s+([\d.]+\s+\w+)/);
  if (pitchMatch) {
    const clientName = pitchMatch[1].trim();
    const projectDescription = pitchMatch[2].trim();
    const budget = pitchMatch[3].trim().toUpperCase();

    try {
      const pitchContent = await llm.generatePitch(clientName, projectDescription, budget);
      
      // Save pitch to DB
      const db = await getDB();
      await db.run(
        `INSERT INTO pitches (client_name, project_description, pitch_content, created_at) VALUES (?, ?, ?, ?)`,
        [clientName, projectDescription, pitchContent, Date.now()]
      );

      return `✍️ **AI Freelancer Pitch Generated!**\n\n` +
             `Here is a custom draft for **${clientName}**:\n` +
             `====================================\n` +
             `${pitchContent}\n` +
             `====================================\n\n` +
             `You can copy this outreach proposal and send it to the client!`;
    } catch (err) {
      return `❌ Failed to generate pitch: ${err.message}`;
    }
  }

  // Help Fallback
  return "👋 **GigAgent: AI Freelance Billing & Outreach Assistant**\n\n" +
         "How I can help you:\n" +
         "• **Generate Pitch**: `pitch for ClientName doing website building budget 100 USDT`\n" +
         "• **Create Invoice**: `invoice ClientName amount 50 USDT desc consultation fee`\n" +
         "• **Check Status**: `status a2a_payment_id`\n" +
         "• **List Invoices**: `list invoices`";
}

module.exports = {
  handleCommand
};
