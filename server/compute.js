// ═══════════════════════════════════════════════════════════════════════════
// Cabinet computation engine v5 — All mm
// New: drawer boxes, custom shelf heights, multiple construction methods
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
  const tkH=(toeKickStyle==='none'||toeKickStyle==='legs')?
    (toeKickStyle==='legs'?(cfg.toeKickHeight||150):0):(cfg.toeKickHeight||100);
  const tkRecess=cfg.toeKickRecess||75;
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
  const dadoAllowance=cfg.dadoAllowance??0.2;
  const dadoW=mt+dadoAllowance;

  // Leg config
  const legCount=cfg.legCount||0, legMargin=cfg.legMargin||100;
  const legHoleCount=cfg.legHoleCount||4, legHoleDia=cfg.legHoleDia||4;
  const legBoltCircle=cfg.legBoltCircle||45, legHoleDepth=cfg.legHoleDepth||12;
  const legCenterHole=cfg.legCenterHole||false, legCenterDia=cfg.legCenterDia||5;

  // ─── Drawer config ────────────────────────────────────────────────────
  const drawers         = cfg.drawers || [];        // [{boxHeight,faceHeight},...] 
  const drawerGap       = cfg.drawerGap ?? 3;       // gap between drawer faces
  const drawerConstruct = cfg.drawerConstruction || 'dado'; // dado|box_joint|butt|dovetail|pocket_screw
  const drawerFaceType  = cfg.drawerFaceType || 'applied'; // applied|integrated|inset
  const drawerSideT     = cfg.drawerSideThickness || 15;
  const drawerBottomT   = cfg.drawerBottomThickness || 6;
  const drawerSlideType = cfg.drawerSlideType || 'undermount';
  const drawerSlideClear= cfg.drawerSlideClearance || 12.7; // mm per side (Blum undermount)
  const drawerBtmDadoH  = cfg.drawerBottomDadoHeight || 10; // mm from bottom edge to dado
  const drawerBtmDadoD  = cfg.drawerBottomDadoDepth || 6;   // dado depth for bottom panel

  // Custom shelf positions (overrides even distribution)
  const shelfPositions  = cfg.shelfPositions || null; // [300, 450] mm from bottom of case

  // Shelf groove config
  const shelfGrooves  = (cfg.shelfGrooves!==false)&&(shelfType==='adjustable');
  const grooveWidth   = cfg.shelfGrooveWidth||(pinDia+2);
  const grooveDepth   = cfg.shelfGrooveDepth||10;
  const grooveInset   = cfg.shelfGrooveInset||12;

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
  const sidePanelCodes = [];
  for(const side of ['L','R']){
    const sc=code();
    sidePanelCodes.push(sc);
    const isR=(side==='R');
    parts.push({code:sc,name:'Side Panel ('+side+')',
      partType:isR?'side_right':'side_left',
      len:sideH, w:depth, t:mt, qty:1,
      notes:integratedTK?'Full height. Notch '+tkH+'x'+tkRecess+'mm.'+(isR?' MIRRORED.':'')
        +(dadoAllowance>0?' Dado +'+dadoAllowance+'mm.':''):'See ops.',
      hasNotch:integratedTK, notchH:tkH, notchD:tkRecess, mirror:isR});

    // Bottom panel dado
    dados.push({partCode:sc, opType:'dado', cutW:dadoW, cutD:dadoD,
      fromEdge:'bottom', dist:bottomPos, cutLen:depth-bpt, depthStart:0,
      note:'Bottom panel dado ('+dadoW.toFixed(2)+'mm)'});
    // Front nailer dado
    dados.push({partCode:sc, opType:'dado', cutW:dadoW, cutD:dadoD,
      fromEdge:'top', dist:0, cutLen:nailerH, depthStart:0,
      note:'Front nailer dado'});
    // Rear nailer dado
    dados.push({partCode:sc, opType:'dado', cutW:dadoW, cutD:dadoD,
      fromEdge:'top', dist:0, cutLen:nailerH, depthStart:depth-nailerH,
      note:'Rear nailer dado'});
    // Back panel rabbet
    const rabbetLen=integratedTK?(sideH-tkH):sideH;
    dados.push({partCode:sc, opType:'rabbet', cutW:bpt+1, cutD:rabD,
      fromEdge:'rear', dist:0, cutLen:rabbetLen,
      note:'Back panel rabbet — '+rabbetLen+'mm'});

    // Fixed shelf dados (custom positions or evenly distributed)
    if(shelfType==='fixed'&&shelfCount>0){
      const positions=getShelfPositions(shelfCount, caseH, mt, shelfPositions);
      for(let i=0;i<positions.length;i++){
        const fromBtm=bottomPos+positions[i];
        dados.push({partCode:sc, opType:'dado', cutW:dadoW, cutD:dadoD,
          fromEdge:'bottom', dist:fromBtm, cutLen:depth-bpt, depthStart:0,
          note:'Fixed shelf #'+(i+1)+' at '+Math.round(positions[i])+'mm'});
      }
    }

    // Shelf pin holes (only if adjustable shelves)
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
    notes:'Into side dados.'+(legCount>0?' Leg mounting holes.':'')});

  // Leg mounting
  if(legCount>0){
    const legPos=computeLegPositions(legCount, btmW, btmD, legMargin);
    const allHoles=[];
    for(const pos of legPos){
      const boltR=legBoltCircle/2;
      for(let h=0;h<legHoleCount;h++){
        const angle=(2*Math.PI*h)/legHoleCount-Math.PI/2;
        allHoles.push({x:pos.x+boltR*Math.cos(angle), y:pos.y+boltR*Math.sin(angle)});
      }
      if(legCenterHole) allHoles.push({x:pos.x, y:pos.y, isCenterHole:true});
    }
    drills.push({partCode:btmCode, opType:'leg_mount',
      dia:legHoleDia, dep:legHoleDepth,
      holes:allHoles.filter(h=>!h.isCenterHole),
      heightStart:0, spacing:0, count:allHoles.filter(h=>!h.isCenterHole).length,
      depthPositions:[0],
      note:legCount+' legs, '+legHoleCount+' holes each'});
    if(legCenterHole){
      drills.push({partCode:btmCode, opType:'leg_center',
        dia:legCenterDia, dep:legHoleDepth,
        holes:allHoles.filter(h=>h.isCenterHole),
        heightStart:0, spacing:0, count:legPos.length,
        depthPositions:[0], note:legCount+' center pilot holes'});
    }
  }

  // ═══ SHELVES ═══
  if(shelfCount>0){
    const shW=shelfType==='fixed'?intW+2*dadoD:intW-1;
    const shD=shelfType==='fixed'?depth-bpt-mt+dadoD:depth-bpt-6;
    const pinDepthPos=[pinInsetF];
    if(pinRowsPerSide>=2) pinDepthPos.push(depth-bpt-pinInsetR);

    for(let si=0;si<shelfCount;si++){
      const shCode=code();
      const label=shelfCount>1?'Shelf '+(si+1):'Adjustable Shelf';
      parts.push({code:shCode,
        name:shelfType==='fixed'?'Fixed Shelf '+(si+1):label,
        partType:shelfType==='fixed'?'fixed_shelf':'adjustable_shelf',
        len:shW,w:shD,t:mt,qty:1,
        notes:shelfType==='fixed'?'In dado'
          :'On pins'+(shelfGrooves?', pin-lock grooves':'')});

      if(shelfGrooves&&shelfType==='adjustable'){
        for(const pinY of pinDepthPos){
          const gy=pinY-grooveWidth/2;
          dados.push({partCode:shCode, opType:'dado', cutW:grooveInset, cutD:grooveDepth,
            fromEdge:'bottom', dist:0, cutLen:grooveWidth, depthStart:gy,
            dxfX:0, dxfY:gy, dxfW:grooveInset, dxfH:grooveWidth,
            note:'Pin-lock groove, left, Y='+Math.round(pinY)});
          dados.push({partCode:shCode, opType:'dado', cutW:grooveInset, cutD:grooveDepth,
            fromEdge:'top', dist:0, cutLen:grooveWidth, depthStart:gy,
            dxfX:shW-grooveInset, dxfY:gy, dxfW:grooveInset, dxfH:grooveWidth,
            note:'Pin-lock groove, right, Y='+Math.round(pinY)});
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
  if(toeKickStyle==='integral'||toeKickStyle==='separate_plinth')
    parts.push({code:code(),name:'Toe Kick Plate',partType:'toe_kick',
      len:intW,w:tkH-mt,t:mt,qty:1,notes:'Recessed '+tkRecess+'mm.'});

  // ═══ DRAWERS ═══
  if(drawers.length>0){
    computeDrawers(cfg, drawers, parts, dados, drills, code, {
      intW, depth, bpt, mt, caseH, bottomPos, sideH,
      drawerSideT, drawerBottomT, drawerSlideClear, drawerSlideType,
      drawerConstruct, drawerFaceType, drawerBtmDadoH, drawerBtmDadoD,
      drawerGap, doorOverlay, doorReveal, dadoAllowance, dmt,
      sidePanelCodes
    });
  }

  // ═══ DOORS ═══
  const dStyleObj=DOOR_STYLES[doorStyle]||DOOR_STYLES.shaker;
  const isRS=dStyleObj.rail>0;
  const drawerPos = cfg.drawerPosition || 'top';

  // Calculate drawer zone height for mixed mode
  const totalDrawerFaceH = drawers.length > 0
    ? drawers.reduce((s,d) => s + (d.faceHeight || 160) + (cfg.drawerGap||3), -(cfg.drawerGap||3))
    : 0;

  // Determine if we should generate a door
  const generateDoor = doorCount > 0 && (
    drawers.length === 0 ||                        // no drawers → full door
    (drawerPos !== 'full' && totalDrawerFaceH < caseH - mt)  // mixed → door in remaining space
  );

  if(generateDoor){
    // Door height: full case if no drawers, otherwise remaining space
    const doorZoneH = drawers.length > 0
      ? caseH - totalDrawerFaceH - (cfg.drawerGap||3)
      : caseH;
    const dH = doorZoneH + 2*doorOverlay - 2*doorReveal;

    if(doorCount===1){
      const dW=width+2*doorOverlay-2*doorReveal;
      if(isRS) addDoorRS(parts,drills,code,dStyleObj,dH,dW,dmt,hingeBoreDia,hingeBoreDepth,hingeBoreFromEdge,'Door',doorStyle);
      else { const dc=code(); parts.push({code:dc,name:'Door',partType:'door',len:dH,w:dW,t:dmt,qty:1,notes:'Full overlay. '+Math.round(doorZoneH)+'mm zone.'}); addHinges(drills,dc,dH,hingeBoreDia,hingeBoreDepth,hingeBoreFromEdge); }
    } else if(doorCount===2){
      const dW=width/2+doorOverlay-doorGap/2-doorReveal;
      for(const label of ['L','R']){
        if(isRS) addDoorRS(parts,drills,code,dStyleObj,dH,dW,dmt,hingeBoreDia,hingeBoreDepth,hingeBoreFromEdge,'Door '+label,doorStyle);
        else { const dc=code(); parts.push({code:dc,name:'Door ('+label+')',partType:'door',len:dH,w:dW,t:dmt,qty:1,notes:doorGap+'mm gap. '+Math.round(doorZoneH)+'mm zone.'}); addHinges(drills,dc,dH,hingeBoreDia,hingeBoreDepth,hingeBoreFromEdge); }
      }
    }
  }

  return {parts,dados,drills,caseH,intW,sideH};
}


// ═══════════════════════════════════════════════════════════════════════════
// SHELF POSITION HELPER
// ═══════════════════════════════════════════════════════════════════════════
function getShelfPositions(count, caseH, mt, customPositions) {
  if(customPositions && customPositions.length>0){
    return customPositions.slice(0, count);
  }
  // Even distribution
  const intH=caseH-2*mt;
  const sp=intH/(count+1);
  const positions=[];
  for(let i=1;i<=count;i++) positions.push(mt+sp*i);
  return positions;
}


// ═══════════════════════════════════════════════════════════════════════════
// DRAWER COMPUTATION
// ═══════════════════════════════════════════════════════════════════════════
//
// Drawer anatomy:
//   ┌────────────────────────────────────┐
//   │          FACE (applied)            │  ← wider than box, overlays cabinet
//   ├────────────────────────────────────┤
//   │ side │                      │ side │  ← box sides
//   │      │       interior       │      │
//   │      │                      │      │
//   │      ├──────────────────────┤      │
//   │      │     bottom panel     │      │  ← in dado at bottom of sides
//   └──────┴──────────────────────┴──────┘
//           │◀── box front/back ──▶│
//
// Construction types affect how front/back/sides join:
//   dado:         sides have dados, front/back slide in
//   box_joint:    interlocking fingers at all corners
//   butt:         sides butt against front/back, screwed
//   dovetail:     angled interlocking joints
//   pocket_screw: hidden pocket screws
//
function computeDrawers(cfg, drawers, parts, dados, drills, code, dims) {
  const {intW, depth, bpt, mt, caseH, bottomPos, sideH,
    drawerSideT, drawerBottomT, drawerSlideClear, drawerSlideType,
    drawerConstruct, drawerFaceType, drawerBtmDadoH, drawerBtmDadoD,
    drawerGap, doorOverlay, doorReveal, dadoAllowance, dmt,
    sidePanelCodes} = dims;

  // Box joint config
  const fingerWidth = cfg.boxJointFingerWidth || 20;   // mm — must accommodate bit radius
  const fingerDepth = drawerSideT;                     // depth = mating piece thickness

  const boxW = intW - 2*drawerSlideClear;
  const boxD = depth - bpt - 20;
  const faceOverlay = doorOverlay || 12;
  const faceW = intW + 2*mt + 2*faceOverlay - 2*(doorReveal||3);

  // Track vertical position of each drawer in the cabinet (from top of bottom panel)
  let drawerStackPos = 0;

  for(let di=0; di<drawers.length; di++){
    const d = drawers[di];
    const boxH  = d.boxHeight || 100;
    const faceH = d.faceHeight || (boxH + drawerGap + 10);
    const idx   = di+1;
    const prefix = 'Drawer '+idx;

    let sideLen=boxD, sideH=boxH;
    let frontLen, frontH=boxH, backLen, backH=boxH;

    switch(drawerConstruct){
      case 'dado':
        frontLen = boxW - 2*drawerSideT + 2*(cfg.dadoDepth||10);
        backLen = frontLen;
        break;
      case 'box_joint':
      case 'dovetail':
        frontLen = boxW;
        backLen = boxW;
        break;
      case 'butt':
      case 'pocket_screw':
      default:
        frontLen = boxW - 2*drawerSideT;
        backLen = frontLen;
        break;
    }

    const btmLen = boxW - 2*drawerSideT + 2*drawerBtmDadoD;
    const btmW = boxD - drawerSideT + drawerBtmDadoD;

    // ─── Side panels ───
    const lsCode = code(), rsCode = code();
    parts.push({code:lsCode, name:prefix+' Side L', partType:'drawer_side_left',
      len:sideLen, w:sideH, t:drawerSideT, qty:1,
      notes:drawerConstruct+(drawerConstruct==='box_joint'?' ('+fingerWidth+'mm fingers)':'')});
    parts.push({code:rsCode, name:prefix+' Side R', partType:'drawer_side_right',
      len:sideLen, w:sideH, t:drawerSideT, qty:1,
      notes:drawerConstruct+(drawerConstruct==='box_joint'?' ('+fingerWidth+'mm fingers)':'')});

    // Bottom dado in each side — HORIZONTAL channel at Y=drawerBtmDadoH
    // Runs full length of side along X axis
    const btmDadoW = drawerBottomT + dadoAllowance;
    for(const sc of [lsCode, rsCode]){
      dados.push({partCode:sc, opType:'dado', cutW:btmDadoW, cutD:drawerBtmDadoD,
        fromEdge:'bottom', dist:drawerBtmDadoH, cutLen:sideLen,
        depthStart:0,
        dxfX:0, dxfY:drawerBtmDadoH, dxfW:sideLen, dxfH:btmDadoW,
        note:prefix+' bottom panel dado — horizontal at Y='+drawerBtmDadoH+'mm'});
    }

    // ─── Construction-specific joinery ───
    if(drawerConstruct==='dado'){
      for(const sc of [lsCode, rsCode]){
        const dadoW2 = drawerSideT + dadoAllowance;
        // Front dado — vertical strip at X=0 (front end of side)
        dados.push({partCode:sc, opType:'dado', cutW:dadoW2, cutD:cfg.dadoDepth||10,
          fromEdge:'front', dist:0, cutLen:sideH,
          depthStart:0,
          dxfX:0, dxfY:0, dxfW:dadoW2, dxfH:sideH,
          note:prefix+' front dado in side'});
        // Back dado — vertical strip at X=sideLen-dadoW2 (back end of side)
        dados.push({partCode:sc, opType:'dado', cutW:dadoW2, cutD:cfg.dadoDepth||10,
          fromEdge:'rear', dist:0, cutLen:sideH,
          depthStart:0,
          dxfX:sideLen-dadoW2, dxfY:0, dxfW:dadoW2, dxfH:sideH,
          note:prefix+' back dado in side'});
      }
    }

    if(drawerConstruct==='box_joint'){
      // Calculate centered finger pattern
      const numFingers = Math.floor(sideH / fingerWidth);
      const usedH = numFingers * fingerWidth;
      const offsetY = (sideH - usedH) / 2;  // center vertically

      // Side pieces: "A" pattern (pockets at even indices) at both ends
      for(const sc of [lsCode, rsCode]){
        for(let f=0; f<numFingers; f++){
          if(f%2===0){
            const fy = offsetY + f * fingerWidth;
            // Front end pocket
            dados.push({partCode:sc, opType:'groove',
              cutW:fingerWidth, cutD:drawerSideT,
              fromEdge:'front', dist:0, cutLen:fingerWidth, depthStart:0,
              dxfX:0, dxfY:fy, dxfW:drawerSideT, dxfH:fingerWidth,
              note:prefix+' box joint, front end, finger '+f});
            // Back end pocket
            dados.push({partCode:sc, opType:'groove',
              cutW:fingerWidth, cutD:drawerSideT,
              fromEdge:'rear', dist:0, cutLen:fingerWidth, depthStart:0,
              dxfX:sideLen-drawerSideT, dxfY:fy, dxfW:drawerSideT, dxfH:fingerWidth,
              note:prefix+' box joint, back end, finger '+f});
          }
        }
      }
    }

    // ═══ FRONT PIECE ═══
    let actualFrontLen = frontLen, actualFrontH = frontH;
    const sideInset = (drawerFaceType==='integrated') ? (faceW - boxW) / 2 : 0;
    if(drawerFaceType==='integrated'){
      actualFrontLen = faceW;
      actualFrontH = faceH;
    }
    const fCode = code();
    parts.push({code:fCode, name:prefix+' Box Front', partType:'drawer_front',
      len:actualFrontLen, w:actualFrontH, t:drawerSideT, qty:1,
      notes:drawerConstruct+(drawerFaceType==='integrated'?' — integrated face':'')
        +(drawerConstruct==='box_joint'?' ('+fingerWidth+'mm fingers)':'')});

    // Bottom dado on front — at Y=drawerBtmDadoH, spanning interior width
    {
      const fdX = (drawerFaceType==='integrated') ? sideInset + drawerSideT : (drawerConstruct==='dado'?0:drawerSideT);
      const fdW = (drawerFaceType==='integrated')
        ? boxW - 2*drawerSideT
        : (drawerConstruct==='dado' ? actualFrontLen : actualFrontLen - 2*drawerSideT);
      dados.push({partCode:fCode, opType:'dado', cutW:btmDadoW, cutD:drawerBtmDadoD,
        fromEdge:'bottom', dist:drawerBtmDadoH, cutLen:fdW, depthStart:0,
        dxfX:fdX, dxfY:drawerBtmDadoH, dxfW:fdW, dxfH:btmDadoW,
        note:prefix+' bottom dado in front'});
    }

    // Box joint on front — pockets at INSET positions where sides connect
    if(drawerConstruct==='box_joint'){
      const numF = Math.floor(sideH / fingerWidth);
      const usedH = numF * fingerWidth;
      const offY = (sideH - usedH) / 2;
      const boxBtmOnFace = (drawerFaceType==='integrated') ? (actualFrontH - sideH) / 2 : 0;

      for(let f=0; f<numF; f++){
        if(f%2===1){
          const fy = boxBtmOnFace + offY + f * fingerWidth;
          dados.push({partCode:fCode, opType:'groove',
            cutW:fingerWidth, cutD:drawerSideT,
            fromEdge:'front', dist:0, cutLen:fingerWidth, depthStart:0,
            dxfX:sideInset, dxfY:fy, dxfW:drawerSideT, dxfH:fingerWidth,
            note:prefix+' box joint, front left connection'});
          dados.push({partCode:fCode, opType:'groove',
            cutW:fingerWidth, cutD:drawerSideT,
            fromEdge:'rear', dist:0, cutLen:fingerWidth, depthStart:0,
            dxfX:actualFrontLen - sideInset - drawerSideT, dxfY:fy, dxfW:drawerSideT, dxfH:fingerWidth,
            note:prefix+' box joint, front right connection'});
        }
      }
    }

    // ═══ BACK PIECE ═══
    const bCode = code();
    parts.push({code:bCode, name:prefix+' Box Back', partType:'drawer_back',
      len:backLen, w:backH, t:drawerSideT, qty:1, notes:drawerConstruct});

    // Bottom dado on back
    {
      const bdX = (drawerConstruct==='dado') ? 0 : drawerSideT;
      const bdW = (drawerConstruct==='dado') ? backLen : backLen - 2*drawerSideT;
      dados.push({partCode:bCode, opType:'dado', cutW:btmDadoW, cutD:drawerBtmDadoD,
        fromEdge:'bottom', dist:drawerBtmDadoH, cutLen:bdW, depthStart:0,
        dxfX:bdX, dxfY:drawerBtmDadoH, dxfW:bdW, dxfH:btmDadoW,
        note:prefix+' bottom dado in back'});
    }

    // Box joint on back (at edges — back is box-width)
    if(drawerConstruct==='box_joint'){
      const numF = Math.floor(backH / fingerWidth);
      const usedH = numF * fingerWidth;
      const offY = (backH - usedH) / 2;
      for(let f=0; f<numF; f++){
        if(f%2===1){
          const fy = offY + f * fingerWidth;
          datos_box_joint_pocket(dados, bCode, prefix+' back', f, fingerWidth, drawerSideT, 0, backLen, fy);
        }
      }
    }

    // ═══ BOTTOM PANEL ═══
    parts.push({code:code(), name:prefix+' Bottom', partType:'drawer_bottom',
      len:btmLen, w:btmW, t:drawerBottomT, qty:1,
      notes:'In dado on all 4 sides, '+drawerBtmDadoH+'mm up'});

    // ═══ SLIDE MOUNTING HOLES ═══
    if(drawerSlideType==='side_mount'){
      const slideMountY = sideH / 2;
      const shCount = 4;
      const shMargin = 30;
      const shSpacing = (sideLen - 2*shMargin) / (shCount - 1);
      for(const sc of [lsCode, rsCode]){
        const holes = [];
        for(let h=0; h<shCount; h++) holes.push({x:shMargin+h*shSpacing, y:slideMountY});
        drills.push({partCode:sc, opType:'slide_mount',
          dia:cfg.slideHoleDia||4, dep:cfg.slideHoleDepth||10,
          holes, heightStart:shMargin, spacing:shSpacing, count:shCount,
          depthPositions:[slideMountY],
          note:prefix+' side-mount slide holes'});
      }
    }

    // ═══ CABINET-SIDE SLIDE HOLES ═══
    // Holes on the cabinet side panels where the slide rail mounts
    if(drawerSlideType==='side_mount' && sidePanelCodes && sidePanelCodes.length>=2){
      // Slide rail center on cabinet side = bottomPos + mt + drawerStackPos + boxH/2
      const slideCenterOnSide = bottomPos + mt + drawerStackPos + boxH / 2;
      const shCount = 4;
      const shMargin = 30;
      const slideDepthRange = depth - bpt - 2*shMargin;
      const shSpacing = slideDepthRange / (shCount - 1);

      for(const spc of sidePanelCodes){
        const holes = [];
        for(let h=0; h<shCount; h++){
          holes.push({x: slideCenterOnSide, y: shMargin + h*shSpacing});
        }
        drills.push({partCode:spc, opType:'slide_mount',
          dia:cfg.slideHoleDia||4, dep:cfg.slideHoleDepth||10,
          holes, heightStart:slideCenterOnSide, spacing:shSpacing, count:shCount,
          depthPositions:[shMargin],
          note:'Cabinet slide holes for '+prefix+' at height '+Math.round(slideCenterOnSide)+'mm'});
      }
    }

    // Update stack position for next drawer
    drawerStackPos += faceH + drawerGap;

    // ═══ FACE ═══
    if(drawerFaceType==='applied'){
      parts.push({code:code(), name:prefix+' Face', partType:'drawer_face',
        len:faceW, w:faceH, t:dmt||18, qty:1,
        notes:'Applied face. Full overlay '+faceOverlay+'mm.'});
    }
  }
}

// Box joint pocket helper for back piece
function datos_box_joint_pocket(dados, partCode, label, fingerIdx, fingerW, sideT, startX, partLen, fy) {
  dados.push({partCode, opType:'groove',
    cutW:fingerW, cutD:sideT,
    fromEdge:'front', dist:0, cutLen:fingerW, depthStart:0,
    dxfX:0, dxfY:fy, dxfW:sideT, dxfH:fingerW,
    note:label+' box joint, left, finger '+fingerIdx});
  dados.push({partCode, opType:'groove',
    cutW:fingerW, cutD:sideT,
    fromEdge:'rear', dist:0, cutLen:fingerW, depthStart:0,
    dxfX:partLen-sideT, dxfY:fy, dxfW:sideT, dxfH:fingerW,
    note:label+' box joint, right, finger '+fingerIdx});
}


// ═══════════════════════════════════════════════════════════════════════════
// LEG PLACEMENT
// ═══════════════════════════════════════════════════════════════════════════
function computeLegPositions(count, panelW, panelD, margin) {
  if(count<=0) return [];
  const x1=margin,x2=panelW-margin,y1=margin,y2=panelD-margin;
  const cx=(x1+x2)/2,cy=(y1+y2)/2;
  if(count===1) return [{x:cx,y:cy}];
  if(count===2) return [{x:cx,y:y1},{x:cx,y:y2}];
  if(count===3) return [{x:x1,y:cy},{x:cx,y:cy},{x:x2,y:cy}];
  const positions=[{x:x1,y:y1},{x:x2,y:y1},{x:x2,y:y2},{x:x1,y:y2}];
  let remaining=count-4;
  if(remaining<=0) return positions;
  if(remaining%2===1){positions.push({x:cx,y:cy});remaining--;}
  if(remaining<=0) return positions;
  const longEdge=panelW>=panelD;
  const edgePairs=longEdge
    ?[{from:{x:x1,y:y1},to:{x:x2,y:y1},fromR:{x:x1,y:y2},toR:{x:x2,y:y2}},
      {from:{x:x1,y:y1},to:{x:x1,y:y2},fromR:{x:x2,y:y1},toR:{x:x2,y:y2}}]
    :[{from:{x:x1,y:y1},to:{x:x1,y:y2},fromR:{x:x2,y:y1},toR:{x:x2,y:y2}},
      {from:{x:x1,y:y1},to:{x:x2,y:y1},fromR:{x:x1,y:y2},toR:{x:x2,y:y2}}];
  for(const pair of edgePairs){
    if(remaining<=0) break;
    const perEdge=Math.min(Math.floor(remaining/2),3);
    for(let i=1;i<=perEdge;i++){
      const t=i/(perEdge+1);
      positions.push({x:pair.from.x+(pair.to.x-pair.from.x)*t, y:pair.from.y+(pair.to.y-pair.from.y)*t});
      positions.push({x:pair.fromR.x+(pair.toR.x-pair.fromR.x)*t, y:pair.fromR.y+(pair.toR.y-pair.fromR.y)*t});
      remaining-=2;
    }
  }
  return positions;
}


// ═══════════════════════════════════════════════════════════════════════════
// DOOR HELPERS
// ═══════════════════════════════════════════════════════════════════════════
function addHinges(drills,partCode,dH,dia,dep,fromEdge){
  drills.push({partCode,opType:'hinge_bore',dia,dep,
    heightStart:80, spacing:dH-160, count:2,
    depthPositions:[fromEdge],
    note:'35mm Forstner, '+fromEdge+'mm from edge'});
}

function addDoorRS(parts,drills,code,style,dH,dW,dmt,hingeDia,hingeDep,hingeEdge,label,styleName){
  const t=10, railLen=dW-2*style.stile+2*t;
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
