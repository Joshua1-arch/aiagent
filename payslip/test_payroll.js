const { getDB } = require('./src/services/db');
const payroll = require('./src/services/payroll');

async function test() {
  console.log('--- Starting PaySlip offline test ---');
  
  // Initialize Database
  await getDB();
  
  // 1. Add a test schedule
  const testPayee = '0xf1779f61c8f4e0ddbd942f29963aeec01840b111'; // Owner address
  console.log(`Adding test schedule to payee: ${testPayee}...`);
  const schedule = await payroll.addSchedule(
    testPayee,
    '0.005',
    'ETH',
    'xlayer',
    'hourly'
  );
  console.log('Created Schedule:', schedule);
  
  // 2. Fetch active schedules
  const schedules = await payroll.getSchedules();
  console.log('Active schedules in DB:', schedules);
  
  // 3. Force the schedule to be due by changing next_payment_at in SQLite
  console.log('Simulating time passage by setting next_payment_at to past...');
  const db = await getDB();
  await db.run('UPDATE schedules SET next_payment_at = ? WHERE id = ?', [Date.now() - 1000, schedule.id]);
  
  // 4. Run payroll check
  console.log('Running payroll checks...');
  const results = await payroll.checkAndRunPayroll();
  console.log('Payroll execution results:', results);
  
  // 5. Check payment history
  const history = await payroll.getPaymentHistory();
  console.log('Updated Payment History:', history);
  
  // 6. Clean up schedule
  console.log('Cancelling test schedule...');
  await payroll.cancelSchedule(schedule.id);
  console.log('Test completed successfully.');
  process.exit(0);
}

test().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
