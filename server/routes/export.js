import { Router } from 'express';
import { query, queryOne } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { computeCabinet } from '../compute.js';

const router = Router();

// ─── Export cut list as text ─────────────────────────────────────────────────
router.get('/cabinet/:id/cutlist', requireAuth, async (req, res) => {
  try {
    const cab = await queryOne('SELECT * FROM cabinets WHERE cabinet_id = ?', [req.params.id]);
    if (!cab) return res.status(404).json({ error: 'Cabinet not found' });
    const cfg = typeof cab.config === 'string' ? JSON.parse(cab.config) : cab.config;
    const { parts, dados, drills } = computeCabinet(cfg);

    let txt = 'CABINET CUT LIST — ' + (cab.name || cab.cabinet_code) + '\n';
    txt += '='.repeat(55) + '\n';
    txt += cab.width + 'W x ' + cab.height + 'H x ' + cab.depth + 'D mm\n\n';
    txt += 'PARTS\n' + '-'.repeat(45) + '\n';
    for (const p of parts) {
      txt += p.name + ' x' + p.qty + '  ' + p.len + ' x ' + p.w + ' x ' + p.t + 'mm';
      if (p.notes) txt += '  — ' + p.notes;
      txt += '\n';
    }
    txt += '\nDADO/RABBET OPS (' + dados.length + ')\n' + '-'.repeat(45) + '\n';
    for (const d of dados) {
      txt += d.partName + ' — ' + d.opType + ': ' + d.cutW + 'x' + d.cutD + 'mm';
      if (d.note) txt += ' — ' + d.note;
      txt += '\n';
    }
    txt += '\nDRILL OPS (' + drills.length + ')\n' + '-'.repeat(45) + '\n';
    for (const d of drills) {
      txt += d.partName + ' — ' + d.opType + ': dia ' + d.dia + 'mm';
      if (d.note) txt += ' — ' + d.note;
      txt += '\n';
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="' + cab.cabinet_code + '-cutlist.txt"');
    res.send(txt);
  } catch (err) {
    console.error('Export cutlist error:', err);
    res.status(500).json({ error: 'Export failed' });
  }
});

// ─── DXF info (available thicknesses) ────────────────────────────────────────
router.get('/cabinet/:id/dxf-info', requireAuth, async (req, res) => {
  try {
    const cab = await queryOne('SELECT * FROM cabinets WHERE cabinet_id = ?', [req.params.id]);
    if (!cab) return res.status(404).json({ error: 'Cabinet not found' });
    const cfg = typeof cab.config === 'string' ? JSON.parse(cab.config) : cab.config;
    const { parts } = computeCabinet(cfg);
    const thicknesses = [...new Set(parts.map(p => p.t))].sort((a, b) => b - a);
    res.json({ thicknesses });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// ─── Export DXF (computed live from config, not from DB) ─────────────────────
router.get('/cabinet/:id/dxf', requireAuth, async (req, res) => {
  try {
    const cab = await queryOne('SELECT * FROM cabinets WHERE cabinet_id = ?', [req.params.id]);
    if (!cab) return res.status(404).json({ error: 'Cabinet not found' });

    const cfg = typeof cab.config === 'string' ? JSON.parse(cab.config) : cab.config;
    const { parts, dados, drills } = computeCabinet(cfg);

    // Filter by thickness if requested
    const filterT = req.query.thickness ? parseFloat(req.query.thickness) : null;
    const filteredParts = filterT ? parts.filter(p => p.t === filterT) : parts;
    if (filteredParts.length === 0) return res.status(404).json({ error: 'No parts at that thickness' });

    // Build a set of part codes we're including
    const includedCodes = new Set();
    for (const p of filteredParts) { includedCodes.add(p.code); }

    // Filter dados and drills to only included parts
    const filteredDados = dados.filter(d => includedCodes.has(d.partCode));
    const filteredDrills = drills.filter(d => includedCodes.has(d.partCode));

    // Group dados/drills by part code
    const dadosByPart = {};
    for (const d of filteredDados) {
      if (!dadosByPart[d.partCode]) dadosByPart[d.partCode] = [];
      dadosByPart[d.partCode].push(d);
    }
    const drillsByPart = {};
    for (const d of filteredDrills) {
      if (!drillsByPart[d.partCode]) drillsByPart[d.partCode] = [];
      drillsByPart[d.partCode].push(d);
    }

    const dxf = generateDXF(filteredParts, dadosByPart, drillsByPart, cfg);
    const suffix = filterT ? filterT + 'mm' : 'all';

    res.setHeader('Content-Type', 'application/dxf');
    res.setHeader('Content-Disposition', 'attachment; filename="' + cab.cabinet_code + '-' + suffix + '.dxf"');
    res.send(dxf);
  } catch (err) {
    console.error('DXF export error:', err);
    res.status(500).json({ error: 'DXF export failed' });
  }
});

// ─── Single part DXF ─────────────────────────────────────────────────────────
router.get('/part/:partId/dxf', requireAuth, async (req, res) => {
  res.status(501).json({ error: 'Use cabinet-level or job-level export' });
});

// ─── Job-level DXF (one, several, or all cabinets) ──────────────────────────
// ?thickness=18          → only 18mm parts
// ?cabinets=1,3,5        → specific cabinet IDs (omit for ALL in job)
router.get('/job/:jobId/dxf', requireAuth, async (req, res) => {
  try {
    const job = await queryOne('SELECT * FROM jobs WHERE job_id = ?', [req.params.jobId]);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    // Get selected cabinets or all
    let cabinets;
    if (req.query.cabinets) {
      const ids = req.query.cabinets.split(',').map(Number).filter(Boolean);
      cabinets = await query(
        'SELECT * FROM cabinets WHERE job_id = ? AND cabinet_id IN (' + ids.map(() => '?').join(',') + ')',
        [req.params.jobId, ...ids]
      );
    } else {
      cabinets = await query('SELECT * FROM cabinets WHERE job_id = ? ORDER BY cabinet_code', [req.params.jobId]);
    }

    if (cabinets.length === 0) return res.status(404).json({ error: 'No cabinets found' });

    const filterT = req.query.thickness ? parseFloat(req.query.thickness) : null;

    // Compute all cabinets and merge parts
    let allParts = [], allDados = {}, allDrills = {};
    for (const cab of cabinets) {
      const cfg = typeof cab.config === 'string' ? JSON.parse(cab.config) : cab.config;
      const { parts, dados, drills } = computeCabinet(cfg);

      // Prefix part codes with cabinet code to avoid collisions
      const prefix = cab.cabinet_code + '_';
      for (const p of parts) {
        p.code = prefix + p.code;
        p.name = cab.cabinet_code + ' ' + p.name;
      }
      for (const d of dados) d.partCode = prefix + d.partCode;
      for (const d of drills) d.partCode = prefix + d.partCode;

      // Filter by thickness
      const filtered = filterT ? parts.filter(p => p.t === filterT) : parts;
      allParts.push(...filtered);

      const includedCodes = new Set(filtered.map(p => p.code));
      for (const d of dados.filter(d => includedCodes.has(d.partCode))) {
        if (!allDados[d.partCode]) allDados[d.partCode] = [];
        allDados[d.partCode].push(d);
      }
      for (const d of drills.filter(d => includedCodes.has(d.partCode))) {
        if (!allDrills[d.partCode]) allDrills[d.partCode] = [];
        allDrills[d.partCode].push(d);
      }
    }

    if (allParts.length === 0) return res.status(404).json({ error: 'No parts at that thickness' });

    const dxf = generateDXF(allParts, allDados, allDrills, {});
    const cabNames = cabinets.map(c => c.cabinet_code).join('+');
    const suffix = filterT ? filterT + 'mm' : 'all';

    res.setHeader('Content-Type', 'application/dxf');
    res.setHeader('Content-Disposition', 'attachment; filename="' + job.job_code + '-' + cabNames + '-' + suffix + '.dxf"');
    res.send(dxf);
  } catch (err) {
    console.error('Job DXF export error:', err);
    res.status(500).json({ error: 'Export failed: ' + err.message });
  }
});

// ─── Job-level DXF info (thicknesses across all/selected cabinets) ──────────
router.get('/job/:jobId/dxf-info', requireAuth, async (req, res) => {
  try {
    let cabinets;
    if (req.query.cabinets) {
      const ids = req.query.cabinets.split(',').map(Number).filter(Boolean);
      cabinets = await query(
        'SELECT * FROM cabinets WHERE job_id = ? AND cabinet_id IN (' + ids.map(() => '?').join(',') + ')',
        [req.params.jobId, ...ids]
      );
    } else {
      cabinets = await query('SELECT * FROM cabinets WHERE job_id = ?', [req.params.jobId]);
    }
    const thicknesses = new Set();
    for (const cab of cabinets) {
      const cfg = typeof cab.config === 'string' ? JSON.parse(cab.config) : cab.config;
      const { parts } = computeCabinet(cfg);
      parts.forEach(p => thicknesses.add(p.t));
    }
    res.json({ thicknesses: [...thicknesses].sort((a, b) => b - a) });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});


// ═════════════════════════════════════════════════════════════════════════════
// DXF GENERATION — uses explicit coordinates from compute engine
// ═════════════════════════════════════════════════════════════════════════════

function dxfHeader() {
  return '0\nSECTION\n2\nHEADER\n0\nENDSEC\n';
}

function dxfTables(layers) {
  const colors = {
    'Profile_Cut':7, 'Dado':1, 'Rabbet':5, 'Groove':3,
    'Drill':4, 'Hinge_Bore':6, 'Shelf_Pins':2, 'Label':8
  };
  let t = '0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n' + layers.length + '\n';
  for (const l of layers)
    t += '0\nLAYER\n2\n' + l + '\n70\n0\n62\n' + (colors[l]||7) + '\n6\nCONTINUOUS\n';
  t += '0\nENDTAB\n0\nENDSEC\n';
  return t;
}

function dxfRect(x, y, w, h, layer) {
  return '0\nLWPOLYLINE\n8\n' + layer + '\n90\n4\n70\n1\n' +
    '10\n' + x + '\n20\n' + y + '\n' +
    '10\n' + (x+w) + '\n20\n' + y + '\n' +
    '10\n' + (x+w) + '\n20\n' + (y+h) + '\n' +
    '10\n' + x + '\n20\n' + (y+h) + '\n';
}

function dxfCircle(cx, cy, r, layer) {
  return '0\nCIRCLE\n8\n' + layer + '\n10\n' + cx + '\n20\n' + cy + '\n40\n' + r + '\n';
}

function dxfText(x, y, text, layer, h) {
  return '0\nTEXT\n8\n' + layer + '\n10\n' + x + '\n20\n' + y + '\n40\n' + (h||5) + '\n1\n' + text + '\n';
}

function generateDXF(parts, dadosByPart, drillsByPart, cfg) {
  const layers = new Set(['Profile_Cut', 'Label', 'Dado', 'Rabbet', 'Drill', 'Hinge_Bore', 'Shelf_Pins', 'Leg_Mount']);
  let entities = '';
  let offsetX = 0;
  const GAP = 20;

  for (const part of parts) {
    for (let inst = 0; inst < part.qty; inst++) {
      const W = part.len;
      const H = part.w;
      const isMirror = !!part.mirror;

      const my = (y, h) => isMirror ? (H - y - (h||0)) : y;

      // ─── Profile cut ───
      if (part.hasNotch && part.notchH > 0 && part.notchD > 0) {
        const nH = part.notchH, nD = part.notchD;
        if (!isMirror) {
          entities += '0\nLWPOLYLINE\n8\nProfile_Cut\n90\n6\n70\n1\n' +
            '10\n'+(offsetX)+'\n20\n'+nD+'\n'+
            '10\n'+(offsetX+nH)+'\n20\n'+nD+'\n'+
            '10\n'+(offsetX+nH)+'\n20\n0\n'+
            '10\n'+(offsetX+W)+'\n20\n0\n'+
            '10\n'+(offsetX+W)+'\n20\n'+H+'\n'+
            '10\n'+offsetX+'\n20\n'+H+'\n';
        } else {
          entities += '0\nLWPOLYLINE\n8\nProfile_Cut\n90\n6\n70\n1\n' +
            '10\n'+offsetX+'\n20\n0\n'+
            '10\n'+(offsetX+W)+'\n20\n0\n'+
            '10\n'+(offsetX+W)+'\n20\n'+H+'\n'+
            '10\n'+(offsetX+nH)+'\n20\n'+H+'\n'+
            '10\n'+(offsetX+nH)+'\n20\n'+(H-nD)+'\n'+
            '10\n'+offsetX+'\n20\n'+(H-nD)+'\n';
        }
      } else {
        entities += dxfRect(offsetX, 0, W, H, 'Profile_Cut');
      }

      // ─── Label ───
      entities += dxfText(offsetX+5, H-10,
        part.code+(part.qty>1?' ('+(inst+1)+'/'+part.qty+')':'')+' - '+part.name,
        'Label', 4);
      entities += dxfText(offsetX+5, H-18, W+' x '+H+' x '+part.t+'mm'+(isMirror?' [MIRROR]':''), 'Label', 3);

      // ─── Dados & Rabbets ───
      const partDados = dadosByPart[part.code] || [];
      for (const d of partDados) {
        const layer = d.opType === 'rabbet' ? 'Rabbet' : 'Dado';

        let rx, ry, rw, rh;

        // Prefer explicit DXF coordinates when available (shelf grooves, etc.)
        if (d.dxfX !== undefined && d.dxfY !== undefined) {
          rx = d.dxfX; ry = d.dxfY; rw = d.dxfW; rh = d.dxfH;
        } else {
          const dist = d.dist || 0;
          const cw = d.cutW;
          const cl = d.cutLen;
          const ds = d.depthStart || 0;

          switch (d.fromEdge) {
            case 'bottom':
              rx = dist; ry = my(ds, cl); rw = cw; rh = cl; break;
            case 'top':
              rx = W - dist - cw; ry = my(ds, cl); rw = cw; rh = cl; break;
            case 'rear':
              rx = W - cl; ry = my(H - dist - cw, cw); rw = cl; rh = cw; break;
            case 'front':
              rx = 0; ry = my(dist, cw); rw = cl; rh = cw; break;
            default:
              rx = 0; ry = 0; rw = cl; rh = cw;
          }
        }
        entities += dxfRect(offsetX + rx, ry, rw, rh, layer);
      }

      // ─── Drill operations ───
      const partDrills = drillsByPart[part.code] || [];
      for (const d of partDrills) {
        // Choose layer based on operation type
        let layer = 'Drill';
        if (d.opType === 'hinge_bore') layer = 'Hinge_Bore';
        else if (d.opType === 'shelf_pin_line') layer = 'Shelf_Pins';
        else if (d.opType === 'leg_mount' || d.opType === 'leg_center') layer = 'Leg_Mount';

        const r = d.dia / 2;

        // Method 1: Explicit holes array (legs, hinges when computed with holes[])
        if (d.holes && d.holes.length > 0) {
          for (const hole of d.holes) {
            entities += dxfCircle(offsetX + hole.x, hole.y, r, layer);
          }
        }
        // Method 2: Grid pattern (shelf pins)
        else {
          const depthPos = d.depthPositions || [0];
          for (const yPos of depthPos) {
            for (let i = 0; i < (d.count || 1); i++) {
              const cx = (d.heightStart || 0) + i * (d.spacing || 0);
              const cy = isMirror ? (H - yPos) : yPos;
              entities += dxfCircle(offsetX + cx, cy, r, layer);
            }
          }
        }
      }

      offsetX += W + GAP;
    }
  }

  return dxfHeader() + dxfTables([...layers]) +
    '0\nSECTION\n2\nENTITIES\n' + entities + '0\nENDSEC\n0\nEOF\n';
}

export default router;
