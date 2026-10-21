import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import routes from './server/routes.ts';
import { sipHealth, telephony } from './server/telephony.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProd = process.env.NODE_ENV === 'production';

  // 1. Cyber Security: Disable server stack fingerprinting
  app.disable('x-powered-by');

  // 2. Cyber Security: Enforce hardened HTTP security headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
    if (isProd) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  // Middlewares
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // 3. Cyber Security: Anti-Brute-Force & Anti-DDoS Rate Limiter
  const ipHits = new Map<string, { count: number; resetTime: number }>();
  app.use('/api', (req, res, next) => {
    // Whitelist health checks and SSE events from strict throttling
    if (req.path === '/health' || req.path === '/events') return next();

    const clientIp = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const isAuthRoute = req.path.startsWith('/auth/login');
    const limit = isAuthRoute ? 20 : 300; // 20 attempts/min for login (anti brute-force), 300/min for general API
    const windowMs = 60 * 1000;

    const key = `${clientIp}_${isAuthRoute ? 'auth' : 'api'}`;
    const entry = ipHits.get(key);

    if (!entry || now > entry.resetTime) {
      ipHits.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > limit) {
      console.warn(`[CYBER DEFENSE] IP ${clientIp} exceeded rate limit on ${req.originalUrl}`);
      return res.status(429).json({
        error: 'Too many requests. Cyber defense active. Please slow down and try again shortly.',
      });
    }

    next();
  });

  // Global Zadarma zd_echo verification handler:
  // Catches ?zd_echo=... on any URL (root /, /api, webhook paths) so Zadarma never disables the integration
  app.use((req, res, next) => {
    const echo = req.query.zd_echo || (req.body && req.body.zd_echo);
    if (echo) {
      console.log(`[ZADARMA GLOBAL ECHO] Answering zd_echo verification challenge: ${echo}`);
      return res.status(200).type('text/plain').send(String(echo));
    }
    next();
  });

  // Mount API router
  app.use('/api', routes);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'UP', platform: 'Pirates world Tele Solution', timestamp: new Date().toISOString() });
  });

  // Start Background Telephony Services
  sipHealth.start(30000); // Check SIP health every 30s
  telephony.start(); // Run queue worker every 1.5s

  if (!isProd) {
    // Development mode: Mount Vite dev server middlewares
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  } else {
    // Production mode: Serve built static files
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Pirates World Tele Solution] Server active on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
