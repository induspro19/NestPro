
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

/* ============================================================
   ISNS AI Enterprise — Intelligent Nesting Platform
   Premium upgrade: Dark industrial UI, AI scoring, enhanced
   canvas with scrap zones, new shapes, live analytics,
   job reports. All original algorithms preserved intact.
   ============================================================ */

/* ─── constants ─── */
const PALETTE = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#f97316','#ec4899','#14b8a6','#a855f7','#22d3ee','#84cc16'];
function hashColor(str) { let h=0; for(let i=0;i<str.length;i++) h=(h*31+str.charCodeAt(i))>>>0; return PALETTE[h%PALETTE.length]; }
function uid(p) { return `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`; }
const fmt = (n,d=0) => Number.isFinite(n) ? n.toLocaleString('en-IN',{maximumFractionDigits:d,minimumFractionDigits:d}) : '—';
const fmtCurrency = n => `₹${fmt(n,0)}`;
const LS_PREFIX = 'isns:';
async function storeGet(key,fb){ try{const r=localStorage.getItem(LS_PREFIX+key);return r!=null?JSON.parse(r):fb;}catch{return fb;} }
async function storeSet(key,val){ try{localStorage.setItem(LS_PREFIX+key,JSON.stringify(val));return true;}catch{return false;} }
async function storeDelete(key){ try{localStorage.removeItem(LS_PREFIX+key);}catch{} }

/* ─── Supabase Cloud Sync (preserved exactly) ─── */
const ISNS_CLOUD_ID = 2;
let _sb=null, _sbReady=false, _lastSave=0;
function initCloud(){ if(_sbReady||!window.supabase)return null; try{_sb=window.supabase.createClient('https://duikfskqbacackelieux.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1aWtmc2txYmFjYWNrZWxpZXV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2MTA0ODIsImV4cCI6MjA3OTE4NjQ4Mn0.IST84GYs9-5eOGmx485XPqDAwfp0Jdw5MHAjzUYTUUA');_sbReady=true;}catch{_sb=null;} return _sb; }
async function cloudLoad(){ const c=initCloud(); if(!c)return null; try{const{data,error}=await c.from('app_state').select('data').eq('id',ISNS_CLOUD_ID).single(); if(!error&&data?.data)return data.data;}catch{} return null; }
async function cloudSave(snap){ const c=initCloud(); if(!c)return false; _lastSave=Date.now(); try{const{error}=await c.from('app_state').upsert({id:ISNS_CLOUD_ID,data:snap,updated_at:new Date().toISOString()});return!error;}catch{return false;} }

/* ─── packing engine (100% preserved) ─── */
const PRIORITY_RANK = {Urgent:0,Normal:1,Low:2};
const SPLIT_MODES = ['auto','vertical','horizontal'];
function cutAllowance(s){ return (parseFloat(s?.gap)||0)+(parseFloat(s?.kerf)||0); }
function partGeometry(p){
  const l=parseFloat(p.length)||0, w=parseFloat(p.width)||0, st=p.shapeType||'rectangle';
  if(st==='circle'){ const d=Math.max(l,w); return{w:d,h:d,trueArea:Math.PI*(d/2)**2,shapeType:'circle',shapeData:{diameter:d}}; }
  if(st==='lshape'){ const cl=parseFloat(p.cutoutLength)||0,cw=parseFloat(p.cutoutWidth)||0; return{w:l,h:w,trueArea:Math.max(0,l*w-cl*cw),shapeType:'lshape',shapeData:{cutoutLength:cl,cutoutWidth:cw}}; }
  if(st==='triangle'){ return{w:l,h:w,trueArea:0.5*l*w,shapeType:'triangle',shapeData:{legA:l,legB:w}}; }
  if(st==='trapezoid'){ const a=parseFloat(p.sideA)||l,b=parseFloat(p.sideB)||0; return{w:Math.max(l,a,b),h:w,trueArea:0.5*(a+b)*w,shapeType:'trapezoid',shapeData:{sideA:a,sideB:b,height:w}}; }
  return{w:l,h:w,trueArea:l*w,shapeType:'rectangle',shapeData:null};
}
function defaultItemOrder(items){ return [...items].sort((a,b)=>{const pa=PRIORITY_RANK[a.priority]??1,pb=PRIORITY_RANK[b.priority]??1;if(pa!==pb)return pa-pb;return Math.max(b.w,b.h)-Math.max(a.w,a.h)||b.w*b.h-a.w*a.h;}).map(it=>it.id); }
function reorderItems(items,orderIds){ if(!orderIds?.length)return defaultItemOrder(items).map(id=>items.find(it=>it.id===id)).filter(Boolean);const map=new Map(items.map(it=>[it.id,it]));const ord=orderIds.map(id=>map.get(id)).filter(Boolean);return ord.concat(items.filter(it=>!orderIds.includes(it.id))); }
function footprint(item,allowance,rotated){ const w=rotated?item.h:item.w,h=rotated?item.w:item.h;return{w:w+allowance,h:h+allowance,rot:rotated}; }
function chooseSplitRects(fr,pw,ph,sm){ const horiz=sm==='horizontal'||(sm==='auto'&&(fr.w-pw)>(fr.h-ph)); if(horiz)return[{x:fr.x+pw,y:fr.y,w:fr.w-pw,h:fr.h},{x:fr.x,y:fr.y+ph,w:pw,h:fr.h-ph}]; return[{x:fr.x+pw,y:fr.y,w:fr.w-pw,h:ph},{x:fr.x,y:fr.y+ph,w:fr.w,h:fr.h-ph}]; }
function packOneBin(bW,bH,items,settings,options={}){ const allowance=cutAllowance(settings),sm=options.splitMode||'auto',sorted=reorderItems(items,options.itemOrder);let freeRects=options.initialFreeRects ? JSON.parse(JSON.stringify(options.initialFreeRects)) : [{x:0,y:0,w:bW,h:bH}];const placements=[],leftover=[];for(const item of sorted){let best=null;for(let idx=0;idx<freeRects.length;idx++){const fr=freeRects[idx];const opts=[footprint(item,allowance,false)];if(item.allowRotation)opts.push(footprint(item,allowance,true));for(const o of opts){if(o.w<=fr.w+1e-6&&o.h<=fr.h+1e-6){const lW=fr.w-o.w,lH=fr.h-o.h,ss=Math.min(lW,lH),ls=Math.max(lW,lH);if(!best||ss<best.ss-1e-6||(Math.abs(ss-best.ss)<1e-6&&ls<best.ls))best={idx,rot:o.rot,w:o.w,h:o.h,ss,ls,fr};}}}if(!best){leftover.push(item);continue;}const fr=best.fr,pw=best.w,ph=best.h,splits=chooseSplitRects(fr,pw,ph,sm);const newFree=freeRects.filter((_,i)=>i!==best.idx);splits.forEach(r=>{if(r.w>0.5&&r.h>0.5)newFree.push(r);});freeRects=newFree;placements.push({instId:item.id,partNo:item.partNo,x:fr.x,y:fr.y,w:best.rot?item.h:item.w,h:best.rot?item.w:item.h,rotated:best.rot,color:item.color,shapeType:item.shapeType||'rectangle',shapeData:item.shapeData||null,trueArea:item.trueArea||((best.rot?item.h:item.w)*(best.rot?item.w:item.h)),priority:item.priority||'Normal'});}return{placements,leftover,freeRects}; }
function packSheets(sL,sW,items,settings,opts={}){ const margin=parseFloat(settings.margin)||0,uW=Math.max(0,sL-2*margin),uH=Math.max(0,sW-2*margin);let remaining=items;const sheets=[];let guard=0;while(remaining.length&&guard<800){guard++;const{placements,leftover,freeRects}=packOneBin(uW,uH,remaining,settings,opts);if(!placements.length)break;sheets.push({placements,freeRects,usableW:uW,usableH:uH,margin});remaining=leftover;}return{sheets,unplaced:remaining}; }
function buildItemsFromParts(parts,settings){ const gr=!settings||settings.allowRotation!==false;const items=[];parts.forEach(p=>{const qty=Math.max(0,parseInt(p.qty)||0),geo=partGeometry(p);for(let i=0;i<qty;i++)items.push({id:`${p.id}-${i}`,partNo:p.partNo,w:geo.w,h:geo.h,trueArea:geo.trueArea,shapeType:geo.shapeType,shapeData:geo.shapeData,priority:p.priority||'Normal',allowRotation:p.allowRotation!==false&&gr&&geo.shapeType==='rectangle',color:hashColor(p.partNo||'X')});});return items; }
function itemAreaSqm(items){ return items.reduce((s,it)=>s+(it.trueArea||it.w*it.h)/1e6,0); }
function costPerSqmOf(mat){ if(!mat)return 0;if(mat.costPerSqm)return parseFloat(mat.costPerSqm)||0;const d=parseFloat(mat.density)||0,k=parseFloat(mat.costPerKg)||0,t=parseFloat(mat.thickness)||0;return k*d*(t/1000); }
function breakdownBySize(sheets){ const map=new Map();sheets.forEach(sh=>{const l=sh.size?sh.size.l:sh.l,w=sh.size?sh.size.w:sh.w,key=`${l}x${w}`;if(!map.has(key))map.set(key,{l,w,count:0});map.get(key).count++;});return Array.from(map.values()).sort((a,b)=>b.count-a.count); }
function labelFromBreakdown(bd,mixed){ if(!bd.length)return'No sheets';if(!mixed||bd.length===1)return`${bd[0].l} × ${bd[0].w}`;return bd.map(b=>`${b.count}× ${b.l}×${b.w}`).join(' + '); }
function packWithScrapAndSizes(scrapPieces,freshSizes,items,settings,opts={}){ let remaining=items;const scrapOut=[],usedScrapIds=[];const sortedScrap=[...(scrapPieces||[])].sort((a,b)=>a.length*a.width-b.length*b.width);for(const scrap of sortedScrap){if(!remaining.length)break;const margin=parseFloat(settings.margin)||0,uW=Math.max(0,scrap.length-2*margin),uH=Math.max(0,scrap.width-2*margin);const{placements,leftover,freeRects}=packOneBin(uW,uH,remaining,settings,opts);if(placements.length){scrapOut.push({source:'scrap',scrapId:scrap.id,scrapLabel:`${scrap.length} × ${scrap.width}`,size:{l:scrap.length,w:scrap.width},placements,freeRects,usableW:uW,usableH:uH,margin});usedScrapIds.push(scrap.id);remaining=leftover;}}let freshOut=[],unplaced=remaining;if(remaining.length&&freshSizes.length===1){const sz=freshSizes[0];const{sheets,unplaced:up}=packSheets(sz.l,sz.w,remaining,settings,opts);sheets.forEach(sh=>{sh.size=sz;sh.source='fresh';});freshOut=sheets;unplaced=up;}else if(remaining.length&&freshSizes.length>1){const{sheets,unplaced:up}=packMultiSize(freshSizes,remaining,settings,opts);sheets.forEach(sh=>{sh.source='fresh';});freshOut=sheets;unplaced=up;}return{sheets:scrapOut.concat(freshOut),unplaced,usedScrapIds,scrapSheetsOut:scrapOut,freshSheetsOut:freshOut}; }
function evaluateSheetSize(size,parts,settings,material,scrapPieces=[],opts={}){ const items=buildItemsFromParts(parts,settings),n=items.length;const{sheets,unplaced,usedScrapIds,scrapSheetsOut,freshSheetsOut}=packWithScrapAndSizes(scrapPieces,[size],items,settings,opts);const freshAreaSqm=(size.l*size.w)/1e6,scrapAreaSqm=scrapSheetsOut.reduce((s,sh)=>s+(sh.size.l*sh.size.w)/1e6,0);const totalFresh=freshAreaSqm*freshSheetsOut.length,totalSheet=totalFresh+scrapAreaSqm,placed=n-unplaced.length;const partArea=itemAreaSqm(items)*(n?placed/n:0),util=totalSheet>0?Math.min(100,(partArea/totalSheet)*100):0,scrapPct=totalSheet>0?100-util:0;const cpsm=costPerSqmOf(material),cost=totalFresh*cpsm,scrapValue=cost*(scrapPct/100)*0.3;const bd=breakdownBySize(freshSheetsOut);return{size,sheets,unplaced,sheetAreaSqm:freshAreaSqm,totalSheetArea:totalSheet,partArea,utilization:util,scrapPct,cost,scrapValue,sheetsUsed:sheets.length,freshSheetsUsed:freshSheetsOut.length,scrapSheetsUsed:scrapSheetsOut.length,usedScrapIds,totalPartsRequested:n,placedCount:placed,mixed:false,sizeBreakdown:bd,sizeLabel:bd.length?labelFromBreakdown(bd,false):(scrapSheetsOut.length?'Scrap pieces only':'No sheets'),engineTag:opts.engineTag||'bssf'}; }
function packMultiSize(sizes,items,settings,opts={}){ const margin=parseFloat(settings.margin)||0;let remaining=items;const sheets=[];let guard=0;while(remaining.length&&guard<800){guard++;let best=null;for(const size of sizes){const uW=Math.max(0,size.l-2*margin),uH=Math.max(0,size.w-2*margin);const{placements,leftover,freeRects}=packOneBin(uW,uH,remaining,settings,opts);if(!placements.length)continue;const aP=placements.reduce((s,p)=>s+(p.trueArea||p.w*p.h),0),util=uW*uH>0?aP/(uW*uH):0;if(!best||placements.length>best.placements.length||(placements.length===best.placements.length&&util>best.util))best={size,placements,leftover,freeRects,usableW:uW,usableH:uH,util};}if(!best)break;sheets.push({size:best.size,placements:best.placements,freeRects:best.freeRects,usableW:best.usableW,usableH:best.usableH,margin});remaining=best.leftover;}return{sheets,unplaced:remaining}; }
function evaluateMixedSizes(sizes,parts,settings,material,scrapPieces=[],opts={}){ const items=buildItemsFromParts(parts,settings),n=items.length;const{sheets,unplaced,usedScrapIds,scrapSheetsOut,freshSheetsOut}=packWithScrapAndSizes(scrapPieces,sizes,items,settings,opts);const scrapAreaSqm=scrapSheetsOut.reduce((s,sh)=>s+(sh.size.l*sh.size.w)/1e6,0),totalFresh=freshSheetsOut.reduce((s,sh)=>s+(sh.size.l*sh.size.w)/1e6,0),totalSheet=totalFresh+scrapAreaSqm,placed=n-unplaced.length;const partArea=itemAreaSqm(items)*(n?placed/n:0),util=totalSheet>0?Math.min(100,(partArea/totalSheet)*100):0,scrapPct=totalSheet>0?100-util:0;const cpsm=costPerSqmOf(material),cost=totalFresh*cpsm,scrapValue=cost*(scrapPct/100)*0.3;const bd=breakdownBySize(freshSheetsOut);return{size:bd[0]?{l:bd[0].l,w:bd[0].w}:{l:0,w:0},sheets,unplaced,totalSheetArea:totalSheet,partArea,utilization:util,scrapPct,cost,scrapValue,sheetsUsed:sheets.length,freshSheetsUsed:freshSheetsOut.length,scrapSheetsUsed:scrapSheetsOut.length,usedScrapIds,totalPartsRequested:n,placedCount:placed,mixed:true,sizeBreakdown:bd,sizeLabel:bd.length?labelFromBreakdown(bd,true):(scrapSheetsOut.length?'Scrap pieces only':'No sheets'),engineTag:opts.engineTag||'bssf'}; }
function runOptimization(sizes,parts,settings,material,scrapPieces=[],opts={}){ const results=sizes.map(sz=>evaluateSheetSize(sz,parts,settings,material,scrapPieces,opts));if(sizes.length>1)results.unshift(evaluateMixedSizes(sizes,parts,settings,material,scrapPieces,opts));if(!sizes.length&&scrapPieces.length)results.push(evaluateMixedSizes([],parts,settings,material,scrapPieces,opts));results.sort((a,b)=>a.unplaced.length-b.unplaced.length||a.sheetsUsed-b.sheetsUsed||b.utilization-a.utilization);return results; }
function packingFitness(o){ if(!o)return Infinity;return o.unplaced.length*100000+o.sheetsUsed*1000-o.utilization+o.cost*0.01; }
function mutateOrder(order){ const next=[...order];if(!next.length)return next;if(Math.random()<0.5){const i=Math.floor(Math.random()*next.length);let j=Math.floor(Math.random()*next.length);while(j===i)j=Math.floor(Math.random()*next.length);[next[i],next[j]]=[next[j],next[i]];}else{const from=Math.floor(Math.random()*next.length),to=Math.floor(Math.random()*next.length);const[x]=next.splice(from,1);next.splice(to,0,x);}return next; }
function crossoverOrder(a,b){ if(!a.length)return[...b];const cut=Math.floor(Math.random()*a.length),head=a.slice(0,cut),tail=b.filter(id=>!head.includes(id));return head.concat(tail); }
function runGeneticOptimizationAsync(sizes,parts,settings,material,scrapPieces=[],gaSettings={},onProgress){ return new Promise(resolve=>{const items=buildItemsFromParts(parts,settings),base=defaultItemOrder(items),popSize=Math.max(12,parseInt(gaSettings.population)||48),gens=Math.max(10,parseInt(gaSettings.generations)||80);let pop=[{itemOrder:base,splitMode:'auto'}];while(pop.length<popSize)pop.push({itemOrder:mutateOrder(base),splitMode:SPLIT_MODES[pop.length%SPLIT_MODES.length]});let best=null,bestScore=Infinity,gen=0;function step(){const batch=Math.min(4,gens-gen);for(let b=0;b<batch;b++){const scored=pop.map(ind=>{const opts={itemOrder:ind.itemOrder,splitMode:ind.splitMode,engineTag:'genetic'};const r=runOptimization(sizes,parts,settings,material,scrapPieces,opts),sc=packingFitness(r[0]);return{ind,score:sc,result:r};});scored.sort((a,b)=>a.score-b.score);if(scored[0].score<bestScore){bestScore=scored[0].score;best=scored[0];}gen++;if(onProgress)onProgress(Math.round(gen/gens*100),gen,gens,bestScore);const next=scored.slice(0,Math.min(8,scored.length)).map(s=>s.ind);while(next.length<popSize){const p1=scored[Math.floor(Math.random()*Math.min(12,scored.length))].ind,p2=scored[Math.floor(Math.random()*Math.min(12,scored.length))].ind;let child={itemOrder:crossoverOrder(p1.itemOrder,p2.itemOrder),splitMode:Math.random()<0.5?p1.splitMode:p2.splitMode};if(Math.random()<0.2)child.itemOrder=mutateOrder(child.itemOrder);if(Math.random()<0.1)child.splitMode=SPLIT_MODES[Math.floor(Math.random()*SPLIT_MODES.length)];next.push(child);}pop=next;}if(gen<gens)setTimeout(step,0);else{if(best?.result)resolve(best.result.map(r=>({...r,engineTag:'genetic',gaScore:bestScore})));else resolve(runOptimization(sizes,parts,settings,material,scrapPieces));}}setTimeout(step,0);}); }

