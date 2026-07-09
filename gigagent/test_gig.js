const { getDB } = require('./src/services/db');
const billing = require('./src/services/billing');
const llm = require('./src/services/llm');
const commandHandler = require('./src/services/commandHandler');

async function test() {
  console.log('--- Starting GigAgent offline test ---');

  // Initialize DB
  await getDB();

  // 1. Test template pitch generation
  console.log('\nTesting Pitch Generation (fallback template)...');
  const pitch = await llm.generatePitch(
    'Acme Corp',
    'Custom web app development using Next.js and TailwindCSS',
    '500 USDT'
  );
  console.log('Generated Pitch:\n', pitch);

  // 2. Test command parser for pitch
  console.log('\nTesting commandHandler with pitch query...');
  const pitchResponse = await commandHandler.handleCommand(
    'pitch for Acme Corp doing custom web app development budget 500 USDT'
  );
  console.log('commandHandler Pitch response:\n', pitchResponse);

  // 3. Test command parser for invoice
  console.log('\nTesting commandHandler with invoice creation...');
  const invoiceResponse = await commandHandler.handleCommand(
    'invoice AcmeCorp amount 50 USDT desc consultation fee'
  );
  console.log('commandHandler Invoice response:\n', invoiceResponse);

  // 4. Test invoice listing
  console.log('\nTesting commandHandler with invoices list query...');
  const listResponse = await commandHandler.handleCommand('list invoices');
  console.log('commandHandler Invoices list:\n', listResponse);

  console.log('\nTest completed successfully.');
  process.exit(0);
}

test().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
