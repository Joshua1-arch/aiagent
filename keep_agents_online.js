// keep_agents_online.js
// Cloud-ready agent heartbeat script for Render/Railway deployments.
// Automatically bootstraps the session, runs the A2A daemon, and starts an HTTP server for Render's Free Web Service tier.

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

// Step 1: Bootstrap the OnchainOS session in the container
const homeDir = os.homedir();
const onchainosDir = path.join(homeDir, '.onchainos');

console.log('=== OnchainOS Cloud Bootstrap ===');
console.log(`User Home: ${homeDir}`);
console.log(`Target Dir: ${onchainosDir}`);

if (process.env.SESSION_JSON_CONTENT && process.env.WALLETS_JSON_CONTENT) {
    if (!fs.existsSync(onchainosDir)) {
        fs.mkdirSync(onchainosDir, { recursive: true });
    }
    fs.writeFileSync(path.join(onchainosDir, 'session.json'), process.env.SESSION_JSON_CONTENT, 'utf8');
    fs.writeFileSync(path.join(onchainosDir, 'wallets.json'), process.env.WALLETS_JSON_CONTENT, 'utf8');
    console.log('✅ Session and Wallets configuration bootstrapped from environment variables.');
} else {
    console.log('⚠️ Environment variables SESSION_JSON_CONTENT or WALLETS_JSON_CONTENT not found.');
    console.log('Running with existing local config (if any).');
}

// Step 2: Start a simple HTTP server to satisfy Render Web Service port check
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OKX Agent Daemon is running.');
});
server.listen(PORT, () => {
    console.log(`\n✅ Web server listening on port ${PORT} (Render Free Tier check bypassed).`);
});

// Step 3: Start the A2A Daemon in the foreground (Self-Healing Process)
console.log('\n=== Starting A2A Daemon in Foreground ===');

function startDaemon() {
    console.log(`[${new Date().toISOString()}] Launching daemon process: npx @okxweb3/a2a-node run`);
    
    // Spawn the daemon process
    const daemon = spawn('npx', ['@okxweb3/a2a-node', 'run'], {
        shell: true,
        stdio: 'inherit' // Pipes output directly to Render's console logs
    });

    daemon.on('close', (code) => {
        console.log(`[${new Date().toISOString()}] Daemon exited with code ${code}. Restarting in 5 seconds...`);
        setTimeout(startDaemon, 5000);
    });

    daemon.on('error', (err) => {
        console.error('❌ Failed to start daemon process:', err);
    });
}

startDaemon();
