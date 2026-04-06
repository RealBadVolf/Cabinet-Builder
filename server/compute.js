// ═══════════════════════════════════════════════════════════════════════════
// Cabinet computation engine v4 — All mm
// New: dado allowance, adjustable leg hole patterns
// DXF: X = part length, Y = part width
// ═══════════════════════════════════════════════════════════════════════════

const DOOR_STYLES = {
  slab:{rail:0,stile:0}, shaker:{rail:65,stile:65}, raised_panel:{rail:70,stile:70},
  flat_panel_rs:{rail:60,stile:60}, glass_front:{rail:55,stile:55}, cathedral:{rail:75,stile:65},
  beadboard:{rail:55,stile:55}, mullion:{rail:55,stile:55}, louvered:{rail:60,stile:60},
  board_batten:{rail:0,stile:0},
};

export function computeCabinet(cfg) {
  const mt=cfg.caseMaterialThickness||18, bpt=cfg.backPanelThickness||6, dmt=cfg.doorMaterialThickness||18;
  const dadoD=cfg.dadoDepth||10, rabD=cfg.rabbetDepth||10;
  const height=cfg.height||760, width=cfg.width||600, depth=cfg.depth||580;
  const toeKickStyle=cfg.toeKickStyle||'integral';
  const tkH=(toeKickStyle==='none')?0:(cfg.toeKickHeight||100), tkRecess=cfg.toeKickRecess||75;
  const shelfCount=cfg.shelfCount||0, shelfType=cfg.shelfType||'adjustable';
  const doorCount=cfg.doorCount??1, doorOverlay=cfg.doorOverlay||12;
  const doorGap=cfg.doorGap||3, doorReveal=cfg.doorReveal||3;
  const nailerH=cfg.nailerHeight||90, doorStyle=cfg.doorStyle||'shaker';
  const pinDia=cfg.pinDia||5, pinDepth=cfg.pinDepth||12, pinSpacing=cfg.pinSpacing||32;
  const pinRowsPerSide=cfg.pinRowsPerSide||2;
  const pinInsetF=cfg.pinInsetFront||37, pinInsetR=cfg.pinInsetRear||37;
  const pinZoneStart=cfg.pinZoneStart||80, pinZoneEnd=cfg.pinZoneEnd||80;
  const hingeBoreDia=cfg.hingeBoreDia||35, hingeBoreDepth=cfg.hingeBoreDepth||13;
  const hingeBoreFromEdge=cfg.hingeBoreFromEdge||22;

  // ─── NEW: Dado allowance ──────────────────────────────────────────────
  // Added to every dado width so parts fit snugly without being too tight.
  // Typical: 0.2mm for plywood. Set to 0 for perfect-thickness material.
  const dadoAllowance = cfg.dadoAllowance ?? 0.2;

  // ─── NEW: Leg configuration ───────────────────────────────────────────
  const legCount      = cfg.legCount || 0;            // 0 = no legs
  const legMargin     = cfg.legMargin || 100;         // mm from panel edges to leg center
  const legHoleCount  = cfg.legHoleCount || 4;        // screw holes per leg
  const legHoleDia    = cfg.legHoleDia || 4;          // screw hole diameter
  const legBoltCircle = cfg.legBoltCircle || 45;      // bolt circle diameter
  const legHoleDepth  = cfg.legHoleDepth || 12;       // hole depth
  const legCenterHole = cfg.legCenterHole || false;    // center pilot hole
  const legCenterDia  = cfg.legCenterDia || 5;        // center hole diameter

  // Effective dado width = material thickness + allowance
  const dadoW = mt + dadoAllowance;

  const integratedTK=(toeKickStyle==='integral');
  const sideH=integratedTK?height:(height-tkH);
  const caseH=height-tkH;
  const intW=width-2*mt;
  const bottomPos=integratedTK?tkH:mt;
  const nailerLen=intW+2*dadoD;

  const parts=[], dados=[], drills=[];
  let pIdx=0;
  const code=()=>'P'+String(++pIdx).padStart(3,'0');

  // ═══ SIDE PANELS ═══
  for (const side of ['L','R']) {
    const sc=code();
    const isR=(side==='R');
    parts.push({code:sc,
      name:'Side Panel ('+side+')',
      partType:isR?'side_right':'side_left',
      len:sideH, w:depth, t:mt, qty:1,
      notes:integratedTK
        ? 'Full height. Notch '+tkH+'x'+tkRecess+'mm.'+(isR?' MIRRORED.':'')
        + (dadoAllowance>0?' Dado allowance: +'+dadoAllowance+'mm.':'')
        : 'See ops.',
      hasNotch:integratedTK, notchH:tkH, notchD:tkRecess,
      mirror:isR});

    // Bottom panel dado (uses dadoW = mt + allowance)
    dados.push({partCode:sc, opType:'dado', cutW:dadoW, cutD:dadoD,
      fromEdge:'bottom', dist:bottomPos, cutLen:depth-bpt,
      depthStart:0,
      note:'Bottom panel dado ('+dadoW+'mm wide, incl. '+dadoAllowance+'mm allowance)'});

    // Front nailer dado
    dados.push({partCode:sc, opType:'dado', cutW:dadoW, cutD:dadoD,
      fromEdge:'top', dist:0, cutLen:nailerH,
      depthStart:0,
      note:'Front nailer dado'});

    // Rear nailer dado
    dados.push({partCode:sc, opType:'dado', cutW:dadoW, cutD:dadoD,
      fromEdge:'top', dist:0, cutLen:nailerH,
      depthStart:depth-nailerH,
      note:'Rear nailer dado'});

    // Back panel rabbet (rabbet width = bpt + 1, no allowance needed)
    const rabbetLen=integratedTK?(sideH-tkH):sideH;
    dados.push({partCode:sc, opType:'rabbet', cutW:bpt+1, cutD:rabD,
      fromEdge:'rear', dist:0, cutLen:rabbetLen,
      note:'Back panel rabbet — '+rabbetLen+'mm'});

    // Fixed shelf dados
    if(shelfType==='fixed'&&shelfCount>0){
      const intCaseH=caseH-2*mt, sp=intCaseH/(shelfCount+1);
      for(let i=1;i<=shelfCount;i++){
        dados.push({partCode:sc, opType:'dado', cutW:dadoW, cutD:dadoD,
          fromEdge:'bottom', dist:bottomPos+mt+sp*i, cutLen:depth-bpt,
          depthStart:0,
          note:'Fixed shelf #'+i+' ('+dadoW+'mm wide)'});
      }
    }

    // Shelf pin holes
    if(shelfType==='adjustable'&&shelfCount>0){
      const zStart=bottomPos+mt+pinZoneStart;
      const zEnd=sideH-mt-pinZoneEnd;
      const hCount=Math.max(1,Math.floor((zEnd-zStart)/pinSpacing)+1);
      const depthPos=[pinInsetF];
      if(pinRowsPerSide>=2) depthPos.push(depth-bpt-pinInsetR);
      if(pinRowsPerSide>2){
        const total=depth-bpt-pinInsetF-pinInsetR;
        for(let r=1;r<pinRowsPerSide-1;r++)
          depthPos.push(pinInsetF+r*(total/(pinRowsPerSide-1)));
      }
      drills.push({partCode:sc, opType:'shelf_pin_line',
        dia:pinDia, dep:pinDepth,
        heightStart:zStart, spacing:pinSpacing, count:hCount,
        depthPositions:depthPos,
        note:'32mm system — '+(hCount*depthPos.length)+' holes per side'});
    }
  }

  // ═══ BOTTOM PANEL ═══
  const btmW=intW+2*dadoD, btmD=depth-bpt-mt+dadoD;
  const btmCode=code();
  parts.push({code:btmCode,name:'Bottom Panel',partType:'bottom',
    len:btmW,w:btmD,t:mt,qty:1,
    notes:'Into side dados. Front flush.'
      +(legCount>0?' Leg mounting holes on underside.':'')});

  // ═══ LEG MOUNTING HOLES ═══
  if(legCount>0){
    // Calculate leg center positions on the bottom panel
    const legPositions = computeLegPositions(legCount, btmW, btmD, legMargin);

    // For each leg, generate bolt circle holes
    const allHoles = [];
    for(const pos of legPositions){
      // Bolt circle: N holes evenly spaced on a circle
      const boltR = legBoltCircle / 2;
      for(let h=0; h<legHoleCount; h++){
        const angle = (2 * Math.PI * h) / legHoleCount - Math.PI/2; // start from top
        allHoles.push({
          x: pos.x + boltR * Math.cos(angle),
          y: pos.y + boltR * Math.sin(angle)
        });
      }
      // Optional center pilot hole
      if(legCenterHole){
        allHoles.push({x:pos.x, y:pos.y, isCenterHole:true});
      }
    }

    // Screw holes
    drills.push({partCode:btmCode, opType:'leg_mount',
      dia:legHoleDia, dep:legHoleDepth,
      holes:allHoles.filter(h=>!h.isCenterHole),
      heightStart:0, spacing:0, count:allHoles.filter(h=>!h.isCenterHole).length,
      depthPositions:[0],
      note:legCount+' legs, '+legHoleCount+' holes each ('+legHoleDia+'mm), bolt circle '+legBoltCircle+'mm, margin '+legMargin+'mm'});

    // Center pilot holes (separate operation, may be different diameter)
    if(legCenterHole){
      drills.push({partCode:btmCode, opType:'leg_center',
        dia:legCenterDia, dep:legHoleDepth,
        holes:allHoles.filter(h=>h.isCenterHole),
        heightStart:0, spacing:0, count:legPositions.length,
        depthPositions:[0],
        note:legCount+' center pilot holes ('+legCenterDia+'mm)'});
    }
  }

  // ═══ SHELVES ═══
  if(shelfCount>0){
    const shW=shelfType==='fixed'?intW+2*dadoD:intW-1;
    const shD=shelfType==='fixed'?depth-bpt-mt+dadoD:depth-bpt-6;

    // Shelf pin groove config (for adjustable shelves)
    const shelfGrooves   = (cfg.shelfGrooves !== false) && (shelfType==='adjustable');
    const grooveWidth    = cfg.shelfGrooveWidth || (pinDia + 2);  // pin dia + 2mm clearance
    const grooveDepth    = cfg.shelfGrooveDepth || 10;            // = pin extension from panel
    const grooveInset    = cfg.shelfGrooveInset || 12;            // how far from edge inward

    // Compute pin depth positions (same as pin drilling rows)
    const pinDepthPos = [pinInsetF];
    if(pinRowsPerSide>=2) pinDepthPos.push(depth-bpt-pinInsetR);
    if(pinRowsPerSide>2){
      const total=depth-bpt-pinInsetF-pinInsetR;
      for(let r=1;r<pinRowsPerSide-1;r++)
        pinDepthPos.push(pinInsetF+r*(total/(pinRowsPerSide-1)));
    }

    // Generate each shelf as its own part (so each gets its own grooves in DXF)
    for(let si=0; si<shelfCount; si++){
      const shCode = code();
      const shelfLabel = shelfCount>1 ? 'Shelf '+(si+1) : 'Adjustable Shelf';
      parts.push({code:shCode,
        name:shelfType==='fixed'?'Fixed Shelf':shelfLabel,
        partType:shelfType==='fixed'?'fixed_shelf':'adjustable_shelf',
        len:shW,w:shD,t:mt,qty:1,
        notes:shelfType==='fixed'?'In dado'
          :'On pins'+(shelfGrooves?', with pin-lock grooves ('+pinDepthPos.length+' per side)':'')});

      // Add pin-lock grooves to adjustable shelves
      if(shelfGrooves){
        // Grooves on LEFT edge (X=0) — for left side panel pins
        for(const pinY of pinDepthPos){
          const grooveY = pinY - grooveWidth/2;
          dados.push({partCode:shCode, opType:'dado',
            cutW:grooveInset, cutD:grooveDepth,
            fromEdge:'bottom', dist:0, cutLen:grooveWidth,
            depthStart:grooveY,
            dxfX:0, dxfY:grooveY, dxfW:grooveInset, dxfH:grooveWidth,
            note:'Pin-lock groove, left edge, Y='+Math.round(pinY)+'mm'});
        }
        // Grooves on RIGHT edge (X=shW) — for right side panel pins
        for(const pinY of pinDepthPos){
          const grooveY = pinY - grooveWidth/2;
          dados.push({partCode:shCode, opType:'dado',
            cutW:grooveInset, cutD:grooveDepth,
            fromEdge:'top', dist:0, cutLen:grooveWidth,
            depthStart:grooveY,
            dxfX:shW-grooveInset, dxfY:grooveY, dxfW:grooveInset, dxfH:grooveWidth,
            note:'Pin-lock groove, right edge, Y='+Math.round(pinY)+'mm'});
        }
      }
    }
  }

  // ═══ NAILERS ═══
  parts.push({code:code(),name:'Front Nailer',partType:'nailer_front',
    len:nailerLen,w:nailerH,t:mt,qty:1,notes:'In dado at top.'});
  parts.push({code:code(),name:'Rear Nailer',partType:'nailer_rear',
    len:nailerLen,w:nailerH,t:mt,qty:1,notes:'In dado at top. Wall mount.'});

  // ═══ BACK PANEL ═══
  const backW=width-2*(mt-rabD)+1, backH=caseH-mt+rabD;
  parts.push({code:code(),name:'Back Panel',partType:'back_panel',
    len:backW,w:backH,t:bpt,qty:1,notes:'In rabbet. Glue + pin nail.'});

  // ═══ TOE KICK ═══
  if(toeKickStyle!=='none'&&toeKickStyle!=='legs')
    parts.push({code:code(),name:'Toe Kick Plate',partType:'toe_kick',
      len:intW,w:tkH-mt,t:mt,qty:1,notes:'Recessed '+tkRecess+'mm.'});

  // ═══ DOORS ═══
  const dStyleObj=DOOR_STYLES[doorStyle]||DOOR_STYLES.shaker;
  const isRS=dStyleObj.rail>0;
  const dH=caseH+2*doorOverlay-2*doorReveal;

  if(doorCount===1){
    const dW=width+2*doorOverlay-2*doorReveal;
    if(isRS){
      addDoorRS(parts,drills,code,dStyleObj,dH,dW,dmt,hingeBoreDia,hingeBoreDepth,hingeBoreFromEdge,'Door',doorStyle);
    } else {
      const dc=code();
      parts.push({code:dc,name:'Door',partType:'door',len:dH,w:dW,t:dmt,qty:1,
        notes:'Slab. Full overlay. 2 hinges.'});
      addHinges(drills,dc,dH,hingeBoreDia,hingeBoreDepth,hingeBoreFromEdge);
    }
  } else if(doorCount===2){
    const dW=width/2+doorOverlay-doorGap/2-doorReveal;
    for(const label of ['L','R']){
      if(isRS){
        addDoorRS(parts,drills,code,dStyleObj,dH,dW,dmt,hingeBoreDia,hingeBoreDepth,hingeBoreFromEdge,'Door '+label,doorStyle);
      } else {
        const dc=code();
        parts.push({code:dc,name:'Door ('+label+')',partType:'door',len:dH,w:dW,t:dmt,qty:1,
          notes:'Slab. '+doorGap+'mm gap. 2 hinges.'});
        addHinges(drills,dc,dH,hingeBoreDia,hingeBoreDepth,hingeBoreFromEdge);
      }
    }
  }

  return {parts,dados,drills,caseH,intW,sideH};
}


