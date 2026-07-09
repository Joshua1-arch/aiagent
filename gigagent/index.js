const { getDB } = require('./src/services/db');
const { checkAndUpdateInvoices } = require('./src/services/billing');
const { checkNewMessages } = require('./src/services/a2aListener');
require('dotenv').config();

const CHECK_INTERVAL_MS = parseInt(process.env.CHECK_INTERVAL_MS || '60000', 10);
const PORT = process.env.PORT || 3002;

async function start() {
  console.log('====================================');
  console.log('🚀 Starting GigAgent A2A Freelance Billing Agent');
  console.log('====================================');

  // Initialize DB
  console.log('Initializing SQLite database...');
  await getDB();
  console.log('Database initialized successfully.');

  // Interval for checking and updating invoice payment status
  console.log(`Setting up invoice status tracker (every ${CHECK_INTERVAL_MS}ms)...`);
  setInterval(async () => {
    try {
      const updated = await checkAndUpdateInvoices();
      if (updated.length > 0) {
        console.log(`Updated status for ${updated.length} invoices:`, updated);
      }
    } catch (err) {
      console.error('Error in invoice tracking loop:', err.message);
    }
  }, CHECK_INTERVAL_MS);

  // Interval for checking new A2A messages
  console.log(`Setting up A2A message polling loop (every 5000ms)...`);
  setInterval(async () => {
    try {
      await checkNewMessages();
    } catch (err) {
      console.error('Error in message polling loop:', err.message);
    }
  }, 5000);

  // Immediate initial check on startup
  console.log('Running initial startup checks...');
  checkAndUpdateInvoices().catch(err => console.error('Initial invoice check failed:', err.message));
  checkNewMessages().catch(err => console.error('Initial message check failed:', err.message));

  console.log('GigAgent is active and running in background.');
  console.log('Waiting for freelancing commands and invoice actions...');
}

start().catch(err => {
  console.error('Fatal error during startup:', err);
  process.exit(1);
});
