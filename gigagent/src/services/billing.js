const { exec } = require('child_process');
const path = require('path');
const { getDB } = require('./db');
require('dotenv').config();

/**
 * Executes a CLI command and returns parsed JSON
 */
function runA2APaymentCommand(cmd) {
  return new Promise((resolve) => {
    const execPath = path.resolve(process.env.USERPROFILE, '.local/bin/onchainos.exe');
    const fullCmd = `& "${execPath}" ${cmd}`;

    exec(fullCmd, { shell: 'powershell.exe' }, (error, stdout, stderr) => {
      const trimmedStdout = stdout ? stdout.trim() : '';

      if (trimmedStdout) {
        try {
          const response = JSON.parse(trimmedStdout);
          return resolve(response);
        } catch (parseErr) {
          // stdout is not JSON, fall through
        }
      }

      if (error) {
        console.error(`CLI execution error (${fullCmd}):`, error.message);
        return resolve({ ok: false, error: error.message });
      }

      resolve({ ok: true, raw: trimmedStdout, stderr: stderr ? stderr.trim() : '' });
    });
  });
}

/**
 * Creates a payment link (invoice) on-chain
 */
async function createInvoice(clientName, amount, symbol, description = '') {
  const recipient = process.env.SENDER_ADDRESS;
  const descFlag = description ? ` --description "${description}"` : '';

  const cmd = `payment a2a-pay create --type charge --amount "${amount}" --symbol "${symbol.toUpperCase()}" --recipient "${recipient}"${descFlag}`;
  console.log(`Executing a2a-pay create: ${cmd}`);

  const result = await runA2APaymentCommand(cmd);

  if (!result || !result.payment_id) {
    throw new Error('Failed to create payment link on-chain');
  }

  const paymentId = result.payment_id;
  const deliveries = result.deliveries || [];
  const urlItem = deliveries.find(d => d.type === 'url');
  const url = urlItem ? urlItem.value : `paymentId=${paymentId}`;

  const db = await getDB();
  const now = Date.now();

  await db.run(
    `INSERT INTO invoices (payment_id, client_name, amount, symbol, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
    [paymentId, clientName, amount, symbol, now, now]
  );

  return {
    paymentId,
    clientName,
    amount,
    symbol,
    status: 'pending',
    url
  };
}

/**
 * Fetch all invoices
 */
async function getInvoices() {
  const db = await getDB();
  return await db.all(`SELECT * FROM invoices ORDER BY created_at DESC`);
}

/**
 * Polls active pending invoices and updates their status
 */
async function checkAndUpdateInvoices() {
  const db = await getDB();
  const activeInvoices = await db.all(
    `SELECT * FROM invoices WHERE status IN ('pending', 'settling')`
  );

  if (activeInvoices.length === 0) return [];

  const updated = [];

  for (const invoice of activeInvoices) {
    const cmd = `payment a2a-pay status --payment-id "${invoice.payment_id}"`;
    const result = await runA2APaymentCommand(cmd);

    if (result && result.status) {
      const status = result.status;
      const txHash = result.tx_hash || null;

      if (status !== invoice.status) {
        await db.run(
          `UPDATE invoices SET status = ?, tx_hash = ?, updated_at = ? WHERE id = ?`,
          [status, txHash, Date.now(), invoice.id]
        );

        updated.push({
          id: invoice.id,
          paymentId: invoice.payment_id,
          clientName: invoice.client_name,
          amount: invoice.amount,
          symbol: invoice.symbol,
          oldStatus: invoice.status,
          newStatus: status,
          txHash
        });
      }
    }
  }

  return updated;
}

module.exports = {
  createInvoice,
  getInvoices,
  checkAndUpdateInvoices
};
