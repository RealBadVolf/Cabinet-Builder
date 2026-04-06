import { Router } from 'express';
import { query, queryOne } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// ─── List jobs (filtered by role) ────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    let sql, params;
    if (['admin', 'manager'].includes(req.user.role)) {
      sql = `SELECT j.*, u.username AS owner_name,
                    (SELECT COUNT(*) FROM cabinets WHERE job_id = j.job_id) AS cabinet_count
             FROM jobs j LEFT JOIN users u ON u.user_id = j.user_id
             ORDER BY j.updated_at DESC`;
      params = [];
    } else {
      sql = `SELECT j.*,
                    (SELECT COUNT(*) FROM cabinets WHERE job_id = j.job_id) AS cabinet_count
             FROM jobs j WHERE j.user_id = ?
             ORDER BY j.updated_at DESC`;
      params = [req.user.userId];
    }
    const jobs = await query(sql, params);
    res.json(jobs);
  } catch (err) {
    console.error('List jobs error:', err);
    res.status(500).json({ error: 'Failed to list jobs' });
  }
});

// ─── Get single job ──────────────────────────────────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const job = await queryOne('SELECT * FROM jobs WHERE job_id = ?', [req.params.id]);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (req.user.role === 'user' && job.user_id !== req.user.userId)
      return res.status(403).json({ error: 'Access denied' });
    res.json(job);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

// ─── Create job ──────────────────────────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  try {
    const { jobCode, jobName, description, clientId } = req.body;
    if (!jobCode || !jobName)
      return res.status(400).json({ error: 'Job code and name required' });

    const result = await query(
      `INSERT INTO jobs (user_id, job_code, job_name, description, client_id, quote_date)
       VALUES (?, ?, ?, ?, ?, CURDATE())`,
      [req.user.userId, jobCode, jobName, description || null, clientId || null]
    );
    const job = await queryOne('SELECT * FROM jobs WHERE job_id = ?', [result.insertId]);
    res.status(201).json(job);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ error: 'Job code already exists for this user' });
    console.error('Create job error:', err);
    res.status(500).json({ error: 'Failed to create job' });
  }
});

// ─── Update job ──────────────────────────────────────────────────────────────
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const job = await queryOne('SELECT * FROM jobs WHERE job_id = ?', [req.params.id]);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (req.user.role === 'user' && job.user_id !== req.user.userId)
      return res.status(403).json({ error: 'Access denied' });

    const fields = ['job_name', 'description', 'status', 'due_date', 'notes',
                    'material_cost', 'hardware_cost', 'labour_cost', 'markup_pct',
                    'quoted_price', 'tax_rate'];
    const updates = [];
    const params = [];

    for (const f of fields) {
      const camel = f.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      if (req.body[camel] !== undefined) {
        updates.push(`${f} = ?`);
        params.push(req.body[camel]);
      }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    params.push(req.params.id);
    await query(`UPDATE jobs SET ${updates.join(', ')} WHERE job_id = ?`, params);

    const updated = await queryOne('SELECT * FROM jobs WHERE job_id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    console.error('Update job error:', err);
    res.status(500).json({ error: 'Failed to update job' });
  }
});

// ─── Delete job ──────────────────────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const job = await queryOne('SELECT * FROM jobs WHERE job_id = ?', [req.params.id]);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (req.user.role === 'user' && job.user_id !== req.user.userId)
      return res.status(403).json({ error: 'Access denied' });

    await query('DELETE FROM jobs WHERE job_id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete job' });
  }
});

export default router;