function packSecondaryParts(sheets, parts, settings, opts={}) {
  const items = buildItemsFromParts(parts, settings).map(it => ({...it, color: T.green, isSecondary: true}));
  let remaining = items;
  const newSheets = sheets.map(sh => {
    if(!remaining.length) return sh;
    const initialFreeRects = sh.freeRects.map(r => ({...r}));
    const {placements, leftover, freeRects} = packOneBin(sh.usableW, sh.usableH, remaining, settings, { ...opts, initialFreeRects });
    remaining = leftover;
    return {
      ...sh,
      placements: [...sh.placements, ...placements],
      freeRects,
      secondaryPlacements: placements
    };
  });
  return { sheets: newSheets, unplaced: remaining };
}

function collectScrapCandidates(option,minScrap){ const out=[];option.sheets.forEach((sh,si)=>sh.freeRects.forEach(r=>{if(r.w>=minScrap&&r.h>=minScrap)out.push({sheetIndex:si,length:Math.round(r.w),width:Math.round(r.h)});}));return out; }

/* ─── AI Quality Scoring ─── */
function aiQualityScore(result) {
  if (!result) return { score: 0, grade: 'N/A', color: '#64748b', reason: '' };
  const util = result.utilization;
  const unplaced = result.unplaced?.length || 0;
  let score = Math.round(util * 0.7 + (unplaced === 0 ? 30 : 0));
  score = Math.min(100, score);
  let grade, color, reason;
  if (score >= 88) { grade = 'Excellent'; color = '#10b981'; reason = 'Maximum material efficiency achieved'; }
  else if (score >= 72) { grade = 'Good'; color = '#3b82f6'; reason = 'Good utilization with minor scrap'; }
  else if (score >= 55) { grade = 'Warning'; color = '#f59e0b'; reason = 'Significant scrap detected; consider alternate sheet sizes'; }
  else { grade = 'Poor'; color = '#ef4444'; reason = 'Low utilization — adjust part mix or sheet selection'; }
  if (unplaced > 0) { grade = 'Critical'; color = '#ef4444'; reason = `${unplaced} parts could not be placed`; }
  return { score, grade, color, reason };
}

function aiAutoSelectAlgorithm(parts) {
  const total = parts.reduce((s, p) => s + (parseInt(p.qty) || 0), 0);
  if (total > 50) return 'genetic';
  return 'fast';
}


