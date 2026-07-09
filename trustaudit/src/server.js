require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const scanRouter = require('./routes/scan');
const { x402PaymentRequired } = require('./middleware/x402');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Rate limiting: 60 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { ok: false, error: 'Too many requests. Please wait a minute.' },
});
app.use(limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'TrustAudit', version: '1.0.0', timestamp: new Date().toISOString() });
});

// Main scan endpoint — gated behind OKX Agent Payments Protocol (x402)
app.use('/scan', x402PaymentRequired, scanRouter);

app.get('/', (req, res) => {
  const acceptHeader = req.headers.accept || '';
  if (acceptHeader.includes('text/html') || (req.accepts('html') && !acceptHeader.includes('application/json'))) {
    return res.sendFile(path.join(__dirname, '../public/dashboard.html'));
  }
  res.json({
    ok: true,
    service: 'TrustAudit — Smart Contract Risk Scanner',
    description: 'Submit a contract address and chain to receive an instant AI-powered risk report.',
    endpoints: {
      scan: 'POST /scan',
      health: 'GET /health',
    },
    usage: {
      method: 'POST',
      url: '/scan',
      body: {
        address: '0xContractAddress',
        chain: 'ethereum | bsc | polygon | arbitrum | base (default: ethereum)',
      },
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Endpoint not found. POST to /scan' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ ok: false, error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`TrustAudit running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
