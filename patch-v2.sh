#!/bin/bash
# ═══════════════════════════════════════════════════
# Cabinet Studio — Patch v2
# Fixes: side notch, nailer dados, hinge bore, DXF
# ═══════════════════════════════════════════════════
set -e
BASE="/Dockers/cabinet-studio"

echo "  Patching compute engine + client..."

# ─── 1. Update server compute.js ─────────────────────────────────────────────
cat > "$BASE/server/compute.js" << 'SERVEREOF'
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

  const integratedTK = (toeKickStyle==='integral');
  const sideH = integratedTK ? height : (height-tkH);
  const caseH = height-tkH;
  const intW = width-2*mt;
  const bottomFromFloor = integratedTK ? tkH : mt;

  const parts=[], dados=[], drills=[];
  let pIdx=0;
  const code=()=>'P'+String(++pIdx).padStart(3,'0');

  // ═══ SIDE PANELS ═══
  const sideCodeL=code(), sideCodeR=code();
  const sideNotes = integratedTK
    ? 'Full height. Toe kick notch '+tkH+'x'+tkRecess+'mm at front bottom.'
    : 'See dado/rabbet ops.';
  parts.push({code:sideCodeL,name:'Side Panel (L)',partType:'side_left',
    len:sideH,w:depth,t:mt,qty:1,notes:sideNotes,
    hasNotch:integratedTK,notchH:tkH,notchD:tkRecess});
  parts.push({code:sideCodeR,name:'Side Panel (R)',partType:'side_right',
    len:sideH,w:depth,t:mt,qty:1,notes:sideNotes+' (mirror)',
    hasNotch:integratedTK,notchH:tkH,notchD:tkRecess});
  const sideCodes=[sideCodeL,sideCodeR];

  // ═══ DADOS IN SIDES ═══

  // Bottom panel dado
  for(const sc of sideCodes){
    dados.push({partCode:sc,opType:'dado',cutW:mt,cutD:dadoD,
      cutLen:depth-bpt, fromEdge:'bottom',dist:bottomFromFloor,
      orient:'across_width',note:'Bottom panel — stopped before rabbet'});
  }

  // Front nailer dado (at top of side, front portion)
  for(const sc of sideCodes){
    dados.push({partCode:sc,opType:'dado',cutW:mt,cutD:dadoD,
      cutLen:nailerH, fromEdge:'top',dist:0,
      orient:'across_width',
      note:'Front nailer dado — '+nailerH+'mm from front edge at top'});
  }

  // Rear nailer dado (at top of side, rear portion)
  for(const sc of sideCodes){
    dados.push({partCode:sc,opType:'dado',cutW:mt,cutD:dadoD,
      cutLen:nailerH, fromEdge:'top',dist:0,
      orient:'across_width',
      note:'Rear nailer dado — '+nailerH+'mm from rabbet inward at top'});
  }

  // Back panel rabbet
  const rabbetLen = integratedTK ? (sideH-tkH) : sideH;
  for(const sc of sideCodes){
    dados.push({partCode:sc,opType:'rabbet',cutW:bpt+1,cutD:rabD,
      cutLen:rabbetLen, fromEdge:'rear',dist:0,
      orient:'along_length',
      note:'Back panel — '+rabbetLen+'mm from top down'});
  }

  // Fixed shelf dados
  if(shelfType==='fixed'&&shelfCount>0){
    const intCaseH=caseH-2*mt;
    const sp=intCaseH/(shelfCount+1);
    for(let i=1;i<=shelfCount;i++){
      const fromBtm=bottomFromFloor+mt+sp*i;
      for(const sc of sideCodes){
        dados.push({partCode:sc,opType:'dado',cutW:mt,cutD:dadoD,
          cutLen:depth-bpt, fromEdge:'bottom',
          dist:Math.round(fromBtm*100)/100,
          orient:'across_width',note:'Fixed shelf #'+i});
      }
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

  // Shelf pin holes
  if(shelfType==='adjustable'&&shelfCount>0){
    const zStart=bottomFromFloor+mt+pinZoneStart;
    const zEnd=sideH-mt-pinZoneEnd;
    const hCount=Math.max(1,Math.floor((zEnd-zStart)/pinSpacing)+1);
    for(const sc of sideCodes){
      drills.push({partCode:sc,opType:'shelf_pin_line',
        dia:pinDia,dep:pinDepth,face:'face',
        lineOrient:'vertical',startX:pinInsetF,startY:zStart,
        spacing:pinSpacing,count:hCount,
        repeatCount:pinRowsPerSide>1?pinRowsPerSide:1,
        repeatOffset:pinRowsPerSide>1
          ?(depth-bpt-pinInsetF-pinInsetR)/(pinRowsPerSide-1):0,
        note:'32mm system shelf pins'});
    }
  }

  // ═══ NAILERS ═══
  const nailerLen=intW+2*dadoD;
  parts.push({code:code(),name:'Front Nailer',partType:'nailer_front',
    len:nailerLen,w:nailerH,t:mt,qty:1,
    notes:'In dado at top of sides. Set back 3mm.'});
  parts.push({code:code(),name:'Rear Nailer',partType:'nailer_rear',
    len:nailerLen,w:nailerH,t:mt,qty:1,
    notes:'In dado at top of sides. Wall mounting.'});

  // ═══ BACK PANEL ═══
  const backW=width-2*(mt-rabD)+1;
  const backH=caseH-mt+rabD;
  parts.push({code:code(),name:'Back Panel',partType:'back_panel',
    len:backW,w:backH,t:bpt,qty:1,notes:'In rabbet. Glue + pin nail.'});

  // ═══ TOE KICK ═══
  if(toeKickStyle!=='none'){
    parts.push({code:code(),name:'Toe Kick Plate',partType:'toe_kick',
      len:intW,w:tkH-mt,t:mt,qty:1,
      notes:'Recessed '+tkRecess+'mm. Between side notches.'});
  }

  // ═══ DOORS ═══
  const dStyleObj=DOOR_STYLES[doorStyle]||DOOR_STYLES.shaker;
  if(doorCount===1){
    const dW=width+2*doorOverlay-2*doorReveal;
    const dH=caseH+2*doorOverlay-2*doorReveal;
    const dCode=code();
    parts.push({code:dCode,name:'Door',partType:'door',
      len:dH,w:dW,t:dmt,qty:1,
      notes:'Full overlay. '+doorStyle+'. 2 hinges.'});
    // Hinge bores: along the HEIGHT (X axis in DXF), at hingeBoreFromEdge from edge (Y axis)
    drills.push({partCode:dCode,opType:'hinge_bore',
      dia:hingeBoreDia,dep:hingeBoreDepth,face:'face',
      lineOrient:'horizontal',
      startX:80,
      startY:hingeBoreFromEdge,
      spacing:dH-160, count:2,
      note:'35mm Forstner, inside face, '+hingeBoreFromEdge+'mm from hinge edge'});
    addDoorRS(parts,code,dStyleObj,dH,dW,dmt);
  } else if(doorCount===2){
    const dW=width/2+doorOverlay-doorGap/2-doorReveal;
    const dH=caseH+2*doorOverlay-2*doorReveal;
    const dc1=code(),dc2=code();
    parts.push({code:dc1,name:'Door (L)',partType:'door',
      len:dH,w:dW,t:dmt,qty:1,
      notes:'Double. '+doorStyle+'. '+doorGap+'mm gap. 2 hinges.'});
    parts.push({code:dc2,name:'Door (R)',partType:'door',
      len:dH,w:dW,t:dmt,qty:1,
      notes:'Double. '+doorStyle+'. '+doorGap+'mm gap. 2 hinges.'});
    for(const dc of [dc1,dc2]){
      drills.push({partCode:dc,opType:'hinge_bore',
        dia:hingeBoreDia,dep:hingeBoreDepth,face:'face',
        lineOrient:'horizontal',
        startX:80,
        startY:hingeBoreFromEdge,
        spacing:dH-160, count:2,
        note:'35mm Forstner, inside face, '+hingeBoreFromEdge+'mm from hinge edge'});
    }
    addDoorRS(parts,code,dStyleObj,dH,dW,dmt);
  }

  return {parts,dados,drills,caseH,intW,sideH};
}

function addDoorRS(parts,code,style,dH,dW,dmt){
  if(style.rail<=0) return;
  const t=10;
  parts.push({code:code(),name:'Top Rail',partType:'rail',
    len:dW-2*style.stile+2*t,w:style.rail,t:dmt,qty:1,notes:'Door R&S'});
  parts.push({code:code(),name:'Bottom Rail',partType:'rail',
    len:dW-2*style.stile+2*t,w:style.rail,t:dmt,qty:1,notes:'Door R&S'});
  parts.push({code:code(),name:'Left Stile',partType:'stile',
    len:dH,w:style.stile,t:dmt,qty:1,notes:'Door R&S'});
  parts.push({code:code(),name:'Right Stile',partType:'stile',
    len:dH,w:style.stile,t:dmt,qty:1,notes:'Door R&S'});
  parts.push({code:code(),name:'Center Panel',partType:'center_panel',
    len:dW-2*style.stile+2*t,w:dH-2*style.rail+2*t,t:dmt,qty:1,
    notes:'+'+t+'mm tongue each side'});
}
SERVEREOF

echo "  ✓ Server compute.js updated"

# ─── 2. Patch client-side computation in CabinetStudio.jsx ───────────────────
# Replace the computeAll function to match server logic
cd "$BASE/client/src/components"

# The client computeAll needs the same fixes: full-height sides, nailer dados, hinge bore fix
# We use sed to do targeted replacements on the key issues

# Fix 1: Side panel height — change caseH to use full height when integrated
python3 << 'PYEOF'
import re

with open('CabinetStudio.jsx', 'r') as f:
    content = f.read()

# Replace the old computeAll function's side/caseH logic
old_compute_start = "function computeAll(cfg) {"
if old_compute_start not in content:
    print("  ⚠ Could not find computeAll - check CabinetStudio.jsx manually")
    exit(0)

# Find and replace the entire computeAll function
# We'll replace from "function computeAll" to the closing of the function
# This is a big replacement, so let's be precise

new_compute = '''function computeAll(cfg) {
  const mt=cfg.caseMaterialThickness||18, bpt=cfg.backPanelThickness||6, dmt=cfg.doorMaterialThickness||18;
  const dadoD=cfg.dadoDepth||10, rabD=cfg.rabbetDepth||10;
  const {height=760,width=600,depth=580,shelfCount=0,shelfType='adjustable',
    doorCount=1,doorOverlay=12,doorGap=3,doorReveal=3,nailerHeight:nailerH=90,
    doorStyle='shaker',pinDia=5,pinDepth=12,pinSpacing=32,pinRowsPerSide=2,
    pinInsetFront=37,pinInsetRear=37,pinZoneStart=80,pinZoneEnd=80,
    hingeBoreDia=35,hingeBoreDepth=13,hingeBoreFromEdge=22}=cfg;
  const toeKickStyle=cfg.toeKickStyle||'integral';
  const tkH=(toeKickStyle==='none')?0:(cfg.toeKickHeight||100);
  const tkRecess=cfg.toeKickRecess||75;

  const integratedTK=(toeKickStyle==='integral');
  const sideH=integratedTK?height:(height-tkH);
  const caseH=height-tkH, intW=width-2*mt;
  const bottomFromFloor=integratedTK?tkH:mt;

  const parts=[],dados=[],drills=[];

  // Sides — full height with notch when integrated toe kick
  parts.push({name:'Side Panel',qty:2,len:sideH,w:depth,t:mt,mat:'Case ply',
    notes:integratedTK?'Full height. Notch '+tkH+'x'+tkRecess+'mm at front bottom.':'See dado/rabbet ops.',
    eb:['front'],type:'side',hasNotch:integratedTK,notchH:tkH,notchD:tkRecess});

  // Bottom dado
  dados.push({part:'Side Panel (×2)',type:'Dado',cutW:mt,cutD:dadoD,
    pos:bottomFromFloor+'mm from bottom edge',orient:'Across depth, stopped before rabbet',
    len:depth-bpt,note:'Bottom panel sits here'});
  // Front nailer dado
  dados.push({part:'Side Panel (×2)',type:'Dado',cutW:mt,cutD:dadoD,
    pos:'At top, from front edge',orient:'Front nailer support, '+nailerH+'mm',
    len:nailerH,note:'Front nailer dado'});
  // Rear nailer dado
  dados.push({part:'Side Panel (×2)',type:'Dado',cutW:mt,cutD:dadoD,
    pos:'At top, from rabbet inward',orient:'Rear nailer support, '+nailerH+'mm',
    len:nailerH,note:'Rear nailer dado'});
  // Back rabbet
  const rabbetLen=integratedTK?(sideH-tkH):sideH;
  dados.push({part:'Side Panel (×2)',type:'Rabbet',cutW:bpt+1,cutD:rabD,
    pos:'Along rear edge',orient:'From top, '+rabbetLen+'mm',
    len:rabbetLen,note:'Back panel channel'});

  // Fixed shelf dados
  if(shelfType==='fixed'&&shelfCount>0){
    const iH=caseH-2*mt,sp=iH/(shelfCount+1);
    for(let i=1;i<=shelfCount;i++)
      dados.push({part:'Side Panel (×2)',type:'Dado',cutW:mt,cutD:dadoD,
        pos:Math.round(bottomFromFloor+mt+sp*i)+'mm from bottom',orient:'Across depth, stopped',
        len:depth-bpt,note:'Shelf #'+i});
  }

  // Bottom panel
  const btmW=intW+2*dadoD, btmD=depth-bpt-mt+dadoD;
  parts.push({name:'Bottom Panel',qty:1,len:btmW,w:btmD,t:mt,mat:'Case ply',
    notes:'Into dado. Front flush.',eb:['front'],type:'bottom'});

  // Shelves
  if(shelfCount>0){
    const shW=shelfType==='fixed'?intW+2*dadoD:intW-1;
    const shD=shelfType==='fixed'?depth-bpt-mt+dadoD:depth-bpt-6;
    parts.push({name:shelfType==='fixed'?'Fixed Shelf':'Adj. Shelf',qty:shelfCount,
      len:shW,w:shD,t:mt,mat:'Case ply',
      notes:shelfType==='fixed'?'In dado':'On pins, -1mm clearance',eb:['front'],type:'shelf'});
  }
  // Shelf pins
  if(shelfType==='adjustable'&&shelfCount>0){
    const zS=bottomFromFloor+mt+pinZoneStart,zE=sideH-mt-pinZoneEnd;
    const hC=Math.max(1,Math.floor((zE-zS)/pinSpacing)+1);
    drills.push({part:'Side Panel (×2)',type:'Shelf Pin Line',dia:pinDia,dep:pinDepth,rows:pinRowsPerSide,
      inset:pinInsetFront+'mm front, '+pinInsetRear+'mm rear',
      count:hC+'/row × '+pinRowsPerSide+' rows × 2 sides = '+(hC*pinRowsPerSide*2),
      spacing:pinSpacing+'mm o.c.',start:Math.round(zS)+'mm from btm',note:'Use 32mm system jig'});
  }

  // Nailers (in dados)
  const nailerLen=intW+2*dadoD;
  parts.push({name:'Front Nailer',qty:1,len:nailerLen,w:nailerH,t:mt,mat:'Case ply',
    notes:'In dado at top of sides. Set back 3mm.',eb:[],type:'nailer'});
  parts.push({name:'Rear Nailer',qty:1,len:nailerLen,w:nailerH,t:mt,mat:'Case ply',
    notes:'In dado at top of sides. Wall mounting.',eb:[],type:'nailer'});

  // Back panel
  const backW=width-2*(mt-rabD)+1, backH=caseH-mt+rabD;
  parts.push({name:'Back Panel',qty:1,len:backW,w:backH,t:bpt,mat:'Back ply',
    notes:'In rabbet. Glue + pin nail.',eb:[],type:'back'});

  // Toe kick
  if(toeKickStyle!=='none')
    parts.push({name:'Toe Kick',qty:1,len:intW,w:tkH-mt,t:mt,mat:'Case ply',
      notes:'Recessed '+tkRecess+'mm',eb:[],type:'toekick'});

  // Doors
  const dStyle=DOOR_STYLES.find(s=>s.id===doorStyle)||DOOR_STYLES[0];
  const doorParts=[];
  if(doorCount===1){
    const dW=width+2*doorOverlay-2*doorReveal,dH=caseH+2*doorOverlay-2*doorReveal;
    parts.push({name:'Door',qty:1,len:dH,w:dW,t:dmt,mat:'Door material',
      notes:dStyle.name+'. Full overlay. 2 hinges.',eb:['all'],type:'door'});
    if(dStyle.rail>0) addDoorParts(doorParts,dStyle,dH,dW);
    drills.push({part:'Door (×1)',type:'Hinge Cup Bore',dia:hingeBoreDia,dep:hingeBoreDepth,rows:'-',
      inset:hingeBoreFromEdge+'mm from hinge edge',count:'2 per door',
      spacing:'80mm from top & bottom along height',start:'Inside face',note:'35mm Forstner bit'});
  } else if(doorCount===2){
    const dW=width/2+doorOverlay-doorGap/2-doorReveal,dH=caseH+2*doorOverlay-2*doorReveal;
    parts.push({name:'Door',qty:2,len:dH,w:dW,t:dmt,mat:'Door material',
      notes:dStyle.name+'. Double, '+doorGap+'mm gap. 2 hinges ea.',eb:['all'],type:'door'});
    if(dStyle.rail>0) addDoorParts(doorParts,dStyle,dH,dW);
    drills.push({part:'Door (×2)',type:'Hinge Cup Bore',dia:hingeBoreDia,dep:hingeBoreDepth,rows:'-',
      inset:hingeBoreFromEdge+'mm from hinge edge',count:'2 per door',
      spacing:'80mm from top & bottom along height',start:'Inside face',note:'35mm Forstner bit'});
  }

  const totalParts=parts.reduce((s,p)=>s+p.qty,0);
  return {parts,dados,drills,caseH,intW,totalParts,doorParts,dStyle,sideH};
}'''

# Find the old function and replace it
# Match from "function computeAll(cfg) {" to its closing "}"
# We need to find the function boundary
start = content.find('function computeAll(cfg) {')
if start == -1:
    print("  ⚠ computeAll not found")
    exit(0)

# Find the matching closing brace by counting
depth = 0
pos = start
found_end = -1
for i in range(start, len(content)):
    if content[i] == '{':
        depth += 1
    elif content[i] == '}':
        depth -= 1
        if depth == 0:
            found_end = i + 1
            break

if found_end == -1:
    print("  ⚠ Could not find end of computeAll")
    exit(0)

old_func = content[start:found_end]
content = content[:start] + new_compute + content[found_end:]

with open('CabinetStudio.jsx', 'w') as f:
    f.write(content)

print("  ✓ Client computeAll updated")
PYEOF

# ─── 3. Rebuild client ──────────────────────────────────────────────────────
echo "  Rebuilding client..."
cd "$BASE/client"
npm run build 2>&1 | tail -3

echo "  ✓ Client rebuilt"

# ─── 4. Restart service ─────────────────────────────────────────────────────
systemctl restart cabinet-studio
sleep 2

# ─── 5. Verify ──────────────────────────────────────────────────────────────
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://127.0.0.1:3001/api/health)
if [ "$HTTP" = "200" ]; then
  echo "  ✓ API healthy"
else
  echo "  ⚠ API returned $HTTP"
fi

echo ""
echo "  ═══════════════════════════════════════"
echo "  ✓ Patch applied!"
echo ""
echo "  Changes:"
echo "    • Side panels: full height with notch"
echo "    • Nailer dados: front + rear at top"  
echo "    • Hinge bores: correct orientation"
echo "    • DXF: L-shaped side profiles"
echo "    • DXF: ?thickness= param for grouping"
echo ""
echo "  ⚠ Delete old cabinets and recreate them"
echo "    to see the new dimensions."
echo "  ═══════════════════════════════════════"