/* ─── DXF Parsing ─── */
function parseDxfDimensions(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parser = new window.DxfParser();
        const dxf = parser.parseSync(e.target.result);
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let hasEntities = false;
        
        const updateBounds = (x, y) => {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        };

        const processEntity = (ent) => {
          if (ent.type === 'LINE') {
            updateBounds(ent.vertices[0].x, ent.vertices[0].y);
            updateBounds(ent.vertices[1].x, ent.vertices[1].y);
            hasEntities = true;
          } else if (ent.type === 'CIRCLE' || ent.type === 'ARC') {
            const r = ent.radius;
            updateBounds(ent.center.x - r, ent.center.y - r);
            updateBounds(ent.center.x + r, ent.center.y + r);
            hasEntities = true;
          } else if (ent.type === 'LWPOLYLINE' || ent.type === 'POLYLINE') {
            ent.vertices.forEach(v => updateBounds(v.x, v.y));
            hasEntities = true;
          } else if (ent.type === 'INSERT') {
             updateBounds(ent.position.x, ent.position.y);
          }
        };

        dxf.entities.forEach(processEntity);

        if (!hasEntities) throw new Error("No usable geometry found in DXF");
        
        const length = Math.ceil(maxX - minX);
        const width = Math.ceil(maxY - minY);
        
        resolve({ length, width });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

/* ─── DXF Export (preserved) ─── */
function dxfN(n){ const v=Math.round((n+Number.EPSILON)*1000)/1000;return(Object.is(v,-0)?0:v).toString(); }
function dxfLine(x1,y1,x2,y2,layer){ return`0\nLINE\n8\n${layer}\n10\n${dxfN(x1)}\n20\n${dxfN(y1)}\n30\n0\n11\n${dxfN(x2)}\n21\n${dxfN(y2)}\n31\n0\n`; }
function dxfRect(x,y,w,h,layer){ return dxfLine(x,y,x+w,y,layer)+dxfLine(x+w,y,x+w,y+h,layer)+dxfLine(x+w,y+h,x,y+h,layer)+dxfLine(x,y+h,x,y,layer); }
function dxfText(x,y,height,value,layer){ return`0\nTEXT\n8\n${layer}\n10\n${dxfN(x)}\n20\n${dxfN(y)}\n30\n0\n40\n${dxfN(Math.max(height,0.1))}\n1\n${String(value).replace(/[\r\n]+/g,' ')}\n`; }
const DXF_LAYERS=[{name:'SHEET_OUTLINE',color:7},{name:'PARTS',color:5},{name:'PART_LABELS',color:3},{name:'SECONDARY_PARTS',color:3},{name:'LABELS',color:1}];
function buildDxfForOption(option,material,jobNo){ let entities='';const thickness=material?.thickness||'';const sheets=option.sheets||[];const maxDim=sheets.reduce((m,sh)=>Math.max(m,sh.usableW,sh.usableH),100),sheetGap=Math.max(maxDim*0.06,100);let offsetX=0;sheets.forEach((sheet,sIdx)=>{const sw=sheet.usableW,sh=sheet.usableH,labelH=Math.max(maxDim*0.022,20);entities+=dxfRect(offsetX,0,sw,sh,'SHEET_OUTLINE');entities+=dxfText(offsetX,sh+labelH*1.4,labelH,`SHEET ${sIdx+1} OF ${sheets.length}${jobNo?' '+jobNo:''}${sheet.source==='scrap'?' — REUSED SCRAP':''}`, 'LABELS');if(thickness)entities+=dxfText(offsetX,sh+labelH*0.2,labelH,`THICKNESS: ${thickness} MM`,'LABELS');(sheet.placements||[]).forEach(p=>{entities+=dxfRect(offsetX+p.x,p.y,p.w,p.h, p.isSecondary ? 'SECONDARY_PARTS' : 'PARTS');const th=Math.max(Math.min(p.w,p.h)*0.16,labelH*0.5);entities+=dxfText(offsetX+p.x+Math.min(p.w,p.h)*0.08,p.y+p.h/2-th/2,th,`${p.partNo}${p.rotated?' R':''}`,'PART_LABELS');});offsetX+=sw+sheetGap;});const layerDefs=DXF_LAYERS.map(l=>`0\nLAYER\n2\n${l.name}\n70\n0\n62\n${l.color}\n6\nCONTINUOUS\n`).join('');return`0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n${DXF_LAYERS.length}\n${layerDefs}0\nENDTAB\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n`+entities+`0\nENDSEC\n0\nEOF\n`; }
function downloadDxf(option,material,jobNo){ const content=buildDxfForOption(option,material,jobNo),blob=new Blob([content],{type:'application/dxf'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${(jobNo||'JOB').replace(/[^\w-]+/g,'')}_${(option.sizeLabel||'layout').replace(/[^\w]+/g,'')}.dxf`;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url); }

/* ─── CSV parsing (preserved) ─── */
function parseCsvParts(text){ const lines=text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);if(!lines.length)return[];const rows=lines.map(l=>l.split(/,|\t/).map(c=>c.trim()));let header=rows[0].map(c=>c.toLowerCase());const looksLikeHeader=header.some(c=>/part|length|width|qty/.test(c));const dataRows=looksLikeHeader?rows.slice(1):rows;const idx={partNo:header.findIndex(c=>/part/.test(c)),length:header.findIndex(c=>/length|len\b/.test(c)),width:header.findIndex(c=>/width|wid\b/.test(c)),qty:header.findIndex(c=>/qty|quantity/.test(c))};const useDefault=!looksLikeHeader||idx.partNo===-1;return dataRows.map((r,i)=>useDefault?{id:uid('p'),partNo:r[0]||`P${i+1}`,length:parseFloat(r[1])||0,width:parseFloat(r[2])||0,qty:parseInt(r[3])||1,priority:'Normal',allowRotation:true,shapeType:'rectangle'}:{id:uid('p'),partNo:r[idx.partNo]||`P${i+1}`,length:parseFloat(r[idx.length>=0?idx.length:1])||0,width:parseFloat(r[idx.width>=0?idx.width:2])||0,qty:parseInt(r[idx.qty>=0?idx.qty:3])||1,priority:'Normal',allowRotation:true,shapeType:'rectangle'}).filter(p=>p.length>0&&p.width>0); }

/* ─── Seed Data ─── */
const SEED_STANDARD_PARTS=[{id:uid('sp'),partNo:'BKT-01',name:'Bracket Small',length:120,width:80,qty:0,priority:'High',allowRotation:true,shapeType:'lshape',cutoutLength:60,cutoutWidth:40,materialName:'Stainless Steel (SS304 2B)',thickness:3,currentStock:5,targetStock:50},{id:uid('sp'),partNo:'PLT-CLP',name:'Clamp Plate',length:60,width:60,qty:0,priority:'Medium',allowRotation:true,shapeType:'circle',materialName:'Stainless Steel (SS304 2B)',thickness:3,currentStock:12,targetStock:30},{id:uid('sp'),partNo:'SUP-05',name:'Support Clip',length:90,width:45,qty:0,priority:'Low',allowRotation:true,shapeType:'triangle',materialName:'Stainless Steel (SS304 2B)',thickness:3,currentStock:8,targetStock:100},{id:uid('sp'),partNo:'GUS-22',name:'Gusset Plate',length:150,width:150,qty:0,priority:'Normal',allowRotation:true,shapeType:'trapezoid',sideA:150,sideB:50,materialName:'Mild Steel (IS2062)',thickness:5,currentStock:0,targetStock:40}];

const SEED_MATERIALS=[{id:uid('mat'),name:'Stainless Steel',grade:'SS304 2B',thickness:3,density:8000,costPerKg:0,costPerSqm:2160,supplier:'Jindal',stock:5000,sheetSizes:[{id:uid('sz'),l:2500,w:1250},{id:uid('sz'),l:3000,w:1500}]},{id:uid('mat'),name:'Mild Steel',grade:'IS2062',thickness:5,density:7850,costPerKg:62,costPerSqm:0,supplier:'SAIL',stock:8000,sheetSizes:[{id:uid('sz'),l:2500,w:1250},{id:uid('sz'),l:3000,w:1500},{id:uid('sz'),l:4000,w:2000}]}];

/* ══════════════════════════════════════════════
   UI COMPONENTS - DARK INDUSTRIAL DESIGN
══════════════════════════════════════════════ */

/* ─── Design Tokens ─── */
const T = {
  bg: '#080b10', panel: '#0e1117', card: '#161b24', cardHover: '#1c2333',
  border: '#1e2a3a', borderLight: '#2a3a52',
  text: '#e2e8f0', textMuted: '#64748b', textDim: '#94a3b8',
  blue: '#3b82f6', green: '#10b981', orange: '#f59e0b', red: '#ef4444',
  purple: '#8b5cf6', cyan: '#06b6d4', pink: '#ec4899',
  fontBody: 'Inter, sans-serif', fontMono: 'JetBrains Mono, monospace', fontDisplay: 'Rajdhani, sans-serif',
};

/* ─── Icon Set (inline SVG paths) ─── */
function Icon({ d, size = 18, color = 'currentColor', style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={style}>
      {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
    </svg>
  );
}
const ICONS = {
  dashboard: ['M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z','M9 22V12h6v10'],
  materials: 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z',
  newjob: ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z','M10 8l6 4-6 4V8z'],
  results: ['M12 2L2 7l10 5 10-5-10-5z','M2 17l10 5 10-5','M2 12l10 5 10-5'],
  jobs: ['M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2','M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2','M9 12h6','M9 16h4'],
  scrap: 'M7 19H4.815a1.83 1.83 0 01-1.57-.881 1.785 1.785 0 01-.004-1.784L7.196 9.5M11 19h8.203a1.83 1.83 0 001.556-.89 1.784 1.784 0 000-1.775l-1.226-2.12M14 16l-3 3 3 3M8.293 13.596L7.196 9.5l-4.096 1.098M9.344 5.811l1.093-1.892A1.83 1.83 0 0111.985 3a1.784 1.784 0 011.546.888l3.943 6.843M13.378 9.633l4.096 1.098 1.097-4.096',
  plus: ['M12 5v14','M5 12h14'],
  trash: ['M3 6h18','M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6','M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2'],
  save: ['M15.2 3a2 2 0 011.4.6l3.8 3.8a2 2 0 01.6 1.4V19a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z','M17 21v-7a1 1 0 00-1-1H8a1 1 0 00-1 1v7','M7 3v4a1 1 0 001 1h7'],
  upload: ['M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4','M17 8l-5-5-5 5','M12 3v12'],
  check: ['M22 11.08V12a10 10 0 11-5.93-9.14','M22 4L12 14.01l-3-3'],
  warn: ['M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z','M12 9v4','M12 17h.01'],
  trend: ['M22 7l-9.5 9.5-5-5L1 17','M16 7h6v6'],
  gear: ['M20 7h-9','M14 17H5','M17 17a3 3 0 100-6 3 3 0 000 6z','M7 7a3 3 0 100-6 3 3 0 000 6z'],
  brain: 'M12 5a3 3 0 01-5.997 .125A3 3 0 015.003 8H5a4 4 0 000 8h.5a1.5 1.5 0 110 3H5a2 2 0 010-4 4 4 0 01-4-4V8a7 7 0 0114 0v1a3 3 0 01-3 3h-1a3 3 0 01-3-3V5z',
  x: ['M18 6L6 18','M6 6l12 12'],
  folder: 'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z',
  zoomIn: ['M11 19a8 8 0 100-16 8 8 0 000 16z','M21 21l-4.35-4.35','M11 8v6','M8 11h6'],
  zoomOut: ['M11 19a8 8 0 100-16 8 8 0 000 16z','M21 21l-4.35-4.35','M8 11h6'],
  chevLeft: 'M15 18l-6-6 6-6',
  chevRight: 'M9 18l6-6-6-6',
  rotate: ['M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8','M21 3v5h-5'],
  report: ['M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z','M14 2v6h6','M16 13H8','M16 17H8','M10 9H8'],
  loader: 'M21 12a9 9 0 11-6.219-8.56',
  chip: ['M18 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2z','M9 9h6v6H9z','M9 1v3','M15 1v3','M9 20v3','M15 20v3','M20 9h3','M20 15h3','M1 9h3','M1 15h3'],
};

/* ─── Primitive UI atoms ─── */
function Btn({ children, onClick, variant='primary', disabled, size='md', icon, type='button' }) {
  const styles = {
    primary: { background: T.blue, color: '#fff', border: 'none' },
    success: { background: T.green, color: '#fff', border: 'none' },
    danger: { background: T.red, color: '#fff', border: 'none' },
    ghost: { background: 'transparent', color: T.textDim, border: `1px solid ${T.border}` },
    dark: { background: T.card, color: T.text, border: `1px solid ${T.border}` },
    outline: { background: 'transparent', color: T.text, border: `1px solid ${T.border}` },
    accent: { background: T.green, color: '#fff', border: 'none' },
  };
  const sizes = { sm: 'padding:5px 10px;font-size:12px;', md: 'padding:8px 14px;font-size:13px;' };
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      ...styles[variant], borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.45 : 1, display: 'inline-flex', alignItems: 'center', gap: 6,
      fontFamily: T.fontBody, fontWeight: 600, transition: 'opacity 0.15s', ...Object.fromEntries(sizes[size].split(';').filter(Boolean).map(s => { const [k, v] = s.split(':'); return [k.trim().replace(/-([a-z])/g, (_,c) => c.toUpperCase()), v?.trim()]; })),
    }}>
      {icon && <Icon d={ICONS[icon]} size={size === 'sm' ? 13 : 15} color="currentColor" />}
      {children}
    </button>
  );
}

function Card({ children, style = {} }) {
  return <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: '1.25rem', ...style }}>{children}</div>;
}

function Badge({ children, color = T.blue }) {
  return <span style={{ background: `${color}20`, color, border: `1px solid ${color}40`, borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', fontFamily: T.fontMono }}>{children}</span>;
}

function Input(props) {
  return <input {...props} style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 13, color: T.text, width: '100%', fontFamily: T.fontMono, outline: 'none', ...props.style }} />;
}
function Select(props) {
  return <select {...props} style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 13, color: T.text, width: '100%', fontFamily: T.fontBody, outline: 'none', ...props.style }} />;
}
function Field({ label, children, hint }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: 11, color: T.textMuted }}>{hint}</span>}
    </label>
  );
}

function SectionHeader({ eyebrow, title, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
      <div>
        {eyebrow && <div style={{ fontSize: 11, fontWeight: 700, color: T.blue, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>{eyebrow}</div>}
        <h2 style={{ fontFamily: T.fontDisplay, fontSize: 26, fontWeight: 700, color: T.text, margin: 0, letterSpacing: '0.03em' }}>{title}</h2>
      </div>
      {action}
    </div>
  );
}

function EmptyState({ title, body, action }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12, padding: '3rem 1rem' }}>
      <div style={{ width: 48, height: 48, borderRadius: '50%', background: T.panel, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Icon d={ICONS.warn} size={20} color={T.textMuted} />
      </div>
      <div>
        <div style={{ fontWeight: 600, color: T.text, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13, color: T.textMuted, maxWidth: 320 }}>{body}</div>
      </div>
      {action}
    </div>
  );
}

function Modal({ title, children, onClose, wide }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto', width: '100%', maxWidth: wide ? 760 : 560, boxShadow: '0 25px 60px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ fontFamily: T.fontDisplay, fontSize: 20, fontWeight: 700, color: T.text, margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textMuted }}><Icon d={ICONS.x} size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ─── Stat Card ─── */
function StatCard({ label, value, sub, color = T.blue, icon }) {
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</span>
        {icon && <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}20`, display: 'flex', justifyContent: 'center', alignItems: 'center' }}><Icon d={ICONS[icon]} size={15} color={color} /></div>}
      </div>
      <div style={{ fontFamily: T.fontDisplay, fontSize: 28, fontWeight: 700, color, letterSpacing: '0.03em' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{sub}</div>}
    </Card>
  );
}

/* ─── Utilization Arc ─── */
function UtilArc({ pct, size = 120 }) {
  const r = 44, cx = 60, cy = 60, circumference = 2 * Math.PI * r;
  const color = pct >= 80 ? T.green : pct >= 60 ? T.orange : T.red;
  const dash = (pct / 100) * circumference * 0.75;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={T.border} strokeWidth={10} strokeDasharray={circumference * 0.75} strokeDashoffset={0} transform="rotate(135 60 60)" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={10} strokeDasharray={`${dash} ${circumference}`} strokeDashoffset={0} transform="rotate(135 60 60)" strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.6s ease' }} />
      <text x={cx} y={cy - 4} textAnchor="middle" fill={color} fontSize={20} fontWeight={700} fontFamily={T.fontDisplay}>{Math.round(pct)}%</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill={T.textMuted} fontSize={10} fontFamily={T.fontBody}>Utilization</text>
    </svg>
  );
}

