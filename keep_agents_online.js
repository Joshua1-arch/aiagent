const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

const homeDir = os.homedir();
const onchainosDir = path.join(homeDir, '.onchainos');

console.log('=== AgentGate Railway Bootstrap ===');
console.log(`User Home: ${homeDir}`);
console.log(`Target Dir: ${onchainosDir}`);

if (!fs.existsSync(onchainosDir)) {
  fs.mkdirSync(onchainosDir, { recursive: true });
}

// Bootstrap session from env vars
const sessionContent = process.env.SESSION_JSON_CONTENT;
const walletsContent = process.env.WALLETS_JSON_CONTENT;

if (sessionContent && walletsContent) {
  const sessionPath = path.join(onchainosDir, 'session.json');
  const walletsPath = path.join(onchainosDir, 'wallets.json');
  const cachePath = path.join(onchainosDir, 'cache.json');

  fs.writeFileSync(sessionPath, Buffer.from(sessionContent, 'base64').toString('utf8'));
  fs.writeFileSync(walletsPath, Buffer.from(walletsContent, 'base64').toString('utf8'));
  fs.writeFileSync(cachePath, '{}');
  console.log('Session and wallets bootstrapped from env vars.');
} else {
  console.log('No session env vars found. Checking existing config...');
}

// Copy skills-lock.json for AI provider
const skillsLockPath = path.join(onchainosDir, 'skills-lock.json');
if (fs.existsSync('skills-lock.json') && !fs.existsSync(skillsLockPath)) {
  fs.copyFileSync('skills-lock.json', skillsLockPath);
  console.log('skills-lock.json copied for AI provider.');
}

// HTTP health check server (required by Railway for port binding)
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, agent: 'AgentGate #4885', status: 'running' }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('AgentGate daemon running.');
  }
});
server.listen(PORT, () => {
  console.log(`Health check server listening on port ${PORT}`);
});

// Start the okx-a2a daemon in foreground with auto-restart
function startDaemon() {
  const daemon = spawn('npx', ['@okxweb3/a2a-node', 'run'], {
    shell: true,
    stdio: 'inherit',
    env: {
      ...process.env,
      HOME: homeDir,
      USERPROFILE: homeDir,
    },
  });

  daemon.on('close', (code) => {
    console.log(`Daemon exited with code ${code}. Restarting in 5s...`);
    setTimeout(startDaemon, 5000);
  });

  daemon.on('error', (err) => {
    console.error('Daemon spawn error:', err);
    setTimeout(startDaemon, 10000);
  });
}

console.log('Starting A2A daemon...');
startDaemon();
