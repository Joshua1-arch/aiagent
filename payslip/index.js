const { getDB } = require('./src/services/db');
const { checkAndRunPayroll } = require('./src/services/payroll');
const { checkNewMessages } = require('./src/services/a2aListener');
require('dotenv').config();

const CHECK_INTERVAL_MS = parseInt(process.env.CHECK_INTERVAL_MS || '60000', 10);
const PORT = process.env.PORT || 3001;

async function start() {
  console.log('====================================');
  console.log('🚀 Starting PaySlip A2A Payroll Agent');
  console.log('====================================');

  // Initialize DB
  console.log('Initializing SQLite database...');
  await getDB();
  console.log('Database initialized successfully.');

  // Interval for checking due payroll schedules
  console.log(`Setting up payroll execution loop (every ${CHECK_INTERVAL_MS}ms)...`);
  setInterval(async () => {
    try {
      const executed = await checkAndRunPayroll();
      if (executed.length > 0) {
        console.log(`Executed ${executed.length} payroll schedules in this tick.`);
      }
    } catch (err) {
      console.error('Error in payroll execution loop:', err.message);
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
  checkAndRunPayroll().catch(err => console.error('Initial payroll run check failed:', err.message));
  checkNewMessages().catch(err => console.error('Initial message check failed:', err.message));

  console.log('PaySlip agent is active and running in background.');
  console.log('Waiting for payroll schedules and incoming messages...');
}

start().catch(err => {
  console.error('Fatal error during startup:', err);
  process.exit(1);
});
