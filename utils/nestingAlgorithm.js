
import { hashColor } from './helper.js';
export const PRIORITY_RANK = { Urgent: 0, Normal: 1, Low: 2 };
const SPLIT_MODES = ['auto', 'vertical', 'horizontal'];
export function cutAllowance(s) {
  return (parseFloat(s?.gap) || 0) + (parseFloat(s?.kerf) || 0);
}
export function partGeometry(p) {
  const l = parseFloat(p.length) || 0,
    w = parseFloat(p.width) || 0,
    st = p.shapeType || 'rectangle';
  if (st === 'circle') {
    const d = Math.max(l, w);
    return {
      w: d,
      h: d,
      trueArea: Math.PI * (d / 2) ** 2,
      shapeType: 'circle',
      shapeData: {
        diameter: d
      }
    };
  }
  if (st === 'lshape') {
    const cl = parseFloat(p.cutoutLength) || 0,
      cw = parseFloat(p.cutoutWidth) || 0;
    return {
      w: l,
      h: w,
      trueArea: Math.max(0, l * w - cl * cw),
      shapeType: 'lshape',
      shapeData: {
        cutoutLength: cl,
        cutoutWidth: cw
      }
    };
  }
  if (st === 'triangle') {
    return {
      w: l,
      h: w,
      trueArea: 0.5 * l * w,
      shapeType: 'triangle',
      shapeData: {
        legA: l,
        legB: w
      }
    };
  }
  if (st === 'trapezoid') {
    const a = parseFloat(p.sideA) || l,
      b = parseFloat(p.sideB) || 0;
    return {
      w: Math.max(l, a, b),
      h: w,
      trueArea: 0.5 * (a + b) * w,
      shapeType: 'trapezoid',
      shapeData: {
        sideA: a,
        sideB: b,
        height: w
      }
    };
  }
  return {
    w: l,
    h: w,
    trueArea: l * w,
    shapeType: 'rectangle',
    shapeData: null
  };
}
export function defaultItemOrder(items) {
  return [...items].sort((a, b) => {
    const pa = PRIORITY_RANK[a.priority] ?? 1,
      pb = PRIORITY_RANK[b.priority] ?? 1;
    if (pa !== pb) return pa - pb;
    return Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.w * b.h - a.w * a.h;
  }).map(it => it.id);
}
export function reorderItems(items, orderIds) {
  if (!orderIds?.length) return defaultItemOrder(items).map(id => items.find(it => it.id === id)).filter(Boolean);
  const map = new Map(items.map(it => [it.id, it]));
  const ord = orderIds.map(id => map.get(id)).filter(Boolean);
  return ord.concat(items.filter(it => !orderIds.includes(it.id)));
}
export function footprint(item, allowance, rotated) {
  const w = rotated ? item.h : item.w,
    h = rotated ? item.w : item.h;
  return {
    w: w + allowance,
    h: h + allowance,
    rot: rotated
  };
}
export function chooseSplitRects(fr, pw, ph, sm) {
  const horiz = sm === 'horizontal' || sm === 'auto' && fr.w - pw > fr.h - ph;
  if (horiz) return [{
    x: fr.x + pw,
    y: fr.y,
    w: fr.w - pw,
    h: fr.h
  }, {
    x: fr.x,
    y: fr.y + ph,
    w: pw,
    h: fr.h - ph
  }];
  return [{
    x: fr.x + pw,
    y: fr.y,
    w: fr.w - pw,
    h: ph
  }, {
    x: fr.x,
    y: fr.y + ph,
    w: fr.w,
    h: fr.h - ph
  }];
}
export function packOneBin(bW, bH, items, settings, options = {}) {
  const allowance = cutAllowance(settings),
    sm = options.splitMode || 'auto',
    sorted = reorderItems(items, options.itemOrder);
  let freeRects = options.initialFreeRects ? JSON.parse(JSON.stringify(options.initialFreeRects)) : [{
    x: 0,
    y: 0,
    w: bW,
    h: bH
  }];
  const placements = [],
    leftover = [];
  for (const item of sorted) {
    let best = null;
    for (let idx = 0; idx < freeRects.length; idx++) {
      const fr = freeRects[idx];
      const opts = [footprint(item, allowance, false)];
      if (item.allowRotation) opts.push(footprint(item, allowance, true));
      for (const o of opts) {
        if (o.w <= fr.w + 1e-6 && o.h <= fr.h + 1e-6) {
          const lW = fr.w - o.w,
            lH = fr.h - o.h,
            ss = Math.min(lW, lH),
            ls = Math.max(lW, lH);
          if (!best || ss < best.ss - 1e-6 || Math.abs(ss - best.ss) < 1e-6 && ls < best.ls) best = {
            idx,
            rot: o.rot,
            w: o.w,
            h: o.h,
            ss,
            ls,
            fr
          };
        }
      }
    }
    if (!best) {
      leftover.push(item);
      continue;
    }
    const fr = best.fr,
      pw = best.w,
      ph = best.h,
      splits = chooseSplitRects(fr, pw, ph, sm);
    const newFree = freeRects.filter((_, i) => i !== best.idx);
    splits.forEach(r => {
      if (r.w > 0.5 && r.h > 0.5) newFree.push(r);
    });
    freeRects = newFree;
    placements.push({
      instId: item.id,
      partNo: item.partNo,
      x: fr.x,
      y: fr.y,
      w: best.rot ? item.h : item.w,
      h: best.rot ? item.w : item.h,
      rotated: best.rot,
      color: item.color,
      shapeType: item.shapeType || 'rectangle',
      shapeData: item.shapeData || null,
      trueArea: item.trueArea || (best.rot ? item.h : item.w) * (best.rot ? item.w : item.h),
      priority: item.priority || 'Normal'
    });
  }
  return {
    placements,
    leftover,
    freeRects
  };
}
export function packSheets(sL, sW, items, settings, opts = {}) {
  const margin = parseFloat(settings.margin) || 0,
    uW = Math.max(0, sL - 2 * margin),
    uH = Math.max(0, sW - 2 * margin);
  let remaining = items;
  const sheets = [];
  let guard = 0;
  while (remaining.length && guard < 800) {
    guard++;
    const {
      placements,
      leftover,
      freeRects
    } = packOneBin(uW, uH, remaining, settings, opts);
    if (!placements.length) break;
    sheets.push({
      placements,
      freeRects,
      usableW: uW,
      usableH: uH,
      margin
    });
    remaining = leftover;
  }
  return {
    sheets,
    unplaced: remaining
  };
}
export function buildItemsFromParts(parts, settings) {
  const gr = !settings || settings.allowRotation !== false;
  const items = [];
  parts.forEach(p => {
    const qty = Math.max(0, parseInt(p.qty) || 0),
      geo = partGeometry(p);
    for (let i = 0; i < qty; i++) items.push({
      id: `${p.id}-${i}`,
      partNo: p.partNo,
      w: geo.w,
      h: geo.h,
      trueArea: geo.trueArea,
      shapeType: geo.shapeType,
      shapeData: geo.shapeData,
      priority: p.priority || 'Normal',
      allowRotation: p.allowRotation !== false && gr && geo.shapeType === 'rectangle',
      color: hashColor(p.partNo || 'X')
    });
  });
  return items;
}
export function itemAreaSqm(items) {
  return items.reduce((s, it) => s + (it.trueArea || it.w * it.h) / 1e6, 0);
}
export function costPerSqmOf(mat) {
  if (!mat) return 0;
  if (mat.costPerSqm) return parseFloat(mat.costPerSqm) || 0;
  const d = parseFloat(mat.density) || 0,
    k = parseFloat(mat.costPerKg) || 0,
    t = parseFloat(mat.thickness) || 0;
  return k * d * (t / 1000);
}
export function breakdownBySize(sheets) {
  const map = new Map();
  sheets.forEach(sh => {
    const l = sh.size ? sh.size.l : sh.l,
      w = sh.size ? sh.size.w : sh.w,
      key = `${l}x${w}`;
    if (!map.has(key)) map.set(key, {
      l,
      w,
      count: 0
    });
    map.get(key).count++;
  });
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}
export function labelFromBreakdown(bd, mixed) {
  if (!bd.length) return 'No sheets';
  if (!mixed || bd.length === 1) return `${bd[0].l} × ${bd[0].w}`;
  return bd.map(b => `${b.count}× ${b.l}×${b.w}`).join(' + ');
}
export function packWithScrapAndSizes(scrapPieces, freshSizes, items, settings, opts = {}) {
  let remaining = items;
  const scrapOut = [],
    usedScrapIds = [];
  const sortedScrap = [...(scrapPieces || [])].sort((a, b) => a.length * a.width - b.length * b.width);
  for (const scrap of sortedScrap) {
    if (!remaining.length) break;
    const margin = parseFloat(settings.margin) || 0,
      uW = Math.max(0, scrap.length - 2 * margin),
      uH = Math.max(0, scrap.width - 2 * margin);
    const {
      placements,
      leftover,
      freeRects
    } = packOneBin(uW, uH, remaining, settings, opts);
    if (placements.length) {
      scrapOut.push({
        source: 'scrap',
        scrapId: scrap.id,
        scrapLabel: `${scrap.length} × ${scrap.width}`,
        size: {
          l: scrap.length,
          w: scrap.width
        },
        placements,
        freeRects,
        usableW: uW,
        usableH: uH,
        margin
      });
      usedScrapIds.push(scrap.id);
      remaining = leftover;
    }
  }
  let freshOut = [],
    unplaced = remaining;
  if (remaining.length && freshSizes.length === 1) {
    const sz = freshSizes[0];
    const {
      sheets,
      unplaced: up
    } = packSheets(sz.l, sz.w, remaining, settings, opts);
    sheets.forEach(sh => {
      sh.size = sz;
      sh.source = 'fresh';
    });
    freshOut = sheets;
    unplaced = up;
  } else if (remaining.length && freshSizes.length > 1) {
    const {
      sheets,
      unplaced: up
    } = packMultiSize(freshSizes, remaining, settings, opts);
    sheets.forEach(sh => {
      sh.source = 'fresh';
    });
    freshOut = sheets;
    unplaced = up;
  }
  return {
    sheets: scrapOut.concat(freshOut),
    unplaced,
    usedScrapIds,
    scrapSheetsOut: scrapOut,
    freshSheetsOut: freshOut
  };
}
export function evaluateSheetSize(size, parts, settings, material, scrapPieces = [], opts = {}) {
  const items = buildItemsFromParts(parts, settings),
    n = items.length;
  const {
    sheets,
    unplaced,
    usedScrapIds,
    scrapSheetsOut,
    freshSheetsOut
  } = packWithScrapAndSizes(scrapPieces, [size], items, settings, opts);
  const freshAreaSqm = size.l * size.w / 1e6,
    scrapAreaSqm = scrapSheetsOut.reduce((s, sh) => s + sh.size.l * sh.size.w / 1e6, 0);
  const totalFresh = freshAreaSqm * freshSheetsOut.length,
    totalSheet = totalFresh + scrapAreaSqm,
    placed = n - unplaced.length;
  const partArea = itemAreaSqm(items) * (n ? placed / n : 0),
    util = totalSheet > 0 ? Math.min(100, partArea / totalSheet * 100) : 0,
    scrapPct = totalSheet > 0 ? 100 - util : 0;
  const cpsm = costPerSqmOf(material),
    cost = totalFresh * cpsm,
    scrapValue = cost * (scrapPct / 100) * 0.3;
  const bd = breakdownBySize(freshSheetsOut);
  return {
    size,
    sheets,
    unplaced,
    sheetAreaSqm: freshAreaSqm,
    totalSheetArea: totalSheet,
    partArea,
    utilization: util,
    scrapPct,
    cost,
    scrapValue,
    sheetsUsed: sheets.length,
    freshSheetsUsed: freshSheetsOut.length,
    scrapSheetsUsed: scrapSheetsOut.length,
    usedScrapIds,
    totalPartsRequested: n,
    placedCount: placed,
    mixed: false,
    sizeBreakdown: bd,
    sizeLabel: bd.length ? labelFromBreakdown(bd, false) : scrapSheetsOut.length ? 'Scrap pieces only' : 'No sheets',
    engineTag: opts.engineTag || 'bssf'
  };
}
export function packMultiSize(sizes, items, settings, opts = {}) {
  const margin = parseFloat(settings.margin) || 0;
  let remaining = items;
  const sheets = [];
  let guard = 0;
  while (remaining.length && guard < 800) {
    guard++;
    let best = null;
    for (const size of sizes) {
      const uW = Math.max(0, size.l - 2 * margin),
        uH = Math.max(0, size.w - 2 * margin);
      const {
        placements,
        leftover,
        freeRects
      } = packOneBin(uW, uH, remaining, settings, opts);
      if (!placements.length) continue;
      const aP = placements.reduce((s, p) => s + (p.trueArea || p.w * p.h), 0),
        util = uW * uH > 0 ? aP / (uW * uH) : 0;
      if (!best || placements.length > best.placements.length || placements.length === best.placements.length && util > best.util) best = {
        size,
        placements,
        leftover,
        freeRects,
        usableW: uW,
        usableH: uH,
        util
      };
    }
    if (!best) break;
    sheets.push({
      size: best.size,
      placements: best.placements,
      freeRects: best.freeRects,
      usableW: best.usableW,
      usableH: best.usableH,
      margin
    });
    remaining = best.leftover;
  }
  return {
    sheets,
    unplaced: remaining
  };
}
export function evaluateMixedSizes(sizes, parts, settings, material, scrapPieces = [], opts = {}) {
  const items = buildItemsFromParts(parts, settings),
    n = items.length;
  const {
    sheets,
    unplaced,
    usedScrapIds,
    scrapSheetsOut,
    freshSheetsOut
  } = packWithScrapAndSizes(scrapPieces, sizes, items, settings, opts);
  const scrapAreaSqm = scrapSheetsOut.reduce((s, sh) => s + sh.size.l * sh.size.w / 1e6, 0),
    totalFresh = freshSheetsOut.reduce((s, sh) => s + sh.size.l * sh.size.w / 1e6, 0),
    totalSheet = totalFresh + scrapAreaSqm,
    placed = n - unplaced.length;
  const partArea = itemAreaSqm(items) * (n ? placed / n : 0),
    util = totalSheet > 0 ? Math.min(100, partArea / totalSheet * 100) : 0,
    scrapPct = totalSheet > 0 ? 100 - util : 0;
  const cpsm = costPerSqmOf(material),
    cost = totalFresh * cpsm,
    scrapValue = cost * (scrapPct / 100) * 0.3;
  const bd = breakdownBySize(freshSheetsOut);
  return {
    size: bd[0] ? {
      l: bd[0].l,
      w: bd[0].w
    } : {
      l: 0,
      w: 0
    },
    sheets,
    unplaced,
    totalSheetArea: totalSheet,
    partArea,
    utilization: util,
    scrapPct,
    cost,
    scrapValue,
    sheetsUsed: sheets.length,
    freshSheetsUsed: freshSheetsOut.length,
    scrapSheetsUsed: scrapSheetsOut.length,
    usedScrapIds,
    totalPartsRequested: n,
    placedCount: placed,
    mixed: true,
    sizeBreakdown: bd,
    sizeLabel: bd.length ? labelFromBreakdown(bd, true) : scrapSheetsOut.length ? 'Scrap pieces only' : 'No sheets',
    engineTag: opts.engineTag || 'bssf'
  };
}
export function runOptimization(sizes, parts, settings, material, scrapPieces = [], opts = {}) {
  const results = sizes.map(sz => evaluateSheetSize(sz, parts, settings, material, scrapPieces, opts));
  if (sizes.length > 1) results.unshift(evaluateMixedSizes(sizes, parts, settings, material, scrapPieces, opts));
  if (!sizes.length && scrapPieces.length) results.push(evaluateMixedSizes([], parts, settings, material, scrapPieces, opts));
  results.sort((a, b) => a.unplaced.length - b.unplaced.length || a.sheetsUsed - b.sheetsUsed || b.utilization - a.utilization);
  return results;
}
export function packingFitness(o) {
  if (!o) return Infinity;
  return o.unplaced.length * 100000 + o.sheetsUsed * 1000 - o.utilization + o.cost * 0.01;
}
export function mutateOrder(order) {
  const next = [...order];
  if (!next.length) return next;
  if (Math.random() < 0.5) {
    const i = Math.floor(Math.random() * next.length);
    let j = Math.floor(Math.random() * next.length);
    while (j === i) j = Math.floor(Math.random() * next.length);
    [next[i], next[j]] = [next[j], next[i]];
  } else {
    const from = Math.floor(Math.random() * next.length),
      to = Math.floor(Math.random() * next.length);
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
  }
  return next;
}
export function crossoverOrder(a, b) {
  if (!a.length) return [...b];
  const cut = Math.floor(Math.random() * a.length),
    head = a.slice(0, cut),
    tail = b.filter(id => !head.includes(id));
  return head.concat(tail);
}
export function runGeneticOptimizationAsync(sizes, parts, settings, material, scrapPieces = [], gaSettings = {}, onProgress) {
  return new Promise(resolve => {
    const items = buildItemsFromParts(parts, settings),
      base = defaultItemOrder(items),
      popSize = Math.max(12, parseInt(gaSettings.population) || 48),
      gens = Math.max(10, parseInt(gaSettings.generations) || 80);
    let pop = [{
      itemOrder: base,
      splitMode: 'auto'
    }];
    while (pop.length < popSize) pop.push({
      itemOrder: mutateOrder(base),
      splitMode: SPLIT_MODES[pop.length % SPLIT_MODES.length]
    });
    let best = null,
      bestScore = Infinity,
      gen = 0;
    function step() {
      const batch = Math.min(4, gens - gen);
      for (let b = 0; b < batch; b++) {
        const scored = pop.map(ind => {
          const opts = {
            itemOrder: ind.itemOrder,
            splitMode: ind.splitMode,
            engineTag: 'genetic'
          };
          const r = runOptimization(sizes, parts, settings, material, scrapPieces, opts),
            sc = packingFitness(r[0]);
          return {
            ind,
            score: sc,
            result: r
          };
        });
        scored.sort((a, b) => a.score - b.score);
        if (scored[0].score < bestScore) {
          bestScore = scored[0].score;
          best = scored[0];
        }
        gen++;
        if (onProgress) onProgress(Math.round(gen / gens * 100), gen, gens, bestScore);
        const next = scored.slice(0, Math.min(8, scored.length)).map(s => s.ind);
        while (next.length < popSize) {
          const p1 = scored[Math.floor(Math.random() * Math.min(12, scored.length))].ind,
            p2 = scored[Math.floor(Math.random() * Math.min(12, scored.length))].ind;
          let child = {
            itemOrder: crossoverOrder(p1.itemOrder, p2.itemOrder),
            splitMode: Math.random() < 0.5 ? p1.splitMode : p2.splitMode
          };
          if (Math.random() < 0.2) child.itemOrder = mutateOrder(child.itemOrder);
          if (Math.random() < 0.1) child.splitMode = SPLIT_MODES[Math.floor(Math.random() * SPLIT_MODES.length)];
          next.push(child);
        }
        pop = next;
      }
      if (gen < gens) setTimeout(step, 0);else {
        if (best?.result) resolve(best.result.map(r => ({
          ...r,
          engineTag: 'genetic',
          gaScore: bestScore
        })));else resolve(runOptimization(sizes, parts, settings, material, scrapPieces));
      }
    }
    setTimeout(step, 0);
  });
}
export function packSecondaryParts(sheets, parts, settings, opts = {}) {
  const items = buildItemsFromParts(parts, settings).map(it => ({
    ...it,
    color: T.green,
    isSecondary: true
  }));
  let remaining = items;
  const newSheets = sheets.map(sh => {
    if (!remaining.length) return sh;
    const initialFreeRects = sh.freeRects.map(r => ({
      ...r
    }));
    const {
      placements,
      leftover,
      freeRects
    } = packOneBin(sh.usableW, sh.usableH, remaining, settings, {
      ...opts,
      initialFreeRects
    });
    remaining = leftover;
    return {
      ...sh,
      placements: [...sh.placements, ...placements],
      freeRects,
      secondaryPlacements: placements
    };
  });
  return {
    sheets: newSheets,
    unplaced: remaining
  };
}
export function collectScrapCandidates(option, minScrap) {
  const out = [];
  option.sheets.forEach((sh, si) => sh.freeRects.forEach(r => {
    if (r.w >= minScrap && r.h >= minScrap) out.push({
      sheetIndex: si,
      length: Math.round(r.w),
      width: Math.round(r.h)
    });
  }));
  return out;
}

