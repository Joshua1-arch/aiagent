const { getDB } = require('./db');
const { sendTransaction } = require('./wallet');

/**
 * Calculates next execution timestamp based on frequency
 * @param {string} frequency - 'hourly', 'daily', 'weekly', 'monthly'
 * @param {number} fromTime - Starting timestamp
 * @returns {number} - Next execution timestamp
 */
function calculateNextPayment(frequency, fromTime = Date.now()) {
  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;

  switch (frequency.toLowerCase()) {
    case 'hourly':
      return fromTime + HOUR;
    case 'daily':
      return fromTime + DAY;
    case 'weekly':
      return fromTime + (7 * DAY);
    case 'monthly':
      return fromTime + (30 * DAY);
    default:
      return fromTime + DAY; // default daily
  }
}

/**
 * Create a new payroll schedule
 */
async function addSchedule(payeeAddress, amount, token, chain, frequency) {
  const db = await getDB();
  const now = Date.now();
  const nextPayment = calculateNextPayment(frequency, now);

  const result = await db.run(
    `INSERT INTO schedules (payee_address, amount, token, chain, frequency, next_payment_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [payeeAddress, amount, token, chain, frequency, nextPayment, now]
  );

  return {
    id: result.lastID,
    payeeAddress,
    amount,
    token,
    chain,
    frequency,
    nextPaymentAt: nextPayment
  };
}

/**
 * Get all active schedules
 */
async function getSchedules() {
  const db = await getDB();
  return await db.all(`SELECT * FROM schedules WHERE status = 'active'`);
}

/**
 * Get all payment records
 */
async function getPaymentHistory() {
  const db = await getDB();
  return await db.all(`SELECT * FROM payments ORDER BY paid_at DESC`);
}

/**
 * Deactivate a schedule
 */
async function cancelSchedule(id) {
  const db = await getDB();
  const result = await db.run(`UPDATE schedules SET status = 'cancelled' WHERE id = ?`, [id]);
  return result.changes > 0;
}

/**
 * Check schedules and execute due payroll transactions
 */
async function checkAndRunPayroll() {
  const db = await getDB();
  const now = Date.now();

  // Fetch all active schedules that are due
  const dueSchedules = await db.all(
    `SELECT * FROM schedules WHERE status = 'active' AND next_payment_at <= ?`,
    [now]
  );

  if (dueSchedules.length === 0) {
    return [];
  }

  console.log(`Found ${dueSchedules.length} due payroll schedules. Executing...`);
  const executed = [];

  for (const schedule of dueSchedules) {
    console.log(`Processing Payroll Schedule #${schedule.id} for ${schedule.payee_address} - ${schedule.amount} ${schedule.token} on ${schedule.chain}`);

    // Call the wallet to execute the transaction
    const txResult = await sendTransaction(
      schedule.payee_address,
      schedule.amount,
      schedule.token,
      schedule.chain
    );

    const paidAt = Date.now();
    let status = 'failed';
    let txHash = null;
    let errorMessage = null;

    if (txResult && txResult.ok) {
      status = 'success';
      txHash = txResult.data?.txHash || txResult.raw || 'SimulatedHash';
      console.log(`Payroll payment successful! TxHash: ${txHash}`);
    } else {
      errorMessage = txResult?.error || 'Unknown error occurred';
      console.error(`Payroll payment failed: ${errorMessage}`);
    }

    // Log payment record
    await db.run(
      `INSERT INTO payments (schedule_id, payee_address, amount, token, tx_hash, paid_at, status, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [schedule.id, schedule.payee_address, schedule.amount, schedule.token, txHash, paidAt, status, errorMessage]
    );

    // Update schedule's next execution time
    const nextPayment = calculateNextPayment(schedule.frequency, paidAt);
    await db.run(
      `UPDATE schedules SET last_paid_at = ?, next_payment_at = ? WHERE id = ?`,
      [paidAt, nextPayment, schedule.id]
    );

    executed.push({
      scheduleId: schedule.id,
      payee: schedule.payee_address,
      amount: schedule.amount,
      token: schedule.token,
      status,
      txHash,
      errorMessage
    });
  }

  return executed;
}

module.exports = {
  addSchedule,
  getSchedules,
  getPaymentHistory,
  cancelSchedule,
  checkAndRunPayroll
};
