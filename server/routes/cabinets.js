import { Router } from 'express';
import { query, queryOne } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { computeCabinet } from '../compute.js';

const router = Router();

// Helper: check job access
async function checkJobAccess(jobId, user) {
  const job = await queryOne('SELECT * FROM jobs WHERE job_id = ?', [jobId]);
  if (!job) return { error: 'Job not found', status: 404 };
  if (user.role === 'user' && job.user_id !== user.userId)
    return { error: 'Access denied', status: 403 };
  return { job };
}

// ─── List cabinets for a job ─────────────────────────────────────────────────
router.get('/job/:jobId', requireAuth, async (req, res) => {
  try {
    const access = await checkJobAccess(req.params.jobId, req.user);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const cabinets = await query(
      `SELECT c.*, ds.name AS door_style_name,
              (SELECT COUNT(*) FROM cabinet_parts WHERE cabinet_id = c.cabinet_id) AS part_count
       FROM cabinets c
       LEFT JOIN door_styles ds ON ds.door_style_id = c.door_style_id
       WHERE c.job_id = ? ORDER BY c.cabinet_code`,
      [req.params.jobId]
    );
    // Parse JSON config
    cabinets.forEach(c => { try { c.config = JSON.parse(c.config); } catch {} });
    res.json(cabinets);
  } catch (err) {
    console.error('List cabinets error:', err);
    res.status(500).json({ error: 'Failed to list cabinets' });
  }
});

// ─── Get single cabinet with parts and operations ────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const cab = await queryOne('SELECT * FROM cabinets WHERE cabinet_id = ?', [req.params.id]);
    if (!cab) return res.status(404).json({ error: 'Cabinet not found' });

    const access = await checkJobAccess(cab.job_id, req.user);
    if (access.error) return res.status(access.status).json({ error: access.error });

    try { cab.config = JSON.parse(cab.config); } catch {}

    const parts = await query(
      'SELECT * FROM cabinet_parts WHERE cabinet_id = ? ORDER BY part_type, part_code',
      [req.params.id]
    );
    const dados = await query(
      `SELECT d.* FROM dado_operations d
       JOIN cabinet_parts p ON p.part_id = d.part_id
       WHERE p.cabinet_id = ? ORDER BY d.dado_op_id`,
      [req.params.id]
    );
    const drills = await query(
      `SELECT d.* FROM drill_operations d
       JOIN cabinet_parts p ON p.part_id = d.part_id
       WHERE p.cabinet_id = ? ORDER BY d.drill_op_id`,
      [req.params.id]
    );

    res.json({ ...cab, parts, dados, drills });
  } catch (err) {
    console.error('Get cabinet error:', err);
    res.status(500).json({ error: 'Failed to fetch cabinet' });
  }
});

// ─── Create cabinet ──────────────────────────────────────────────────────────
router.post('/job/:jobId', requireAuth, async (req, res) => {
  try {
    const access = await checkJobAccess(req.params.jobId, req.user);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const { cabinetCode, name, cabinetType, config } = req.body;
    if (!cabinetCode || !config)
      return res.status(400).json({ error: 'Cabinet code and config required' });

    const cfg = typeof config === 'string' ? JSON.parse(config) : config;

    // Look up door style
    let doorStyleId = null;
    if (cfg.doorStyle) {
      const ds = await queryOne('SELECT door_style_id FROM door_styles WHERE style_code = ?', [cfg.doorStyle]);
      if (ds) doorStyleId = ds.door_style_id;
    }

    const result = await query(
      `INSERT INTO cabinets (job_id, cabinet_code, name, cabinet_type, construction,
         height, width, depth, config, door_style_id)
       VALUES (?, ?, ?, ?, 'frameless', ?, ?, ?, ?, ?)`,
      [req.params.jobId, cabinetCode, name || `${cabinetType || 'base'} ${cabinetCode}`,
       cabinetType || 'base', cfg.height, cfg.width, cfg.depth,
       JSON.stringify(cfg), doorStyleId]
    );

    const cabinetId = Number(result.insertId);

    // Auto-generate parts and operations
    await generateParts(cabinetId, cfg);

    // Return full cabinet with parts
    const cab = await queryOne('SELECT * FROM cabinets WHERE cabinet_id = ?', [cabinetId]);
    try { cab.config = JSON.parse(cab.config); } catch {}
    const parts = await query('SELECT * FROM cabinet_parts WHERE cabinet_id = ?', [cabinetId]);

    res.status(201).json({ ...cab, parts });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ error: 'Cabinet code already exists in this job' });
    console.error('Create cabinet error:', err);
    res.status(500).json({ error: 'Failed to create cabinet' });
  }
});

