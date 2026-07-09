const { exec } = require('child_process');
const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const { getDB } = require('./db');
const { handleCommand } = require('./commandHandler');

// Path to the global session store sqlite database managed by the okx-a2a daemon
const DAEMON_DB_PATH = 'C:\\Users\\Joshua\\.okx-agent-task\\sqlite\\session-store.sqlite';

/**
 * Executes a CLI command and returns parsed JSON
 */
function runA2ACommand(cmd) {
  return new Promise((resolve) => {
    const execPath = path.resolve(process.env.USERPROFILE, '.local/bin/onchainos.exe');
    // Using onchainos-signer or direct okx-a2a daemon cli
    const fullCmd = `okx-a2a ${cmd}`;

    exec(fullCmd, (error, stdout, stderr) => {
      if (error) {
        console.error(`CLI Execution error (${fullCmd}):`, error.message);
        return resolve({ ok: false, error: error.message });
      }
      try {
        const response = JSON.parse(stdout.trim());
        resolve(response);
      } catch (parseErr) {
        resolve({ ok: true, raw: stdout.trim(), stderr: stderr.trim() });
      }
    });
  });
}

/**
 * Polls active A2A sessions and processes new messages
 */
async function checkNewMessages() {
  const agentId = process.env.AGENT_ID || '3272';
  let daemonDb;

  try {
    daemonDb = await open({
      filename: DAEMON_DB_PATH,
      driver: sqlite3.Database,
      mode: sqlite3.OPEN_READONLY // Read-only access to daemon SQLite DB
    });
  } catch (err) {
    console.error(`Could not open daemon database at ${DAEMON_DB_PATH}:`, err.message);
    return;
  }

  const localDb = await getDB();

  try {
    // Query active sessions where my_agent_id matches our AGENT_ID
    const sessions = await daemonDb.all(
      `SELECT * FROM session_metadata WHERE my_agent_id = ? OR my_agent_id = ?`,
      [agentId, `#${agentId}`]
    );

    for (const session of sessions) {
      const jobId = session.job_id;
      const toAgentId = session.to_agent_id;

      if (!jobId || !toAgentId) continue;

      // Query session history using okx-a2a CLI
      const historyResult = await runA2ACommand(`session history --job-id "${jobId}" --to-agent-id "${toAgentId}" --json`);

      if (!historyResult || !historyResult.ok || !Array.isArray(historyResult.data)) {
        continue;
      }

      const messages = historyResult.data;
      if (messages.length === 0) continue;

      // Find the latest message sent by the User Agent (role 1)
      const latestUserMessage = [...messages]
        .reverse()
        .find(msg => msg.sender && (msg.sender.role === 1 || msg.sender.role === '1'));

      if (!latestUserMessage) continue;

      const messageId = latestUserMessage.id || latestUserMessage.messageId;
      const content = latestUserMessage.content;

      if (!messageId || !content) continue;

      // Check if we have already processed this message ID
      const alreadyProcessed = await localDb.get(
        `SELECT 1 FROM processed_messages WHERE message_id = ?`,
        [messageId]
      );

      if (alreadyProcessed) continue;

      console.log(`Processing new A2A message [ID: ${messageId}] from User Agent: "${content}"`);

      // Handle the command text
      const replyContent = await handleCommand(content);

      console.log(`Sending response: "${replyContent.substring(0, 60)}..."`);

      // Send reply via A2A
      const sendResult = await runA2ACommand(
        `session send --job-id "${jobId}" --to-agent-id "${toAgentId}" --content "${replyContent.replace(/"/g, '\\"')}"`
      );

      if (sendResult && sendResult.ok) {
        // Mark message as processed
        await localDb.run(
          `INSERT OR IGNORE INTO processed_messages (message_id, processed_at) VALUES (?, ?)`,
          [messageId, Date.now()]
        );
        console.log(`Successfully sent reply and marked message ${messageId} as processed.`);
      } else {
        console.error(`Failed to send reply:`, sendResult?.error || 'Unknown error');
      }
    }
  } catch (err) {
    console.error('Error in checkNewMessages loop:', err.message);
  } finally {
    await daemonDb.close().catch(() => {});
  }
}

module.exports = {
  checkNewMessages
};