/* ─── AI Quality Scoring ─── */
export function aiQualityScore(result) {
  if (!result) return {
    score: 0,
    grade: 'N/A',
    color: '#64748b',
    reason: ''
  };
  const util = result.utilization;
  const unplaced = result.unplaced?.length || 0;
  let score = Math.round(util * 0.7 + (unplaced === 0 ? 30 : 0));
  score = Math.min(100, score);
  let grade, color, reason;
  if (score >= 88) {
    grade = 'Excellent';
    color = '#10b981';
    reason = 'Maximum material efficiency achieved';
  } else if (score >= 72) {
    grade = 'Good';
    color = '#3b82f6';
    reason = 'Good utilization with minor scrap';
  } else if (score >= 55) {
    grade = 'Warning';
    color = '#f59e0b';
    reason = 'Significant scrap detected; consider alternate sheet sizes';
  } else {
    grade = 'Poor';
    color = '#ef4444';
    reason = 'Low utilization — adjust part mix or sheet selection';
  }
  if (unplaced > 0) {
    grade = 'Critical';
    color = '#ef4444';
    reason = `${unplaced} parts could not be placed`;
  }
  return {
    score,
    grade,
    color,
    reason
  };
}
export function aiAutoSelectAlgorithm(parts) {
  const total = parts.reduce((s, p) => s + (parseInt(p.qty) || 0), 0);
  if (total > 50) return 'genetic';
  return 'fast';
}

/* ─── DXF Parsing ─── */
