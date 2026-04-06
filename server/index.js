// patched
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import authRoutes from './routes/auth.js';
import jobRoutes from './routes/jobs.js';
import cabinetRoutes from './routes/cabinets.js';
import exportRoutes from './routes/export.js';
import { query } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));

// ─── API Routes ──────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/cabinets', cabinetRoutes);
app.use('/api/export', exportRoutes);

// ─── Public data routes (no auth needed) ─────────────────────────────────────
app.get('/api/door-styles', async (req, res) => {
  const styles = await query('SELECT * FROM door_styles WHERE is_active = TRUE ORDER BY name');
  res.json(styles);
});

app.get('/api/materials', async (req, res) => {
  const mats = await query('SELECT * FROM materials WHERE is_active = TRUE ORDER BY name');
  res.json(mats);
});

app.get('/api/hardware', async (req, res) => {
  const hw = await query('SELECT * FROM hardware_catalog WHERE is_active = TRUE ORDER BY category, name');
  res.json(hw);
});

// ─── Serve React build in production ─────────────────────────────────────────
app.use(express.static(join(__dirname, '../client/dist')));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(join(__dirname, '../client/dist/index.html'));
  }
});

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  ◧ Cabinet Studio API`);
  console.log(`  → http://localhost:${PORT}`);
  console.log(`  → DB: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}\n`);
});
