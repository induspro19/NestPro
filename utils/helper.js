
/* ============================================================
   ISNS AI Enterprise — Intelligent Nesting Platform
   Premium upgrade: Dark industrial UI, AI scoring, enhanced
   canvas with scrap zones, new shapes, live analytics,
   job reports. All original algorithms preserved intact.
   ============================================================ */

/* ─── constants ─── */
export const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#a855f7', '#22d3ee', '#84cc16'];
export function hashColor(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = h * 31 + str.charCodeAt(i) >>> 0;
  return PALETTE[h % PALETTE.length];
}
export function uid(p) {
  return `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
export const fmt = (n, d = 0) => Number.isFinite(n) ? n.toLocaleString('en-IN', {
  maximumFractionDigits: d,
  minimumFractionDigits: d
}) : '—';
export const fmtCurrency = n => `₹${fmt(n, 0)}`;
export function parseCsvParts(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const rows = lines.map(l => l.split(/,|\t/).map(c => c.trim()));
  let header = rows[0].map(c => c.toLowerCase());
  const looksLikeHeader = header.some(c => /part|length|width|qty/.test(c));
  const dataRows = looksLikeHeader ? rows.slice(1) : rows;
  const idx = {
    partNo: header.findIndex(c => /part/.test(c)),
    length: header.findIndex(c => /length|len\b/.test(c)),
    width: header.findIndex(c => /width|wid\b/.test(c)),
    qty: header.findIndex(c => /qty|quantity/.test(c))
  };
  const useDefault = !looksLikeHeader || idx.partNo === -1;
  return dataRows.map((r, i) => useDefault ? {
    id: uid('p'),
    partNo: r[0] || `P${i + 1}`,
    length: parseFloat(r[1]) || 0,
    width: parseFloat(r[2]) || 0,
    qty: parseInt(r[3]) || 1,
    priority: 'Normal',
    allowRotation: true,
    shapeType: 'rectangle'
  } : {
    id: uid('p'),
    partNo: r[idx.partNo] || `P${i + 1}`,
    length: parseFloat(r[idx.length >= 0 ? idx.length : 1]) || 0,
    width: parseFloat(r[idx.width >= 0 ? idx.width : 2]) || 0,
    qty: parseInt(r[idx.qty >= 0 ? idx.qty : 3]) || 1,
    priority: 'Normal',
    allowRotation: true,
    shapeType: 'rectangle'
  }).filter(p => p.length > 0 && p.width > 0);
}

/* ─── Seed Data ─── */
export function blankDraft() {
  return {
    jobNo: `JOB-${Math.floor(1000 + Math.random() * 9000)}`,
    project: '',
    customer: '',
    materialId: '',
    selectedSizeIds: [],
    selectedScrapIds: [],
    settings: {
      kerf: 2,
      gap: 5,
      margin: 10,
      minScrap: 300,
      allowRotation: true,
      optimizeMode: 'fast',
      gaGenerations: 80,
      gaPopulation: 48
    },
    parts: []
  };
}
export const SEED_MATERIALS = [{
  id: uid('mat'),
  name: 'Stainless Steel',
  grade: 'SS304 2B',
  thickness: 3,
  density: 8000,
  costPerKg: 0,
  costPerSqm: 2160,
  supplier: 'Jindal',
  stock: 5000,
  sheetSizes: [{
    id: uid('sz'),
    l: 2500,
    w: 1250
  }, {
    id: uid('sz'),
    l: 3000,
    w: 1500
  }]
}, {
  id: uid('mat'),
  name: 'Mild Steel',
  grade: 'IS2062',
  thickness: 5,
  density: 7850,
  costPerKg: 62,
  costPerSqm: 0,
  supplier: 'SAIL',
  stock: 8000,
  sheetSizes: [{
    id: uid('sz'),
    l: 2500,
    w: 1250
  }, {
    id: uid('sz'),
    l: 3000,
    w: 1500
  }, {
    id: uid('sz'),
    l: 4000,
    w: 2000
  }]
}];

/* ══════════════════════════════════════════════
   UI COMPONENTS - DARK INDUSTRIAL DESIGN
══════════════════════════════════════════════ */

/* ─── Design Tokens ─── */
/* ─── Seed Data ─── */
export const SEED_STANDARD_PARTS = [{
  id: uid('sp'),
  partNo: 'BKT-01',
  name: 'Bracket Small',
  length: 120,
  width: 80,
  qty: 0,
  priority: 'High',
  allowRotation: true,
  shapeType: 'lshape',
  cutoutLength: 60,
  cutoutWidth: 40,
  materialName: 'Stainless Steel (SS304 2B)',
  thickness: 3,
  currentStock: 5,
  targetStock: 50
}, {
  id: uid('sp'),
  partNo: 'PLT-CLP',
  name: 'Clamp Plate',
  length: 60,
  width: 60,
  qty: 0,
  priority: 'Medium',
  allowRotation: true,
  shapeType: 'circle',
  materialName: 'Stainless Steel (SS304 2B)',
  thickness: 3,
  currentStock: 12,
  targetStock: 30
}, {
  id: uid('sp'),
  partNo: 'SUP-05',
  name: 'Support Clip',
  length: 90,
  width: 45,
  qty: 0,
  priority: 'Low',
  allowRotation: true,
  shapeType: 'triangle',
  materialName: 'Stainless Steel (SS304 2B)',
  thickness: 3,
  currentStock: 8,
  targetStock: 100
}, {
  id: uid('sp'),
  partNo: 'GUS-22',
  name: 'Gusset Plate',
  length: 150,
  width: 150,
  qty: 0,
  priority: 'Normal',
  allowRotation: true,
  shapeType: 'trapezoid',
  sideA: 150,
  sideB: 50,
  materialName: 'Mild Steel (IS2062)',
  thickness: 5,
  currentStock: 0,
  targetStock: 40
}];