/* ════════════════════════════════════════
   DASHBOARD
════════════════════════════════════════ */
function Dashboard({ jobsIndex, scrapInventory, materials, onGoto }) {
  const completed = jobsIndex.filter(j => j.status === 'Completed');
  const avgUtil = completed.length ? completed.reduce((s, j) => s + j.utilization, 0) / completed.length : 0;
  const totalCost = completed.reduce((s, j) => s + j.cost, 0);
  const availScrap = scrapInventory.filter(s => s.status === 'Available');
  return (
    <div className="slide-up">
      <SectionHeader eyebrow="Overview" title="Production Dashboard" action={<Btn icon="newjob" onClick={() => onGoto('newjob')}>New Job</Btn>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12, marginBottom: 24 }}>
        <StatCard label="Total Jobs" value={fmt(jobsIndex.length)} color={T.blue} icon="jobs" />
        <StatCard label="Avg Utilization" value={`${fmt(avgUtil, 1)}%`} color={T.green} icon="trend" sub={`${completed.length} completed jobs`} />
        <StatCard label="Total Material Cost" value={fmtCurrency(totalCost)} color={T.orange} icon="report" />
        <StatCard label="Scrap In Stock" value={fmt(availScrap.length)} color={T.purple} icon="scrap" sub="Ready to reuse" />
      </div>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontFamily: T.fontDisplay, fontSize: 16, fontWeight: 700, color: T.text }}>Recent Jobs</span>
          <Btn size="sm" variant="ghost" onClick={() => onGoto('jobs')}>View all</Btn>
        </div>
        {jobsIndex.length === 0 ? (
          <EmptyState title="No jobs yet" body="Create your first nesting job to see metrics here." action={<Btn icon="plus" onClick={() => onGoto('newjob')}>Create Job</Btn>} />
        ) : (
          jobsIndex.slice(0, 6).map(j => (
            <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${T.border}` }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: `${T.blue}18`, display: 'flex', justifyContent: 'center', alignItems: 'center' }}><Icon d={ICONS.jobs} size={15} color={T.blue} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.jobNo} · {j.project || 'Untitled'}</div>
                <div style={{ fontSize: 12, color: T.textMuted }}>{j.materialName} · {j.sheetsUsed} sheet(s) · {fmt(j.utilization, 1)}%</div>
              </div>
              <span style={{ fontFamily: T.fontMono, fontWeight: 700, color: T.green, fontSize: 13 }}>{fmtCurrency(j.cost)}</span>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}

/* ════════════════════════════════════════
   MATERIALS MASTER
════════════════════════════════════════ */
function MaterialsPanel({ materials, setMaterials, persist }) {
  const [editing, setEditing] = useState(null);

  const blank = () => ({ id: uid('mat'), name: '', grade: '', thickness: 3, density: 7850, costPerKg: 0, costPerSqm: 0, supplier: '', stock: 0, sheetSizes: [] });
  const save = mat => { const exists = materials.some(m => m.id === mat.id); const next = exists ? materials.map(m => m.id === mat.id ? mat : m) : [...materials, mat]; setMaterials(next); persist('materials', next); setEditing(null); };
  const remove = id => { const next = materials.filter(m => m.id !== id); setMaterials(next); persist('materials', next); };
  return (
    <div className="slide-up">
      <SectionHeader eyebrow="Master Data" title="Material Master" action={<Btn icon="plus" onClick={() => setEditing(blank())}>Add Material</Btn>} />
      {materials.length === 0 ? <Card><EmptyState title="No materials" body="Add a material to start building nesting jobs." action={<Btn icon="plus" onClick={() => setEditing(blank())}>Add Material</Btn>} /></Card> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 12 }}>
          {materials.map(m => (
            <Card key={m.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontFamily: T.fontDisplay, fontSize: 18, fontWeight: 700, color: T.text }}>{m.name} <span style={{ fontSize: 13, fontWeight: 400, color: T.textMuted }}>· {m.grade}</span></div>
                  <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{m.thickness}mm · {m.supplier || 'no supplier'}</div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => setEditing(m)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.blue }}><Icon d={ICONS.gear} size={15} /></button>
                  <button onClick={() => remove(m.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.red }}><Icon d={ICONS.trash} size={15} /></button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 12, fontFamily: T.fontMono, color: T.textDim }}>
                <span>₹/sqm: <b style={{ color: T.text }}>{m.costPerSqm || '—'}</b></span>
                <span>₹/kg: <b style={{ color: T.text }}>{m.costPerKg || '—'}</b></span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {(m.sheetSizes || []).map(s => <Badge key={s.id} color={T.blue}>{s.l} × {s.w}</Badge>)}
                {!m.sheetSizes?.length && <span style={{ fontSize: 12, color: T.textMuted }}>No sheet sizes</span>}
              </div>
            </Card>
          ))}
        </div>
      )}
      {editing && <MaterialModal material={editing} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}

function MaterialModal({ material, onClose, onSave }) {
  const [m, setM] = useState(material);
  const set = (k, v) => setM(p => ({ ...p, [k]: v }));
  const addSize = () => setM(p => ({ ...p, sheetSizes: [...p.sheetSizes, { id: uid('sz'), l: 2500, w: 1250 }] }));
  const updSize = (id, k, v) => setM(p => ({ ...p, sheetSizes: p.sheetSizes.map(s => s.id === id ? { ...s, [k]: parseFloat(v) || 0 } : s) }));
  const rmSize = id => setM(p => ({ ...p, sheetSizes: p.sheetSizes.filter(s => s.id !== id) }));
  return (
    <Modal title={material.name ? 'Edit Material' : 'Add Material'} onClose={onClose}>
      
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        <Field label="Material Name"><Input value={m.name} onChange={e => set('name', e.target.value)} placeholder="Stainless Steel" /></Field>
        <Field label="Grade / Finish"><Input value={m.grade} onChange={e => set('grade', e.target.value)} placeholder="SS304 2B" /></Field>
        <Field label="Thickness (mm)"><Input type="number" value={m.thickness} onChange={e => set('thickness', parseFloat(e.target.value) || 0)} /></Field>
        <Field label="Density (kg/m³)"><Input type="number" value={m.density} onChange={e => set('density', parseFloat(e.target.value) || 0)} /></Field>
        <Field label="Cost per Kg (₹)"><Input type="number" value={m.costPerKg} onChange={e => set('costPerKg', parseFloat(e.target.value) || 0)} /></Field>
        <Field label="Cost per Sqm (₹)"><Input type="number" value={m.costPerSqm} onChange={e => set('costPerSqm', parseFloat(e.target.value) || 0)} /></Field>
        <Field label="Supplier"><Input value={m.supplier} onChange={e => set('supplier', e.target.value)} /></Field>
        <Field label="Stock (kg)"><Input type="number" value={m.stock} onChange={e => set('stock', parseFloat(e.target.value) || 0)} /></Field>
      </div>
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase' }}>Sheet Sizes (mm)</span>
          <Btn size="sm" variant="ghost" icon="plus" onClick={addSize}>Add</Btn>
        </div>
        {m.sheetSizes.map(s => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Input type="number" value={s.l} onChange={e => updSize(s.id, 'l', e.target.value)} style={{ width: 100 }} />
            <span style={{ color: T.textMuted }}>×</span>
            <Input type="number" value={s.w} onChange={e => updSize(s.id, 'w', e.target.value)} style={{ width: 100 }} />
            <button onClick={() => rmSize(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.red }}><Icon d={ICONS.trash} size={14} /></button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn icon="save" onClick={() => onSave(m)} disabled={!m.name}>Save Material</Btn>
      </div>
    </Modal>
  );
}

/* ════════════════════════════════════════
   NEW JOB
════════════════════════════════════════ */
function NewJobPanel({ materials, scrapInventory, onOptimize, draft, setDraft, optimizing, optimizeProgress }) {
  const material = materials.find(m => m.id === draft.materialId) || null;
  const fileRef = useRef(null);
  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));
  const toggleSize = id => setDraft(d => ({ ...d, selectedSizeIds: d.selectedSizeIds.includes(id) ? d.selectedSizeIds.filter(x => x !== id) : [...d.selectedSizeIds, id] }));
  const toggleScrap = id => setDraft(d => ({ ...d, selectedScrapIds: (d.selectedScrapIds || []).includes(id) ? (d.selectedScrapIds || []).filter(x => x !== id) : [...(d.selectedScrapIds || []), id] }));
  const addPart = () => setDraft(d => ({ ...d, parts: [...d.parts, { id: uid('p'), partNo: `P${d.parts.length + 1}`, length: 0, width: 0, qty: 1, priority: 'Normal', allowRotation: true, shapeType: 'rectangle', cutoutLength: 0, cutoutWidth: 0, sideA: 0, sideB: 0 }] }));
  const updPart = (id, k, v) => setDraft(d => ({ ...d, parts: d.parts.map(p => p.id === id ? { ...p, [k]: v } : p) }));
  const rmPart = id => setDraft(d => ({ ...d, parts: d.parts.filter(p => p.id !== id) }));
  const handleFile = e => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => { const p = parseCsvParts(String(r.result)); if (p.length) setDraft(d => ({ ...d, parts: [...d.parts.filter(p => p.length && p.width), ...p] })); }; r.readAsText(f); e.target.value = ''; };
  const matchingScrap = material ? scrapInventory.filter(s => s.status !== 'Used' && parseFloat(s.thickness) === parseFloat(material.thickness)) : [];
  const selectedScrapIds = draft.selectedScrapIds || [];
  const selectedSizes = material ? material.sheetSizes.filter(s => draft.selectedSizeIds.includes(s.id)) : [];
  const selectedScrapPieces = matchingScrap.filter(s => selectedScrapIds.includes(s.id));
  const canRun = material && (selectedSizes.length > 0 || selectedScrapPieces.length > 0) && draft.parts.some(p => p.length > 0 && p.width > 0 && p.qty > 0);
  const aiSuggested = material ? aiAutoSelectAlgorithm(draft.parts) : null;

  return (
    <div className="slide-up">
      <SectionHeader eyebrow="Nesting" title="New Nesting Job" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <Card>
          <div style={{ fontFamily: T.fontDisplay, fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 12 }}>Job Details</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <Field label="Job Number"><Input value={draft.jobNo} onChange={e => set('jobNo', e.target.value)} /></Field>
            <Field label="Project"><Input value={draft.project} onChange={e => set('project', e.target.value)} placeholder="Fire Panel Batch 12" /></Field>
            <Field label="Customer"><Input value={draft.customer} onChange={e => set('customer', e.target.value)} /></Field>
            <Field label="Material">
              <Select value={draft.materialId} onChange={e => set('materialId', e.target.value)}>
                <option value="">Select material…</option>
                {materials.map(m => <option key={m.id} value={m.id}>{m.name} · {m.grade} · {m.thickness}mm</option>)}
              </Select>
            </Field>
          </div>
          {material && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', marginBottom: 8 }}>Candidate Sheet Sizes</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {material.sheetSizes.map(s => (
                  <label key={s.id} style={{ cursor: 'pointer' }}>
                    <input type="checkbox" style={{ display: 'none' }} checked={draft.selectedSizeIds.includes(s.id)} onChange={() => toggleSize(s.id)} />
                    <span style={{ display: 'inline-block', padding: '5px 10px', borderRadius: 6, fontFamily: T.fontMono, fontSize: 12, background: draft.selectedSizeIds.includes(s.id) ? T.blue : T.panel, color: draft.selectedSizeIds.includes(s.id) ? '#fff' : T.textDim, border: `1px solid ${draft.selectedSizeIds.includes(s.id) ? T.blue : T.border}`, transition: '0.15s' }}>{s.l} × {s.w}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontFamily: T.fontDisplay, fontSize: 15, fontWeight: 700, color: T.text }}>Optimization Settings</div>
            {aiSuggested && <Badge color={T.green}>AI: Use {aiSuggested === 'genetic' ? 'Deep' : 'Fast'}</Badge>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Engine Mode">
              <Select value={draft.settings.optimizeMode || 'fast'} onChange={e => setDraft(d => ({ ...d, settings: { ...d.settings, optimizeMode: e.target.value } }))}>
                <option value="fast">Fast — BSSF Greedy</option>
                <option value="genetic">Deep — Genetic Search</option>
              </Select>
            </Field>
            <Field label="Genetic Generations" hint={draft.settings.optimizeMode === 'genetic' ? 'More = better, slower' : 'Only in Deep mode'}>
              <Input type="number" value={draft.settings.gaGenerations || 80} disabled={draft.settings.optimizeMode !== 'genetic'} onChange={e => setDraft(d => ({ ...d, settings: { ...d.settings, gaGenerations: parseInt(e.target.value) || 80 } }))} />
            </Field>
            <Field label="Laser Kerf (mm)"><Input type="number" value={draft.settings.kerf} onChange={e => setDraft(d => ({ ...d, settings: { ...d.settings, kerf: parseFloat(e.target.value) || 0 } }))} /></Field>
            <Field label="Part Gap (mm)"><Input type="number" value={draft.settings.gap} onChange={e => setDraft(d => ({ ...d, settings: { ...d.settings, gap: parseFloat(e.target.value) || 0 } }))} /></Field>
            <Field label="Edge Margin (mm)"><Input type="number" value={draft.settings.margin} onChange={e => setDraft(d => ({ ...d, settings: { ...d.settings, margin: parseFloat(e.target.value) || 0 } }))} /></Field>
            <Field label="Min Reusable Scrap (mm)"><Input type="number" value={draft.settings.minScrap} onChange={e => setDraft(d => ({ ...d, settings: { ...d.settings, minScrap: parseFloat(e.target.value) || 0 } }))} /></Field>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 13, color: T.textDim, cursor: 'pointer' }}>
            <input type="checkbox" checked={draft.settings.allowRotation} onChange={e => setDraft(d => ({ ...d, settings: { ...d.settings, allowRotation: e.target.checked } }))} />
            Allow 90° rotation (rectangles)
          </label>
        </Card>
      </div>

      {material && matchingScrap.length > 0 && (
        <Card style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Icon d={ICONS.scrap} size={15} color={T.green} />
            <span style={{ fontFamily: T.fontDisplay, fontSize: 14, fontWeight: 700, color: T.text }}>Reuse Scrap Inventory</span>
            <Badge color={T.green}>{matchingScrap.length} available at {material.thickness}mm</Badge>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {matchingScrap.map(s => (
              <label key={s.id} style={{ cursor: 'pointer' }}>
                <input type="checkbox" style={{ display: 'none' }} checked={selectedScrapIds.includes(s.id)} onChange={() => toggleScrap(s.id)} />
                <span style={{ display: 'inline-block', padding: '5px 10px', borderRadius: 6, fontFamily: T.fontMono, fontSize: 12, background: selectedScrapIds.includes(s.id) ? T.green : T.panel, color: selectedScrapIds.includes(s.id) ? '#fff' : T.textDim, border: `1px solid ${selectedScrapIds.includes(s.id) ? T.green : T.border}`, transition: '0.15s' }}>{s.length} × {s.width}</span>
              </label>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontFamily: T.fontDisplay, fontSize: 15, fontWeight: 700, color: T.text }}>Parts List <span style={{ fontSize: 13, fontWeight: 400, color: T.textMuted }}>({draft.parts.length} rows · {fmt(draft.parts.reduce((s, p) => s + (parseInt(p.qty) || 0), 0))} pcs)</span></span>
          <div style={{ display: 'flex', gap: 8 }}>
            <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={handleFile} />
            <Btn size="sm" variant="ghost" icon="upload" onClick={() => fileRef.current?.click()}>CSV</Btn>
            <Btn size="sm" variant="ghost" icon="plus" onClick={addPart}>Add Row</Btn>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: T.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {['Part No','Shape','Length','Width','Extra','Qty','Priority','Rotate',''].map((h, i) => <th key={i} style={{ textAlign: 'left', paddingBottom: 8, paddingRight: 8, fontWeight: 600 }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {draft.parts.map(p => (
                <tr key={p.id} style={{ borderTop: `1px solid ${T.border}` }}>
                  <td style={{ padding: '6px 8px 6px 0' }}><Input value={p.partNo} onChange={e => updPart(p.id, 'partNo', e.target.value)} style={{ width: 90 }} /></td>
                  <td style={{ paddingRight: 8 }}>
                    <Select value={p.shapeType || 'rectangle'} onChange={e => updPart(p.id, 'shapeType', e.target.value)} style={{ width: 110 }}>
                      <option value="rectangle">Rectangle</option>
                      <option value="lshape">L-Shape</option>
                      <option value="circle">Circle</option>
                      <option value="triangle">Triangle</option>
                      <option value="trapezoid">Trapezoid</option>
                    </Select>
                  </td>
                  <td style={{ paddingRight: 8 }}><Input type="number" value={p.length} onChange={e => updPart(p.id, 'length', parseFloat(e.target.value) || 0)} style={{ width: 80 }} /></td>
                  <td style={{ paddingRight: 8 }}><Input type="number" value={p.width} onChange={e => updPart(p.id, 'width', parseFloat(e.target.value) || 0)} style={{ width: 80 }} /></td>
                  <td style={{ paddingRight: 8 }}>
                    {p.shapeType === 'lshape' && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Input type="number" value={p.cutoutLength || 0} onChange={e => updPart(p.id, 'cutoutLength', parseFloat(e.target.value) || 0)} style={{ width: 58 }} />
                        <Input type="number" value={p.cutoutWidth || 0} onChange={e => updPart(p.id, 'cutoutWidth', parseFloat(e.target.value) || 0)} style={{ width: 58 }} />
                      </div>
                    )}
                    {p.shapeType === 'trapezoid' && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Input type="number" value={p.sideA || 0} onChange={e => updPart(p.id, 'sideA', parseFloat(e.target.value) || 0)} style={{ width: 58 }} placeholder="A" />
                        <Input type="number" value={p.sideB || 0} onChange={e => updPart(p.id, 'sideB', parseFloat(e.target.value) || 0)} style={{ width: 58 }} placeholder="B" />
                      </div>
                    )}
                    {!['lshape','trapezoid'].includes(p.shapeType) && <span style={{ fontSize: 11, color: T.textMuted }}>—</span>}
                  </td>
                  <td style={{ paddingRight: 8 }}><Input type="number" value={p.qty} onChange={e => updPart(p.id, 'qty', parseInt(e.target.value) || 0)} style={{ width: 60 }} /></td>
                  <td style={{ paddingRight: 8 }}>
                    <Select value={p.priority} onChange={e => updPart(p.id, 'priority', e.target.value)} style={{ width: 90 }}>
                      <option>Urgent</option><option>Normal</option><option>Low</option>
                    </Select>
                  </td>
                  <td style={{ paddingRight: 8, textAlign: 'center' }}>
                    <input type="checkbox" checked={p.allowRotation !== false && (p.shapeType || 'rectangle') === 'rectangle'} disabled={(p.shapeType || 'rectangle') !== 'rectangle'} onChange={e => updPart(p.id, 'allowRotation', e.target.checked)} />
                  </td>
                  <td><button onClick={() => rmPart(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.red }}><Icon d={ICONS.trash} size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!draft.parts.length && <div style={{ textAlign: 'center', padding: '2rem', color: T.textMuted, fontSize: 13 }}>No parts yet — add a row or upload a CSV.</div>}
        </div>
      </Card>

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: 16 }}>
        {optimizing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: T.orange, fontFamily: T.fontMono }}>
            <Icon d={ICONS.loader} size={14} color={T.orange} style={{ animation: 'spin 1s linear infinite' }} />
            {draft.settings.optimizeMode === 'genetic' ? `Genetic search ${optimizeProgress || 0}%` : 'Optimizing…'}
          </div>
        )}
        <Btn icon="newjob" disabled={!canRun || optimizing} onClick={() => onOptimize(material, selectedSizes, selectedScrapPieces)}>
          {draft.settings.optimizeMode === 'genetic' ? 'Run Deep Optimization' : 'Run Optimization'}
        </Btn>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   NESTING VIEWER — Enhanced Dark Canvas
════════════════════════════════════════ */
function NestingViewer({ option, material, jobNo }) {
  const [page, setPage] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [hoverId, setHoverId] = useState(null);
  const [showScrap, setShowScrap] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  useEffect(() => { setPage(0); setZoom(1); setHoverId(null); }, [option]);

  const sheet = option.sheets[page];
  if (!sheet) return null;
  const vbW = sheet.usableW, vbH = sheet.usableH;
  const pad = Math.max(vbW, vbH) * 0.02;
  const hoveredP = sheet.placements.find(p => p.instId === hoverId);

  // Heatmap: colour fill based on part density in region
  function partOpacity(p) {
    if (!showHeatmap) return 0.82;
    const density = sheet.placements.filter(q => Math.abs(q.x - p.x) < vbW * 0.25).length / sheet.placements.length;
    return 0.5 + density * 0.5;
  }

  function renderShape(p, hovered) {
    const stroke = hovered ? '#60a5fa' : '#0a0f1a';
    const sw = hovered ? vbW * 0.003 : vbW * 0.0015;
    const op = partOpacity(p);
    const fs = Math.min(p.w, p.h) * 0.18;
    const label = `${p.partNo}${p.rotated ? ' ↻' : ''}`;
    const st = p.shapeType || 'rectangle';
    if (st === 'circle') {
      return <g key={p.instId}><ellipse cx={p.x + p.w/2} cy={p.y + p.h/2} rx={p.w/2} ry={p.h/2} fill={p.color} fillOpacity={op} stroke={stroke} strokeWidth={sw} /><text x={p.x+p.w/2} y={p.y+p.h/2} textAnchor="middle" dominantBaseline="middle" fontSize={fs} fill="#fff" fontFamily={T.fontMono} fontWeight="700">{label}</text></g>;
    }
    if (st === 'triangle' && p.shapeData) {
      const d = `M${p.x} ${p.y+p.h} L${p.x+p.w/2} ${p.y} L${p.x+p.w} ${p.y+p.h} Z`;
      return <g key={p.instId}><path d={d} fill={p.color} fillOpacity={op} stroke={stroke} strokeWidth={sw} /><text x={p.x+p.w/2} y={p.y+p.h*0.7} textAnchor="middle" dominantBaseline="middle" fontSize={fs} fill="#fff" fontFamily={T.fontMono} fontWeight="700">{label}</text></g>;
    }
    if (st === 'trapezoid' && p.shapeData) {
      const {sideA=p.w, sideB=0} = p.shapeData;
      const off = (p.w - sideB) / 2;
      const d = `M${p.x} ${p.y+p.h} L${p.x+p.w} ${p.y+p.h} L${p.x+p.w-off} ${p.y} L${p.x+off} ${p.y} Z`;
      return <g key={p.instId}><path d={d} fill={p.color} fillOpacity={op} stroke={stroke} strokeWidth={sw} /><text x={p.x+p.w/2} y={p.y+p.h/2} textAnchor="middle" dominantBaseline="middle" fontSize={fs} fill="#fff" fontFamily={T.fontMono} fontWeight="700">{label}</text></g>;
    }
    if (st === 'lshape' && p.shapeData) {
      const {cutoutLength:cl=0, cutoutWidth:cw=0} = p.shapeData;
      const d = `M${p.x} ${p.y} H${p.x+p.w} V${p.y+cw} H${p.x+p.w-cl} V${p.y+p.h} H${p.x} Z`;
      return <g key={p.instId}><path d={d} fill={p.color} fillOpacity={op} stroke={stroke} strokeWidth={sw} /><text x={p.x+p.w/2} y={p.y+p.h/2} textAnchor="middle" dominantBaseline="middle" fontSize={fs} fill="#fff" fontFamily={T.fontMono} fontWeight="700">{label}</text></g>;
    }
    return <g key={p.instId}><rect x={p.x} y={p.y} width={p.w} height={p.h} fill={p.color} fillOpacity={op} stroke={stroke} strokeWidth={sw} /><text x={p.x+p.w/2} y={p.y+p.h/2} textAnchor="middle" dominantBaseline="middle" fontSize={fs} fill="#fff" fontFamily={T.fontMono} fontWeight="700">{label}</text></g>;
  }

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: T.fontDisplay, fontSize: 16, fontWeight: 700, color: T.text }}>Nesting Preview</span>
          {sheet.source === 'scrap' && <Badge color={T.green}>REUSED SCRAP {sheet.scrapLabel ? `· ${sheet.scrapLabel}` : ''}</Badge>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {/* Toggle overlays */}
          <button onClick={() => setShowScrap(v => !v)} style={{ padding: '4px 10px', borderRadius: 5, border: `1px solid ${showScrap ? T.orange : T.border}`, background: showScrap ? `${T.orange}20` : T.panel, color: showScrap ? T.orange : T.textMuted, fontSize: 12, cursor: 'pointer', fontFamily: T.fontBody }}>Scrap Zones</button>
          <button onClick={() => setShowHeatmap(v => !v)} style={{ padding: '4px 10px', borderRadius: 5, border: `1px solid ${showHeatmap ? T.red : T.border}`, background: showHeatmap ? `${T.red}20` : T.panel, color: showHeatmap ? T.red : T.textMuted, fontSize: 12, cursor: 'pointer', fontFamily: T.fontBody }}>Heatmap</button>
          <div style={{ width: 1, height: 20, background: T.border }} />
          <button onClick={() => setZoom(z => Math.max(0.4, z - 0.2))} style={{ padding: 6, borderRadius: 5, background: T.panel, border: `1px solid ${T.border}`, cursor: 'pointer', color: T.textDim }}><Icon d={ICONS.zoomOut} size={14} /></button>
          <span style={{ fontSize: 12, fontFamily: T.fontMono, color: T.textMuted, minWidth: 38, textAlign: 'center' }}>{Math.round(zoom*100)}%</span>
          <button onClick={() => setZoom(z => Math.min(3, z + 0.2))} style={{ padding: 6, borderRadius: 5, background: T.panel, border: `1px solid ${T.border}`, cursor: 'pointer', color: T.textDim }}><Icon d={ICONS.zoomIn} size={14} /></button>
          <div style={{ width: 1, height: 20, background: T.border }} />
          <button disabled={page === 0} onClick={() => setPage(p => p-1)} style={{ padding: 6, borderRadius: 5, background: T.panel, border: `1px solid ${T.border}`, cursor: 'pointer', color: T.textDim, opacity: page===0?0.3:1 }}><Icon d={ICONS.chevLeft} size={14} /></button>
          <span style={{ fontSize: 12, fontFamily: T.fontMono, color: T.text, minWidth: 70, textAlign: 'center' }}>Sheet {page+1} / {option.sheets.length}</span>
          <button disabled={page===option.sheets.length-1} onClick={() => setPage(p => p+1)} style={{ padding: 6, borderRadius: 5, background: T.panel, border: `1px solid ${T.border}`, cursor: 'pointer', color: T.textDim, opacity: page===option.sheets.length-1?0.3:1 }}><Icon d={ICONS.chevRight} size={14} /></button>
          <div style={{ width: 1, height: 20, background: T.border }} />
          <Btn size="sm" icon="save" onClick={() => downloadDxf(option, material, jobNo)}>DXF</Btn>
        </div>
      </div>

      <div style={{ background: '#05070a', borderRadius: 8, overflow: 'auto', maxHeight: 520, border: `1px solid ${T.border}` }}>
        <svg viewBox={`${-pad} ${-pad} ${vbW+pad*2} ${vbH+pad*2}`} width={vbW * zoom * 0.35} height={vbH * zoom * 0.35} style={{ display: 'block', margin: '16px auto' }}>
          {/* Sheet background */}
          <rect x={0} y={0} width={vbW} height={vbH} fill="#0d1117" stroke={T.blue} strokeWidth={vbW * 0.0025} />
          {/* Grid lines */}
          {Array.from({length: Math.floor(vbW/100)}, (_,i) => (i+1)*100).map(x => <line key={x} x1={x} y1={0} x2={x} y2={vbH} stroke="#1e2a3a" strokeWidth={vbW*0.0006} />)}
          {Array.from({length: Math.floor(vbH/100)}, (_,i) => (i+1)*100).map(y => <line key={y} x1={0} y1={y} x2={vbW} y2={y} stroke="#1e2a3a" strokeWidth={vbW*0.0006} />)}
          {/* Scrap zones */}
          {showScrap && sheet.freeRects?.map((r, i) => r.w > 20 && r.h > 20 && <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={`${T.orange}10`} stroke={T.orange} strokeWidth={vbW*0.0008} strokeDasharray={`${vbW*0.008} ${vbW*0.004}`} />)}
          {/* Parts */}
          {sheet.placements.map(p => (
            <g key={p.instId} onMouseEnter={() => setHoverId(p.instId)} onMouseLeave={() => setHoverId(h => h === p.instId ? null : h)} style={{ cursor: 'pointer' }}>
              {renderShape(p, hoverId === p.instId)}
              {hoverId === p.instId && <rect x={p.x} y={p.y} width={p.w} height={p.h} fill="none" stroke="#60a5fa" strokeWidth={vbW*0.003} rx={2} />}
              <title>{`${p.partNo} — ${Math.round(p.w)} × ${Math.round(p.h)} mm${p.rotated?' (rotated)':''}${p.priority&&p.priority!=='Normal'?' · '+p.priority:''}`}</title>
            </g>
          ))}
          {/* Hover tooltip */}
          {hoveredP && (() => {
            const fs = Math.max(vbW, vbH) * 0.022;
            const label = `${hoveredP.partNo} — ${Math.round(hoveredP.w)} × ${Math.round(hoveredP.h)} mm${hoveredP.rotated ? ' (rotated)' : ''}`;
            const bw = Math.min(vbW*0.9, label.length*fs*0.6+fs*1.5);
            let bx = hoveredP.x + hoveredP.w/2 - bw/2, by = hoveredP.y - fs*2.5;
            if (by < 0) by = hoveredP.y + hoveredP.h + fs*0.5;
            if (bx < 0) bx = 0; if (bx+bw > vbW) bx = vbW-bw;
            return <g pointerEvents="none"><rect x={bx} y={by} width={bw} height={fs*2} rx={fs*0.3} fill="#060a10" fillOpacity={0.95} stroke={T.blue} strokeWidth={vbW*0.001} /><text x={bx+bw/2} y={by+fs} textAnchor="middle" dominantBaseline="middle" fontSize={fs} fill="#fff" fontFamily={T.fontMono} fontWeight="700">{label}</text></g>;
          })()}
        </svg>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <span style={{ fontSize: 12, color: T.textMuted }}>{sheet.placements.length} parts · {vbW} × {vbH} mm usable area</span>
        {showScrap && <span style={{ fontSize: 12, color: T.orange }}>▪ Orange = available scrap zones</span>}
      </div>
    </Card>
  );
}

/* ════════════════════════════════════════
   RESULTS PANEL
════════════════════════════════════════ */
function ResultsPanel({ results, setResults, draft, material, onSaveJob, onSaveScrap, savedState, standardPartsLibrary }) {
  const [chosenIdx, setChosenIdx] = useState(0);
  const [showReport, setShowReport] = useState(false);
  useEffect(() => setChosenIdx(0), [results]);
  if (!results?.length) return null;
  const chosen = results[chosenIdx];
  const scrapCandidates = collectScrapCandidates(chosen, draft.settings.minScrap || 300);
  const ai = aiQualityScore(chosen);

  const [showSecondaryModal, setShowSecondaryModal] = useState(false);
  const [secondaryCandidates, setSecondaryCandidates] = useState([]);

  const openSecondaryModal = () => {
    if (!material) return;
    const candidates = standardPartsLibrary.filter(sp => sp.materialName === `${material.name} (${material.grade})` && parseFloat(sp.thickness) === parseFloat(material.thickness));
    // Calculate max fit
    const candsWithFit = candidates.map(c => {
      const testParts = [{...c, qty: 500}];
      const {sheets, unplaced} = packSecondaryParts(chosen.sheets, testParts, draft.settings, {engineTag:'bssf'});
      const placedCount = 500 - unplaced.length;
      return { ...c, fitQty: placedCount, suggestedQty: Math.min(placedCount, Math.max(0, c.targetStock - c.currentStock) || placedCount) };
    }).filter(c => c.fitQty > 0);
    candsWithFit.sort((a,b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || b.fitQty - a.fitQty);
    setSecondaryCandidates(candsWithFit);
    setShowSecondaryModal(true);
  };

  const handleGenerateSecondary = () => {
    const partsToPack = secondaryCandidates.filter(c => c.suggestedQty > 0).map(c => ({...c, qty: c.suggestedQty}));
    if(!partsToPack.length) { setShowSecondaryModal(false); return; }
    
    const {sheets, unplaced} = packSecondaryParts(chosen.sheets, partsToPack, draft.settings, {engineTag:'bssf'});
    const placed = partsToPack.reduce((s,p) => s + p.qty, 0) - unplaced.length;
    
    const newChosen = {...chosen};
    newChosen.sheets = sheets;
    const addedArea = itemAreaSqm(buildItemsFromParts(partsToPack, draft.settings)) * (partsToPack.length? placed/partsToPack.reduce((s,p)=>s+p.qty,0) : 0);
    newChosen.partArea += addedArea;
    newChosen.utilization = newChosen.totalSheetArea > 0 ? Math.min(100, (newChosen.partArea / newChosen.totalSheetArea)*100) : 0;
    newChosen.scrapPct = newChosen.totalSheetArea > 0 ? 100 - newChosen.utilization : 0;
    newChosen.secondaryPartsPlaced = (newChosen.secondaryPartsPlaced || 0) + placed;
    
    const nextResults = [...results];
    nextResults[chosenIdx] = newChosen;
    setResults(nextResults);
    setShowSecondaryModal(false);
  };


  return (
    <div className="slide-up">
      <SectionHeader eyebrow="Results" title={`Optimization — ${draft.jobNo}`} action={<Btn icon="report" variant="ghost" onClick={() => setShowReport(true)}>Job Report</Btn>} />

      {/* AI Score Banner */}
      <div style={{ background: `${ai.color}15`, border: `1px solid ${ai.color}40`, borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Icon d={ICONS.brain} size={20} color={ai.color} />
          <div>
            <span style={{ fontFamily: T.fontDisplay, fontSize: 16, fontWeight: 700, color: ai.color }}>AI Quality: {ai.grade}</span>
            <span style={{ marginLeft: 12, fontSize: 13, color: T.textMuted }}>{ai.reason}</span>
          </div>
        </div>
        <div style={{ fontFamily: T.fontDisplay, fontSize: 24, fontWeight: 700, color: ai.color }}>{ai.score}/100</div>
      </div>

      
      {/* Secondary Nest Opportunity */}
      {scrapCandidates.length > 0 && !chosen.secondaryPartsPlaced && (
        <div style={{ background: `${T.green}15`, border: `1px solid ${T.green}40`, borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: T.fontDisplay, fontSize: 16, fontWeight: 700, color: T.green }}>AI Opportunity Found</div>
            <div style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>You have enough reusable scrap area to manufacture standard stock parts.</div>
          </div>
          <Btn variant="success" icon="plus" onClick={openSecondaryModal}>Fill Remaining Space</Btn>
        </div>
      )}
      
      {chosen.secondaryPartsPlaced > 0 && (
        <div style={{ background: `${T.purple}15`, border: `1px solid ${T.purple}40`, borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: T.fontDisplay, fontSize: 16, fontWeight: 700, color: T.purple }}>Secondary Nest Completed</div>
            <div style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>Added {chosen.secondaryPartsPlaced} standard parts into the unused scrap area. Material saved!</div>
          </div>
        </div>
      )}

      {/* Result Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 10, marginBottom: 16 }}>
        {results.map((r, i) => {
          const rAi = aiQualityScore(r);
          return (
            <div key={i} onClick={() => setChosenIdx(i)} style={{ cursor: 'pointer', background: T.card, border: `2px solid ${chosenIdx === i ? T.blue : T.border}`, borderRadius: 10, padding: '1rem', transition: '0.15s', boxShadow: chosenIdx===i ? `0 0 16px ${T.blue}30` : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontFamily: T.fontMono, fontSize: 12, fontWeight: 700, color: T.text }}>
                    {r.mixed && <Badge color={T.purple}>MIX</Badge>} {r.sizeLabel}
                  </span>
                  {r.mixed && r.sizeBreakdown && r.sizeBreakdown.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {r.sizeBreakdown.map((b) => (
                        <span key={`${b.l}x${b.w}`} style={{ fontSize: 10, fontFamily: T.fontMono, background: T.panel, color: T.textDim, padding: '2px 6px', borderRadius: 4, border: `1px solid ${T.border}` }}>
                          {b.count}× {b.l}×{b.w}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {i === 0 && <Badge color={T.green}>✓ BEST</Badge>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, textAlign: 'center' }}>
                <div><div style={{ fontFamily: T.fontDisplay, fontSize: 20, fontWeight: 700, color: T.text }}>{r.sheetsUsed}</div><div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase' }}>Sheets</div></div>
                <div><div style={{ fontFamily: T.fontDisplay, fontSize: 20, fontWeight: 700, color: T.green }}>{fmt(r.utilization, 1)}%</div><div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase' }}>Utilized</div></div>
                <div><div style={{ fontFamily: T.fontDisplay, fontSize: 20, fontWeight: 700, color: rAi.color }}>{rAi.score}</div><div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase' }}>AI Score</div></div>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, fontFamily: T.fontMono, color: T.textMuted }}>{fmtCurrency(r.cost)}</div>
              {r.unplaced?.length > 0 && <div style={{ marginTop: 6, fontSize: 12, color: T.red, display: 'flex', alignItems: 'center', gap: 4 }}><Icon d={ICONS.warn} size={12} color={T.red} /> {r.unplaced.length} pcs unplaced</div>}
            </div>
          );
        })}
      </div>

      {/* Live Analytics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 12, marginBottom: 16 }}>
        <Card style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 140 }}>
          <UtilArc pct={chosen.utilization} size={130} />
        </Card>
        <Card>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { label: 'Total Sheets', val: chosen.sheetsUsed, color: T.text },
              { label: 'Fresh Sheets', val: chosen.freshSheetsUsed ?? chosen.sheetsUsed, color: T.blue },
              { label: 'Scrap Reused', val: chosen.scrapSheetsUsed || 0, color: T.green },
              { label: 'Material Cost', val: fmtCurrency(chosen.cost), color: T.orange },
              { label: 'Parts Placed', val: `${chosen.placedCount} / ${chosen.totalPartsRequested}`, color: chosen.placedCount === chosen.totalPartsRequested ? T.green : T.red },
              { label: 'Scrap %', val: `${fmt(chosen.scrapPct, 1)}%`, color: chosen.scrapPct < 20 ? T.green : T.orange },
            ].map(m => (
              <div key={m.label}>
                <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontFamily: T.fontDisplay, fontSize: 20, fontWeight: 700, color: m.color }}>{m.val}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: T.textMuted }}>
            {material.name} ({material.grade}, {material.thickness}mm) · kerf {draft.settings.kerf}mm + gap {draft.settings.gap}mm = {cutAllowance(draft.settings)}mm cut allowance
            {chosen.engineTag === 'genetic' && <span style={{ marginLeft: 8, color: T.purple, fontWeight: 600 }}>· Genetic Engine</span>}
          </div>
        </Card>
      </div>

      <NestingViewer option={chosen} material={material} jobNo={draft.jobNo} />

      {scrapCandidates.length > 0 && (
        <Card style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon d={ICONS.scrap} size={15} color={T.green} />
              <span style={{ fontFamily: T.fontDisplay, fontSize: 14, fontWeight: 700, color: T.text }}>Reusable Scrap Detected</span>
            </div>
            <Btn size="sm" variant="accent" onClick={() => onSaveScrap(scrapCandidates, material)}>Save {scrapCandidates.length} Pieces</Btn>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {scrapCandidates.map((s, i) => <Badge key={i} color={T.green}>{s.length} × {s.width}</Badge>)}
          </div>
        </Card>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <Btn icon="save" variant="success" onClick={() => onSaveJob(chosen, material)} disabled={savedState === 'saved'}>
          {savedState === 'saved' ? '✓ Job Saved' : 'Save Job to History'}
        </Btn>
      </div>

      
      {showSecondaryModal && (
        <Modal title="Standard Part Recommendation" onClose={() => setShowSecondaryModal(false)} wide>
          <div style={{ marginBottom: 16, fontSize: 13, color: T.textMuted }}>
            The system analyzed the remaining {scrapCandidates.length} scrap zones. Below are standard parts from your library that match the current material ({material.name} {material.thickness}mm) and can fit inside the leftover area.
          </div>
          {secondaryCandidates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: T.textMuted, fontSize: 13 }}>No compatible standard parts found in library that can fit in the remaining space.</div>
          ) : (
            <div style={{ overflowX: 'auto', marginBottom: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ color: T.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: `1px solid ${T.border}` }}>
                    <th style={{ textAlign: 'left', padding: '8px 0' }}>Part No</th>
                    <th style={{ textAlign: 'left', padding: '8px 0' }}>Name</th>
                    <th style={{ textAlign: 'center', padding: '8px 0' }}>Priority</th>
                    <th style={{ textAlign: 'center', padding: '8px 0' }}>Stock</th>
                    <th style={{ textAlign: 'center', padding: '8px 0', color: T.green }}>Max Fit</th>
                    <th style={{ textAlign: 'right', padding: '8px 0' }}>Suggested Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {secondaryCandidates.map((c, i) => (
                    <tr key={c.id} style={{ borderBottom: `1px solid ${T.borderLight}` }}>
                      <td style={{ padding: '8px 0', fontFamily: T.fontMono, color: T.text }}>{c.partNo}</td>
                      <td style={{ padding: '8px 0', color: T.textDim }}>{c.name}</td>
                      <td style={{ padding: '8px 0', textAlign: 'center' }}>
                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: c.priority==='High'?T.orange:c.priority==='Medium'?T.blue:T.panel, color: c.priority==='Low'?T.textMuted:'#fff' }}>{c.priority}</span>
                      </td>
                      <td style={{ padding: '8px 0', textAlign: 'center', fontFamily: T.fontMono, color: T.textDim }}>{c.currentStock}/{c.targetStock}</td>
                      <td style={{ padding: '8px 0', textAlign: 'center', fontFamily: T.fontMono, color: T.green, fontWeight: 700 }}>{c.fitQty}</td>
                      <td style={{ padding: '8px 0', textAlign: 'right' }}>
                        <Input type="number" min="0" max={c.fitQty} value={c.suggestedQty} onChange={e => {
                          const next = [...secondaryCandidates];
                          next[i].suggestedQty = Math.max(0, Math.min(c.fitQty, parseInt(e.target.value)||0));
                          setSecondaryCandidates(next);
                        }} style={{ width: 70, textAlign: 'center' }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
            <span style={{ fontSize: 13, color: T.textDim }}>
              Adding <strong style={{ color: T.text }}>{secondaryCandidates.reduce((s,c)=>s+c.suggestedQty,0)}</strong> standard parts.
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="ghost" onClick={() => setShowSecondaryModal(false)}>Cancel</Btn>
              <Btn icon="brain" variant="success" onClick={handleGenerateSecondary} disabled={secondaryCandidates.reduce((s,c)=>s+c.suggestedQty,0)===0}>Generate Secondary Nest</Btn>
            </div>
          </div>
        </Modal>
      )}

      {showReport && <JobReportModal chosen={chosen} draft={draft} material={material} onClose={() => setShowReport(false)} />}
    </div>
  );
}

/* ════════════════════════════════════════
   JOB REPORT MODAL
════════════════════════════════════════ */
function JobReportModal({ chosen, draft, material, onClose }) {
  const ai = aiQualityScore(chosen);
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>ISNS Job Report — ${draft.jobNo}</title><style>body{font-family:Arial,sans-serif;margin:40px;color:#1a1a2e;} h1{color:#1e3a8a;} table{border-collapse:collapse;width:100%;} td,th{border:1px solid #ddd;padding:8px;font-size:13px;} th{background:#1e3a8a;color:#fff;text-align:left;} .badge{display:inline-block;padding:2px 8px;border-radius:3px;font-weight:bold;} .good{color:green;} .warn{color:orange;} .bad{color:red;}</style></head><body><h1>ISNS AI Enterprise — Nesting Job Report</h1><p><strong>Job No:</strong> ${draft.jobNo} &nbsp; <strong>Project:</strong> ${draft.project||'—'} &nbsp; <strong>Customer:</strong> ${draft.customer||'—'}</p><p><strong>Date:</strong> ${new Date().toLocaleDateString()} &nbsp; <strong>AI Quality:</strong> <span class="${ai.score>=80?'good':ai.score>=60?'warn':'bad'}">${ai.grade} (${ai.score}/100)</span></p><hr/><h2>Material</h2><table><tr><th>Material</th><th>Grade</th><th>Thickness</th><th>Supplier</th></tr><tr><td>${material.name}</td><td>${material.grade}</td><td>${material.thickness}mm</td><td>${material.supplier||'—'}</td></tr></table><h2>Results</h2><table><tr><th>Total Sheets</th><th>Fresh</th><th>Scrap Reused</th><th>Utilization</th><th>Scrap %</th><th>Material Cost</th></tr><tr><td>${chosen.sheetsUsed}</td><td>${chosen.freshSheetsUsed??chosen.sheetsUsed}</td><td>${chosen.scrapSheetsUsed||0}</td><td>${fmt(chosen.utilization,1)}%</td><td>${fmt(chosen.scrapPct,1)}%</td><td>₹${fmt(chosen.cost,0)}</td></tr></table><h2>Parts</h2><table><tr><th>Part No</th><th>Shape</th><th>L × W (mm)</th><th>Qty</th><th>Priority</th></tr>${draft.parts.map(p=>`<tr><td>${p.partNo}</td><td>${p.shapeType||'rectangle'}</td><td>${p.length} × ${p.width}</td><td>${p.qty}</td><td>${p.priority}</td></tr>`).join('')}</table><p style="margin-top:30px;font-size:12px;color:#888;">Generated by ISNS AI Enterprise &middot; ${new Date().toLocaleString()}</p></body></html>`;
  const download = () => { const blob=new Blob([html],{type:'text/html'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`ISNS_Report_${draft.jobNo}.html`;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url); };
  return (
    <Modal title={`Job Report — ${draft.jobNo}`} onClose={onClose} wide>
      <div style={{ background: T.panel, borderRadius: 8, padding: 16, marginBottom: 16, fontSize: 13, color: T.textDim, lineHeight: 1.8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div><b style={{ color: T.textMuted }}>Job No:</b> <span style={{ color: T.text, fontFamily: T.fontMono }}>{draft.jobNo}</span></div>
          <div><b style={{ color: T.textMuted }}>Project:</b> <span style={{ color: T.text }}>{draft.project || '—'}</span></div>
          <div><b style={{ color: T.textMuted }}>Customer:</b> <span style={{ color: T.text }}>{draft.customer || '—'}</span></div>
          <div><b style={{ color: T.textMuted }}>Date:</b> <span style={{ color: T.text }}>{new Date().toLocaleDateString()}</span></div>
          <div><b style={{ color: T.textMuted }}>Material:</b> <span style={{ color: T.text }}>{material.name} · {material.grade} · {material.thickness}mm</span></div>
          <div><b style={{ color: T.textMuted }}>AI Quality:</b> <span style={{ color: aiQualityScore(chosen).color, fontWeight: 700 }}>{aiQualityScore(chosen).grade} ({aiQualityScore(chosen).score}/100)</span></div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 16 }}>
        {[{l:'Sheets Used',v:chosen.sheetsUsed,c:T.blue},{l:'Utilization',v:`${fmt(chosen.utilization,1)}%`,c:T.green},{l:'Scrap',v:`${fmt(chosen.scrapPct,1)}%`,c:T.orange},{l:'Material Cost',v:fmtCurrency(chosen.cost),c:T.text}].map(m=>(
          <div key={m.l} style={{ background: T.card, borderRadius: 8, padding: 12, textAlign: 'center', border: `1px solid ${T.border}` }}>
            <div style={{ fontFamily: T.fontDisplay, fontSize: 20, fontWeight: 700, color: m.c }}>{m.v}</div>
            <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', marginTop: 4 }}>{m.l}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Btn variant="ghost" onClick={onClose}>Close</Btn>
        <Btn icon="report" onClick={download}>Download HTML Report</Btn>
      </div>
    </Modal>
  );
}

/* ════════════════════════════════════════
   JOBS HISTORY
════════════════════════════════════════ */
function JobsPanel({ jobsIndex, onOpen, onDelete }) {
  return (
    <div className="slide-up">
      <SectionHeader eyebrow="History" title="Saved Jobs" />
      {jobsIndex.length === 0 ? <Card><EmptyState title="No saved jobs" body="Run and save a nesting job to build your production history." /></Card> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {jobsIndex.map(j => (
            <Card key={j.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: `${T.blue}18`, display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}><Icon d={ICONS.folder} size={16} color={T.blue} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{j.jobNo} · {j.project || 'Untitled'}</div>
                <div style={{ fontSize: 12, color: T.textMuted }}>{j.materialName} · {j.sheetSize} · {j.sheetsUsed} sheets · {fmt(j.utilization, 1)}% · {new Date(j.createdAt).toLocaleDateString()}</div>
              </div>
              <span style={{ fontFamily: T.fontMono, fontWeight: 700, color: T.green, fontSize: 13 }}>{fmtCurrency(j.cost)}</span>
              <Btn size="sm" variant="ghost" onClick={() => onOpen(j.id)}>Open</Btn>
              <button onClick={() => onDelete(j.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.red }}><Icon d={ICONS.trash} size={14} /></button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════
   SCRAP INVENTORY
════════════════════════════════════════ */
function ScrapPanel({ scrapInventory, setScrapInventory, persist }) {
  const [form, setForm] = useState({ length: '', width: '', material: '', thickness: '' });
  const addManual = () => {
    if (!form.length || !form.width) return;
    const item = { id: uid('scrap'), length: parseFloat(form.length), width: parseFloat(form.width), material: form.material || 'Unspecified', thickness: parseFloat(form.thickness) || 0, status: 'Available', createdAt: Date.now(), location: 'Rack A' };
    const next = [item, ...scrapInventory]; setScrapInventory(next); persist('scrap-inventory', next);
    setForm({ length: '', width: '', material: '', thickness: '' });
  };
  const setStatus = (id, status) => { const next = scrapInventory.map(s => s.id === id ? { ...s, status } : s); setScrapInventory(next); persist('scrap-inventory', next); };
  const remove = id => { const next = scrapInventory.filter(s => s.id !== id); setScrapInventory(next); persist('scrap-inventory', next); };
  const available = scrapInventory.filter(s => s.status === 'Available');
  const consumed = scrapInventory.filter(s => s.status !== 'Available');
  return (
    <div className="slide-up">
      <SectionHeader eyebrow="Reuse Before You Buy" title="Scrap Inventory" />
      <Card style={{ marginBottom: 12 }}>
        <div style={{ fontFamily: T.fontDisplay, fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 10 }}>Add Scrap Manually</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          <Field label="Length (mm)"><Input type="number" value={form.length} onChange={e => setForm(f => ({ ...f, length: e.target.value }))} style={{ width: 110 }} /></Field>
          <Field label="Width (mm)"><Input type="number" value={form.width} onChange={e => setForm(f => ({ ...f, width: e.target.value }))} style={{ width: 110 }} /></Field>
          <Field label="Material"><Input value={form.material} onChange={e => setForm(f => ({ ...f, material: e.target.value }))} style={{ width: 150 }} /></Field>
          <Field label="Thickness (mm)"><Input type="number" value={form.thickness} onChange={e => setForm(f => ({ ...f, thickness: e.target.value }))} style={{ width: 110 }} /></Field>
          <Btn icon="plus" onClick={addManual}>Add</Btn>
        </div>
      </Card>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.green, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Available ({available.length})</div>
          {available.map(s => (
            <Card key={s.id} style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, fontFamily: T.fontMono, fontSize: 13, color: T.text }}>{s.length} × {s.width} <span style={{ fontSize: 11, color: T.textMuted }}>· {s.material}{s.thickness ? ` · ${s.thickness}mm` : ''}</span></div>
              <Btn size="sm" variant="ghost" onClick={() => setStatus(s.id, 'Reserved')}>Reserve</Btn>
              <button onClick={() => remove(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.red }}><Icon d={ICONS.trash} size={14} /></button>
            </Card>
          ))}
          {!available.length && <div style={{ fontSize: 13, color: T.textMuted, padding: '1rem 0' }}>No scrap available.</div>}
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Reserved / Used ({consumed.length})</div>
          {consumed.map(s => (
            <Card key={s.id} style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10, opacity: 0.65 }}>
              <div style={{ flex: 1, fontFamily: T.fontMono, fontSize: 13, color: T.text }}>{s.length} × {s.width} <span style={{ fontSize: 11, color: T.textMuted }}>· {s.status}</span></div>
              <Btn size="sm" variant="ghost" onClick={() => setStatus(s.id, 'Available')}>Restore</Btn>
            </Card>
          ))}
          {!consumed.length && <div style={{ fontSize: 13, color: T.textMuted, padding: '1rem 0' }}>Nothing reserved.</div>}
        </div>
      </div>
    </div>
  );
}


/* ════════════════════════════════════════
   STANDARD PARTS LIBRARY
════════════════════════════════════════ */
function StandardPartsPanel({ standardPartsLibrary, setStandardPartsLibrary, persist }) {
  const [editing, setEditing] = useState(null);

  const handleDxfUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dims = await parseDxfDimensions(file);
      setEditing(p => ({ ...p, length: dims.length, width: dims.width, partNo: p.partNo || file.name.replace(/\.[^/.]+$/, "") }));
    } catch (err) {
      alert("Failed to parse DXF: " + err.message);
    }
    e.target.value = '';
  };
  const blank = () => ({ id: uid('sp'), partNo: '', name: '', length: 0, width: 0, qty: 0, priority: 'Normal', allowRotation: true, shapeType: 'rectangle', cutoutLength: 0, cutoutWidth: 0, sideA: 0, sideB: 0, materialName: '', thickness: 3, currentStock: 0, targetStock: 0 });
  
  const save = p => { 
    const exists = standardPartsLibrary.some(x => x.id === p.id); 
    const next = exists ? standardPartsLibrary.map(x => x.id === p.id ? p : x) : [p, ...standardPartsLibrary]; 
    setStandardPartsLibrary(next); persist('standard-parts', next); setEditing(null); 
  };
  const remove = id => { const next = standardPartsLibrary.filter(x => x.id !== id); setStandardPartsLibrary(next); persist('standard-parts', next); };
  
  return (
    <div className="slide-up">
      <SectionHeader eyebrow="Master Data" title="Standard Parts Library" action={<Btn icon="plus" onClick={() => setEditing(blank())}>Add Standard Part</Btn>} />
      {standardPartsLibrary.length === 0 ? <Card><EmptyState title="No standard parts" body="Add parts that you frequently manufacture for stock recovery." action={<Btn icon="plus" onClick={() => setEditing(blank())}>Add Part</Btn>} /></Card> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 12 }}>
          {standardPartsLibrary.map(p => (
            <Card key={p.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontFamily: T.fontDisplay, fontSize: 18, fontWeight: 700, color: T.text }}>{p.partNo}</div>
                  <div style={{ fontSize: 13, color: T.textDim, marginTop: 2 }}>{p.name}</div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => setEditing(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.blue }}><Icon d={ICONS.gear} size={15} /></button>
                  <button onClick={() => remove(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.red }}><Icon d={ICONS.trash} size={15} /></button>
                </div>
              </div>
              
              <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <Badge color={T.blue}>{p.shapeType || 'rectangle'}</Badge>
                <Badge color={T.purple}>{p.length} × {p.width} mm</Badge>
                <Badge color={p.priority==='High'?T.orange:p.priority==='Medium'?T.blue:T.textMuted}>Pri: {p.priority}</Badge>
              </div>
              
              <div style={{ marginTop: 10, fontSize: 12, color: T.textMuted }}>
                <div><strong style={{color:T.text}}>Material:</strong> {p.materialName || 'Any'} ({p.thickness}mm)</div>
                <div style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                  <span><strong style={{color:T.text}}>Stock:</strong> {p.currentStock} / {p.targetStock}</span>
                  <span style={{ color: p.currentStock < p.targetStock ? T.orange : T.green }}>{p.currentStock < p.targetStock ? 'Restock Needed' : 'Fully Stocked'}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      
      {editing && (
        <Modal title={editing.partNo ? 'Edit Standard Part' : 'Add Standard Part'} onClose={() => setEditing(null)}>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: `${T.panel}`, padding: 12, borderRadius: 8, border: `1px dashed ${T.blue}` }}>
            <div>
              <div style={{ fontFamily: T.fontDisplay, fontSize: 14, fontWeight: 700, color: T.text }}>Upload DXF</div>
              <div style={{ fontSize: 11, color: T.textMuted }}>Auto-extracts length and width from drawing bounds</div>
            </div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: `${T.blue}20`, color: T.blue, borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: '0.15s' }}>
              <Icon d={ICONS.upload} size={14} color={T.blue} /> Browse File
              <input type="file" accept=".dxf" style={{ display: 'none' }} onChange={handleDxfUpload} />
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Part No"><Input value={editing.partNo} onChange={e => setEditing(p => ({...p, partNo: e.target.value}))} /></Field>
            <Field label="Name"><Input value={editing.name} onChange={e => setEditing(p => ({...p, name: e.target.value}))} /></Field>
            
            <Field label="Shape">
              <Select value={editing.shapeType || 'rectangle'} onChange={e => setEditing(p => ({...p, shapeType: e.target.value}))}>
                <option value="rectangle">Rectangle</option>
                <option value="lshape">L-Shape</option>
                <option value="circle">Circle</option>
                <option value="triangle">Triangle</option>
                <option value="trapezoid">Trapezoid</option>
              </Select>
            </Field>
            
            <Field label="Priority">
              <Select value={editing.priority} onChange={e => setEditing(p => ({...p, priority: e.target.value}))}>
                <option>High</option><option>Medium</option><option>Low</option>
              </Select>
            </Field>
            
            <Field label="Length (mm)"><Input type="number" value={editing.length} onChange={e => setEditing(p => ({...p, length: parseFloat(e.target.value)||0}))} /></Field>
            <Field label="Width (mm)"><Input type="number" value={editing.width} onChange={e => setEditing(p => ({...p, width: parseFloat(e.target.value)||0}))} /></Field>
            
            <Field label="Material Name" hint="Must match exactly (e.g. Stainless Steel (SS304 2B))"><Input value={editing.materialName} onChange={e => setEditing(p => ({...p, materialName: e.target.value}))} placeholder="Stainless Steel (SS304 2B)" /></Field>
            <Field label="Thickness (mm)"><Input type="number" value={editing.thickness} onChange={e => setEditing(p => ({...p, thickness: parseFloat(e.target.value)||0}))} /></Field>

            <Field label="Current Stock"><Input type="number" value={editing.currentStock} onChange={e => setEditing(p => ({...p, currentStock: parseInt(e.target.value)||0}))} /></Field>
            <Field label="Target Stock"><Input type="number" value={editing.targetStock} onChange={e => setEditing(p => ({...p, targetStock: parseInt(e.target.value)||0}))} /></Field>
          </div>
          
          {editing.shapeType === 'lshape' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
              <Field label="Cutout Length (mm)"><Input type="number" value={editing.cutoutLength} onChange={e => setEditing(p => ({...p, cutoutLength: parseFloat(e.target.value)||0}))} /></Field>
              <Field label="Cutout Width (mm)"><Input type="number" value={editing.cutoutWidth} onChange={e => setEditing(p => ({...p, cutoutWidth: parseFloat(e.target.value)||0}))} /></Field>
            </div>
          )}
          
          {editing.shapeType === 'trapezoid' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
              <Field label="Side A (mm)"><Input type="number" value={editing.sideA} onChange={e => setEditing(p => ({...p, sideA: parseFloat(e.target.value)||0}))} /></Field>
              <Field label="Side B (mm)"><Input type="number" value={editing.sideB} onChange={e => setEditing(p => ({...p, sideB: parseFloat(e.target.value)||0}))} /></Field>
            </div>
          )}
          
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, fontSize: 13, color: T.textDim, cursor: 'pointer' }}>
            <input type="checkbox" checked={editing.allowRotation !== false} onChange={e => setEditing(p => ({...p, allowRotation: e.target.checked}))} />
            Allow 90° rotation
          </label>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <Btn variant="ghost" onClick={() => setEditing(null)}>Cancel</Btn>
            <Btn icon="save" onClick={() => save(editing)} disabled={!editing.partNo || !editing.length || !editing.width}>Save Part</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ════════════════════════════════════════
   APP SHELL
════════════════════════════════════════ */
const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { key: 'materials', label: 'Material Master', icon: 'materials' },
  { key: 'standardparts', label: 'Standard Parts', icon: 'folder' },
  { key: 'newjob', label: 'New Job', icon: 'newjob' },
  { key: 'results', label: 'Results', icon: 'results' },
  { key: 'jobs', label: 'Job History', icon: 'jobs' },
  { key: 'scrap', label: 'Scrap Inventory', icon: 'scrap' },
];

function blankDraft() {
  return { jobNo: `JOB-${Math.floor(1000 + Math.random() * 9000)}`, project: '', customer: '', materialId: '', selectedSizeIds: [], selectedScrapIds: [], settings: { kerf: 2, gap: 5, margin: 10, minScrap: 300, allowRotation: true, optimizeMode: 'fast', gaGenerations: 80, gaPopulation: 48 }, parts: [] };
}

function App() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState('dashboard');
  const [materials, setMaterials] = useState([]);
  const [jobsIndex, setJobsIndex] = useState([]);
  const [scrapInventory, setScrapInventory] = useState([]);
  const [standardPartsLibrary, setStandardPartsLibrary] = useState([]);
  const [draft, setDraft] = useState(blankDraft());
  const [results, setResults] = useState(null);
  const [resultMaterial, setResultMaterial] = useState(null);
  const [savedState, setSavedState] = useState('idle');
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeProgress, setOptimizeProgress] = useState(0);
  const [cloudStatus, setCloudStatus] = useState('local');

  const snapshotAll = useCallback((mats, jobs, scrap, sparts) => ({ materials: mats, jobsIndex: jobs, scrapInventory: scrap, standardPartsLibrary: sparts, updatedAt: Date.now() }), []);

  useEffect(() => {
    (async () => {
      let mats = await storeGet('materials', null), jobs = await storeGet('jobs-index', []), scrap = await storeGet('scrap-inventory', []), sparts = await storeGet('standard-parts', []);
      if (!sparts || !sparts.length) { sparts = SEED_STANDARD_PARTS; await storeSet('standard-parts', sparts); }
      const cloud = await cloudLoad();
      if (cloud?.materials) { mats = cloud.materials; jobs = cloud.jobsIndex || jobs; scrap = cloud.scrapInventory || scrap; sparts = cloud.standardPartsLibrary || sparts; await storeSet('materials', mats); await storeSet('jobs-index', jobs); await storeSet('scrap-inventory', scrap); await storeSet('standard-parts', sparts); setCloudStatus('cloud'); }
      else if (!mats) { mats = SEED_MATERIALS; await storeSet('materials', mats); }
      setMaterials(mats); setJobsIndex(jobs); setScrapInventory(scrap); setStandardPartsLibrary(sparts); setReady(true);
    })();
  }, []);

  const persist = useCallback((key, val) => {
    storeSet(key, val);
    if (['materials','jobs-index','scrap-inventory'].includes(key)) {
      cloudSave(snapshotAll(key==='materials'?val:materials, key==='jobs-index'?val:jobsIndex, key==='scrap-inventory'?val:scrapInventory, key==='standard-parts'?val:standardPartsLibrary)).then(ok => { if (ok) setCloudStatus('synced'); });
    }
  }, [materials, jobsIndex, scrapInventory, snapshotAll]);

  const handleOptimize = async (material, sizes, scrapPieces = []) => {
    setOptimizing(true); setOptimizeProgress(0);
    try {
      let r;
      if (draft.settings.optimizeMode === 'genetic') {
        r = await runGeneticOptimizationAsync(sizes, draft.parts, draft.settings, material, scrapPieces, { generations: draft.settings.gaGenerations, population: draft.settings.gaPopulation }, pct => setOptimizeProgress(pct));
      } else {
        r = runOptimization(sizes, draft.parts, draft.settings, material, scrapPieces, { engineTag: 'bssf' });
      }
      setResults(r); setResultMaterial(material); setSavedState('idle'); setTab('results');
    } finally { setOptimizing(false); setOptimizeProgress(0); }
  };

  const handleSaveJob = async (chosen, material) => {
    const id = uid('job');
    const fullJob = { id, jobNo: draft.jobNo, project: draft.project, customer: draft.customer, materialId: material.id, materialName: `${material.name} (${material.grade})`, settings: draft.settings, parts: draft.parts, sheetSize: chosen.sizeLabel, mixed: !!chosen.mixed, sizeBreakdown: chosen.sizeBreakdown || [], sheetsUsed: chosen.sheetsUsed, freshSheetsUsed: chosen.freshSheetsUsed ?? chosen.sheetsUsed, scrapSheetsUsed: chosen.scrapSheetsUsed || 0, consumedScrapIds: chosen.usedScrapIds || [], utilization: chosen.utilization, scrapPct: chosen.scrapPct, cost: chosen.cost, scrapValue: chosen.scrapValue, sheets: chosen.sheets, status: 'Completed', createdAt: Date.now() };
    await storeSet(`job:${id}`, fullJob);
    const summary = { id, jobNo: fullJob.jobNo, project: fullJob.project, materialName: fullJob.materialName, sheetSize: fullJob.sheetSize, sheetsUsed: fullJob.sheetsUsed, scrapSheetsUsed: fullJob.scrapSheetsUsed, utilization: fullJob.utilization, scrapPct: fullJob.scrapPct, cost: fullJob.cost, scrapValue: fullJob.scrapValue, status: 'Completed', createdAt: fullJob.createdAt };
    const nextIndex = [summary, ...jobsIndex]; setJobsIndex(nextIndex); await storeSet('jobs-index', nextIndex);
    cloudSave(snapshotAll(materials, nextIndex, scrapInventory, standardPartsLibrary)).then(ok => { if (ok) setCloudStatus('synced'); });
    if (chosen.usedScrapIds?.length) { const rem = scrapInventory.filter(s => !chosen.usedScrapIds.includes(s.id)); setScrapInventory(rem); await storeSet('scrap-inventory', rem); }
    setSavedState('saved');
  };

  const handleSaveScrap = async (candidates, material) => {
    const items = candidates.map(c => ({ id: uid('scrap'), length: c.length, width: c.width, material: `${material.name} (${material.grade})`, thickness: material.thickness, status: 'Available', createdAt: Date.now(), location: 'Rack A' }));
    const next = [...items, ...scrapInventory]; setScrapInventory(next); await storeSet('scrap-inventory', next);
  };

  const openJob = async id => {
    const job = await storeGet(`job:${id}`, null); if (!job) return;
    const mat = materials.find(m => m.id === job.materialId) || { name: job.materialName, grade: '', thickness: 0, sheetSizes: [] };
    setDraft({ jobNo: job.jobNo, project: job.project, customer: job.customer, materialId: job.materialId, selectedSizeIds: [], settings: job.settings, parts: job.parts });
    const bd = job.sizeBreakdown?.length ? job.sizeBreakdown : breakdownBySize(job.sheets || []);
    const fakeOption = { size: bd[0]?{l:bd[0].l,w:bd[0].w}:{l:0,w:0}, sizeLabel: job.sheetSize, mixed: !!job.mixed, sizeBreakdown: bd, sheets: job.sheets, unplaced: [], sheetsUsed: job.sheetsUsed, freshSheetsUsed: job.freshSheetsUsed??job.sheetsUsed, scrapSheetsUsed: job.scrapSheetsUsed||0, utilization: job.utilization, scrapPct: job.scrapPct, cost: job.cost, scrapValue: job.scrapValue, totalPartsRequested: job.parts.reduce((s,p)=>s+(parseInt(p.qty)||0),0), placedCount: job.sheets.reduce((s,sh)=>s+sh.placements.length,0) };
    setResults([fakeOption]); setResultMaterial(mat); setSavedState('saved'); setTab('results');
  };

  const deleteJob = async id => { const next = jobsIndex.filter(j => j.id !== id); setJobsIndex(next); await storeSet('jobs-index', next); await storeDelete(`job:${id}`); };

  if (!ready) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: T.bg }}>
      <div style={{ textAlign: 'center', color: T.textMuted }}>
        <div style={{ width: 36, height: 36, border: `3px solid ${T.border}`, borderTopColor: T.blue, borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
        <div style={{ fontFamily: T.fontMono, fontSize: 13 }}>Loading ISNS AI Enterprise…</div>
      </div>
    </div>
  );

  return (
    <div style={{ background: T.bg, minHeight: '100vh', display: 'flex', fontFamily: T.fontBody }}>
      {/* Sidebar */}
      <aside style={{ width: 220, flexShrink: 0, background: T.panel, borderRight: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', padding: '1.25rem 0.75rem', position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px', marginBottom: 24 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: `linear-gradient(135deg, ${T.blue}, #6366f1)`, display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: `0 0 12px ${T.blue}50` }}>
            <Icon d={ICONS.chip} size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontFamily: T.fontDisplay, fontSize: 15, fontWeight: 700, color: T.text, letterSpacing: '0.05em' }}>ISNS AI</div>
            <div style={{ fontSize: 10, color: T.textMuted, letterSpacing: '0.08em' }}>Enterprise v9</div>
          </div>
        </div>

        {NAV.map(n => {
          const isActive = tab === n.key;
          const isDisabled = n.key === 'results' && !results;
          return (
            <button key={n.key} onClick={isDisabled ? undefined : () => setTab(n.key)} disabled={isDisabled} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, border: 'none', background: isActive ? `${T.blue}20` : 'transparent', color: isActive ? T.blue : T.textMuted, cursor: isDisabled ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: isActive ? 600 : 400, marginBottom: 2, textAlign: 'left', opacity: isDisabled ? 0.35 : 1, transition: '0.15s', outline: isActive ? `1px solid ${T.blue}40` : 'none' }}>
              <Icon d={ICONS[n.icon]} size={15} color={isActive ? T.blue : T.textMuted} />
              {n.label}
            </button>
          );
        })}

        <div style={{ marginTop: 'auto', padding: '0 8px', fontSize: 11, color: T.textMuted, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: cloudStatus === 'synced' || cloudStatus === 'cloud' ? T.green : T.orange, animation: 'pulse-dot 2s infinite' }} />
            <span>{cloudStatus === 'synced' ? 'Cloud synced' : cloudStatus === 'cloud' ? 'Loaded from cloud' : 'Local only'}</span>
          </div>
          <div>Guillotine BSSF + Genetic AI</div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        {tab === 'dashboard' && <Dashboard jobsIndex={jobsIndex} scrapInventory={scrapInventory} materials={materials} onGoto={setTab} />}
        {tab === 'materials' && <MaterialsPanel materials={materials} setMaterials={setMaterials} persist={persist} />}
        {tab === 'standardparts' && <StandardPartsPanel standardPartsLibrary={standardPartsLibrary} setStandardPartsLibrary={setStandardPartsLibrary} persist={persist} />}
        {tab === 'newjob' && <NewJobPanel materials={materials} scrapInventory={scrapInventory} onOptimize={handleOptimize} draft={draft} setDraft={setDraft} optimizing={optimizing} optimizeProgress={optimizeProgress} />}
        {tab === 'results' && results && <ResultsPanel results={results} setResults={setResults} draft={draft} material={resultMaterial} onSaveJob={handleSaveJob} onSaveScrap={handleSaveScrap} savedState={savedState} standardPartsLibrary={standardPartsLibrary} />}
        {tab === 'results' && !results && <Card><EmptyState title="No results yet" body="Run an optimization from the New Job tab first." action={<Btn icon="newjob" onClick={() => setTab('newjob')}>Go to New Job</Btn>} /></Card>}
        {tab === 'jobs' && <JobsPanel jobsIndex={jobsIndex} onOpen={openJob} onDelete={deleteJob} />}
        {tab === 'scrap' && <ScrapPanel scrapInventory={scrapInventory} setScrapInventory={setScrapInventory} persist={persist} />}
      </main>
    </div>
  );
}

export default App;