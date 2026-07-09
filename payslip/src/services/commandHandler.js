const payroll = require('./payroll');

/**
 * Parses and processes incoming text commands
 * @param {string} text - User request text
 * @returns {Promise<string>} - Reply text
 */
async function handleCommand(text) {
  const normalized = text.toLowerCase().trim();

  // 1. Show history/payments
  if (normalized.includes('history') || normalized.includes('payments') || normalized.includes('receipts')) {
    const history = await payroll.getPaymentHistory();
    if (history.length === 0) {
      return "No payroll payments have been executed yet.";
    }

    let reply = "📊 **Payroll Payment History & Receipts**\n\n";
    history.forEach((tx) => {
      const date = new Date(tx.paid_at).toLocaleString();
      const statusSymbol = tx.status === 'success' ? '✅' : '❌';
      reply += `${statusSymbol} **[${date}]** to \`${tx.payee_address.substring(0, 6)}...${tx.payee_address.substring(tx.payee_address.length - 4)}\`\n`;
      reply += `   Amount: **${tx.amount} ${tx.token}**\n`;
      if (tx.status === 'success') {
        reply += `   TxHash: \`${tx.tx_hash}\`\n`;
      } else {
        reply += `   Error: *${tx.error_message}*\n`;
      }
      reply += `   ---\n`;
    });
    return reply;
  }

  // 2. List schedules
  if (normalized.includes('list') || normalized.includes('schedules') || normalized.includes('show schedule')) {
    const schedules = await payroll.getSchedules();
    if (schedules.length === 0) {
      return "No active payroll schedules configured. You can set one up by telling me: `pay 10 USDT weekly to 0x... on base`";
    }

    let reply = "📋 **Active Payroll Schedules**\n\n";
    schedules.forEach((s) => {
      const nextDate = new Date(s.next_payment_at).toLocaleString();
      reply += `🆔 **Schedule #${s.id}**\n`;
      reply += `   Recipient: \`${s.payee_address}\`\n`;
      reply += `   Amount: **${s.amount} ${s.token}** on **${s.chain}**\n`;
      reply += `   Frequency: **${s.frequency}**\n`;
      reply += `   Next Payment: **${nextDate}**\n`;
      reply += `   ---\n`;
    });
    reply += "\nTo cancel a schedule, reply: `cancel schedule <id>`";
    return reply;
  }

  // 3. Cancel schedule
  const cancelMatch = normalized.match(/(?:cancel|delete)(?:\s+schedule)?\s+(\d+)/);
  if (cancelMatch) {
    const id = parseInt(cancelMatch[1]);
    const success = await payroll.cancelSchedule(id);
    if (success) {
      return `✅ Payroll schedule **#${id}** has been successfully cancelled.`;
    } else {
      return `❌ Could not find an active payroll schedule with ID **#${id}**.`;
    }
  }

  // 4. Create schedule
  // Format matches: "pay 10 USDT weekly to 0x..." or "schedule 1.5 ETH daily to 0x..."
  const scheduleMatch = normalized.match(/(?:pay|schedule)\s+([\d.]+)\s+(\w+)\s+(hourly|daily|weekly|monthly)\s+to\s+([0-9a-fA-FxX]+|[1-9A-HJ-NP-Za-km-z]{32,44})(?:\s+on\s+(\w+))?/);

  if (scheduleMatch) {
    const amount = scheduleMatch[1];
    const token = scheduleMatch[2].toUpperCase();
    const frequency = scheduleMatch[3];
    const payee = scheduleMatch[4];
    const chain = (scheduleMatch[5] || 'xlayer').toLowerCase();

    // Basic recipient address check
    const isEVM = /^0x[a-fA-F0-9]{40}$/.test(payee);
    const isSolana = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(payee);

    if (!isEVM && !isSolana) {
      return "❌ Invalid recipient address format. Please check the address and try again.";
    }

    try {
      const schedule = await payroll.addSchedule(payee, amount, token, chain, frequency);
      const nextDate = new Date(schedule.nextPaymentAt).toLocaleString();

      return `✅ **Payroll Scheduled Successfully!**\n\n` +
             `🆔 **Schedule ID**: #${schedule.id}\n` +
             `👤 **Payee**: \`${payee}\`\n` +
             `💰 **Amount**: ${amount} ${token} (${chain})\n` +
             `⏱️ **Frequency**: ${frequency}\n` +
             `📅 **First Release**: ${nextDate}\n\n` +
             `I will automatically execute this payment and send you a transaction receipt when it's released!`;
    } catch (err) {
      return `❌ Failed to create payroll schedule: ${err.message}`;
    }
  }

  // Help fallback
  return "👋 **PaySlip: On-Chain Payroll Agent**\n\n" +
         "Here are the instructions I understand:\n" +
         "• **Schedule Payroll**: `pay 10 USDC weekly to 0xf177... on base`\n" +
         "• **List Schedules**: `list schedules`\n" +
         "• **Cancel Schedule**: `cancel schedule <id>`\n" +
         "• **Payment Receipts**: `show history`";
}

module.exports = {
  handleCommand
};