// ─── Update cabinet config (regenerates parts) ──────────────────────────────
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const cab = await queryOne('SELECT * FROM cabinets WHERE cabinet_id = ?', [req.params.id]);
    if (!cab) return res.status(404).json({ error: 'Cabinet not found' });
    const access = await checkJobAccess(cab.job_id, req.user);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const { name, cabinetType, config, status, notes } = req.body;
    const cfg = config ? (typeof config === 'string' ? JSON.parse(config) : config) : null;

    let doorStyleId = cab.door_style_id;
    if (cfg?.doorStyle) {
      const ds = await queryOne('SELECT door_style_id FROM door_styles WHERE style_code = ?', [cfg.doorStyle]);
      if (ds) doorStyleId = ds.door_style_id;
    }

    const updates = [];
    const params = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (cabinetType) { updates.push('cabinet_type = ?'); params.push(cabinetType); }
    if (status) { updates.push('status = ?'); params.push(status); }
    if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }
    if (cfg) {
      updates.push('config = ?, height = ?, width = ?, depth = ?, door_style_id = ?');
      params.push(JSON.stringify(cfg), cfg.height, cfg.width, cfg.depth, doorStyleId);
    }

    if (updates.length > 0) {
      params.push(req.params.id);
      await query(`UPDATE cabinets SET ${updates.join(', ')} WHERE cabinet_id = ?`, params);
    }

    // Regenerate parts if config changed
    if (cfg) {
      await query('DELETE FROM cabinet_parts WHERE cabinet_id = ?', [req.params.id]);
      await generateParts(Number(req.params.id), cfg);
    }

    const updated = await queryOne('SELECT * FROM cabinets WHERE cabinet_id = ?', [req.params.id]);
    try { updated.config = JSON.parse(updated.config); } catch {}
    const parts = await query('SELECT * FROM cabinet_parts WHERE cabinet_id = ?', [req.params.id]);
    res.json({ ...updated, parts });
  } catch (err) {
    console.error('Update cabinet error:', err.message, err.sql || '');
    res.status(500).json({ error: 'Failed to update cabinet: ' + err.message });
  }
});

// ─── Delete cabinet ──────────────────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const cab = await queryOne('SELECT * FROM cabinets WHERE cabinet_id = ?', [req.params.id]);
    if (!cab) return res.status(404).json({ error: 'Cabinet not found' });
    const access = await checkJobAccess(cab.job_id, req.user);
    if (access.error) return res.status(access.status).json({ error: access.error });

    await query('DELETE FROM cabinets WHERE cabinet_id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete cabinet' });
  }
});

