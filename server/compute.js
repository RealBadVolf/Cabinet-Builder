// ═══════════════════════════════════════════════════════════════════════════
// Cabinet computation engine v3 — All mm
// DXF: X = part length (height for sides), Y = part width (depth for sides)
// Export.js handles mirroring via part.mirror flag
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
  // Left: normal. Right: mirror flag set, export flips Y coords.
  for (const side of ['L','R']) {
    const sc=code();
    const isR=(side==='R');
    parts.push({code:sc,
      name:'Side Panel ('+side+')',
      partType:isR?'side_right':'side_left',
      len:sideH, w:depth, t:mt, qty:1,
      notes:integratedTK?'Full height. Notch '+tkH+'x'+tkRecess+'mm.'+(isR?' MIRRORED.':''):'See ops.',
      hasNotch:integratedTK, notchH:tkH, notchD:tkRecess,
      mirror:isR});

    // Bottom panel dado
    // fromEdge:'bottom' = X position from bottom. depthStart = where along Y.
    // Runs from front (Y=0) across depth, stopped before back panel.
    dados.push({partCode:sc, opType:'dado', cutW:mt, cutD:dadoD,
      fromEdge:'bottom', dist:bottomPos, cutLen:depth-bpt,
      depthStart:0,
      note:'Bottom panel dado'});

    // Front nailer dado at top, starting from front edge (Y=0)
    dados.push({partCode:sc, opType:'dado', cutW:mt, cutD:dadoD,
      fromEdge:'top', dist:0, cutLen:nailerH,
      depthStart:0,
      note:'Front nailer dado'});

    // Rear nailer dado at top, starting from rear edge (Y=depth-nailerH)
    dados.push({partCode:sc, opType:'dado', cutW:mt, cutD:dadoD,
      fromEdge:'top', dist:0, cutLen:nailerH,
      depthStart:depth-nailerH,
      note:'Rear nailer dado'});

    // Back panel rabbet along rear edge, from top down for rabbetLen
    const rabbetLen=integratedTK?(sideH-tkH):sideH;
    dados.push({partCode:sc, opType:'rabbet', cutW:bpt+1, cutD:rabD,
      fromEdge:'rear', dist:0, cutLen:rabbetLen,
      note:'Back panel rabbet — '+rabbetLen+'mm'});

    // Fixed shelf dados
    if(shelfType==='fixed'&&shelfCount>0){
      const intCaseH=caseH-2*mt, sp=intCaseH/(shelfCount+1);
      for(let i=1;i<=shelfCount;i++){
        dados.push({partCode:sc, opType:'dado', cutW:mt, cutD:dadoD,
          fromEdge:'bottom', dist:bottomPos+mt+sp*i, cutLen:depth-bpt,
          depthStart:0,
          note:'Fixed shelf #'+i});
      }
    }

    // Shelf pin holes
    if(shelfType==='adjustable'&&shelfCount>0){
      const zStart=bottomPos+mt+pinZoneStart;
      const zEnd=sideH-mt-pinZoneEnd;
      const hCount=Math.max(1,Math.floor((zEnd-zStart)/pinSpacing)+1);
      // depthPositions: Y coords for pin rows (export mirrors these for right side)
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
  parts.push({code:code(),name:'Bottom Panel',partType:'bottom',
    len:btmW,w:btmD,t:mt,qty:1,notes:'Into side dados. Front flush.'});

  // ═══ SHELVES ═══
  if(shelfCount>0){
    const shW=shelfType==='fixed'?intW+2*dadoD:intW-1;
    const shD=shelfType==='fixed'?depth-bpt-mt+dadoD:depth-bpt-6;
    parts.push({code:code(),
      name:shelfType==='fixed'?'Fixed Shelf':'Adjustable Shelf',
      partType:shelfType==='fixed'?'fixed_shelf':'adjustable_shelf',
      len:shW,w:shD,t:mt,qty:shelfCount,
      notes:shelfType==='fixed'?'In dado':'On pins, -1mm clearance'});
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
  if(toeKickStyle!=='none')
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

  // Top rail
  parts.push({code:code(),name:label+' Top Rail',partType:'rail',
    len:railLen,w:style.rail,t:dmt,qty:1,notes:styleName+' R&S'});
  // Bottom rail
  parts.push({code:code(),name:label+' Bottom Rail',partType:'rail',
    len:railLen,w:style.rail,t:dmt,qty:1,notes:styleName+' R&S'});
  // Hinge stile (gets hinge bores)
  const hsCode=code();
  parts.push({code:hsCode,name:label+' Hinge Stile',partType:'stile',
    len:dH,w:style.stile,t:dmt,qty:1,notes:styleName+' R&S — hinge side'});
  addHinges(drills,hsCode,dH,hingeDia,hingeDep,hingeEdge);
  // Latch stile
  parts.push({code:code(),name:label+' Latch Stile',partType:'stile',
    len:dH,w:style.stile,t:dmt,qty:1,notes:styleName+' R&S — latch side'});
  // Center panel
  parts.push({code:code(),name:label+' Center Panel',partType:'center_panel',
    len:dW-2*style.stile+2*t, w:dH-2*style.rail+2*t, t:dmt, qty:1,
    notes:'+'+t+'mm tongue each side'});
}
