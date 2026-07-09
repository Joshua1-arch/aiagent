const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

async function main() {
  const db = await open({
    filename: 'C:\\Users\\Joshua\\.okx-agent-task\\sqlite\\session-store.sqlite',
    driver: sqlite3.Database
  });

  const rows = await db.all("SELECT * FROM user_attention ORDER BY created_at DESC LIMIT 5");
  console.log("Recent User Attention entries:", JSON.stringify(rows, null, 2));
}

main().catch(console.error);