// ─── Duplicate cabinet ───────────────────────────────────────────────────────
router.post('/:id/duplicate', requireAuth, async (req, res) => {
  try {
    const cab = await queryOne('SELECT * FROM cabinets WHERE cabinet_id = ?', [req.params.id]);
    if (!cab) return res.status(404).json({ error: 'Cabinet not found' });
    const access = await checkJobAccess(cab.job_id, req.user);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const newCode = req.body.cabinetCode || `${cab.cabinet_code}-copy`;
    const result = await query(
      `INSERT INTO cabinets (job_id, cabinet_code, name, cabinet_type, construction,
         height, width, depth, config, door_style_id, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [cab.job_id, newCode, `${cab.name} (copy)`, cab.cabinet_type, cab.construction,
       cab.height, cab.width, cab.depth, cab.config, cab.door_style_id, cab.notes]
    );

    const cfg = JSON.parse(cab.config);
    await generateParts(Number(result.insertId), cfg);

    const newCab = await queryOne('SELECT * FROM cabinets WHERE cabinet_id = ?', [result.insertId]);
    try { newCab.config = JSON.parse(newCab.config); } catch {}
    res.status(201).json(newCab);
  } catch (err) {
    console.error('Duplicate error:', err);
    res.status(500).json({ error: 'Failed to duplicate cabinet' });
  }
});


// ═════════════════════════════════════════════════════════════════════════════
// ─── Regenerate parts (force recompute from config) ──────────────────────────
router.post('/:id/regenerate', requireAuth, async (req, res) => {
  try {
    const cab = await queryOne('SELECT * FROM cabinets WHERE cabinet_id = ?', [req.params.id]);
    if (!cab) return res.status(404).json({ error: 'Cabinet not found' });
    const access = await checkJobAccess(cab.job_id, req.user);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const cfg = typeof cab.config === 'string' ? JSON.parse(cab.config) : cab.config;
    await query('DELETE FROM cabinet_parts WHERE cabinet_id = ?', [req.params.id]);
    await generateParts(Number(req.params.id), cfg);

    const parts = await query('SELECT * FROM cabinet_parts WHERE cabinet_id = ?', [req.params.id]);
    const dadoCount = await queryOne(
      'SELECT COUNT(*) AS c FROM dado_operations d JOIN cabinet_parts p ON p.part_id=d.part_id WHERE p.cabinet_id=?',
      [req.params.id]);
    const drillCount = await queryOne(
      'SELECT COUNT(*) AS c FROM drill_operations d JOIN cabinet_parts p ON p.part_id=d.part_id WHERE p.cabinet_id=?',
      [req.params.id]);

    res.json({ success:true, parts:parts.length,
      dados:Number(dadoCount?.c||0), drills:Number(drillCount?.c||0),
      message:'Regenerated: '+parts.length+' parts, '+dadoCount?.c+' dado ops, '+drillCount?.c+' drill ops' });
  } catch (err) {
    console.error('Regenerate error:', err);
    res.status(500).json({ error: 'Regeneration failed: ' + err.message });
  }
});


// Part generation from config → saves to DB (for cut list view, not for DXF)
async function generateParts(cabinetId, cfg) {
  const { parts, dados, drills } = computeCabinet(cfg);

  // Insert parts
  const partIds = {};
  for (const p of parts) {
    const result = await query(
      `INSERT INTO cabinet_parts (cabinet_id, part_code, name, part_type,
         finished_length, finished_width, thickness, quantity, grain_direction, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [cabinetId, p.code, p.name, p.partType,
       p.len, p.w, p.t, p.qty || 1, p.grain || 'length', p.notes || null]
    );
    partIds[p.code] = Number(result.insertId);
  }

  // Insert dado operations
  for (const d of dados) {
    const partId = partIds[d.partCode];
    if (!partId) continue;
    await query(
      `INSERT INTO dado_operations (part_id, operation_type, cut_width, cut_depth,
         cut_length, from_reference_edge, distance_from_edge, orientation, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [partId, d.opType, d.cutW, d.cutD, d.cutLen || null,
       d.fromEdge || 'bottom', d.dist || 0, d.fromEdge === 'rear' ? 'along_length' : 'across_width',
       d.note || null]
    );
  }

  // Insert drill operations
  for (const d of drills) {
    const partId = partIds[d.partCode];
    if (!partId) continue;
    await query(
      `INSERT INTO drill_operations (part_id, operation_type, hole_diameter, hole_depth,
         drill_face, line_orientation, line_start_x, line_start_y,
         hole_spacing, hole_count, repeat_count, repeat_offset, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [partId, d.opType, d.dia, d.dep, d.face || 'face',
       d.lineOrient || 'vertical', d.startX || d.heightStart || null,
       d.startY || (d.depthPositions ? d.depthPositions[0] : null) || null,
       d.spacing || null, d.count || null,
       d.repeatCount || (d.depthPositions ? d.depthPositions.length : 1),
       d.repeatOffset || null, d.note || null]
    );
  }

  await query(
    "UPDATE cabinets SET status = 'calculated' WHERE cabinet_id = ?",
    [cabinetId]
  );
}

export default router;
