import { useState, useEffect, useMemo, useCallback, useRef } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// DOOR STYLES
// ═══════════════════════════════════════════════════════════════════════════
const DOOR_STYLES = [
  { id:'slab', name:'Slab', desc:'Flat panel, clean modern look', rail:0, stile:0, panelType:'flat' },
  { id:'shaker', name:'Shaker', desc:'Recessed flat panel, square frame', rail:65, stile:65, panelType:'flat_recessed' },
  { id:'raised_panel', name:'Raised Panel', desc:'Beveled center panel, traditional', rail:70, stile:70, panelType:'raised' },
  { id:'flat_panel', name:'Flat Panel R&S', desc:'Rail & stile, flush flat panel', rail:60, stile:60, panelType:'flat_flush' },
  { id:'glass_front', name:'Glass Front', desc:'Rail & stile with glass insert', rail:55, stile:55, panelType:'glass' },
  { id:'cathedral', name:'Cathedral Arch', desc:'Arched top rail, raised panel', rail:75, stile:65, panelType:'arch_raised' },
  { id:'beadboard', name:'Beadboard', desc:'Vertical beaded planks in frame', rail:55, stile:55, panelType:'beadboard' },
  { id:'mullion', name:'Mullion Glass', desc:'Divided glass panes in frame', rail:55, stile:55, panelType:'mullion' },
  { id:'louvered', name:'Louvered', desc:'Angled horizontal slats', rail:60, stile:60, panelType:'louver' },
  { id:'board_batten', name:'Board & Batten', desc:'Vertical boards with battens', rail:0, stile:0, panelType:'board_batten' },
];