// ═══════════════════════════════════════════════════════════════════════════
// LEG PLACEMENT — distributes N legs within a margin rectangle
// ═══════════════════════════════════════════════════════════════════════════
//
// Strategy:
//   4 legs → 4 corners
//   5 legs → 4 corners + 1 center
//   6 legs → 4 corners + 2 midpoints on long edges
//   7 legs → 4 corners + 1 center + 2 midpoints on long edges
//   8 legs → 4 corners + 4 midpoints (each edge)
//   General: corners first, then center if odd, then distribute remaining
//            along edges evenly
//
//  ┌──────────────────────────────┐
//  │   margin                     │
//  │   ┌──────────────────────┐   │
//  │   │ ●                  ● │   │  ← corners
//  │   │                      │   │
//  │   │          ●           │   │  ← center (odd count)
//  │   │                      │   │
//  │   │ ●                  ● │   │  ← corners
//  │   └──────────────────────┘   │
//  │                              │
//  └──────────────────────────────┘
//
function computeLegPositions(count, panelW, panelD, margin) {
  if (count <= 0) return [];

  const x1 = margin;               // left
  const x2 = panelW - margin;      // right
  const y1 = margin;               // front
  const y2 = panelD - margin;      // rear
  const cx = (x1 + x2) / 2;       // center X
  const cy = (y1 + y2) / 2;       // center Y

  if (count === 1) return [{x:cx, y:cy}];
  if (count === 2) return [{x:cx, y:y1}, {x:cx, y:y2}];
  if (count === 3) return [{x:x1, y:cy}, {x:cx, y:cy}, {x:x2, y:cy}];

  const positions = [];

  // Always start with 4 corners
  positions.push({x:x1, y:y1});  // front-left
  positions.push({x:x2, y:y1});  // front-right
  positions.push({x:x2, y:y2});  // rear-right
  positions.push({x:x1, y:y2});  // rear-left

  let remaining = count - 4;
  if (remaining <= 0) return positions;

  // If odd remaining, add center first
  if (remaining % 2 === 1) {
    positions.push({x:cx, y:cy});
    remaining--;
  }

  if (remaining <= 0) return positions;

  // Distribute remaining along edges
  // Prefer long edges first, then short edges
  const longEdge = panelW >= panelD;
  const edgePairs = longEdge
    ? [
        // Along front and rear (X axis, longer)
        {from:{x:x1,y:y1}, to:{x:x2,y:y1}, fromR:{x:x1,y:y2}, toR:{x:x2,y:y2}},
        // Along left and right (Y axis, shorter)
        {from:{x:x1,y:y1}, to:{x:x1,y:y2}, fromR:{x:x2,y:y1}, toR:{x:x2,y:y2}},
      ]
    : [
        {from:{x:x1,y:y1}, to:{x:x1,y:y2}, fromR:{x:x2,y:y1}, toR:{x:x2,y:y2}},
        {from:{x:x1,y:y1}, to:{x:x2,y:y1}, fromR:{x:x1,y:y2}, toR:{x:x2,y:y2}},
      ];

  for (const pair of edgePairs) {
    if (remaining <= 0) break;
    // Add midpoints along each edge pair (always in pairs: one per edge)
    const perEdge = Math.min(Math.floor(remaining / 2), 3); // max 3 midpoints per edge
    for (let i = 1; i <= perEdge; i++) {
      const t = i / (perEdge + 1);
      // Front/left edge
      positions.push({
        x: pair.from.x + (pair.to.x - pair.from.x) * t,
        y: pair.from.y + (pair.to.y - pair.from.y) * t
      });
      // Rear/right edge (mirror)
      positions.push({
        x: pair.fromR.x + (pair.toR.x - pair.fromR.x) * t,
        y: pair.fromR.y + (pair.toR.y - pair.fromR.y) * t
      });
      remaining -= 2;
    }
  }

  return positions;
}