const DEFAULT_CONFIG = {
  cabinetType:'base', construction:'frameless',
  height:760, width:600, depth:580,
  caseMaterialThickness:18, backPanelThickness:6, doorMaterialThickness:18,
  dadoDepth:10, dadoWidth:18, rabbetDepth:10, rabbetWidth:6,
  dadoAllowance:0.2,
  toeKickHeight:100, toeKickRecess:75, toeKickStyle:'integral',
  shelfCount:1, shelfType:'adjustable', shelfSetback:5,
  pinDia:5, pinDepth:12, pinSpacing:32, pinRowsPerSide:2,
  pinInsetFront:37, pinInsetRear:37, pinZoneStart:80, pinZoneEnd:80,
  doorCount:1, doorStyle:'shaker', doorOverlay:12, doorGap:3, doorReveal:3,
  drawerCount:0, nailerHeight:90, nailerCount:2,
  hingeBoreDia:35, hingeBoreDepth:13, hingeBoreFromEdge:22,
  handleType:'pull', handleLength:128,
  legCount:0, legMargin:100, legHoleCount:4, legHoleDia:4,
  legBoltCircle:45, legHoleDepth:12, legCenterHole:false, legCenterDia:5,
  shelfGrooves:true, shelfGrooveWidth:10, shelfGrooveDepth:10, shelfGrooveInset:12,
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPUTATION ENGINE (client-side, mirrors server compute.js)
// ═══════════════════════════════════════════════════════════════════════════
function computeAll(cfg) {
  const mt=cfg.caseMaterialThickness||18, bpt=cfg.backPanelThickness||6, dmt=cfg.doorMaterialThickness||18;
  const dadoD=cfg.dadoDepth||10, rabD=cfg.rabbetDepth||10;
  const tkH=(cfg.toeKickStyle==='none')?0:(cfg.toeKickHeight||100);
  const {height=760,width=600,depth=580,shelfCount=0,shelfType='adjustable',
    doorCount=1,doorOverlay=12,doorGap=3,doorReveal=3,nailerHeight:nailerH=90,
    doorStyle='shaker',pinDia=5,pinDepth=12,pinSpacing=32,pinRowsPerSide=2,
    pinInsetFront=37,pinInsetRear=37,pinZoneStart=80,pinZoneEnd=80,
    hingeBoreDia=35,hingeBoreDepth=13,hingeBoreFromEdge=22}=cfg;

  const caseH=height-tkH, intW=width-2*mt;
  const parts=[],dados=[],drills=[];

  // Sides
  parts.push({name:'Side Panel',qty:2,len:caseH,w:depth,t:mt,mat:'Case ply',notes:'Left & Right. See dado/rabbet ops.',eb:['front'],type:'side'});
  dados.push({part:'Side Panel (×2)',type:'Dado',cutW:mt,cutD:dadoD,pos:`${mt}mm from bottom edge`,orient:'Across depth, stopped before rabbet',len:depth-bpt,note:'Bottom panel sits here'});
  dados.push({part:'Side Panel (×2)',type:'Rabbet',cutW:bpt+1,cutD:rabD,pos:'Along rear edge',orient:'Full height',len:caseH,note:'Back panel channel'});

  // Bottom
  const btmW=intW+2*dadoD, btmD=depth-bpt-mt+dadoD;
  parts.push({name:'Bottom Panel',qty:1,len:btmW,w:btmD,t:mt,mat:'Case ply',notes:'Into dado. Front flush.',eb:['front'],type:'bottom'});

  // Shelves
  if(shelfCount>0){
    const shW=shelfType==='fixed'?intW+2*dadoD:intW-1;
    const shD=shelfType==='fixed'?depth-bpt-mt+dadoD:depth-bpt-6;
    parts.push({name:shelfType==='fixed'?'Fixed Shelf':'Adj. Shelf',qty:shelfCount,len:shW,w:shD,t:mt,
      mat:'Case ply',notes:shelfType==='fixed'?'In dado':'On pins, -1mm clearance',eb:['front'],type:'shelf'});
    if(shelfType==='fixed'){
      const iH=caseH-2*mt,sp=iH/(shelfCount+1);
      for(let i=1;i<=shelfCount;i++)
        dados.push({part:'Side Panel (×2)',type:'Dado',cutW:mt,cutD:dadoD,pos:`${Math.round(mt+sp*i)}mm from bottom`,orient:'Across depth, stopped',len:depth-bpt,note:`Shelf #${i}`});
    }
  }
  // Shelf pins
  if(shelfType==='adjustable'&&shelfCount>0){
    const zS=pinZoneStart+mt, zE=caseH-pinZoneEnd-mt;
    const hC=Math.floor((zE-zS)/pinSpacing)+1;
    drills.push({part:'Side Panel (×2)',type:'Shelf Pin Line',dia:pinDia,dep:pinDepth,rows:pinRowsPerSide,
      inset:`${pinInsetFront}mm front, ${pinInsetRear}mm rear`,count:`${hC}/row × ${pinRowsPerSide} rows × 2 sides = ${hC*pinRowsPerSide*2}`,
      spacing:`${pinSpacing}mm o.c.`,start:`${Math.round(zS)}mm from btm`,note:'Use 32mm system jig'});
  }

  // Nailers
  parts.push({name:'Front Nailer',qty:1,len:intW,w:nailerH,t:mt,mat:'Case ply',notes:'Top front, set back 3mm',eb:[],type:'nailer'});
  parts.push({name:'Rear Nailer',qty:1,len:intW,w:nailerH,t:mt,mat:'Case ply',notes:'Top rear, for wall mount',eb:[],type:'nailer'});

  // Back panel
  const backW=width-2*(mt-rabD)+1, backH=caseH-2*(mt-rabD)+1;
  parts.push({name:'Back Panel',qty:1,len:backW,w:backH,t:bpt,mat:'Back ply',notes:'In rabbet. Glue + pin nail.',eb:[],type:'back'});

  // Toe kick
  if(cfg.toeKickStyle!=='none')
    parts.push({name:'Toe Kick',qty:1,len:intW,w:tkH-mt,t:mt,mat:'Case ply',notes:`Recessed ${cfg.toeKickRecess||75}mm`,eb:[],type:'toekick'});

  // Doors
  const dStyle=DOOR_STYLES.find(s=>s.id===doorStyle)||DOOR_STYLES[0];
  const doorParts=[];
  if(doorCount===1){
    const dW=width+2*doorOverlay-2*doorReveal,dH=caseH+2*doorOverlay-2*doorReveal;
    parts.push({name:'Door',qty:1,len:dH,w:dW,t:dmt,mat:'Door material',notes:`${dStyle.name}. Full overlay. 2 hinges.`,eb:['all'],type:'door'});
    if(dStyle.rail>0){addDoorParts(doorParts,dStyle,dH,dW);}
    drills.push({part:'Door (×1)',type:'Hinge Cup Bore',dia:hingeBoreDia,dep:hingeBoreDepth,rows:'-',
      inset:`${hingeBoreFromEdge}mm from hinge edge`,count:'2 per door',spacing:'~80mm from top & bottom',start:'Inside face',note:'35mm Forstner bit'});
  } else if(doorCount===2){
    const dW=width/2+doorOverlay-doorGap/2-doorReveal,dH=caseH+2*doorOverlay-2*doorReveal;
    parts.push({name:'Door',qty:2,len:dH,w:dW,t:dmt,mat:'Door material',notes:`${dStyle.name}. Double, ${doorGap}mm gap. 2 hinges ea.`,eb:['all'],type:'door'});
    if(dStyle.rail>0){addDoorParts(doorParts,dStyle,dH,dW);}
    drills.push({part:'Door (×2)',type:'Hinge Cup Bore',dia:hingeBoreDia,dep:hingeBoreDepth,rows:'-',
      inset:`${hingeBoreFromEdge}mm from hinge edge`,count:'2 per door',spacing:'~80mm from top & bottom',start:'Inside face',note:'35mm Forstner bit'});
  }

  const totalParts=parts.reduce((s,p)=>s+p.qty,0);
  return {parts,dados,drills,caseH,intW,totalParts,doorParts,dStyle};
}

function addDoorParts(arr,style,dH,dW){
  const t=10;
  arr.push({name:'Top Rail',w:dW-2*style.stile+2*t,h:style.rail});
  arr.push({name:'Bottom Rail',w:dW-2*style.stile+2*t,h:style.rail});
  arr.push({name:'Left Stile',w:style.stile,h:dH});
  arr.push({name:'Right Stile',w:style.stile,h:dH});
  arr.push({name:'Center Panel',w:dW-2*style.stile+2*t,h:dH-2*style.rail+2*t,note:'+10mm tongue each side'});
}

// ═══════════════════════════════════════════════════════════════════════════
// DOOR STYLE THUMBNAIL SVG
// ═══════════════════════════════════════════════════════════════════════════
function DoorStyleThumb({style,size=56}){
  const s=size,p=4,iw=s-2*p,ih=s*1.4-2*p;
  const r=style.rail?(style.rail/75)*12:0, st=style.stile?(style.stile/75)*10:0;
  const pw=iw-2*st, ph=ih-2*r;
  const panel=()=>{
    switch(style.panelType){
      case 'flat':return null;
      case 'flat_recessed':return <rect x={p+st} y={p+r} width={pw} height={ph} fill="#4a3d2e" stroke="#5a4e3a" strokeWidth=".8"/>;
      case 'raised':return <><rect x={p+st} y={p+r} width={pw} height={ph} fill="#4a3d2e" stroke="#5a4e3a" strokeWidth=".8"/>
        <rect x={p+st+6} y={p+r+6} width={pw-12} height={ph-12} fill="#564838" stroke="#5a4e3a" strokeWidth=".5"/></>;
      case 'flat_flush':return <rect x={p+st} y={p+r} width={pw} height={ph} fill="#3d3225" stroke="#5a4e3a" strokeWidth=".5" strokeDasharray="2 1"/>;
      case 'glass':return <rect x={p+st+3} y={p+r+3} width={pw-6} height={ph-6} fill="rgba(140,180,220,.15)" stroke="rgba(140,180,220,.4)" strokeWidth=".8" rx="1"/>;
      case 'arch_raised':return <path d={`M${p+st},${p+r+15} Q${p+iw/2},${p+r-5} ${p+st+pw},${p+r+15} L${p+st+pw},${p+r+ph} L${p+st},${p+r+ph} Z`} fill="#4a3d2e" stroke="#5a4e3a" strokeWidth=".8"/>;
      case 'beadboard':{const ls=[];const g=pw/6;for(let i=1;i<6;i++) ls.push(<line key={i} x1={p+st+g*i} y1={p+r+2} x2={p+st+g*i} y2={p+r+ph-2} stroke="#5a4e3a" strokeWidth=".5"/>);
        return <><rect x={p+st} y={p+r} width={pw} height={ph} fill="#4a3d2e" stroke="#5a4e3a" strokeWidth=".8"/>{ls}</>;}
      case 'mullion':return <><rect x={p+st+3} y={p+r+3} width={pw-6} height={ph-6} fill="rgba(140,180,220,.12)" stroke="rgba(140,180,220,.4)" strokeWidth=".7" rx="1"/>
        <line x1={p+st+pw/2} y1={p+r+3} x2={p+st+pw/2} y2={p+r+ph-3} stroke="#5a4e3a" strokeWidth="1.2"/>
        <line x1={p+st+3} y1={p+r+ph/2} x2={p+st+pw-3} y2={p+r+ph/2} stroke="#5a4e3a" strokeWidth="1.2"/></>;
      case 'louver':{const ls=[];const cnt=Math.floor(ph/5);for(let i=1;i<cnt;i++) ls.push(<line key={i} x1={p+st+3} y1={p+r+i*(ph/cnt)} x2={p+st+pw-3} y2={p+r+i*(ph/cnt)-1.5} stroke="#5a4e3a" strokeWidth=".6"/>);
        return <><rect x={p+st} y={p+r} width={pw} height={ph} fill="#4a3d2e" stroke="#5a4e3a" strokeWidth=".8"/>{ls}</>;}
      case 'board_batten':{const ls=[];const bw=iw/4;for(let i=1;i<4;i++) ls.push(<rect key={i} x={p+bw*i-1.5} y={p+2} width={3} height={ih-4} fill="#564838" stroke="#5a4e3a" strokeWidth=".3"/>);return ls;}
      default:return null;
    }
  };
  return <svg viewBox={`0 0 ${s} ${s*1.4}`} width={s} height={s*1.4}><rect x={p} y={p} width={iw} height={ih} fill="#3d3225" stroke="#5a4e3a" strokeWidth="1" rx="1"/>{panel()}</svg>;
}

// ═══════════════════════════════════════════════════════════════════════════
// FRONT VIEW SVG
// ═══════════════════════════════════════════════════════════════════════════
function FrontView({cfg,caseH,showDoors}){
  const {width,height,caseMaterialThickness:mt,toeKickHeight,toeKickRecess,
    doorCount,doorOverlay,doorGap,doorReveal,shelfCount,shelfType,nailerHeight,toeKickStyle}=cfg;
  const vw=380,vh=420,pad=50;
  const tkH=toeKickStyle==='none'?0:toeKickHeight;
  const scale=Math.min((vw-2*pad)/width,(vh-2*pad)/height);
  const s=v=>v*scale;
  const ox=(vw-s(width))/2,oy=(vh-s(height))/2;
  const dStyle=DOOR_STYLES.find(d=>d.id===cfg.doorStyle)||DOOR_STYLES[0];
  const intH=caseH-2*mt;const shelves=[];
  if(shelfCount>0){const sp=intH/(shelfCount+1);for(let i=1;i<=shelfCount;i++) shelves.push(mt+sp*i);}

  return(
    <svg viewBox={`0 0 ${vw} ${vh}`} style={{width:'100%',maxWidth:400,display:'block',margin:'0 auto'}}>
      <defs><marker id="arr" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
        <path d="M0,1L6,3L0,5" fill="none" stroke="#8a7e6a" strokeWidth=".8"/></marker></defs>
      <text x={vw/2} y={16} textAnchor="middle" fill="#8a7e6a" fontSize="10" fontFamily="inherit" letterSpacing="1.5">FRONT VIEW</text>
      {toeKickStyle!=='none'&&<rect x={ox+s(mt)+s(toeKickRecess)} y={oy+s(caseH)} width={s(width-2*mt-2*toeKickRecess)} height={s(tkH)} fill="#252119" stroke="#4a4030" strokeWidth=".8"/>}
      <rect x={ox} y={oy} width={s(mt)} height={s(caseH)} fill="#3a2e22" stroke="#4a4030" strokeWidth="1.2"/>
      <rect x={ox+s(width-mt)} y={oy} width={s(mt)} height={s(caseH)} fill="#3a2e22" stroke="#4a4030" strokeWidth="1.2"/>
      <rect x={ox+s(mt)} y={oy+s(caseH-mt-mt)} width={s(width-2*mt)} height={s(mt)} fill="rgba(208,104,56,.15)" stroke="#d06838" strokeWidth=".8"/>
      <rect x={ox+s(mt)} y={oy} width={s(width-2*mt)} height={s(nailerHeight)} fill="#252119" stroke="#4a4030" strokeWidth=".6" opacity=".6"/>
      {shelves.map((pos,i)=><rect key={i} x={ox+s(mt)+2} y={oy+s(caseH-mt-pos)} width={s(width-2*mt)-4} height={s(mt)}
        fill="rgba(196,147,85,.1)" stroke="#c49355" strokeWidth=".7" strokeDasharray={shelfType==='adjustable'?'3 2':'0'}/>)}
      {showDoors&&doorCount===1&&(()=>{const dw=s(width+2*doorOverlay-2*doorReveal),dh=s(caseH+2*doorOverlay-2*doorReveal);
        const dx=ox-s(doorOverlay-doorReveal),dy=oy-s(doorOverlay-doorReveal);
        return <g><rect x={dx} y={dy} width={dw} height={dh} fill="rgba(60,48,34,.85)" stroke="#6a5a44" strokeWidth="1.5" rx="1"/>
          <circle cx={dx+dw-s(25)} cy={dy+dh/2} r={3} fill="#c49355" opacity=".7"/></g>;})()}
      {showDoors&&doorCount===2&&(()=>{const dw=s(width/2+doorOverlay-doorGap/2-doorReveal),dh=s(caseH+2*doorOverlay-2*doorReveal);
        const dy=oy-s(doorOverlay-doorReveal),dx1=ox-s(doorOverlay-doorReveal),dx2=ox+s(width)-dw+s(doorOverlay-doorReveal);
        return <g><rect x={dx1} y={dy} width={dw} height={dh} fill="rgba(60,48,34,.85)" stroke="#6a5a44" strokeWidth="1.5" rx="1"/>
          <circle cx={dx1+dw-s(25)} cy={dy+dh/2} r={3} fill="#c49355" opacity=".7"/>
          <rect x={dx2} y={dy} width={dw} height={dh} fill="rgba(60,48,34,.85)" stroke="#6a5a44" strokeWidth="1.5" rx="1"/>
          <circle cx={dx2+s(25)} cy={dy+dh/2} r={3} fill="#c49355" opacity=".7"/></g>;})()}
      <line x1={ox} y1={oy+s(height)+18} x2={ox+s(width)} y2={oy+s(height)+18} stroke="#8a7e6a" strokeWidth=".7" markerStart="url(#arr)" markerEnd="url(#arr)"/>
      <text x={ox+s(width/2)} y={oy+s(height)+30} textAnchor="middle" fill="#8a7e6a" fontSize="9" fontFamily="inherit">{width}mm</text>
      <line x1={ox-18} y1={oy} x2={ox-18} y2={oy+s(height)} stroke="#8a7e6a" strokeWidth=".7" markerStart="url(#arr)" markerEnd="url(#arr)"/>
      <text x={ox-22} y={oy+s(height/2)} textAnchor="middle" fill="#8a7e6a" fontSize="9" fontFamily="inherit"
        transform={`rotate(-90,${ox-22},${oy+s(height/2)})`}>{height}mm</text>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION VIEW SVG
// ═══════════════════════════════════════════════════════════════════════════
function SectionView({cfg,caseH}){
  const {width,height,depth,caseMaterialThickness:mt,backPanelThickness:bpt,
    toeKickHeight,toeKickRecess,dadoDepth,rabbetDepth,shelfCount,shelfType,nailerHeight,toeKickStyle}=cfg;
  const vw=320,vh=420,pad=50;
  const tkH=toeKickStyle==='none'?0:toeKickHeight;
  const scale=Math.min((vw-2*pad)/depth,(vh-2*pad)/height);
  const s=v=>v*scale;
  const ox=(vw-s(depth))/2,oy=(vh-s(height))/2;
  const intH=caseH-2*mt;const shelves=[];
  if(shelfCount>0){const sp=intH/(shelfCount+1);for(let i=1;i<=shelfCount;i++) shelves.push(mt+sp*i);}

  return(
    <svg viewBox={`0 0 ${vw} ${vh}`} style={{width:'100%',maxWidth:340,display:'block',margin:'0 auto'}}>
      <defs><marker id="arr2" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
        <path d="M0,1L6,3L0,5" fill="none" stroke="#8a7e6a" strokeWidth=".8"/></marker></defs>
      <text x={vw/2} y={16} textAnchor="middle" fill="#8a7e6a" fontSize="10" fontFamily="inherit" letterSpacing="1.5">SECTION VIEW</text>
      {toeKickStyle!=='none'&&<rect x={ox+s(toeKickRecess)} y={oy+s(caseH)} width={s(depth-toeKickRecess-bpt)} height={s(tkH)} fill="#252119" stroke="#4a4030" strokeWidth=".6"/>}
      <rect x={ox} y={oy} width={s(depth)} height={s(caseH)} fill="none" stroke="#4a4030" strokeWidth="1.2"/>
      <rect x={ox} y={oy} width={s(depth-bpt)} height={s(mt)} fill="#3a2e22" stroke="#4a4030" strokeWidth="1"/>
      <rect x={ox} y={oy+s(caseH-mt-mt)} width={s(depth-bpt)} height={s(mt)} fill="rgba(208,104,56,.15)" stroke="#d06838" strokeWidth="1"/>
      <rect x={ox-2} y={oy+s(caseH-mt-mt)} width={4} height={s(mt)} fill="#d06838" opacity=".6" rx="1"/>
      <text x={ox+10} y={oy+s(caseH-mt-mt)-4} fill="#d06838" fontSize="7" fontFamily="inherit">dado</text>
      <rect x={ox+s(depth-bpt)} y={oy+s(mt-rabbetDepth)} width={s(bpt)} height={s(caseH-2*(mt-rabbetDepth))}
        fill="rgba(196,147,85,.08)" stroke="#c49355" strokeWidth=".8"/>
      <rect x={ox+s(depth-bpt)-2} y={oy} width={s(bpt)+4} height={4} fill="#d06838" opacity=".4" rx="1"/>
      <text x={ox+s(depth-bpt)} y={oy-5} fill="#d06838" fontSize="7" fontFamily="inherit">rabbet</text>
      {shelves.map((pos,i)=><rect key={i} x={ox+2} y={oy+s(caseH-mt-pos)} width={s(depth-bpt)-4} height={s(mt)}
        fill="rgba(196,147,85,.1)" stroke="#c49355" strokeWidth=".6" strokeDasharray={shelfType==='adjustable'?'3 2':'0'}/>)}
      <line x1={ox} y1={oy+s(height)+18} x2={ox+s(depth)} y2={oy+s(height)+18} stroke="#8a7e6a" strokeWidth=".7" markerStart="url(#arr2)" markerEnd="url(#arr2)"/>
      <text x={ox+s(depth/2)} y={oy+s(height)+30} textAnchor="middle" fill="#8a7e6a" fontSize="9" fontFamily="inherit">{depth}mm</text>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// INPUT HELPERS
// ═══════════════════════════════════════════════════════════════════════════
function Num({label,value,onChange,min,max,step=1,unit='mm',w}){
  return(<div className="cs-param"><span className="cs-label">{label}</span>
    <div style={{display:'flex',alignItems:'center',gap:4}}>
      <input type="number" min={min} max={max} step={step} value={value}
        onChange={e=>onChange(parseFloat(e.target.value)||0)} style={{width:w||72}} className="cs-num"/>
      <span style={{fontSize:10,color:'#8a7e6a',minWidth:16}}>{unit}</span>
    </div></div>);
}
function Sel({label,value,onChange,options}){
  return(<div className="cs-param"><span className="cs-label">{label}</span>
    <select value={value} onChange={e=>onChange(e.target.value)} className="cs-sel">
      {options.map(o=><option key={o[0]} value={o[0]}>{o[1]}</option>)}
    </select></div>);
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function CabinetStudio({ cabinetId, user, api }) {
  const [cfg, setCfg] = useState({...DEFAULT_CONFIG});
  const [tab, setTab] = useState('design');
  const [showDoors, setShowDoors] = useState(true);
  const [cfgSec, setCfgSec] = useState('case');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [loadingCab, setLoadingCab] = useState(!!cabinetId);
  const [cabinetMeta, setCabinetMeta] = useState(null); // {cabinet_code, name, job_id, ...}
  const [dirty, setDirty] = useState(false);

  const u = useCallback((k,v) => { setCfg(p=>({...p,[k]:v})); setDirty(true); setSaveMsg(''); }, []);

  // Load cabinet from API
  useEffect(() => {
    if (!cabinetId || !api) { setLoadingCab(false); return; }
    api.getCabinet(cabinetId).then(cab => {
      const config = typeof cab.config === 'string' ? JSON.parse(cab.config) : cab.config;
      setCfg({...DEFAULT_CONFIG, ...config});
      setCabinetMeta(cab);
      setDirty(false);
    }).catch(err => {
      console.error('Failed to load cabinet:', err);
      setSaveMsg('Failed to load cabinet');
    }).finally(() => setLoadingCab(false));
  }, [cabinetId, api]);

  // Compute
  const {parts,dados,drills,caseH,intW,totalParts,doorParts,dStyle} = useMemo(()=>computeAll(cfg),[cfg]);

  // Save to API
  const handleSave = async () => {
    if (!api || !cabinetId || !user) return;
    setSaving(true); setSaveMsg('');
    try {
      await api.updateCabinet(cabinetId, {
        config: cfg,
        name: cabinetMeta?.name,
        cabinetType: cfg.cabinetType,
      });
      setDirty(false);
      setSaveMsg('Saved ✓');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      setSaveMsg('Save failed: ' + err.message);
    } finally { setSaving(false); }
  };

  // Export cut list text
  const exportText = useMemo(()=>{
    let t=`CABINET CUT LIST (mm)\n${'═'.repeat(50)}\n`;
    t+=`${cfg.width}W × ${cfg.height}H × ${cfg.depth}D mm | ${dStyle.name} doors\n\n`;
    t+=`PARTS (${totalParts})\n${'─'.repeat(40)}\n`;
    parts.forEach(p=>{t+=`${p.name} ×${p.qty}  ${p.len} × ${p.w} × ${p.t}mm  [${p.mat}]  ${p.notes}\n`;});
    t+=`\nDADO/RABBET OPS (${dados.length})\n${'─'.repeat(40)}\n`;
    dados.forEach(d=>{t+=`${d.part} — ${d.type}: ${d.cutW}×${d.cutD}mm, len ${d.len}mm @ ${d.pos}\n`;});
    if(drills.length){t+=`\nDRILL OPS (${drills.length})\n${'─'.repeat(40)}\n`;
    drills.forEach(d=>{t+=`${d.part} — ${d.type}: Ø${d.dia}×${d.dep}mm, ${d.count}, ${d.spacing}\n`;});}
    if(doorParts.length){t+=`\nDOOR R&S COMPONENTS\n${'─'.repeat(40)}\n`;
    doorParts.forEach(d=>{t+=`${d.name}: ${d.w} × ${d.h}mm${d.note?' ('+d.note+')':''}\n`;});}
    return t;
  },[parts,dados,drills,doorParts,cfg,totalParts,dStyle]);

  const tabs=[{id:'design',label:'Design'},{id:'cuts',label:`Cut List (${totalParts})`},{id:'ops',label:`Operations (${dados.length+drills.length})`}];
  const cfgSecs=[{id:'case',label:'Case'},{id:'joinery',label:'Joinery'},{id:'shelves',label:'Shelves'},{id:'doors',label:'Doors'},{id:'hardware',label:'Hardware'}];

  if (loadingCab) return <div style={{padding:40,color:'#8a7e6a',textAlign:'center'}}>Loading cabinet...</div>;

  return (
    <div className="cabinet-studio-root">
    <style>{`
      .cabinet-studio-root{font-family:'IBM Plex Mono','Fira Code',monospace;background:#151210;color:#e4d8c4;min-height:100%;}
      .cs-num{font-family:inherit;font-size:12px;background:#1e1a15;border:1px solid #3a3228;color:#e4d8c4;padding:5px 7px;border-radius:3px;outline:none;transition:border .2s;}
      .cs-num:focus{border-color:#c49355;}
      .cs-sel{font-family:inherit;font-size:12px;background:#1e1a15;border:1px solid #3a3228;color:#e4d8c4;padding:5px 7px;border-radius:3px;outline:none;cursor:pointer;min-width:120px;}
      .cs-sel:focus{border-color:#c49355;}
      .cs-param{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:3px 0;}
      .cs-label{font-size:10px;color:#8a7e6a;letter-spacing:.4px;text-transform:uppercase;flex-shrink:0;}
      .cs-sec{font-size:9px;font-weight:600;color:#c49355;letter-spacing:1.5px;text-transform:uppercase;padding:8px 0 6px;border-bottom:1px solid #332d24;margin-bottom:8px;margin-top:12px;}
      .cs-sec:first-child{margin-top:0;}
      .cs-tab{font-family:inherit;font-size:10px;background:transparent;color:#8a7e6a;border:none;padding:8px 14px;cursor:pointer;letter-spacing:.3px;transition:all .15s;border-bottom:2px solid transparent;}
      .cs-tab:hover{color:#e4d8c4;background:#2a2418;}
      .cs-tab.active{color:#c49355;border-bottom-color:#c49355;background:#332d24;}
      .cs-ctab{font-family:inherit;font-size:9px;background:transparent;color:#8a7e6a;border:none;padding:5px 10px;cursor:pointer;letter-spacing:.5px;text-transform:uppercase;border-radius:3px;transition:all .12s;}
      .cs-ctab:hover{background:#332d24;} .cs-ctab.active{background:#332d24;color:#c49355;font-weight:600;}
      .door-card{border:2px solid #332d24;border-radius:6px;padding:8px;cursor:pointer;transition:all .15s;display:flex;flex-direction:column;align-items:center;gap:4px;background:#1c1916;min-width:70px;}
      .door-card:hover{border-color:#5a4e3a;background:#252119;} .door-card.sel{border-color:#c49355;background:#252119;}
      table{width:100%;border-collapse:collapse;font-size:11px;}
      th{text-align:left;font-size:9px;font-weight:600;color:#c49355;text-transform:uppercase;letter-spacing:.6px;padding:7px 8px;border-bottom:1px solid #332d24;}
      td{padding:7px 8px;border-bottom:1px solid #252119;vertical-align:top;line-height:1.5;}
      tr:hover td{background:#1c1916;}
      .dim-val{font-weight:500;color:#e0aa6a;white-space:nowrap;}
      .note{font-size:10px;color:#8a7e6a;}
      .badge{display:inline-block;font-size:8px;font-weight:600;letter-spacing:.4px;text-transform:uppercase;padding:2px 5px;border-radius:2px;margin-right:3px;}
      .badge-dado{background:rgba(208,104,56,.18);color:#d06838;}
      .badge-rab{background:rgba(100,160,220,.18);color:#64a0dc;}
      .badge-drill{background:rgba(106,154,90,.18);color:#7aba6a;}
    `}</style>

    {/* Header bar */}
    <div style={{padding:'10px 20px',borderBottom:'1px solid #332d24',display:'flex',alignItems:'center',justifyContent:'space-between',background:'#1c1916'}}>
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        {cabinetMeta && <span style={{fontSize:12,fontWeight:600,color:'#c49355'}}>{cabinetMeta.cabinet_code}</span>}
        <span style={{fontSize:11,color:'#8a7e6a'}}>
          {cfg.width}×{cfg.height}×{cfg.depth}mm | {dStyle.name}
        </span>
        {dirty && <span style={{fontSize:9,color:'#c49355'}}>● unsaved</span>}
        {saveMsg && <span style={{fontSize:10,color:saveMsg.includes('✓')?'#7aba6a':'#c05050'}}>{saveMsg}</span>}
      </div>
      <div style={{display:'flex',gap:6,alignItems:'center'}}>
        {tabs.map(t=><button key={t.id} className={`cs-tab${tab===t.id?' active':''}`} onClick={()=>setTab(t.id)}>{t.label}</button>)}
        <div style={{width:1,height:20,background:'#332d24',margin:'0 4px'}}/>
        <button style={{fontFamily:'inherit',fontSize:10,padding:'5px 12px',borderRadius:3,cursor:'pointer',border:'1px solid #3a3228',
          background:showDoors?'#332d24':'transparent',color:showDoors?'#c49355':'#8a7e6a',transition:'all .15s',letterSpacing:'.3px'}}
          onClick={()=>setShowDoors(!showDoors)}>
          {showDoors?'◧ Doors':'◻ No Doors'}
        </button>
        <button style={{fontFamily:'inherit',fontSize:9,fontWeight:600,background:'#332d24',color:'#c49355',
          border:'1px solid #3a3228',padding:'5px 12px',borderRadius:3,cursor:'pointer',letterSpacing:'.5px',textTransform:'uppercase'}}
          onClick={()=>navigator.clipboard.writeText(exportText)}>Copy</button>
        {cabinetId && api && user && (()=>{
          const thicknesses = [...new Set(parts.map(p=>p.t))].sort((a,b)=>b-a);
          return thicknesses.map(t=>
            <a key={t} href={`/api/export/cabinet/${cabinetId}/dxf?thickness=${t}&token=${localStorage.getItem('cabinet_token')}`}
              style={{fontFamily:'inherit',fontSize:9,fontWeight:600,background:'transparent',color:'#64a0dc',
                border:'1px solid #3a3228',padding:'5px 10px',borderRadius:3,letterSpacing:'.5px',
                textTransform:'uppercase',textDecoration:'none',display:'inline-block'}}
              download>{t}mm ⬇</a>
          );
        })()}
        {cabinetId && api && user && (
          <button style={{fontFamily:'inherit',fontSize:10,fontWeight:600,background:'#c49355',color:'#151210',
            border:'1px solid #c49355',padding:'5px 16px',borderRadius:3,cursor:'pointer',letterSpacing:'.3px'}}
            onClick={handleSave} disabled={saving||!dirty}>
            {saving?'...':'Save'}
          </button>
        )}
      </div>
    </div>

    {/* ═══ DESIGN TAB ═══ */}
    {tab==='design'&&(
      <div style={{display:'grid',gridTemplateColumns:'320px 1fr',minHeight:'calc(100vh - 100px)'}}>
        {/* Sidebar */}
        <div style={{borderRight:'1px solid #332d24',background:'#1c1916',overflowY:'auto',maxHeight:'calc(100vh - 100px)'}}>
          <div style={{display:'flex',flexWrap:'wrap',gap:2,padding:'8px 12px',borderBottom:'1px solid #332d24'}}>
            {cfgSecs.map(s=><button key={s.id} className={`cs-ctab${cfgSec===s.id?' active':''}`} onClick={()=>setCfgSec(s.id)}>{s.label}</button>)}
          </div>
          <div style={{padding:'10px 16px 20px'}}>
            {cfgSec==='case'&&<>
              <div className="cs-sec">Type & Dimensions</div>
              <Sel label="Type" value={cfg.cabinetType} onChange={v=>u('cabinetType',v)}
                options={[['base','Base'],['wall','Wall'],['tall','Tall/Pantry'],['vanity','Vanity'],['drawer_base','Drawer Base'],['sink_base','Sink Base'],['corner_base','Corner Base'],['open_shelf','Open Shelf'],['island','Island']]}/>
              <Num label="Height" value={cfg.height} onChange={v=>u('height',v)} min={200} max={2400} step={10}/>
              <Num label="Width" value={cfg.width} onChange={v=>u('width',v)} min={150} max={1200} step={10}/>
              <Num label="Depth" value={cfg.depth} onChange={v=>u('depth',v)} min={200} max={800} step={10}/>
              <div className="cs-sec">Material Thickness</div>
              <Num label="Case" value={cfg.caseMaterialThickness} onChange={v=>{u('caseMaterialThickness',v);u('dadoWidth',v);}} min={6} max={25}/>
              <Num label="Back panel" value={cfg.backPanelThickness} onChange={v=>{u('backPanelThickness',v);u('rabbetWidth',v);}} min={3} max={12}/>
              <Num label="Door" value={cfg.doorMaterialThickness} onChange={v=>u('doorMaterialThickness',v)} min={12} max={25}/>
              <div className="cs-sec">Toe Kick</div>
              <Sel label="Style" value={cfg.toeKickStyle} onChange={v=>u('toeKickStyle',v)} options={[['integral','Integral'],['separate_plinth','Sep. Plinth'],['legs','Legs'],['none','None']]}/>
              {cfg.toeKickStyle!=='none'&&cfg.toeKickStyle!=='legs'&&<>
                <Num label="Height" value={cfg.toeKickHeight} onChange={v=>u('toeKickHeight',v)} min={50} max={200} step={5}/>
                <Num label="Recess" value={cfg.toeKickRecess} onChange={v=>u('toeKickRecess',v)} min={20} max={100} step={5}/>
              </>}
              {cfg.toeKickStyle==='legs'&&<>
                <Num label="Leg height" value={cfg.toeKickHeight} onChange={v=>u('toeKickHeight',v)} min={50} max={200} step={5}/>
                <div className="cs-sec">Leg Mounting</div>
                <Sel label="Leg count" value={cfg.legCount} onChange={v=>u('legCount',parseInt(v))}
                  options={[['0','None'],['4','4 (corners)'],['5','5 (corners+center)'],['6','6 (corners+mid)'],['7','7'],['8','8']]}/>
                {cfg.legCount>0&&<>
                  <Num label="Margin" value={cfg.legMargin} onChange={v=>u('legMargin',v)} min={30} max={200} step={5}/>
                  <Num label="Bolt circle Ø" value={cfg.legBoltCircle} onChange={v=>u('legBoltCircle',v)} min={20} max={80} step={1}/>
                  <Num label="Screw holes" value={cfg.legHoleCount} onChange={v=>u('legHoleCount',parseInt(v)||4)} min={2} max={8} unit=""/>
                  <Num label="Screw hole Ø" value={cfg.legHoleDia} onChange={v=>u('legHoleDia',v)} min={2} max={8} step={.5}/>
                  <Num label="Hole depth" value={cfg.legHoleDepth} onChange={v=>u('legHoleDepth',v)} min={5} max={20} step={1}/>
                  <Sel label="Center hole" value={cfg.legCenterHole?'yes':'no'} onChange={v=>u('legCenterHole',v==='yes')}
                    options={[['no','No'],['yes','Yes']]}/>
                  {cfg.legCenterHole&&<Num label="Center Ø" value={cfg.legCenterDia} onChange={v=>u('legCenterDia',v)} min={3} max={10} step={.5}/>}
                  <div style={{marginTop:8,padding:'8px 10px',background:'#252119',borderRadius:4,fontSize:10,color:'#8a7e6a',lineHeight:1.6}}>
                    {cfg.legCount} legs, {cfg.legHoleCount} screw holes each on Ø{cfg.legBoltCircle}mm bolt circle.
                    Centers placed {cfg.legMargin}mm from panel edges.
                    {cfg.legCount>=5&&' Includes center leg for heavy loads.'}
                  </div>
                </>}
              </>}
              <div className="cs-sec">Nailers</div>
              <Num label="Height" value={cfg.nailerHeight} onChange={v=>u('nailerHeight',v)} min={50} max={150} step={5}/>
            </>}
            {cfgSec==='joinery'&&<>
              <div className="cs-sec">Dado (Bottom & Shelves)</div>
              <Num label="Depth" value={cfg.dadoDepth} onChange={v=>u('dadoDepth',v)} min={3} max={15} step={.5}/>
              <Num label="Width" value={cfg.dadoWidth} onChange={v=>u('dadoWidth',v)} min={6} max={25} step={.5}/>
              <Num label="Allowance" value={cfg.dadoAllowance} onChange={v=>u('dadoAllowance',v)} min={0} max={1} step={.05}/>
              <div className="cs-sec">Rabbet (Back Panel)</div>
              <Num label="Depth" value={cfg.rabbetDepth} onChange={v=>u('rabbetDepth',v)} min={3} max={15} step={.5}/>
              <Num label="Width" value={cfg.rabbetWidth} onChange={v=>u('rabbetWidth',v)} min={3} max={12} step={.5}/>
              <div style={{marginTop:16,padding:'10px 12px',background:'#252119',borderRadius:4,fontSize:10,color:'#8a7e6a',lineHeight:1.6}}>
                <strong style={{color:'#d06838'}}>Tip:</strong> Material is {cfg.caseMaterialThickness}mm → dado cuts at {(cfg.caseMaterialThickness+(cfg.dadoAllowance||0)).toFixed(2)}mm (incl. {cfg.dadoAllowance||0}mm allowance). Set allowance to 0 for a perfect fit.
              </div>
            </>}
            {cfgSec==='shelves'&&<>
              <div className="cs-sec">Shelf Configuration</div>
              <Sel label="Type" value={cfg.shelfType} onChange={v=>u('shelfType',v)} options={[['adjustable','Adjustable (pins)'],['fixed','Fixed (dado)'],['none','None']]}/>
              {cfg.shelfType!=='none'&&<><Num label="Count" value={cfg.shelfCount} onChange={v=>u('shelfCount',parseInt(v)||0)} min={0} max={10} unit=""/>
              <Num label="Setback" value={cfg.shelfSetback} onChange={v=>u('shelfSetback',v)} min={0} max={20}/></>}
              {cfg.shelfType==='adjustable'&&<>
                <div className="cs-sec">32mm System Pins</div>
                <Num label="Pin Ø" value={cfg.pinDia} onChange={v=>u('pinDia',v)} min={3} max={8} step={.5}/>
                <Num label="Hole depth" value={cfg.pinDepth} onChange={v=>u('pinDepth',v)} min={8} max={20}/>
                <Num label="Spacing" value={cfg.pinSpacing} onChange={v=>u('pinSpacing',v)} min={20} max={50}/>
                <Num label="Rows/side" value={cfg.pinRowsPerSide} onChange={v=>u('pinRowsPerSide',parseInt(v)||1)} min={1} max={4} unit=""/>
                <Num label="Inset front" value={cfg.pinInsetFront} onChange={v=>u('pinInsetFront',v)} min={20} max={100}/>
                <Num label="Inset rear" value={cfg.pinInsetRear} onChange={v=>u('pinInsetRear',v)} min={20} max={100}/>
                <Num label="Zone start↑" value={cfg.pinZoneStart} onChange={v=>u('pinZoneStart',v)} min={30} max={200} step={5}/>
                <Num label="Zone end↓" value={cfg.pinZoneEnd} onChange={v=>u('pinZoneEnd',v)} min={30} max={200} step={5}/>
                <div className="cs-sec">Pin-Lock Grooves</div>
                <Sel label="Enabled" value={cfg.shelfGrooves===false?'no':'yes'} onChange={v=>u('shelfGrooves',v==='yes')}
                  options={[['yes','Yes — grooves on shelves'],['no','No — plain shelves']]}/>
                {cfg.shelfGrooves!==false&&<>
                  <Num label="Groove width" value={cfg.shelfGrooveWidth||(cfg.pinDia+2)} onChange={v=>u('shelfGrooveWidth',v)} min={4} max={20} step={.5}/>
                  <Num label="Groove depth" value={cfg.shelfGrooveDepth||10} onChange={v=>u('shelfGrooveDepth',v)} min={3} max={15} step={.5}/>
                  <Num label="Edge inset" value={cfg.shelfGrooveInset||12} onChange={v=>u('shelfGrooveInset',v)} min={5} max={25} step={1}/>
                  <div style={{marginTop:8,padding:'8px 10px',background:'#252119',borderRadius:4,fontSize:10,color:'#8a7e6a',lineHeight:1.6}}>
                    Small dadoes on shelf underside lock onto pins so shelves can't slide. {cfg.pinRowsPerSide||2} grooves per side × 2 sides = {(cfg.pinRowsPerSide||2)*2} grooves per shelf.
                    Groove: {cfg.shelfGrooveWidth||(cfg.pinDia+2)}mm wide × {cfg.shelfGrooveDepth||10}mm deep, {cfg.shelfGrooveInset||12}mm from edge.
                  </div>
                </>}
              </>}
            </>}
            {cfgSec==='doors'&&<>
              <div className="cs-sec">Door Configuration</div>
              <Sel label="Count" value={cfg.doorCount} onChange={v=>u('doorCount',parseInt(v))} options={[['0','None'],['1','Single'],['2','Double']]}/>
              {cfg.doorCount>0&&<><Num label="Overlay" value={cfg.doorOverlay} onChange={v=>u('doorOverlay',v)} min={0} max={25}/>
              <Num label="Reveal" value={cfg.doorReveal} onChange={v=>u('doorReveal',v)} min={1} max={10} step={.5}/>
              {cfg.doorCount===2&&<Num label="Center gap" value={cfg.doorGap} onChange={v=>u('doorGap',v)} min={1} max={10} step={.5}/>}</>}
              {cfg.doorCount>0&&<>
                <div className="cs-sec">Door Style</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginTop:4}}>
                  {DOOR_STYLES.map(ds=><div key={ds.id} className={`door-card${cfg.doorStyle===ds.id?' sel':''}`} onClick={()=>u('doorStyle',ds.id)}>
                    <DoorStyleThumb style={ds} size={48}/><span style={{fontSize:8,fontWeight:500,color:cfg.doorStyle===ds.id?'#c49355':'#e4d8c4',textAlign:'center',lineHeight:1.2}}>{ds.name}</span>
                  </div>)}
                </div>
                <div style={{marginTop:8,padding:'6px 10px',background:'#252119',borderRadius:4}}>
                  <div style={{fontSize:10,fontWeight:600,color:'#c49355'}}>{dStyle.name}</div>
                  <div style={{fontSize:9,color:'#8a7e6a',marginTop:2}}>{dStyle.desc}</div>
                  {dStyle.rail>0&&<div style={{fontSize:9,color:'#8a7e6a',marginTop:2}}>Rail: {dStyle.rail}mm • Stile: {dStyle.stile}mm</div>}
                </div>
              </>}
            </>}
            {cfgSec==='hardware'&&<>
              <div className="cs-sec">Hinge Boring</div>
              <Num label="Cup Ø" value={cfg.hingeBoreDia} onChange={v=>u('hingeBoreDia',v)} min={25} max={40}/>
              <Num label="Cup depth" value={cfg.hingeBoreDepth} onChange={v=>u('hingeBoreDepth',v)} min={10} max={20} step={.5}/>
              <Num label="From edge" value={cfg.hingeBoreFromEdge} onChange={v=>u('hingeBoreFromEdge',v)} min={15} max={30} step={.5}/>
              <div className="cs-sec">Handle / Pull</div>
              <Sel label="Type" value={cfg.handleType} onChange={v=>u('handleType',v)}
                options={[['pull','Bar Pull'],['knob','Knob'],['integrated','J-pull'],['push','Push-to-Open'],['none','None']]}/>
              {cfg.handleType==='pull'&&<Num label="Hole spacing" value={cfg.handleLength} onChange={v=>u('handleLength',v)} min={64} max={320} step={32}/>}
            </>}
          </div>
        </div>

        {/* Visualization */}
        <div style={{padding:'16px 20px',overflowY:'auto',maxHeight:'calc(100vh - 100px)'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div style={{background:'#1c1916',borderRadius:6,padding:12,border:'1px solid #332d24'}}>
              <FrontView cfg={cfg} caseH={caseH} showDoors={showDoors}/>
            </div>
            <div style={{background:'#1c1916',borderRadius:6,padding:12,border:'1px solid #332d24'}}>
              <SectionView cfg={cfg} caseH={caseH}/>
            </div>
          </div>
          {/* Summary */}
          <div style={{marginTop:16,padding:'12px 14px',background:'#252119',borderRadius:6,
            fontSize:10,color:'#8a7e6a',lineHeight:1.7,display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
            <div><div style={{color:'#c49355',fontWeight:600,marginBottom:2}}>Case</div>
              Case height: {caseH}mm<br/>Internal: {intW}×{caseH-2*cfg.caseMaterialThickness}mm<br/>
              Material: {cfg.caseMaterialThickness}mm + {cfg.backPanelThickness}mm back</div>
            <div><div style={{color:'#d06838',fontWeight:600,marginBottom:2}}>Joinery</div>
              {dados.length} dado/rabbet ops<br/>Dado: {cfg.dadoWidth}×{cfg.dadoDepth}mm<br/>Rabbet: {cfg.rabbetWidth}×{cfg.rabbetDepth}mm</div>
            <div><div style={{color:'#c49355',fontWeight:600,marginBottom:2}}>Parts</div>
              {totalParts} total parts<br/>{parts.filter(p=>p.type==='shelf').reduce((s,p)=>s+p.qty,0)} shelves ({cfg.shelfType})<br/>{drills.length} drill op{drills.length!==1?'s':''}</div>
          </div>
          {doorParts.length>0&&<div style={{marginTop:12,padding:'12px 14px',background:'#252119',borderRadius:6}}>
            <div style={{fontSize:9,fontWeight:600,color:'#c49355',letterSpacing:1,textTransform:'uppercase',marginBottom:6}}>Door R&S Components (per door)</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:6}}>
              {doorParts.map((dp,i)=><div key={i} style={{fontSize:10,color:'#e4d8c4',padding:'4px 8px',background:'#332d24',borderRadius:3}}>
                <span style={{fontWeight:500}}>{dp.name}</span><span className="dim-val" style={{marginLeft:6}}>{dp.w}×{dp.h}mm</span>
                {dp.note&&<span className="note" style={{marginLeft:4}}>({dp.note})</span>}</div>)}
            </div>
          </div>}
        </div>
      </div>
    )}

    {/* ═══ CUT LIST TAB ═══ */}
    {tab==='cuts'&&<div style={{padding:'16px 20px',overflowX:'auto'}}>
      <table><thead><tr><th>Part</th><th>Qty</th><th>Length</th><th>Width</th><th>Thick</th><th>Material</th><th>Notes</th></tr></thead>
        <tbody>{parts.map((p,i)=><tr key={i}>
          <td style={{fontWeight:500,whiteSpace:'nowrap'}}>{p.name}</td><td style={{textAlign:'center'}}>{p.qty}</td>
          <td className="dim-val">{p.len}mm</td><td className="dim-val">{p.w}mm</td><td>{p.t}mm</td>
          <td style={{fontSize:10}}>{p.mat}</td>
          <td><span className="note">{p.notes}</span>{p.eb.length>0&&<div style={{marginTop:2}}>
            <span className="badge" style={{background:'rgba(196,147,90,.12)',color:'#c49355'}}>edge band: {p.eb.join(', ')}</span></div>}</td>
        </tr>)}</tbody></table>
      {doorParts.length>0&&<><div style={{fontSize:9,fontWeight:600,color:'#c49355',letterSpacing:1.2,textTransform:'uppercase',marginTop:20,marginBottom:8,paddingBottom:6,borderBottom:'1px solid #332d24'}}>
        Door R&S Components (per door)</div>
        <table><thead><tr><th>Component</th><th>Width</th><th>Height</th><th>Notes</th></tr></thead>
          <tbody>{doorParts.map((dp,i)=><tr key={i}><td style={{fontWeight:500}}>{dp.name}</td>
            <td className="dim-val">{dp.w}mm</td><td className="dim-val">{dp.h}mm</td><td className="note">{dp.note||'—'}</td></tr>)}</tbody></table></>}
    </div>}

    {/* ═══ OPERATIONS TAB ═══ */}
    {tab==='ops'&&<div style={{padding:'16px 20px',overflowX:'auto'}}>
      <div style={{fontSize:9,fontWeight:600,color:'#d06838',letterSpacing:1.2,textTransform:'uppercase',marginBottom:8,paddingBottom:6,borderBottom:'1px solid #332d24'}}>
        Dado & Rabbet Operations ({dados.length})</div>
      <table><thead><tr><th>Part</th><th>Type</th><th>W × D</th><th>Length</th><th>Position</th><th>Notes</th></tr></thead>
        <tbody>{dados.map((d,i)=><tr key={i}>
          <td style={{fontWeight:500}}>{d.part}</td>
          <td><span className={`badge ${d.type==='Dado'?'badge-dado':'badge-rab'}`}>{d.type}</span></td>
          <td className="dim-val">{d.cutW}×{d.cutD}mm</td><td className="dim-val">{d.len}mm</td>
          <td className="note">{d.pos}<div style={{opacity:.7,marginTop:1}}>{d.orient}</div></td>
          <td className="note">{d.note}</td></tr>)}</tbody></table>
      {drills.length>0&&<><div style={{fontSize:9,fontWeight:600,color:'#7aba6a',letterSpacing:1.2,textTransform:'uppercase',marginTop:24,marginBottom:8,paddingBottom:6,borderBottom:'1px solid #332d24'}}>
        Drilling Operations ({drills.length})</div>
        <table><thead><tr><th>Part</th><th>Type</th><th>Ø × Depth</th><th>Layout</th><th>Notes</th></tr></thead>
          <tbody>{drills.map((d,i)=><tr key={i}>
            <td style={{fontWeight:500}}>{d.part}</td>
            <td><span className="badge badge-drill">{d.type}</span></td>
            <td className="dim-val">Ø{d.dia}×{d.dep}mm</td>
            <td className="note"><div>{d.count}</div><div>{d.rows} rows, inset {d.inset}</div><div>{d.spacing} spacing</div><div>From: {d.start}</div></td>
            <td className="note">{d.note}</td></tr>)}</tbody></table></>}
    </div>}
    </div>
  );
}