// ═══════════════════════════════════════════════════════════════════════════
// DOOR HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function addHinges(drills,partCode,dH,dia,dep,fromEdge){
  drills.push({partCode:partCode,opType:'hinge_bore',
    dia:dia,dep:dep,
    heightStart:80, spacing:dH-160, count:2,
    depthPositions:[fromEdge],
    note:'35mm Forstner, '+fromEdge+'mm from hinge edge'});
}

function addDoorRS(parts,drills,code,style,dH,dW,dmt,hingeDia,hingeDep,hingeEdge,label,styleName){
  const t=10;
  const railLen=dW-2*style.stile+2*t;
  parts.push({code:code(),name:label+' Top Rail',partType:'rail',
    len:railLen,w:style.rail,t:dmt,qty:1,notes:styleName+' R&S'});
  parts.push({code:code(),name:label+' Bottom Rail',partType:'rail',
    len:railLen,w:style.rail,t:dmt,qty:1,notes:styleName+' R&S'});
  const hsCode=code();
  parts.push({code:hsCode,name:label+' Hinge Stile',partType:'stile',
    len:dH,w:style.stile,t:dmt,qty:1,notes:styleName+' R&S — hinge side'});
  addHinges(drills,hsCode,dH,hingeDia,hingeDep,hingeEdge);
  parts.push({code:code(),name:label+' Latch Stile',partType:'stile',
    len:dH,w:style.stile,t:dmt,qty:1,notes:styleName+' R&S — latch side'});
  parts.push({code:code(),name:label+' Center Panel',partType:'center_panel',
    len:dW-2*style.stile+2*t, w:dH-2*style.rail+2*t, t:dmt, qty:1,
    notes:'+'+t+'mm tongue each side'});
}
